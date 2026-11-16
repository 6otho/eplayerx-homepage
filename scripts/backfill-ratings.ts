/**
 * 🎯 全量评分同步（与 MDBList 完全一致，不允许 0.1 的差）
 *
 * 逻辑（严格按需求）：
 *   1. 遍历所有分类数据文件，收集全部 (mediaType, tmdbId)
 *   2. 每个条目都【强制重查 MDBList】（不看缓存是否完整）
 *   3. 用最新值覆盖缓存
 *   4. 再把缓存按正确刻度烘焙回数据文件
 *
 * 刻度（客户端直接显示）：
 *   imdb/mal   0-10  原样
 *   letterboxd 0-5   原样
 *   trakt/tmdb 0-100 ÷10
 *   tomatoes/metacritic 0-100 原样
 */

import { listR2Keys, getRawJson, putRawJson } from "../src/blocks/storage.js";
import {
	fetchItemRatings,
	MdblistRateLimitError,
	parseMdblistApiKeys,
} from "../src/ratings/mdblist.js";

const CACHE_KEY = "mdblist-ratings-cache.json";
const SKIP = new Set([
	"blacklist.json", "cron_state.json", "layout-config.json", "schedule-override.json",
	"eplayerx-boxes.json", "eplayerx-folders.json", CACHE_KEY,
]);

interface Item {
	tmdbId?: number;
	id?: number;
	media_type?: string;
	name?: string;
	title?: string;
	ratings?: Record<string, number>;
}

type Cache = Record<string, Record<string, number>>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 缓存值 → 客户端显示值。
 * 🎯 与上游完全一致：MDBList 给什么就存什么，不做任何 toFixed / 取整 / 除 10。
 *    （之前这里的舍入/换算正是"和上游差一点点"的原因）
 */
function bake(src: string, v: number): number | undefined {
	const n = Number(v);
	if (!Number.isFinite(n) || n <= 0) return undefined;
	switch (src) {
		case "imdb":
		case "mal":
		case "letterboxd":
		case "trakt":
		case "tmdb":
		case "metacritic":
		case "tomatoes":
		case "tomatoesAudience":
		case "rogerebert":
		case "popcorn":
		case "average":
			return n;                      // 原样
		default:
			return undefined;
	}
}

const TMDB_TOKEN = process.env.TMDB_API_TOKEN || "";
const voteCache = new Map<string, number>();

/** 从 TMDB 取真实的 vote_average（0-10），带内存缓存 */
async function fetchTmdbVoteAverage(mt: "movie" | "tv", tmdbId: number | string): Promise<number | undefined> {
	const key = `${mt}:${tmdbId}`;
	if (voteCache.has(key)) return voteCache.get(key);
	if (!TMDB_TOKEN) return undefined;
	try {
		const res = await fetch(`https://api.themoviedb.org/3/${mt}/${tmdbId}?language=zh-CN`, {
			headers: { Authorization: `Bearer ${TMDB_TOKEN}`, accept: "application/json" },
		});
		if (!res.ok) { voteCache.set(key, 0); return undefined; }
		const j = (await res.json()) as { vote_average?: number };
		const v = typeof j.vote_average === "number" ? j.vote_average : 0;
		voteCache.set(key, v);
		return v > 0 ? v : undefined;
	} catch {
		voteCache.set(key, 0);
		return undefined;
	}
}

async function main(): Promise<void> {
	const keys = parseMdblistApiKeys();
	console.log(`MDBList keys: ${keys.length}`);
	if (keys.length === 0) { console.error("❌ MDBLIST_API_KEY 未配置"); process.exit(1); }

	// 🎯 默认只补每个分类前 20 条（对应轮播图/首屏，与上游 refreshTrendingRatings 一致）
	//    要全量补漏时显式传 TOP_ONLY=0
	const topOnly = process.env.TOP_ONLY !== "0";
	const TOP_N = 20;
	const arg = process.argv[2] || process.env.CATEGORY_FILTER || "";

	// 1) 收集所有条目
	const norm = (s: string) => s.toLowerCase().replace(/[-_]/g, "");
	const files = (await listR2Keys(""))
		.filter((k) => !SKIP.has(k) && !k.startsWith("_$"))
		.filter((k) => (arg ? norm(k).includes(norm(arg)) : true));

	// 🔑 增量模式：先读缓存，已有完整评分的条目直接跳过，只查新增/缺失的
	let cache: Cache = {};
	try {
		const raw = (await getRawJson(CACHE_KEY)) as Cache;
		if (raw && typeof raw === "object" && !Array.isArray(raw)) cache = raw;
	} catch { cache = {}; }
	console.log(`已有缓存: ${Object.keys(cache).length} 条`);

	// 一条评分"完整"的判定：至少 3 个来源有值
	const RATING_KEYS = ["imdb", "trakt", "rotten_tomatoes", "letterboxd", "metacritic"];
	// 判定「评分够全」用的字段（含 MDBList 原始键名 + 烘焙后的别名）
	const RETRY_KEYS = ["imdb", "trakt", "rotten_tomatoes", "tomatoes", "letterboxd", "metacritic", "tmdb"];
	// ✅ 与上游一致：缓存里有这条记录就跳过（不管几个来源）
	//    原注释："Unique tmdbIds are cached in R2 so each title is queried at most once"
	//    额外保险：仍保留 7 天冷却，防止空记录被反复重查
	const RETRY_DAYS = Number(process.env.RETRY_DAYS || 7);
	const RETRY_MS = RETRY_DAYS * 86400 * 1000;
	const isComplete = (ck: string) => {
		const c = cache[ck];
		if (!c || typeof c !== "object") return false;
		const n = RETRY_KEYS.filter((k) => {
			const v = (c as Record<string, number>)[k];
			return typeof v === "number" && v > 0;
		}).length;
		// 🎯 来源 ≥3 才算完整（只有 trakt 一条不算，继续补烂番茄/imdb）
		if (n >= 3) return true;
		// 完全查不到数据：冷却期内不重查
		const at = Number((c as Record<string, unknown>).__checkedAt || 0);
		return at > 0 && Date.now() - at < RETRY_MS;
	};

	let skipped = 0;
	const targets = new Map<string, { mt: "movie" | "tv"; tmdbId: number; label: string }>();
	for (const key of files) {
		let json: { data?: Item[] };
		try { json = (await getRawJson(key)) as { data?: Item[] }; } catch { continue; }
		const items = json?.data;
		if (!Array.isArray(items)) continue;
		items.forEach((it, i) => {
			const tmdbId = it.tmdbId || it.id;
			if (!tmdbId) return;
			if (topOnly && i >= TOP_N) return;
			const mt = (String(it.media_type || key).toLowerCase().includes("movie") ? "movie" : "tv") as "movie" | "tv";
			const ck = `${mt}:${tmdbId}`;
			if (targets.has(ck)) return;
			// 🎯 与上游 refreshTrendingRatings 一致：前 20 条（首页展示位）每天强制重查，
			//    不管缓存里有没有 —— 否则 MDBList 后补的 letterboxd/烂番茄永远拿不到
			const isHead = i < TOP_N;
			if (!isHead && isComplete(ck)) { skipped++; return; }
			targets.set(ck, { mt, tmdbId, label: it.name || it.title || String(tmdbId) });
		});
	}
	console.log(`文件: ${files.length} | 已有评分跳过: ${skipped} | 待查询: ${targets.size}${topOnly ? " (仅前20)" : ""}`);
	if (targets.size === 0) { console.log("无条目"); return; }

	// 2) 只查缺失的条目
	let done = 0, got = 0, empty = 0, failed = 0, quotaHit = false;
	const list = [...targets.entries()];

	for (const [ck, info] of list) {
		if (quotaHit) break;
		done++;
		try {
			const r = await fetchItemRatings(info.tmdbId, info.mt);
			const clean: Record<string, number> = {};
			for (const [src, v] of Object.entries(r)) {
				if (typeof v === "number" && Number.isFinite(v) && v > 0) clean[src] = v;
			}
			// ⛔ 拿到空值时不覆盖：保留已有缓存，避免查询失败把好数据抹掉
			//    （之前 `cache[ck] = clean` 无条件覆盖，遇到额度/网络波动就会清空）
			if (Object.keys(clean).length > 0) {
				const merged = { ...(cache[ck] || {}), ...clean };
				// 🎯 只有来源够全（≥3）才打冷却标记；
				//    只查到 1-2 个源的（如只有 trakt）下次还要再查，否则烂番茄永远补不上
				const scored = RETRY_KEYS.filter((k) => typeof (merged as Record<string, number>)[k] === "number").length;
				if (scored >= 3) (merged as Record<string, unknown>).__checkedAt = Date.now();
				cache[ck] = merged;
				got++;
			} else {
				// 查了但 MDBList 一条都没有：冷却期内不再重查
				cache[ck] = { ...(cache[ck] || {}), __checkedAt: Date.now() };
				empty++;
			}
		} catch (e) {
			if (e instanceof MdblistRateLimitError) {
				quotaHit = true;
				console.warn(`  ⚠️ 额度耗尽于 ${done}/${list.length}`);
			} else {
				failed++;
			}
		}
		if (done % 100 === 0) {
			console.log(`  进度 ${done}/${list.length} | 有值 ${got} | 空 ${empty}`);
			await sleep(150);
		}
		await sleep(90);
	}

	console.log(`\n重查完成: ${done} 条 | 有值 ${got} | 空 ${empty} | 失败 ${failed}`);
	await putRawJson(CACHE_KEY, cache);
	console.log(`缓存已写入: ${Object.keys(cache).length} 条`);

	// 3) 烘焙回数据文件
	console.log("\n开始烘焙到数据文件...");
	let filesChanged = 0, itemsUpdated = 0;
	for (const key of files) {
		let json: { data?: Item[]; count?: number; lastUpdated?: string };
		try { json = (await getRawJson(key)) as { data?: Item[] }; } catch { continue; }
		const items = json?.data;
		if (!Array.isArray(items) || !items.length) continue;

		let changed = false;
		for (const it of items) {
			const tmdbId = it.tmdbId || it.id;
			if (!tmdbId) continue;
			const mt = (String(it.media_type || key).toLowerCase().includes("movie") ? "movie" : "tv") as "movie" | "tv";
			const c = cache[`${mt}:${tmdbId}`];
			if (!c) continue;

			// 🔒 核心原则：文件里已有的评分【永不覆盖】，缓存只用来补空白
			//    原因：用户手动提取的结果（含全部 10 个评分源）比缓存更完整，
			//          之前用缓存重建导致 metacritic / letterboxd 被反复砍掉
			// ✅ 缓存优先：以 MDBList 为准，保证与上游完全一致
			const merged: Record<string, number> = { ...(it.ratings || {}) };
			const fill = (k, v) => { if (v !== undefined) merged[k] = v; };
			// __checkedAt 是内部冷却标记，不写入数据文件
			if (merged.__checkedAt) delete merged.__checkedAt;
			if (c) {
				if (c.tmdb) fill("tmdb", bake("tmdb", c.tmdb));
				if (c.imdb) fill("imdb", bake("imdb", c.imdb));
				if (c.trakt) fill("trakt", bake("trakt", c.trakt));
				if (c.letterboxd) fill("letterboxd", bake("letterboxd", c.letterboxd));
				// 🎯 与上游 ItemRatings 一致：键名是 tomatoes（不是 rotten_tomatoes）
				if (c.tomatoes) { const v = bake("tomatoes", c.tomatoes); fill("tomatoes", v); fill("rotten_tomatoes", v); }
				if (c.tomatoesAudience) fill("tomatoesAudience", bake("tomatoesAudience", c.tomatoesAudience));
				if (c.metacritic) fill("metacritic", bake("metacritic", c.metacritic));
				if (c.metacriticUser || c.metacriticuser) fill("metacriticUser", Number(c.metacriticUser || c.metacriticuser));
				if (c.mal) fill("mal", bake("mal", c.mal));
				if (c.rogerebert) fill("rogerebert", bake("rogerebert", c.rogerebert));
			}

			// 🔑 顶层冗余字段：客户端读的是这些，不是 ratings 里的
			//    （手动提取会写全套，GitHub Actions 之前漏了，导致客户端显示不出来）
			const setIfMissing = (k: string, v: number | undefined) => {
				if (v === undefined) return;
				if (it[k] === undefined || it[k] === null) (it as Record<string, unknown>)[k] = v;
			};
			if (merged.trakt) { setIfMissing("trakt_rating", merged.trakt); setIfMissing("traktRating", merged.trakt); }
			if (merged.imdb) { setIfMissing("imdb_rating", merged.imdb); setIfMissing("imdbRating", merged.imdb); }
			if (merged.letterboxd) {
				setIfMissing("letterboxd_rating", merged.letterboxd);
				setIfMissing("letterboxdRating", merged.letterboxd);
				setIfMissing("letterboxd", merged.letterboxd);
			}
			if (merged.tomatoes || merged.rotten_tomatoes) {
				const rt = merged.tomatoes ?? merged.rotten_tomatoes;
				for (const k of ["rotten_tomatoes", "rottenTomatoes", "tomato_rating", "tomatoRating", "tomatoMeter", "tomatoes", "rt"]) {
					setIfMissing(k, rt);
				}
			}
			if (merged.metacritic) setIfMissing("metacritic", merged.metacritic);

			// 评分内容变化 → 写回 + 刷新时间戳
			if (JSON.stringify(it.ratings || {}) !== JSON.stringify(merged)) {
				it.ratings = merged;
				changed = true;
				itemsUpdated++;
			}
			// 🎯 vote_average 必须是 TMDB 原始评分(0-10)。
			//    历史脏数据里被写成了 0-100（如 100），这里从 TMDB 拉真值修正一次。
			if (typeof it.vote_average === "number" && it.vote_average > 10) {
				const real = await fetchTmdbVoteAverage(mt, tmdbId);
				if (real && real > 0) {
					(it as Record<string, unknown>).vote_average = real;
					changed = true;
				}
			}
			// crawledAt 同步刷新（辅助信号）
			if (c) {
				(it as Record<string, unknown>).crawledAt = new Date().toISOString();
				changed = true;
			}
		}
		if (changed) {
			json.count = items.length;
			json.lastUpdated = new Date().toISOString();
			await putRawJson(key, json);
			filesChanged++;
		}
	}
	console.log(`烘焙完成: ${filesChanged} 个文件, ${itemsUpdated} 条更新`);
}

main().catch((e) => { console.error(e); process.exit(1); });

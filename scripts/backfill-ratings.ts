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

/** 缓存值（MDBList 原样）→ 客户端显示值 */
function bake(src: string, v: number): number | undefined {
	const n = Number(v);
	if (!Number.isFinite(n) || n <= 0) return undefined;
	switch (src) {
		case "imdb":
		case "mal":
			return Number(n.toFixed(1));
		case "letterboxd":
			return Number((n > 5 ? n / 10 : n).toFixed(1));
		case "trakt":
		case "tmdb":
		case "metacritic":
			return Number((n / 10).toFixed(1));
		case "tomatoes":
		case "tomatoesAudience":
			return Math.round(n);
		case "rogerebert":
			return Number(n.toFixed(1));
		default:
			return undefined;
	}
}

async function main(): Promise<void> {
	const keys = parseMdblistApiKeys();
	console.log(`MDBList keys: ${keys.length}`);
	if (keys.length === 0) { console.error("❌ MDBLIST_API_KEY 未配置"); process.exit(1); }

	const topOnly = process.env.TOP_ONLY === "1";
	const TOP_N = 20;
	const arg = process.argv[2] || process.env.CATEGORY_FILTER || "";

	// 1) 收集所有条目
	const norm = (s: string) => s.toLowerCase().replace(/[-_]/g, "");
	const files = (await listR2Keys(""))
		.filter((k) => !SKIP.has(k) && !k.startsWith("_$"))
		.filter((k) => (arg ? norm(k).includes(norm(arg)) : true));

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
			if (!targets.has(ck)) targets.set(ck, { mt, tmdbId, label: it.name || it.title || String(tmdbId) });
		});
	}
	console.log(`文件: ${files.length} | 待重查条目: ${targets.size}${topOnly ? " (仅前20)" : " (全量)"}`);
	if (targets.size === 0) { console.log("无条目"); return; }

	// 2) 强制重查每一条
	const cache: Cache = {};
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
			// MDBList 空值也要写入（清除历史残留）
			cache[ck] = clean;
			if (Object.keys(clean).length) got++; else empty++;
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
			const mt = String(it.media_type || key).toLowerCase().includes("movie") ? "movie" : "tv";
			const c = cache[`${mt}:${tmdbId}`];
			if (!c) continue;

			const out: Record<string, number> = {};
			if (c.tmdb) { const v = bake("tmdb", c.tmdb); if (v) out.tmdb = v; }
			if (c.imdb) { const v = bake("imdb", c.imdb); if (v) out.imdb = v; }
			if (c.trakt) { const v = bake("trakt", c.trakt); if (v) out.trakt = v; }
			if (c.letterboxd) { const v = bake("letterboxd", c.letterboxd); if (v) out.letterboxd = v; }
			if (c.tomatoes) { const v = bake("tomatoes", c.tomatoes); if (v) out.rotten_tomatoes = v; }
			if (c.tomatoesAudience) { const v = bake("tomatoesAudience", c.tomatoesAudience); if (v) out.tomatoesAudience = v; }
			if (c.metacritic) { const v = bake("metacritic", c.metacritic); if (v) out.metacritic = v; }
			if (c.mal) { const v = bake("mal", c.mal); if (v) out.mal = v; }
			if (c.rogerebert) { const v = bake("rogerebert", c.rogerebert); if (v) out.rogerebert = v; }

			if (JSON.stringify(it.ratings || {}) !== JSON.stringify(out)) {
				it.ratings = out;
				changed = true;
				itemsUpdated++;
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

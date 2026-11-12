/**
 * 🎯 评分补全（写入独立缓存，与上游架构一致）
 *
 * 设计（对照上游 refreshTrendingRatings）：
 *   - 只维护 mdblist-ratings-cache.json 一个文件
 *   - 不修改任何分类数据文件
 *   - 缓存存 MDBList 原样值（0-100 刻度）
 *   - 遍历数据文件找出缺失评分的 tmdbId，逐个补进缓存
 *
 * 用法：
 *   bun run scripts/backfill-ratings.ts                # 全部
 *   bun run scripts/backfill-ratings.ts tmdb_tv_th     # 单个分类
 */

import { listR2Keys, getRawJson, putRawJson } from "../src/blocks/storage.js";
import {
	fetchItemRatings,
	MdblistRateLimitError,
	parseMdblistApiKeys,
} from "../src/ratings/mdblist.js";

const CACHE_KEY = "mdblist-ratings-cache.json";
const REQUIRED = ["tmdb", "imdb", "trakt", "letterboxd"] as const;
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

function missing(r: Record<string, number> | undefined): string[] {
	if (!r || !Object.keys(r).length) return [...REQUIRED];
	return REQUIRED.filter((k) => !r[k]);
}

async function main(): Promise<void> {
	const arg = process.argv[2] || process.env.CATEGORY_FILTER || "";
	const keys = parseMdblistApiKeys();
	console.log(`MDBList keys: ${keys.length}`);
	if (keys.length === 0) { console.error("❌ MDBLIST_API_KEY 未配置"); process.exit(1); }

	let cache: Cache = {};
	try {
		const raw = (await getRawJson(CACHE_KEY)) as Cache;
		if (raw && typeof raw === "object" && !Array.isArray(raw)) cache = raw;
	} catch { cache = {}; }
	console.log(`缓存现有条目: ${Object.keys(cache).length}`);

	// 收集所有需要补的 (mediaType, tmdbId)
	const norm = (s: string) => s.toLowerCase().replace(/[-_]/g, "");
	const files = (await listR2Keys(""))
		.filter((k) => !SKIP.has(k) && !k.startsWith("_$"))
		.filter((k) => (arg ? norm(k).includes(norm(arg)) : true));
	console.log(`扫描文件: ${files.length}`);

	// 🎯 优先级：每个文件前 TOP_N 条视为"必补"，其余按常规
	const TOP_N = 20;
	const priority = new Map<string, { mt: "movie" | "tv"; tmdbId: number; label: string }>();
	const normal = new Map<string, { mt: "movie" | "tv"; tmdbId: number; label: string }>();
	let totalItems = 0;

	for (const key of files) {
		let json: { data?: Item[] };
		try { json = (await getRawJson(key)) as { data?: Item[] }; } catch { continue; }
		const items = json?.data;
		if (!Array.isArray(items)) continue;
		items.forEach((it, idx) => {
			const tmdbId = it.tmdbId || it.id;
			if (!tmdbId) return;
			totalItems++;
			const mt = (String(it.media_type || key).toLowerCase().includes("movie") ? "movie" : "tv") as "movie" | "tv";
			const ck = `${mt}:${tmdbId}`;
			if (missing(cache[ck]).length === 0) return;
			const entry = { mt, tmdbId, label: it.name || it.title || String(tmdbId) };
			if (idx < TOP_N) { if (!priority.has(ck)) priority.set(ck, entry); }
			else if (!priority.has(ck) && !normal.has(ck)) normal.set(ck, entry);
		});
	}

	// 前 20 的条目优先，且不被后 60 条覆盖
	const need = new Map<string, { mt: "movie" | "tv"; tmdbId: number; label: string }>();
	for (const [k, v] of priority) need.set(k, v);
	// TOP_ONLY=1 时只补前 20，其余交给每日自动任务
	const topOnly = process.env.TOP_ONLY === "1";
	if (!topOnly) for (const [k, v] of normal) if (!need.has(k)) need.set(k, v);
	console.log(`优先(前${TOP_N}): ${priority.size} | 其余: ${normal.size}${topOnly ? " (本轮只补优先)" : ""}`);

	console.log(`条目总数: ${totalItems} | 待补: ${need.size}`);
	if (need.size === 0) { console.log("✅ 全部完整"); return; }

	let filled = 0, stillMissing = 0, failed = 0, quotaHit = false;
	const list = [...need.entries()];

	for (let i = 0; i < list.length; i++) {
		const [ck, info] = list[i];
		if (quotaHit) break;
		try {
			const ratings = await fetchItemRatings(info.tmdbId, info.mt);
			const prev = cache[ck] || {};
			const merged: Record<string, number> = { ...prev };
			for (const [src, v] of Object.entries(ratings)) {
				if (typeof v === "number" && Number.isFinite(v) && v > 0) merged[src] = v;
			}
			if (Object.keys(merged).length > Object.keys(prev).length) {
				cache[ck] = merged;
				filled++;
			} else if (missing(merged).length > 0) {
				stillMissing++;
			}
			if ((i + 1) % 100 === 0) {
				await putRawJson(CACHE_KEY, cache);
				console.log(`  进度 ${i + 1}/${list.length} | 新增 ${filled}`);
			}
		} catch (e) {
			if (e instanceof MdblistRateLimitError) {
				quotaHit = true;
				console.warn(`  ⚠️ 额度耗尽，已保存进度（${i}/${list.length}）`);
			} else {
				failed++;
			}
		}
		await sleep(100);
	}

	await putRawJson(CACHE_KEY, cache);
	console.log(`\n═══════════════════════`);
	console.log(`新增评分: ${filled}`);
	console.log(`数据源无: ${stillMissing}`);
	console.log(`失败: ${failed}`);
	console.log(`缓存总条目: ${Object.keys(cache).length}`);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });

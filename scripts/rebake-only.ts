/**
 * 🔄 只用现有缓存重新烘焙（不查 MDBList，不消耗额度）
 *    用途：修正历史上被 Trakt 直连兜底污染的文件值
 */

import { listR2Keys, getRawJson, putRawJson } from "../src/blocks/storage.js";

const CACHE_KEY = "mdblist-ratings-cache.json";
const SKIP = new Set([
	"blacklist.json", "cron_state.json", "layout-config.json", "schedule-override.json",
	"eplayerx-boxes.json", "eplayerx-folders.json", CACHE_KEY,
]);

interface Item {
	tmdbId?: number;
	id?: number;
	media_type?: string;
	ratings?: Record<string, number>;
	trakt_rating?: number;
	traktRating?: number;
	imdb_rating?: number;
	imdbRating?: number;
	tomatoes?: number;
	rt?: number;
}

type Cache = Record<string, Record<string, number>>;

/**
 * 🎯 与上游完全一致：MDBList 给什么就存什么，不做任何 toFixed / 取整 / 除 10。
 *    （之前这里的换算正是"和上游差一点点"的原因）
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

async function main(): Promise<void> {
	let cache: Cache = {};
	try {
		const raw = (await getRawJson(CACHE_KEY)) as Cache;
		if (raw && typeof raw === "object" && !Array.isArray(raw)) cache = raw;
	} catch { }
	console.log(`缓存条目: ${Object.keys(cache).length}`);

	const keys = (await listR2Keys("")).filter((k) => !SKIP.has(k) && !k.startsWith("_$"));
	console.log(`文件: ${keys.length}`);

	let filesChanged = 0, itemsUpdated = 0, cleared = 0;

	for (const key of keys) {
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

			// 缓存没有 → 清空文件里的评分（避免保留污染值）
			// ⛔ 缓存里没有 → 完全跳过，绝不改动文件里已有的评分
			//    （手动提取的结果不经过缓存，之前这里清空导致用户成果被抹掉 3 次）
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
			if (c.metacriticUser || c.metacriticuser) { const v = Number(c.metacriticUser || c.metacriticuser); if (v>0) out.metacriticUser = v; }

			// 🔒 文件里已有的来源，缓存没有的保留（不删用户手动提取的评分）
			// ✅ 缓存优先：以 MDBList 为准覆盖文件值，保证与上游完全一致
			//    （手动提取本质上也是查 MDBList，只是时间点不同，无需保护）
			const merged: Record<string, number> = { ...(it.ratings || {}), ...out };

			if (it.trakt_rating) { merged.trakt = it.trakt_rating; }
			else if (out.trakt) { it.trakt_rating = out.trakt; it.traktRating = out.trakt; }

			if (JSON.stringify(it.ratings || {}) !== JSON.stringify(merged)) {
				it.ratings = merged;
				changed = true;
				itemsUpdated++;
			}
			// 🎯 vote_average 保持 TMDB 原始值(0-10)，不被 ratings.tmdb(0-100) 覆盖
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
	console.log(`\n更新文件: ${filesChanged} | 更新条目: ${itemsUpdated} | 清空污染: ${cleared}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

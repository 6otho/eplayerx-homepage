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
			if (!c) {
				if (it.ratings && Object.keys(it.ratings).length) {
					it.ratings = {};
					delete it.trakt_rating; delete it.traktRating;
					delete it.imdb_rating; delete it.imdbRating;
					delete it.tomatoes; delete it.rt;
					changed = true; cleared++;
				}
				continue;
			}

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

			// 同步修正顶层字段（避免 trakt_rating=8.1 这类污染残留）
			if (out.trakt) { it.trakt_rating = out.trakt; it.traktRating = out.trakt; }
			else { delete it.trakt_rating; delete it.traktRating; }
			if (out.imdb) { it.imdb_rating = out.imdb; it.imdbRating = out.imdb; }
			else { delete it.imdb_rating; delete it.imdbRating; }

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
	console.log(`\n更新文件: ${filesChanged} | 更新条目: ${itemsUpdated} | 清空污染: ${cleared}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

/**
 * 🎯 把评分缓存「烘焙」回分类数据文件
 *
 * 背景：客户端直连 R2（秒开），不走 Worker，所以 Worker 里的刻度转换无效。
 *       本脚本把缓存里的评分按正确刻度写回每个分类 JSON 的 ratings 字段。
 *
 * 刻度（客户端直接显示这些值）：
 *   imdb       0-10  原样
 *   letterboxd 0-5   原样
 *   trakt      0-100 → ÷10
 *   tmdb       0-100 → ÷10
 *   tomatoes   0-100 原样（百分比）
 *   tomatoesAudience 0-100 原样
 *   metacritic 0-100 原样
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
}

type Cache = Record<string, Record<string, number>>;

/** 缓存值 → 客户端显示值 */
function bake(src: string, v: number): number | undefined {
	const n = Number(v);
	if (!Number.isFinite(n) || n <= 0) return undefined;
	switch (src) {
		case "imdb":
		case "mal":
			return Number(n.toFixed(1));            // 0-10 原样
		case "letterboxd":
			return Number((n > 5 ? n / 10 : n).toFixed(1)); // 0-5，兼容历史污染
		case "trakt":
		case "tmdb":
		case "metacritic":
			return Number((n / 10).toFixed(1));     // 0-100 → 0-10
		case "tomatoes":
		case "tomatoesAudience":
			return Math.round(n);                   // 0-100 百分比
		case "rogerebert":
			return Number(n.toFixed(1));            // 0-4
		default:
			return undefined;
	}
}

async function main(): Promise<void> {
	let cache: Cache = {};
	try {
		const raw = (await getRawJson(CACHE_KEY)) as Cache;
		if (raw && typeof raw === "object" && !Array.isArray(raw)) cache = raw;
	} catch { cache = {}; }
	console.log(`评分缓存条目: ${Object.keys(cache).length}`);

	const keys = (await listR2Keys("")).filter((k) => !SKIP.has(k) && !k.startsWith("_$"));
	console.log(`待处理文件: ${keys.length}`);

	let filesChanged = 0;
	let itemsUpdated = 0;
	let hit = 0, miss = 0;

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
			const cached = cache[`${mt}:${tmdbId}`];
			if (!cached) { miss++; continue; }
			hit++;

			const out: Record<string, number> = {};
			if (cached.tmdb) { const v = bake("tmdb", cached.tmdb); if (v) out.tmdb = v; }
			if (cached.imdb) { const v = bake("imdb", cached.imdb); if (v) out.imdb = v; }
			if (cached.trakt) { const v = bake("trakt", cached.trakt); if (v) out.trakt = v; }
			if (cached.letterboxd) { const v = bake("letterboxd", cached.letterboxd); if (v) out.letterboxd = v; }
			if (cached.tomatoes) { const v = bake("tomatoes", cached.tomatoes); if (v) out.rotten_tomatoes = v; }
			if (cached.tomatoesAudience) { const v = bake("tomatoesAudience", cached.tomatoesAudience); if (v) out.tomatoesAudience = v; }
			if (cached.metacritic) { const v = bake("metacritic", cached.metacritic); if (v) out.metacritic = v; }
			if (cached.mal) { const v = bake("mal", cached.mal); if (v) out.mal = v; }
			if (cached.rogerebert) { const v = bake("rogerebert", cached.rogerebert); if (v) out.rogerebert = v; }

			if (Object.keys(out).length === 0) continue;
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

	console.log(`\n═══════════════════════`);
	console.log(`更新文件: ${filesChanged}`);
	console.log(`更新条目: ${itemsUpdated}`);
	console.log(`命中缓存: ${hit} | 未命中: ${miss}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

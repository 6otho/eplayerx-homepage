/**
 * 🎯 评分缓存迁移脚本（一次性）
 *
 * 把各分类 JSON 文件里已有的 ratings 提取出来，统一写入 mdblist-ratings-cache.json
 * 与上游架构对齐：评分只有一个真实来源，数据文件里的 ratings 之后不再被读取。
 *
 * 刻度：统一存 0-100（MDBList 原样），显示时由 Worker 除以 10。
 * 数据文件里现有的是 0-10（已转换过），迁移时 ×10 还原。
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

function toHundred(v: unknown): number | undefined {
	const n = Number(v);
	if (!Number.isFinite(n) || n <= 0) return undefined;
	// 数据文件里是 0-10；还原成 0-100
	return n <= 10 ? Math.round(n * 10) : Math.round(n);
}

async function main(): Promise<void> {
	// 读现有缓存
	let cache: Record<string, Record<string, number>> = {};
	try {
		const raw = (await getRawJson(CACHE_KEY)) as Record<string, Record<string, number>>;
		if (raw && typeof raw === "object" && !Array.isArray(raw)) cache = raw;
	} catch {
		cache = {};
	}
	console.log(`现有缓存条目: ${Object.keys(cache).length}`);

	const keys = (await listR2Keys("")).filter((k) => !SKIP.has(k) && !k.startsWith("_$"));
	console.log(`扫描数据文件: ${keys.length}`);

	let scanned = 0;
	let written = 0;
	let skippedNoRatings = 0;

	for (const key of keys) {
		let json: { data?: Item[] };
		try {
			json = (await getRawJson(key)) as { data?: Item[] };
		} catch {
			continue;
		}
		const items = json?.data;
		if (!Array.isArray(items)) continue;

		for (const it of items) {
			const tmdbId = it.tmdbId || it.id;
			if (!tmdbId) continue;
			const r = it.ratings;
			if (!r || typeof r !== "object" || Object.keys(r).length === 0) continue;
			scanned++;

			const mt = String(it.media_type || key).toLowerCase().includes("movie") ? "movie" : "tv";
			const ck = `${mt}:${tmdbId}`;

			const next: Record<string, number> = { ...(cache[ck] || {}) };
			const map: Record<string, string> = {
				tmdb: "tmdb", imdb: "imdb", trakt: "trakt",
				letterboxd: "letterboxd", tomatoes: "tomatoes", rotten_tomatoes: "tomatoes",
				metacritic: "metacritic",
			};
			for (const [src, dst] of Object.entries(map)) {
				const v = toHundred(r[src]);
				if (v !== undefined && !next[dst]) next[dst] = v;
			}
			if (Object.keys(next).length > Object.keys(cache[ck] || {}).length) {
				cache[ck] = next;
				written++;
			}
		}
	}

	await putRawJson(CACHE_KEY, cache);
	console.log(`\n═══════════════════════`);
	console.log(`带 ratings 的条目: ${scanned}`);
	console.log(`写入缓存: ${written} 条`);
	console.log(`缓存总条目: ${Object.keys(cache).length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

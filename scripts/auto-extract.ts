/**
 * 🎯 自动提取（模拟手动点「提取评分/图标」按钮）
 *
 * 原因：实测证明，只有走截取接口客户端才会更新显示。
 *       刷新、改时间戳、改评分都不行。
 *
 * 做法：对每个分类的前 N 条，调用 movie-api 的 batch_force_logo。
 *      和你在面板上勾选后点按钮，走的是完全同一个接口。
 *
 * 环境变量：
 *   MOVIE_API_BASE   movie-api 地址
 *   ADMIN_SECRET     面板密码
 *   TOP_N            每分类提取条数（默认 20）
 *   CATEGORY_FILTER  只处理指定分类（可选）
 */

import { listR2Keys, getRawJson } from "../src/blocks/storage.js";

const CACHE_KEY = "mdblist-ratings-cache.json";
const SKIP = new Set([
	"blacklist.json", "cron_state.json", "layout-config.json", "schedule-override.json",
	"eplayerx-boxes.json", "eplayerx-folders.json", CACHE_KEY,
]);

interface Item {
	tmdbId?: number;
	id?: number;
	media_type?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 文件名 → movie-api 分类 id（横线转下划线） */
function toCategoryId(fileKey: string): string {
	return fileKey.replace(/\.json$/, "").replace(/-/g, "_");
}

async function main(): Promise<void> {
	const base = (process.env.MOVIE_API_BASE || "https://movie-api.l3okuu.workers.dev").replace(/\/$/, "");
	const pwd = process.env.ADMIN_SECRET || "080808";
	const envTop = Number(process.env.TOP_N || 20);
	// TOP_N=0 表示全部条目
	const topN = envTop === 0 ? Number.POSITIVE_INFINITY : envTop;
	const filter = String(process.env.CATEGORY_FILTER || "").trim();

	const norm = (s: string) => s.toLowerCase().replace(/[-_]/g, "");
	// 🎯 只处理 movie-api 真实拥有的分类（CATEGORY_CONFIGS 里的 39 个）。
	//    R2 里还有 reviews/ 缓存、上游遗留的 theater-*/douban-baiye 等，
	//    对它们调用提取接口会污染数据（之前一次跑了 143 个"分类"就是这么来的）。
	const MOVIE_API_CATEGORIES = new Set([
		"weekly_anime_collection", "weekly_drama_collection", "weekly_guoman_collection",
		"weekly_korean_drama_collection", "weekly_japanese_drama_collection", "weekly_sea_drama_collection",
		"tmdb_popular_movies", "tmdb_popular_tv", "bangumi_airing", "douban_tv_custom",
		"tmdb_tv_netflix", "variety_cn", "variety_kr", "variety_global", "tmdb_tv_hbo",
		"tmdb_tv_apple", "trakt_movies", "tmdb_anime_cn", "trakt_shows", "douban_movies",
		"douban_korean_tv", "tmdb_tv_ja", "tmdb_anime_jp", "imdb_top_anime", "prime_hot_anime",
		"filmarks_anime_movie", "netflix_hot_anime", "tmdb_anime_top_ja", "tmdb_anime_movie_ja",
		"tmdb_tv_es", "tmdb_tv_tw", "tmdb_movie_tw", "tmdb_movie_sea", "tmdb_movie_hk_erotic_comedy",
		"tmdb_tv_th", "tmdb_movie_th", "tmdb_tv_bl", "netflix_tv_minor", "netflix_movie_minor",
	]);

	const files = (await listR2Keys(""))
		.filter((k) => !SKIP.has(k) && !k.startsWith("_$") && !k.startsWith("reviews/"))
		.filter((k) => {
			const id = toCategoryId(k);
			if (MOVIE_API_CATEGORIES.has(id)) return true;
			// 周更表按天分文件：weekly_drama_collection_3.json
			const m = id.match(/^(.+)_(\d+)$/);
			return !!(m && MOVIE_API_CATEGORIES.has(m[1]));
		})
		.filter((k) => (filter ? norm(k).includes(norm(filter)) : true));

	console.log(`提取目标: ${files.length} 个分类，每个 ${topN === Number.POSITIVE_INFINITY ? "全部" : "前 " + topN} 条`);

	let okCats = 0, failCats = 0, totalItems = 0;

	for (const key of files) {
		let json: { data?: Item[] };
		try { json = (await getRawJson(key)) as { data?: Item[] }; } catch { continue; }
		const items = json?.data;
		if (!Array.isArray(items) || !items.length) continue;

		const head = items.slice(0, topN);
		const isMovie = key.includes("movie") || items.some((x) => String(x.media_type || "").includes("movie"));
		const type = isMovie ? "movie" : "tv";
		const categoryId = toCategoryId(key);
		const allIds = head.map((it) => String(it.tmdbId || it.id)).filter(Boolean);
		if (!allIds.length) continue;

		// 分批：每次 20 条，避免单次请求过大/超时
		const BATCH = 10;  // 实测：提取接口单次约能处理 10 条（子请求上限）
		let succTotal = 0;
		for (let i = 0; i < allIds.length; i += BATCH) {
			const chunk = allIds.slice(i, i + BATCH);
			try {
				const res = await fetch(`${base}/action/batch_force_logo`, {
					method: "POST",
					headers: { Authorization: `Bearer ${pwd}`, "Content-Type": "application/json", "x-from-action": "1" },
					body: JSON.stringify({ items: chunk.map((id) => ({ id, type })), category: categoryId, weekday: 1 }),
				});
				const d = await res.json().catch(() => null);
				if (res.ok && d && d.success) {
					succTotal += (d.results || []).filter((r: { success?: boolean }) => r.success).length;
				}
			} catch { /* 单批失败继续 */ }
			await sleep(250);
		}
		totalItems += allIds.length;
		console.log(`  ✅ ${key}: ${succTotal}/${allIds.length}`);
		okCats++;
	}

	console.log(`\n═══════════════════════`);
	console.log(`成功分类: ${okCats} | 失败: ${failCats} | 覆盖条目: ${totalItems}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

/**
 * TMDB discover 型分类：从 movie-api 迁移到 GitHub Actions
 *
 * 设计（与上游一致）：
 *   1. discover 列表只用于拿 id（排序/筛选）
 *   2. poster_path 等图片信息一律来自 TMDB「详情」接口
 *   3. 与旧数据合并：同 tmdbId 用新数据覆盖；同名（剥离分季后缀）视为同一部剧
 */

import { tmdb } from "../tmdb/client.js";
import { buildContentItem, deduplicateByTmdbId } from "./crawlers.js";
import { saveRawFile } from "./service.js";
import type { TmdbSearchResult } from "./tmdb-enrich.js";

export interface DiscoverCategory {
	id: string;
	fileName: string;
	label: string;
	mediaType: "movie" | "tv";
	/** discover 查询参数 */
	query: Record<string, string>;
	/** 从哪一页开始（默认 1），用于错开 */
	startPage?: number;
}

/** 一次性把 movie-api 的 tmdb_* 分类全部覆盖 */
export const DISCOVER_CATEGORIES: DiscoverCategory[] = [
	{
		id: "tmdb_popular_tv",
		fileName: "tmdb-popular-tv.json",
		label: "今日热门电视剧",
		mediaType: "tv",
		query: { without_genres: "16" },
	},
	{
		id: "tmdb_popular_movies",
		fileName: "tmdb-popular-movies.json",
		label: "今日热门电影",
		mediaType: "movie",
		query: {},
	},
	{
		id: "tmdb_anime_jp",
		fileName: "tmdb-anime-jp.json",
		label: "近期热门日本动漫",
		mediaType: "tv",
		query: { with_original_language: "ja", with_genres: "16", with_origin_country: "JP" },
	},
	{
		id: "tmdb_anime_cn",
		fileName: "tmdb-anime-cn.json",
		label: "热门国产动漫",
		mediaType: "tv",
		query: { with_original_language: "zh", with_origin_country: "CN", with_genres: "16" },
	},
	{
		id: "tmdb_anime_top_ja",
		fileName: "tmdb-anime-top-ja.json",
		label: "TMDB 高分神作日漫",
		mediaType: "tv",
		query: { with_original_language: "ja", with_genres: "16", with_origin_country: "JP", sort_by: "vote_average.desc", "vote_count.gte": "500" },
	},
	{
		id: "tmdb_anime_movie_ja",
		fileName: "tmdb-anime-movie-ja.json",
		label: "美到想截屏的动画电影",
		mediaType: "movie",
		query: { with_original_language: "ja", with_genres: "16", with_origin_country: "JP" },
	},
	{
		id: "tmdb_tv_netflix",
		fileName: "tmdb-tv-netflix.json",
		label: "Netflix 全球热播好剧",
		mediaType: "tv",
		query: { with_networks: "213", with_origin_country: "US|GB|CA|AU" },
	},
	{
		id: "tmdb_tv_hbo",
		fileName: "tmdb-tv-hbo.json",
		label: "HBO 高分神剧",
		mediaType: "tv",
		query: { with_networks: "49", with_origin_country: "US|GB|CA|AU" },
	},
	{
		id: "tmdb_tv_apple",
		fileName: "tmdb-tv-apple.json",
		label: "Apple TV+ 原创精品",
		mediaType: "tv",
		query: { with_networks: "2552", with_origin_country: "US|GB|CA|AU" },
	},
	{
		id: "tmdb_tv_ja",
		fileName: "tmdb-tv-ja.json",
		label: "专治精神内耗的日剧",
		mediaType: "tv",
		query: { with_original_language: "ja", without_genres: "16", with_origin_country: "JP" },
	},
	{
		id: "tmdb_tv_tw",
		fileName: "tmdb-tv-tw.json",
		label: "台味正浓的宝藏台剧",
		mediaType: "tv",
		query: { with_original_language: "zh", with_origin_country: "TW" },
	},
	{
		id: "tmdb_movie_tw",
		fileName: "tmdb-movie-tw.json",
		label: "台味正浓的宝藏台片",
		mediaType: "movie",
		query: { with_original_language: "zh", with_origin_country: "TW" },
	},
	{
		id: "tmdb_tv_th",
		fileName: "tmdb-tv-th.json",
		label: "别被语言劝退的泰剧",
		mediaType: "tv",
		query: { with_original_language: "th", with_origin_country: "TH" },
	},
	{
		id: "tmdb_movie_th",
		fileName: "tmdb-movie-th.json",
		label: "别只看鬼片的泰国电影",
		mediaType: "movie",
		query: { with_original_language: "th", with_origin_country: "TH" },
	},
	{
		id: "tmdb_tv_es",
		fileName: "tmdb-tv-es.json",
		label: "反转停不下来的西语爽剧",
		mediaType: "tv",
		query: { with_original_language: "es", with_origin_country: "ES|MX|AR|CO|CL" },
	},
	{
		id: "tmdb_tv_bl",
		fileName: "tmdb-tv-bl.json",
		label: "腐女必看的 BL 剧",
		mediaType: "tv",
		query: { with_keywords: "378193|207574", with_origin_country: "TH|JP|KR|TW|CN" },
	},
	{
		id: "netflix_tv_minor",
		fileName: "netflix-tv-minor.json",
		label: "冷门却惊艳的宝藏外国剧",
		mediaType: "tv",
		query: { with_networks: "213", sort_by: "vote_average.desc", "vote_count.gte": "200" },
	},
	{
		id: "netflix_movie_minor",
		fileName: "netflix-movie-minor.json",
		label: "冷门却惊艳的宝藏外国片",
		mediaType: "movie",
		query: { with_networks: "213", sort_by: "vote_average.desc", "vote_count.gte": "200" },
	},
];

/** 抓一个分类：discover 列表 → 逐条取详情 → 合并保存 */
export async function crawlDiscoverCategory(cat: DiscoverCategory, limit = 100): Promise<number> {
	console.log(`\n🎬 [${cat.label}] ${cat.id}`);
	const pages = Math.ceil(limit / 20);
	const raw: TmdbSearchResult[] = [];
	const seen = new Set<number>();

	for (let page = 1; page <= pages; page++) {
		let results: TmdbSearchResult[] = [];
		try {
			const res = await tmdb.GET(`/3/discover/${cat.mediaType}`, {
				params: {
					query: {
						language: "zh-CN",
						sort_by: "popularity.desc",
						page: String(page),
						...cat.query,
					} as never,
				},
			});
			results = (res.data as { results?: TmdbSearchResult[] })?.results ?? [];
		} catch (e) {
			console.error(`  ⚠️ 第 ${page} 页失败:`, (e as Error).message);
			break;
		}
		if (!results.length) break;
		for (const r of results) {
			const id = Number((r as { id?: number }).id);
			if (!id || seen.has(id)) continue;
			seen.add(id);
			raw.push(r);
			if (raw.length >= limit) break;
		}
		if (raw.length >= limit) break;
		await new Promise((r) => setTimeout(r, 250));
	}
	console.log(`  📥 列表 ${raw.length} 条`);

	const results: (Awaited<ReturnType<typeof buildContentItem>>)[] = [];
	for (const item of raw) {
		const title = (item as { name?: string }).name || (item as { title?: string }).title || "";
		if (!title) continue;
		try {
			const content = await buildContentItem(title, item, cat.mediaType);
			if (content) results.push(content);
		} catch (e) {
			// 单条失败不中断
		}
		await new Promise((r) => setTimeout(r, 180));
	}

	const ok = results.filter(Boolean) as NonNullable<(typeof results)[number]>[];
	if (!ok.length) {
		console.log(`  ⚠️ ${cat.label}: 无有效条目，跳过保存`);
		return 0;
	}
	const deduped = deduplicateByTmdbId(ok);
	// 🎯 与 movie-api 的 CATEGORY_CONFIGS 一致：movie → movie，tv → tv_series
	//    （之前统一写成 animation 会让客户端按动画分类处理，导致评分渲染异常）
	const typeLabel = cat.mediaType === "movie" ? "movie" : "tv_series";
	await saveRawFile(cat.fileName, deduped, "tmdb", typeLabel);
	console.log(`  💾 ${cat.label}: 保存 ${deduped.length} 条`);
	return deduped.length;
}

/** 跑全部 discover 分类（或按 CRAWL_ONLY 过滤） */
export async function crawlAllDiscoverCategories(only?: string[]): Promise<void> {
	const list = only?.length
		? DISCOVER_CATEGORIES.filter((c) => only.includes(c.id))
		: DISCOVER_CATEGORIES;
	for (const cat of list) {
		try {
			// 🎯 支持只抓前 N 条（默认 100），用 CRAWL_LIMIT 控制
			const lim = Number(process.env.CRAWL_LIMIT || 100);
			await crawlDiscoverCategory(cat, lim);
		} catch (e) {
			console.error(`❌ ${cat.id} 失败:`, (e as Error).message);
		}
	}
}

/**
 * Main crawler: Douban -> TMDB -> JSON file
 */

import { cachedRatings, getRatingsCache } from "../ratings/cache.js";
import { tmdb } from "../tmdb/client.js";
import { fetchBangumiHotAnime } from "./bangumi-scraper.js";
import {
	fetchDoubanHotAnimation,
	fetchDoubanHotMovies,
	fetchDoubanHotTVSeries,
	fetchDoubanHotVarietyShows,
	fetchDoubanJapaneseTVSeries,
	fetchDoubanKoreanTVSeries,
} from "./douban-scraper.js";
import { fetchHamiTaiwaneseTVSeries } from "./hami-scraper.js";
import {
	type ContentItem,
	type ContentItemTranslation,
	saveBangumiAnimation,
	saveDoubanAnimation,
	saveHamiTaiwaneseTVSeries,
	saveHotVarietyShows,
	saveJapaneseTVSeries,
	saveKoreanTVSeries,
	saveMovies,
	saveRawFile,
	saveTVSeries,
} from "./service.js";
import {
	fetchDetailsWithEnrichment,
	searchTMDB,
	TMDB_TV_GENRE_ANIMATION,
	TMDB_TV_GENRE_REALITY,
	TMDB_TV_GENRE_TALK,
	type TmdbSearchResult,
} from "./tmdb-enrich.js";

const EXTRA_ENRICH_LANGUAGES = ["en-US", "ar-SA"] as const;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface CrawlTVSeriesOptions {
	label: string;
	fetchItems: () => Promise<Array<{ title: string }>>;
	saveItems: (items: ContentItem[]) => Promise<unknown>;
}

/** Align stored title + TMDB query when source uses alternate naming (e.g. 年番 suffix). */
function resolveAnimationTitle(title: string): string {
	if (title === "凡人修仙传年番") {
		return "凡人修仙传";
	}
	return title;
}

// 🔑 统一图片格式：TMDB 返回相对路径 /xxx.jpg，客户端会二次拼接导致裂图，
//    这里统一转成完整 URL，与 movie-api 提取接口保持一致
const TMDB_IMG_BASE = "https://image.tmdb.org/t/p/original";
const absImg = (p: string | null | undefined): string | null => {
	if (!p) return null;
	if (p.startsWith("http")) return p;
	return TMDB_IMG_BASE + (p.startsWith("/") ? p : "/" + p);
};

/**
 * Deduplicate content items by tmdbId, keeping the latest one
 */
function deduplicateByTmdbId(items: ContentItem[]): ContentItem[] {
	const byTmdb = new Map<number, ContentItem>();
	for (const item of items) {
		const existing = byTmdb.get(item.tmdbId);
		if (!existing || item.crawledAt > existing.crawledAt) {
			byTmdb.set(item.tmdbId, item);
		}
	}

	// 第二遍：同一部剧可能被 TMDB 拆成多个条目（不同 origin_country、不同季）。
	// 这里按「剥离分季后缀的标题」合并，只保留质量最好的一条。
	// 规范化标题：去掉空格/标点，并剥离「第二季」「Season 2」「S2」「第二期」「篇」等分季后缀，
	// 这样同一部剧的不同季会被识别成同一条，不会重复入库。
	// 覆盖 TMDB 上常见的重复条目命名：分季版 / 分季 / 第X季 / Season X / S2 / 合辑 / 合集 …
	const SEASON_SUFFIX = /(第[一二三四五六七八九十0-9]{1,3}[季期篇章部]|season\s*\d{1,2}|part\s*\d{1,2}|\bs\d{1,2}\b|ⅱ|ⅲ|ⅳ|[（(【\[]?\s*分季(版)?\s*[）)】\]]?|[-_—\s]*分季(版)?|合辑|合集|全集|完整版)/gi;
	const norm = (v: string) =>
		(v || "").toLowerCase().replace(SEASON_SUFFIX, "").replace(/[\s\-_:,.　·、，。]/g, "");
	const byTitle = new Map<string, ContentItem>();
	const score = (x: ContentItem) =>
		(x.poster_path ? 4 : 0) + (x.imdbId ? 2 : 0) + (x.vote_average ?? 0) / 10;

	const out: ContentItem[] = [];
	for (const item of byTmdb.values()) {
		const titleNorm = norm(item.title || item.name || "");
		// ⚠️ 标题为空时不能用 title 判重，否则所有空标题条目会被合并成一条
		if (!titleNorm) {
			out.push(item);
			continue;
		}
		// 🔑 剥离分季后，若标题相同就视为同一部剧（不同季的首播年不同，不能把年份放进 key）
		const key = titleNorm;
		const existing = byTitle.get(key);
		if (!existing || score(item) > score(existing)) {
			byTitle.set(key, item);
		}
	}

	// 合并：有标题的按规范化标题去重；无标题的单独保留（已按 tmdbId 去重）
	const kept = new Set(Array.from(byTitle.values()).map((x) => x.tmdbId));
	return [
		...Array.from(byTitle.values()),
		...out.filter((x) => !kept.has(x.tmdbId)),
	];
}

function translationFromEnrichment(
	enriched: NonNullable<Awaited<ReturnType<typeof fetchDetailsWithEnrichment>>>,
): ContentItemTranslation {
	const data = enriched.tmdbData;
	const title = data.title || data.name || "";
	return {
		title,
		overview: data.overview ?? null,
		tagline: data.tagline?.trim() || null,
		thumb: absImg(enriched.imageMeta.thumb),
		logo: absImg(enriched.imageMeta.logo),
		noLogoPoster: absImg(enriched.imageMeta.noLogoPoster),
		poster_path: absImg(data.poster_path),
		...(data.trailer ? { trailer: data.trailer } : {}),
		backdrop_path: absImg(data.backdrop_path),
	};
}

async function buildContentItem(
	title: string,
	tmdbData: TmdbSearchResult,
	mediaType: "movie" | "tv",
): Promise<ContentItem | null> {
	const tmdbId = tmdbData.id;
	if (!tmdbId) return null;

	let enriched = await fetchDetailsWithEnrichment(
		tmdbId,
		mediaType,
		"zh-CN",
		tmdb,
		tmdbData.original_language,
	);
	// 🎯 详情拿不到时重试一次：宁可多一次请求，也不要用搜索结果里的海报兜底
	if (!enriched) {
		await delay(300);
		enriched = await fetchDetailsWithEnrichment(
			tmdbId,
			mediaType,
			"zh-CN",
			tmdb,
			tmdbData.original_language,
		);
	}
	// 🎯 海报必须来自 TMDB 详情接口（enriched.tmdbData），不能退回搜索结果：
	//    搜索结果里的 poster_path 不一定是官方主海报（可能是别的语言/备选图）
	const data = enriched?.tmdbData ?? tmdbData;
	const posterFromDetail = enriched?.tmdbData?.poster_path ?? null;
	const externalIds = enriched?.externalIds ?? { imdbId: null, tvdbId: null };
	const imageMeta = enriched?.imageMeta ?? {
		thumb: absImg(data.backdrop_path || data.poster_path),
		logo: null,
		noLogoPoster: absImg(data.poster_path),
	};

	const translations: NonNullable<ContentItem["translations"]> = {};
	for (const language of EXTRA_ENRICH_LANGUAGES) {
		const localeKey = language.startsWith("ar") ? "ar" : "en";
		try {
			const localized = await fetchDetailsWithEnrichment(
				tmdbId,
				mediaType,
				language,
				tmdb,
				tmdbData.original_language,
			);
			if (!localized) continue;
			const translation = translationFromEnrichment(localized);
			if (!translation.title) continue;
			translations[localeKey] = translation;
		} catch (error) {
			console.error(
				`Failed to enrich ${mediaType}/${tmdbId} for ${language}:`,
				error,
			);
		}
		await delay(150);
	}

	const ratings = cachedRatings(await getRatingsCache(), mediaType, tmdbId);

	return {
		title,
		tmdbId,
		imdbId: externalIds.imdbId,
		tvdbId: externalIds.tvdbId,
		vote_average: data.vote_average ?? null,
		...(data.trailer ? { trailer: data.trailer } : {}),
		...(ratings ? { ratings } : {}),
		poster_path: absImg(posterFromDetail) as string,
		backdrop_path: absImg(data.backdrop_path),
		genre_ids: data.genre_ids || [],
		media_type: mediaType,
		release_date: data.release_date || null,
		first_air_date: data.first_air_date,
		overview: data.overview,
		tagline: data.tagline?.trim() || null,
		thumb: absImg(imageMeta.thumb),
		logo: absImg(imageMeta.logo),
		noLogoPoster: absImg(imageMeta.noLogoPoster),
		...(Object.keys(translations).length > 0 ? { translations } : {}),
		crawledAt: new Date().toISOString(),
	};
}

async function crawlDoubanTVSeriesCollection(options: CrawlTVSeriesOptions) {
	console.log(`📺 Crawling ${options.label}...`);

	const items = await options.fetchItems();
	console.log(`📥 Found ${items.length} ${options.label}`);

	const results: ContentItem[] = [];

	for (const item of items) {
		console.log(`🔍 Searching: ${item.title}`);

		const tmdbData = await searchTMDB(item.title, "tv");

		if (tmdbData) {
			const content = await buildContentItem(item.title, tmdbData, "tv");
			if (content) {
				results.push(content);
				console.log(`✅ ${content.tmdbId}`);
			}
		} else {
			console.log(`❌ Not found`);
		}

		await delay(300);
	}

	if (results.length > 0) {
		const deduplicated = deduplicateByTmdbId(results);
		await options.saveItems(deduplicated);
		console.log(
			`💾 Saved ${deduplicated.length} ${options.label} to JSON (${
				results.length - deduplicated.length
			} duplicates removed)\n`,
		);
	}

	return results;
}

/**
 * Crawl Douban movies
 */
export async function crawlDoubanMovies() {
	console.log("🎬 Crawling Douban movies...");

	const items = await fetchDoubanHotMovies();
	console.log(`📥 Found ${items.length} movies`);

	const results: ContentItem[] = [];

	for (const item of items) {
		console.log(`🔍 Searching: ${item.title}`);

		const tmdbData = await searchTMDB(item.title, "movie");

		if (tmdbData) {
			const content = await buildContentItem(item.title, tmdbData, "movie");
			if (content) {
				results.push(content);
				console.log(`✅ ${content.tmdbId}`);
			}
		} else {
			console.log(`❌ Not found`);
		}

		await delay(300);
	}

	if (results.length > 0) {
		const deduplicated = deduplicateByTmdbId(results);
		await saveMovies(deduplicated);
		console.log(
			`💾 Saved ${deduplicated.length} movies to JSON (${
				results.length - deduplicated.length
			} duplicates removed)\n`,
		);
	}

	return results;
}

/**
 * Crawl Douban TV series
 */
export async function crawlDoubanTVSeries() {
	return crawlDoubanTVSeriesCollection({
		label: "Douban domestic TV series",
		fetchItems: fetchDoubanHotTVSeries,
		saveItems: saveTVSeries,
	});
}

export async function crawlDoubanKoreanTVSeries() {
	return crawlDoubanTVSeriesCollection({
		label: "Douban Korean TV series",
		fetchItems: fetchDoubanKoreanTVSeries,
		saveItems: saveKoreanTVSeries,
	});
}

export async function crawlDoubanJapaneseTVSeries() {
	return crawlDoubanTVSeriesCollection({
		label: "Douban Japanese TV series",
		fetchItems: fetchDoubanJapaneseTVSeries,
		saveItems: saveJapaneseTVSeries,
	});
}

export async function crawlHamiTaiwaneseTVSeries() {
	return crawlDoubanTVSeriesCollection({
		label: "Hami Taiwanese TV series",
		fetchItems: fetchHamiTaiwaneseTVSeries,
		saveItems: saveHamiTaiwaneseTVSeries,
	});
}

/**
 * Crawl Douban animation
 */
export async function crawlDoubanAnimation() {
	console.log("🎨 Crawling Douban animation...");

	const items = await fetchDoubanHotAnimation();
	console.log(`📥 Found ${items.length} animation`);

	const results: ContentItem[] = [];

	for (const item of items) {
		const title = resolveAnimationTitle(item.title);
		console.log(`🔍 Searching: ${title}`);

		// 国产动漫：只要"动画"类型，不限制国家（这里放 JP 过滤是错的，会导致匹配异常）
		const tmdbData = await searchTMDB(title, "tv", {
			requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
		});

		if (tmdbData) {
			const content = await buildContentItem(title, tmdbData, "tv");
			if (content) {
				results.push(content);
				console.log(`✅ ${content.tmdbId}`);
			}
		} else {
			console.log(`❌ Not found (Animation genre)`);
		}

		await delay(300);
	}

	if (results.length > 0) {
		const deduplicated = deduplicateByTmdbId(results);
		await saveDoubanAnimation(deduplicated);
		console.log(
			`💾 Saved ${deduplicated.length} animation to JSON (${
				results.length - deduplicated.length
			} duplicates removed)\n`,
		);
	}

	return results;
}

/**
 * Crawl Douban hot variety shows
 */
export async function crawlDoubanHotVarietyShows() {
	console.log("🔥 Crawling Douban hot variety shows...");

	const items = await fetchDoubanHotVarietyShows();
	console.log(`📥 Found ${items.length} hot variety shows`);

	const results: ContentItem[] = [];

	for (const item of items) {
		console.log(`🔍 Searching: ${item.title}`);

		// 🎯 只接受真人秀/脱口秀类型，避免错配成普通剧集
		const tmdbData = await searchTMDB(item.title, "tv", {
			requireAnyTvGenreIds: [TMDB_TV_GENRE_REALITY, TMDB_TV_GENRE_TALK],
		});

		if (tmdbData) {
			const content = await buildContentItem(item.title, tmdbData, "tv");
			if (content) {
				results.push(content);
				console.log(`✅ ${content.tmdbId}`);
			}
		} else {
			console.log(`❌ Not found`);
		}

		await delay(300);
	}

	if (results.length > 0) {
		const deduplicated = deduplicateByTmdbId(results);
		await saveHotVarietyShows(deduplicated);
		console.log(
			`💾 Saved ${deduplicated.length} hot variety shows to JSON (${
				results.length - deduplicated.length
			} duplicates removed)\n`,
		);
	}

	return results;
}

/**
 * Crawl Bangumi animation
 */
export async function crawlBangumiAnimation() {
	console.log("🎌 Crawling Bangumi animation...");

	const items = await fetchBangumiHotAnime();
	console.log(`📥 Found ${items.length} animation`);

	const results: ContentItem[] = [];

	for (const item of items) {
		const title = resolveAnimationTitle(item.title);
		console.log(`🔍 Searching: ${title}`);

		// 🎯 Bangumi 是日番榜：限日本，避免混入国产/欧美动画
		const tmdbData = await searchTMDB(title, "tv", {
			requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
			requireOriginCountries: ["JP"],
		});

		if (tmdbData) {
			const content = await buildContentItem(title, tmdbData, "tv");
			if (content) {
				results.push(content);
				console.log(`✅ ${content.tmdbId}`);
			}
		} else {
			console.log(`❌ Not found (Animation genre)`);
		}

		await delay(300);
	}

	if (results.length > 0) {
		const deduplicated = deduplicateByTmdbId(results);
		await saveBangumiAnimation(deduplicated);
		console.log(
			`💾 Saved ${deduplicated.length} animation to JSON (${
				results.length - deduplicated.length
			} duplicates removed)\n`,
		);
	}

	return results;
}

/**
 * Run all crawlers
 */
/**
 * TMDB discover 型分类（tmdb_anime_cn / tmdb_tv_ja）
 * 原由 movie-api 抓取，现统一到 GitHub Actions，避免两处代码互相覆盖。
 * poster_path 一律取自 TMDB 详情接口（buildContentItem 内部已保证）。
 */
const DISCOVER_CATEGORIES = [
	{
		id: "tmdb_anime_cn",
		fileName: "tmdb-anime-cn.json",
		label: "热门国产动漫",
		mediaType: "tv" as const,
		query: { with_original_language: "zh", with_origin_country: "CN", with_genres: "16" },
	},
	{
		id: "tmdb_tv_ja",
		fileName: "tmdb-tv-ja.json",
		label: "专治精神内耗的日剧",
		mediaType: "tv" as const,
		query: { with_original_language: "ja", without_genres: "16", with_origin_country: "JP" },
	},
];

async function crawlDiscoverCategory(cat: (typeof DISCOVER_CATEGORIES)[number]) {
	console.log(`\n🎬 [${cat.label}] 开始抓取`);
	const limit = Number(process.env.DISCOVER_LIMIT || 100);
	const pages = Math.ceil(limit / 20);
	const raw: TmdbSearchResult[] = [];
	const seen = new Set<number>();

	for (let page = 1; page <= pages; page++) {
		const result = await tmdb.GET(`/3/discover/${cat.mediaType}`, {
			params: {
				query: {
					language: "zh-CN",
					sort_by: "popularity.desc",
					page: String(page),
					...cat.query,
				} as never,
			},
		});
		const list = (result.data as { results?: TmdbSearchResult[] } | undefined)?.results ?? [];
		if (!list.length) break;
		for (const r of list) {
			const id = Number((r as { id?: number }).id);
			if (!id || seen.has(id)) continue;
			seen.add(id);
			raw.push(r);
		}
		await delay(250);
	}
	console.log(`📥 列表返回 ${raw.length} 条`);

	const results: ContentItem[] = [];
	for (const item of raw) {
		const title = (item as { name?: string }).name || (item as { title?: string }).title || "";
		if (!title) continue;
		try {
			const content = await buildContentItem(title, item, cat.mediaType);
			if (content) {
				results.push(content);
				console.log(`  ✅ ${content.tmdbId} ${title}`);
			}
		} catch (e) {
			console.error(`  ❌ ${title}:`, (e as Error).message);
		}
		await delay(200);
	}

	if (results.length) {
		const deduped = deduplicateByTmdbId(results);
		// saveRawFile 内部已做增量合并（保留历史条目）
		await saveRawFile(cat.fileName, deduped, "tmdb", "animation");
		console.log(`💾 ${cat.label}: 保存 ${deduped.length} 条`);
	}
}

export async function crawlTmdbAnimeCn() {
	await crawlDiscoverCategory(DISCOVER_CATEGORIES[0]);
}

export async function crawlTmdbTvJa() {
	await crawlDiscoverCategory(DISCOVER_CATEGORIES[1]);
}

const ALL_CRAWLERS: Record<string, () => Promise<unknown>> = {
	douban_movies: crawlDoubanMovies,
	douban_tv: crawlDoubanTVSeries,
	douban_korean_tv: crawlDoubanKoreanTVSeries,
	douban_japanese_tv: crawlDoubanJapaneseTVSeries,
	hami_taiwanese_tv: crawlHamiTaiwaneseTVSeries,
	douban_animation: crawlDoubanAnimation,
	douban_variety: crawlDoubanHotVarietyShows,
	bangumi_animation: crawlBangumiAnimation,
	tmdb_anime_cn: crawlTmdbAnimeCn,
	tmdb_tv_ja: crawlTmdbTvJa,
};

async function runAllCrawlers() {
	// CRAWL_ONLY=xxx,yyy 时只跑指定爬虫（用于单分类验证）
	const only = (process.env.CRAWL_ONLY || "").split(",").map((x) => x.trim()).filter(Boolean);
	const names = only.length ? only : Object.keys(ALL_CRAWLERS);
	console.log(`🚀 Starting crawlers: ${names.join(", ")}\n`);

	for (const name of names) {
		const fn = ALL_CRAWLERS[name];
		if (!fn) {
			console.warn(`⚠️ 未知爬虫: ${name}`);
			continue;
		}
		await fn();
	}

	console.log("✅ Done!");
}

// Run if executed directly
if (process.argv[1]?.includes("crawlers")) {
	runAllCrawlers().catch(console.error);
}

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

	// Second pass: TMDB sometimes has duplicate entries for the same show
	// (same title/year, different origin_country). Merge them by title+year.
	const norm = (v: string) => (v || "").toLowerCase().replace(/[\s\-_:,.　·、，。]/g, "");
	const byTitle = new Map<string, ContentItem>();
	const score = (x: ContentItem) =>
		(x.poster_path ? 4 : 0) + (x.imdbId ? 2 : 0) + (x.vote_average ?? 0) / 10;

	for (const item of byTmdb.values()) {
		const year = (item.first_air_date || item.release_date || "").slice(0, 4);
		const key = norm(item.title || "") + "|" + year;
		const existing = byTitle.get(key);
		if (!existing || score(item) > score(existing)) {
			byTitle.set(key, item);
		}
	}

	return Array.from(byTitle.values());
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

	const enriched = await fetchDetailsWithEnrichment(
		tmdbId,
		mediaType,
		"zh-CN",
		tmdb,
		tmdbData.original_language,
	);
	const data = enriched?.tmdbData ?? tmdbData;
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
		poster_path: absImg(data.poster_path) as string,
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
const ALL_CRAWLERS: Record<string, () => Promise<unknown>> = {
	douban_movies: crawlDoubanMovies,
	douban_tv: crawlDoubanTVSeries,
	douban_korean_tv: crawlDoubanKoreanTVSeries,
	douban_japanese_tv: crawlDoubanJapaneseTVSeries,
	hami_taiwanese_tv: crawlHamiTaiwaneseTVSeries,
	douban_animation: crawlDoubanAnimation,
	douban_variety: crawlDoubanHotVarietyShows,
	bangumi_animation: crawlBangumiAnimation,
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

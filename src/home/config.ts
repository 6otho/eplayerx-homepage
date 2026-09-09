/// <reference types="@cloudflare/workers-types" />
/**
 * Custom Homepage Config for EPlayerX.
 * Fixed: blocks[0] is regular media block with route, matching carouselSourceId.
 */

import { getCommunityBlocksByIds } from "../blocks/storage.js";
import {
	type CollectionBlock,
	type TmdbListRoute,
} from "../blocks/types.js";

type Locale = "en" | "zh" | "zh-Hant" | "ja" | "es" | "ar";

type HomeTitleKey =
	| "home.continue_watching"
	| "home.tmdb_popular_tv_shows"
	| "home.tmdb_popular_movies"
	| "home.popular_domestic_anime"
	| "home.bangumi_popular_anime"
	| "home.tmdb_on_the_air_tv_shows"
	| "home.popular_tv_shows"
	| "home.popular_movies"
	| "home.popular_variety_shows"
	| "home.popular_korean_tv_shows"
	| "home.popular_japanese_tv_shows"
	| "home.popular_spanish_tv_shows"
	| "home.popular_taiwanese_tv_shows"
	| "home.popular_taiwanese_movies"
	| "home.tmdb_discover_genres"
	| "home.tmdb_discover_languages"
	| "home.tmdb_discover_networks"
	| "home.classic_decades"
	| "home.tmdb_top_rated_movies"
	| "home.tmdb_top_rated_tv_shows"
	| "home.weekly_anime"
	| "home.weekly_drama"
	| "home.weekly_guoman"
	| "home.weekly_korean_drama"
	| "home.weekly_japanese_drama"
	| "home.weekly_sea_drama"
	| "home.tmdb_tv_netflix"
	| "home.variety_cn"
	| "home.variety_kr"
	| "home.variety_global"
	| "home.tmdb_tv_hbo"
	| "home.tmdb_tv_apple"
	| "home.trakt_movies"
	| "home.trakt_shows"
	| "home.tmdb_anime_jp"
	| "home.imdb_top_anime"
	| "home.prime_hot_anime"
	| "home.filmarks_anime_movie"
	| "home.netflix_hot_anime"
	| "home.tmdb_anime_top_ja"
	| "home.tmdb_anime_movie_ja"
	| "home.tmdb_movie_sea"
	| "home.tmdb_movie_hk_erotic_comedy"
	| "home.tmdb_tv_th"
	| "home.tmdb_movie_th"
	| "home.tmdb_tv_bl"
	| "home.netflix_minor_tv_shows"
	| "home.netflix_minor_movies";

type SourceQueryValue = string | number | boolean;

interface HomePagination {
	pageParam: string;
	startPage: number;
}

interface HomeBlockSource {
	id?: string;
	path?: string;
	query?: Record<string, SourceQueryValue>;
	itemEnvelope?: "data" | "results" | "array";
	pagination?: HomePagination;
}

export interface HomeConfigMediaBlock {
	id: string;
	title?: string;
	mediaType?: "movie" | "tv";
	preset: string;
	showRank?: boolean;
	showOverview?: boolean;
	source?: HomeBlockSource;
	metadata?: {
		isAnime?: boolean;
	};
	route?: TmdbListRoute;
}

export type HomeConfigBlock = HomeConfigMediaBlock | CollectionBlock;

type TmdbListRouteParams = TmdbListRoute["params"];

export type HomeBlockTemplate = Omit<HomeConfigMediaBlock, "title"> & {
	titleKey?: HomeTitleKey;
	title?: string;
	groupMode?: string;
	style?: string;
	sort?: string;
	children?: any[];
};

type DecadesCollectionSlot = { type: "decades-collection" };
type SectionTemplate = HomeBlockTemplate | DecadesCollectionSlot;

export interface HomeConfigOptions {
	apiBaseUrl: string;
	imageBaseUrl: string;
	language: string;
	timezone: string;
	db?: D1Database;
}

export interface HomeConfig {
	version: number;
	apiBaseUrl: string;
	imageBaseUrl: string;
	carouselSourceId: string;
	blocks: HomeConfigBlock[];
}

export const HOME_CONFIG_VERSION = 1;

const TITLE_TRANSLATIONS: Record<string, Record<Locale, string>> = {
	"home.continue_watching": { en: "Continue Watching", zh: "继续观看", "zh-Hant": "繼續觀看", ja: "続きを見る", es: "Continuar Viendo", ar: "متابعة المشاهدة" },
	"home.tmdb_popular_tv_shows": { en: "Today's Popular TV Shows", zh: "今日热门电视剧", "zh-Hant": "今日熱門電視劇", ja: "今日の人気テレビ番組", es: "Series de TV Populares de Hoy", ar: "مسلسلات شائعة" },
	"home.tmdb_popular_movies": { en: "Today's Popular Movies", zh: "今日热门电影", "zh-Hant": "今日熱門電影", ja: "今日の人気映画", es: "Películas Populares de Hoy", ar: "أفلام شائعة" },
	"home.popular_tv_shows": { en: "Popular Domestic Dramas", zh: "时下热门国产剧", "zh-Hant": "時下熱門國產劇", ja: "人気の中国ドラマ", es: "Dramas Chinos Populares", ar: "دراما صينية شائعة" },
	"home.popular_movies": { en: "Trending Movies", zh: "实时热门电影", "zh-Hant": "實時熱門電影", ja: "リアルタイム人気映画", es: "Películas en Tendencia", ar: "أفلام رائجة" },
	"home.tmdb_discover_genres": { en: "Browse By Category", zh: "按分类浏览", "zh-Hant": "按分類瀏覽", ja: "カテゴリで探す", es: "Explorar por Categoría", ar: "تصفح حسب الفئة" },
	"home.classic_decades": { en: "Classic Decades", zh: "年代经典", "zh-Hant": "年代經典", ja: "年代別クラシック", es: "Clásicos por Década", ar: "كلاسيكيات العقود" },
	"home.tmdb_discover_networks": { en: "Browse By Network", zh: "按平台浏览", "zh-Hant": "按平台瀏覽", ja: "配信サービスで探す", es: "Explorar por Plataforma", ar: "حسب الشبكة" },
	"home.tmdb_discover_languages": { en: "Browse By Language", zh: "按语言浏览", "zh-Hant": "按語言瀏覽", ja: "言語で探す", es: "Explorar por Idioma", ar: "حسب اللغة" },
	"home.tmdb_on_the_air_tv_shows": { en: "On The Air TV Shows", zh: "正在热播", "zh-Hant": "正在熱播", ja: "放送中", es: "En Emisión", ar: "يعرض الآن" },
	"home.popular_domestic_anime": { en: "Popular Domestic Anime", zh: "热门国产动漫", "zh-Hant": "熱門國產動漫", ja: "人気の国内アニメ", es: "Anime Doméstico Popular", ar: "أنمي محلي" },
	"home.bangumi_popular_anime": { en: "Today's Popular Bangumi", zh: "今日热门番剧", "zh-Hant": "今日熱門番劇", ja: "今日の人気番組", es: "Bangumi Populares de Hoy", ar: "بانغومي شائع" },
	"home.popular_korean_tv_shows": { en: "Popular Korean Dramas", zh: "备受欢迎的韩剧推荐", "zh-Hant": "備受歡迎的韓劇推薦", ja: "人気の韓国ドラマ", es: "Dramas Coreanos Populares", ar: "دراما كورية شائعة" },
	"home.popular_japanese_tv_shows": { en: "Trending Japanese Dramas", zh: "细腻又治愈的高人气日剧", "zh-Hant": "細膩又治癒的高人氣日劇", ja: "最近人気の日本ドラマ", es: "Dramas Japoneses en Tendencia", ar: "دراما يابانية رائجة" },
	"home.popular_spanish_tv_shows": { en: "Trending Spanish-Language Series", zh: "时下流行的西语剧集", "zh-Hant": "時下流行的西語劇集", ja: "話題のスペイン語シリーズ", es: "Series en Español en Tendencia", ar: "مسلسلات إspania رائجة" },
	"home.popular_taiwanese_tv_shows": { en: "Popular Taiwanese Dramas", zh: "台剧当然也不能落下", "zh-Hant": "台劇當然也不能落下", ja: "人気の台湾ドラマ", es: "Dramas Taiwaneses Populares", ar: "دراما تايوانية شائعة" },
	"home.popular_taiwanese_movies": { en: "Popular Taiwanese Movies", zh: "台味浓浓的宝藏台片", "zh-Hant": "台味濃濃的寶藏台片", ja: "人気の台湾映画", es: "Películas Taiwanesas Populares", ar: "أفلام تايوانية شهيرة" },
	"home.popular_variety_shows": { en: "Today's Popular Variety Shows", zh: "实时热门综艺", "zh-Hant": "實時熱門綜藝", ja: "今日の人気バラエティ", es: "Programas de Variedades Populares de Hoy", ar: "برامج منوعة" },
	"home.tmdb_top_rated_movies": { en: "Top Rated Movies", zh: "高分电影", "zh-Hant": "高分電影", ja: "高評価映画", es: "Películas Mejor Valoradas", ar: "الأعلى تقييماً" },
	"home.tmdb_top_rated_tv_shows": { en: "Top Rated TV Shows", zh: "高分电视剧", "zh-Hant": "高分電視劇", ja: "高評価テレビ番組", es: "Series Mejor Valoradas", ar: "المسلسلات الأعلى تقييماً" }
};

// 🌟 核心：确保提供正确的 route 参数供客户端跳转
const TMDB_LIST_ROUTE_PARAMS: Partial<Record<string, TmdbListRouteParams>> = {
	"tmdb-popular-tv-shows": { category: "trending", type: "tv" },
	"tmdb-popular-movies": { category: "trending", type: "movie" },
	"tmdb_popular_tv": { category: "trending", type: "tv" },
	"tmdb_popular_movies": { category: "trending", type: "movie" },
};

const DECADES_COLLECTION_ID = "col-9e37cdc1f13d";

function resolveLocale(language: string): Locale {
	const normalized = (language || "").toLowerCase();
	if (normalized.startsWith("zh-hant") || normalized.includes("tw") || normalized.includes("hk")) return "zh-Hant";
	if (normalized.startsWith("zh")) return "zh";
	if (normalized.startsWith("ja")) return "ja";
	if (normalized.startsWith("es")) return "es";
	if (normalized.startsWith("ar")) return "ar";
	return "en";
}

function resolveTitle(titleKey: string, language: string): string {
	if (!titleKey) return "";
	const trans = TITLE_TRANSLATIONS[titleKey];
	if (!trans) return titleKey;
	return trans[resolveLocale(language)] || trans["zh"] || trans["en"] || titleKey;
}

function createTmdbListRoute(title: string, params: TmdbListRouteParams): TmdbListRoute {
	return { type: "tmdb-list", title, params };
}

function isDecadesCollectionSlot(section: SectionTemplate): section is DecadesCollectionSlot {
	return "type" in section && section.type === "decades-collection";
}

function createDefaultBlockTemplates(language: string, timezone: string): SectionTemplate[] {
	return [
		// =============================================================
		// 🌟 1. 核心关键：第 0 位必须是普通海报列表，作为顶部轮播源（必须与 carouselSourceId 对应）
		// =============================================================
		{
			id: "tmdb-popular-tv-shows",
			mediaType: "tv",
			titleKey: "home.tmdb_popular_tv_shows",
			preset: "poster-list",
			showRank: true,
			source: {
				path: "/tmdb/trending/tv",
				query: { language, page: 1, limit: 20 },
				itemEnvelope: "results",
				pagination: { pageParam: "page", startPage: 1 },
			},
		},

		// =============================================================
		// 🌟 2. 从第 1 位开始，排入你的六大追剧周更表（合集）
		// =============================================================
		{
			id: "weekly_drama_collection",
			title: "国产追剧周更表",
			mediaType: "tv",
			preset: "collection-list",
			style: "image-landscape",
			groupMode: "weekday",
			children: [1, 2, 3, 4, 5, 6, 7].map(d => ({
				id: `weekly_drama_collection-${d}`,
				label: `周${["一", "二", "三", "四", "五", "六", "日"][d - 1]}`,
				weekday: d,
				title: `周${["一", "二", "三", "四", "五", "六", "日"][d - 1]}`,
				mediaType: "tv",
				preset: "poster-list",
				source: { path: `https://r2.eplayerx.cc.cd/weekly_drama_collection-${d}.json`, itemEnvelope: "data" },
			})),
		},
		{
			id: "weekly_guoman_collection",
			title: "国漫追番周历表",
			mediaType: "tv",
			preset: "collection-list",
			style: "image-landscape",
			groupMode: "weekday",
			children: [1, 2, 3, 4, 5, 6, 7].map(d => ({
				id: `weekly_guoman_collection-${d}`,
				label: `周${["一", "二", "三", "四", "五", "六", "日"][d - 1]}`,
				weekday: d,
				title: `周${["一", "二", "三", "四", "五", "六", "日"][d - 1]}`,
				mediaType: "tv",
				preset: "poster-list",
				source: { path: `https://r2.eplayerx.cc.cd/weekly_guoman_collection-${d}.json`, itemEnvelope: "data" },
			})),
		},
		{
			id: "weekly_anime_collection",
			title: "动漫新番周更表",
			mediaType: "tv",
			preset: "collection-list",
			style: "image-landscape",
			groupMode: "weekday",
			children: [1, 2, 3, 4, 5, 6, 7].map(d => ({
				id: `weekly_anime_collection-${d}`,
				label: `周${["一", "二", "三", "四", "五", "六", "日"][d - 1]}`,
				weekday: d,
				title: `周${["一", "二", "三", "四", "五", "六", "日"][d - 1]}`,
				mediaType: "tv",
				preset: "poster-list",
				source: { path: `https://r2.eplayerx.cc.cd/weekly_anime_collection-${d}.json`, itemEnvelope: "data" },
			})),
		},
		{
			id: "weekly_korean_drama_collection",
			title: "韩剧追剧周更表",
			mediaType: "tv",
			preset: "collection-list",
			style: "image-landscape",
			groupMode: "weekday",
			children: [1, 2, 3, 4, 5, 6, 7].map(d => ({
				id: `weekly_korean_drama_collection-${d}`,
				label: `周${["一", "二", "三", "四", "五", "六", "日"][d - 1]}`,
				weekday: d,
				title: `周${["一", "二", "三", "四", "五", "六", "日"][d - 1]}`,
				mediaType: "tv",
				preset: "poster-list",
				source: { path: `https://r2.eplayerx.cc.cd/weekly_korean_drama_collection-${d}.json`, itemEnvelope: "data" },
			})),
		},
		{
			id: "weekly_japanese_drama_collection",
			title: "日剧追剧周更表",
			mediaType: "tv",
			preset: "collection-list",
			style: "image-landscape",
			groupMode: "weekday",
			children: [1, 2, 3, 4, 5, 6, 7].map(d => ({
				id: `weekly_japanese_drama_collection-${d}`,
				label: `周${["一", "二", "三", "四", "五", "六", "日"][d - 1]}`,
				weekday: d,
				title: `周${["一", "二", "三", "四", "五", "六", "日"][d - 1]}`,
				mediaType: "tv",
				preset: "poster-list",
				source: { path: `https://r2.eplayerx.cc.cd/weekly_japanese_drama_collection-${d}.json`, itemEnvelope: "data" },
			})),
		},
		{
			id: "weekly_sea_drama_collection",
			title: "东南亚剧周更表",
			mediaType: "tv",
			preset: "collection-list",
			style: "image-landscape",
			groupMode: "weekday",
			children: [1, 2, 3, 4, 5, 6, 7].map(d => ({
				id: `weekly_sea_drama_collection-${d}`,
				label: `周${["一", "二", "三", "四", "五", "六", "日"][d - 1]}`,
				weekday: d,
				title: `周${["一", "二", "三", "四", "五", "六", "日"][d - 1]}`,
				mediaType: "tv",
				preset: "poster-list",
				source: { path: `https://r2.eplayerx.cc.cd/weekly_sea_drama_collection-${d}.json`, itemEnvelope: "data" },
			})),
		},

		// =============================================================
		// 🌟 3. 原生探索与分类模块
		// =============================================================
		{
			id: "tmdb-discover-genres",
			titleKey: "home.tmdb_discover_genres",
			preset: "genres-list",
			source: { path: "/crawler/discover/genres", query: { language }, itemEnvelope: "data" },
		},
		{ type: "decades-collection" },
		{
			id: "tmdb-discover-networks",
			titleKey: "home.tmdb_discover_networks",
			preset: "networks-list",
			source: { path: "/crawler/discover/tv-by-network", itemEnvelope: "data" },
		},
		{
			id: "tmdb-discover-tv-by-language",
			titleKey: "home.tmdb_discover_languages",
			preset: "languages-list",
			source: { path: "https://api.eplayerx.com/crawler/discover/tv-by-language/v2", query: { language }, itemEnvelope: "data" },
		},

		// =============================================================
		// 🌟 4. 你的自建大盘列表（全部 showOverview: false）
		// =============================================================
		{
			id: "tmdb_popular_movies",
			mediaType: "movie",
			titleKey: "home.tmdb_popular_movies",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/tmdb-popular-movies.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "tmdb_popular_tv",
			mediaType: "tv",
			titleKey: "home.tmdb_popular_tv_shows",
			preset: "hero-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/tmdb-popular-tv.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "bangumi_airing",
			mediaType: "tv",
			titleKey: "home.bangumi_popular_anime",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/bangumi-airing.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "douban_tv_custom",
			mediaType: "tv",
			titleKey: "home.popular_tv_shows",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/douban-tv-custom.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "tmdb_tv_netflix",
			mediaType: "tv",
			titleKey: "home.tmdb_tv_netflix",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/tmdb-tv-netflix.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "variety_cn",
			mediaType: "tv",
			titleKey: "home.variety_cn",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/variety-cn.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "variety_kr",
			mediaType: "tv",
			titleKey: "home.variety_kr",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/variety-kr.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "variety_global",
			mediaType: "tv",
			titleKey: "home.variety_global",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/variety-global.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "tmdb_tv_hbo",
			mediaType: "tv",
			titleKey: "home.tmdb_tv_hbo",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/tmdb-tv-hbo.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "tmdb_tv_apple",
			mediaType: "tv",
			titleKey: "home.tmdb_tv_apple",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/tmdb-tv-apple.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "trakt_movies",
			mediaType: "movie",
			titleKey: "home.trakt_movies",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/trakt-movies.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "tmdb_anime_cn",
			mediaType: "tv",
			titleKey: "home.popular_domestic_anime",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/tmdb-anime-cn.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "trakt_shows",
			mediaType: "tv",
			titleKey: "home.trakt_shows",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/trakt-shows.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "douban_movies",
			mediaType: "movie",
			titleKey: "home.popular_movies",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/douban-movies.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "douban_korean_tv",
			mediaType: "tv",
			titleKey: "home.popular_korean_tv_shows",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/douban-korean-tv.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "tmdb_tv_ja",
			mediaType: "tv",
			titleKey: "home.popular_japanese_tv_shows",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/tmdb-tv-ja.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "tmdb_anime_jp",
			mediaType: "tv",
			titleKey: "home.tmdb_anime_jp",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/tmdb-anime-jp.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "imdb_top_anime",
			mediaType: "tv",
			titleKey: "home.imdb_top_anime",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/imdb-top-anime.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "prime_hot_anime",
			mediaType: "tv",
			titleKey: "home.prime_hot_anime",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/prime-hot-anime.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "filmarks_anime_movie",
			mediaType: "movie",
			titleKey: "home.filmarks_anime_movie",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/filmarks-anime-movie.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "netflix_hot_anime",
			mediaType: "tv",
			titleKey: "home.netflix_hot_anime",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/netflix-hot-anime.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "tmdb_anime_top_ja",
			mediaType: "tv",
			titleKey: "home.tmdb_anime_top_ja",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/tmdb-anime-top-ja.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "tmdb_anime_movie_ja",
			mediaType: "movie",
			titleKey: "home.tmdb_anime_movie_ja",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/tmdb-anime-movie-ja.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "tmdb_tv_es",
			mediaType: "tv",
			titleKey: "home.popular_spanish_tv_shows",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/tmdb-tv-es.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "tmdb_tv_tw",
			mediaType: "tv",
			titleKey: "home.popular_taiwanese_tv_shows",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/tmdb-tv-tw.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "tmdb_movie_tw",
			mediaType: "movie",
			titleKey: "home.popular_taiwanese_movies",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/tmdb-movie-tw.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "tmdb_movie_sea",
			mediaType: "movie",
			titleKey: "home.tmdb_movie_sea",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/tmdb-movie-sea.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "tmdb_movie_hk_erotic_comedy",
			mediaType: "movie",
			titleKey: "home.tmdb_movie_hk_erotic_comedy",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/tmdb-movie-hk-erotic_comedy.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "tmdb_tv_th",
			mediaType: "tv",
			titleKey: "home.tmdb_tv_th",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/tmdb-tv-th.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "tmdb_movie_th",
			mediaType: "movie",
			titleKey: "home.tmdb_movie_th",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/tmdb-movie-th.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "tmdb_tv_bl",
			mediaType: "tv",
			titleKey: "home.tmdb_tv_bl",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/tmdb-tv-bl.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "netflix_tv_minor",
			mediaType: "tv",
			titleKey: "home.netflix_minor_tv_shows",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/netflix-tv-minor.json?sort=year", itemEnvelope: "data" },
		},
		{
			id: "netflix_movie_minor",
			mediaType: "movie",
			titleKey: "home.netflix_minor_movies",
			preset: "poster-list",
			showRank: true,
			showOverview: false,
			sort: "year",
			source: { path: "https://r2.eplayerx.cc.cd/netflix-movie-minor.json?sort=year", itemEnvelope: "data" },
		},
	];
}

function resolveMediaBlock(
	block: HomeBlockTemplate,
	language: string,
): HomeConfigBlock {
	const { titleKey, ...rest } = block;
	if (!titleKey) return rest as HomeConfigBlock;
	const title = resolveTitle(titleKey, language);
	const routeParams = TMDB_LIST_ROUTE_PARAMS[rest.id];

	return {
		...rest,
		title,
		...(routeParams ? { route: createTmdbListRoute(title, routeParams) } : {}),
	} as HomeConfigBlock;
}

function parseDecadesCollection(
	blockId: string,
	blockJson: string,
	language: string,
): CollectionBlock | null {
	try {
		const parsed = JSON.parse(blockJson) as CollectionBlock;
		if (parsed.preset !== "collection-list" && (parsed as any).preset !== "collection") return null;
		if (!Array.isArray(parsed.children) || parsed.children.length < 2) {
			return null;
		}
		return {
			...parsed,
			id: parsed.id || blockId,
			title: resolveTitle("home.classic_decades", language),
			style: "image-landscape",
		};
	} catch {
		return null;
	}
}

async function resolveDecadesCollection(
	db: D1Database | undefined,
	language: string,
): Promise<CollectionBlock | null> {
	if (!db) return null;

	try {
		const rows = await getCommunityBlocksByIds(db, [DECADES_COLLECTION_ID]);
		const row = rows.get(DECADES_COLLECTION_ID);
		if (!row) return null;
		return parseDecadesCollection(DECADES_COLLECTION_ID, row.block_json, language);
	} catch {
		return null;
	}
}

// 🌟 核心：输出给客户端的自定义首页主配置
export async function createDefaultHomeConfig(
	options: HomeConfigOptions,
): Promise<HomeConfig> {
	const decades = await resolveDecadesCollection(options.db, options.language);
	const blocks: HomeConfigBlock[] = [];

	for (const section of createDefaultBlockTemplates(
		options.language,
		options.timezone,
	)) {
		if (isDecadesCollectionSlot(section)) {
			if (decades) blocks.push(decades);
			continue;
		}
		blocks.push(resolveMediaBlock(section as HomeBlockTemplate, options.language));
	}

	return {
		version: 2, // 🌟 必须写 2，新版客户端只认 version 2 的数据协议！
		apiBaseUrl: options.apiBaseUrl,
		imageBaseUrl: options.imageBaseUrl,
		carouselSourceId: "tmdb-popular-tv-shows", // 🌟 必须与 blocks[0].id 完全匹配！
		blocks,
	};
}

export const createHomeConfig = createDefaultHomeConfig;
export const createHomeConfigV2 = createDefaultHomeConfig;
export default createDefaultHomeConfig;

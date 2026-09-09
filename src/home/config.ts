/// <reference types="@cloudflare/workers-types" />
/**
 * Custom Homepage Config (V1 Endpoint).
 * Dedicated for `/home/config`. Completely isolated from V2.
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

// 🌟 核心：自定义 V1 接口的版本号严格必须是 1
export const HOME_CONFIG_VERSION = 1;

const TITLE_TRANSLATIONS: Record<string, Record<Locale, string>> = {
	"home.continue_watching": { en: "继续观看", zh: "继续观看", "zh-Hant": "繼續觀看", ja: "続きを見る", es: "Continuar Viendo", ar: "متابعة المشاهدة" },
	"home.tmdb_popular_tv_shows": { en: "今日热门电视剧", zh: "今日热门电视剧", "zh-Hant": "今日熱門電視劇", ja: "今日の人気テレビ番組", es: "Series de TV Populares de Hoy", ar: "مسلسلات شائعة" },
	"home.tmdb_popular_movies": { en: "今日热门电影", zh: "今日热门电影", "zh-Hant": "今日熱門電影", ja: "今日の人気映画", es: "Películas Populares de Hoy", ar: "أفلام شائعة" },
	"home.popular_tv_shows": { en: "时下热门国产剧", zh: "时下热门国产剧", "zh-Hant": "時下熱門國產劇", ja: "人気の中国ドラマ", es: "Dramas Chinos Populares", ar: "دراما صينية شائعة" },
	"home.popular_movies": { en: "实时热门电影", zh: "实时热门电影", "zh-Hant": "實時熱門電影", ja: "リアルタイム人気映画", es: "Películas en Tendencia", ar: "أفلام رائجة" },
	"home.tmdb_discover_genres": { en: "按分类浏览", zh: "按分类浏览", "zh-Hant": "按分類瀏覽", ja: "カテゴリで探す", es: "Explorar por Categoría", ar: "تصفح حسب الفئة" },
	"home.classic_decades": { en: "年代经典", zh: "年代经典", "zh-Hant": "年代經典", ja: "年代別クラシック", es: "Clásicos por Década", ar: "كلاسيكيات العقود" },
	"home.tmdb_discover_networks": { en: "按平台浏览", zh: "按平台浏览", "zh-Hant": "按平台瀏覽", ja: "配信サービスで探す", es: "Explorar por Plataforma", ar: "حسب الشبكة" },
	"home.tmdb_discover_languages": { en: "按语言浏览", zh: "按语言浏览", "zh-Hant": "按語言瀏覽", ja: "言語で探す", es: "Explorar por Idioma", ar: "حسب اللغة" },
	"home.tmdb_on_the_air_tv_shows": { en: "正在热播", zh: "正在热播", "zh-Hant": "正在熱播", ja: "放送中", es: "En Emisión", ar: "يعرض الآن" },
	"home.popular_domestic_anime": { en: "热门国产动漫", zh: "热门国产动漫", "zh-Hant": "熱門國產動漫", ja: "人気の国内アニメ", es: "Anime Doméstico Popular", ar: "أنمي محلي" },
	"home.bangumi_popular_anime": { en: "今日热门番剧", zh: "今日热门番剧", "zh-Hant": "今日熱門番劇", ja: "今日の人気番組", es: "Bangumi Populares de Hoy", ar: "بانغومي شائع" },
	"home.popular_korean_tv_shows": { en: "备受欢迎的韩剧推荐", zh: "备受欢迎的韩剧推荐", "zh-Hant": "備受歡迎的韓劇推薦", ja: "人気の韓国ドラマ", es: "Dramas Coreanos Populares", ar: "دراما كورية شائعة" },
	"home.popular_japanese_tv_shows": { en: "细腻又治愈的高人气日剧", zh: "细腻又治愈的高人气日剧", "zh-Hant": "細膩又治癒的高人氣日劇", ja: "最近人気の日本ドラマ", es: "Dramas Japoneses en Tendencia", ar: "دراما يابانية رائجة" },
	"home.popular_spanish_tv_shows": { en: "时下流行的西语剧集", zh: "时下流行的西语剧集", "zh-Hant": "時下流行的西語劇集", ja: "話題のスペイン語シリーズ", es: "Series en Español en Tendencia", ar: "مسلسلات إspania رائجة" },
	"home.popular_taiwanese_tv_shows": { en: "台剧当然也不能落下", zh: "台剧当然也不能落下", "zh-Hant": "台劇當然也不能落下", ja: "人気の台湾ドラマ", es: "Dramas Taiwaneses Populares", ar: "دراما تايوانية شائعة" },
	"home.popular_taiwanese_movies": { en: "台味浓浓的宝藏台片", zh: "台味浓浓的宝藏台片", "zh-Hant": "台味濃濃的寶藏台片", ja: "人気の台湾映画", es: "Películas Taiwanesas Populares", ar: "أفلام تايوانية شهيرة" },
	"home.popular_variety_shows": { en: "实时热门综艺", zh: "实时热门综艺", "zh-Hant": "實時熱門綜藝", ja: "今日の人気バラエティ", es: "Programas de Variedades Populares de Hoy", ar: "برامج منوعة" },
	"home.tmdb_top_rated_movies": { en: "高分电影", zh: "高分电影", "zh-Hant": "高分電影", ja: "高評価映画", es: "Películas Mejor Valoradas", ar: "الأعلى تقييماً" },
	"home.tmdb_top_rated_tv_shows": { en: "高分电视剧", zh: "高分电视剧", "zh-Hant": "高分電視劇", ja: "高評価テレビ番組", es: "Series Mejor Valoradas", ar: "المسلسلات الأعلى تقييماً" },
	"home.weekly_anime": { en: "动漫新番周更表", zh: "动漫新番周更表", "zh-Hant": "動漫新番週更表", ja: "アニメ週間更新", es: "Anime Semanal", ar: "أنمي أسبوعي" },
	"home.weekly_drama": { en: "国产追剧周更表", zh: "国产追剧周更表", "zh-Hant": "國產追劇週更表", ja: "中国ドラマ週間更新", es: "Dramas Semanales", ar: "دراما صينية أسبوعية" },
	"home.weekly_guoman": { en: "国漫追番周历表", zh: "国漫追番周历表", "zh-Hant": "國漫追番週歷表", ja: "国漫週間更新", es: "Animación China Semanal", ar: "أنمي صيني أسبوعي" },
	"home.weekly_korean_drama": { en: "韩剧追剧周更表", zh: "韩剧追剧周更表", "zh-Hant": "韓劇追劇週更表", ja: "韓国ドラマ週間更新", es: "Dramas Coreanos Semanales", ar: "دراما كورية أسبوعية" },
	"home.weekly_japanese_drama": { en: "日剧追剧周更表", zh: "日剧追剧周更表", "zh-Hant": "日劇追劇週更表", ja: "日本ドラマ週間更新", es: "Dramas Japoneses Semanales", ar: "دراما يابانية أسبوعية" },
	"home.weekly_sea_drama": { en: "东南亚剧周更表", zh: "东南亚剧周更表", "zh-Hant": "東南亞劇週更表", ja: "東南アジアドラマ週間更新", es: "Dramas del Sudeste Asiático Semanales", ar: "دراما جنوب شرق آسيا" },
	"home.tmdb_tv_netflix": { en: "Netflix 全球热播好剧", zh: "Netflix 全球热播好剧", "zh-Hant": "Netflix 全球熱播好剧", ja: "Netflix 人気ドラマ", es: "Series Populares de Netflix", ar: "مسلسلات نتفليكس الشهيرة" },
	"home.variety_cn": { en: "热门国产综艺", zh: "热门国产综艺", "zh-Hant": "熱門國產綜藝", ja: "人気の中国バラエティ", es: "Variedades Chinas Populares", ar: "برامج منوعة صينية" },
	"home.variety_kr": { en: "爆款韩国综艺", zh: "爆款韩国综艺", "zh-Hant": "爆款韓國綜藝", ja: "人気の韓国バラエティ", es: "Variedades Coreanas Populares", ar: "برامج منوعة كورية" },
	"home.variety_global": { en: "全球流媒体新热综艺", zh: "全球流媒体新热综艺", "zh-Hant": "全球串流新熱綜藝", ja: "グローバルバラエティ", es: "Variedades Globales", ar: "برامج منوعة عالمية" },
	"home.tmdb_tv_hbo": { en: "HBO 高分神剧", zh: "HBO 高分神剧", "zh-Hant": "HBO 高分神劇", ja: "HBO 名作ドラマ", es: "Series de HBO", ar: "مسلسلات HBO" },
	"home.tmdb_tv_apple": { en: "Apple TV+ 原创精品", zh: "Apple TV+ 原创精品", "zh-Hant": "Apple TV+ 原創精品", ja: "Apple TV+ オリジナル", es: "Originales de Apple TV+", ar: "أعمال Apple TV+ الأصلية" },
	"home.trakt_movies": { en: "火爆全球欧美大片", zh: "火爆全球欧美大片", "zh-Hant": "火爆全球歐美大片", ja: "大ヒット映画", es: "Películas Populares de Trakt", ar: "أفلام رائجة" },
	"home.trakt_shows": { en: "时下热播欧美剧集", zh: "时下热播欧美剧集", "zh-Hant": "時下熱播歐美劇集", ja: "海外人気ドラマ", es: "Series Populares de Trakt", ar: "مسلسلات رائجة" },
	"home.tmdb_anime_jp": { en: "近期热门日本动漫", zh: "近期热门日本动漫", "zh-Hant": "近期熱門日本動漫", ja: "最近人気の日本アニメ", es: "Anime Japonés Popular", ar: "أنمي ياباني شهير" },
	"home.imdb_top_anime": { en: "IMDb 史诗动漫神作", zh: "IMDb 史诗动漫神作", "zh-Hant": "IMDb 史詩動漫神作", ja: "IMDb 高評価アニメ", es: "Anime Mejor Valorado IMDb", ar: "أفضل أنمي حسب IMDb" },
	"home.prime_hot_anime": { en: "Prime Video 热门日漫", zh: "Prime Video 热门日漫", "zh-Hant": "Prime Video 熱門日漫", ja: "Prime Video 人気アニメ", es: "Anime Popular de Prime Video", ar: "أنمي برايم فيديو الشهير" },
	"home.filmarks_anime_movie": { en: "Filmarks 高分剧场版", zh: "Filmarks 高分剧场版", "zh-Hant": "Filmarks 高分劇場版", ja: "Filmarks 高評価アニメ映画", es: "Películas de Anime Filmarks", ar: "أفلام أنمي Filmarks" },
	"home.netflix_hot_anime": { en: "Netflix 独播霸榜日漫", zh: "Netflix 独播霸榜日漫", "zh-Hant": "Netflix 獨播霸榜日漫", ja: "Netflix 人気アニメ", es: "Anime Exclusivo de Netflix", ar: "أنمي نتفليكس الحصري" },
	"home.tmdb_anime_top_ja": { en: "TMDB 高分神作日漫", zh: "TMDB 高分神作日漫", "zh-Hant": "TMDB 高分神作日漫", ja: "TMDB 高評価アニメ", es: "Anime Mejor Valorado TMDB", ar: "أفضل أنمي حسب TMDB" },
	"home.tmdb_anime_movie_ja": { en: "备受好评的动画电影", zh: "备受好评的动画电影", "zh-Hant": "備受好評的動畫電影", ja: "名作アニメ映画", es: "Películas de Anime Aclamadas", ar: "أفلام أنمي مميزة" },
	"home.tmdb_movie_sea": { en: "荷尔模超标的东南亚", zh: "荷尔模超标的东南亚", "zh-Hant": "荷爾蒙超標的東南亞", ja: "東南アジア映画", es: "Películas del Sudeste Asiático", ar: "أفلام جنوب شرق آسيا" },
	"home.tmdb_movie_hk_erotic_comedy": { en: "港产经典风月喜剧", zh: "港产经典风月喜剧", "zh-Hant": "港產經典風月喜劇", ja: "香港クラシックコメディ", es: "Comedias Clásicas de Hong Kong", ar: "كوميديا هونغ كونغ الكلاسيكية" },
	"home.tmdb_tv_th": { en: "狗血上头的爆款泰剧", zh: "狗血上头的爆款泰剧", "zh-Hant": "狗血上頭的爆款泰劇", ja: "人気のタイドラマ", es: "Dramas Tailandeses Populares", ar: "مسلسلات تايلاندية شهيرة" },
	"home.tmdb_movie_th": { en: "不止鬼片的泰国电影", zh: "不止鬼片的泰国电影", "zh-Hant": "不止鬼片的泰國電影", ja: "タイ映画コレクション", es: "Películas Tailandesas", ar: "أفلام تايلاندية" },
	"home.tmdb_tv_bl": { en: "暧昧拉扯到极致的亚洲耽美神作", zh: "暧昧拉扯到极致的亚洲耽美神作", "zh-Hant": "曖昧拉扯到極致的亞洲耽美神作", ja: "アジアのBLドラマ名作", es: "Dramas BL Asiáticos", ar: "دراما آسيوية مميزة" },
	"home.netflix_minor_tv_shows": { en: "Netflix 小语种神剧", zh: "Netflix 小语种神剧", "zh-Hant": "Netflix 小語種神劇", ja: "Netflix マイナー言語ドラマ", es: "Series de Netflix en Otros Idiomas", ar: "مسلسلات نتفليكس بلغات أخرى" },
	"home.netflix_minor_movies": { en: "冷门却惊艳的小语种电影", zh: "冷门却惊艳的小语种电影", "zh-Hant": "冷門卻驚豔的小語種电影", ja: "隠れた名作外国映画", es: "Películas Sorprendentes en Otros Idiomas", ar: "أفلام بلغات أخرى" }
};

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
	return "zh";
}

function resolveTitle(titleKey: string, language: string): string {
	if (!titleKey) return "";
	const trans = TITLE_TRANSLATIONS[titleKey];
	if (!trans) return titleKey;
	const loc = resolveLocale(language);
	return trans[loc] || trans["zh"] || trans["zh-Hant"] || titleKey;
}

function createTmdbListRoute(title: string, params: TmdbListRouteParams): TmdbListRoute {
	return { type: "tmdb-list", title, params };
}

function isDecadesCollectionSlot(section: SectionTemplate): section is DecadesCollectionSlot {
	return "type" in section && section.type === "decades-collection";
}

function createDefaultBlockTemplates(language: string, timezone: string): SectionTemplate[] {
	return [
		// 🌟 1. 顶部轮播卡片（普通列表），与 carouselSourceId 完全对应
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

		// 🌟 2. 你的六大追剧周更表（preset 严格使用 V1 标准的 "collection"）
		{
			id: "weekly_drama_collection",
			title: "国产追剧周更表",
			mediaType: "tv",
			preset: "collection",
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
			preset: "collection",
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
			preset: "collection",
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
			preset: "collection",
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
			preset: "collection",
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
			preset: "collection",
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

		// 🌟 3. 官方原生探索组件
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

		// 🌟 4. 你的自建大盘列表
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

// 🌟 导出自定义主页的构建逻辑
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
		version: HOME_CONFIG_VERSION, // 严格输出 1
		apiBaseUrl: options.apiBaseUrl,
		imageBaseUrl: options.imageBaseUrl,
		carouselSourceId: "tmdb-popular-tv-shows", // 与 blocks[0] 一致
		blocks,
	};
}

export const createHomeConfig = createDefaultHomeConfig;
export const createHomeConfigV2 = createDefaultHomeConfig;
export default createDefaultHomeConfig;

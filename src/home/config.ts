/// <reference types="@cloudflare/workers-types" />
import {
	COLLECTION_PRESET,
	type CollectionBlock,
	type TmdbListRoute,
} from "../blocks/types.js";
import type { HomeConfigV2Block, HomeConfigV2Options, HomeConfigV2 } from "./config-v2.js";

type Locale = "en" | "zh" | "zh-Hant" | "ja" | "es" | "ar";

const TITLE_TRANSLATIONS: Record<string, Record<Locale, string>> = {
	"home.continue_watching": { en: "Continue Watching", zh: "继续观看", "zh-Hant": "繼續觀看", ja: "続きを見る", es: "Continuar Viendo", ar: "متابعة المشاهدة" },
	"home.tmdb_popular_tv_shows": { en: "Today's Popular TV Shows", zh: "今日热门电视剧", "zh-Hant": "今日熱門電視劇", ja: "今日の人気テレビ番組", es: "Series de TV Populares de Hoy", ar: "مسلسلات شائعة" },
	"home.tmdb_popular_movies": { en: "Today's Popular Movies", zh: "今日热门电影", "zh-Hant": "今日熱門電影", ja: "今日の人気映画", es: "Películas Populares de Hoy", ar: "أفلام شائعة" },
	"home.popular_tv_shows": { en: "Popular Domestic Dramas", zh: "时下热门国产剧", "zh-Hant": "時下熱門國產劇", ja: "人気の中国ドラマ", es: "Dramas Chinos Populares", ar: "دراما صينية شائعة" },
	"home.popular_movies": { en: "Trending Movies", zh: "实时热门电影", "zh-Hant": "實時熱門電影", ja: "リアルタイム人気映画", es: "Películas en Tendencia", ar: "أفلام رائجة" },
	"home.tmdb_discover_genres": { en: "Browse By Category", zh: "按分类浏览", "zh-Hant": "按分類瀏覽", ja: "カテゴリで探す", es: "Explorar por Categoría", ar: "تصفح حسب الفئة" },
	"home.tmdb_discover_networks": { en: "Browse By Network", zh: "按平台浏览", "zh-Hant": "按平台瀏覽", ja: "配信服务で探す", es: "Explorar por Plataforma", ar: "حسب الشبكة" },
	"home.tmdb_discover_languages": { en: "Browse By Language", zh: "按语言浏览", "zh-Hant": "按語言瀏覽", ja: "言語で探す", es: "Explorar por Idioma", ar: "حسب اللغة" },
	"home.popular_domestic_anime": { en: "Popular Domestic Anime", zh: "热门国产动漫", "zh-Hant": "熱門國產動漫", ja: "人気の国内アニメ", es: "Anime Doméstico Popular", ar: "أنمي محلي" },
	"home.bangumi_popular_anime": { en: "Today's Popular Bangumi", zh: "今日热门番剧", "zh-Hant": "今日熱門番劇", ja: "今日の人気番組", es: "Bangumi Populares de Hoy", ar: "بانغومي شائع" },
	"home.popular_korean_tv_shows": { en: "Popular Korean Dramas", zh: "备受欢迎的韩剧推荐", "zh-Hant": "備受歡迎的韓劇推薦", ja: "人気の韓国ドラマ", es: "Dramas Coreanos Populares", ar: "دراما كورية شائعة" },
	"home.popular_japanese_tv_shows": { en: "Trending Japanese Dramas", zh: "细腻又治愈的高人气日剧", "zh-Hant": "細膩又治癒的高人氣日劇", ja: "最近人気の日本ドラマ", es: "Dramas Japoneses en Tendencia", ar: "دراما يابانية رائجة" },
	"home.popular_spanish_tv_shows": { en: "Trending Spanish-Language Series", zh: "时下流行的西语剧集", "zh-Hant": "時下流行的西語劇集", ja: "話題のスペイン语シリーズ", es: "Series en Español en Tendencia", ar: "مسلسلات إspania رائجة" },
	"home.popular_taiwanese_tv_shows": { en: "Popular Taiwanese Dramas", zh: "台剧当然也不能落下", "zh-Hant": "台劇當然也不能落下", ja: "人気の台湾ドラマ", es: "Dramas Taiwaneses Populares", ar: "دراما تايوانية شائعة" },
	"home.popular_taiwanese_movies": { en: "Popular Taiwanese Movies", zh: "台味浓浓的宝藏台片", "zh-Hant": "台味濃濃的寶藏台片", ja: "人気の台湾映画", es: "Películas Taiwanesas Populares", ar: "أفلام تايوانية شهيرة" },
	"home.popular_variety_shows": { en: "Today's Popular Variety Shows", zh: "实时热门综艺", "zh-Hant": "實時熱門綜藝", ja: "今日の人気バラエティ", es: "Programas de Variedades Populares de Hoy", ar: "برامج منوعة" },
	"home.tmdb_top_rated_movies": { en: "Top Rated Movies", zh: "高分电影", "zh-Hant": "高分電影", ja: "高評価映画", es: "Películas Mejor Valoradas", ar: "الأعلى تقييماً" },
	"home.tmdb_top_rated_tv_shows": { en: "Top Rated TV Shows", zh: "高分电视剧", "zh-Hant": "高分電視劇", ja: "高評価テレビ番組", es: "Series Mejor Valoradas", ar: "المسلسلات الأعلى تقييماً" },
	"home.tmdb_tv_netflix": { en: "Netflix Popular TV", zh: "Netflix 全球热播好剧", "zh-Hant": "Netflix 全球熱播好剧", ja: "Netflix 人気ドラマ", es: "Series Populares de Netflix", ar: "مسلسلات نتفليكس الشهيرة" },
	"home.variety_cn": { en: "Chinese Variety Shows", zh: "热门国产综艺", "zh-Hant": "熱門國產綜藝", ja: "人気の中国バラエティ", es: "Variedades Chinas Populares", ar: "برامج منوعة صينية" },
	"home.variety_kr": { en: "Korean Variety Shows", zh: "爆款韩国综艺", "zh-Hant": "爆款韓國綜藝", ja: "人気の韓国バラエティ", es: "Variedades Coreanas Populares", ar: "برامج منوعة كورية" },
	"home.variety_global": { en: "Global Streaming Variety Shows", zh: "全球流媒体新热综艺", "zh-Hant": "全球串流新熱綜藝", ja: "グローバルバラエティ", es: "Variedades Globales", ar: "برامج منوعة عالمية" },
	"home.tmdb_tv_hbo": { en: "HBO High-Rated TV Shows", zh: "HBO 高分神剧", "zh-Hant": "HBO 高分神劇", ja: "HBO 名作ドラマ", es: "Series de HBO", ar: "مسلسلات HBO" },
	"home.tmdb_tv_apple": { en: "Apple TV+ Originals", zh: "Apple TV+ 原创精品", "zh-Hant": "Apple TV+ 原創精品", ja: "Apple TV+ オリジナル", es: "Originales de Apple TV+", ar: "أعمال Apple TV+ الأصلية" },
	"home.trakt_movies": { en: "Trakt Blockbuster Movies", zh: "火爆全球欧美大片", "zh-Hant": "火爆全球歐美大片", ja: "大ヒット映画", es: "Películas Populares de Trakt", ar: "أفلام رائجة" },
	"home.trakt_shows": { en: "Trakt Popular TV Shows", zh: "时下热播欧美剧集", "zh-Hant": "時下熱播歐美劇集", ja: "海外人気ドラマ", es: "Series Populares de Trakt", ar: "مسلسلات رائجة" },
	"home.tmdb_anime_jp": { en: "Recent Popular Anime", zh: "近期热门日本动漫", "zh-Hant": "近期熱門日本動漫", ja: "最近人気の日本アニメ", es: "Anime Japonés Popular", ar: "أنمي ياباني شهير" },
	"home.imdb_top_anime": { en: "IMDb Top Anime", zh: "IMDb 史诗动漫神作", "zh-Hant": "IMDb 史詩動漫神作", ja: "IMDb 高評価アニメ", es: "Anime Mejor Valorado IMDb", ar: "أفضل أنمي حسب IMDb" },
	"home.prime_hot_anime": { en: "Prime Video Hot Anime", zh: "Prime Video 热门日漫", "zh-Hant": "Prime Video 熱門日漫", ja: "Prime Video 人気アニメ", es: "Anime Popular de Prime Video", ar: "أنمي برايم فيديو الشهير" },
	"home.filmarks_anime_movie": { en: "Filmarks Anime Movies", zh: "Filmarks 高分剧场版", "zh-Hant": "Filmarks 高分劇場版", ja: "Filmarks 高評価アニメ映画", es: "Películas de Anime Filmarks", ar: "أفلام أنمي Filmarks" },
	"home.netflix_hot_anime": { en: "Netflix Exclusive Anime", zh: "Netflix 独播霸榜日漫", "zh-Hant": "Netflix 獨播霸榜日漫", ja: "Netflix 人気アニメ", es: "Anime Exclusivo de Netflix", ar: "أنمي نتفليكس الحصري" },
	"home.tmdb_anime_top_ja": { en: "TMDB Top Rated Anime", zh: "TMDB 高分神作日漫", "zh-Hant": "TMDB 高分神作日漫", ja: "TMDB 高評価アニメ", es: "Anime Mejor Valorado TMDB", ar: "أفضل أنمي حسب TMDB" },
	"home.tmdb_anime_movie_ja": { en: "Acclaimed Anime Movies", zh: "备受好评的动画电影", "zh-Hant": "備受好評的動畫電影", ja: "名作アニメ映画", es: "Películas de Anime Aclamadas", ar: "أفلام أنمي مميزة" },
	"home.tmdb_movie_sea": { en: "Southeast Asian Passion Movies", zh: "荷尔模超标的东南亚", "zh-Hant": "荷爾蒙超標的東南亞", ja: "東南アジア映画", es: "Películas del Sudeste Asiático", ar: "أفلام جنوب شرق آسيا" },
	"home.tmdb_movie_hk_erotic_comedy": { en: "Hong Kong Classic Comedies", zh: "港产经典风月喜剧", "zh-Hant": "港產經典風月喜劇", ja: "香港クラシックコメディ", es: "Comedias Clásicas de Hong Kong", ar: "كوميديا هونغ كونغ الكلاسيكية" },
	"home.tmdb_tv_th": { en: "Popular Thai Dramas", zh: "狗血上头的爆款泰剧", "zh-Hant": "狗血上頭的爆款泰劇", ja: "人気のタイドラマ", es: "Dramas Tailandeses Populares", ar: "مسلسلات تايلاندية شهيرة" },
	"home.tmdb_movie_th": { en: "Thai Movies Selection", zh: "不止鬼片的泰国电影", "zh-Hant": "不止鬼片的泰國電影", ja: "タイ映画コレクション", es: "Películas Tailandesas", ar: "أفلام تايلاندية" },
	"home.tmdb_tv_bl": { en: "Ultimate Asian BL Dramas", zh: "暧昧拉扯到极致的亚洲耽美神作", "zh-Hant": "曖昧拉扯到極致的亞洲耽美神作", ja: "アジアのBLドラマ名作", es: "Dramas BL Asiáticos", ar: "دراما آسيوية مميزة" },
	"home.netflix_minor_tv_shows": { en: "Netflix Minor Language Shows", zh: "Netflix 小语种神剧", "zh-Hant": "Netflix 小語種神劇", ja: "Netflix マイナー言語ドラマ", es: "Series de Netflix en Otros Idiomas", ar: "مسلسلات نتفليكس بلغات أخرى" },
	"home.netflix_minor_movies": { en: "Hidden Gem Minor Language Movies", zh: "冷门却惊艳的小语种电影", "zh-Hant": "冷門卻驚豔的小語種电影", ja: "隠れた名作外国映画", es: "Películas Sorprendentes en Otros Idiomas", ar: "أفلام بلغات أخرى" }
};

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

// 🌟 你的 43 个自建分类完整定义
function getCustomBlocks(language: string): any[] {
	return [
		// 1. 六大追剧周更表
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
				source: { path: `https://r2.eplayerx.cc.cd/weekly_drama_collection-${d}.json`, itemEnvelope: "data" }
			}))
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
				source: { path: `https://r2.eplayerx.cc.cd/weekly_guoman_collection-${d}.json`, itemEnvelope: "data" }
			}))
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
				source: { path: `https://r2.eplayerx.cc.cd/weekly_anime_collection-${d}.json`, itemEnvelope: "data" }
			}))
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
				source: { path: `https://r2.eplayerx.cc.cd/weekly_korean_drama_collection-${d}.json`, itemEnvelope: "data" }
			}))
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
				source: { path: `https://r2.eplayerx.cc.cd/weekly_japanese_drama_collection-${d}.json`, itemEnvelope: "data" }
			}))
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
				source: { path: `https://r2.eplayerx.cc.cd/weekly_sea_drama_collection-${d}.json`, itemEnvelope: "data" }
			}))
		},

		// 2. 原生探索入口
		{
			id: "tmdb-discover-genres",
			titleKey: "home.tmdb_discover_genres",
			preset: "genres-list",
			source: { path: "/crawler/discover/genres", query: { language }, itemEnvelope: "data" },
		},
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

		// 3. 自建 R2 大盘分类
		{ id: "tmdb_popular_movies", mediaType: "movie", titleKey: "home.tmdb_popular_movies", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/tmdb-popular-movies.json?sort=year", itemEnvelope: "data" } },
		{ id: "tmdb_popular_tv", mediaType: "tv", titleKey: "home.tmdb_popular_tv_shows", preset: "hero-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/tmdb-popular-tv.json?sort=year", itemEnvelope: "data" } },
		{ id: "bangumi_airing", mediaType: "tv", titleKey: "home.bangumi_popular_anime", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/bangumi-airing.json?sort=year", itemEnvelope: "data" } },
		{ id: "douban_tv_custom", mediaType: "tv", titleKey: "home.popular_tv_shows", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/douban-tv-custom.json?sort=year", itemEnvelope: "data" } },
		{ id: "tmdb_tv_netflix", mediaType: "tv", titleKey: "home.tmdb_tv_netflix", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/tmdb-tv-netflix.json?sort=year", itemEnvelope: "data" } },
		{ id: "variety_cn", mediaType: "tv", titleKey: "home.variety_cn", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/variety-cn.json?sort=year", itemEnvelope: "data" } },
		{ id: "variety_kr", mediaType: "tv", titleKey: "home.variety_kr", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/variety-kr.json?sort=year", itemEnvelope: "data" } },
		{ id: "variety_global", mediaType: "tv", titleKey: "home.variety_global", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/variety-global.json?sort=year", itemEnvelope: "data" } },
		{ id: "tmdb_tv_hbo", mediaType: "tv", titleKey: "home.tmdb_tv_hbo", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/tmdb-tv-hbo.json?sort=year", itemEnvelope: "data" } },
		{ id: "tmdb_tv_apple", mediaType: "tv", titleKey: "home.tmdb_tv_apple", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/tmdb-tv-apple.json?sort=year", itemEnvelope: "data" } },
		{ id: "trakt_movies", mediaType: "movie", titleKey: "home.trakt_movies", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/trakt-movies.json?sort=year", itemEnvelope: "data" } },
		{ id: "tmdb_anime_cn", mediaType: "tv", titleKey: "home.popular_domestic_anime", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/tmdb-anime-cn.json?sort=year", itemEnvelope: "data" } },
		{ id: "trakt_shows", mediaType: "tv", titleKey: "home.trakt_shows", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/trakt-shows.json?sort=year", itemEnvelope: "data" } },
		{ id: "douban_movies", mediaType: "movie", titleKey: "home.popular_movies", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/douban-movies.json?sort=year", itemEnvelope: "data" } },
		{ id: "douban_korean_tv", mediaType: "tv", titleKey: "home.popular_korean_tv_shows", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/douban-korean-tv.json?sort=year", itemEnvelope: "data" } },
		{ id: "tmdb_tv_ja", mediaType: "tv", titleKey: "home.popular_japanese_tv_shows", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/tmdb-tv-ja.json?sort=year", itemEnvelope: "data" } },
		{ id: "tmdb_anime_jp", mediaType: "tv", titleKey: "home.tmdb_anime_jp", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/tmdb-anime-jp.json?sort=year", itemEnvelope: "data" } },
		{ id: "imdb_top_anime", mediaType: "tv", titleKey: "home.imdb_top_anime", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/imdb-top-anime.json?sort=year", itemEnvelope: "data" } },
		{ id: "prime_hot_anime", mediaType: "tv", titleKey: "home.prime_hot_anime", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/prime-hot-anime.json?sort=year", itemEnvelope: "data" } },
		{ id: "filmarks_anime_movie", mediaType: "movie", titleKey: "home.filmarks_anime_movie", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/filmarks-anime-movie.json?sort=year", itemEnvelope: "data" } },
		{ id: "netflix_hot_anime", mediaType: "tv", titleKey: "home.netflix_hot_anime", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/netflix-hot-anime.json?sort=year", itemEnvelope: "data" } },
		{ id: "tmdb_anime_top_ja", mediaType: "tv", titleKey: "home.tmdb_anime_top_ja", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/tmdb-anime-top-ja.json?sort=year", itemEnvelope: "data" } },
		{ id: "tmdb_anime_movie_ja", mediaType: "movie", titleKey: "home.tmdb_anime_movie_ja", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/tmdb-anime-movie-ja.json?sort=year", itemEnvelope: "data" } },
		{ id: "tmdb_tv_es", mediaType: "tv", titleKey: "home.popular_spanish_tv_shows", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/tmdb-tv-es.json?sort=year", itemEnvelope: "data" } },
		{ id: "tmdb_tv_tw", mediaType: "tv", titleKey: "home.popular_taiwanese_tv_shows", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/tmdb-tv-tw.json?sort=year", itemEnvelope: "data" } },
		{ id: "tmdb_movie_tw", mediaType: "movie", titleKey: "home.popular_taiwanese_movies", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/tmdb-movie-tw.json?sort=year", itemEnvelope: "data" } },
		{ id: "tmdb_movie_sea", mediaType: "movie", titleKey: "home.tmdb_movie_sea", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/tmdb-movie-sea.json?sort=year", itemEnvelope: "data" } },
		{ id: "tmdb_movie_hk_erotic_comedy", mediaType: "movie", titleKey: "home.tmdb_movie_hk_erotic_comedy", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/tmdb-movie-hk-erotic-comedy.json?sort=year", itemEnvelope: "data" } },
		{ id: "tmdb_tv_th", mediaType: "tv", titleKey: "home.tmdb_tv_th", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/tmdb-tv-th.json?sort=year", itemEnvelope: "data" } },
		{ id: "tmdb_movie_th", mediaType: "movie", titleKey: "home.tmdb_movie_th", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/tmdb-movie-th.json?sort=year", itemEnvelope: "data" } },
		{ id: "tmdb_tv_bl", mediaType: "tv", titleKey: "home.tmdb_tv_bl", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/tmdb-tv-bl.json?sort=year", itemEnvelope: "data" } },
		{ id: "netflix_tv_minor", mediaType: "tv", titleKey: "home.netflix_minor_tv_shows", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/netflix-tv-minor.json?sort=year", itemEnvelope: "data" } },
		{ id: "netflix_movie_minor", mediaType: "movie", titleKey: "home.netflix_minor_movies", preset: "poster-list", showRank: true, showOverview: false, sort: "year", source: { path: "https://r2.eplayerx.cc.cd/netflix-movie-minor.json?sort=year", itemEnvelope: "data" } }
	];
}

export async function createDefaultHomeConfig(options: HomeConfigV2Options): Promise<HomeConfigV2> {
	const rawBlocks = getCustomBlocks(options.language);
	const blocks: HomeConfigV2Block[] = rawBlocks.map(block => {
		if (block.preset === "collection") {
			return block as CollectionBlock;
		}
		const title = block.title || (block.titleKey ? resolveTitle(block.titleKey, options.language) : "");
		return {
			...block,
			title,
		};
	});

	return {
		version: 2, // 必须为 2，保证客户端按新版渲染周更表合集
		apiBaseUrl: options.apiBaseUrl,
		imageBaseUrl: options.imageBaseUrl,
		carouselSourceId: "tmdb_popular_movies",
		blocks,
	};
}

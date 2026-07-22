import type { TmdbListRoute } from "../blocks/types.js";

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
  | "home.tmdb_discover_genres"
  | "home.tmdb_discover_languages"
  | "home.tmdb_discover_networks"
  | "home.tmdb_top_rated_movies"
  | "home.tmdb_top_rated_tv_shows";

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

interface HomeBlock {
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

type TmdbListRouteParams = TmdbListRoute["params"];

type HomeBlockTemplate = Omit<HomeBlock, "title"> & {
  titleKey?: HomeTitleKey;
};

export interface DefaultHomeConfigOptions {
  apiBaseUrl: string;
  imageBaseUrl: string;
  language: string;
  timezone: string;
}

export interface DefaultHomeConfig {
  version: number;
  apiBaseUrl: string;
  imageBaseUrl: string;
  carouselSourceId: string;
  blocks: HomeBlock[];
}

export const HOME_CONFIG_VERSION = 1;

const TITLE_TRANSLATIONS: Record<HomeTitleKey, Record<Locale, string>> = {
  "home.continue_watching": {
    en: "Continue Watching",
    zh: "继续观看",
    "zh-Hant": "繼續觀看",
    ja: "続きを視聴",
    es: "Continuar Viendo",
    ar: "متابعة المشاهدة",
  },
  "home.tmdb_popular_tv_shows": {
    en: "Today's Popular TV Shows",
    zh: "今日热门电视剧",
    "zh-Hant": "今日熱門電視劇",
    ja: "今日の人気テレビ番組",
    es: "Series de TV Populares de Hoy",
    ar: "مسلسلات شائعة",
  },
  "home.tmdb_popular_movies": {
    en: "Today's Popular Movies",
    zh: "今日热门电影",
    "zh-Hant": "今日熱門電影",
    ja: "今日の人気映画",
    es: "Películas Populares de Hoy",
    ar: "أفلام شائعة",
  },
  "home.popular_domestic_anime": {
    en: "Popular Domestic Anime",
    zh: "热门国产动漫",
    "zh-Hant": "熱門國產動漫",
    ja: "人気の国内アニメ",
    es: "Anime Doméstico Popular",
    ar: "أنمي محلي",
  },
  "home.bangumi_popular_anime": {
    en: "Today's Popular Bangumi",
    zh: "今日热门番剧",
    "zh-Hant": "今日熱門番劇",
    ja: "今日の人気番組",
    es: "Bangumi Populares de Hoy",
    ar: "بانغومي شائع",
  },
  "home.tmdb_on_the_air_tv_shows": {
    en: "On The Air TV Shows",
    zh: "正在热播",
    "zh-Hant": "正在熱播",
    ja: "放送中",
    es: "En Emisión",
    ar: "يعرض الآن",
  },
  "home.popular_tv_shows": {
    en: "Trending Domestic Dramas",
    zh: "时下最热门的国产剧",
    "zh-Hant": "時下最熱門的國產劇",
    ja: "話題の中国ドラマ",
    es: "Dramas Chinos en Tendencia",
    ar: "دراما صينية رائجة",
  },
  "home.popular_movies": {
    en: "Trending Movies",
    zh: "实时热门电影",
    "zh-Hant": "實時熱門電影",
    ja: "リアルタイム人気映画",
    es: "Películas en Tendencia",
    ar: "أفلام رائجة",
  },
  "home.popular_variety_shows": {
    en: "Today's Popular Variety Shows",
    zh: "实时热门综艺",
    "zh-Hant": "實時熱門綜藝",
    ja: "今日の人気バラエティ",
    es: "Programas de Variedades Populares de Hoy",
    ar: "برامج منوعة",
  },
  "home.popular_korean_tv_shows": {
    en: "Popular Korean Dramas",
    zh: "备受欢迎的韩剧推荐",
    "zh-Hant": "備受歡迎的韓劇推薦",
    ja: "人気の韓国ドラマ",
    es: "Dramas Coreanos Populares",
    ar: "دراما كورية شائعة",
  },
  "home.popular_japanese_tv_shows": {
    en: "Trending Japanese Dramas",
    zh: "近期最流行日剧榜单",
    "zh-Hant": "近期最流行日劇榜單",
    ja: "最近人気の日本ドラマ",
    es: "Dramas Japoneses en Tendencia",
    ar: "دراما يابانية رائجة",
  },
  "home.popular_spanish_tv_shows": {
    en: "Trending Spanish-Language Series",
    zh: "时下流行的西语剧集",
    "zh-Hant": "時下流行的西語劇集",
    ja: "話題のスペイン語シリーズ",
    es: "Series en Español en Tendencia",
    ar: "مسلسلات إسبانية رائجة",
  },
  "home.popular_taiwanese_tv_shows": {
    en: "Popular Taiwanese Dramas",
    zh: "台剧当然也不能落下",
    "zh-Hant": "台劇當然也不能落下",
    ja: "人気の台湾ドラマ",
    es: "Dramas Taiwaneses Populares",
    ar: "دراما تايوانية شائعة",
  },
  "home.tmdb_discover_genres": {
    en: "Browse By Category",
    zh: "按分类浏览",
    "zh-Hant": "按分類瀏覽",
    ja: "カテゴリで探す",
    es: "Explorar por Categoría",
    ar: "تصفح حسب الفئة",
  },
  "home.tmdb_discover_languages": {
    en: "Browse By Language",
    zh: "按语言浏览",
    "zh-Hant": "按語言瀏覽",
    ja: "言語で探す",
    es: "Explorar por Idioma",
    ar: "حسب اللغة",
  },
  "home.tmdb_discover_networks": {
    en: "Browse By Network",
    zh: "按平台浏览",
    "zh-Hant": "按平台瀏覽",
    ja: "配信サービスで探す",
    es: "Explorar por Plataforma",
    ar: "حسب الشبكة",
  },
  "home.tmdb_top_rated_movies": {
    en: "Top Rated Movies",
    zh: "高分电影",
    "zh-Hant": "高分電影",
    ja: "高評価映画",
    es: "Películas Mejor Valoradas",
    ar: "الأعلى تقييماً",
  },
  "home.tmdb_top_rated_tv_shows": {
    en: "Top Rated TV Shows",
    zh: "高分电视剧",
    "zh-Hant": "高分電視劇",
    ja: "高評価テレビ番組",
    es: "Series Mejor Valoradas",
    ar: "المسلسلات الأعلى تقييماً",
  },
};

const TMDB_LIST_ROUTE_PARAMS: Partial<Record<string, TmdbListRouteParams>> = {
  "tmdb-popular-tv-shows": {
    category: "trending",
    type: "tv",
  },
  "tmdb-popular-movies": {
    category: "trending",
    type: "movie",
  },
  "tmdb-top-rated-movies": {
    category: "top-rated",
    type: "movie",
  },
  "tmdb-top-rated-tv-shows": {
    category: "top-rated",
    type: "tv",
  },
  "tmdb-popular-taiwanese-tv-shows": {
    category: "discover",
    type: "tv",
    originCountry: "TW",
  },
};

function resolveLocale(language: string): Locale {
  const normalized = language.toLowerCase();
  if (
    normalized.startsWith("zh-hant") ||
    normalized.includes("tw") ||
    normalized.includes("hk")
  ) {
    return "zh-Hant";
  }
  if (normalized.startsWith("zh")) return "zh";
  if (normalized.startsWith("ja")) return "ja";
  if (normalized.startsWith("es")) return "es";
  if (normalized.startsWith("ar")) return "ar";
  return "en";
}

function resolveTitle(titleKey: HomeTitleKey, language: string): string {
  return TITLE_TRANSLATIONS[titleKey][resolveLocale(language)];
}

function createTmdbListRoute(
  title: string,
  params: TmdbListRouteParams
): TmdbListRoute {
  return {
    type: "tmdb-list",
    title,
    params,
  };
}

function createDefaultBlockTemplates(
  language: string,
  timezone: string
): HomeBlockTemplate[] {
  return [
    
    {
      id: "tmdb_popular_movies",
      mediaType: "movie",
      titleKey: "home.tmdb_popular_movies",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/tmdb_popular_movies?sort=year", itemEnvelope: "data" }
    },
    {
      id: "tmdb_popular_tv",
      mediaType: "tv",
      titleKey: "home.tmdb_popular_tv_shows",
      preset: "hero-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/tmdb_popular_tv?sort=year", itemEnvelope: "data" }
    },
    {
      id: "bangumi_airing",
      mediaType: "tv",
      titleKey: "home.bangumi_popular_anime",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/bangumi_airing?sort=year", itemEnvelope: "data" }
    },
    {
      id: "douban_tv",
      mediaType: "tv",
      titleKey: "home.popular_tv_shows",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/douban_tv?sort=year", itemEnvelope: "data" }
    },
    {
      id: "tmdb_tv_netflix",
      mediaType: "tv",
      titleKey: "home.tmdb_tv_netflix",
      preset: "poster-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/tmdb_tv_netflix?sort=year", itemEnvelope: "data" }
    },
    {
      id: "variety_cn",
      mediaType: "tv",
      titleKey: "home.variety_cn",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/variety_cn?sort=year", itemEnvelope: "data" }
    },
    {
      id: "variety_kr",
      mediaType: "tv",
      titleKey: "home.variety_kr",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/variety_kr?sort=year", itemEnvelope: "data" }
    },
    {
      id: "variety_global",
      mediaType: "tv",
      titleKey: "home.variety_global",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/variety_global?sort=year", itemEnvelope: "data" }
    },
    {
      id: "tmdb_tv_hbo",
      mediaType: "tv",
      titleKey: "home.tmdb_tv_hbo",
      preset: "poster-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/tmdb_tv_hbo?sort=year", itemEnvelope: "data" }
    },
    {
      id: "tmdb_tv_apple",
      mediaType: "tv",
      titleKey: "home.tmdb_tv_apple",
      preset: "poster-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/tmdb_tv_apple?sort=year", itemEnvelope: "data" }
    },
    {
      id: "trakt_movies",
      mediaType: "movie",
      titleKey: "home.trakt_movies",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/trakt_movies?sort=year", itemEnvelope: "data" }
    },
    {
      id: "tmdb_anime_cn",
      mediaType: "tv",
      titleKey: "home.popular_domestic_anime",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/tmdb_anime_cn?sort=year", itemEnvelope: "data" }
    },
    {
      id: "trakt_shows",
      mediaType: "tv",
      titleKey: "home.trakt_shows",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/trakt_shows?sort=year", itemEnvelope: "data" }
    },
    {
      id: "douban_movies",
      mediaType: "movie",
      titleKey: "home.popular_movies",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/douban_movies?sort=year", itemEnvelope: "data" }
    },
    {
      id: "douban_korean_tv",
      mediaType: "tv",
      titleKey: "home.popular_korean_tv_shows",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/douban_korean_tv?sort=year", itemEnvelope: "data" }
    },
    {
      id: "tmdb_tv_ja",
      mediaType: "tv",
      titleKey: "home.popular_japanese_tv_shows",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/tmdb_tv_ja?sort=year", itemEnvelope: "data" }
    },
    {
      id: "tmdb_anime_jp",
      mediaType: "tv",
      titleKey: "home.tmdb_anime_jp",
      preset: "poster-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/tmdb_anime_jp?sort=year", itemEnvelope: "data" }
    },
    {
      id: "imdb_top_anime",
      mediaType: "tv",
      titleKey: "home.imdb_top_anime",
      preset: "poster-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/imdb_top_anime?sort=year", itemEnvelope: "data" }
    },
    {
      id: "prime_hot_anime",
      mediaType: "tv",
      titleKey: "home.prime_hot_anime",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/prime_hot_anime?sort=year", itemEnvelope: "data" }
    },
    {
      id: "filmarks_anime_movie",
      mediaType: "movie",
      titleKey: "home.filmarks_anime_movie",
      preset: "poster-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/filmarks_anime_movie?sort=year", itemEnvelope: "data" }
    },
    {
      id: "netflix_hot_anime",
      mediaType: "tv",
      titleKey: "home.netflix_hot_anime",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/netflix_hot_anime?sort=year", itemEnvelope: "data" }
    },
    {
      id: "tmdb_anime_top_ja",
      mediaType: "tv",
      titleKey: "home.tmdb_anime_top_ja",
      preset: "poster-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/tmdb_anime_top_ja?sort=year", itemEnvelope: "data" }
    },
    {
      id: "tmdb_anime_movie_ja",
      mediaType: "movie",
      titleKey: "home.tmdb_anime_movie_ja",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/tmdb_anime_movie_ja?sort=year", itemEnvelope: "data" }
    },
    {
      id: "tmdb_tv_es",
      mediaType: "tv",
      titleKey: "home.popular_spanish_tv_shows",
      preset: "poster-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/tmdb_tv_es?sort=year", itemEnvelope: "data" }
    },
    {
      id: "tmdb_tv_tw",
      mediaType: "tv",
      titleKey: "home.popular_taiwanese_tv_shows",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/tmdb_tv_tw?sort=year", itemEnvelope: "data" }
    },
    {
      id: "tmdb_movie_tw",
      mediaType: "movie",
      titleKey: "home.popular_taiwanese_movies",
      preset: "poster-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/tmdb_movie_tw?sort=year", itemEnvelope: "data" }
    },
    {
      id: "tmdb_movie_sea",
      mediaType: "movie",
      titleKey: "home.tmdb_movie_sea",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/tmdb_movie_sea?sort=year", itemEnvelope: "data" }
    },
    {
      id: "tmdb_movie_hk_erotic_comedy",
      mediaType: "movie",
      titleKey: "home.tmdb_movie_hk_erotic_comedy",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/tmdb_movie_hk_erotic_comedy?sort=year", itemEnvelope: "data" }
    },
    {
      id: "tmdb_tv_th",
      mediaType: "tv",
      titleKey: "home.tmdb_tv_th",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/tmdb_tv_th?sort=year", itemEnvelope: "data" }
    },
    {
      id: "tmdb_movie_th",
      mediaType: "movie",
      titleKey: "home.tmdb_movie_th",
      preset: "poster-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/tmdb_movie_th?sort=year", itemEnvelope: "data" }
    },
    {
      id: "tmdb_tv_bl",
      mediaType: "tv",
      titleKey: "home.tmdb_tv_bl",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/tmdb_tv_bl?sort=year", itemEnvelope: "data" }
    },
    {
      id: "netflix_tv_minor",
      mediaType: "tv",
      titleKey: "home.netflix_minor_tv_shows",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/netflix_tv_minor?sort=year", itemEnvelope: "data" }
    },
    {
      id: "netflix_movie_minor",
      mediaType: "movie",
      titleKey: "home.netflix_minor_movies",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://homepage.eplayerx.cc.cd/api/netflix_movie_minor?sort=year", itemEnvelope: "data" }
    },
    {
      id: "weekly_anime_collection",
      mediaType: "tv",
      titleKey: "home.weekly_anime",
      preset: "collection-list",
      groupMode: "weekday",
      children: [
        { id: "weekly_anime_collection-1", label: "周一", weekday: 1, title: "周一", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_anime_collection-1.json", itemEnvelope: "data" } },
        { id: "weekly_anime_collection-2", label: "周二", weekday: 2, title: "周二", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_anime_collection-2.json", itemEnvelope: "data" } },
        { id: "weekly_anime_collection-3", label: "周三", weekday: 3, title: "周三", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_anime_collection-3.json", itemEnvelope: "data" } },
        { id: "weekly_anime_collection-4", label: "周四", weekday: 4, title: "周四", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_anime_collection-4.json", itemEnvelope: "data" } },
        { id: "weekly_anime_collection-5", label: "周五", weekday: 5, title: "周五", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_anime_collection-5.json", itemEnvelope: "data" } },
        { id: "weekly_anime_collection-6", label: "周六", weekday: 6, title: "周六", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_anime_collection-6.json", itemEnvelope: "data" } },
        { id: "weekly_anime_collection-7", label: "周日", weekday: 7, title: "周日", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_anime_collection-7.json", itemEnvelope: "data" } }
      ]
    },
    {
      id: "weekly_drama_collection",
      mediaType: "tv",
      titleKey: "home.weekly_drama",
      preset: "collection-list",
      groupMode: "weekday",
      children: [
        { id: "weekly_drama_collection-1", label: "周一", weekday: 1, title: "周一", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_drama_collection-1.json", itemEnvelope: "data" } },
        { id: "weekly_drama_collection-2", label: "周二", weekday: 2, title: "周二", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_drama_collection-2.json", itemEnvelope: "data" } },
        { id: "weekly_drama_collection-3", label: "周三", weekday: 3, title: "周三", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_drama_collection-3.json", itemEnvelope: "data" } },
        { id: "weekly_drama_collection-4", label: "周四", weekday: 4, title: "周四", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_drama_collection-4.json", itemEnvelope: "data" } },
        { id: "weekly_drama_collection-5", label: "周五", weekday: 5, title: "周五", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_drama_collection-5.json", itemEnvelope: "data" } },
        { id: "weekly_drama_collection-6", label: "周六", weekday: 6, title: "周六", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_drama_collection-6.json", itemEnvelope: "data" } },
        { id: "weekly_drama_collection-7", label: "周日", weekday: 7, title: "周日", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_drama_collection-7.json", itemEnvelope: "data" } }
      ]
    },
    {
      id: "weekly_guoman_collection",
      mediaType: "tv",
      titleKey: "home.weekly_guoman",
      preset: "collection-list",
      groupMode: "weekday",
      children: [
        { id: "weekly_guoman_collection-1", label: "周一", weekday: 1, title: "周一", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_guoman_collection-1.json", itemEnvelope: "data" } },
        { id: "weekly_guoman_collection-2", label: "周二", weekday: 2, title: "周二", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_guoman_collection-2.json", itemEnvelope: "data" } },
        { id: "weekly_guoman_collection-3", label: "周三", weekday: 3, title: "周三", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_guoman_collection-3.json", itemEnvelope: "data" } },
        { id: "weekly_guoman_collection-4", label: "周四", weekday: 4, title: "周四", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_guoman_collection-4.json", itemEnvelope: "data" } },
        { id: "weekly_guoman_collection-5", label: "周五", weekday: 5, title: "周五", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_guoman_collection-5.json", itemEnvelope: "data" } },
        { id: "weekly_guoman_collection-6", label: "周六", weekday: 6, title: "周六", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_guoman_collection-6.json", itemEnvelope: "data" } },
        { id: "weekly_guoman_collection-7", label: "周日", weekday: 7, title: "周日", mediaType: "tv", preset: "thumb-list", source: { path: "https://homepage.eplayerx.cc.cd/blocks/public/weekly_guoman_collection-7.json", itemEnvelope: "data" } }
      ]
    }

  ];
}

function resolveBlockTitle(
  block: HomeBlockTemplate,
  language: string
): HomeBlock {
  const { titleKey, ...rest } = block;
  if (!titleKey) return rest;
  const title = resolveTitle(titleKey, language);
  const routeParams = TMDB_LIST_ROUTE_PARAMS[rest.id];

  return {
    ...rest,
    title,
    ...(routeParams ? { route: createTmdbListRoute(title, routeParams) } : {}),
  };
}

export function createDefaultHomeConfig(
  options: DefaultHomeConfigOptions
): DefaultHomeConfig {
  return {
    version: HOME_CONFIG_VERSION,
    apiBaseUrl: options.apiBaseUrl,
    imageBaseUrl: options.imageBaseUrl,
    carouselSourceId: "tmdb-popular-tv-shows",
    blocks: createDefaultBlockTemplates(options.language, options.timezone).map(
      (block) => resolveBlockTitle(block, options.language)
    ),
  };
}

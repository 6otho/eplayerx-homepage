type Locale = "en" | "zh" | "zh-Hant" | "ja" | "es" | "ar";
type HomeTitleKey = "home.continue_watching" | "home.tmdb_popular_tv_shows" | "home.tmdb_popular_movies" | "home.tmdb_on_the_air_tv_shows" | "home.tmdb_discover_genres" | "home.tmdb_discover_languages" | "home.tmdb_discover_networks" | "home.tmdb_top_rated_movies" | "home.tmdb_top_rated_tv_shows"
  | "home.bangumi_popular_anime"
  | "home.imdb_top_anime"
  | "home.prime_hot_anime"
  | "home.filmarks_anime_movie"
  | "home.netflix_hot_anime"
  | "home.tmdb_anime_top_ja"
  | "home.tmdb_anime_jp"
  | "home.tmdb_anime_movie_ja"
  | "home.popular_domestic_anime"
  | "home.tmdb_tv_netflix"
  | "home.tmdb_tv_hbo"
  | "home.tmdb_tv_apple"
  | "home.trakt_movies"
  | "home.trakt_shows"
  | "home.popular_movies"
  | "home.popular_tv_shows"
  | "home.variety_cn"
  | "home.variety_kr"
  | "home.variety_global"
  | "home.popular_korean_tv_shows"
  | "home.popular_japanese_tv_shows"
  | "home.popular_taiwanese_tv_shows"
  | "home.popular_taiwanese_movies"
  | "home.tmdb_tv_th"
  | "home.tmdb_movie_th"
  | "home.tmdb_movie_sea"
  | "home.popular_spanish_tv_shows"
  | "home.netflix_minor_tv_shows"
  | "home.netflix_minor_movies"
  | "home.tmdb_tv_bl";
type SourceQueryValue = string | number | boolean; interface HomePagination { pageParam: string; startPage: number; }
type TmdbListRoute = { type: "tmdb-list"; title: string; params: { category: "trending" | "top-rated" | "discover"; type: "movie" | "tv"; genre?: string; language?: string; network?: string; networkName?: string; }; };
type TmdbListRouteParams = TmdbListRoute["params"];
interface HomeBlockSource { id?: string; path?: string; query?: Record<string, SourceQueryValue>; itemEnvelope?: "data" | "results" | "array"; pagination?: HomePagination; }
interface HomeBlock { id: string; title?: string; mediaType?: "movie" | "tv"; preset: string; sort?: string; showRank?: boolean; showOverview?: boolean; source?: HomeBlockSource; metadata?: { isAnime?: boolean; }; route?: TmdbListRoute; }
type HomeBlockTemplate = Omit<HomeBlock, "title"> & { titleKey?: HomeTitleKey; };
export interface DefaultHomeConfigOptions { apiBaseUrl: string; imageBaseUrl: string; language: string; timezone: string; }
export interface DefaultHomeConfig { version: number; apiBaseUrl: string; imageBaseUrl: string; carouselSourceId: string; blocks: HomeBlock[]; }
export const HOME_CONFIG_VERSION = 1;
const TITLE_TRANSLATIONS: Record<HomeTitleKey, Record<Locale, string>> = {
  "home.continue_watching": { en: "Continue Watching", zh: "继续观看", "zh-Hant": "繼續觀看", ja: "続きを視聴", es: "Continuar Viendo", ar: "متابعة المشاهدة" },
  "home.tmdb_popular_tv_shows": { en: "Today's Popular TV Shows", zh: "今日热门电视剧", "zh-Hant": "今日熱門電視劇", ja: "今日の人気テレビ番組", es: "Series de TV Populares de Hoy", ar: "مسلسلات شائعة" },
  "home.tmdb_popular_movies": { en: "Today's Popular Movies", zh: "今日热门电影", "zh-Hant": "今日熱門电影", ja: "今日の人気映画", es: "Películas Populares de Hoy", ar: "أفلام شائعة" },
  "home.tmdb_on_the_air_tv_shows": { en: "On The Air TV Shows", zh: "正在热播", "zh-Hant": "正在熱播", ja: "放送中", es: "En Emisión", ar: "يعرض الآن" },
  "home.tmdb_discover_genres": { en: "Browse By Category", zh: "按分类浏览", "zh-Hant": "按分類瀏覽", ja: "カテゴリで探す", es: "Explorar por Categoría", ar: "تصفح حسب الفئة" },
  "home.tmdb_discover_languages": { en: "Browse By Language", zh: "按语言浏览", "zh-Hant": "按語言瀏覽", ja: "言語で探す", es: "Explorar por Idioma", ar: "حسب اللغة" },
  "home.tmdb_discover_networks": { en: "Browse By Network", zh: "按平台浏览", "zh-Hant": "按平台瀏覽", ja: "配信サービスで探す", es: "Explorar por Plataforma", ar: "حسب الشبكة" },
  "home.tmdb_top_rated_movies": { en: "Top Rated Movies", zh: "高分电影", "zh-Hant": "高分電影", ja: "高評価映画", es: "Películas Mejor Valoradas", ar: "الأعلى تقييماً" },
  "home.tmdb_top_rated_tv_shows": { en: "Top Rated TV Shows", zh: "高分电视剧", "zh-Hant": "高分電視劇", ja: "高評価テレビ番組", es: "Series Mejor Valoradas", ar: "المسلسلات الأعلى تقييماً" },
  "home.bangumi_popular_anime": { en: "Today's Popular Bangumi", zh: "今日热门番剧", "zh-Hant": "今日熱門番劇", ja: "今日の人気番組", es: "Bangumi Populares de Hoy", ar: "بانغومي شائع" },
  "home.imdb_top_anime": { en: "IMDb Epic Anime Masterpieces", zh: "IMDb 史诗动漫神作", "zh-Hant": "IMDb 史詩動漫神作", ja: "IMDb 傑作アニメ", es: "Obras Maestras de Anime en IMDb", ar: "أفضل أنمي على IMDb" },
  "home.prime_hot_anime": { en: "Trending on Prime Video", zh: "Prime Video 热门日漫", "zh-Hant": "Prime Video 熱門日漫", ja: "Prime Video 人気アニメ", es: "En Tendencia en Prime Video", ar: "رائج على برايم فيديو" },
  "home.filmarks_anime_movie": { en: "Highly Rated Anime Movies", zh: "Filmarks 高分剧场版", "zh-Hant": "Filmarks 高分劇場版", ja: "Filmarks 高評価アニメ映画", es: "Películas de Anime Mejor Valoradas", ar: "أفلام أنمي عالية التقييم" },
  "home.netflix_hot_anime": { en: "Netflix Trending Anime", zh: "Netflix 独播霸榜日漫", "zh-Hant": "Netflix 獨播霸榜日漫", ja: "Netflix 話題のアニメ", es: "Anime en Tendencia de Netflix", ar: "أنمي نتفليكس الرائج" },
  "home.tmdb_anime_top_ja": { en: "Top Rated Japanese Anime", zh: "TMDB 高分神作日漫", "zh-Hant": "TMDB 高分神作日漫", ja: "TMDB 高評価日本アニメ", es: "Anime Japonés Mejor Valorado", ar: "أنمي ياباني عالي التقييم" },
  "home.tmdb_anime_jp": { en: "Trending Japanese Anime", zh: "近期热门日本动漫", "zh-Hant": "近期熱門日本動漫", ja: "話題の日本アニメ", es: "Anime Japonés en Tendencia", ar: "أنمي ياباني رائج" },
  "home.tmdb_anime_movie_ja": { en: "Acclaimed Anime Movies", zh: "备受好评的动画电影", "zh-Hant": "備受好評的動畫電影", ja: "好評のアニメ映画", es: "Películas de Anime Aclamadas", ar: "أفلام أنمي مشهورة" },
  "home.popular_domestic_anime": { en: "Popular Domestic Anime", zh: "热门国产动漫", "zh-Hant": "熱門國產動漫", ja: "人気の国内アニメ", es: "Anime Doméstico Popular", ar: "أنمي محلي" },
  "home.tmdb_tv_netflix": { en: "Netflix Global Hits", zh: "Netflix 全球热播好剧", "zh-Hant": "Netflix 全球熱播好劇", ja: "Netflix グローバルヒット", es: "Éxitos Globales de Netflix", ar: "مسلسلات نتفليكس العالمية" },
  "home.tmdb_tv_hbo": { en: "HBO Masterpieces", zh: "HBO 高分神剧", "zh-Hant": "HBO 高分神劇", ja: "HBO 傑作ドラマ", es: "Obras Maestras de HBO", ar: "روائع HBO" },
  "home.tmdb_tv_apple": { en: "Apple TV+ Originals", zh: "Apple TV+ 原创精品", "zh-Hant": "Apple TV+ 原創精品", ja: "Apple TV+ オリジナル", es: "Originales de Apple TV+", ar: "أعمال Apple TV+ الأصلية" },
  "home.trakt_movies": { en: "Global Blockbusters", zh: "火爆全球欧美大片", "zh-Hant": "火爆全球歐美大片", ja: "世界の大ヒット映画", es: "Éxitos de Taquilla Globales", ar: "أفلام عالمية ضخمة" },
  "home.trakt_shows": { en: "Trending Western Series", zh: "时下热播欧美剧集", "zh-Hant": "時下熱播歐美劇集", ja: "話題の欧米ドラマ", es: "Series Occidentales en Tendencia", ar: "مسلسلات غربية رائجة" },
  "home.popular_movies": { en: "Trending Movies", zh: "实时热门电影", "zh-Hant": "實時熱門電影", ja: "リアルタイム人気映画", es: "Películas en Tendencia", ar: "أفلام رائجة" },
  "home.popular_tv_shows": { en: "Trending Domestic Dramas", zh: "时下最热门的国产剧", "zh-Hant": "時下最熱門的國產劇", ja: "話題の中国ドラマ", es: "Dramas Chinos en Tendencia", ar: "دراما صينية رائجة" },
  "home.variety_cn": { en: "Popular Chinese Variety Shows", zh: "热门国产综艺", "zh-Hant": "熱門國產綜藝", ja: "人気の中国バラエティ", es: "Variedades Chinas", ar: "برامج منوعة صينية" },
  "home.variety_kr": { en: "Trending Korean Variety Shows", zh: "爆款韩国综艺", "zh-Hant": "爆款韓國綜藝", ja: "人気の韓国バラエティ", es: "Variedades Coreanas", ar: "برامج منوعة كورية" },
  "home.variety_global": { en: "Global Hit Variety Shows", zh: "全球流媒体新热综艺", "zh-Hant": "全球流媒體新熱綜藝", ja: "世界の人気バラエティ", es: "Variedades Globales", ar: "برامج منوعة عالمية" },
  "home.popular_korean_tv_shows": { en: "Popular Korean Dramas", zh: "备受欢迎的韩剧推荐", "zh-Hant": "備受歡迎的韓劇推薦", ja: "人気の韓国ドラマ", es: "Dramas Coreanos Populares", ar: "دراما كورية شائعة" },
  "home.popular_japanese_tv_shows": { en: "Trending Japanese Dramas", zh: "细腻又治愈的高人气日剧", "zh-Hant": "細膩又治癒的高人氣日剧", ja: "話題の日本ドラマ", es: "Dramas Japoneses en Tendencia", ar: "دراما يابانية رائجة" },
  "home.popular_taiwanese_tv_shows": { en: "Popular Taiwanese Dramas", zh: "台剧当然也不能落下", "zh-Hant": "台劇當然也不能落下", ja: "人気の台湾ドラマ", es: "Dramas Taiwaneses Populares", ar: "دراما تايوانية شائعة" },
  "home.popular_taiwanese_movies": { en: "Popular Taiwanese Movies", zh: "台味浓浓的宝藏台片", "zh-Hant": "台味濃濃的寶藏台片", ja: "おすすめ台湾映画", es: "Películas Taiwanesas Populares", ar: "أفلام تايوانية شائعة" },
  "home.tmdb_tv_th": { en: "Popular Thai Dramas", zh: "狗血上头的爆款泰剧", "zh-Hant": "狗血上頭的爆款泰劇", ja: "人気のタイドラマ", es: "Dramas Tailandeses Populares", ar: "دراما تايلاندية شائعة" },
  "home.tmdb_movie_th": { en: "Great Thai Movies", zh: "不止鬼片的泰国电影", "zh-Hant": "不止鬼片的泰國電影", ja: "おすすめタイ映画", es: "Grandes Películas Tailandesas", ar: "أفلام تايلاندية رائعة" },
  "home.tmdb_movie_sea": { en: "Southeast Asian Masterpieces", zh: "荷尔蒙超标的东南亚", "zh-Hant": "荷爾蒙超標的東南亞", ja: "東南アジアの傑作", es: "Obras Maestras del Sudeste Asiático", ar: "روائع جنوب شرق آسيا" },
  "home.popular_spanish_tv_shows": { en: "Trending Spanish-Language Series", zh: "时下流行的西语剧集", "zh-Hant": "時下流行的西語劇集", ja: "話題のスペイン語シリーズ", es: "Series en Español en Tendencia", ar: "مسلسلات إسبانية رائجة" },
  "home.netflix_minor_tv_shows": { en: "Global Minor Language Series", zh: "Netflix 小语种神剧", "zh-Hant": "Netflix 小語種神劇", ja: "マイナー言語の傑作ドラマ", es: "Series Internacionales", ar: "مسلسلات بلغات أخرى" },
  "home.netflix_minor_movies": { en: "Hidden Gem International Movies", zh: "冷门却惊艳的小语种电影", "zh-Hant": "冷門卻驚豔的小語種電影", ja: "知られざる名作映画", es: "Joyas Ocultas del Cine", ar: "أفلام عالمية مميزة" },
  "home.tmdb_tv_bl": { en: "Ultimate Asian BL Masterpieces", zh: "暧昧拉扯到极致的亚洲耽美神作", "zh-Hant": "曖昧拉扯到極致的亞洲耽美神作", ja: "極上のアジアBL・ブロマンス", es: "Obras Maestras BL Asiáticas", ar: "روائع BL الآسيوية" },
};
const TMDB_LIST_ROUTE_PARAMS: Partial<Record<string, TmdbListRouteParams>> = { "tmdb-popular-tv-shows": { category: "trending", type: "tv" }, "tmdb-popular-movies": { category: "trending", type: "movie" }, "tmdb-top-rated-movies": { category: "top-rated", type: "movie" }, "tmdb-top-rated-tv-shows": { category: "top-rated", type: "tv" } };
function resolveLocale(language: string): Locale { const normalized = language.toLowerCase(); if (normalized.startsWith("zh-hant") || normalized.includes("tw") || normalized.includes("hk")) return "zh-Hant"; if (normalized.startsWith("zh")) return "zh"; if (normalized.startsWith("ja")) return "ja"; if (normalized.startsWith("es")) return "es"; if (normalized.startsWith("ar")) return "ar"; return "en"; }
function resolveTitle(titleKey: HomeTitleKey, language: string): string { return TITLE_TRANSLATIONS[titleKey][resolveLocale(language)]; }
function createTmdbListRoute(title: string, params: TmdbListRouteParams): TmdbListRoute { return { type: "tmdb-list", title, params }; }
function createDefaultBlockTemplates(language: string, timezone: string): HomeBlockTemplate[] {
  return [
    {
      id: "tmdb_popular_tv",
      mediaType: "tv",
      titleKey: "home.tmdb_popular_tv_shows",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://movie-api.l3okuu.workers.dev/api/tmdb_popular_tv?sort=year", itemEnvelope: "data" },
    },
    {
      id: "tmdb_popular_movies",
      mediaType: "movie",
      titleKey: "home.tmdb_popular_movies",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://movie-api.l3okuu.workers.dev/api/tmdb_popular_movies?sort=year", itemEnvelope: "data" },
    },
    {
      id: "bangumi_airing",
      mediaType: "tv",
      titleKey: "home.bangumi_popular_anime",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://movie-api.l3okuu.workers.dev/api/bangumi_airing?sort=year", itemEnvelope: "data" },
    },
    {
      id: "imdb_top_anime",
      mediaType: "tv",
      titleKey: "home.imdb_top_anime",
      preset: "poster-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/imdb_top_anime", itemEnvelope: "data" },
    },
    {
      id: "prime_hot_anime",
      mediaType: "tv",
      titleKey: "home.prime_hot_anime",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://movie-api.l3okuu.workers.dev/api/prime_hot_anime?sort=year", itemEnvelope: "data" },
    },
    {
      id: "filmarks_anime_movie",
      mediaType: "movie",
      titleKey: "home.filmarks_anime_movie",
      preset: "poster-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/filmarks_anime_movie", itemEnvelope: "data" },
    },
    {
      id: "netflix_hot_anime",
      mediaType: "tv",
      titleKey: "home.netflix_hot_anime",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/netflix_hot_anime", itemEnvelope: "data" },
    },
    {
      id: "tmdb_anime_top_ja",
      mediaType: "tv",
      titleKey: "home.tmdb_anime_top_ja",
      preset: "poster-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/tmdb_anime_top_ja", itemEnvelope: "data" },
    },
    {
      id: "tmdb_anime_jp",
      mediaType: "tv",
      titleKey: "home.tmdb_anime_jp",
      preset: "poster-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/tmdb_anime_jp", itemEnvelope: "data" },
    },
    {
      id: "tmdb_anime_movie_ja",
      mediaType: "movie",
      titleKey: "home.tmdb_anime_movie_ja",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/tmdb_anime_movie_ja", itemEnvelope: "data" },
    },
    {
      id: "tmdb_anime_cn",
      mediaType: "tv",
      titleKey: "home.popular_domestic_anime",
      preset: "hero-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://movie-api.l3okuu.workers.dev/api/tmdb_anime_cn?sort=year", itemEnvelope: "data" },
    },
    {
      id: "tmdb_tv_netflix",
      mediaType: "tv",
      titleKey: "home.tmdb_tv_netflix",
      preset: "hero-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/tmdb_tv_netflix", itemEnvelope: "data" },
    },
    {
      id: "tmdb_tv_hbo",
      mediaType: "tv",
      titleKey: "home.tmdb_tv_hbo",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/tmdb_tv_hbo", itemEnvelope: "data" },
    },
    {
      id: "tmdb_tv_apple",
      mediaType: "tv",
      titleKey: "home.tmdb_tv_apple",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/tmdb_tv_apple", itemEnvelope: "data" },
    },
    {
      id: "trakt_movies",
      mediaType: "movie",
      titleKey: "home.trakt_movies",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/trakt_movies", itemEnvelope: "data" },
    },
    {
      id: "trakt_shows",
      mediaType: "tv",
      titleKey: "home.trakt_shows",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/trakt_shows", itemEnvelope: "data" },
    },
    {
      id: "douban_movies",
      mediaType: "movie",
      titleKey: "home.popular_movies",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/douban_movies", itemEnvelope: "data" },
    },
    {
      id: "douban_tv",
      mediaType: "tv",
      titleKey: "home.popular_tv_shows",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/douban_tv", itemEnvelope: "data" },
    },
    {
      id: "variety_cn",
      mediaType: "tv",
      titleKey: "home.variety_cn",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/variety_cn", itemEnvelope: "data" },
    },
    {
      id: "variety_kr",
      mediaType: "tv",
      titleKey: "home.variety_kr",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/variety_kr", itemEnvelope: "data" },
    },
    {
      id: "variety_global",
      mediaType: "tv",
      titleKey: "home.variety_global",
      preset: "poster-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/variety_global", itemEnvelope: "data" },
    },
    {
      id: "douban_korean_tv",
      mediaType: "tv",
      titleKey: "home.popular_korean_tv_shows",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/douban_korean_tv", itemEnvelope: "data" },
    },
    {
      id: "tmdb_tv_ja",
      mediaType: "tv",
      titleKey: "home.popular_japanese_tv_shows",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/tmdb_tv_ja", itemEnvelope: "data" },
    },
    {
      id: "tmdb_tv_tw",
      mediaType: "tv",
      titleKey: "home.popular_taiwanese_tv_shows",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/tmdb_tv_tw", itemEnvelope: "data" },
    },
    {
      id: "tmdb_movie_tw",
      mediaType: "movie",
      titleKey: "home.popular_taiwanese_movies",
      preset: "poster-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/tmdb_movie_tw", itemEnvelope: "data" },
    },
    {
      id: "tmdb_tv_th",
      mediaType: "tv",
      titleKey: "home.tmdb_tv_th",
      preset: "poster-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://movie-api.l3okuu.workers.dev/api/tmdb_tv_th?sort=year", itemEnvelope: "data" },
    },
    {
      id: "tmdb_movie_th",
      mediaType: "movie",
      titleKey: "home.tmdb_movie_th",
      preset: "poster-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://movie-api.l3okuu.workers.dev/api/tmdb_movie_th?sort=year", itemEnvelope: "data" },
    },
    {
      id: "tmdb_movie_sea",
      mediaType: "movie",
      titleKey: "home.tmdb_movie_sea",
      preset: "poster-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://movie-api.l3okuu.workers.dev/api/tmdb_movie_sea?sort=year", itemEnvelope: "data" },
    },
    {
      id: "tmdb_tv_es",
      mediaType: "tv",
      titleKey: "home.popular_spanish_tv_shows",
      preset: "poster-list",
      showRank: true,
      showOverview: true,
      sort: "year",
      source: { path: "https://movie-api.l3okuu.workers.dev/api/tmdb_tv_es?sort=year", itemEnvelope: "data" },
    },
    {
      id: "netflix_tv_minor",
      mediaType: "tv",
      titleKey: "home.netflix_minor_tv_shows",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/netflix_tv_minor", itemEnvelope: "data" },
    },
    {
      id: "netflix_movie_minor",
      mediaType: "movie",
      titleKey: "home.netflix_minor_movies",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/netflix_movie_minor", itemEnvelope: "data" },
    },
    {
      id: "tmdb_tv_bl",
      mediaType: "tv",
      titleKey: "home.tmdb_tv_bl",
      preset: "thumb-list",
      showRank: true,
      showOverview: true,
      source: { path: "https://movie-api.l3okuu.workers.dev/api/tmdb_tv_bl", itemEnvelope: "data" },
    },
    { id: "tmdb-on-the-air-tv-shows", mediaType: "tv", titleKey: "home.tmdb_on_the_air_tv_shows", preset: "hero-list", source: { path: "/tmdb/tv/on_the_air", query: { language, timezone }, itemEnvelope: "results" } },
    { id: "tmdb-discover-genres", titleKey: "home.tmdb_discover_genres", preset: "genres-list", source: { path: "/crawler/discover/genres", query: { language }, itemEnvelope: "data" } },
    { id: "tmdb-discover-tv-by-language", titleKey: "home.tmdb_discover_languages", preset: "languages-list", source: { path: "/crawler/discover/tv-by-language", query: { language }, itemEnvelope: "data" } },
    { id: "tmdb-discover-networks", titleKey: "home.tmdb_discover_networks", preset: "networks-list", source: { path: "/crawler/discover/tv-by-network", itemEnvelope: "data" } },
    { id: "tmdb-top-rated-movies", titleKey: "home.tmdb_top_rated_movies", mediaType: "movie", preset: "poster-list", source: { path: "/tmdb/movie/top_rated", query: { language, page: 1, limit: 20 }, itemEnvelope: "results", pagination: { pageParam: "page", startPage: 1 } } },
    { id: "tmdb-top-rated-tv-shows", titleKey: "home.tmdb_top_rated_tv_shows", mediaType: "tv", preset: "poster-list", source: { path: "/tmdb/tv/top_rated", query: { language, page: 1, limit: 20 }, itemEnvelope: "results", pagination: { pageParam: "page", startPage: 1 } } }
  ];
}
function resolveBlockTitle(block: HomeBlockTemplate, language: string): HomeBlock { const { titleKey, ...rest } = block; if (!titleKey) return rest; const title = resolveTitle(titleKey, language); const routeParams = TMDB_LIST_ROUTE_PARAMS[rest.id]; return { ...rest, title, ...(routeParams ? { route: createTmdbListRoute(title, routeParams) } : {}) }; }
export function createDefaultHomeConfig(options: DefaultHomeConfigOptions): DefaultHomeConfig { return { version: HOME_CONFIG_VERSION, apiBaseUrl: options.apiBaseUrl, imageBaseUrl: options.imageBaseUrl, carouselSourceId: "tmdb_popular_tv", blocks: createDefaultBlockTemplates(options.language, options.timezone).map((block) => resolveBlockTitle(block, options.language)), }; }

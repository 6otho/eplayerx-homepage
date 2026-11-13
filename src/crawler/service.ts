import type { trailerCandidates } from "../tmdb/trailer-candidates.js";
/**
 * JSON storage service using Cloudflare R2
 */

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { ItemRatings } from "../ratings/types.js";

const MOVIES_BLOB_KEY = "douban-movies.json";
const TV_BLOB_KEY = "douban-tv.json";
const KOREAN_TV_BLOB_KEY = "douban-korean-tv.json";
const JAPANESE_TV_BLOB_KEY = "douban-japanese-tv.json";
const HAMI_TAIWANESE_TV_BLOB_KEY = "hami-taiwanese-tv.json";
const DOUBAN_ANIMATION_BLOB_KEY = "douban-animation.json";
const HOT_VARIETY_SHOWS_BLOB_KEY = "douban-hot-variety-shows.json";
const BANGUMI_ANIMATION_BLOB_KEY = "bangumi-animation.json";
const DISCOVER_TV_BY_LANGUAGE_BLOB_KEY = "discover-tv-by-language.json";
const DISCOVER_TV_BY_NETWORK_BLOB_KEY = "discover-tv-by-network.json";

// Validate required environment variables
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.warn(
    "Warning: R2 credentials not fully configured. R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME are required."
  );
}

// Initialize R2 client
// Priority: explicit endpoint > account ID endpoint
const r2Endpoint =
  process.env.R2_ENDPOINT ||
  (process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined);

const r2Client = new S3Client({
  region: "auto",
  endpoint: r2Endpoint,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || "",
    secretAccessKey: R2_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true, // Use path-style for R2 endpoint
});

/** Localized overlay fields stored under ContentItem.translations. */
export interface ContentItemTranslation {
  trailer?: ReturnType<typeof trailerCandidates>;
  title: string;
  overview?: string | null;
  tagline?: string | null;
  thumb?: string | null;
  logo?: string | null;
  noLogoPoster?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
}

export interface ContentItem {
	trailer?: ReturnType<typeof trailerCandidates>;
  title: string;
  tmdbId: number;
  imdbId?: string | null;
  tvdbId?: number | null;
  vote_average: number | null;
  ratings?: ItemRatings;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genre_ids: number[];
  media_type: "movie" | "tv";
  release_date?: string | null;
  first_air_date?: string | null;
  overview?: string | null;
  tagline?: string | null;
  thumb?: string | null;
  logo?: string | null;
  noLogoPoster?: string | null;
  /** Extra locales from TMDB (zh stays on top-level fields). */
  translations?: {
    en?: ContentItemTranslation;
    ar?: ContentItemTranslation;
  };
  crawledAt: string;
}

interface BlobData {
  platform: string;
  type: string;
  count: number;
  lastUpdated: string;
  data: ContentItem[];
}

/**
 * Load blob content by pathname
 */
async function loadBlobContent(pathname: string): Promise<BlobData | null> {
  try {
    // Use custom domain for reading (default: assets.eplayerx.com)
    const customDomain = process.env.R2_CUSTOM_DOMAIN || "assets.eplayerx.com";
    const url = `https://${customDomain}/${pathname}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const text = await response.text();
    return JSON.parse(text) as BlobData;
  } catch (error: any) {
    // If blob doesn't exist (404), return null
    if (error.$metadata?.httpStatusCode === 404) {
      return null;
    }
    // Log other errors for debugging
    if (error.$metadata?.httpStatusCode === 401) {
      console.error(
        "R2 authentication error (401). Please check your R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables."
      );
    } else {
      console.error("Error loading blob content:", error.message || error);
    }
    return null;
  }
}

/**
 * Save movies to R2
 */
/**
 * 🔑 增量合并：豆瓣/TMDB 接口每次只返回有限条数（20 条左右），
 *    直接覆盖会把历史累积的数据冲掉。这里读旧数据 → 合并 → 去重 → 保留近 3 年。
 */
async function mergeWithExisting(
  key: string,
  incoming: ContentItem[],
): Promise<ContentItem[]> {
  const map = new Map<string, ContentItem>();
  const keyOf = (x: ContentItem) => String(x.tmdbId || x.title || "");

  try {
    const existing = await r2Client.send(
      new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })
    );
    const body = await existing.Body?.transformToString();
    if (body) {
      const old = JSON.parse(body) as BlobData;
      for (const item of Array.isArray(old.data) ? old.data : []) {
        map.set(keyOf(item), item);
      }
    }
  } catch (e: any) {
    if (e?.$metadata?.httpStatusCode !== 404 && e?.name !== "NoSuchKey") {
      console.warn(`读取旧数据失败(${key})，按新增处理:`, e?.message);
    }
  }

  // 新数据覆盖旧的同一条
  for (const item of incoming) map.set(keyOf(item), item);

  // 去掉过老的（保留近 3 年首播）
  const minYear = new Date().getFullYear() - 3;
  const merged = Array.from(map.values()).filter((x) => {
    const y = Number.parseInt(
      (x.first_air_date || x.release_date || "").slice(0, 4),
      10
    );
    return !Number.isFinite(y) || y >= minYear;
  });

  // 按日期倒序
  merged.sort((a, b) =>
    String(b.first_air_date || b.release_date || "").localeCompare(
      String(a.first_air_date || a.release_date || "")
    )
  );

  return merged;
}

export async function saveMovies(movies: ContentItem[]) {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }

  // 🔑 增量合并，避免只抓到 20 条就覆盖历史数据
  movies = await mergeWithExisting(MOVIES_BLOB_KEY, movies);

  const data: BlobData = {
    platform: "douban",
    type: "movie",
    count: movies.length,
    lastUpdated: new Date().toISOString(),
    data: movies,
  };
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: MOVIES_BLOB_KEY,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json",
  });

  try {
    await r2Client.send(command);
  } catch (error: any) {
    if (error.$metadata?.httpStatusCode === 401) {
      throw new Error(
        "R2 authentication failed (401). Please check your R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables."
      );
    }
    throw error;
  }
}

/**
 * Save TV series to R2
 */
export async function saveTVSeries(tvSeries: ContentItem[]) {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }

  // 🔑 增量合并，避免只抓到 20 条就覆盖历史数据
  tvSeries = await mergeWithExisting(TV_BLOB_KEY, tvSeries);

  const data: BlobData = {
    platform: "douban",
    type: "tv_series",
    count: tvSeries.length,
    lastUpdated: new Date().toISOString(),
    data: tvSeries,
  };
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: TV_BLOB_KEY,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json",
  });

  try {
    await r2Client.send(command);
  } catch (error: any) {
    if (error.$metadata?.httpStatusCode === 401) {
      throw new Error(
        "R2 authentication failed (401). Please check your R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables."
      );
    }
    throw error;
  }
}

async function saveTVSeriesCollection(
  key: string,
  type: string,
  tvSeries: ContentItem[],
  platform = "douban"
) {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }

  // 🔑 增量合并，避免只抓到 20 条就覆盖历史数据
  tvSeries = await mergeWithExisting(key, tvSeries);

  const data: BlobData = {
    platform,
    type,
    count: tvSeries.length,
    lastUpdated: new Date().toISOString(),
    data: tvSeries,
  };
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json",
  });

  try {
    await r2Client.send(command);
  } catch (error: any) {
    if (error.$metadata?.httpStatusCode === 401) {
      throw new Error(
        "R2 authentication failed (401). Please check your R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables."
      );
    }
    throw error;
  }
}

export async function saveKoreanTVSeries(tvSeries: ContentItem[]) {
  return saveTVSeriesCollection(
    KOREAN_TV_BLOB_KEY,
    "korean_tv_series",
    tvSeries
  );
}

export async function saveJapaneseTVSeries(tvSeries: ContentItem[]) {
  return saveTVSeriesCollection(
    JAPANESE_TV_BLOB_KEY,
    "japanese_tv_series",
    tvSeries
  );
}

export async function saveHamiTaiwaneseTVSeries(tvSeries: ContentItem[]) {
  return saveTVSeriesCollection(
    HAMI_TAIWANESE_TV_BLOB_KEY,
    "taiwanese_tv_series",
    tvSeries,
    "hami"
  );
}

/**
 * Load movies from R2
 */
export async function loadMovies(): Promise<ContentItem[]> {
  try {
    const blobData = await loadBlobContent(MOVIES_BLOB_KEY);
    return blobData?.data || [];
  } catch (error) {
    console.error("Error loading movies:", error);
    return [];
  }
}

/**
 * Load TV series from R2
 */
export async function loadTVSeries(): Promise<ContentItem[]> {
  try {
    const blobData = await loadBlobContent(TV_BLOB_KEY);
    return blobData?.data || [];
  } catch (error) {
    console.error("Error loading TV series:", error);
    return [];
  }
}

/**
 * Get last update time for movies
 */
export async function getMoviesLastUpdate(): Promise<string | null> {
  try {
    const blobData = await loadBlobContent(MOVIES_BLOB_KEY);
    return blobData?.lastUpdated || null;
  } catch (error) {
    return null;
  }
}

/**
 * Get last update time for TV series
 */
export async function getTVSeriesLastUpdate(): Promise<string | null> {
  try {
    const blobData = await loadBlobContent(TV_BLOB_KEY);
    return blobData?.lastUpdated || null;
  } catch (error) {
    return null;
  }
}

/**
 * Save Douban animation to R2
 */
export async function saveDoubanAnimation(animation: ContentItem[]) {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }

  // 🔑 增量合并，避免只抓到 20 条就覆盖历史数据
  animation = await mergeWithExisting(DOUBAN_ANIMATION_BLOB_KEY, animation);

  const data: BlobData = {
    platform: "douban",
    type: "animation",
    count: animation.length,
    lastUpdated: new Date().toISOString(),
    data: animation,
  };
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: DOUBAN_ANIMATION_BLOB_KEY,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json",
  });

  try {
    await r2Client.send(command);
  } catch (error: any) {
    if (error.$metadata?.httpStatusCode === 401) {
      throw new Error(
        "R2 authentication failed (401). Please check your R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables."
      );
    }
    throw error;
  }
}

/**
 * Load Douban animation from R2
 */
export async function loadDoubanAnimation(): Promise<ContentItem[]> {
  try {
    const blobData = await loadBlobContent(DOUBAN_ANIMATION_BLOB_KEY);
    return blobData?.data || [];
  } catch (error) {
    console.error("Error loading Douban animation:", error);
    return [];
  }
}

/**
 * Get last update time for Douban animation
 */
export async function getDoubanAnimationLastUpdate(): Promise<string | null> {
  try {
    const blobData = await loadBlobContent(DOUBAN_ANIMATION_BLOB_KEY);
    return blobData?.lastUpdated || null;
  } catch (error) {
    return null;
  }
}

/**
 * Save hot variety shows to R2
 */
export async function saveHotVarietyShows(varietyShows: ContentItem[]) {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }

  // 🔑 增量合并：豆瓣热门接口每天只返回约 20 条，
  //    直接覆盖会把历史积累的几十条冲掉，所以先读旧数据再合并
  let merged: ContentItem[] = [...varietyShows];
  try {
    const existing = await r2Client.send(
      new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: HOT_VARIETY_SHOWS_BLOB_KEY })
    );
    const body = await existing.Body?.transformToString();
    if (body) {
      const old = JSON.parse(body) as BlobData;
      const oldItems = Array.isArray(old.data) ? old.data : [];

      const keyOf = (x: ContentItem) =>
        String(x.tmdbId || x.title || "");
      const fresh = new Map<string, ContentItem>();
      for (const item of oldItems) fresh.set(keyOf(item), item);
      // 新抓到的覆盖旧的同一条
      for (const item of varietyShows) fresh.set(keyOf(item), item);
      merged = Array.from(fresh.values());
    }
  } catch (e: any) {
    // 首次运行 / 文件不存在时忽略
    if (e?.$metadata?.httpStatusCode !== 404 && e?.name !== "NoSuchKey") {
      console.warn("读取旧综艺数据失败，按新增处理:", e?.message);
    }
  }

  // 去掉过老的：只保留最近 3 年首播的（避免长期累积成一大堆过时节目）
  const minYear = new Date().getFullYear() - 3;
  merged = merged.filter((x) => {
    const y = Number.parseInt((x.first_air_date || x.release_date || "").slice(0, 4), 10);
    return !Number.isFinite(y) || y >= minYear;
  });

  // 按首播日期倒序，新的在前
  merged.sort((a, b) =>
    String(b.first_air_date || b.release_date || "").localeCompare(
      String(a.first_air_date || a.release_date || "")
    )
  );

  const data: BlobData = {
    platform: "douban",
    type: "hot_variety_show",
    count: merged.length,
    lastUpdated: new Date().toISOString(),
    data: merged,
  };
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: HOT_VARIETY_SHOWS_BLOB_KEY,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json",
  });

  try {
    await r2Client.send(command);
  } catch (error: any) {
    if (error.$metadata?.httpStatusCode === 401) {
      throw new Error(
        "R2 authentication failed (401). Please check your R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables."
      );
    }
    throw error;
  }
}

/**
 * Load hot variety shows from R2
 */
export async function loadHotVarietyShows(): Promise<ContentItem[]> {
  try {
    const blobData = await loadBlobContent(HOT_VARIETY_SHOWS_BLOB_KEY);
    return blobData?.data || [];
  } catch (error) {
    console.error("Error loading hot variety shows:", error);
    return [];
  }
}

/**
 * Get last update time for hot variety shows
 */
export async function getHotVarietyShowsLastUpdate(): Promise<string | null> {
  try {
    const blobData = await loadBlobContent(HOT_VARIETY_SHOWS_BLOB_KEY);
    return blobData?.lastUpdated || null;
  } catch (error) {
    return null;
  }
}

/**
 * Save Bangumi animation to R2
 */
export async function saveBangumiAnimation(animation: ContentItem[]) {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }

  // 🔑 增量合并，避免只抓到 20 条就覆盖历史数据
  animation = await mergeWithExisting(BANGUMI_ANIMATION_BLOB_KEY, animation);

  const data: BlobData = {
    platform: "bangumi",
    type: "animation",
    count: animation.length,
    lastUpdated: new Date().toISOString(),
    data: animation,
  };
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: BANGUMI_ANIMATION_BLOB_KEY,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json",
  });

  try {
    await r2Client.send(command);
  } catch (error: any) {
    if (error.$metadata?.httpStatusCode === 401) {
      throw new Error(
        "R2 authentication failed (401). Please check your R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables."
      );
    }
    throw error;
  }
}

/**
 * Load Bangumi animation from R2
 */
export async function loadBangumiAnimation(): Promise<ContentItem[]> {
  try {
    const blobData = await loadBlobContent(BANGUMI_ANIMATION_BLOB_KEY);
    return blobData?.data || [];
  } catch (error) {
    console.error("Error loading Bangumi animation:", error);
    return [];
  }
}

/**
 * Get last update time for Bangumi animation
 */
export async function getBangumiAnimationLastUpdate(): Promise<string | null> {
  try {
    const blobData = await loadBlobContent(BANGUMI_ANIMATION_BLOB_KEY);
    return blobData?.lastUpdated || null;
  } catch (error) {
    return null;
  }
}

// Discover TV by language types
export interface DiscoverTVByLanguageItem {
  language: string;
  languageName: string;
  id: number;
  name: string;
  original_name: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
}

interface DiscoverTVByLanguageBlobData {
  type: string;
  count: number;
  lastUpdated: string;
  data: DiscoverTVByLanguageItem[];
}

/**
 * Save discover TV by language to R2
 */
export async function saveDiscoverTVByLanguage(
  items: DiscoverTVByLanguageItem[]
) {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }

  const data: DiscoverTVByLanguageBlobData = {
    type: "discover_tv_by_language",
    count: items.length,
    lastUpdated: new Date().toISOString(),
    data: items,
  };
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: DISCOVER_TV_BY_LANGUAGE_BLOB_KEY,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json",
  });

  try {
    await r2Client.send(command);
  } catch (error: any) {
    if (error.$metadata?.httpStatusCode === 401) {
      throw new Error(
        "R2 authentication failed (401). Please check your R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables."
      );
    }
    throw error;
  }
}

/**
 * Load discover TV by language from R2
 */
export async function loadDiscoverTVByLanguage(): Promise<
  DiscoverTVByLanguageItem[]
> {
  try {
    const blobData = (await loadBlobContent(
      DISCOVER_TV_BY_LANGUAGE_BLOB_KEY
    )) as DiscoverTVByLanguageBlobData | null;
    return blobData?.data || [];
  } catch (error) {
    console.error("Error loading discover TV by language:", error);
    return [];
  }
}

/**
 * Get last update time for discover TV by language
 */
export async function getDiscoverTVByLanguageLastUpdate(): Promise<
  string | null
> {
  try {
    const blobData = await loadBlobContent(DISCOVER_TV_BY_LANGUAGE_BLOB_KEY);
    return blobData?.lastUpdated || null;
  } catch (error) {
    return null;
  }
}

// Discover TV by network types
export interface DiscoverTVByNetworkItem {
  networkId: number;
  networkName: string;
  networkLogoPath: string | null;
  network?: string;
  watchProvider?: string;
  watchRegion?: string;
  id: number;
  name: string;
  original_name: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
}

interface DiscoverTVByNetworkBlobData {
  type: string;
  count: number;
  lastUpdated: string;
  data: DiscoverTVByNetworkItem[];
}

/**
 * Save discover TV by network to R2
 */
export async function saveDiscoverTVByNetwork(
  items: DiscoverTVByNetworkItem[]
) {
  if (!R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }

  const data: DiscoverTVByNetworkBlobData = {
    type: "discover_tv_by_network",
    count: items.length,
    lastUpdated: new Date().toISOString(),
    data: items,
  };
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: DISCOVER_TV_BY_NETWORK_BLOB_KEY,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json",
  });

  try {
    await r2Client.send(command);
  } catch (error: any) {
    if (error.$metadata?.httpStatusCode === 401) {
      throw new Error(
        "R2 authentication failed (401). Please check your R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables."
      );
    }
    throw error;
  }
}

/**
 * Load discover TV by network from R2
 */
export async function loadDiscoverTVByNetwork(): Promise<
  DiscoverTVByNetworkItem[]
> {
  try {
    const blobData = (await loadBlobContent(
      DISCOVER_TV_BY_NETWORK_BLOB_KEY
    )) as DiscoverTVByNetworkBlobData | null;
    return blobData?.data || [];
  } catch (error) {
    console.error("Error loading discover TV by network:", error);
    return [];
  }
}

/**
 * Get last update time for discover TV by network
 */
export async function getDiscoverTVByNetworkLastUpdate(): Promise<
  string | null
> {
  try {
    const blobData = await loadBlobContent(DISCOVER_TV_BY_NETWORK_BLOB_KEY);
    return blobData?.lastUpdated || null;
  } catch (error) {
    return null;
  }
}

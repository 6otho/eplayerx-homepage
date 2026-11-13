/**
 * Douban scraper - fetch hot content via API
 */

export interface DoubanItem {
  title: string;
}

const GUDUO_ANIMATION_BILLBOARD =
  "https://d2.guduomedia.com/m/v3/billboard/list";
const DOUBAN_RECENT_HOT_MOVIE =
  "https://m.douban.com/rexxar/api/v2/subject/recent_hot/movie";
const DOUBAN_RECENT_HOT_TV =
  "https://m.douban.com/rexxar/api/v2/subject/recent_hot/tv";
const DOUBAN_SUBJECT_COLLECTION =
  "https://m.douban.com/rexxar/api/v2/subject_collection";
const DOUBAN_SEARCH_SUBJECTS = "https://movie.douban.com/j/search_subjects";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
  Accept: "application/json",
};

interface RecentHotListResponse {
  items?: Array<{
    title: string;
  }>;
}

interface SearchSubjectsResponse {
  subjects?: Array<{
    title: string;
  }>;
}

interface SubjectCollectionResponse {
  subject_collection_items?: Array<{
    title: string;
  }>;
  items?: Array<{
    title: string;
  }>;
}

interface GuduoBillboardResponse {
  code?: number;
  data?: Array<{
    name: string;
  }>;
}

/** YYYY-MM-DD in Asia/Shanghai, minus calendar days. */
function shanghaiYYYYMMDDMinusDays(daysBack: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const mo = Number(parts.find((p) => p.type === "month")?.value);
  const da = Number(parts.find((p) => p.type === "day")?.value);
  const utc = Date.UTC(y, mo - 1, da - daysBack);
  return new Date(utc).toISOString().slice(0, 10);
}

async function fetchDoubanRecentHot(options: {
  kind: "movie" | "tv";
  query: Record<string, string>;
  limit?: number;
}): Promise<DoubanItem[]> {
  const base =
    options.kind === "movie" ? DOUBAN_RECENT_HOT_MOVIE : DOUBAN_RECENT_HOT_TV;
  // 🔑 豆瓣接口单次最多给 20 条，必须翻页才能拿全；
  //    之前写死 start=0&limit=20，导致每次只抓到 20 条并覆盖掉历史数据
  const want = options.limit ?? 100;
  const seen = new Set<string>();
  const out: DoubanItem[] = [];
  let start = 0;

  try {
    while (out.length < want) {
      const size = Math.min(20, want - out.length);
      const params = new URLSearchParams({
        start: String(start),
        limit: String(size),
        ...options.query,
      });
      const url = `${base}?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          ...HEADERS,
          Referer: "https://m.douban.com/",
        },
      });

      if (!response.ok) {
        console.error(
          `Douban recent_hot/${options.kind} error: ${response.status}`
        );
        break;
      }

      const data = (await response.json()) as RecentHotListResponse;
      const items = data.items || [];
      if (items.length === 0) break;

      let added = 0;
      for (const item of items) {
        const key = String(item.id ?? item.title);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ title: item.title.split(" ")[0] });
        added += 1;
      }

      start += items.length;
      if (added === 0) break; // 翻到底了
      if (start >= (data.total ?? 0)) break;

      await new Promise((r) => setTimeout(r, 250)); // 温和限速
    }

    return out;
  } catch (error) {
    console.error(`Error fetching Douban recent_hot/${options.kind}:`, error);
    return [];
  }
}

async function fetchDoubanSubjectCollection(
  collectionId: string,
  want = 100
): Promise<DoubanItem[]> {
  // 🔑 同样需要翻页，否则每个合集只有 20 条
  const seen = new Set<string>();
  const out: DoubanItem[] = [];
  let start = 0;
  try {
    while (out.length < want) {
      const size = Math.min(20, want - out.length);
      const params = new URLSearchParams({
        start: String(start),
        count: String(size),
      });
      const url = `${DOUBAN_SUBJECT_COLLECTION}/${collectionId}/items?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          ...HEADERS,
          Referer: "https://m.douban.com/",
        },
      });

      if (!response.ok) {
        console.error(
          `Douban subject_collection/${collectionId} error: ${response.status}`
        );
        break;
      }

      const data = (await response.json()) as SubjectCollectionResponse;
      const items = data.subject_collection_items || data.items || [];
      if (!items.length) break;

      let added = 0;
      for (const item of items) {
        const key = String((item as { id?: string }).id ?? item.title);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ title: item.title.split(" ")[0] });
        added += 1;
      }
      start += items.length;
      if (added === 0) break;
      await new Promise((r) => setTimeout(r, 250));
    }

    return out;
  } catch (error) {
    console.error(`Error fetching Douban subject_collection/${collectionId}:`, error);
    return [];
  }
}

async function fetchDoubanSearchSubjects(
  query: Record<string, string>
): Promise<DoubanItem[]> {
  try {
    const params = new URLSearchParams({
      type: "tv",
      sort: "recommend",
      page_limit: "20",
      page_start: "0",
      ...query,
    });
    const url = `${DOUBAN_SEARCH_SUBJECTS}?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        ...HEADERS,
        Referer: "https://movie.douban.com/tv/",
      },
    });

    if (!response.ok) {
      console.error(`Douban search_subjects error: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as SearchSubjectsResponse;
    const subjects = data.subjects || [];

    return subjects.map((subject) => ({
      title: subject.title.split(" ")[0],
    }));
  } catch (error) {
    console.error("Error fetching Douban search_subjects:", error);
    return [];
  }
}

async function fetchDoubanCollectionWithFallback(options: {
  collectionId: string;
  fallbackTag: string;
}): Promise<DoubanItem[]> {
  const items = await fetchDoubanSubjectCollection(options.collectionId);
  if (items.length > 0) {
    return items;
  }
  return fetchDoubanSearchSubjects({ tag: options.fallbackTag });
}

/**
 * Hot movies: m.douban rexxar recent_hot (热门 + 华语).
 */
export async function fetchDoubanHotMovies(): Promise<DoubanItem[]> {
  return fetchDoubanRecentHot({
    kind: "movie",
    query: { category: "热门", type: "华语" },
  });
}

/**
 * Domestic TV dramas: m.douban rexxar subject_collection tv_domestic.
 */
export async function fetchDoubanHotTVSeries(): Promise<DoubanItem[]> {
  return fetchDoubanCollectionWithFallback({
    collectionId: "tv_domestic",
    fallbackTag: "国产剧",
  });
}

/**
 * Korean TV dramas: m.douban rexxar subject_collection tv_korean.
 */
export async function fetchDoubanKoreanTVSeries(): Promise<DoubanItem[]> {
  return fetchDoubanSubjectCollection("tv_korean");
}

/**
 * Japanese TV dramas: m.douban rexxar subject_collection tv_japanese.
 */
export async function fetchDoubanJapaneseTVSeries(): Promise<DoubanItem[]> {
  return fetchDoubanSubjectCollection("tv_japanese");
}

/**
 * Hot animation: Guduo daily billboard (ALL_ANIME). Date steps back if latest day has no data yet.
 */
export async function fetchDoubanHotAnimation(): Promise<DoubanItem[]> {
  try {
    for (let daysBack = 0; daysBack < 14; daysBack++) {
      const date = shanghaiYYYYMMDDMinusDays(daysBack);
      const params = new URLSearchParams({
        type: "DAILY",
        category: "ALL_ANIME",
        date,
        attach: "gdi",
        orderTitle: "gdi",
        platformId: "0",
      });
      const url = `${GUDUO_ANIMATION_BILLBOARD}?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          ...HEADERS,
          Referer: "https://d2.guduomedia.com/",
        },
      });

      if (!response.ok) {
        console.error(`Guduo billboard error: ${response.status}`);
        continue;
      }

      const data = (await response.json()) as GuduoBillboardResponse;
      if (data.code != null && data.code !== 0) {
        continue;
      }
      const rows = data.data || [];
      if (rows.length === 0) {
        continue;
      }

      return rows.slice(0, 20).map((row) => ({
        title: row.name.split(" ")[0],
      }));
    }
    return [];
  } catch (error) {
    console.error("Error fetching Guduo animation billboard:", error);
    return [];
  }
}

/**
 * Hot variety (国内综艺): m.douban rexxar recent_hot (category=show, type=show_domestic).
 */
export async function fetchDoubanHotVarietyShows(): Promise<DoubanItem[]> {
  return fetchDoubanRecentHot({
    kind: "tv",
    query: { category: "show", type: "show_domestic" },
  });
}

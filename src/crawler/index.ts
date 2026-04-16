import { Hono } from "hono";
import {
  crawlBangumiAnimation,
  crawlDoubanAnimation,
  crawlDoubanHotVarietyShows,
  crawlDoubanMovies,
  crawlDoubanTVSeries,
} from "./crawlers.js";

// 🔥 声明 Cloudflare 环境变量类型，防报错
type Bindings = {
  TRAKT_CLIENT_ID: string;
};

const R2_CUSTOM_DOMAIN = process.env.R2_CUSTOM_DOMAIN || "assets.eplayerx.com";

// 注入环境变量类型
const app = new Hono<{ Bindings: Bindings }>();

// =====================================
// 🔥 Trakt 实时获取工具函数
// =====================================
async function fetchTraktTrending(clientId: string) {
  try {
    const response = await fetch("https://api.trakt.tv/movies/trending?limit=20", {
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": clientId,
        "User-Agent": "EPlayerX-API-Client/1.0",
      },
    });

    if (!response.ok) {
      console.error(`Trakt API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.map((item: any) => ({
      title: item.movie.title,
      year: item.movie.year,
      tmdb_id: item.movie.ids.tmdb,
      watchers: item.watchers,
    }));
  } catch (error) {
    console.error("Error fetching Trakt:", error);
    return [];
  }
}

// =====================================
// 爬虫与定时任务路由 (保持原样不动)
// =====================================

app.post("/crawl/movies", async (c) => {
  const results = await crawlDoubanMovies();
  return c.json({ success: true, count: results.length });
});

app.post("/crawl/tv", async (c) => {
  const results = await crawlDoubanTVSeries();
  return c.json({ success: true, count: results.length });
});

app.post("/crawl/douban/animation", async (c) => {
  const results = await crawlDoubanAnimation();
  return c.json({ success: true, count: results.length });
});

app.post("/crawl/douban/hot-variety-shows", async (c) => {
  const results = await crawlDoubanHotVarietyShows();
  return c.json({ success: true, count: results.length });
});

app.post("/crawl/bangumi/animation", async (c) => {
  const results = await crawlBangumiAnimation();
  return c.json({ success: true, count: results.length });
});

app.get("/cron/crawl-all", async (c) => {
  const startTime = Date.now();
  try {
    console.log("🕐 Scheduled crawl started at", new Date().toISOString());
    const [movies, tvSeries, doubanAnimation, hotVarietyShows, bangumiAnimation] = await Promise.all([
      crawlDoubanMovies(),
      crawlDoubanTVSeries(),
      crawlDoubanAnimation(),
      crawlDoubanHotVarietyShows(),
      crawlBangumiAnimation(),
    ]);
    const duration = Date.now() - startTime;
    return c.json({
      success: true,
      movies: { count: movies.length },
      tvSeries: { count: tvSeries.length },
      doubanAnimation: { count: doubanAnimation.length },
      hotVarietyShows: { count: hotVarietyShows.length },
      bangumiAnimation: { count: bangumiAnimation.length },
      duration: `${Math.round(duration / 1000)}s`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Scheduled crawl failed:", error);
    return c.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

// =====================================
// 🔥 终极防崩溃版：Trakt + 豆瓣 缝合接口
// =====================================
app.get("/popular/douban/movies", async (c) => {
  try {
    // 1. 获取 Trakt 数据 (⚠️ 严格精简：只留 title，防止前端强类型解析崩溃)
    let traktMovies: any[] = [];
    const clientId = c.env.TRAKT_CLIENT_ID?.trim();
    if (clientId) {
      const traktRes = await fetch("https://api.trakt.tv/movies/trending?limit=20", {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "trakt-api-version": "2",
          "trakt-api-key": clientId,
          "User-Agent": "EPlayerX-API-Client/1.0",
        },
      });
      if (traktRes.ok) {
        const traktData = await traktRes.json();
        // 强行瘦身：为了迎合 EPlayerX 原生系统，绝不传多余字段
        traktMovies = traktData.map((item: any) => ({
          title: item.movie.title
        }));
      }
    }

    // 2. 获取原版豆瓣数据
    const doubanUrl = `https://${R2_CUSTOM_DOMAIN}/douban-movies.json`;
    const doubanResponse = await fetch(doubanUrl);
    
    // 如果豆瓣挂了，直接把 Trakt 当成纯数组顶上
    if (!doubanResponse.ok) {
       return c.json(traktMovies);
    }

    const doubanData = await doubanResponse.json();

    // 3. 智能合并：探测豆瓣的真实结构
    if (Array.isArray(doubanData)) {
      // 结构 A：纯数组 [...]
      return c.json([...traktMovies, ...doubanData]);
    } else if (doubanData && typeof doubanData === 'object') {
      // 结构 B：带外壳的对象，比如 { data: [...] } 或 { list: [...] }
      if (Array.isArray(doubanData.data)) {
        doubanData.data = [...traktMovies, ...doubanData.data];
      } else if (Array.isArray(doubanData.items)) {
        doubanData.items = [...traktMovies, ...doubanData.items];
      } else if (Array.isArray(doubanData.list)) {
        doubanData.list = [...traktMovies, ...doubanData.list];
      }
      return c.json(doubanData);
    }

    // 如果结构完全看不懂，不合并了，原样返回豆瓣，保证界面不消失
    return c.json(doubanData);

  } catch (error) {
    console.error("合并接口致命错误:", error);
    // 终极兜底：如果代码抛错，直接代理原版豆瓣文件，假装无事发生
    const fallbackUrl = `https://${R2_CUSTOM_DOMAIN}/douban-movies.json`;
    const fallbackRes = await fetch(fallbackUrl);
    return new Response(fallbackRes.body, { 
      status: fallbackRes.status, 
      headers: { "Content-Type": "application/json" } 
    });
  }
});

// =====================================
// 其他分类接口 (保持原样不动)
// =====================================

app.get("/popular/douban/tv", async (c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/douban-tv.json`;
  const response = await fetch(url);
  return new Response(response.body, { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") || "application/json" } });
});

app.get("/popular/douban/animation", async (c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/douban-animation.json`;
  const response = await fetch(url);
  return new Response(response.body, { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") || "application/json" } });
});

app.get("/popular/douban/hot-variety-shows", async (c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/douban-hot-variety-shows.json`;
  const response = await fetch(url);
  return new Response(response.body, { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") || "application/json" } });
});

app.get("/popular/bangumi/animation", async (c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/bangumi-animation.json`;
  const response = await fetch(url);
  return new Response(response.body, { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") || "application/json" } });
});

app.get("/discover/tv-by-language", async (c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/discover-tv-by-language.json`;
  const response = await fetch(url);
  return new Response(response.body, { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") || "application/json" } });
});

app.get("/discover/tv-by-network", async (c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/discover-tv-by-network.json`;
  const response = await fetch(url);
  return new Response(response.body, { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") || "application/json" } });
});

export default app;

import { Hono } from "hono";
import {
  crawlBangumiAnimation,
  crawlDoubanAnimation,
  crawlDoubanHotVarietyShows,
  crawlDoubanMovies,
  crawlDoubanTVSeries,
} from "./crawlers.js";

// 声明 Cloudflare 环境变量类型
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
    
    // ⚠️ 极其保守的格式：绝不多传任何可能导致前端崩溃的字段，只传 title
    return data.map((item: any) => ({
      title: item.movie.title
    }));
  } catch (error) {
    console.error("Error fetching Trakt:", error);
    return [];
  }
}

// =====================================
// 原有爬虫逻辑 (一字不改)
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

    const [
      movies,
      tvSeries,
      doubanAnimation,
      hotVarietyShows,
      bangumiAnimation,
    ] = await Promise.all([
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
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// =====================================
// 🔥 改造合并接口：Trakt + 豆瓣电影
// =====================================
app.get("/popular/douban/movies", async (c) => {
  try {
    // 1. 获取安全的 Trakt 数据
    let traktMovies: any[] = [];
    const clientId = c.env.TRAKT_CLIENT_ID?.trim();
    if (clientId) {
      traktMovies = await fetchTraktTrending(clientId);
    }

    // 2. 获取原本的豆瓣数据
    const doubanUrl = `https://${R2_CUSTOM_DOMAIN}/douban-movies.json`;
    const doubanResponse = await fetch(doubanUrl);
    
    // 如果获取豆瓣失败，直接只返回 Trakt
    if (!doubanResponse.ok) {
      return c.json(traktMovies);
    }

    const doubanData = await doubanResponse.json();

    // 3. 安全合并（假设豆瓣返回的是数组）
    if (Array.isArray(doubanData)) {
      const combined = [...traktMovies, ...doubanData];
      return c.json(combined);
    } 
    
    // 如果豆瓣返回的不是数组，为了防止 App 崩溃，原样返回豆瓣数据
    return c.json(doubanData);

  } catch (error) {
    console.error("合并错误:", error);
    // 终极兜底：报错时原样转发豆瓣数据
    const fallbackUrl = `https://${R2_CUSTOM_DOMAIN}/douban-movies.json`;
    const fallbackRes = await fetch(fallbackUrl);
    return new Response(fallbackRes.body, {
      status: fallbackRes.status,
      headers: {
        "Content-Type": fallbackRes.headers.get("Content-Type") || "application/json",
      },
    });
  }
});

// =====================================
// 其他原始接口 (一字不改)
// =====================================

app.get("/popular/douban/tv", async (c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/douban-tv.json`;
  const response = await fetch(url);
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") || "application/json",
    },
  });
});

app.get("/popular/douban/animation", async (c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/douban-animation.json`;
  const response = await fetch(url);
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") || "application/json",
    },
  });
});

app.get("/popular/douban/hot-variety-shows", async (c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/douban-hot-variety-shows.json`;
  const response = await fetch(url);
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") || "application/json",
    },
  });
});

app.get("/popular/bangumi/animation", async (c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/bangumi-animation.json`;
  const response = await fetch(url);
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") || "application/json",
    },
  });
});

app.get("/discover/tv-by-language", async (c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/discover-tv-by-language.json`;
  const response = await fetch(url);
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") || "application/json",
    },
  });
});

app.get("/discover/tv-by-network", async (c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/discover-tv-by-network.json`;
  const response = await fetch(url);
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") || "application/json",
    },
  });
});

export default app;

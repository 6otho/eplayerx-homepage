import { Hono } from "hono";
import {
  crawlBangumiAnimation,
  crawlDoubanAnimation,
  crawlDoubanHotVarietyShows,
  crawlDoubanMovies,
  crawlDoubanTVSeries,
} from "./crawlers.js";

// 🔥 新增：声明 Cloudflare 环境变量类型
type Bindings = {
  TRAKT_CLIENT_ID: string;
};

const R2_CUSTOM_DOMAIN = process.env.R2_CUSTOM_DOMAIN || "assets.eplayerx.com";

// 注入环境变量类型
const app = new Hono<{ Bindings: Bindings }>();

// =====================================
// 🔥 新增：Trakt 实时获取工具函数
// =====================================
async function fetchTraktTrending(clientId: string) {
  try {
    // 获取前 20 个热门数据
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
    
    // 整理成原项目可以识别的格式 (提取 title 供原系统去匹配 TMDB 海报)
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
// 原有路由保持不变
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

    // Run all crawlers in parallel for better performance
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

app.get("/popular/douban/movies", async (c) => {
  const url = `https://${R2_CUSTOM_DOMAIN}/douban-movies.json`;
  const response = await fetch(url);
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") || "application/json",
    },
  });
});

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

// =====================================
// 🔥 新增：供前端调用的 Trakt 接口
// =====================================
app.get("/popular/trakt/trending", async (c) => {
  // 从 Cloudflare 面板拿环境变量
  const clientId = c.env.TRAKT_CLIENT_ID?.trim();
  
  if (!clientId) {
    return c.json({ error: "Missing TRAKT_CLIENT_ID in Cloudflare environment variables" }, 500);
  }

  // 实时抓取前 20 条热门
  const items = await fetchTraktTrending(clientId);
  
  // 原作者的 /popular 接口都是直接返回数组的，所以这里也直接返回 items 数组
  return c.json(items);
});

export default app;

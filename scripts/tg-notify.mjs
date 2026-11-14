#!/usr/bin/env node
/**
 * 跑完 crawler / backfill 后，把本次变化汇总推送到 Telegram。
 * 通过 movie-api 的 /action/tg_notify 转发（那里已有 TG_BOT_TOKEN/CHAT_ID）。
 *
 * 用法:
 *   node scripts/tg-notify.mjs crawler   # 爬虫跑完
 *   node scripts/tg-notify.mjs backfill  # 补评分跑完
 *
 * 依赖环境变量:
 *   WORKER_URL     例如 https://movie-api.l3okuu.workers.dev
 *   ADMIN_SECRET   后台密码
 *   R2_*           用于直接读 R2 对比（可选）
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

const STAGE = process.argv[2] || "crawler";

const WORKER_URL = (process.env.WORKER_URL || "https://movie-api.l3okuu.workers.dev").replace(/\/$/, "");
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const BUCKET = process.env.R2_BUCKET_NAME;
const ACCOUNT = process.env.R2_ACCOUNT_ID;

const s3 = ACCOUNT && BUCKET && process.env.R2_ACCESS_KEY_ID
  ? new S3Client({
      region: "auto",
      endpoint: `https://${ACCOUNT}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    })
  : null;

const SKIP = new Set([
  "blacklist.json", "cron_state.json", "layout-config.json", "schedule-override.json",
  "eplayerx-boxes.json", "eplayerx-folders.json", "mdblist-ratings-cache.json",
]);

async function readJson(key) {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return JSON.parse(await r.Body.transformToString());
  } catch {
    return null;
  }
}

async function listKeys() {
  const out = [];
  let token;
  do {
    const r = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET, ContinuationToken: token, MaxKeys: 1000,
    }));
    for (const o of r.Contents || []) {
      if (o.Key?.endsWith(".json") && !SKIP.has(o.Key) && !o.Key.startsWith("_$") && !o.Key.startsWith("reviews/")) {
        out.push({ key: o.Key, size: o.Size, modified: o.LastModified });
      }
    }
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return out;
}

/** 本次运行开始时间（GitHub 提供），用来判断哪些文件是这次改的 */
// GitHub 没有直接给"本次运行开始时间"，用最近 90 分钟作为窗口（跑完整条链路足够）
const RUN_STARTED = Date.now() - 90 * 60 * 1000;

const CATEGORY_NAMES = {
  "bangumi-animation.json": "Bangumi 热门动画",
  "douban-animation.json": "豆瓣热门动画",
  "douban-baiye.json": "白夜剧场",
  "douban-hot-variety-shows.json": "豆瓣热门综艺",
  "douban-japanese-tv.json": "热门日剧",
  "douban-jifeng.json": "疾风剧场",
  "douban-lianlian.json": "恋恋剧场",
  "douban-miwu.json": "迷雾剧场",
  "douban-shenghua.json": "生花剧场",
  "douban-tv.json": "豆瓣热门剧集",
  "douban-x.json": "X 剧场",
  "douban-yinghuo.json": "萤火剧场",
  "guest_trakt-movies.json": "访客热门电影",
  "guest_trakt-shows.json": "访客热门剧集",
  "hami-taiwanese-tv.json": "Hami 台剧",
  "imdb-top-movies.json": "IMDb 高分电影",
  "theater-baiye.json": "白夜剧场排期",
  "theater-jifeng.json": "疾风剧场排期",
  "theater-lianlian.json": "恋恋剧场排期",
  "theater-miwu.json": "迷雾剧场排期",
  "theater-shenghua.json": "生花剧场排期",
  "theater-x.json": "X 剧场排期",
  "theater-yinghuo.json": "萤火剧场排期",
  "tmdb-filmarks-jp.json": "Filmarks 日影热门",
  "tmdb-netflix-movies.json": "Netflix 热门电影",
  "tmdb-tv-netflix-hbo.json": "Netflix & HBO 剧集",
  "weekly-anime.json": "番剧周更表",
  "weekly-cn-drama.json": "国产剧周更表",
  "weekly-ecchi.json": "肉番周更表",
  "weekly_ecchi_collection.json": "肉番周更表",
  "bangumi-airing.json": "今日热门番剧",
  "douban-korean-tv.json": "热门韩剧安利",
  "douban-movies.json": "实时热门电影",
  "douban-tv-custom.json": "时下热门国产剧",
  "filmarks-anime-movie.json": "Filmarks 高分剧场版",
  "imdb-top-anime.json": "IMDb 史诗动漫神作",
  "netflix-hot-anime.json": "Netflix 独播霸榜日漫",
  "netflix-movie-minor.json": "冷门却惊艳的宝藏外国片",
  "netflix-tv-minor.json": "别被语言劝退的网飞神剧",
  "prime-hot-anime.json": "Prime Video 热门日漫",
  "tmdb-anime-cn.json": "热门国产动漫",
  "tmdb-anime-jp.json": "近期热门日本动漫",
  "tmdb-anime-movie-ja.json": "美到想截屏的动画电影",
  "tmdb-anime-top-ja.json": "TMDB 高分神作日漫",
  "tmdb-movie-hk-erotic-comedy.json": "尽皆癫狂的港产喜剧",
  "tmdb-movie-sea.json": "荷尔蒙溢出的东南亚",
  "tmdb-movie-th.json": "别只看鬼片的泰国电影",
  "tmdb-movie-tw.json": "台味正浓的宝藏台片",
  "tmdb-popular-movies.json": "今日热门电影",
  "tmdb-popular-tv.json": "今日热门电视剧",
  "tmdb-tv-apple.json": "Apple TV+ 原创精品",
  "tmdb-tv-bl.json": "眼神狂拉丝的亚洲耽美神作",
  "tmdb-tv-es.json": "反转停不下来的西语爽剧",
  "tmdb-tv-hbo.json": "HBO 高分神剧",
  "tmdb-tv-ja.json": "专治精神内耗的日剧",
  "tmdb-tv-netflix.json": "Netflix 全球热播好剧",
  "tmdb-tv-th.json": "越狗血越上头的爆款泰剧",
  "tmdb-tv-tw.json": "现在台剧都这么敢拍？",
  "trakt-movies.json": "视效轰炸欧美大片",
  "trakt-shows.json": "时下热播欧美剧集",
  "variety-cn.json": "热门国产综艺",
  "variety-global.json": "全球流媒体新热综艺",
  "variety-kr.json": "爆款韩国综艺",
  "weekly_anime_collection.json": "巴哈新番周更表",
  "weekly_drama_collection.json": "国产追剧周更表",
  "weekly_guoman_collection.json": "国漫追番周历表",
  "weekly_japanese_drama_collection.json": "日剧追剧周更表",
  "weekly_korean_drama_collection.json": "韩剧追剧周更表",
  "weekly_sea_drama_collection.json": "东南亚剧周更表",
};

/** 用中文名显示分类 */
function labelOf(key) {
  if (CATEGORY_NAMES[key]) return CATEGORY_NAMES[key];
  // 周更表按天分文件：weekly_drama_collection-3.json
  const m = key.match(/^(.+)-\d+\.json$/);
  if (m && CATEGORY_NAMES[m[1] + ".json"]) return CATEGORY_NAMES[m[1] + ".json"];
  return key.replace(/\.json$/, "").replace(/_/g, " ");
}

function fmtNames(items, max = 12) {
  const names = items.slice(0, max).map((x) => `  · ${x.name || x.title || x.tmdbId}`);
  if (items.length > max) names.push(`  · …等 ${items.length} 条`);
  return names.join("\n");
}

async function main() {
  if (!s3) {
    console.log("⚠️ 缺少 R2 配置，跳过通知");
    return;
  }

  const keys = await listKeys();

  // 找出这次运行期间被改动的文件
  const touched = keys.filter((k) => k.modified && k.modified.getTime() >= RUN_STARTED - 5000);

  if (touched.length === 0) {
    console.log("本次没有文件变动，不发送通知");
    return;
  }

  // 逐文件统计条目
  const lines = [];
  let totalItems = 0;

  for (const k of touched.sort((a, b) => a.modified - b.modified)) {
    const json = await readJson(k.key);
    const items = Array.isArray(json?.data) ? json.data : [];
    if (!items.length) continue;
    totalItems += items.length;
    const label = labelOf(k.key);
    lines.push(`<b>${label}</b>  ${items.length} 条`);
  }

  const title = STAGE === "crawler"
    ? "🕷 <b>爬虫完成</b>"
    : "📊 <b>评分补全完成</b>";

  // 🆕 读取快照对比结果，列出新增条目名称
  let addLines = [];
  let addedCount = 0;
  try {
    const raw = await import("node:fs").then((m) => m.default.readFileSync("/tmp/new-items.json", "utf8"));
    const diff = JSON.parse(raw);
    addedCount = (diff.added || []).length;
    const cats = diff.counts || {};
    if (addedCount > 0) {
      addLines.push("");
      addLines.push(`🆕 <b>新增 ${addedCount} 条</b>`);
      // 按分类分组展示
      const byCat = new Map();
      for (const a of diff.added) {
        if (!byCat.has(a.cat)) byCat.set(a.cat, []);
        byCat.get(a.cat).push(a.name);
      }
      for (const [cat, names] of byCat) {
        addLines.push(`<b>${cat}</b>（${names.length}）`);
        for (const n of names.slice(0, 10)) addLines.push(`  · ${n}`);
        if (names.length > 10) addLines.push(`  · …等 ${names.length} 条`);
      }
    }
  } catch {
    // 没有快照文件，跳过
  }

  const text = [
    title,
    "═══════════════════",
    `📁 更新分类：<b>${touched.length}</b> 个`,
    `📦 涉及条目：<b>${totalItems}</b> 条`,
    ...addLines,
    "",
    ...lines.slice(0, 20),
    touched.length > 20 ? `…等 ${touched.length} 个分类` : "",
    "",
    `<i>${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</i>`,
  ].filter((x) => x !== undefined).join("\n");

  const res = await fetch(`${WORKER_URL}/action/tg_notify`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ADMIN_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  const j = await res.json().catch(() => ({}));
  console.log(`TG 通知: ${res.status} ${JSON.stringify(j)}`);
}

main().catch((e) => {
  console.error("通知失败:", e?.message || e);
  process.exit(0); // 通知失败不影响主流程
});

#!/usr/bin/env node
/**
 * 记录/对比条目快照，用来找出"新增了什么"。
 *
 * 用法:
 *   node scripts/tg-snapshot.mjs save     # 跑爬虫前，保存当前所有条目 ID+名称
 *   node scripts/tg-snapshot.mjs diff     # 跑完后，对比并输出新增条目（写 /tmp/new-items.json）
 *
 * 快照存在 R2 的 _$snapshot.json（下划线开头，其它脚本会跳过）
 */

import fs from "node:fs";
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const MODE = process.argv[2] || "save";
const BUCKET = process.env.R2_BUCKET_NAME;
const ACCOUNT = process.env.R2_ACCOUNT_ID;
const SNAP_KEY = "_$snapshot.json";
const OUT = "/tmp/new-items.json";

const s3 = ACCOUNT && BUCKET
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
      if (o.Key?.endsWith(".json") && !SKIP.has(o.Key) && !o.Key.startsWith("_$") && !o.Key.startsWith("reviews/") && isKnownCategory(o.Key)) out.push(o.Key);
    }
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return out;
}

/** 收集 { "分类文件": [ {id, name} ] } */
async function collect() {
  const keys = await listKeys();
  const data = {};
  for (const key of keys) {
    const json = await readJson(key);
    const items = Array.isArray(json?.data) ? json.data : [];
    if (!items.length) continue;
    data[key] = items
      .map((x) => ({
        id: String(x.tmdbId || x.id || ""),
        name: String(x.name || x.title || "").trim(),
        date: String(x.release_date || x.first_air_date || x.air_date || "").slice(0, 10),
      }))
      .filter((x) => x.id);
  }
  return data;
}

const CATEGORY_NAMES = {
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

/** 是否属于 movie-api 实际拥有的分类（其它文件不纳入通知） */
function isKnownCategory(key) {
  if (CATEGORY_NAMES[key]) return true;
  const m = key.match(/^(.+)-\d+\.json$/);
  return !!(m && CATEGORY_NAMES[m[1] + ".json"]);
}

function labelOf(key) {
  if (CATEGORY_NAMES[key]) return CATEGORY_NAMES[key];
  const m = key.match(/^(.+)-\d+\.json$/);
  if (m && CATEGORY_NAMES[m[1] + ".json"]) return CATEGORY_NAMES[m[1] + ".json"];
  return key.replace(/\.json$/, "").replace(/_/g, " ");
}

async function main() {
  if (!s3) {
    console.log("⚠️ 缺少 R2 配置，跳过");
    return;
  }

  const current = await collect();

  if (MODE === "save") {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: SNAP_KEY,
      Body: JSON.stringify(current),
      ContentType: "application/json",
    }));
    const total = Object.values(current).reduce((s, v) => s + v.length, 0);
    console.log(`✅ 快照已保存：${Object.keys(current).length} 个文件 / ${total} 条`);
    return;
  }

  // ---- diff ----
  const old = (await readJson(SNAP_KEY)) || {};
  const added = [];
  const counts = {};

  for (const [key, items] of Object.entries(current)) {
    const oldIds = new Set((old[key] || []).map((x) => x.id));
    const fresh = items.filter((x) => !oldIds.has(x.id));
    if (fresh.length) {
      counts[key] = fresh.length;
      for (const it of fresh) added.push({ cat: labelOf(key), name: it.name, date: it.date || "" });
    }
  }

  // 🆕 另外收集"最近更新"的条目：按 release_date / first_air_date 取最近的
  const recent = [];
  for (const [key, items] of Object.entries(current)) {
    const pool = items
      .filter((x) => x.date && /^\d{4}-\d{2}-\d{2}/.test(x.date))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 2);
    for (const it of pool) recent.push({ cat: labelOf(key), name: it.name, date: it.date.slice(0, 10) });
  }
  recent.sort((a, b) => b.date.localeCompare(a.date));

  fs.writeFileSync(OUT, JSON.stringify({ counts, added, recent }, null, 2));
  console.log(`📊 新增：${added.length} 条，涉及 ${Object.keys(counts).length} 个分类`);
  for (const [k, v] of Object.entries(counts)) console.log(`   ${labelOf(k)}: +${v}`);
  if (added.length) {
    console.log("   —— 新增明细 ——");
    for (const a of added.slice(0, 30)) console.log(`   · [${a.cat}] ${a.name}`);
  }
  if (recent.length) {
    console.log("   —— 最近更新 TOP ——");
    for (const r of recent.slice(0, 12)) console.log(`   · ${r.date} [${r.cat}] ${r.name}`);
  }
}

main().catch((e) => {
  console.error("快照失败:", e?.message || e);
  process.exit(1);
});

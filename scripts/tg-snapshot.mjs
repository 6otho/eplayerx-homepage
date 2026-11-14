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
      if (o.Key?.endsWith(".json") && !SKIP.has(o.Key) && !o.Key.startsWith("_$")) out.push(o.Key);
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
      }))
      .filter((x) => x.id);
  }
  return data;
}

function labelOf(key) {
  return key.replace(/\.json$/, "")
    .replace(/^weekly_/, "")
    .replace(/_collection-\d+$/, "周更表")
    .replace(/_/g, " ");
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
      for (const it of fresh) added.push({ cat: labelOf(key), name: it.name });
    }
  }

  fs.writeFileSync(OUT, JSON.stringify({ counts, added }, null, 2));
  console.log(`📊 新增：${added.length} 条，涉及 ${Object.keys(counts).length} 个分类`);
  for (const [k, v] of Object.entries(counts)) console.log(`   ${labelOf(k)}: +${v}`);
  if (added.length) {
    console.log("   —— 明细 ——");
    for (const a of added.slice(0, 30)) console.log(`   · [${a.cat}] ${a.name}`);
  }
}

main().catch((e) => {
  console.error("快照失败:", e?.message || e);
  process.exit(1);
});

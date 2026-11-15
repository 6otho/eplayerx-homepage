#!/usr/bin/env node
/**
 * 统一通知：由 backfill 在工作流最后一步调用。
 * 把队列里排着的「爬虫完成」通知，与「评分补全」汇总合并成一条发出去。
 * 周更汇总由 CF cron 侧直接写入队列，也会一并合并。
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

const WORKER_URL = (process.env.WORKER_URL || "https://movie-api.l3okuu.workers.dev").replace(/\/$/, "");
const ADMIN_SECRET = process.env.ADMIN_SECRET || "080808";
const BUCKET = process.env.R2_BUCKET_NAME;
const ACCOUNT = process.env.R2_ACCOUNT_ID;

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
  "eplayerx-boxes.json", "eplayerx-folders.json", "mdblist-ratings-cache.json", "tg_queue.json",
]);

async function listChanged(withinMin = 180) {
  if (!s3) return [];
  const out = [];
  let token;
  const cutoff = Date.now() - withinMin * 60 * 1000;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token, MaxKeys: 1000 }));
    for (const o of r.Contents || []) {
      if (!o.Key?.endsWith(".json")) continue;
      if (SKIP.has(o.Key) || o.Key.startsWith("_$") || o.Key.startsWith("reviews/")) continue;
      if (o.LastModified && o.LastModified.getTime() >= cutoff) out.push(o.Key);
    }
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return out;
}

async function countItems(key) {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const j = JSON.parse(await r.Body.transformToString());
    return Array.isArray(j?.data) ? j.data.length : 0;
  } catch {
    return 0;
  }
}

async function main() {
  const changed = await listChanged();
  let total = 0;
  for (const k of changed) total += await countItems(k);

  // 评分补全这部分用自己的汇总行（不列出每个分类，避免太长）
  const stageText = changed.length
    ? `📊 <b>评分 / 图片补全完成</b>\n═══════════════════\n📁 涉及分类：<b>${changed.length}</b> 个\n📦 涉及条目：<b>${total}</b> 条`
    : `📊 <b>评分 / 图片补全完成</b>\n═══════════════════\n（本次无数据变化）`;

  const res = await fetch(`${WORKER_URL}/action/tg_flush`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ADMIN_SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: stageText }),
  });
  const j = await res.json().catch(() => ({}));
  console.log(`TG 合并通知: ${res.status} ${JSON.stringify(j)}`);
}

main().catch((e) => {
  console.error("通知失败:", e?.message || e);
  process.exit(0); // 通知失败不影响主流程
});

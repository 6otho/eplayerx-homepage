/**
 * 🎯 评分 / 图片 全量补全脚本（GitHub Actions 专用）
 *
 * 与 Cloudflare Worker 的区别：
 *   - 无子请求限制（可以查几万次）
 *   - 无 30 秒 CPU 限制（可以跑 6 小时）
 *   - 支持断点续跑、失败重试
 *
 * 用法：
 *   bun run scripts/backfill-ratings.ts                 # 补所有分类
 *   bun run scripts/backfill-ratings.ts netflix_tv_minor # 只补一个分类
 *   CATEGORY_FILTER=xxx FORCE=1 bun run ...
 */

import { listR2Keys, getRawJson, putRawJson } from "../src/blocks/storage.js";
import {
	fetchItemRatings,
	MdblistRateLimitError,
	parseMdblistApiKeys,
} from "../src/ratings/mdblist.js";

const REQUIRED = ["tmdb", "imdb", "trakt", "letterboxd"] as const;
const MAX_ITEM_RETRIES = 2;
const CONCURRENCY = 1; // MDBList 有速率限制，串行最稳

interface ItemLike {
	tmdbId?: number;
	id?: number;
	media_type?: string;
	title?: string;
	name?: string;
	imdbId?: string;
	original_language?: string;
	vote_average?: number;
	ratings?: Record<string, number>;
	ratings_missing?: number;
	logo?: string;
	noLogoPoster?: string;
	backdrop_path?: string;
	poster_path?: string;
	thumb?: string;
	[key: string]: unknown;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function missingSources(r: Record<string, number> | undefined): string[] {
	const out: string[] = [];
	if (!r || !Object.keys(r).length) return [...REQUIRED];
	for (const k of REQUIRED) {
		if (!r[k]) out.push(k);
	}
	return out;
}

function isComplete(r: Record<string, number> | undefined): boolean {
	return missingSources(r).length === 0;
}

function fileNameFor(catId: string): string {
	if (catId.endsWith("_collection")) return catId; // 周更表单独处理
	return `${catId}.json`;
}

/** 判断是否为周更表按天拆分的文件（如 weekly_drama_collection-3.json） */
function isWeeklyDayFile(key: string): boolean {
	return /_collection-\d\.json$/.test(key);
}

async function main(): Promise<void> {
	const argCat = process.argv[2];
	const filter = argCat || process.env.CATEGORY_FILTER || "";
	const keys = parseMdblistApiKeys();
	console.log(`MDBList keys: ${keys.length}`);
	if (keys.length === 0) {
		console.error("❌ MDBLIST_API_KEY 未配置");
		process.exit(1);
	}

	// 列出所有 JSON 数据文件
	const allKeys = await listR2Keys("");
	const dataFiles = allKeys
		.filter((k) => k.endsWith(".json"))
		.filter((k) => !["blacklist.json", "cron_state.json", "layout-config.json", "schedule-override.json", "eplayerx-boxes.json", "eplayerx-folders.json", "mdblist-ratings-cache.json"].includes(k))
		.filter((k) => !k.startsWith("_$"))
		.filter((k) => (filter ? k.includes(filter) : true));

	console.log(`待处理文件: ${dataFiles.length}`);

	let grandTotal = 0;
	let grandFilled = 0;
	let grandFailed = 0;

	for (const key of dataFiles) {
		let json: { data?: ItemLike[]; count?: number; lastUpdated?: string };
		try {
			json = (await getRawJson(key)) as { data?: ItemLike[] };
		} catch {
			continue;
		}
		const items = json?.data;
		if (!Array.isArray(items) || items.length === 0) continue;

		// 周更表按天拆分的文件名，跳过（由主文件处理）
		const pending: number[] = [];
		items.forEach((it, i) => {
			const r = (it.ratings || {}) as Record<string, number>;
			if (isComplete(r)) return;
			// 前 20 条强制补；之后最多重试 2 次
			if (i < 20) pending.push(i);
			else if ((it.ratings_missing || 0) < MAX_ITEM_RETRIES) pending.push(i);
		});

		if (pending.length === 0) {
			console.log(`✅ ${key}: 已完整 (${items.length} 条)`);
			continue;
		}

		console.log(`\n▶ ${key}: ${pending.length}/${items.length} 条待补`);
		grandTotal += pending.length;

		let changed = false;
		let filled = 0;
		let failed = 0;
		let quotaHit = false;

		for (const idx of pending) {
			const it = items[idx];
			const tmdbId = it.tmdbId || it.id;
			if (!tmdbId) continue;
			const mt = String(it.media_type || "tv").toLowerCase().includes("movie") ? "movie" : "tv";

			try {
				const ratings = await fetchItemRatings(tmdbId as number, mt as "movie" | "tv");
				const prev = (it.ratings || {}) as Record<string, number>;
				const merged: Record<string, number> = { ...prev };
				for (const [k, v] of Object.entries(ratings)) {
					if (typeof v === "number" && Number.isFinite(v) && v > 0) merged[k] = v;
				}
				// 别名：tomatoes / letterboxd 与 worker 端保持兼容
				if (merged.tomatoes && !merged.rotten_tomatoes) merged.rotten_tomatoes = merged.tomatoes;

				const before = missingSources(prev).length;
				const after = missingSources(merged).length;
				it.ratings = merged;
				if (after < before) {
					filled++;
					delete it.ratings_missing;
					changed = true;
				} else {
					it.ratings_missing = (it.ratings_missing || 0) + 1;
					changed = true;
				}
				if (isComplete(merged)) delete it.ratings_missing;
			} catch (error) {
				if (error instanceof MdblistRateLimitError) {
					quotaHit = true;
					console.warn("  ⚠️ MDBList 额度耗尽，保存进度后退出");
					break;
				}
				it.ratings_missing = (it.ratings_missing || 0) + 1;
				failed++;
				changed = true;
			}
			await sleep(120);
		}

		if (changed) {
			json.count = items.length;
			json.lastUpdated = new Date().toISOString();
			await putRawJson(key, json);
			console.log(`  💾 已写入: 补全 ${filled} 条，失败 ${failed} 条`);
		}
		grandFilled += filled;
		grandFailed += failed;
		if (quotaHit) {
			console.warn("\n⚠️ 今日 MDBList 额度已用完，明天会自动继续（进度已保存）");
			break;
		}
	}

	console.log(`\n═══════════════════════════`);
	console.log(`总计待补: ${grandTotal}`);
	console.log(`成功补全: ${grandFilled}`);
	console.log(`失败: ${grandFailed}`);
	console.log(`═══════════════════════════`);
}

main().catch((e) => {
	console.error("❌ 运行失败:", e);
	process.exit(1);
});

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
import { fetchDetailsWithEnrichment } from "../src/crawler/tmdb-enrich.js";

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
	console.log(`R2 bucket: ${process.env.R2_BUCKET_NAME || "(未设置)"}, account: ${process.env.R2_ACCOUNT_ID ? "已设置" : "(未设置)"}`);
	const allKeys = await listR2Keys("");
	console.log(`R2 文件总数: ${allKeys.length}`);
	if (allKeys.length === 0) {
		console.error("❌ R2 未列出任何文件，检查 R2_* secrets 是否正确");
		process.exit(1);
	}
	const dataFiles = allKeys
		.filter((k) => k.endsWith(".json"))
		.filter((k) => !["blacklist.json", "cron_state.json", "layout-config.json", "schedule-override.json", "eplayerx-boxes.json", "eplayerx-folders.json", "mdblist-ratings-cache.json"].includes(k))
		.filter((k) => !k.startsWith("_$"))
		// 分类 id 用下划线（netflix_movie_minor），R2 文件名用横线（netflix-movie-minor.json）
		.filter((k) => {
			if (!filter) return true;
			const norm = (s: string) => s.toLowerCase().replace(/[-_]/g, "");
			return norm(k).includes(norm(filter));
		});

	console.log(`待处理文件: ${dataFiles.length} (filter="${filter}", argv="${argCat || ""}")`);

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
			const needRating = !isComplete(r);
			// 缺图判定（手动指定的不算缺）
			const hasLogo = !!it.logo && !String(it.logo).includes("text_logo.svg");
			const needLogo = !hasLogo && it.logo_source !== "manual";
			const needClean = !it.noLogoPoster && it.no_logo_poster_source !== "manual";
			const needAsset = needLogo || needClean;

			if (!needRating && !needAsset) return;
			// 前 20 条强制；之后评分最多重试 2 次，图片缺就补
			if (i < 20) pending.push(i);
			else if (needAsset || (it.ratings_missing || 0) < MAX_ITEM_RETRIES) pending.push(i);
		});

		if (pending.length === 0) {
			console.log(`✅ ${key}: 已完整 (${items.length} 条)`);
			continue;
		}

		console.log(`\n▶ ${key}: ${pending.length}/${items.length} 条待补`);
		grandTotal += pending.length;

		let changed = false;
		let filled = 0;
		let assetFilled = 0;
		let failed = 0;
		let quotaHit = false;

		for (const idx of pending) {
			const it = items[idx];
			const tmdbId = it.tmdbId || it.id;
			if (!tmdbId) continue;
			const mt = String(it.media_type || "tv").toLowerCase().includes("movie") ? "movie" : "tv";

			try {
				// 一次 TMDB 请求拿到：详情 + IMDb ID + Logo + 无字海报 + 剧照
				const lang = String(it.original_language || "").toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
				const enriched = await fetchDetailsWithEnrichment(
					tmdbId as number,
					mt as "movie" | "tv",
					lang,
					undefined,
					String(it.original_language || ""),
				);

				if (!enriched) {
					console.warn(`  ⚠️ ${it.name || it.title} (${tmdbId}) TMDB 详情返回 null`);
				}
				if (enriched) {
					const meta = enriched.imageMeta;
					if (!meta.logo && !meta.noLogoPoster) {
						console.warn(`  ⚠️ ${it.name || it.title} (${tmdbId}) 无 logo/无字海报: logo=${meta.logo} poster=${meta.noLogoPoster}`);
					}
					const abs = (p?: string | null) =>
						!p ? null : p.startsWith("http") ? p : `https://image.tmdb.org/t/p/original${p}`;

					// 🖼️ Logo：仅在没手动指定时写入
					if (meta.logo && it.logo_source !== "manual") {
						const v = abs(meta.logo);
						if (v && it.logo !== v) {
							it.logo = v;
							it.logo_source = "auto";
							changed = true;
							assetFilled++;
						}
					}
					// 🎴 无字竖图：仅在没手动指定时写入
					if (meta.noLogoPoster && it.no_logo_poster_source !== "manual") {
						const v = abs(meta.noLogoPoster);
						if (v && it.noLogoPoster !== v) {
							it.noLogoPoster = v;
							it.no_logo_poster_source = "auto";
							changed = true;
							assetFilled++;
						}
					}
					// 🎬 横版剧照
					if (meta.thumb && it.thumb_source !== "manual") {
						const v = abs(meta.thumb);
						if (v && it.thumb !== v) {
							it.thumb = v;
							it.thumb_source = "auto";
							changed = true;
						}
					}
					// imdbId 回填（供评分查询用）
					if (enriched.externalIds?.imdbId && !it.imdbId) it.imdbId = enriched.externalIds.imdbId;
					if (enriched.tmdbData?.vote_average && !it.vote_average) it.vote_average = enriched.tmdbData.vote_average;
				}

				if (quotaHit) {
					// MDBList 额度已用完：图片（走 TMDB）照常补，只跳过评分
					// 这样即使额度耗尽，Logo / 无字海报依然能全部抓完
				} else {
					try {
						const ratings = await fetchItemRatings(tmdbId as number, mt as "movie" | "tv");
						const prev = (it.ratings || {}) as Record<string, number>;
						const merged: Record<string, number> = { ...prev };
						for (const [k, v] of Object.entries(ratings)) {
							if (typeof v === "number" && Number.isFinite(v) && v > 0) merged[k] = v;
						}
						// 别名：tomatoes 与 worker 端保持兼容
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
							console.warn("  ⚠️ MDBList 额度耗尽 → 继续补图片（TMDB 不占额度）");
						} else {
							console.warn(`  ⚠️ ${key} #${idx} (${it.name || it.title || tmdbId}) 评分失败: ${(error as Error)?.message || error}`);
							it.ratings_missing = (it.ratings_missing || 0) + 1;
							failed++;
							changed = true;
						}
					}
				}
			await sleep(120);
		}

		if (changed) {
			json.count = items.length;
			json.lastUpdated = new Date().toISOString();
			await putRawJson(key, json);
			console.log(`  💾 已写入: 评分 ${filled} 条 | 图片 ${assetFilled} 处 | 失败 ${failed} 条`);
		}
		grandFilled += filled;
		grandFailed += failed;
		// ⚠️ 额度耗尽后不再提前退出：图片（TMDB）继续补完，只有评分停下
		if (quotaHit) {
			console.warn("  ℹ️ 本文件评分因额度耗尽跳过，图片已尽力补全");
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

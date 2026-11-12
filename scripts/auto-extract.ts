/**
 * 🎯 自动提取（模拟手动点「提取评分/图标」按钮）
 *
 * 原因：实测证明，只有走截取接口客户端才会更新显示。
 *       刷新、改时间戳、改评分都不行。
 *
 * 做法：对每个分类的前 N 条，调用 movie-api 的 batch_force_logo。
 *      和你在面板上勾选后点按钮，走的是完全同一个接口。
 *
 * 环境变量：
 *   MOVIE_API_BASE   movie-api 地址
 *   ADMIN_SECRET     面板密码
 *   TOP_N            每分类提取条数（默认 20）
 *   CATEGORY_FILTER  只处理指定分类（可选）
 */

import { listR2Keys, getRawJson } from "../src/blocks/storage.js";

const CACHE_KEY = "mdblist-ratings-cache.json";
const SKIP = new Set([
	"blacklist.json", "cron_state.json", "layout-config.json", "schedule-override.json",
	"eplayerx-boxes.json", "eplayerx-folders.json", CACHE_KEY,
]);

interface Item {
	tmdbId?: number;
	id?: number;
	media_type?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 文件名 → movie-api 分类 id（横线转下划线） */
function toCategoryId(fileKey: string): string {
	return fileKey.replace(/\.json$/, "").replace(/-/g, "_");
}

async function main(): Promise<void> {
	const base = (process.env.MOVIE_API_BASE || "https://movie-api.l3okuu.workers.dev").replace(/\/$/, "");
	const pwd = process.env.ADMIN_SECRET || "080808";
	const topN = Number(process.env.TOP_N || 20);
	const filter = String(process.env.CATEGORY_FILTER || "").trim();

	const norm = (s: string) => s.toLowerCase().replace(/[-_]/g, "");
	const files = (await listR2Keys(""))
		.filter((k) => !SKIP.has(k) && !k.startsWith("_$"))
		.filter((k) => (filter ? norm(k).includes(norm(filter)) : true));

	console.log(`提取目标: ${files.length} 个分类，每个前 ${topN} 条`);

	let okCats = 0, failCats = 0, totalItems = 0;

	for (const key of files) {
		let json: { data?: Item[] };
		try { json = (await getRawJson(key)) as { data?: Item[] }; } catch { continue; }
		const items = json?.data;
		if (!Array.isArray(items) || !items.length) continue;

		const head = items.slice(0, topN);
		const isMovie = key.includes("movie") || items.some((x) => String(x.media_type || "").includes("movie"));
		const type = isMovie ? "movie" : "tv";
		const payload = {
			items: head.map((it) => ({ id: String(it.tmdbId || it.id), type })),
			category: toCategoryId(key),
			weekday: 1,
		};
		if (!payload.items.length) continue;

		totalItems += payload.items.length;
		try {
			const res = await fetch(`${base}/action/batch_force_logo`, {
				method: "POST",
				headers: { Authorization: `Bearer ${pwd}`, "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const d = await res.json().catch(() => null);
			if (res.ok && d && d.success) {
				const succ = (d.results || []).filter((r: { success?: boolean }) => r.success).length;
				console.log(`  ✅ ${key}: ${succ}/${payload.items.length}`);
				okCats++;
			} else {
				console.log(`  ⚠️ ${key}: ${d && d.error ? d.error : res.status}`);
				failCats++;
			}
		} catch (e) {
			console.log(`  ❌ ${key}: ${(e as Error).message}`);
			failCats++;
		}
		await sleep(300);
	}

	console.log(`\n═══════════════════════`);
	console.log(`成功分类: ${okCats} | 失败: ${failCats} | 覆盖条目: ${totalItems}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

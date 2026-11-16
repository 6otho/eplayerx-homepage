/**
 * 复杂分类：variety_* / trakt_* / bangumi_airing
 * 从 movie-api 迁移到 GitHub Actions，逻辑与 movie-api 保持一致。
 */

import { tmdb } from "../tmdb/client.js";
import { buildContentItem, deduplicateByTmdbId } from "./crawlers.js";
import { loadRawFile, saveRawFile } from "./service.js";
import type { TmdbSearchResult } from "./tmdb-enrich.js";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 拉取 discover 列表（多页） */
async function discover(
	mediaType: "tv" | "movie",
	query: Record<string, string>,
	limit = 100,
	sortBy = "popularity.desc",
): Promise<TmdbSearchResult[]> {
	const out: TmdbSearchResult[] = [];
	const seen = new Set<number>();
	const pages = Math.ceil(limit / 20);
	for (let page = 1; page <= pages; page++) {
		try {
			const res = await tmdb.GET(`/3/discover/${mediaType}`, {
				params: {
					query: { language: "zh-CN", sort_by: sortBy, page: String(page), ...query } as never,
				},
			});
			const results = (res.data as { results?: TmdbSearchResult[] })?.results ?? [];
			if (!results.length) break;
			for (const r of results) {
				const id = Number((r as { id?: number }).id);
				if (!id || seen.has(id)) continue;
				seen.add(id);
				out.push(r);
				if (out.length >= limit) return out;
			}
		} catch (e) {
			console.error(`    ⚠️ discover 第${page}页失败:`, (e as Error).message);
			break;
		}
		await delay(250);
	}
	return out;
}

/** 把 raw 列表加工成 ContentItem 并保存 */
async function buildAndSave(
	fileName: string,
	label: string,
	raw: TmdbSearchResult[],
	mediaType: "tv" | "movie",
	type = "tv_series",
): Promise<number> {
	const results: NonNullable<Awaited<ReturnType<typeof buildContentItem>>>[] = [];
	for (const item of raw) {
		const title = (item as { name?: string }).name || (item as { title?: string }).title || "";
		if (!title) continue;
		try {
			const c = await buildContentItem(title, item, mediaType);
			if (c) results.push(c);
		} catch {
			/* 单条失败忽略 */
		}
		await delay(160);
	}
	if (!results.length) {
		console.log(`  ⚠️ ${label}: 无有效条目`);
		return 0;
	}
	const deduped = deduplicateByTmdbId(results);
	await saveRawFile(fileName, deduped, "tmdb", type);
	console.log(`  💾 ${label}: 保存 ${deduped.length} 条`);
	return deduped.length;
}

// ---------------- variety_cn / variety_kr / variety_global ----------------

export async function crawlVarietyCn(): Promise<void> {
	console.log("\n🎤 [热门国产综艺]");
	const raw = await discover("tv", {
		with_genres: "10764",
		with_original_language: "zh",
		with_origin_country: "CN",
	});
	await buildAndSave("variety-cn.json", "热门国产综艺", raw, "tv", "variety_show");
}

export async function crawlVarietyKr(): Promise<void> {
	console.log("\n🎤 [爆款韩国综艺]");
	const seeds = ["런닝맨", "아는 형님", "나 혼자 산다", "1박 2일", "환승연애", "놀라운 토요일", "유 퀴즈 온 더 블럭"];
	const seedItems: TmdbSearchResult[] = [];
	for (const title of seeds) {
		try {
			const res = await tmdb.GET("/3/search/tv", {
				params: { query: { query: title, language: "zh-CN", page: "1" } as never },
			});
			const first = (res.data as { results?: TmdbSearchResult[] })?.results?.[0];
			if (first) seedItems.push(first);
		} catch {
			/* ignore */
		}
		await delay(200);
	}
	const kr = await discover("tv", {
		with_genres: "10764",
		with_original_language: "ko",
		with_origin_country: "KR",
	});
	const seen = new Set(seedItems.map((s) => (s as { id?: number }).id));
	const merged = [...seedItems, ...kr.filter((k) => !seen.has((k as { id?: number }).id))];
	await buildAndSave("variety-kr.json", "爆款韩国综艺", merged, "tv", "variety_show");
}

export async function crawlVarietyGlobal(): Promise<void> {
	console.log("\n🎤 [全球流媒体新热综艺]");
	const jaStream = await discover("tv", {
		with_genres: "10764",
		with_original_language: "ja",
		with_networks: "213|1024|2643",
	});
	const jaRecent = await discover("tv", {
		with_genres: "10764",
		with_original_language: "ja",
		"first_air_date.gte": "2022-01-01",
	});
	const others = await discover("tv", {
		with_genres: "10764",
		with_original_language: "en|th|es|fr|de|id|tl|ms|vi",
		"first_air_date.gte": "2022-01-01",
	});

	const seenJa = new Set(jaStream.map((i) => (i as { id?: number }).id));
	const jaAll = [...jaStream, ...jaRecent.filter((i) => !seenJa.has((i as { id?: number }).id))];

	const out: TmdbSearchResult[] = [];
	const seen = new Set<unknown>();
	for (const i of jaAll.slice(0, 15)) {
		const k = (i as { id?: number }).id;
		if (!seen.has(k)) {
			out.push(i);
			seen.add(k);
		}
	}
	const maxLen = Math.max(jaAll.length, others.length);
	for (let i = 0; i < maxLen; i++) {
		const o = others[i] as { id?: number } | undefined;
		if (o && !seen.has(o.id)) {
			out.push(others[i]);
			seen.add(o.id);
		}
		const j = jaAll[i] as { id?: number } | undefined;
		if (i >= 15 && j && !seen.has(j.id)) {
			out.push(jaAll[i]);
			seen.add(j.id);
		}
	}
	await buildAndSave("variety-global.json", "全球流媒体新热综艺", out, "tv", "variety_show");
}

// ---------------- trakt_movies / trakt_shows ----------------
// 无 Trakt token 时退回 TMDB 欧美库（与 movie-api 的后备逻辑一致）

export async function crawlTraktMovies(): Promise<void> {
	console.log("\n🎬 [视效轰炸欧美大片]");
	const raw = await discover("movie", { with_original_language: "en|fr|de|es|it", with_origin_country: "US|GB|CA|AU" });
	await buildAndSave("trakt-movies.json", "视效轰炸欧美大片", raw, "movie", "movie");
}

export async function crawlTraktShows(): Promise<void> {
	console.log("\n🎬 [时下热播欧美剧集]");
	const raw = await discover("tv", {
		with_original_language: "en|fr|de|es|it|sv|no|da",
		without_genres: "16,10764,10767",
	});
	// 二次清洗：剔除中日韩与动画
	const clean = raw.filter((item) => {
		const lang = String((item as { original_language?: string }).original_language || "").toLowerCase();
		const genres = ((item as { genre_ids?: number[] }).genre_ids || []) as number[];
		return !["zh", "ja", "ko"].includes(lang) && !genres.includes(16);
	});
	await buildAndSave("trakt-shows.json", "时下热播欧美剧集", clean, "tv", "tv_series");
}

// ---------------- bangumi_airing ----------------

export async function crawlBangumiAiring(): Promise<void> {
	console.log("\n🎌 [今日热门番剧]");
	const items: TmdbSearchResult[] = [];
	try {
		const res = await fetch("https://bangumi.tv/anime/browser/?sort=trends", {
			headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
		});
		const html = await res.text();
		const re = /<a href="\/subject\/\d+" class="l">([^<]+)<\/a>/g;
		const seen = new Set<string>();
		let m: RegExpExecArray | null;
		while ((m = re.exec(html)) !== null && items.length < 100) {
			const title = m[1].replace(/&amp;/g, "&").trim().split(" ")[0];
			if (!title || seen.has(title)) continue;
			seen.add(title);
			try {
				const s = await tmdb.GET("/3/search/tv", {
					params: { query: { query: title, language: "zh-CN", page: "1" } as never },
				});
				const hit = (s.data as { results?: TmdbSearchResult[] })?.results?.[0];
				if (hit) items.push(hit);
			} catch {
				/* ignore */
			}
			await delay(250);
		}
	} catch (e) {
		console.error("  ❌ bangumi 抓取失败:", (e as Error).message);
		return;
	}
	// 🎯 与 discover 类一致：旧文件里的条目也要强制刷新详情
	//    （bangumi 排名会变，不刷新会留下 overview=null 的陈旧条目）
	try {
		const old = await loadRawFile("bangumi-airing.json");
		const have = new Set(items.map((i) => Number((i as { id?: number }).id)));
		for (const it of old) {
			const id = Number(it.tmdbId || (it as { id?: number }).id);
			if (!id || have.has(id)) continue;
			const title = (it as { title?: string }).title || (it as { name?: string }).name || "";
			if (!title) continue;
			items.push({ id, name: title, title } as TmdbSearchResult);
			have.add(id);
			console.log(`  🔝 旧条目补抓: ${title}`);
		}
	} catch { /* 首次运行 */ }

	// 只保留日本动画
	const jp = items.filter((it) => {
		const c = ((it as { origin_country?: string[] }).origin_country || []) as string[];
		const g = ((it as { genre_ids?: number[] }).genre_ids || []) as number[];
		return (c.includes("JP") || c.length === 0) && g.includes(16);
	});
	await buildAndSave("bangumi-airing.json", "今日热门番剧", jp, "tv", "animation");
}

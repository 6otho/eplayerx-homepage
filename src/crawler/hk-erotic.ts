/**
 * 尽皆癫狂的港产喜剧（tmdb_movie_hk_erotic_comedy）
 * 从 movie-api 迁移：3 个 discover 查询 + 中文种子标题搜索
 * 独立文件，只写 tmdb-movie-hk-erotic-comedy.json，不影响其他分类
 */

import { tmdb } from "../tmdb/client.js";
import { buildContentItem, deduplicateByTmdbId } from "./crawlers.js";
import { loadRawFile, saveRawFile } from "./service.js";
import type { TmdbSearchResult } from "./tmdb-enrich.js";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 45 个中文种子标题（与 movie-api 一致） */
const BASE_SEEDS = [
	"飞虎出征", "大丈夫", "大丈夫2", "低俗喜剧", "一路向西", "鸭王", "鸭王2", "夜王",
	"喜爱夜蒲", "喜爱夜蒲2", "喜爱夜蒲3", "台北夜蒲团团转", "私人会所", "#PTGF出租女友",
	"微交少女", "同班同学", "雏妓", "重口味", "AV青春梦工场", "破事儿", "老笠",
	"西谎极落之太爆太子太空舱", "豪情", "豪情3D", "金鸡", "金鸡2", "金鸡SSS",
	"绝世好Bra", "绝世好B", "恋上你的床", "买凶拍人", "鹿鼎记", "情圣", "最佳损友",
	"精装追女仔", "求爱敢死队", "玉蒲团之偷情宝鉴", "玉女心经", "3D肉蒲团之极乐宝鉴",
	"蜜桃成熟时", "蜜桃成熟时1997", "色情男女", "满清十大酷刑", "青楼十二房", "挡不住的疯情",
];

async function discoverMovies(query: Record<string, string>, limit: number): Promise<TmdbSearchResult[]> {
	const out: TmdbSearchResult[] = [];
	const seen = new Set<number>();
	const pages = Math.ceil(limit / 20);
	for (let page = 1; page <= pages; page++) {
		try {
			const res = await tmdb.GET("/3/discover/movie", {
				params: {
					query: {
						language: "zh-CN",
						sort_by: "popularity.desc",
						include_adult: "true",
						page: String(page),
						...query,
					} as never,
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

async function searchSeed(title: string): Promise<TmdbSearchResult | null> {
	try {
		const res = await tmdb.GET("/3/search/movie", {
			params: { query: { query: title, language: "zh-CN", include_adult: "true", page: "1" } as never },
		});
		const hit = (res.data as { results?: TmdbSearchResult[] })?.results?.[0];
		return hit ?? null;
	} catch {
		return null;
	}
}

export async function crawlHkEroticComedy(limit = 100): Promise<number> {
	console.log("\n🎬 [尽皆癫狂的港产喜剧]");

	// 1) 三个 discover 查询
	const [level3, sexComedies, keywordErotics] = await Promise.all([
		discoverMovies(
			{
				certification_country: "HK",
				certification: "III",
				with_origin_country: "HK",
				without_genres: "27,53,16,28",
			},
			limit,
		),
		discoverMovies(
			{
				with_origin_country: "HK",
				with_genres: "35",
				with_keywords: "232252|155554|15003|10556|10123|1574|10006",
				without_genres: "27,53,16",
			},
			limit,
		),
		discoverMovies(
			{
				with_origin_country: "HK",
				with_keywords: "12053|10006|1574",
				without_genres: "27,53,16,28",
				sort_by: "vote_count.desc",
			},
			limit,
		),
	]);
	console.log(`  📥 discover: 分级III=${level3.length} 情色喜剧=${sexComedies.length} 风月=${keywordErotics.length}`);

	// 2) 种子标题搜索
	const seedHits: TmdbSearchResult[] = [];
	for (const t of BASE_SEEDS) {
		const hit = await searchSeed(t);
		if (hit) seedHits.push(hit);
		await delay(200);
	}
	console.log(`  📥 种子命中: ${seedHits.length}/${BASE_SEEDS.length}`);

	// 3) 合并去重（种子优先，popularity 设高值让其排前）
	const map = new Map<number, TmdbSearchResult>();
	const seedIds = new Set(seedHits.map((s) => Number((s as { id?: number }).id)));
	const all = [...seedHits, ...level3, ...sexComedies, ...keywordErotics];
	for (const item of all) {
		const id = Number((item as { id?: number }).id);
		if (!id) continue;
		if (!map.has(id)) map.set(id, item);
	}
	let merged = Array.from(map.values());
	console.log(`  🔀 去重后 ${merged.length} 条（种子 ${seedIds.size} 条）`);

	// 4) 🎯 与今日电影/电视剧同一套：旧文件前 20 条 + pinned 也强制刷新
	try {
		const old = await loadRawFile("tmdb-movie-hk-erotic-comedy.json");
		const HEAD_REFRESH = 20;
		for (const [idx, it] of old.entries()) {
			const id = Number(it.tmdbId || (it as { id?: number }).id);
			if (!id || map.has(id)) continue;
			const isPinned = !!(it as { pinned?: boolean }).pinned;
			if (!isPinned && idx >= HEAD_REFRESH) continue;
			const t = (it as { title?: string }).title || (it as { name?: string }).name || "";
			if (!t) continue;
			map.set(id, { id, name: t, title: t } as TmdbSearchResult);
			console.log(`  🔝 旧条目补抓: ${t}`);
		}
	} catch { /* 首次运行 */ }

	// 5) 逐条取详情
	const results: NonNullable<Awaited<ReturnType<typeof buildContentItem>>>[] = [];
	merged = Array.from(map.values());
	for (const item of merged) {
		const title = (item as { title?: string }).title || (item as { name?: string }).name || "";
		if (!title) continue;
		try {
			const c = await buildContentItem(title, item, "movie");
			if (c) results.push(c);
		} catch {
			/* 单条失败忽略 */
		}
		await delay(160);
		if (results.length >= limit) break;
	}

	if (!results.length) {
		console.log("  ⚠️ 无有效条目");
		return 0;
	}
	const deduped = deduplicateByTmdbId(results);
	await saveRawFile("tmdb-movie-hk-erotic-comedy.json", deduped, "tmdb", "movie");
	console.log(`  💾 尽皆癫狂的港产喜剧: 保存 ${deduped.length} 条`);
	return deduped.length;
}

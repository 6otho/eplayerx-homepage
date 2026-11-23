import assert from "node:assert/strict";
import { test } from "node:test";
import {
	bahamutCandidates,
	bahamutFanpage,
	fetchBahamutReviews,
	fetchDoubanReviews,
	normalizedTitle,
	parseBahamutReviews,
	parseDoubanReviews,
} from "./providers.js";

const title = {
	type: "tv" as const,
	titles: ["测试作品", "測試作品", "Test Title"],
	year: 2023,
	animated: true,
};

function doubanSearch(items: { id: string; year: string }[]): Response {
	return new Response(
		`<script>window.__DATA__ = ${JSON.stringify({
			items: items.map((item) => ({
				id: item.id,
				tpl_name: "search_subject",
				title: `搜索显示名 原名 (${item.year})`,
			})),
			error_info: "",
		})};</script>`,
	);
}

test("Douban normalizes stars, timestamps and source URLs and rejects malformed responses", () => {
	const reviews = parseDoubanReviews({
		interests: [
			{
				id: "7",
				comment: "测试短评",
				create_time: "2023-10-01 12:30:00",
				rating: { value: 4 },
				user: { name: "读者", avatar: "https://example.com/a.png" },
				vote_count: 3,
				sharing_url:
					"https://www.douban.com/doubanapp/dispatch?uri=/movie/1/interest/7",
			},
			{ id: "8", comment: " " },
		],
	});
	assert.equal(reviews.length, 1);
	assert.equal(reviews[0].source, "douban");
	assert.equal(reviews[0].author_details.rating, 8);
	assert.equal(reviews[0].likes, 3);
	assert.equal(reviews[0].created_at, "2023-10-01T04:30:00.000Z");
	assert.ok(reviews[0].url.includes("interest/7"));
	assert.throws(() => parseDoubanReviews({ error: "blocked" }));
});

test("Douban requires an unambiguous title, media type and release year", async (t) => {
	let searches = 0;
	const matching = {
		type: "tv",
		id: "12",
		title: "测试作品 第一季",
		year: "2023",
	};
	const items = [
		matching,
		{ ...matching, id: "15", type: "movie" },
		{ ...matching, id: "14", title: "测试作品 第二季", year: "2024" },
	];
	t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
		const url = String(input);
		if (url.includes("/subject_search?")) {
			searches++;
			return doubanSearch(items);
		}
		if (!url.includes("/interests?"))
			return Response.json(items.find((item) => url.endsWith(`/${item.id}`)));
		assert.ok(url.includes("/tv/12/interests?"));
		return Response.json({ interests: [] });
	});
	assert.equal((await fetchDoubanReviews(title)).sourceId, "12");
	await fetchDoubanReviews(title, "12");
	assert.equal(searches, 1, "known mappings do not search again");
	items.push({ ...matching, id: "13" });
	assert.equal((await fetchDoubanReviews(title)).sourceId, null);
	assert.notEqual(
		normalizedTitle("测试作品 第二季"),
		normalizedTitle("测试作品"),
	);
});

test("later season matching accepts Chinese/Arabic season numbers, without borrowing season one", async (t) => {
	assert.equal(
		normalizedTitle("测试作品 第二季"),
		normalizedTitle("测试作品 Season 2"),
	);
	assert.equal(
		normalizedTitle("测试作品 第十二季"),
		normalizedTitle("测试作品 Season 12"),
	);
	assert.notEqual(
		normalizedTitle("测试作品 第二季"),
		normalizedTitle("测试作品"),
	);
	const requests: string[] = [];
	t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
		const url = String(input);
		requests.push(url);
		if (url.includes("/subject_search?"))
			return doubanSearch([
				{ id: "1", year: "2023" },
				{ id: "2", year: "2023" },
			]);
		if (!url.includes("/interests?")) {
			const second = url.endsWith("/2");
			return Response.json({
				id: second ? "2" : "1",
				type: "tv",
				year: "2023",
				title: second ? "测试作品 第二季" : "测试作品 第一季",
			});
		}
		assert.ok(url.includes("/tv/2/interests?count=50&start=0"));
		return Response.json({
			interests: Array.from({ length: 50 }, (_, index) => ({
				id: String(index + 1),
				comment: "短评",
			})),
		});
	});
	const result = await fetchDoubanReviews({
		...title,
		titles: ["测试作品 第2季"],
		searchTitles: ["测试作品"],
	});
	assert.equal(result.sourceId, "2");
	assert.equal(result.results.length, 50);
	assert.equal(
		requests.length,
		4,
		"public search + candidate verification + one batch, no pagination",
	);
});

test("Douban public search resolves a new film by its verified original title and aliases", async (t) => {
	t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
		const url = String(input);
		assert.ok(
			!url.includes("/api/v2/search?"),
			"anonymous login-only search is never used",
		);
		if (url.includes("/subject_search?"))
			return doubanSearch([{ id: "37368923", year: "2025" }]);
		if (url.endsWith("/movie/37368923"))
			return Response.json({
				id: "37368923",
				type: "movie",
				year: "2025",
				title: "窃取本书者将会…",
				original_title: "この本を盗む者は",
				aka: ["谁是窃书之人"],
			});
		assert.ok(url.includes("/movie/37368923/interests?"));
		return Response.json({ interests: [{ id: "7", comment: "短评" }] });
	});
	const result = await fetchDoubanReviews({
		type: "movie",
		titles: ["谁是窃书之人", "この本を盗む者は"],
		year: 2025,
		animated: true,
	});
	assert.equal(result.sourceId, "37368923");
	assert.equal(result.results.length, 1);
});

test("Douban rejects blocked search pages and unverified or ambiguous candidate metadata", async (t) => {
	let mode = "blocked";
	t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
		const url = String(input);
		assert.ok(!url.includes("/interests?"));
		if (url.includes("/subject_search?")) {
			if (mode === "blocked") return new Response("<html>需要登录</html>");
			return doubanSearch(
				Array.from({ length: mode === "broad" ? 6 : 1 }, (_, index) => ({
					id: String(index + 1),
					year: "2023",
				})),
			);
		}
		return Response.json({
			id: mode === "id" ? "999" : "1",
			type: "tv",
			year: mode === "year" ? "2024" : "2023",
			title: "无关作品",
		});
	});
	await assert.rejects(fetchDoubanReviews(title), /Unexpected Douban search/);
	for (mode of ["title", "year", "id", "broad"])
		assert.deepEqual(await fetchDoubanReviews(title), {
			sourceId: null,
			results: [],
		});
});

test("Bahamut keeps the full first batch instead of truncating it to twenty", () => {
	const items = Array.from({ length: 30 }, (_, index) => ({
		id: String(index + 1),
		privacy: 1,
		content: "评价",
		reviews: { id: 99, dc_type: { id: 4 } },
	}));
	assert.equal(
		parseBahamutReviews({ data: { list: [items] } }, "99").length,
		30,
	);
});

test("Bahamut separates animation from manga and verifies the original premiere year", () => {
	const html = `<p class="search_title">[ 漫畫 ]<a href="//acg.gamer.com.tw/acgDetail.php?s=1">測試作品</a></p>
	<p class="search_title">[ 動畫 ]<a href="//acg.gamer.com.tw/acgDetail.php?s=2">測試作品</a></p>
	<p class="search_title">[ 動畫 ]<a href="//acg.gamer.com.tw/acgDetail.php?s=3">測試作品 第二季</a></p>`;
	assert.deepEqual(bahamutCandidates(html, title.titles), ["2"]);
	const detail =
		'<h1>測試作品</h1><li>當地首播：2023-10-01</li><button onclick="acgReview.navAllReviews(99, 4);">評價</button>';
	assert.equal(bahamutFanpage(detail, title), "99");
	assert.equal(bahamutFanpage(detail, { ...title, year: 2024 }), null);
	assert.throws(() =>
		bahamutCandidates("<html>challenge</html>", title.titles),
	);
});

test("Bahamut accepts only public reviews of the matched animation, not replies or other works", () => {
	const item = {
		id: "11",
		privacy: "1",
		content: "测试<br>评价 &amp; &#x597D;",
		ctime: "2023-10-01 12:30:00",
		likeCount: 8,
		publisher: { name: "读者", propic: "https://example.com/avatar.png" },
		reviews: { id: 99, rating: 5, dc_type: { id: 4 } },
		commented: [{ id: "12", content: "回复" }],
	};
	const reviews = parseBahamutReviews(
		{
			data: {
				list: [
					[item],
					[{ ...item, id: "13", privacy: "0" }],
					[{ ...item, id: "14", reviews: { ...item.reviews, id: 100 } }],
					[{ ...item, id: "15", content: "" }],
				],
			},
		},
		"99",
	);
	assert.equal(reviews.length, 1);
	assert.equal(reviews[0].content, "测试 评价 & 好");
	assert.equal(reviews[0].author_details.rating, 10);
	assert.equal(reviews[0].likes, 8);
	assert.equal(reviews[0].created_at, "2023-10-01T04:30:00.000Z");
	assert.throws(() => parseBahamutReviews({ error: "blocked" }, "99"));
});

test("live-action titles never trigger Bahamut requests", async (t) => {
	const fetch = t.mock.method(globalThis, "fetch", async () => {
		throw new Error("unexpected");
	});
	assert.deepEqual(await fetchBahamutReviews({ ...title, animated: false }), {
		sourceId: null,
		results: [],
	});
	assert.equal(fetch.mock.callCount(), 0);
});

test("Bahamut falls back to verified desktop pages when the JSON catalog is unavailable", async (t) => {
	t.mock.method(
		globalThis,
		"fetch",
		async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			assert.equal(new Headers(init?.headers).get("User-Agent"), "Mozilla/5.0");
			if (url.includes("/mobile_app/"))
				return new Response("Unavailable", { status: 503 });
			if (url.includes("/search.php?"))
				return new Response(
					'<p class="search_title">[ 動畫 ]<a href="//acg.gamer.com.tw/acgDetail.php?s=2">測試作品</a></p>',
				);
			if (url.includes("/acgDetail.php?s=2"))
				return new Response(
					'<h1>測試作品</h1><li>當地首播：2023-10-01</li><button onclick="acgReview.navAllReviews(99, 4);">評價</button>',
				);
			assert.equal(
				url,
				"https://api.gamer.com.tw/acg/v1/reviews_list.php?sn=99&t=4&sort=4",
			);
			return Response.json({ data: { list: [] } });
		},
	);
	assert.deepEqual(await fetchBahamutReviews(title), {
		sourceId: "99",
		results: [],
	});
});

test("Bahamut resolves first-time reviews entirely through JSON and deduplicates video editions", async (t) => {
	const requested: string[] = [];
	t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
		const url = String(input);
		requested.push(url);
		if (url.includes("/mobile_app/anime/v1/search.php?"))
			return Response.json({
				anime: [
					{
						acg_sn: 2,
						video_sn: 3,
						title: "測試作品",
						info: "年份：2023/10 共 12 集",
					},
					{
						acg_sn: 2,
						video_sn: 4,
						title: "測試作品",
						info: "年份：2023/10 共 12 集",
					},
					{
						acg_sn: 5,
						video_sn: 6,
						title: "測試作品 第二季",
						info: "年份：2024/10 共 12 集",
					},
				],
			});
		if (url === "https://api.gamer.com.tw/anime/v1/video.php?videoSn=3")
			return Response.json({
				data: {
					video: { videoSn: 3 },
					anime: {
						title: "測試作品 [1]",
						acgSn: 2,
						fanId: 99,
						seasonStart: "2023/10/01",
					},
				},
			});
		assert.equal(
			url,
			"https://api.gamer.com.tw/acg/v1/reviews_list.php?sn=99&t=4&sort=4",
		);
		return Response.json({
			data: {
				list: [
					[
						{
							id: "1",
							content: "推薦",
							privacy: "1",
							reviews: { id: 99, rating: 4, dc_type: { id: 4 } },
						},
					],
				],
			},
		});
	});
	const result = await fetchBahamutReviews(title);
	assert.equal(result.sourceId, "99");
	assert.equal(result.results[0].content, "推薦");
	assert.equal(requested.length, 3);
	assert.ok(
		requested.every((url) => new URL(url).hostname === "api.gamer.com.tw"),
	);
	requested.length = 0;
	await fetchBahamutReviews(title, "99");
	assert.equal(requested.length, 1, "known IDs still go straight to reviews");
});

test("Bahamut rejects conflicting JSON identities and falls back for uncatalogued titles", async (t) => {
	const anime = {
		title: "測試作品 [1]",
		acgSn: 2,
		fanId: 99,
		seasonStart: "2023/10/01",
	};
	let returnedAnime = { ...anime };
	let returnedVideo = 3;
	let candidates: unknown[] = [
		{ acg_sn: 2, video_sn: 3, title: "測試作品", info: "年份：2023/10" },
	];
	let reviewCalls = 0,
		htmlCalls = 0;
	t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
		const url = String(input);
		if (url.includes("/mobile_app/"))
			return Response.json({ anime: candidates });
		if (url.includes("/anime/v1/video.php"))
			return Response.json({
				data: { anime: returnedAnime, video: { videoSn: returnedVideo } },
			});
		if (url.includes("/acg/v1/reviews_list.php")) {
			reviewCalls++;
			throw new Error("must not accept conflicting identity");
		}
		htmlCalls++;
		return new Response("查無資料");
	});
	for (const change of [
		{ acgSn: 8 },
		{ title: "別的作品 [1]" },
		{ seasonStart: "2024/10/01" },
		{ fanId: 0 },
	]) {
		returnedAnime = { ...anime, ...change };
		assert.deepEqual(await fetchBahamutReviews(title), {
			sourceId: null,
			results: [],
		});
	}
	returnedAnime = anime;
	returnedVideo = 8;
	assert.deepEqual(await fetchBahamutReviews(title), {
		sourceId: null,
		results: [],
	});
	returnedVideo = 3;
	candidates = [];
	assert.deepEqual(await fetchBahamutReviews(title), {
		sourceId: null,
		results: [],
	});
	assert.equal(reviewCalls, 0);
	assert.equal(htmlCalls, 6);
});

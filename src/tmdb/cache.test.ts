import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import routes, { tmdbCacheMiddleware } from "./routes.js";

test("artwork lists expire after six hours and bypass old month-long entries", async (t) => {
	const previousCaches = globalThis.caches;
	const previousToken = process.env.TMDB_API_TOKEN;
	process.env.TMDB_API_TOKEN = "test-token";
	t.after(() => {
		if (previousToken === undefined) delete process.env.TMDB_API_TOKEN;
		else process.env.TMDB_API_TOKEN = previousToken;
		Object.defineProperty(globalThis, "caches", { configurable: true, value: previousCaches });
	});
	const entries = new Map<string, Response>();
	Object.defineProperty(globalThis, "caches", { configurable: true, value: { default: {
		match: async (request: Request) => entries.get(request.url)?.clone(),
		put: async (request: Request, response: Response) => { entries.set(request.url, response); },
	} } });
	const posters = ["zh", "en", "ja", null].map(iso_639_1 => ({ iso_639_1 }));
	const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({ posters }));
	const app = new Hono(); app.use("/tmdb/*", tmdbCacheMiddleware); app.route("/tmdb", routes);
	for (const path of ["movie/images?id=300146", "tv/images?id=300146", "tv/season/images?id=300146&seasonNumber=1"]) {
		const stale = new URL(`http://localhost/tmdb/${path}`);
		stale.searchParams.set("_cache_version", "20261009-youtube-language-v2");
		stale.searchParams.sort();
		entries.set(stale.href, Response.json({ posters: posters.slice(0, 2) }, {
			headers: { "Cache-Control": "public, max-age=2592000, s-maxage=2592000" },
		}));
		for (let i = 0; i < 2; i++) {
			const response = await app.request(`/tmdb/${path}`);
			assert.equal(response.headers.get("Cache-Control"), "public, max-age=21600, s-maxage=21600, stale-while-revalidate=3600");
			assert.deepEqual((await response.json() as any).posters, posters);
		}
	}
	assert.equal(fetch.mock.callCount(), 3, "each list replaces the old cache and reuses the new entry");
});

test("cold trending requests share enrichment and versioned entries survive fragment stripping", async (t) => {
	const previousToken = process.env.TMDB_API_TOKEN;
	const previousCaches = globalThis.caches;
	process.env.TMDB_API_TOKEN = "test-token";
	t.after(() => {
		if (previousToken === undefined) delete process.env.TMDB_API_TOKEN;
		else process.env.TMDB_API_TOKEN = previousToken;
		Object.defineProperty(globalThis, "caches", { configurable: true, value: previousCaches });
	});
	const entries = new Map<string, Response>();
	const key = (r: Request) => { const u = new URL(r.url); u.hash = ""; return u.href; };
	let cacheBroken = false;
	Object.defineProperty(globalThis, "caches", { configurable: true, value: { default: {
		match: async (r: Request) => entries.get(key(r))?.clone(),
		put: async (r: Request, response: Response) => {
			if (cacheBroken) throw new Error("cache unavailable");
			entries.set(key(r), response);
		},
	} } });
	let status = 200;
	const fetch = t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		await new Promise(resolve => setTimeout(resolve, 5));
		return Response.json(url.pathname.includes("/trending/")
			? { results: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, original_language: "en" })) }
			: { id: Number(url.pathname.split("/").at(-1)), images: {}, videos: { results: [] } }, { status });
	});
	const app = new Hono(); app.use("/tmdb/*", tmdbCacheMiddleware); app.route("/tmdb", routes);
	const request = (query: string) => app.request("/tmdb/trending/tv?" + query);
	entries.set("http://localhost/tmdb/trending/tv?language=en-US&page=1", Response.json({ stale: true }));
	const responses = await Promise.all([request("language=en-US&page=1"), request("page=1&language=en-US")]);
	for (const response of responses) assert.equal((await response.json() as { results: unknown[] }).results.length, 20);
	assert.equal(fetch.mock.callCount(), 21, "two cold lists share the list and 20 details calls");
	assert.equal((await request("language=en-US&page=1")).status, 200);
	assert.equal(fetch.mock.callCount(), 21);
	assert.ok([...entries.keys()].some(url => new URL(url).searchParams.has("_cache_version")));
	status = 503;
	for (let i = 0; i < 2; i++) {
		const response = await request("language=en-US&page=2");
		assert.equal(response.status, 500); assert.equal(response.headers.get("Cache-Control"), "no-store");
	}
	assert.equal(fetch.mock.callCount(), 23, "failures are retried rather than retained in the pending map");
	status = 200; cacheBroken = true;
	assert.equal((await request("language=en-US&page=3")).status, 200);
});

test("independent artwork caches discard old mixed-language responses and isolate Logo changes", async (t) => {
	const previousCaches = globalThis.caches;
	const previousToken = process.env.TMDB_API_TOKEN;
	process.env.TMDB_API_TOKEN = "test-token";
	t.after(() => {
		if (previousToken === undefined) delete process.env.TMDB_API_TOKEN;
		else process.env.TMDB_API_TOKEN = previousToken;
		Object.defineProperty(globalThis, "caches", { configurable: true, value: previousCaches });
	});
	const entries = new Map<string, Response>();
	Object.defineProperty(globalThis, "caches", { configurable: true, value: { default: {
		match: async (request: Request) => entries.get(request.url)?.clone(),
		put: async (request: Request, response: Response) => { entries.set(request.url, response); },
	} } });
	let calls = 0;
	t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
		calls++;
		const url = new URL(input instanceof Request ? input.url : String(input));
		return Response.json(url.pathname.includes("/discover/")
			? { results: [{ id: 42, title: "English title", poster_path: "/en.jpg" }] }
			: { id: 42, title: "English title", original_language: "en", images: {
				posters: [{ file_path: "/zh.jpg", iso_639_1: "zh", width: 500, height: 750 }],
				logos: [{ file_path: "/zh.png", iso_639_1: "zh", width: 500, height: 100 },
					{ file_path: "/en.png", iso_639_1: "en", width: 500, height: 100 }],
			} });
	});
	const app = new Hono(); app.use("/tmdb/*", tmdbCacheMiddleware); app.route("/tmdb", routes);
	const query = "language=zh-CN&metadataLanguage=en-US";
	const stale = new URL(`http://localhost/tmdb/discover/movie?${query}`);
	stale.searchParams.set("_cache_version", "20261009-youtube-language-v2");
	stale.searchParams.sort();
	entries.set(stale.href, Response.json({ stale: true }));
	const request = (suffix = "") => app.request(`/tmdb/discover/movie?${query}${suffix}`);
	for (let i = 0; i < 2; i++) {
		const data = await (await request()).json() as any;
		assert.equal(data.results[0].poster_path, "/zh.jpg");
		assert.equal(data.results[0].logo, "/zh.png");
	}
	assert.equal(calls, 2, "the second request uses the corrected cached result");
	const changed = await (await request("&logoLanguage=original")).json() as any;
	assert.equal(changed.results[0].poster_path, "/zh.jpg");
	assert.equal(changed.results[0].logo, "/en.png");
	assert.equal(calls, 4, "Logo preferences have an independent response cache entry");
});

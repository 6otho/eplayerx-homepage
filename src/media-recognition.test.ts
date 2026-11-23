import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import app from "./media-recognition.js";

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});
process.env.TMDB_API_TOKEN = "test-tmdb-key";
const env = {
	OPENAI_API_KEY: "test-server-secret",
	REVENUECAT_API_KEY: "test-revenuecat-key",
	MEDIA_RECOGNITION_RATE_LIMITER: { limit: async () => ({ success: true }) },
};
const input = {
	filename: "HP1.2001.mkv",
	folders: ["Movies", "Harry Potter"],
	title: "HP1",
	year: 2001,
	type: "movie",
	language: "zh-CN",
	reason: "unmatched",
};
const candidate = {
	id: 671,
	title: "哈利·波特与魔法石",
	original_title: "Harry Potter and the Philosopher's Stone",
	release_date: "2001-11-16",
	overview: "A wizard",
};
const answer = {
	confident: true,
	candidate_id: null,
	query: candidate.original_title,
	year: 2001,
};
const request = (body: unknown = input, bindings = env) =>
	app.request(
		"/recognize",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"CF-Connecting-IP": "192.0.2.1",
				Authorization: "Bearer fixture-pro",
			},
			body: JSON.stringify(body),
		},
		bindings,
	);

function upstream(
	result: unknown = answer,
	options: { duplicate?: boolean; aiStatus?: number; finish?: string } = {},
) {
	const calls: { path: string; body?: any }[] = [];
	globalThis.fetch = async (resource, init) => {
		const req = new Request(resource, init);
		const url = new URL(req.url);
		if (url.hostname === "api.revenuecat.com")
			return Response.json({
				subscriber: {
					entitlements: {
						pro_all_access: {
							purchase_date: "2020-01-01T00:00:00Z",
							expires_date: null,
							product_identifier: "lifetime",
						},
					},
				},
			});
		if (url.hostname === "api.openai.com") {
			const body = (await req.json()) as any;
			calls.push({ path: "ai", body });
			assert.equal(
				req.headers.get("Authorization"),
				`Bearer ${env.OPENAI_API_KEY}`,
			);
			if (options.aiStatus)
				return new Response("private upstream diagnostic", {
					status: options.aiStatus,
				});
			return Response.json({
				choices: [
					{
						finish_reason: options.finish ?? "stop",
						message: { content: JSON.stringify(result) },
					},
				],
			});
		}
		calls.push({ path: url.pathname });
		if (url.pathname.includes("/search/")) {
			const found = url.searchParams.get("query") === "HP1" ? [] : [candidate];
			return Response.json({
				results:
					options.duplicate && found.length
						? [...found, { ...candidate, id: 999 }]
						: found,
			});
		}
		return Response.json({
			...candidate,
			original_language: "en",
			poster_path: "/hp.jpg",
		});
	};
	return calls;
}

test("unmatched canonical title is verified by TMDB; caller cannot choose model or prompts", async () => {
	const calls = upstream();
	const response = await request();
	assert.equal(response.status, 200);
	const body = (await response.json()) as any;
	assert.equal(body.match.id, 671);
	assert.equal(body.match.title, candidate.title);
	const ai = calls.find((call) => call.path === "ai")!.body;
	assert.equal(ai.model, "gpt-6-luna");
	assert.equal(ai.reasoning_effort, "low");
	assert.equal(ai.store, false);
	assert.equal(ai.response_format.json_schema.strict, true);
	assert.equal(calls.filter((call) => call.path === "ai").length, 1);
	assert.equal(response.headers.get("Cache-Control"), "no-store");
	assert.equal((await request({ ...input, model: "other" })).status, 400);
});

test("confirmation accepts only an ID from the supplied TMDB candidates", async () => {
	const calls = upstream({ ...answer, candidate_id: 671 });
	const response = await request({
		...input,
		title: "Harry Potter",
		reason: "confirmation",
	});
	assert.equal(((await response.json()) as any).match.id, 671);
	assert.equal(calls.filter((call) => call.path === "ai").length, 1);
	upstream({ ...answer, candidate_id: 123456 });
	assert.deepEqual(await (await request()).json(), { match: null });
});

test("unknown, wrong-year and hallucinated results stay unmatched", async () => {
	for (const [result, body, options] of [
		[{ ...answer, confident: false }, input, {}],
		[
			{ ...answer, candidate_id: 671 },
			{ ...input, title: "Harry Potter", year: 2004 },
			{},
		],
		[{ ...answer, candidate_id: 999 }, input, {}],
	] as const) {
		const calls = upstream(result, options);
		assert.deepEqual(await (await request(body)).json(), { match: null });
		assert.ok(!calls.some((call) => /\/3\/movie\/\d+/.test(call.path)));
	}
});

test("same-title ambiguity accepts the model's most likely verified candidate", async () => {
	const calls = upstream({ ...answer, candidate_id: 671 }, { duplicate: true });
	const response = await request({
		...input,
		title: "Harry Potter",
		year: undefined,
		reason: "confirmation",
	});
	assert.equal(((await response.json()) as any).match.id, 671);
	assert.ok(calls.some((call) => /\/3\/movie\/\d+/.test(call.path)));
});

test("AI fallback accepts a one-year premiere/release difference", async () => {
	upstream({ ...answer, candidate_id: 671 });
	const response = await request({
		...input,
		title: "Harry Potter",
		year: 2002,
	});
	assert.equal(((await response.json()) as any).match.id, 671);
});

test("explicit regional clues filter same-title candidates before the model chooses", async () => {
	const shows = [
		{
			id: 126027,
			name: "Ghosts",
			original_name: "Ghosts",
			first_air_date: "2021-10-07",
			origin_country: ["US"],
		},
		{
			id: 17174,
			name: "Ghosts",
			original_name: "Ghosts",
			first_air_date: "2019-04-15",
			origin_country: ["GB"],
		},
	];
	globalThis.fetch = async (resource, init) => {
		const req = new Request(resource, init);
		const url = new URL(req.url);
		if (url.hostname === "api.revenuecat.com")
			return Response.json({
				subscriber: {
					entitlements: {
						pro_all_access: {
							purchase_date: "2020-01-01T00:00:00Z",
							expires_date: null,
							product_identifier: "lifetime",
						},
					},
				},
			});
		if (url.hostname === "api.openai.com") {
			const body = (await req.json()) as any;
			const data = JSON.parse(body.messages[1].content);
			assert.equal(data.candidates.length, 1);
			const expected = data.filename.includes("UK") ? 17174 : 126027;
			assert.equal(data.candidates[0].id, expected);
			return Response.json({
				choices: [
					{
						finish_reason: "stop",
						message: {
							content: JSON.stringify({
								confident: true,
								candidate_id: expected,
								query: null,
								year: null,
							}),
						},
					},
				],
			});
		}
		if (url.pathname.includes("/search/"))
			return Response.json({ results: shows });
		return Response.json(
			shows.find((show) => url.pathname.endsWith(String(show.id))),
		);
	};
	for (const [filename, expected] of [
		["Ghosts.S01E01.mkv", 126027],
		["Ghosts.UK.S01E01.mkv", 17174],
	] as const) {
		const response = await request({
			...input,
			filename,
			type: "tv",
			title: "Ghosts",
			year: undefined,
			folders: ["美剧"],
			reason: "confirmation",
		});
		assert.equal(((await response.json()) as any).match.id, expected);
	}
});

test("one exact regional match needs no model and survives optional details failure", async () => {
	let models = 0;
	globalThis.fetch = async (resource) => {
		const url = new URL(
			resource instanceof Request ? resource.url : String(resource),
		);
		if (url.hostname === "api.revenuecat.com")
			return Response.json({
				subscriber: {
					entitlements: {
						pro_all_access: {
							purchase_date: "2020-01-01T00:00:00Z",
							expires_date: null,
							product_identifier: "lifetime",
						},
					},
				},
			});
		if (url.hostname === "api.openai.com") {
			models++;
			throw new Error("Unnecessary paid request");
		}
		if (url.pathname.includes("/search/"))
			return Response.json({
				results: [
					{
						id: 126027,
						name: "Ghosts",
						original_name: "Ghosts",
						first_air_date: "2021-10-07",
						origin_country: ["US"],
					},
					{
						id: 17174,
						name: "Ghosts",
						original_name: "Ghosts",
						first_air_date: "2019-04-15",
						origin_country: ["GB"],
					},
				],
			});
		return new Response("Metadata unavailable", { status: 503 });
	};
	const response = await request({
		...input,
		filename: "Ghosts.S01E01.mkv",
		title: "Ghosts",
		type: "tv",
		year: undefined,
		folders: ["英剧"],
		reason: "confirmation",
	});
	assert.equal(response.status, 200);
	assert.equal(((await response.json()) as any).match.id, 17174);
	assert.equal(models, 0);
});

test("a paid identity is retained if subsequent TMDB enrichment fails", async () => {
	const calls = upstream();
	const fetch = globalThis.fetch;
	globalThis.fetch = async (resource, init) => {
		const request = new Request(resource, init);
		if (/\/3\/movie\/\d+$/.test(new URL(request.url).pathname))
			return new Response("Unavailable", { status: 503 });
		return fetch(request);
	};
	const response = await request();
	assert.equal(response.status, 200);
	assert.equal(((await response.json()) as any).match.id, 671);
	assert.equal(calls.filter((call) => call.path === "ai").length, 1);
});

test("a well-supported movie beats near-year catalog duplicates without a model call", async () => {
	let models = 0;
	globalThis.fetch = async (resource) => {
		const url = new URL(
			resource instanceof Request ? resource.url : String(resource),
		);
		if (url.hostname === "api.revenuecat.com")
			return Response.json({
				subscriber: {
					entitlements: {
						pro_all_access: {
							purchase_date: "2020-01-01T00:00:00Z",
							expires_date: null,
							product_identifier: "lifetime",
						},
					},
				},
			});
		if (url.hostname === "api.openai.com") {
			models++;
			throw new Error("Unnecessary model call");
		}
		const movie = {
			id: 1640,
			title: "撞车",
			original_title: "Crash",
			release_date: "2005-05-06",
			vote_count: 4092,
		};
		if (url.pathname.includes("/search/"))
			return Response.json({
				results: [
					movie,
					{ ...movie, id: 1353802, release_date: "2004-10-16", vote_count: 3 },
				],
			});
		return Response.json(movie);
	};
	const response = await request({
		...input,
		filename: "Crash.2004.mkv",
		title: "Crash",
		year: 2004,
	});
	assert.equal(((await response.json()) as any).match.id, 1640);
	assert.equal(models, 0);
});

test("canonical franchise names are verified through TMDB aliases with one model call", async () => {
	const query = "Star Wars: Episode V - The Empire Strikes Back";
	let models = 0;
	let aliases = 0;
	globalThis.fetch = async (resource, init) => {
		const req = new Request(resource, init);
		const url = new URL(req.url);
		if (url.hostname === "api.revenuecat.com")
			return Response.json({
				subscriber: {
					entitlements: {
						pro_all_access: {
							purchase_date: "2020-01-01T00:00:00Z",
							expires_date: null,
							product_identifier: "lifetime",
						},
					},
				},
			});
		if (url.hostname === "api.openai.com") {
			models++;
			return Response.json({
				choices: [
					{
						finish_reason: "stop",
						message: {
							content: JSON.stringify({
								confident: true,
								candidate_id: null,
								query,
								year: 1980,
							}),
						},
					},
				],
			});
		}
		const movie = {
			id: 1891,
			title: "帝国反击战",
			original_title: "The Empire Strikes Back",
			release_date: "1980-05-20",
		};
		if (url.pathname.includes("/search/"))
			return Response.json({
				results: url.searchParams.get("query") === "SW5" ? [] : [movie],
			});
		if (url.searchParams.get("append_to_response")) aliases++;
		return Response.json({
			...movie,
			alternative_titles: { titles: [{ title: query }] },
		});
	};
	const response = await request({
		...input,
		filename: "SW5.1980.mkv",
		title: "SW5",
		year: 1980,
	});
	assert.equal(((await response.json()) as any).match.id, 1891);
	assert.equal(models, 1);
	assert.equal(aliases, 1);
});

test("a bilingual canonical answer searches each real title without another model request", async () => {
	const calls = upstream({
		...answer,
		query: `哈利·波特与魔法石 (${candidate.original_title})`,
	});
	const response = await request();
	assert.equal(((await response.json()) as any).match.id, 671);
	assert.equal(calls.filter((call) => call.path === "ai").length, 1);
});

test("matched items, paths, oversized bodies and missing configuration never reach AI", async () => {
	const calls = upstream();
	for (const body of [
		{ ...input, reason: "matched" },
		{ ...input, filename: "https://private/path?token=secret" },
		{ ...input, folders: ["/share/private"] },
		{ ...input, filename: "a".repeat(9000) },
	]) {
		assert.ok([400, 413].includes((await request(body)).status));
	}
	assert.equal(
		(await request(input, { ...env, OPENAI_API_KEY: "" })).status,
		503,
	);
	assert.equal(calls.length, 0);
	const blocked = {
		...env,
		MEDIA_RECOGNITION_RATE_LIMITER: { limit: async () => ({ success: false }) },
	};
	assert.equal((await request(input, blocked)).status, 429);
	assert.equal(calls.length, 0);
});

test("upstream failures, truncated and malformed output fail safely without exposing secrets", async () => {
	for (const options of [{ aiStatus: 500 }, { finish: "length" }, {}]) {
		upstream(
			options.finish || options.aiStatus ? answer : { confident: true },
			options,
		);
		const response = await request();
		assert.equal(response.status, 502);
		const text = await response.text();
		assert.ok(!text.includes(env.OPENAI_API_KEY));
		assert.ok(!text.includes("private upstream"));
	}
});

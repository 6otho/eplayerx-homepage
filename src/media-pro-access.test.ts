import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { hasMediaPro } from "./media-pro-access.js";
import app from "./media-recognition.js";

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

test("anonymous and non-Pro callers never reach TMDB or OpenAI", async () => {
	const calls: string[] = [];
	globalThis.fetch = async (resource) => {
		const url = new URL(
			resource instanceof Request ? resource.url : String(resource),
		);
		calls.push(url.hostname);
		return Response.json({ subscriber: { entitlements: {} } });
	};
	const body = JSON.stringify({
		filename: "HP1.2001.mkv",
		folders: [],
		title: "HP1",
		year: 2001,
		type: "movie",
		language: "zh-CN",
		reason: "unmatched",
	});
	const env = {
		OPENAI_API_KEY: "key",
		REVENUECAT_API_KEY: "rc",
		MEDIA_RECOGNITION_RATE_LIMITER: { limit: async () => ({ success: true }) },
	};
	const request = (authorization?: string) =>
		app.request(
			"/recognize",
			{
				method: "POST",
				headers: {
					"CF-Connecting-IP": "192.0.2.2",
					...(authorization ? { Authorization: authorization } : {}),
				},
				body,
			},
			env,
		);
	assert.equal((await request()).status, 401);
	assert.equal(calls.length, 0);
	assert.equal((await request("Bearer free-user")).status, 403);
	assert.deepEqual(calls, ["api.revenuecat.com"]);
});

test("platform Pro, all-access, lifetime and grace periods work; expired and malformed grants do not", async () => {
	const now = Date.now();
	const past = new Date(now - 60_000).toISOString();
	const future = new Date(now + 60_000).toISOString();
	let entitlement: Record<string, unknown> = {};
	let calls = 0;
	globalThis.fetch = async () => {
		calls++;
		return Response.json({ subscriber: { entitlements: entitlement } });
	};
	for (const id of ["Pro", "pro_macos", "pro_tvos", "pro_all_access"]) {
		for (const expires_date of [null, future]) {
			entitlement = {
				[id]: { product_identifier: "pro", purchase_date: past, expires_date },
			};
			const user = `${id}-${expires_date}`;
			assert.equal(await hasMediaPro(user, "fixture"), true);
			const count = calls;
			assert.equal(await hasMediaPro(user, "fixture"), true);
			assert.equal(
				calls,
				count,
				"Reuse short-lived verified entitlement cache",
			);
		}
	}
	entitlement = {
		Pro: {
			product_identifier: "pro",
			purchase_date: past,
			expires_date: past,
			grace_period_expires_date: future,
		},
	};
	assert.equal(await hasMediaPro("grace", "fixture"), true);
	for (const [user, value] of [
		[
			"expired",
			{ product_identifier: "pro", purchase_date: past, expires_date: past },
		],
		["malformed", { expires_date: null }],
		[
			"future",
			{ product_identifier: "pro", purchase_date: future, expires_date: null },
		],
	] as const) {
		entitlement = { Pro: value };
		assert.equal(await hasMediaPro(user, "fixture"), false);
	}
});

test("RevenueCat outage fails closed", async () => {
	globalThis.fetch = async () => new Response("private error", { status: 503 });
	await assert.rejects(hasMediaPro("outage", "fixture"));
});

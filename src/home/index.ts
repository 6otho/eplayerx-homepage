import { type Context, Hono } from "hono";
import type { BlocksBindings } from "../blocks/types.js";
import { createDefaultHomeConfig } from "./config.js";
import { createHomeConfigV2 } from "./config-v2.js";

const DEFAULT_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const DEFAULT_TIMEZONE = "UTC";

const app = new Hono<{ Bindings: BlocksBindings }>();

function resolveRequestLanguage(c: Context): string {
	return c.req.query("language") || "zh-CN";
}

function resolveConfigRequest(c: Context<{ Bindings: BlocksBindings }>) {
	const requestUrl = new URL(c.req.url);
	return {
		language: resolveRequestLanguage(c),
		timezone: c.req.query("timezone") || DEFAULT_TIMEZONE,
		apiBaseUrl:
			c.req.query("apiBaseUrl") ||
			process.env.API_BASE_URL ||
			requestUrl.origin,
		imageBaseUrl:
			c.req.query("imageBaseUrl") ||
			process.env.TMDB_IMAGE_BASE_URL ||
			DEFAULT_IMAGE_BASE_URL,
	};
}

function cacheHomeConfig(c: Context) {
	c.header(
		"Cache-Control",
		"no-cache, no-store, must-revalidate, max-age=0",
	);
}

// 🌟 纯同步调用！原作者怎么写，我们就怎么写！
app.get("/config", (c) => {
	cacheHomeConfig(c);
	return c.json(createDefaultHomeConfig(resolveConfigRequest(c)));
});

// 🌟 官方 V2：原汁原味
app.get("/config/v2", async (c) => {
	cacheHomeConfig(c);
	return c.json(
		await createHomeConfigV2({
			...resolveConfigRequest(c),
			db: c.env?.DB,
		}),
	);
});

export default app;

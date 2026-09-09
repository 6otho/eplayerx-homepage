import { type Context, Hono } from "hono";
import type { BlocksBindings } from "../blocks/types.js";
import { createDefaultHomeConfig } from "./config.js";
import { createHomeConfigV2 } from "./config-v2.js";

const DEFAULT_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const DEFAULT_TIMEZONE = "Asia/Shanghai";

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

// 🌟 1. 自定义接口 (/home/config) -> 严格指向 config.js
app.get("/config", async (c) => {
	cacheHomeConfig(c);
	return c.json(
		await createDefaultHomeConfig({
			...resolveConfigRequest(c),
			db: c.env?.DB,
		})
	);
});

// 🌟 2. 官方默认 V2 接口 (/home/config/v2) -> 严格指向 config-v2.js
app.get("/config/v2", async (c) => {
	cacheHomeConfig(c);
	return c.json(
		await createHomeConfigV2({
			...resolveConfigRequest(c),
			db: c.env?.DB,
		})
	);
});

export default app;

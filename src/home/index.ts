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

// 🌟 自定义接口：必须加上 async 和 await！
app.get("/config", async (c) => {
	cacheHomeConfig(c);
	const config = await createDefaultHomeConfig({
		...resolveConfigRequest(c),
		db: c.env?.DB,
	});
	return c.json(config);
});

// 官方 V2 接口（保持独立）：
app.get("/config/v2", async (c) => {
	cacheHomeConfig(c);
	const config = await createHomeConfigV2({
		...resolveConfigRequest(c),
		db: c.env?.DB,
	});
	return c.json(config);
});

export default app;

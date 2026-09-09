import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import type { BlocksBindings } from "../blocks/types.js";
// 👉 导入 config.ts 里的自定义数据生成函数
import { createDefaultHomeConfig } from "./config.js";
// 👉 官方原版 V2 数据保留导入
import { createHomeConfigV2 } from "./config-v2.js";

const DEFAULT_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const DEFAULT_TIMEZONE = "UTC";

const app = new Hono<{ Bindings: BlocksBindings }>();

// 加上 CORS 保证客户端请求不被拦截
app.use("*", cors());

function resolveRequestLanguage(c: Context): string {
	return c.req.query("language") || "en-US";
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
		"public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
	);
}

/**
 * 🌟 核心改动：
 * 客户端新首页写死请求的就是 /config/v2！
 * 这里直接把 config.ts 的自定义数据指向并返回给 /config/v2！
 * 只要客户端在设置里填了你的 API，客户端访问 /config/v2 拿到的就是你的自定义数据！
 */
app.get("/config/v2", async (c) => {
	cacheHomeConfig(c);
	return c.json(
		await createDefaultHomeConfig({
			...resolveConfigRequest(c),
			db: c.env?.DB,
		}),
	);
});

/**
 * /config 也同时指向你的自定义数据（兼容老客户端）
 */
app.get("/config", async (c) => {
	cacheHomeConfig(c);
	return c.json(
		await createDefaultHomeConfig({
			...resolveConfigRequest(c),
			db: c.env?.DB,
		}),
	);
});

/**
 * 官方原版 V2 保留在此路径（备用，保证官方原版代码依然存在且可用）
 */
app.get("/config/v2/official", async (c) => {
	cacheHomeConfig(c);
	return c.json(
		await createHomeConfigV2({
			...resolveConfigRequest(c),
			db: c.env?.DB,
		}),
	);
});

export default app;

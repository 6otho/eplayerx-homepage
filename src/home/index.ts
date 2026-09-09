import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import type { BlocksBindings } from "../blocks/types.js";
import { createDefaultHomeConfig } from "./config.js";       // 你的自定义数据
import { createHomeConfigV2 } from "./config-v2.js";          // 官方默认 V2 数据

const DEFAULT_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const DEFAULT_TIMEZONE = "UTC";

const app = new Hono<{ Bindings: BlocksBindings }>();

// 开启跨域，防止客户端请求报 CORS 错误
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
 * 🌟 1. /config 接口：你的自定义数据！
 * 客户端在设置里填入 API（如 https://epx.ikuux.cyou/home/config）时，直接获取你的周更表和自建源！
 * （关键点：必须加 await，否则会返回空对象 {}）
 */
app.get("/config", async (c) => {
	cacheHomeConfig(c);
	const data = await createDefaultHomeConfig({
		...resolveConfigRequest(c),
		db: c.env?.DB,
	});
	return c.json(data);
});

/**
 * 🌟 2. /config/v2 接口：官方原版 V2 数据！
 * 客户端不填 API 或默认请求时，返回官方原本的分类数据，完全不改动！
 */
app.get("/config/v2", async (c) => {
	cacheHomeConfig(c);
	const data = await createHomeConfigV2({
		...resolveConfigRequest(c),
		db: c.env?.DB,
	});
	return c.json(data);
});

export default app;

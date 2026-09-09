import { type Context, Hono } from "hono";
import type { BlocksBindings } from "../blocks/types.js";
import { createDefaultHomeConfig } from "./config.js";

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
		"no-cache, no-store, must-revalidate", // 🌟 改为不缓存，确保你后台一推，客户端刷新立即看到最新大盘！
	);
}

// 🌟 1. 自定义接口 (/home/config)
app.get("/config", async (c) => {
	cacheHomeConfig(c);
	const config = await createDefaultHomeConfig({
		...resolveConfigRequest(c),
		db: c.env?.DB,
	});
	return c.json({ ...config, version: 1 });
});

// 🌟 2. 默认接口 (/home/config/v2)
// 客户端默认敲这个门！我们直接把你的自定义大盘数据返回给它，版本伪装成 2
app.get("/config/v2", async (c) => {
	cacheHomeConfig(c);
	const config = await createDefaultHomeConfig({
		...resolveConfigRequest(c),
		db: c.env?.DB,
	});
	return c.json({ ...config, version: 2 });
});

export default app;

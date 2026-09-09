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

// 兼容老客户端的 /config 路径
app.get("/config", async (c) => {
	cacheHomeConfig(c);
	const config = await createDefaultHomeConfig({
		...resolveConfigRequest(c),
		db: c.env?.DB,
	});
	return c.json(config);
});

// 🌟 新版客户端敲的门：/config/v2
// 如果请求带了 ?default=1，就返回原作者原版默认首页；
// 客户端填了你的域名 API 正常请求，直接返回你在 config.ts 里定制的完整大盘！
app.get("/config/v2", async (c) => {
	cacheHomeConfig(c);
	
	// 如果需要强制查看官方默认首页，传参数 ?default=1
	if (c.req.query("default") === "1") {
		const defaultConfig = await createHomeConfigV2({
			...resolveConfigRequest(c),
			db: c.env?.DB,
		});
		return c.json(defaultConfig);
	}

	// 🌟 正常情况下，直接返回你 config.ts 里自定义的大盘数据！
	const customConfig = await createDefaultHomeConfig({
		...resolveConfigRequest(c),
		db: c.env?.DB,
	});
	return c.json({
		...customConfig,
		version: 2, // 保证客户端判定为合法的 V2 协议
	});
});

export default app;

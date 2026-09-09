import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import type { BlocksBindings } from "../blocks/types.js";
import { createDefaultHomeConfig } from "./config.js";       // 你的 43 个自建周更表和 R2 数据
import { createHomeConfigV2 } from "./config-v2.js";          // 官方原生默认 V2 数据

const DEFAULT_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const DEFAULT_TIMEZONE = "UTC";

const app = new Hono<{ Bindings: BlocksBindings }>();

// 开启全局 CORS，解决客户端网络拦截问题
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
 * 判断是否“填入了 API”接入 config 自定义数据：
 * 当客户端请求带有 ?api=... 或 ?custom=... 时，算作填入了 API！
 */
function isApiProvided(c: Context<{ Bindings: BlocksBindings }>): boolean {
	const apiQuery = c.req.query("api");
	const customQuery = c.req.query("custom");
	return Boolean((apiQuery && apiQuery !== "0") || (customQuery && customQuery !== "0"));
}

/**
 * 核心统一处理器：
 * 1. 填入了 api：直接接入 config.ts 你的全部 43 个自建数据！
 * 2. 没填 api：直接指向 config-v2.ts 官方原生 V2 数据！
 */
async function handleConfigRoute(c: Context<{ Bindings: BlocksBindings }>) {
	cacheHomeConfig(c);
	const options = {
		...resolveConfigRequest(c),
		db: c.env?.DB,
	};

	// 填入 api -> 接入你的 config 数据
	if (isApiProvided(c)) {
		return c.json(await createDefaultHomeConfig(options));
	}

	// 不填 api -> 接入官方 v2 数据
	return c.json(await createHomeConfigV2(options));
}

// 客户端写死请求的 /config/v2 与 /config 均完美走此分发！
app.get("/config/v2", handleConfigRoute);
app.get("/config", handleConfigRoute);

export default app;

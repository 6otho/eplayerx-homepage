import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import type { BlocksBindings } from "../blocks/types.js";
import { createDefaultHomeConfig } from "./config.js";       // 你的 43 个自建分类与周更表
import { createHomeConfigV2 } from "./config-v2.js";          // 官方原生默认分类数据

const DEFAULT_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const DEFAULT_TIMEZONE = "UTC";

const app = new Hono<{ Bindings: BlocksBindings }>();

// 开启全局 CORS，确保客户端（iOS/Android/TV/Web）跨域请求不被拦截
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
 * 客户端新首页写死请求的 /config/v2
 * 逻辑：客户端只要填了你的 API 访问这里，默认直接返回 config.ts 你的全部自定义数据！
 * （若传 ?default=1 则获取官方原版数据）
 */
app.get("/config/v2", async (c) => {
	cacheHomeConfig(c);
	const options = {
		...resolveConfigRequest(c),
		db: c.env?.DB,
	};

	// 只有当明确指定获取官方默认数据时才走原生 V2
	if (c.req.query("default") === "1" || c.req.query("official") === "1") {
		return c.json(await createHomeConfigV2(options));
	}

	// 客户端填好 API 默认直接返回你的自定义 config.ts 数据！
	return c.json(await createDefaultHomeConfig(options));
});

/**
 * 客户端旧首页请求的 /config（与 V2 保持一致，直接返回自定义数据）
 */
app.get("/config", async (c) => {
	cacheHomeConfig(c);
	const options = {
		...resolveConfigRequest(c),
		db: c.env?.DB,
	};

	if (c.req.query("default") === "1" || c.req.query("official") === "1") {
		return c.json(await createHomeConfigV2(options));
	}

	return c.json(await createDefaultHomeConfig(options));
});

/**
 * 保留一个专门获取官方原生 V2 数据的接口（防备用）
 */
app.get("/config/v2/official", async (c) => {
	cacheHomeConfig(c);
	return c.json(
		await createHomeConfigV2({
			...resolveConfigRequest(c),
			db: c.env?.DB,
		})
	);
});

export default app;

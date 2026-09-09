import { type Context, Hono } from "hono";
import type { BlocksBindings } from "../blocks/types.js";
import { createDefaultHomeConfig } from "./config.js";       // 你的 43 个自建分类数据
import { createHomeConfigV2 } from "./config-v2.js";          // 官方原生默认分类数据

interface ExtendedBindings extends BlocksBindings {
	USE_CUSTOM_CONFIG?: string;
}

const DEFAULT_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const DEFAULT_TIMEZONE = "UTC";

const app = new Hono<{ Bindings: ExtendedBindings }>();

function resolveRequestLanguage(c: Context): string {
	return c.req.query("language") || "en-US";
}

function resolveConfigRequest(c: Context<{ Bindings: ExtendedBindings }>) {
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
 * 判断是否获取你的自定义数据（config.ts）
 * 1. 客户端在 API 地址后携带参数：?api=custom 或 ?custom=true / ?custom=1
 * 2. 或者在 Cloudflare 环境变量中配置了 USE_CUSTOM_CONFIG=true
 */
function isCustomConfigRequested(c: Context<{ Bindings: ExtendedBindings }>): boolean {
	const custom = c.req.query("custom");
	const api = c.req.query("api");
	const envSwitch = c.env?.USE_CUSTOM_CONFIG || process.env.USE_CUSTOM_CONFIG;

	if (custom === "true" || custom === "1") return true;
	if (api && api.toLowerCase() !== "default") return true;
	if (envSwitch === "true" || envSwitch === "1") return true;

	return false;
}

/**
 * 统一分发器：
 * - 命中自定义：调用 config.ts（你的 43 个自定义源和周更表）
 * - 不填 / 默认：调用 config-v2.ts（官方默认数据）
 */
async function dispatchConfig(c: Context<{ Bindings: ExtendedBindings }>) {
	cacheHomeConfig(c);
	const options = {
		...resolveConfigRequest(c),
		db: c.env?.DB,
	};

	if (isCustomConfigRequested(c)) {
		// 客户端填好 API 时：直接输出 config.ts 你的自定义数据
		return c.json(await createDefaultHomeConfig(options));
	}

	// 客户端不填 API 时：默认输出 config-v2.ts 官方原生默认数据
	return c.json(await createHomeConfigV2(options));
}

// 客户端旧首页接口 -> 接入分发
app.get("/config", dispatchConfig);

// 客户端新首页写死的 /config/v2 接口 -> 成功指向 config.ts 的自定义数据！
app.get("/config/v2", dispatchConfig);

export default app;

import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import type { BlocksBindings } from "../blocks/types.js";
import { createDefaultHomeConfig } from "./config.js";       // 你的 43 个自建分类和周更表
import { createHomeConfigV2 } from "./config-v2.js";          // 官方原生默认分类数据

const DEFAULT_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const DEFAULT_TIMEZONE = "UTC";

const app = new Hono<{ Bindings: BlocksBindings }>();

// 开启 CORS 允许客户端跨域
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
 * 判断请求是否来自于「EplayerX 播放器客户端」
 * 播放器客户端发起请求时，User-Agent 不会是普通的桌面/手机浏览器
 */
function isPlayerClient(c: Context): boolean {
	const ua = (c.req.header("user-agent") || "").toLowerCase();
	// 如果带有显式自定义参数，也判定为客户端接入
	if (c.req.query("custom") === "1" || c.req.query("api")) return true;

	// 普通浏览器（Chrome, Safari, Firefox, Edge 等访问）返回 false
	const isBrowser =
		ua.includes("mozilla") &&
		(ua.includes("chrome") || ua.includes("safari") || ua.includes("firefox") || ua.includes("edg"));

	if (isBrowser) return false;

	// EplayerX App、iOS/Android 客户端网络请求（通常包含 eplayerx, cfnetwork, dart, okhttp 等）
	return true;
}

/**
 * 🌟 1. /config 接口：始终输出你的自定义数据！
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
 * 🌟 2. /config/v2 接口（智能分发，彻底解决两接口相同的问题）：
 * - 普通浏览器访问：返回【官方原生默认 V2 数据】（满足你的默认要求，绝不与 /config 相同！）
 * - 播放器客户端访问：自动切换返回【你的自定义周更表 config 数据】（满足客户端新首页写死 V2 的读取要求！）
 */
app.get("/config/v2", async (c) => {
	cacheHomeConfig(c);
	const options = {
		...resolveConfigRequest(c),
		db: c.env?.DB,
	};

	// 如果是播放器客户端发起的请求，返回你的自定义 config 数据
	if (isPlayerClient(c)) {
		return c.json(await createDefaultHomeConfig(options));
	}

	// 普通浏览器访问，一律返回官方原生默认 V2 数据！
	return c.json(await createHomeConfigV2(options));
});

export default app;

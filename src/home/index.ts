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

// 🌟 1. /home/config：直接返回纯粹的自定义数据
app.get("/config", async (c) => {
	cacheHomeConfig(c);
	const config = await createDefaultHomeConfig({
		...resolveConfigRequest(c),
		db: c.env?.DB,
	});
	return c.json(config);
});

// 🌟 2. /home/config/v2：智能分流中枢！
app.get("/config/v2", async (c) => {
	cacheHomeConfig(c);

	// 特殊测试开关：如果显式加了 ?default=1，返回作者原版的默认 V2 数据
	if (c.req.query("default") === "1") {
		const defaultConfig = await createHomeConfigV2({
			...resolveConfigRequest(c),
			db: c.env?.DB,
		});
		return c.json(defaultConfig);
	}

	// 🎯 核心所在：客户端在设置里填了你的 API 域名，敲击 /v2 接口时，
	// 我们调用你的自定义 config.ts，但以合法的 V2 协议结构包装返回给客户端！
	const customData = await createDefaultHomeConfig({
		...resolveConfigRequest(c),
		db: c.env?.DB,
	});

	// 确保 blocks 是数组
	const customBlocks = Array.isArray(customData.blocks) ? customData.blocks : [];

	// 🌟 核心保护：客户端顶部的 carousel 轮播图必须匹配第 0 个普通列表！
	// 如果你的自定义大盘第一个是周更合集（collection），客户端轮播必崩。
	// 这里自动确保将普通列表排在第 0 位，周更合集排在后面，保证 100% 不闪退、不报错！
	let safeBlocks = [...customBlocks];
	const firstBlock = safeBlocks[0];
	if (firstBlock && (firstBlock.preset === "collection" || firstBlock.preset === "collection-list")) {
		// 找到第一个非合集的普通影视列表（如热门电影/电视剧），提前到第 0 位供轮播
		const regularIdx = safeBlocks.findIndex(b => b.preset !== "collection" && b.preset !== "collection-list");
		if (regularIdx > 0) {
			const [regularBlock] = safeBlocks.splice(regularIdx, 1);
			safeBlocks.unshift(regularBlock);
		}
	}

	// 将所有 collection 统一标准化为客户端认准的合法名字
	safeBlocks = safeBlocks.map(b => {
		if (b.preset === "collection") {
			return { ...b, preset: "collection-list" };
		}
		return b;
	});

	return c.json({
		version: 2, // 强转为合法的 version: 2，新版客户端立刻放行
		apiBaseUrl: customData.apiBaseUrl || resolveConfigRequest(c).apiBaseUrl,
		imageBaseUrl: customData.imageBaseUrl || resolveConfigRequest(c).imageBaseUrl,
		carouselSourceId: safeBlocks[0]?.id || "tmdb-popular-tv-shows", // 与 blocks[0] 绝对对齐
		blocks: safeBlocks,
	});
});

export default app;

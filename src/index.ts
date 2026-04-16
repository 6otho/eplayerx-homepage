import { Hono } from "hono";
import crawlerApp from "./crawler/index.js";
import tmdbApp from "./tmdb/index.js";

// 定义环境变量类型，避免 TS 报错
type Bindings = {
	TMDB_API_TOKEN: string;
	TRAKT_CLIENT_ID: string;
};

// 注入环境变量类型
const app = new Hono<{ Bindings: Bindings }>();

const welcomeStrings = [
	"Hello Hono!",
	"To learn more about Hono on Vercel, visit https://vercel.com/docs/frameworks/backend/hono",
];

// Root route
app.get("/", (c) => {
	return c.text(welcomeStrings.join("\n\n"));
});

// Mount TMDB routes
app.route("/tmdb", tmdbApp);

// Mount Crawler routes
app.route("/crawler", crawlerApp);

// ==========================================
// 🔥 新增：Trakt 热门数据 + TMDB 海报接口
// ==========================================
app.get("/trakt/trending", async (c) => {
	// 获取你在 Cloudflare 后台填写的密钥
	const TMDB_API_TOKEN = c.env.TMDB_API_TOKEN;
	const TRAKT_CLIENT_ID = c.env.TRAKT_CLIENT_ID;

	if (!TRAKT_CLIENT_ID || !TMDB_API_TOKEN) {
		return c.json({ error: "缺少环境变量：TRAKT_CLIENT_ID 或 TMDB_API_TOKEN" }, 500);
	}

	try {
		// 1. 去 Trakt 获取前 10 部热门电影
		const traktRes = await fetch("https://api.trakt.tv/movies/trending?limit=10", {
			headers: {
				"Content-Type": "application/json",
				"trakt-api-version": "2",
				"trakt-api-key": TRAKT_CLIENT_ID,
			},
		});

		if (!traktRes.ok) {
			const errDetail = await traktRes.text();
			throw new Error(`Trakt 拒绝了请求! 状态码: ${traktRes.status}, 原因: ${errDetail}, 你填的Key的前5位是: ${TRAKT_CLIENT_ID.substring(0,5)}`);
		}
		const traktData = await traktRes.json();

		// 2. 并发请求 TMDB，给这 10 部电影配上海报
		const results = await Promise.all(
			traktData.map(async (item: any) => {
				const tmdbId = item.movie.ids.tmdb;
				let posterUrl = null;

				if (tmdbId) {
					// 带着你的 TMDB Token 请求中文数据
					const tmdbRes = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?language=zh-CN`, {
						headers: {
							Authorization: `Bearer ${TMDB_API_TOKEN}`,
							Accept: "application/json",
						},
					});

					if (tmdbRes.ok) {
						const tmdbData: any = await tmdbRes.json();
						if (tmdbData.poster_path) {
							// 拼接高清海报网址
							posterUrl = `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}`;
						}
					}
				}

				// 整理好每一部电影的数据结构
				return {
					title: item.movie.title,
					year: item.movie.year,
					watchers: item.watchers,
					tmdb_id: tmdbId,
					poster: posterUrl,
				};
			})
		);

		// 3. 将整理好的数据成功返回
		return c.json({ success: true, data: results });
		
	} catch (error: any) {
		return c.json({ success: false, error: error.message }, 500);
	}
});
// ==========================================

export default app;

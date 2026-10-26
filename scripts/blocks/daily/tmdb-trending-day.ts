/** TMDB's daily all-media chart; preserve movie/TV types from each row. */
import assert from "node:assert/strict";
import { publishBlock } from "../../../src/blocks/publish.js";
import { createTmdbFetch } from "../../../src/tmdb/client.js";
import { fetchSubmitterToken } from "../lib/tmdb-discover.js";

const SUBMISSION_ID = "2bd956019bd0";
const token = await fetchSubmitterToken(SUBMISSION_ID);
const fetchTmdb = createTmdbFetch(token, process.env.TMDB_API_TOKEN);

await publishBlock({
	submissionId: SUBMISSION_ID,
	blockId: "community-tmdb-trending-day",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () => {
		const res = await fetchTmdb(
			"https://api.themoviedb.org/3/trending/all/day?language=zh-CN",
		);
		if (!res.ok) throw new Error(`TMDB trending error: ${res.status}`);
		const data = (await res.json()) as {
			results: Array<{
				id: number;
				media_type: "movie" | "tv";
				title?: string;
				name?: string;
			}>;
		};
		assert(
			Array.isArray(data.results),
			"TMDB trending returned invalid results",
		);
		return data.results.map((row) => {
			const title = row.title ?? row.name;
			assert(title && Number.isInteger(row.id) && row.id > 0);
			assert(row.media_type === "movie" || row.media_type === "tv");
			return { title, tmdbId: row.id, mediaType: row.media_type };
		});
	},
});

/** Douban explore defaults: 热门/全部 movies and tv/tv series, refreshed daily. */
import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchRecentHotItems } from "../lib/douban.js";

const KNOWN_IDS: Record<string, number> = {
	// Chinese search for 流人 incorrectly returns the variety show 潮流合伙人.
	"流人 第六季": 95480,
};

const BLOCKS = [
	{
		submissionId: "8ff82387b792",
		blockId: "community-douban-recent-hot-tv",
		mediaType: "tv",
	},
	{
		submissionId: "c138ef4dd2c8",
		blockId: "community-douban-recent-hot-movie",
		mediaType: "movie",
	},
] as const;

for (const block of BLOCKS) {
	await publishBlock({
		...block,
		language: "zh-CN",
		useTmdbTitle: true,
		fetchItems: async () =>
			(await fetchRecentHotItems(block.mediaType)).map((item) => ({
				...item,
				tmdbId: KNOWN_IDS[item.title],
			})),
	});
}

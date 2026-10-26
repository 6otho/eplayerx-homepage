/** GL submissions share public TMDB lists; the Thai chart only keeps TH rows. */
import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubmitterToken } from "../lib/tmdb-discover.js";
import { fetchTmdbListItems } from "../lib/tmdb-list.js";

const BLOCKS: Array<{
	submissionId: string;
	blockId: string;
	mediaType: "movie" | "tv";
	listId: number;
	originCountry?: string;
}> = [
	{
		submissionId: "cda08fb0d0ac",
		blockId: "community-tmdb-gl-movies",
		mediaType: "movie",
		listId: 8703425,
	},
	{
		submissionId: "08fef35a6cad",
		blockId: "community-tmdb-gl-drama",
		mediaType: "tv",
		listId: 8695141,
	},
	{
		submissionId: "ce7cde8e8402",
		blockId: "community-tmdb-thai-gl-tv",
		mediaType: "tv",
		listId: 8695141,
		originCountry: "TH",
	},
];

for (const block of BLOCKS) {
	const token = await fetchSubmitterToken(block.submissionId);
	await publishBlock({
		submissionId: block.submissionId,
		blockId: block.blockId,
		mediaType: block.mediaType,
		language: "zh-CN",
		useTmdbTitle: true,
		fetchItems: () =>
			fetchTmdbListItems(
				token,
				block.listId,
				block.mediaType,
				block.originCountry,
			),
	});
}

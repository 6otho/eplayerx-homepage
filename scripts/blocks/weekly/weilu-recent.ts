/** Recent releases by 围炉剧场, using the submitted discover filters and first page. */
import { publishBlock } from "../../../src/blocks/publish.js";
import {
	type DiscoverFilter,
	fetchSubmitterToken,
	fetchTmdbDiscoverItems,
} from "../lib/tmdb-discover.js";

const BLOCKS: Array<{
	submissionId: string;
	blockId: string;
	mediaType: "movie" | "tv";
	filter: DiscoverFilter;
}> = [
	{
		submissionId: "5827ebb0d854",
		blockId: "community-weilu-recent-hong-kong-movies",
		mediaType: "movie",
		filter: {
			withOriginCountry: "HK",
			withOriginalLanguage: "cn",
			withoutGenres: "16",
			primaryReleaseDateGte: "2023-01-01",
			voteCountGte: 10,
			sortBy: "primary_release_date.desc",
		},
	},
	{
		submissionId: "90024466abc8",
		blockId: "community-weilu-recent-tvb-tv",
		mediaType: "tv",
		filter: {
			with_networks: 48,
			with_genres: "18|80|9648|35|10759",
			withoutGenres: "16,99,10764,10767,10763",
			firstAirDateGte: "2023-01-01",
			sortBy: "first_air_date.desc",
		},
	},
	{
		submissionId: "eb2f7e98fd38",
		blockId: "community-weilu-recent-chinese-movies",
		mediaType: "movie",
		filter: {
			withOriginalLanguage: "zh",
			withoutGenres: "16",
			primaryReleaseDateGte: "2025-01-01",
			voteCountGte: 30,
			voteAverageGte: 6,
			sortBy: "popularity.desc",
		},
	},
	{
		submissionId: "61cc6f9de453",
		blockId: "community-weilu-recent-chinese-spy-tv",
		mediaType: "tv",
		filter: {
			withOriginCountry: "CN",
			withOriginalLanguage: "zh",
			with_keywords: "470|5265|220915|335028",
			withoutGenres: "16,10765",
			firstAirDateGte: "2020-01-01",
			sortBy: "first_air_date.desc",
		},
	},
	{
		submissionId: "24f0159a274e",
		blockId: "community-weilu-recent-chinese-crime-tv",
		mediaType: "tv",
		filter: {
			withOriginCountry: "CN",
			withOriginalLanguage: "zh",
			with_genres: "80",
			withoutGenres: "16,10765,10762",
			firstAirDateGte: "2024-01-01",
			voteCountGte: 5,
			sortBy: "popularity.desc",
		},
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
			fetchTmdbDiscoverItems(token, block.mediaType, block.filter, "zh-CN"),
	});
}

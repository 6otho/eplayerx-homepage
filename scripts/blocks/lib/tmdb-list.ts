import type { PublishItem } from "../../../src/blocks/publish.js";
import type { MediaType } from "../../../src/blocks/types.js";
import { createTmdbFetch } from "../../../src/tmdb/client.js";

interface ListRow {
	id: number;
	media_type: MediaType;
	title?: string;
	name?: string;
	origin_country?: string[];
}

/** Public TMDB lists are paginated even when their total is below 50. */
export async function fetchTmdbListItems(
	token: string,
	listId: number,
	mediaType: MediaType,
	originCountry?: string,
): Promise<PublishItem[]> {
	const fetchTmdb = createTmdbFetch(token, process.env.TMDB_API_TOKEN);
	const items: PublishItem[] = [];
	for (let page = 1; ; page++) {
		const res = await fetchTmdb(
			`https://api.themoviedb.org/3/list/${listId}?language=zh-CN&page=${page}`,
		);
		if (!res.ok) throw new Error(`TMDB list error: ${res.status}`);
		const data = (await res.json()) as {
			items: ListRow[];
			total_pages: number;
		};
		if (!Array.isArray(data.items) || !Number.isInteger(data.total_pages)) {
			throw new Error("TMDB list returned an invalid page");
		}
		for (const row of data.items) {
			if (row.media_type !== mediaType) continue;
			if (originCountry && !row.origin_country?.includes(originCountry))
				continue;
			const title = row.title ?? row.name;
			if (title) items.push({ title, tmdbId: row.id, mediaType });
		}
		if (page >= data.total_pages) break;
	}
	return items;
}

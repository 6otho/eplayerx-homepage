/** Return only alias names, not every translation's synopsis/artwork. */
export function withMatchTitles(data: unknown) {
	const { translations, alternative_titles, ...details } = data as Record<
		string,
		unknown
	> & {
		translations?: {
			translations?: { data?: { title?: string; name?: string } }[];
		};
		alternative_titles?: {
			titles?: { title?: string }[];
			results?: { title?: string }[];
		};
	};
	const titles = [
		details.title,
		details.name,
		details.original_title,
		details.original_name,
		...(translations?.translations ?? []).flatMap((row) => [
			row.data?.title,
			row.data?.name,
		]),
		...(alternative_titles?.titles ?? alternative_titles?.results ?? []).map(
			(row) => row.title,
		),
	].filter(
		(title): title is string =>
			typeof title === "string" && title.trim().length > 0,
	);
	return {
		...details,
		match_titles: [...new Set(titles.map((title) => title.trim()))],
	};
}

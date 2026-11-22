import { listR2Keys, getRawJson, putRawJson } from "../src/blocks/storage.js";

type Row = Record<string, unknown>;
const record = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);
export function stripOverview(row: Row): boolean {
	let changed = false;
	const strip = (obj: Row) => {
		for (const key of ["overview", "description"]) {
			if (Object.hasOwn(obj, key)) { delete obj[key]; changed = true; }
		}
	};
	strip(row);
	if (record(row.translations)) for (const tr of Object.values(row.translations)) if (record(tr)) strip(tr);
	return changed;
}

async function main() {
	const normalize = (s: string) => s.toLowerCase().replace(/[-_]/g, "").replace(/\.json$/, "");
	const filter = normalize((process.env.CATEGORY_FILTER || "").trim());
	for (const key of await listR2Keys("")) {
		if (key.includes("/") || key.startsWith("_$") || !key.endsWith(".json") || (filter && !normalize(key).includes(filter))) continue;
		const blob = await getRawJson(key);
		if (!record(blob) || !Array.isArray(blob.data)) continue;
		const categoryType = String(blob.type || "");
		const rows = process.env.TOP_ONLY === "0" ? blob.data : blob.data.slice(0, 20);
		let changed = 0;
		for (const row of rows) {
			if (!record(row) || !(row.tmdbId || row.id)) continue;
			const type = String(row.media_type || categoryType);
			if (["movie", "tv", "tv_series"].includes(type) && stripOverview(row)) changed++;
		}
		if (changed) { await putRawJson(key, blob); console.log(`${key}: 去除 ${changed} 条简介`); }
	}
}

if (import.meta.main) main().catch((error) => { console.error(error); process.exitCode = 1; });

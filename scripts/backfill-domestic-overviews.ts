import { getRawJson, putRawJson } from '../src/blocks/storage.js';
const key = 'douban-tv-custom.json';
type Item = { tmdbId?: number; media_type?: string; overview?: string | null };
async function main() {
  const initial = await getRawJson(key) as { data: Item[] };
  const head = initial.data.slice(0, 20);
  const fills = new Map<number, string>();
  for (const row of head) {
    if (!row.tmdbId || row.overview?.trim() || (row.media_type && row.media_type !== 'tv')) continue;
    const r = await fetch(`https://tmdb.eplayerx.com/tmdb/tv/details?id=${row.tmdbId}&language=zh-CN`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) { console.warn(`简介查询 ${row.tmdbId}: HTTP ${r.status}`); continue; }
    const d = await r.json() as { id: number; overview?: string };
    if (d.id === row.tmdbId && d.overview?.trim()) fills.set(row.tmdbId, d.overview);
  }
  const current = await getRawJson(key) as { data: Item[] };
  let changed = 0;
  for (const row of current.data.slice(0, 20)) {
    const text = row.tmdbId && fills.get(row.tmdbId);
    if (text && !row.overview?.trim() && (!row.media_type || row.media_type === 'tv')) { row.overview = text; changed++; }
  }
  if (changed) await putRawJson(key, current);
  console.log(`国产剧前20条：补写 ${changed} 条简介`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });

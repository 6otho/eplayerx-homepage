import assert from "node:assert/strict";
import { test } from "node:test";
import home from "./home/index.js";
import routes from "./tmdb/routes.js";
import crawler from "./crawler/index.js";
import { Hono } from "hono";
import { enrichWithImages, localizeMediaPayload } from "./media-languages.js";

test("independent languages retain textless carousel posters under TMDB image-language filtering", async (t) => {
  process.env.TMDB_API_TOKEN = "test";
  const requested: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requested.push(url);
    const included = (url.searchParams.get("include_image_language") ?? url.searchParams.get("language")?.split("-")[0] ?? "").split(",");
    const posters = [
      { file_path: "/textless.jpg", iso_639_1: null, width: 1000, height: 1500 },
      { file_path: "/cn.jpg", iso_639_1: "zh", iso_3166_1: "CN", width: 500, height: 750 },
      { file_path: "/en.jpg", iso_639_1: "en", width: 500, height: 750 },
    ].filter(image => included.includes(image.iso_639_1 ?? "null"));
    const logos = [{ file_path: "/ja.png", iso_639_1: "ja", width: 500, height: 100 }]
      .filter(image => included.includes(image.iso_639_1));
    return Response.json({ id: 42, title: "English title", original_language: "en", images: { posters, logos } });
  });
  for (const posterLanguage of [undefined, "en-US", "original"]) {
    const [item] = await enrichWithImages([{ id: 42, original_language: "en" }], "en-US", "movie",
      { appLanguage: "zh-CN", metadataLanguage: "en-US", posterLanguage, logoLanguage: "ja-JP" });
    assert.equal(item.noLogoPoster, "/textless.jpg");
    assert.equal(item.poster_path, posterLanguage ? "/en.jpg" : "/cn.jpg");
    assert.equal(item.logo, "/ja.png");
  }
  assert.equal(requested.length, 3, "known language combinations retain one request per card");
  assert.ok(requested.every(url => url.searchParams.get("include_image_language")?.split(",").includes("null")));
});

test("incomplete image enrichment preserves an already-known textless carousel poster", async (t) => {
  process.env.TMDB_API_TOKEN = "test";
  t.mock.method(globalThis, "fetch", async () => Response.json({ id: 42, original_language: "en", images: {} }));
  const [item] = await enrichWithImages([{ id: 42, noLogoPoster: "/saved-textless.jpg" }], "en-US", "movie",
    { appLanguage: "zh-CN", metadataLanguage: "en-US" });
  assert.equal(item.noLogoPoster, "/saved-textless.jpg");
});

test("Logo falls back to the newly discovered origin language without replacing textless posters", async (t) => {
  process.env.TMDB_API_TOKEN = "test";
  const paths: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    paths.push(url.pathname);
    const posters = [{ file_path: "/textless.jpg", iso_639_1: null, width: 1000, height: 1500 }];
    const logos = [{ file_path: "/ko.png", iso_639_1: "ko", width: 500, height: 100 },
      { file_path: "/en.png", iso_639_1: "en", width: 500, height: 100 }];
    if (url.pathname.endsWith("/images")) {
      assert.equal(url.searchParams.get("language"), null, "the fallback image request must include every language");
      return Response.json({ posters, logos });
    }
    return Response.json({ id: 42, title: "English metadata", original_language: "ko", images: {
      posters, logos: logos.filter(image => image.iso_639_1 === "en"),
    } });
  });
  const [item] = await enrichWithImages([{ id: 42 }], "en-US", "movie",
    { appLanguage: "zh-CN", metadataLanguage: "en-US", logoLanguage: "ja-JP" });
  assert.equal(item.logo, "/ko.png", "missing Japanese Logo falls back to the work's Korean language, not English metadata");
  assert.equal(item.noLogoPoster, "/textless.jpg");
  assert.deepEqual(paths, ["/3/movie/42", "/3/movie/42/images"]);
});

test("an empty or failed origin-language recovery keeps the textless poster already received", async (t) => {
  process.env.TMDB_API_TOKEN = "test";
  let failure = false;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname.endsWith("/images")) return Response.json({ posters: [], logos: [] }, { status: failure ? 503 : 200 });
    return Response.json({ id: 42, original_language: "ko", images: {
      posters: [{ file_path: "/known-textless.jpg", iso_639_1: null, width: 1000, height: 1500 }], logos: [],
    } });
  });
  for (failure of [false, true]) {
    const [item] = await enrichWithImages([{ id: 42 }], "en-US", "movie",
      { appLanguage: "zh-CN", metadataLanguage: "en-US", logoLanguage: "ja-JP" });
    assert.equal(item.noLogoPoster, "/known-textless.jpg");
  }
});

test("home keeps App-language headings and only adds explicit media preferences", async () => {
  for (const endpoint of ["/config", "/config/v2"]) {
    const base = await (await home.request(`${endpoint}?language=en-US`)).json() as any;
    const defaults = await (await home.request(`${endpoint}?language=en-US&metadataLanguage=&posterLanguage=&logoLanguage=`)).json();
    assert.deepEqual(defaults, base);
    const mixed = await (await home.request(`${endpoint}?language=en-US&metadataLanguage=zh-CN&posterLanguage=zh-TW&logoLanguage=ja-JP`)).json() as any;
    assert.deepEqual(mixed.blocks.map((b: any) => b.title), base.blocks.map((b: any) => b.title));
    const media = mixed.blocks.find((b: any) => b.id === "tmdb-popular-movies");
    assert.equal(media.source.query.language, "en-US");
    assert.equal(media.source.query.metadataLanguage, "zh-CN");
    assert.equal(media.source.query.posterLanguage, "zh-TW");
    assert.equal(media.source.query.logoLanguage, "ja-JP");
    const genres = mixed.blocks.find((b: any) => b.preset === "genres-list");
    assert.equal(genres.source.query.metadataLanguage, undefined);
  }
});

test("legacy discovery requests preserve upstream query defaults", async (t) => {
  process.env.TMDB_API_TOKEN = "test";
  const urls: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    urls.push(new URL(input instanceof Request ? input.url : String(input)));
    return Response.json({ results: [] });
  });
  await routes.request("/discover/movie?page=2");
  await routes.request("/discover/movie?page=2&language=zh-CN");
  assert.equal(urls[0].searchParams.get("language"), null);
  assert.equal(urls[1].searchParams.get("language"), "zh-CN");
});

test("TMDB text, posters and logos are independent, including original-language fallback", async (t) => {
  process.env.TMDB_API_TOKEN = "test";
  const urls: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    urls.push(url);
    if (url.pathname.includes("/discover/")) return Response.json({ results: [{ id: 42, title: "元数据标题", original_language: "ko" }] });
    return Response.json({ id: 42, title: "元数据标题", overview: "元数据简介", original_language: "ko", images: {
      posters: [{ file_path: "/tw.jpg", iso_639_1: "zh", iso_3166_1: "TW", width: 500, height: 750 }],
      logos: [{ file_path: "/ja.png", iso_639_1: "ja", width: 500, height: 100 },
        { file_path: "/ko.png", iso_639_1: "ko", width: 500, height: 100 }],
    } });
  });
  for (const [logoLanguage, path] of [["ja-JP", "/ja.png"], ["original", "/ko.png"]]) {
    const response = await routes.request(`/discover/movie?language=en-US&metadataLanguage=zh-CN&posterLanguage=zh-TW&logoLanguage=${logoLanguage}`);
    assert.equal(response.status, 200);
    const item = (await response.json() as any).results[0];
    assert.equal(item.title, "元数据标题");
    assert.equal(item.poster_path, "/tw.jpg");
    assert.equal(item.logo, path);
  }
  assert.equal(urls.length, 4, "reuse the existing one-detail-per-card enrichment budget");
  assert.ok(urls.every(url => url.searchParams.get("language") === "zh-CN"));
  assert.ok(urls.every(url => !url.searchParams.has("metadataLanguage") && !url.searchParams.has("posterLanguage")));
});

test("default posters and logos follow App language across independent preference combinations", async (t) => {
  process.env.TMDB_API_TOKEN = "test";
  const urls: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    urls.push(url);
    const language = url.searchParams.get("language");
    if (url.pathname.includes("/discover/")) return Response.json({ results: [
      { id: 42, title: language, poster_path: "/metadata-poster.jpg", original_language: "ko" },
    ] });
    return Response.json({ id: 42, title: language, overview: language, original_language: "ko", images: {
      posters: [
        { file_path: "/en.jpg", iso_639_1: "en", width: 500, height: 750, vote_average: 10 },
        { file_path: "/cn.jpg", iso_639_1: "zh", iso_3166_1: "CN", width: 500, height: 750 },
        { file_path: "/tw.jpg", iso_639_1: "zh", iso_3166_1: "TW", width: 500, height: 750 },
        { file_path: "/ko.jpg", iso_639_1: "ko", width: 500, height: 750 },
      ],
      logos: [
        { file_path: "/en.png", iso_639_1: "en", width: 500, height: 100, vote_average: 10 },
        { file_path: "/cn.png", iso_639_1: "zh", iso_3166_1: "CN", width: 500, height: 100 },
        { file_path: "/tw.png", iso_639_1: "zh", iso_3166_1: "TW", width: 500, height: 100 },
        { file_path: "/ko.png", iso_639_1: "ko", width: 500, height: 100 },
      ],
    } });
  });
  const cases = [
    ["language=zh-CN&metadataLanguage=en-US", "en-US", "/cn.jpg", "/cn.png"],
    ["language=zh-TW&metadataLanguage=en-US&posterLanguage=&logoLanguage=", "en-US", "/tw.jpg", "/tw.png"],
    ["language=zh-CN&logoLanguage=en-US", "zh-CN", "/cn.jpg", "/en.png"],
    ["language=zh-CN&posterLanguage=en-US", "zh-CN", "/en.jpg", "/cn.png"],
    ["language=zh-CN&metadataLanguage=en-US&posterLanguage=original&logoLanguage=original", "en-US", "/ko.jpg", "/ko.png"],
    ["language=en-US&metadataLanguage=zh-CN&posterLanguage=zh-TW&logoLanguage=original", "zh-CN", "/tw.jpg", "/ko.png"],
  ];
  for (const [query, metadata, poster, logo] of cases) {
    const response = await routes.request(`/discover/movie?${query}`);
    const item = (await response.json() as any).results[0];
    assert.equal(item.title, metadata, query);
    assert.equal(item.poster_path, poster, query);
    assert.equal(item.logo, logo, query);
  }
  assert.equal(urls.length, cases.length * 2, "each list keeps its one-details-per-card budget");
});

test("missing preferred artwork falls back to original and textless images without random translations", async (t) => {
  process.env.TMDB_API_TOKEN = "test";
  t.mock.method(globalThis, "fetch", async () => Response.json({ id: 42, original_language: "ko", images: {
    posters: [{ file_path: "/en.jpg", iso_639_1: "en", width: 500, height: 750 },
      { file_path: "/ko.jpg", iso_639_1: "ko", width: 500, height: 750 }],
    logos: [{ file_path: "/en.png", iso_639_1: "en", width: 500, height: 100 },
      { file_path: "/textless.png", iso_639_1: null, width: 500, height: 100 }],
  } }));
  const app = new Hono();
  app.get("/", async c => c.json(await localizeMediaPayload({ data: [
    { id: 42, media_type: "movie", title: "Saved title" },
  ] }, c)));
  const data = await (await app.request("/?language=zh-CN&metadataLanguage=en-US")).json() as any;
  assert.equal(data.data[0].poster_path, "/ko.jpg");
  assert.equal(data.data[0].logo, "/textless.png");
});

test("original artwork uses production-country language when original_language is missing", async (t) => {
  process.env.TMDB_API_TOKEN = "test";
  t.mock.method(globalThis, "fetch", async () => Response.json({ id: 42, production_countries: [{ iso_3166_1: "JP" }], images: {
    posters: [{ file_path: "/zh.jpg", iso_639_1: "zh", width: 500, height: 750 },
      { file_path: "/ja.jpg", iso_639_1: "ja", width: 500, height: 750 }],
    logos: [{ file_path: "/zh.png", iso_639_1: "zh", width: 500, height: 100 },
      { file_path: "/ja.png", iso_639_1: "ja", width: 500, height: 100 }],
  } }));
  const app = new Hono();
  app.get("/", async c => c.json(await localizeMediaPayload({ data: [
    { id: 42, media_type: "movie", title: "Saved title" },
  ] }, c)));
  const data = await (await app.request("/?language=zh-CN&posterLanguage=original&logoLanguage=original")).json() as any;
  assert.equal(data.data[0].poster_path, "/ja.jpg");
  assert.equal(data.data[0].logo, "/ja.png");
});

test("published snapshots stay unchanged and default requests do no TMDB work", async (t) => {
  process.env.TMDB_API_TOKEN = "test";
  const snapshot = { data: [{ tmdbId: 42, media_type: "movie", title: "已刮削标题", poster_path: "/saved.jpg", translations: { en: { title: "Saved title" } } }] };
  const saved = JSON.stringify(snapshot);
  let lookups = 0;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "assets.eplayerx.com") return Response.json(snapshot);
    lookups++;
    return Response.json({ id: 42, title: "新语言标题", original_language: "ja", images: {} });
  });
  const original = await crawler.request("/popular/douban/movies?language=en-US", {}, {});
  assert.equal((await original.json() as any).data[0].title, "Saved title");
  assert.equal(lookups, 0);
  const localized = await crawler.request("/popular/douban/movies?language=en-US&metadataLanguage=zh-CN", {}, {});
  assert.equal((await localized.json() as any).data[0].title, "已刮削标题");
  assert.equal(lookups, 0, "reuse stored Chinese metadata rather than re-scraping");
  const japanese = await crawler.request("/popular/douban/movies?language=en-US&metadataLanguage=ja-JP", {}, {});
  assert.equal((await japanese.json() as any).data[0].title, "新语言标题");
  assert.equal(lookups, 1);
  assert.equal(JSON.stringify(snapshot), saved);
});

test("collection identity is preserved while its movie posters are localized", async (t) => {
  process.env.TMDB_API_TOKEN = "test";
  const paths: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    paths.push(url.pathname);
    if (url.pathname === "/3/collection/90") return Response.json({ id: 90, name: "Collection", parts: [{ id: 42, title: "Movie" }] });
    return Response.json({ id: 42, images: { posters: [{ file_path: "/ja.jpg", iso_639_1: "ja", width: 500, height: 750 }] } });
  });
  const response = await routes.request("/collection/details?id=90&language=en-US&posterLanguage=ja-JP");
  const data = await response.json() as any;
  assert.equal(data.id, 90);
  assert.equal(data.name, "Collection");
  assert.equal(data.parts[0].poster_path, "/ja.jpg");
  assert.deepEqual(paths, ["/3/collection/90", "/3/movie/42"]);
});

test("collection preview headings stay in App language while nested media changes", async (t) => {
  process.env.TMDB_API_TOKEN = "test";
  t.mock.method(globalThis, "fetch", async () => Response.json({ id: 42, title: "日本語の作品名", images: {} }));
  const preview = { type: "collection_preview", title: "Weekly schedule", children: {
    monday: { title: "Monday", data: [{ tmdbId: 42, media_type: "movie", title: "Saved title" }] },
  } };
  const app = new Hono();
  app.get("/", async c => c.json(await localizeMediaPayload(preview, c)));
  const response = await app.request("/?language=en-US&metadataLanguage=ja-JP");
  const data = await response.json() as any;
  assert.equal(data.title, "Weekly schedule");
  assert.equal(data.children.monday.title, "Monday");
  assert.equal(data.children.monday.data[0].title, "日本語の作品名");
  assert.equal(preview.children.monday.data[0].title, "Saved title");
});

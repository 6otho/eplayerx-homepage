/**
 * Discover TV shows by original language from TMDB.
 * Codes align with TMDB_LANGUAGES in blocks/types.ts (ISO 639-1, region stripped;
 * zh-CN/TW/HK collapse to zh).
 */

import { tmdb } from "../tmdb/client.js";
import {
  type DiscoverTVByLanguageItem,
  saveDiscoverTVByLanguage,
} from "./service.js";

// 语言封面图片根地址（R2 自定义域名下的 covers 目录）。
// 默认指向 https://r2.eplayerx.cc.cd/covers；若使用自己的 R2 自定义域名，
// 设置环境变量 R2_COVER_BASE_URL 覆盖即可，无需改代码。
const R2_COVER_BASE_URL =
  process.env.R2_COVER_BASE_URL || "https://r2.eplayerx.cc.cd/covers";

// Keep in sync with unique language prefixes of TMDB_LANGUAGES.
const LANGUAGES = [
  { code: "zh", name: "Chinese" },
  { code: "en", name: "English" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "nl", name: "Dutch" },
  { code: "it", name: "Italian" },
  { code: "ru", name: "Russian" },
  { code: "pt", name: "Portuguese" },
  { code: "th", name: "Thai" },
  { code: "vi", name: "Vietnamese" },
  { code: "id", name: "Indonesian" },
  { code: "hi", name: "Hindi" },
  { code: "tr", name: "Turkish" },
  { code: "ar", name: "Arabic" },
] as const;

/**
 * Fetch top TV show by original language
 */
async function fetchTVByLanguage(
  languageCode: string
): Promise<DiscoverTVByLanguageItem | null> {
  try {
    const result = await tmdb.GET("/3/discover/tv", {
      params: {
        query: {
          language: "zh-CN",
          with_original_language: languageCode,
          page: 1,
        },
      },
    });

    if (result.data?.results?.[0]) {
      const tv = result.data.results[0];
      const lang = LANGUAGES.find((l) => l.code === languageCode);

      // 自动拼接语言封面路径，例如 https://r2.eplayerx.cc.cd/covers/zh.png
      const customCoverUrl = `${R2_COVER_BASE_URL}/${languageCode}.png`;

      return {
        language: languageCode,
        languageName: lang?.name || languageCode,
        id: tv.id as number,
        name: tv.name || "",
        original_name: tv.original_name || "",
        overview: tv.overview || null,

        // 语言封面：poster_path / thumb / noLogoPoster 统一使用 R2 上的语言标识图
        poster_path: customCoverUrl,
        thumb: customCoverUrl,
        noLogoPoster: customCoverUrl,
        backdrop_path: tv.backdrop_path || null,

        first_air_date: tv.first_air_date || null,
        vote_average: tv.vote_average || 0,
        vote_count: tv.vote_count || 0,
        genre_ids: tv.genre_ids || [],
      };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching TV for language "${languageCode}":`, error);
    return null;
  }
}

/**
 * Discover TV shows by all configured languages
 */
export async function discoverTVByLanguages(): Promise<
  DiscoverTVByLanguageItem[]
> {
  console.log("🌍 Discovering TV shows by language...\n");

  const results: DiscoverTVByLanguageItem[] = [];

  for (const lang of LANGUAGES) {
    console.log(`🔍 Fetching ${lang.name} (${lang.code})...`);

    const tv = await fetchTVByLanguage(lang.code);

    if (tv) {
      results.push(tv);
      console.log(`✅ Found: ${tv.name} | 封面: ${tv.poster_path}`);
    } else {
      console.log(`❌ No result for ${lang.name}`);
    }
  }

  console.log(`\n📊 Total: ${results.length} TV shows found`);

  return results;
}

// Run if executed directly
async function main() {
  const results = await discoverTVByLanguages();

  if (results.length > 0) {
    await saveDiscoverTVByLanguage(results);
    console.log(`\n💾 Saved ${results.length} TV shows to Cloudflare R2`);
  }

  console.log("\n📋 Results:\n");
  console.log(JSON.stringify(results, null, 2));

  return results;
}

// 安全判断 process，防止 Cloudflare Worker 运行环境中报错崩溃
if (typeof process !== "undefined" && process.argv && process.argv[1]?.includes("discover-tv-by-language")) {
  main().catch(console.error);
}

/**
 * Trakt scraper - fetch trending movies
 */

export interface TraktItem {
  title: string;
  year?: number;
  tmdb_id?: number;
  watchers?: number;
}

// 传入 clientId (从环境变量获取)
export async function fetchTraktTrending(clientId: string): Promise<TraktItem[]> {
  try {
    // limit=20 表示获取前 20 个最热门的数据
    const response = await fetch("https://api.trakt.tv/movies/trending?limit=20", {
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": clientId,
        "User-Agent": "EPlayerX-API-Client/1.0"
      }
    });

    if (!response.ok) {
      console.error(`Trakt API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    // 整理成和 BilibiliItem 兼容的格式，同时保留原作者可能用得上的 tmdb_id
    const items: TraktItem[] = data.map((item: any) => ({
      title: item.movie.title,
      year: item.movie.year,
      tmdb_id: item.movie.ids.tmdb,
      watchers: item.watchers
    }));

    return items;
  } catch (error) {
    console.error("Error fetching Trakt:", error);
    return [];
  }
}

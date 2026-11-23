import { getCommunityBlocksByIds } from "../blocks/storage.js";
import type { HomeConfigV2Block } from "./config.js";
const collections = [
  {
    "style": "image-landscape",
    "children": [
      {
        "source": {
          "path": "https://api.eplayerx.com/blocks/data/community-zh-fusion-directors-anderson",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-directors-anderson",
        "showOverview": false,
        "title": "Anderson",
        "showRank": false,
        "image": "https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/directors/wide/fexm92/anderson-wide.png",
        "label": "Anderson"
      },
      {
        "source": {
          "path": "https://api.eplayerx.com/blocks/data/community-zh-fusion-directors-carpenter",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-directors-carpenter",
        "showOverview": false,
        "title": "Carpenter",
        "showRank": false,
        "image": "https://assets.eplayerx.com/blocks/logos/bd7a411b59c1.webp",
        "label": "Carpenter"
      },
      {
        "source": {
          "path": "https://api.eplayerx.com/blocks/data/community-zh-fusion-directors-depalma",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-directors-depalma",
        "showOverview": false,
        "title": "Depalma",
        "showRank": false,
        "image": "https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/directors/wide/fexm92/depalma-wide.png",
        "label": "Depalma"
      },
      {
        "source": {
          "path": "https://api.eplayerx.com/blocks/data/community-zh-fusion-directors-fincher",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-directors-fincher",
        "showOverview": false,
        "title": "Fincher",
        "showRank": false,
        "image": "https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/directors/wide/fexm92/fincher-wide.png",
        "label": "Fincher"
      },
      {
        "source": {
          "path": "https://api.eplayerx.com/blocks/data/community-zh-fusion-directors-hitchcock",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-directors-hitchcock",
        "showOverview": false,
        "title": "Hitchcock",
        "showRank": false,
        "image": "https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/directors/wide/fexm92/hitchcock-wide.png",
        "label": "Hitchcock"
      },
      {
        "source": {
          "path": "https://api.eplayerx.com/blocks/data/community-zh-fusion-directors-kubrick",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-directors-kubrick",
        "showOverview": false,
        "title": "Kubrick",
        "showRank": false,
        "image": "https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/directors/wide/fexm92/kubrick-wide.png",
        "label": "Kubrick"
      },
      {
        "source": {
          "path": "https://api.eplayerx.com/blocks/data/community-zh-fusion-directors-nolan",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-directors-nolan",
        "showOverview": false,
        "title": "Nolan",
        "showRank": false,
        "image": "https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/directors/wide/fexm92/nolan-wide.png",
        "label": "Nolan"
      },
      {
        "source": {
          "path": "https://api.eplayerx.com/blocks/data/community-zh-fusion-directors-scorsese",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-directors-scorsese",
        "showOverview": false,
        "title": "Scorsese",
        "showRank": false,
        "image": "https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/directors/wide/fexm92/scorsese-wide.png",
        "label": "Scorsese"
      },
      {
        "source": {
          "path": "https://api.eplayerx.com/blocks/data/community-zh-fusion-directors-spielberg",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-directors-spielberg",
        "showOverview": false,
        "title": "Spielberg",
        "showRank": false,
        "image": "https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/directors/wide/fexm92/spielberg-wide.png",
        "label": "Spielberg"
      },
      {
        "source": {
          "path": "https://api.eplayerx.com/blocks/data/community-zh-fusion-directors-villeneuve",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-directors-villeneuve",
        "showOverview": false,
        "title": "Villeneuve",
        "showRank": false,
        "image": "https://raw.githubusercontent.com/itsrenoria/fusion-starter-kit/refs/heads/main/resources/widgets/directors/wide/fexm92/villeneuve-wide.png",
        "label": "Villeneuve"
      }
    ],
    "id": "col-da5d0eccad52",
    "groupMode": "custom",
    "language": "",
    "title": "名导作品集",
    "category": "",
    "itemCount": 60,
    "preset": "collection-list"
  },
  {
    "language": "",
    "itemCount": 36,
    "style": "image-landscape",
    "title": "获奖佳片",
    "category": "",
    "groupMode": "custom",
    "preset": "collection-list",
    "children": [
      {
        "source": {
          "path": "https://api.eplayerx.com/blocks/data/community-zh-fusion-awards-bafta",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-awards-bafta",
        "showOverview": false,
        "title": "Bafta",
        "showRank": false,
        "image": "https://assets.eplayerx.com/blocks/logos/4b410ba46d06.webp",
        "label": "Bafta"
      },
      {
        "source": {
          "path": "https://api.eplayerx.com/blocks/data/community-zh-fusion-awards-fisa",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-awards-fisa",
        "showOverview": false,
        "title": "Fisa",
        "showRank": false,
        "image": "https://assets.eplayerx.com/blocks/logos/6c85125f8e61.webp",
        "label": "Fisa"
      },
      {
        "source": {
          "path": "https://api.eplayerx.com/blocks/data/community-zh-fusion-awards-goldenglobes",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-awards-goldenglobes",
        "showOverview": false,
        "title": "Goldenglobes",
        "showRank": false,
        "image": "https://assets.eplayerx.com/blocks/logos/d8d07bf0a68e.webp",
        "label": "Goldenglobes"
      },
      {
        "source": {
          "path": "https://api.eplayerx.com/blocks/data/community-zh-fusion-awards-iff",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-awards-iff",
        "showOverview": false,
        "title": "Iff",
        "showRank": false,
        "image": "https://assets.eplayerx.com/blocks/logos/e2e300647692.webp",
        "label": "Iff"
      },
      {
        "source": {
          "path": "https://api.eplayerx.com/blocks/data/community-zh-fusion-awards-oscars",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-awards-oscars",
        "showOverview": false,
        "title": "Oscars",
        "showRank": false,
        "image": "https://assets.eplayerx.com/blocks/logos/6cc56a963cae.webp",
        "label": "Oscars"
      },
      {
        "source": {
          "path": "https://api.eplayerx.com/blocks/data/community-zh-fusion-awards-viff",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-awards-viff",
        "showOverview": false,
        "title": "Viff",
        "showRank": false,
        "image": "https://assets.eplayerx.com/blocks/logos/6355e9095dca.webp",
        "label": "Viff"
      }
    ],
    "id": "col-a109e56387f5"
  },
  {
    "itemCount": 1819,
    "language": "zh-CN",
    "style": "image-landscape",
    "title": "年代经典",
    "children": [
      {
        "source": {
          "path": "https://assets.eplayerx.com/blocks/public/community-zh-fusion-decades-2020s.json",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-decades-2020s",
        "showOverview": false,
        "title": "2020s",
        "showRank": false,
        "image": "https://assets.eplayerx.com/blocks/logos/627a24b61afd.webp",
        "label": "2020s",
        "route": {
          "title": "2020s",
          "type": "tmdb-list",
          "params": {
            "category": "discover",
            "releaseDateGte": "2020-01-01",
            "type": "movie",
            "releaseDateLte": "2029-12-31"
          }
        }
      },
      {
        "source": {
          "path": "https://assets.eplayerx.com/blocks/public/community-zh-fusion-decades-2010s.json",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-decades-2010s",
        "showOverview": false,
        "title": "2010s",
        "showRank": false,
        "image": "https://assets.eplayerx.com/blocks/logos/e27e2598acab.webp",
        "label": "2010s",
        "route": {
          "title": "2010s",
          "type": "tmdb-list",
          "params": {
            "category": "discover",
            "releaseDateGte": "2010-01-01",
            "type": "movie",
            "releaseDateLte": "2019-12-31"
          }
        }
      },
      {
        "source": {
          "path": "https://assets.eplayerx.com/blocks/public/community-zh-fusion-decades-2000s.json",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-decades-2000s",
        "showOverview": false,
        "title": "2000s",
        "showRank": false,
        "image": "https://assets.eplayerx.com/blocks/logos/8c611cdbef7c.webp",
        "label": "2000s",
        "route": {
          "title": "2000s",
          "type": "tmdb-list",
          "params": {
            "category": "discover",
            "releaseDateGte": "2000-01-01",
            "type": "movie",
            "releaseDateLte": "2009-12-31"
          }
        }
      },
      {
        "source": {
          "path": "https://assets.eplayerx.com/blocks/public/community-zh-fusion-decades-1990s.json",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-decades-1990s",
        "showOverview": false,
        "title": "1990s",
        "showRank": false,
        "image": "https://assets.eplayerx.com/blocks/logos/4ab01b89d331.webp",
        "label": "1990s",
        "route": {
          "title": "1990s",
          "type": "tmdb-list",
          "params": {
            "category": "discover",
            "releaseDateGte": "1990-01-01",
            "type": "movie",
            "releaseDateLte": "1999-12-31"
          }
        }
      },
      {
        "source": {
          "path": "https://assets.eplayerx.com/blocks/public/community-zh-fusion-decades-1980s.json",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-decades-1980s",
        "showOverview": false,
        "title": "1980s",
        "showRank": false,
        "image": "https://assets.eplayerx.com/blocks/logos/92c5051a0917.webp",
        "label": "1980s",
        "route": {
          "title": "1980s",
          "type": "tmdb-list",
          "params": {
            "category": "discover",
            "releaseDateGte": "1980-01-01",
            "type": "movie",
            "releaseDateLte": "1989-12-31"
          }
        }
      },
      {
        "source": {
          "path": "https://assets.eplayerx.com/blocks/public/community-zh-fusion-decades-1970s.json",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-decades-1970s",
        "showOverview": false,
        "title": "1970s",
        "showRank": false,
        "image": "https://assets.eplayerx.com/blocks/logos/ffba4bd09867.webp",
        "label": "1970s",
        "route": {
          "title": "1970s",
          "type": "tmdb-list",
          "params": {
            "category": "discover",
            "releaseDateGte": "1970-01-01",
            "type": "movie",
            "releaseDateLte": "1979-12-31"
          }
        }
      },
      {
        "source": {
          "path": "https://assets.eplayerx.com/blocks/public/community-zh-fusion-decades-1960s.json",
          "itemEnvelope": "data"
        },
        "mediaType": "movie",
        "preset": "thumb-list",
        "id": "community-zh-fusion-decades-1960s",
        "showOverview": false,
        "title": "1960s",
        "showRank": false,
        "image": "https://assets.eplayerx.com/blocks/logos/a1490a9e147b.webp",
        "label": "1960s",
        "route": {
          "title": "1960s",
          "type": "tmdb-list",
          "params": {
            "category": "discover",
            "releaseDateGte": "1960-01-01",
            "type": "movie",
            "releaseDateLte": "1969-12-31"
          }
        }
      }
    ],
    "id": "col-9e37cdc1f13d",
    "category": "movie",
    "groupMode": "custom",
    "preset": "collection-list",
    "author": "Zemkk"
  }
] as HomeConfigV2Block[];
export async function orderCustomHome(blocks: HomeConfigV2Block[], db?: D1Database) {
 const rows = db && await getCommunityBlocksByIds(db, collections.map(b => b.id)).catch(() => undefined);
 const mapped = collections.map(fallback => {
  try {
   const live = JSON.parse(rows?.get(fallback.id)?.block_json ?? 'null');
   if (live?.preset === 'collection-list' && Array.isArray(live.children) && live.children.length >= 2)
    return { ...fallback, ...live, id: fallback.id };
  } catch { /* Use the published share snapshot. */ }
  return fallback;
 });
 const ids = ["tmdb-discover-genres", "tmdb-discover-tv-by-language", "tmdb-discover-networks"];
 const browsers = ids.flatMap(id => blocks.filter(b => b.id === id).slice(0, 1));
 const moved = new Set([...ids, ...collections.map(b => b.id)]);
 return blocks.filter(b => !moved.has(b.id)).flatMap(b => b.id === "douban_korean_tv" ? [...browsers,b] : b.id === "weekly_japanese_drama_collection" ? [b,...mapped] : [b]);
}

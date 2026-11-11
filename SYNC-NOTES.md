# 上游同步说明（6otho/eplayerx-homepage）

## 仓库关系

```
liixing/eplayerx-homepage     ← 真正的上游（作者 snow，更新频繁）
        └── 6otho/eplayerx-homepage   ← 你的仓库，是它的 fork
```

你 fork 里的历史：`05327c2`（2026-10-25 上游最后同步点）→ 之后是 5 个你自己的提交（`wrangler.toml` ×5、`src/home/config.ts`、`src/crawler/index.ts`、`src/home/index.ts`）。

之前每次上游更新都要重改一遍的原因：你的改动直接压在旧历史上，上游一动同一文件就冲突；而 fork 同步按钮只会给你「上游原样」。

## 现在的结构

`main` = 最新上游 + **一个**自定义提交：

```
* custom: EplayerX 首页自定义（ikuu 域名 / D1 / 自定义 config / CORS，含同步脚本）
* feat: redesign timing admin ...   ← 上游 9b49a54
```

以后同步只做一件事：

```sh
sh sync-upstream.sh
```

流程：拉 `upstream/main` → 备份当前分支 → 把你的全部文件铺到最新上游之上 → 合成一个自定义提交 → 对比同步前后的自定义补丁是否一致 → 有差异就打印出来让你核对。
每次同步会生成 `backup-before-sync-时间戳` 分支，出问题 `git reset --hard <该分支>` 即可。

## 你的自定义清单（合并/核对时看这里）

### wrangler.toml
- `routes`：`*.ikuu.eu.org` / `*.ikuux.cyou` 通配 + 两个根域名
- `[vars] BLOCKS_ADMIN_PASSWORD`
- D1 `database_id = c3a09032-48ce-471c-a0cb-0b91a170103c`
- R2 `binding = ASSETS / bucket_name = crawler`
- 上游的 `[[ratelimits]]`（SUBTITLE / RATINGS / EPISODE_TIMING）与 `[triggers] crons` 保留

### src/home/config.ts（43 个自建分类 + 周更表）
- 底版永远取**上游**，再换成你的 `createV2BlockTemplates`、你的 `TITLE_TRANSLATIONS` / `GENRE_TRANSLATIONS`，`Locale` 去掉 `vi`
- 你的 `createDefaultHomeConfig` 是 async 且需要 `db`（官方是同步）；官方 `src/blocks/collections.ts`、`src/blocks/index.tsx` 会同步读 `cfg.blocks`，所以加了兼容 shim：返回的 Promise 上挂 `blocks`（由 `createCustomBlocksSync()` 同步生成，不含 D1 年代合集）
- 用本地 `CustomOptions` 类型，不去改上游导出的 `HomeConfigV2Options`

### src/home/index.ts
- `app.use("*", cors())`
- `isPlayerClient(c)`：播放器客户端 / `?custom=1` / `?api` → 自定义 `/config`；浏览器 → 官方 `/config/v2`

### src/crawler/index.ts
- 顶部补 `import { hasMediaLanguages, languagePreference, localizeMediaPayload } from "../media-languages.js";`（上游自己没导入，你的 `servePopularJson` 改写依赖它）
- `Locale` 与翻译表去掉 `vi`
- 分类封面图名 `DRAMA-2.png` 等（`GENRE_ITEMS`）
- 上游给 `localizeContentItem` / `servePopularJson` 新增 `tagline` 时不需要合并回来

## 本次合并（05327c2 → 9b49a54）

- 新增播放时间轴 / 去广告：`src/episode-timings.ts`、`src/ad-scan-*`、admin 页面；D1 迁移 0012–0025
- 新增 `[[ratelimits]] EPISODE_TIMING_RATE_LIMITER`
- TMDB 返回 `tagline`，缓存 epoch 更新

## 验证结果

- `tsc --noEmit`：0 错误（已装 typescript + workers-types 跑过）
- `wrangler deploy --dry-run`：绑定正常（DB / ASSETS / 3 个 ratelimit / BLOCKS_ADMIN_PASSWORD）
- 测试：`src/blocks/*`、`src/subtitles/deepseek` 全过；`src/home/localization.test.ts` 的越南语用例和 `media-languages.test.ts` 第 5 条 = 你的定制（去掉 vi / 自定义模板）本来就会打破的，属预期；`ad-scan-requests.test.ts` 在上游原版就失败（runner 环境问题）

## 部署前

```sh
npx wrangler d1 migrations apply blocks --remote   # 应用 0012~0025
npx wrangler deploy --keep-vars
```

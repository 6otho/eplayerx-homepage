#!/bin/sh
# 一键同步上游 + 保留本地自定义
#   用法: sh sync-upstream.sh        （在仓库目录里执行，本文件同级有 .git）
#   原理: 把「你的全部自定义」当成一份补丁，叠到最新的 upstream/main 之上。
#   分支: main 永远 = 上游最新 + 一个自定义提交
set -e

UPSTREAM_URL="https://github.com/liixing/eplayerx-homepage.git"
CUSTOM_COMMIT_MSG="custom: EplayerX 首页自定义（ikuu 域名 / D1 / 自定义 config / CORS，含同步脚本）"

say() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

# 1. 上游 remote（幂等）
git remote get-url upstream >/dev/null 2>&1 || git remote add upstream "$UPSTREAM_URL"
git remote set-url upstream "$UPSTREAM_URL"

say "拉取上游"
git fetch upstream main
UP=$(git rev-parse upstream/main)
echo "上游 main = $(git rev-parse --short $UP)"
echo "本地 HEAD = $(git rev-parse --short HEAD)"

# 2. 暂存任何未提交改动，保证工作区干净
STASHED=0
if [ -n "$(git status --porcelain)" ]; then
	echo "发现未提交改动，先 stash"
	git stash push -u -m "sync-upstream-$(date +%s)"
	STASHED=1
fi

# 3. 记录同步前的自定义补丁
git diff $UP...HEAD > /tmp/epx-custom-before.diff || true

# 4. 备份，便于回滚
BACKUP="backup-before-sync-$(date +%Y%m%d-%H%M%S)"
git branch "$BACKUP"
echo "已备份当前状态到分支 $BACKUP（回滚: git reset --hard $BACKUP）"

# 5. 重组：先取出你的完整文件快照，再把 main 重置到上游，然后把你的版本铺回去
MY_STATE=$(git rev-parse HEAD)
say "把自定义叠到最新上游"
git reset --hard -q "$UP"
git checkout "$MY_STATE" -- . 2>/dev/null || true
# 上游新增、你本地没有的文件：保留上游版本
for f in $(git diff --name-only "$MY_STATE" "$UP" --diff-filter=A); do
	git checkout "$UP" -- "$f" 2>/dev/null || true
done
# 你删掉、上游还在的文件：保持删除
for f in $(git diff --name-only "$MY_STATE" "$UP" --diff-filter=D); do
	git rm -q --ignore-unmatch -- "$f" 2>/dev/null || true
done

# 6. 合成一个自定义提交
git add -A
if git diff --cached --quiet; then
	echo "与上游完全一致：没有需要保留的自定义改动"
else
	git commit -q -m "$CUSTOM_COMMIT_MSG"
fi

# 7. 对比同步前后的自定义补丁
git diff $UP...HEAD > /tmp/epx-custom-after.diff
say "对比同步前后的自定义补丁"
if diff -q /tmp/epx-custom-before.diff /tmp/epx-custom-after.diff >/dev/null; then
	echo "自定义补丁与同步前完全一致 ✔"
else
	echo "自定义补丁有变化（上游改了同一个文件，内容已合并进来）。请核对差异："
	diff -u /tmp/epx-custom-before.diff /tmp/epx-custom-after.diff | head -150 || true
	echo
	echo "重点核对："
	echo "  src/home/config.ts   —— 你的自定义模板 + createDefaultHomeConfig 兼容 shim 是否还在"
	echo "  src/home/index.ts    —— cors() + isPlayerClient 分发是否还在"
	echo "  src/crawler/index.ts —— 繁体 Locale / 图片名 / 去掉 vi / servePopularJson 改写是否还在"
	echo "  wrangler.toml        —— ikuu 路由 / D1 id / R2 / vars 与上游新增的 ratelimits、crons"
fi

if [ "$STASHED" = "1" ]; then
	echo
	echo "提示: 同步前的未提交改动已 stash（git stash list / git stash pop 恢复）"
fi

say "完成：$(git log --oneline -1)"
echo "查看你的全部自定义: git diff --stat upstream/main...HEAD"
echo "部署: npx wrangler d1 migrations apply blocks --remote && npx wrangler deploy --keep-vars"

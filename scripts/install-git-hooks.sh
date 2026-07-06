#!/bin/bash
# scripts/install-git-hooks.sh
#
# 把 scripts/git-hooks/* 拷到 .git/hooks/。
# 装完后 `git push` 会自动触发 auto-bump。
#
# 用法: bash scripts/install-git-hooks.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOKS_SRC="$SCRIPT_DIR/git-hooks"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "❌ 不是 git 仓库"
  exit 1
fi

HOOKS_DST="$(git rev-parse --git-dir)/hooks"

if [ ! -d "$HOOKS_SRC" ]; then
  echo "❌ 没找到 $HOOKS_SRC"
  exit 1
fi

echo "安装 git hooks 到 $HOOKS_DST/:"
for hook in "$HOOKS_SRC"/*; do
  [ -f "$hook" ] || continue
  name="$(basename "$hook")"
  cp "$hook" "$HOOKS_DST/$name"
  chmod +x "$HOOKS_DST/$name"
  echo "  ✓ $name"
done

echo ""
echo "✅ 装完。"
echo "验证: ls -la $HOOKS_DST/pre-push"
echo "想跳过本次: GIT_PUSH_NO_BUMP=1 git push  或  git push --no-bump 形式参数"

#!/usr/bin/env bash
# Stopフック: コード(.ts/.tsx)を変更したターンの完了時に型チェックを走らせ、
# 型エラーが残っていたら完了をブロックしてClaudeに修正させる。
# 非コードのターン（restaurant検索など）では git diff が空振りして即exit 0＝無負荷。

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

# .ts/.tsx に変更が無ければ何もしない
if ! git diff --name-only HEAD 2>/dev/null | grep -qE '\.tsx?$'; then
  exit 0
fi

OUT=$(npx tsc --noEmit 2>&1)
if [ $? -eq 0 ]; then
  exit 0
fi

{
  echo "TypeScriptの型エラーが残っています。完了を報告する前に修正してください:"
  echo "$OUT" | head -40
} >&2
exit 2

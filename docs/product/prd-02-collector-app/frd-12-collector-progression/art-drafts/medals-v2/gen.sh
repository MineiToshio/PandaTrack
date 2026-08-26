#!/usr/bin/env bash
# Generate one medal image with Codex's built-in image tool.
#   ./gen.sh <medalKey> [take]
# The attempt is kept forever under raw/<medalKey>-take<N>/ with its codex.log.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEY="${1:?usage: gen.sh <medalKey> [take]}"
TAKE="${2:-1}"
PROMPT_FILE="$HERE/prompts/$KEY.txt"
OUT="$HERE/raw/$KEY-take$TAKE"

[ -f "$PROMPT_FILE" ] || { echo "no prompt: $PROMPT_FILE" >&2; exit 1; }
mkdir -p "$OUT"

codex exec --cd "$OUT" --sandbox workspace-write --skip-git-repo-check \
  "$(cat "$PROMPT_FILE")" >"$OUT/codex.log" 2>&1 || true

if [ -f "$OUT/$KEY.png" ]; then
  echo "OK   $KEY take $TAKE -> $OUT/$KEY.png"
else
  echo "MISS $KEY take $TAKE (see $OUT/codex.log)" >&2
  ls -la "$OUT" >&2
  exit 2
fi

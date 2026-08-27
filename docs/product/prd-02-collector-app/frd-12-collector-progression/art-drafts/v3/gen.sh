#!/bin/bash
# Generate one rank emblem with codex exec, isolated in its own directory so parallel runs
# cannot clobber each other. Usage: gen.sh rank-01-kohai
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
SLUG="$1"
KEY="${SLUG#rank-??-}"
DIR="$HERE/raw/$SLUG"
mkdir -p "$DIR"
PROMPT="$(cat "$HERE/prompts/$SLUG.txt")"
codex exec --cd "$DIR" --sandbox workspace-write --skip-git-repo-check --json "$PROMPT" < /dev/null \
  > "$DIR/codex.log" 2>&1
if [ -f "$DIR/$KEY.png" ]; then
  echo "OK   $SLUG  $(python3 -c "from PIL import Image;i=Image.open('$DIR/$KEY.png');print(i.size,i.mode)")"
else
  echo "MISS $SLUG  (no $KEY.png) files: $(ls "$DIR")"
fi

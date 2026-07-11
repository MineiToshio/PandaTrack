#!/bin/bash
# Wrapper that forces the system Node (/usr/local/bin) ahead of Codex.app's
# bundled Node when this script is spawned by the Claude Code MCP preview
# tool. The preview tool spawns commands without sourcing ~/.zshrc, so PATH
# fixes there don't reach this process. We prepend explicitly here.
#
# Uses `dev:lan` (binds 0.0.0.0) so the dev server is reachable from any device
# on the same network — phones/iPads/another laptop — for cross-device QA while
# Claude iterates. Localhost still works exactly the same.
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
# Port 7100 — project-specific fixed port for pandatrack, baked into the `dev:lan` script itself
# (package.json). Keep aligned with .claude/launch.json.
# (Port 7000 is occupied on macOS by ControlCenter / AFS — using 7100 as the next stable free port.)
exec npm run dev:lan -- "$@"

#!/bin/bash
# Wrapper that forces the system Node (/usr/local/bin) ahead of Codex.app's
# bundled Node when this script is spawned by the Claude Code MCP preview
# tool. The preview tool spawns commands without sourcing ~/.zshrc, so PATH
# fixes there don't reach this process. We prepend explicitly here.
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
exec npm run dev "$@"

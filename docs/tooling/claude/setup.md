# Claude Code setup

This document explains how Claude Code is configured in this repository and how its components relate to the shared Cursor tooling.

## Entry point: CLAUDE.md

`CLAUDE.md` (project root) is the first file Claude Code reads on session start. In this repo it contains a single directive:

```
@AGENTS.md
```

This delegates to `AGENTS.md`, which is the canonical agent instruction file shared across all AI agents (Cursor, Codex, Claude Code). Any agent-wide rule, stack decision, or workflow constraint lives in `AGENTS.md` — not in `CLAUDE.md`. This avoids duplication and keeps one source of truth for agent behavior.

## Commands: `.claude/commands`

`.claude/commands` is a **symlink** to `.cursor/commands/`:

```
.claude/commands → ../.cursor/commands
```

Claude Code slash commands and Cursor command files are the same files. Adding or editing a command in `.cursor/commands/` automatically makes it available in Claude Code. Never create a separate file in `.claude/commands/` — edit the source in `.cursor/commands/`.

See `docs/tooling/cursor/commands.md` for the full command reference.

## Hooks: `.claude/settings.json`

`.claude/settings.json` registers hooks for the Claude Code agent loop. The hook **scripts** live in `.cursor/hooks/` (single source of truth shared with Cursor). `settings.json` only wires up which events call which scripts:

| Claude Code event             | Script                                   |
| ----------------------------- | ---------------------------------------- |
| `PostToolUse` → `Edit\|Write` | `.cursor/hooks/format-after-edit.mjs`    |
| `PreToolUse` → `Bash`         | `.cursor/hooks/allow-shell.mjs`          |
| `PreToolUse` → `Read`         | `.cursor/hooks/block-sensitive-read.mjs` |

Do not copy hook logic into `.claude/settings.json`. Only the wiring (event → script path) belongs there.

See `docs/tooling/cursor/hooks.md` for hook behavior details and how to add new hooks.

## Permissions: `.claude/settings.local.json`

`.claude/settings.local.json` is **gitignored** and accumulates tool-use permissions approved during sessions. It is machine-specific and should not be committed. When a permission entry references a path that no longer exists on the machine, it can be safely removed.

## MCP servers

Project-level MCP servers are configured in `.cursor/mcp.json` (also gitignored). Claude Code picks up user-level MCP servers from its own user config. See `docs/tooling/mcp.md` for the full list of available servers and their purposes.

## File map

```
.claude/
├── commands          → symlink to .cursor/commands/   # slash commands (shared)
├── settings.json                                       # hooks wiring (committed)
└── settings.local.json                                # permissions (gitignored)

.cursor/
├── commands/                                           # command files (source of truth)
├── hooks/                                             # hook scripts (source of truth)
│   ├── format-after-edit.mjs
│   ├── allow-shell.mjs
│   └── block-sensitive-read.mjs
├── hooks.json                                         # Cursor hook wiring
└── mcp.json                                           # MCP server config (gitignored)

CLAUDE.md                                              # stub → @AGENTS.md
AGENTS.md                                              # canonical agent instructions
```

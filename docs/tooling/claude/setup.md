# Claude Code setup

This document explains how Claude Code is configured in this repository and how rule
enforcement works across the two agents this project supports: **Claude Code** and **Codex**.
(The project previously also supported Cursor; that support has been removed.)

## Entry point: CLAUDE.md

`CLAUDE.md` (project root) is the first file Claude Code reads on session start. It uses
`@`-imports to auto-load context every session:

```
@AGENTS.md
@docs/tooling/agents/rules.md
@.agents/rules/<each alwaysApply rule>.mdc
```

- `AGENTS.md` is the canonical, agent-agnostic instruction file. Codex reads it natively;
  Claude Code reads it through this import. Any agent-wide rule, stack decision, or workflow
  constraint lives in `AGENTS.md` — not in `CLAUDE.md`.
- `docs/tooling/agents/rules.md` is the rules index (which rule applies to which task).
- The `.agents/rules/*.mdc` files marked `alwaysApply: true` are imported directly so they are
  always in context. This mirrors how Cursor used to inject `alwaysApply` rules. Codex gets the
  same baseline from `AGENTS.md`.

## Rule enforcement model

Rules live in `.agents/rules/*.mdc` (agent-neutral; the folder is not tool-specific). They are
enforced through two complementary mechanisms:

1. **Always-on baseline (session-wide).** Rules with `alwaysApply: true` are `@`-imported by
   `CLAUDE.md`, so they are in context for every change.
2. **Per-file scoped rules (edit-time).** Rules with a `globs:` frontmatter are injected only when
   the agent edits a matching file, by the `.claude/hooks/pre-code-edit.mjs` PreToolUse hook (it
   reads each rule's globs and emits matches via `hookSpecificOutput.additionalContext`). This
   reproduces Cursor's per-file rule auto-attach.

Codex does not run hooks, so for Codex the enforcement is `AGENTS.md` plus the rules index it
points to (`docs/tooling/agents/rules.md`).

## Commands: `.claude/commands/`

`.claude/commands/` holds the project's slash-command files. In Claude Code, type `/` to see them.
In Codex, reference the command file directly (see `AGENTS.md` §12). The same files serve both
agents; see `docs/tooling/agents/commands.md` for the full reference.

## Hooks: `.claude/settings.json`

`.claude/settings.json` registers hooks for the Claude Code agent loop. The hook **scripts** live
in `.claude/hooks/` (single source of truth). `settings.json` only wires up which events call which
scripts:

| Claude Code event             | Script                                   |
| ----------------------------- | ---------------------------------------- |
| `PreToolUse` → `Edit\|Write`  | `.claude/hooks/pre-code-edit.mjs`        |
| `PostToolUse` → `Edit\|Write` | `.claude/hooks/format-after-edit.mjs`    |
| `PreToolUse` → `Bash`         | `.claude/hooks/allow-shell.mjs`          |
| `PreToolUse` → `Read`         | `.claude/hooks/block-sensitive-read.mjs` |

Do not copy hook logic into `.claude/settings.json`. Only the wiring (event → script path) belongs
there. See `docs/tooling/agents/hooks.md` for hook behavior details and how to add new hooks.

## Permissions: `.claude/settings.local.json`

`.claude/settings.local.json` is **gitignored** and accumulates tool-use permissions approved
during sessions. It is machine-specific and should not be committed. Never store secrets here; when
a permission entry references a path that no longer exists on the machine, it can be safely removed.

## MCP servers

MCP servers are configured through Claude Code (`claude mcp add`, or a gitignored project-level
`.mcp.json`). See `docs/tooling/mcp.md` for the full list of available servers and their purposes.

## File map

```
.claude/
├── commands/                                          # slash-command files
├── hooks/                                             # hook scripts (single source of truth)
│   ├── pre-code-edit.mjs                              #   PreToolUse → per-file rule injection
│   ├── format-after-edit.mjs
│   ├── allow-shell.mjs
│   └── block-sensitive-read.mjs
├── settings.json                                      # hooks wiring (committed)
└── settings.local.json                               # permissions (gitignored)

.agents/
├── rules/                                            # repository rules (*.mdc)
└── skills/                                           # agent skills

CLAUDE.md                                             # imports AGENTS.md + rules index + alwaysApply rules
AGENTS.md                                             # canonical agent instructions
```

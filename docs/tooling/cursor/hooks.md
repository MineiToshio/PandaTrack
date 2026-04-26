# Agent hooks

Hooks run custom scripts at specific points in the agent loop. The scripts live under `.cursor/hooks/` and are the **single source of truth** for hook logic — both Cursor and Claude Code reference these same files so behavior stays consistent across agents.

## Configuration per agent

| Agent           | Config file             | Hook events used                                                                                |
| --------------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| **Cursor**      | `.cursor/hooks.json`    | `afterFileEdit`, `beforeShellExecution`, `beforeReadFile`                                       |
| **Claude Code** | `.claude/settings.json` | `PreToolUse` (Edit/Write), `PreToolUse` (Bash), `PreToolUse` (Read), `PostToolUse` (Edit/Write) |

Both configs call the same scripts in `.cursor/hooks/`. The scripts handle both payload shapes: Cursor passes fields at the top level (`payload.file_path`, `payload.command`); Claude Code nests them under `payload.tool_input` (`payload.tool_input.file_path`, `payload.tool_input.command`). Each script reads whichever is present.

## Configured hooks

| Script                     | Cursor event           | Claude Code event             | Purpose                                                                                                                                                                                                          |
| -------------------------- | ---------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-code-edit.mjs`        | —                      | `PreToolUse` → `Edit\|Write`  | **Claude Code only.** When the target file is a code file (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`), injects a rules reminder into the model context. Non-code files pass through silently. Does not block. |
| `format-after-edit.mjs`    | `afterFileEdit`        | `PostToolUse` → `Edit\|Write` | Runs Prettier on the file the agent just edited so formatting stays consistent. Fail-open: if Prettier fails (e.g. syntax error), the edit is not blocked.                                                       |
| `allow-shell.mjs`          | `beforeShellExecution` | `PreToolUse` → `Bash`         | Allows most commands; requires user approval for destructive ones (e.g. `prisma db push --force-reset`, `npm run db-reset`, `git push --force`, `git reset --hard`) before they run.                             |
| `block-sensitive-read.mjs` | `beforeReadFile`       | `PreToolUse` → `Read`         | Blocks the agent from reading sensitive files (`.env`, `.env.local`, `.env.*.local`, etc.) to avoid leaking secrets into the model context.                                                                      |

## What hooks do not do

- Hooks do **not** auto-run `npm run test`, `npm run type-check`, `npm run lint`, or `npm run validate-build` after every implementation.
- Validation scope is a **rule and workflow decision**, not a shell hook side effect.
- The repository standard is **risk-based validation**: trivial copy/presentational changes can use reduced validation, while behavioral or higher-risk changes still require the full validation pass.

## Implementation details

- Scripts are **ESM** (`.mjs`): they use `import` from `node:*` and run with Node's native ES modules.
- Hook input is JSON on stdin; output is JSON on stdout.
- Each script normalizes the payload with `payload.field ?? payload.tool_input?.field` to support both Cursor and Claude Code without duplication.
- For **block-sensitive-read**, any file whose basename is `.env` or starts with `.env.` is blocked. `.env.example` is **not** blocked so the agent can still read it for reference.

## Adding or changing hooks

1. Write the logic in a new `.mjs` script under `.cursor/hooks/`. Read the payload from stdin; write `{ permission: "allow" | "deny" | "ask", ... }` to stdout. Normalize field access with `payload.field ?? payload.tool_input?.field`.
2. Register the hook in the appropriate config files:
   - If it applies to **both agents**: add to `.cursor/hooks.json` (Cursor event) and `.claude/settings.json` (Claude Code event).
   - If it applies to **Claude Code only** (e.g. no matching Cursor event): add only to `.claude/settings.json`. Mark the Cursor event column as `—` in the table above.
   - `.cursor/hooks.json` events: `afterFileEdit`, `beforeShellExecution`, `beforeReadFile`.
   - `.claude/settings.json` events: `PreToolUse`, `PostToolUse` with a `matcher` pattern.
3. Restart Cursor and reload the Claude Code session so the hooks service picks up changes.
4. Use **Cursor Settings → Hooks** (and the Hooks output channel) or Claude Code's hook output to confirm the scripts run and to debug errors.

## References

- [Cursor Hooks documentation](https://cursor.com/docs/agent/hooks)
- [Claude Code hooks documentation](https://docs.anthropic.com/en/docs/claude-code/hooks)

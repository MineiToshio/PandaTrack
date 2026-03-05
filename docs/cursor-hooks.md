# Cursor hooks

Cursor hooks run custom scripts at specific points in the agent loop (Cmd+K / Agent Chat). They are configured in `.cursor/hooks.json` and run from the project root. Scripts live under `.cursor/hooks/` and are versioned with the repo so the whole team gets the same behavior.

## Configured hooks

| Hook                     | Script                     | Purpose                                                                                                                                                                                   |
| ------------------------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **afterFileEdit**        | `format-after-edit.mjs`    | Runs Prettier on the file the agent just edited so formatting stays consistent. Fail-open: if Prettier fails (e.g. syntax error), the edit is not blocked.                                |
| **beforeShellExecution** | `allow-shell.mjs`          | Allows most commands; requires user approval for destructive ones (e.g. `prisma db push --force-reset`, `npm run db-reset`, `git push --force`, `git reset --hard`) before they run.      |
| **beforeReadFile**       | `block-sensitive-read.mjs` | Blocks the agent from reading sensitive files (`.env`, `.env.local`, `.env.*.local`, etc.) to avoid leaking secrets into the model context. Returns `permission: "deny"` for those paths. |

## Implementation details

- Scripts are **ESM** (`.mjs`): they use `import` from `node:*` and run with Node’s native ES modules. This avoids `require()` and keeps the linter happy.
- Hook input is JSON on stdin; output is JSON on stdout. See [Cursor Hooks docs](https://cursor.com/docs/agent/hooks) for each event’s schema.
- For **beforeReadFile**, any file whose basename is `.env` or starts with `.env.` is blocked (plus an explicit list of common variants). `.env.example` is **not** blocked so the agent can still read it for reference.

## Adding or changing hooks

1. Edit `.cursor/hooks.json`: add or update an entry under `hooks` with the event name and a `command` (e.g. `node .cursor/hooks/your-script.mjs`). Optional: `timeout`, `matcher`.
2. Add the script under `.cursor/hooks/` (use `.mjs` and ESM `import` so the linter allows it). It must read JSON from stdin and write JSON to stdout (and use exit code `2` to block when the hook type supports it).
3. Restart Cursor so the hooks service picks up changes.
4. Use **Cursor Settings → Hooks** (and the Hooks output channel) to confirm hooks run and to debug errors.

## References

- [Cursor Hooks documentation](https://cursor.com/docs/agent/hooks) – events, schemas, and examples.
- Project-level hooks run from the workspace root; use paths like `.cursor/hooks/script.mjs` in `hooks.json`.

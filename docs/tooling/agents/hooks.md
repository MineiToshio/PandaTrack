# Agent hooks

Hooks run custom scripts at specific points in the Claude Code agent loop. The scripts live under
`.claude/hooks/` and are the **single source of truth** for hook logic. `.claude/settings.json`
only wires events to scripts.

> Hooks are a **Claude Code** mechanism. Codex does not run hooks — for Codex, the equivalent
> enforcement comes from `AGENTS.md` and the rules index it points to.

## Configured hooks

| Script                     | Claude Code event             | Purpose                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-code-edit.mjs`        | `PreToolUse` → `Edit\|Write`  | Per-file rule injection. Reads the `globs` frontmatter of every `.agents/rules/*.mdc`, finds the rules whose globs match the file being edited, and injects them into the model context via `hookSpecificOutput.additionalContext`. Never blocks the edit. Always-apply rules are loaded session-wide via `CLAUDE.md`, so this hook only surfaces glob-scoped rules. |
| `format-after-edit.mjs`    | `PostToolUse` → `Edit\|Write` | Runs Prettier on the file the agent just edited so formatting stays consistent. Fail-open: if Prettier fails (e.g. syntax error), the edit is not blocked.                                                                                                                                                                                                           |
| `allow-shell.mjs`          | `PreToolUse` → `Bash`         | Allows most commands; requires user approval for destructive ones (e.g. `prisma db push --force-reset`, `npm run db-reset`, `git push --force`, `git reset --hard`) before they run.                                                                                                                                                                                 |
| `block-sensitive-read.mjs` | `PreToolUse` → `Read`         | Blocks the agent from reading sensitive files (`.env`, `.env.local`, `.env.*.local`, etc.) to avoid leaking secrets into the model context.                                                                                                                                                                                                                          |

## What hooks do not do

- Hooks do **not** auto-run `npm run test`, `npm run type-check`, `npm run lint`, or
  `npm run validate-build` after every implementation.
- Validation scope is a **rule and workflow decision**, not a shell hook side effect.
- The repository standard is **risk-based validation**: trivial copy/presentational changes can use
  reduced validation, while behavioral or higher-risk changes still require the full validation pass.

## Implementation details

- Scripts are **ESM** (`.mjs`): they use `import` from `node:*` and run with Node's native ES modules.
- Hook input is JSON on stdin; output is JSON on stdout.
- `pre-code-edit.mjs` emits the Claude Code PreToolUse schema:
  `{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "allow", "additionalContext": "..." } }`.
  `additionalContext` is the only field that reliably reaches the model on an `allow` decision —
  `permissionDecisionReason` is shown to the model only on `deny`, and plain stdout is not added to
  context.
- Scripts read `payload.tool_input?.field ?? payload.field` so they tolerate either payload shape.
- For **block-sensitive-read**, any file whose basename is `.env` or starts with `.env.` is blocked.
  `.env.example` is **not** blocked so the agent can still read it for reference.

## Adding or changing hooks

1. Write the logic in a new `.mjs` script under `.claude/hooks/`. Read the payload from stdin; write
   the appropriate JSON to stdout. To add context for the model at edit time, use
   `hookSpecificOutput.additionalContext`; to gate an action, use `permissionDecision` (`allow` /
   `ask` / `deny`).
2. Register the hook in `.claude/settings.json` under the matching `PreToolUse` / `PostToolUse`
   event with a `matcher` pattern.
3. Reload the Claude Code session so the hooks service picks up changes.
4. Use Claude Code's hook output to confirm the scripts run and to debug errors. Guard against
   infinite loops and OOM: a script that hangs will abort the tool call.

## References

- [Claude Code hooks documentation](https://docs.anthropic.com/en/docs/claude-code/hooks)

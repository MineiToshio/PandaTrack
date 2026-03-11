# AI Workflow

This workflow is optimized for building features with Codex and Cursor using GitHub Project as source of truth.

## 1) Plan in GitHub

1. Create or update an Epic issue in GitHub Project.
2. Keep full feature context in the epic body (requirements, scope, acceptance criteria, test plan).
3. Create slice sub-issues under the epic.
4. Use `type:epic` and `type:slice` labels for issue type.
5. Use Project `Status` field (`Todo`, `In Progress`, `Done`) for progress tracking.

## 2) Prepare execution prompts

1. Call implementation commands with a GitHub issue number or full issue URL.
2. Resolve parent epic from the slice issue before coding.
3. Use epic + slice as implementation contract.

## 3) Implement with AI agents

1. Run implementation prompt (Codex or Cursor)
2. Keep changes minimal and scoped to the feature
3. Evaluate unit, integration, and E2E coverage needs based on feature risk
4. Re-run with focused prompts for missing pieces (tests, i18n, analytics, accessibility)

## 4) Review with a second pass

1. Run review prompt with strict bug/regression focus
2. Fix findings by severity order
3. Re-run review prompt until no high-severity issues remain

## 5) Validate and close

1. Run required checks:
   - `npm run type-check`
   - `npm run lint`
   - Build for affected scope (or full build when needed)
2. Run relevant automated tests for the affected scope when test infrastructure exists
3. Validate DoD in `docs/process/definition-of-done.md`
4. Update GitHub slice and epic statuses in Project

## Rules for consistency

- Use one Epic issue per feature and one or more Slice sub-issues.
- Keep user-facing copy in locale JSON files only.
- Keep Prisma access out of UI components.
- Keep analytics event names centralized.
- Apply risk-based test coverage instead of chasing blanket coverage.
- Prefer small, reviewable diffs over broad refactors.

# AI Workflow

This workflow is optimized for building features with Codex and Cursor using a hybrid model:

- `docs/product` is the source of truth for product definition
- GitHub Project is the source of truth for execution status

## 1) Define in docs, mirror in GitHub

1. Create or update the `PRD`, `FRD`, `Blueprint`, and `Work Orders` in `docs/product`.
2. Create or update one GitHub Epic from the `FRD`.
3. Create one GitHub ticket per `Work Order`.
4. Keep GitHub issue bodies lightweight and link back to the docs instead of duplicating them.
5. Use `type:epic` and `type:slice` labels for issue type.
6. Use Project `Status` field (`Todo`, `In Progress`, `Done`) for progress tracking.

## 2) Prepare execution prompts

1. Call implementation commands with a GitHub issue number or full issue URL.
2. Resolve parent Epic, linked `FRD`, and linked `Work Order` before coding.
3. Use the product docs as the implementation contract and GitHub as the execution tracker.

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
   - `npm run validate-build` for the affected scope (use `npm run build` only for deploy-style validation)
2. Run relevant automated tests for the affected scope when test infrastructure exists
3. Validate DoD in `docs/process/definition-of-done.md`
4. Update GitHub slice and epic statuses in Project

## Rules for consistency

- Use one Epic per `FRD` and one ticket per `Work Order`.
- Keep `Blueprints` in docs only unless there is a rare reason to track one separately.
- Keep user-facing copy in locale JSON files only.
- Keep Prisma access out of UI components.
- Keep analytics event names centralized.
- Apply risk-based test coverage instead of chasing blanket coverage.
- Prefer small, reviewable diffs over broad refactors.

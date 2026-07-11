# Implement GitHub Slice

Implement one GitHub slice ticket that mirrors a `Work Order`, using the hybrid product-doc workflow.

## Inputs

- `slice_issue_number`: GitHub issue number only (example: `45`)
- optional `extra_context`: short chat notes, constraints, or preferences

## Core behavior

- Conversation with the user must be in Spanish.
- All generated code, documentation, and GitHub issue content must be in English.
- Repository: `MineiToshio/PandaTrack`
- GitHub tooling: use the GitHub MCP server when available; otherwise fall back to the `gh` CLI or the GitHub REST/GraphQL API. Any external update that cannot be applied with available tools must be listed under `Blocked requirements` in the final response.
- Lifecycle position: this command owns the `IN_PROGRESS` / `In Progress` step of the chain `create-frd-package` (`DRAFT` / `Backlog`) -> `enrich-work-order-context` (`ACTIVE` / `Todo`) -> `implement-feature-slice` (`IN_PROGRESS` / `In Progress`) -> `mark-ticket-done` (`IMPLEMENTED` / `Done`).
- Idempotency: all doc and tracking writes must be state-convergent. Re-running the command against the same slice must converge to the same end state, never duplicate notes, code, or transitions.
- Produced code must not contain planning-artifact references in comments or JSDoc: no issue numbers, no `FEAT-*` codes, no epic/slice ids, no issue URLs. Tracking context belongs in GitHub and `docs/product`, never in source comments.

## Steps

1. Resolve the slice issue from GitHub
- Read the slice issue in `MineiToshio/PandaTrack` (GitHub MCP when available, otherwise `gh` / REST / GraphQL).
- Accept only the issue number as input.
- Validate the issue has `type:slice`. If it is not a slice, stop and report it clearly.

2. Resolve parent epic and linked product-doc context
- From the slice issue, resolve the parent epic issue.
- Read the slice body and current status in the Project board.
- Read the parent epic body and extract:
  - `PRD Path`
  - `FRD Path`
  - `Blueprint Path` or `Blueprint Paths`
- From the slice ticket body, extract:
  - `Blueprint Path`
  - `Work Order Path`
- Verify that every extracted doc path resolves to an existing file on disk before using it.
- If a referenced path is dangling (present in the body but missing on disk), do not guess a replacement by name similarity. Locate the `Work Order` by searching `docs/product/` for the `source_issue: <slice-issue-number>` frontmatter back-link, resolve its parent chain from the located file, and update the stale epic/ticket body with the corrected repository-relative path as part of the tracking sync in step 8.
- If a required doc path is missing from the Epic or ticket and the `source_issue` back-link cannot resolve it either, stop and report which reference is missing instead of guessing.
- Read the referenced `PRD`, `FRD`, `Blueprint`, and `Work Order` from `docs/product/`.
- Treat `docs/product` as the implementation contract and GitHub as the execution-tracking layer.
- If needed, read related linked issues/PRs for blocking context.

3. Check readiness and resume state
- Readiness precondition: if the `Work Order` doc has `status: DRAFT` or the slice's GitHub Project `4` `Status` is `Backlog`, the slice is not implementation-ready. Stop, report the state, and direct the user to run `enrich work order context` first. Proceed only if the user explicitly overrides.
- Never self-promote the lifecycle: this command must not flip `DRAFT` to `ACTIVE` or `Backlog` to `Todo` on its own. Confirming the `Work Order` is `status: ACTIVE` is a check, not a write.
- Resume check: before writing any code, read the slice issue's existing progress notes, the recent commits touching the affected area, and the `Work Order` `implementation_status`. If part of the slice is already implemented, implement only the remaining delta and say so in the final summary.
- If the `Work Order` is already `implementation_status: IMPLEMENTED`, refuse to implement and report the state. Proceed only if the user explicitly overrides, and state that follow-up work on an implemented slice may need its own tracking decision from the user.

4. Build implementation contract
- Treat as binding for this execution:
  - the linked `Work Order` is the **primary implementation scope**
  - `Work Order` scope and acceptance expectations
  - related `Blueprint` architecture and technical boundaries
  - parent `FRD` requirements and acceptance criteria
  - parent `PRD` product context and scope boundaries
  - slice ticket operational notes and blockers
- Do **not** treat the Epic or the ticket as permission to implement the whole `FRD` or all `Work Orders` under the same `Blueprint`.
- Implement only the single `Work Order` linked to the current ticket unless the user explicitly expands scope.
- Scope changes coming from `extra_context` or mid-run user remarks:
  - first check whether the requested change belongs to a sibling `Work Order`; if it does, say so and keep it out of this slice unless the user insists
  - restate the scope change in Spanish and get explicit user confirmation before editing `FRD`-level or `PRD`-level docs
  - after confirmation, update the appropriate source-of-truth doc first:
    - update the `Work Order` when execution scope or acceptance expectations changed
    - update the `Blueprint` when architecture, boundaries, or technical approach changed
    - update the `FRD` when requirements, business rules, or acceptance criteria changed
    - update the `PRD` only when release-level scope or product positioning changed
  - then update the GitHub Epic and ticket content to match the docs
- Apply the same rule to follow-up messages during the same conversation: if the user changes the work in a later message, confirm the scope change, update the correct docs first, then sync GitHub tracking.

5. Plan execution and delegation
- Before coding, identify the critical-path work the main agent keeps locally, plus any bounded research, disjoint implementation, or verification subtasks worth delegating.
- Delegate when it materially improves speed, reduces context load, or keeps the main agent focused on integration decisions. Good candidates: focused codebase exploration, locating relevant files or edge cases, implementing one isolated code path, writing one isolated test file, or digesting a large body of context into a filtered brief. Keep the work local when the task is tiny, highly coupled to the next edit, or when delegation would create merge risk or duplicate work.
- Never delegate the whole slice blindly. The main agent always retains ownership of scope control, architectural consistency, conflict resolution between delegated outputs, final doc/GitHub sync, final validation, and the user-facing summary.
- Disjoint write sets are **mandatory** for parallel delegated coding tasks. Two parallel tasks must never write the same file.
- Shared hotspot files are reserved for the main agent and must not be delegated for writing, in particular `src/i18n/locales/*` and `src/lib/constants.ts`. Delegated tasks report the translation keys or constants they need; the main agent applies them.
- Every delegated task gets a narrow goal, explicit file or responsibility ownership, and must return a concise summary plus a changed-file list or findings, not a raw context dump.
- After merging delegated output, the main agent must run a post-merge lint/test pass (at minimum `npm run lint` plus the tests covering the merged area) before any tracking update in step 8.
- If delegated outputs conflict with each other or with the main implementation, the main agent resolves the conflict explicitly and reconciles code, tests, docs, and behavior into one coherent slice.
- If the environment does not support sub-agents, follow the same decomposition mindset: split the work into smaller internal passes, keep research, implementation, and verification scoped and sequentially summarized, and avoid one monolithic reasoning pass absorbing the whole slice context.

6. Implement only this slice
- Keep changes minimal and scoped.
- Follow `AGENTS.md` and `.agents/rules/*.mdc`.
- Respect architecture and code organization conventions.
- Do not include unrelated refactors.
- If the slice introduces or wires an external service or third-party integration (for example S3-compatible storage, analytics, email, OAuth, or similar), also update the relevant docs and environment examples in the same change so the integration is actually operable by another developer.
- In those cases, include operator-facing setup guidance covering:
  - which environment variables are required
  - how to obtain each value from the external service
  - any required dashboard, bucket, credential, callback, or permission setup steps
  - any relevant public/base URL or secret-handling notes needed to run the feature correctly

7. Validate (before posting any implementation summary)
- Choose validation scope using `.agents/rules/validation-checklist.mdc`.
- For behavioral or higher-risk implementation changes, run:
  - `npm run test`
  - `npm run type-check`
  - `npm run lint`
  - `npm run validate-build`
- Run `npm run test:e2e` (or the matching spec, for example `e2e/auth.spec.ts`) when the affected workflow already has Playwright coverage, or when the slice touches a critical user flow whose real behavior depends on routing, browser state, redirects, form submission, or cross-page transitions.
- Never run `npm run build` locally; it belongs to the deploy pipeline and requires a database that accepts migrations.
- For trivial low-risk edits inside the slice, run the narrowest relevant automated check instead, usually `npm run lint`.
- On validation failure that cannot be fixed within the run:
  - report the failing commands and their errors
  - mark the affected exit criteria as `not met`
  - leave a blocker note on the slice issue describing the failure
  - never claim the slice is implemented; the final summary must state that validation failed

8. Update GitHub tracking (only after validation)
- Keep execution tracking in GitHub:
  - Update slice issue progress notes.
  - Add the implementation summary and validation results to the slice issue.
- Keep product-definition updates in docs whenever implementation or confirmed follow-up user instructions materially change requirements, architecture, or execution definition.
- `docs/product` remains the source of truth for definition; GitHub remains the source of truth for execution status.
- Required transitions (all skip-if-already-set):
  - Slice: set GitHub Project `4` `Status` to `In Progress` if not already there. Do **not** move it to `Done`.
  - Epic: when this is the first slice of the epic to enter `In Progress`, move the epic's Project `Status` from `Todo` to `In Progress`. Otherwise leave the epic status unchanged. Do not move the epic to `Done` from this command unless the user explicitly asked for that workflow.
  - `Work Order` doc: set `implementation_status: IN_PROGRESS` unless it is already `IN_PROGRESS` or `IMPLEMENTED`.
- If a dangling doc path was repaired in step 2, update the stale epic/ticket body with the corrected repository-relative path in this same pass.
- For token retrieval, stable IDs, and `curl` patterns to update the Project `4` `Status` field, see `docs/process/github-project-tracking.md` (GitHub GraphQL API section). If a Project mutation or issue update fails, list it under `Blocked requirements`; the remaining independent updates may still proceed.

9. Verify tracking updates
- Re-read the slice's Project `4` `Status`, the epic's Project `Status` when it was changed, and the `Work Order` `implementation_status` to confirm the transitions were actually applied.
- Any transition that did not stick, or could not be verified with available tools, must be listed under `Blocked requirements` in the final response.

## Output format

Return in Spanish:

1. `Implemented`: what was completed for this slice (or the delta, when resuming)
2. `Exit criteria`: each criterion as `met` / `not met`
3. `Validation results`: each validation command run and its outcome (pass/fail), including e2e when applicable
4. `Functional test steps`: manual step-by-step checks
5. `Test cases`: concise `Given / When / Then` cases
6. `Delegation used`: what was delegated, what stayed local, and why
7. `Tracking updated`: GitHub status and Work Order lifecycle / implementation-status changes applied and verified
8. `Docs updated`: every product doc touched (`Work Order`, `Blueprint`, `FRD`, `PRD`) with a one-line reason, or `none`
9. `Blocked requirements`: any external update (Project status, issue state or body, epic sync) that could not be applied or verified with available tools; state `ninguno` when there are none
10. `External service setup`: only when applicable; required env vars plus concise steps to obtain/configure them

If the command stops early (non-slice issue, unresolvable doc reference, readiness precondition, or already-implemented Work Order without override), return only what reference or precondition blocked it and what the user should do next.

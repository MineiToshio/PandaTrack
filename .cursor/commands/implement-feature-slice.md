# Implement GitHub Slice

Implement one GitHub slice ticket that mirrors a `Work Order`, using the hybrid product-doc workflow.

## Inputs

- `slice_issue_number`: GitHub issue number only (example: `45`)
- optional `extra_context`: short chat notes, constraints, or preferences

## Steps

1. Resolve the slice issue from GitHub
- Use GitHub MCP to read the slice issue in `MineiToshio/PandaTrack`.
- Accept only the issue number as input.
- Validate the issue has `type:slice`.

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
- Read the referenced `PRD`, `FRD`, `Blueprint`, and `Work Order` from `docs/product/`.
- Treat `docs/product` as the implementation contract and GitHub as the execution-tracking layer.
- If any required doc path is missing from the Epic or ticket, stop and report which reference is missing instead of guessing.
- If needed, read related linked issues/PRs for blocking context.

3. Build implementation contract
- Treat as binding for this execution:
  - the linked `Work Order` is the **primary implementation scope**
  - `Work Order` scope and acceptance expectations
  - related `Blueprint` architecture and technical boundaries
  - parent `FRD` requirements and acceptance criteria
  - parent `PRD` product context and scope boundaries
  - slice ticket operational notes and blockers
- Do **not** treat the Epic or the ticket as permission to implement the whole `FRD` or all `Work Orders` under the same `Blueprint`.
- Implement only the single `Work Order` linked to the current ticket unless the user explicitly expands scope.
- If current user instructions conflict with the linked docs or GitHub tracking:
  - follow the user
  - update the appropriate source-of-truth doc first:
    - update the `Work Order` when execution scope or acceptance expectations changed
    - update the `Blueprint` when architecture, boundaries, or technical approach changed
    - update the `FRD` when requirements, business rules, or acceptance criteria changed
    - update the `PRD` only when release-level scope or product positioning changed
  - then update the GitHub Epic and ticket content to match the docs
- Apply the same rule to follow-up messages during the same conversation: if the user changes the work in a later message, update the correct docs first, then sync GitHub tracking.

4. Plan execution and delegate when useful
- Before coding, identify:
  - the critical-path task the main agent should keep locally
  - any bounded research or code-reading subtasks that can run in parallel
  - any disjoint implementation subtasks that can be delegated safely without overlapping write ownership
  - any verification or test-prep subtasks that can run in parallel with implementation
- Prefer delegation when it materially improves speed, reduces context load, or keeps the main agent focused on integration decisions.
- Good delegation candidates include:
  - focused codebase exploration or reverse engineering
  - locating relevant files, contracts, or edge cases
  - drafting or implementing one isolated code path with a disjoint write set
  - writing or extending one isolated test file while the main agent implements the feature
  - summarizing a large body of context into a filtered implementation brief
- Avoid delegation when the task is tiny, highly coupled to the immediate next edit, or likely to block the main agent's very next step.
- If the environment supports sub-agents or background agents (for example Codex sub-agents), use them deliberately:
  - give each delegated task a narrow goal
  - define file or responsibility ownership clearly
  - require the delegated result to return a concise summary plus any changed-file list or findings
  - keep the main agent responsible for final integration, conflict resolution, contradiction cleanup, and user-facing status
- If the environment does not support true sub-agents (or the current tool cannot invoke them), still follow the same decomposition mindset:
  - split the work into smaller internal passes
  - keep research, implementation, and verification scoped and sequentially summarized
  - avoid letting one monolithic reasoning pass absorb the whole slice context

5. Implement only this slice
- Keep changes minimal and scoped.
- Follow `AGENTS.md` and `.cursor/rules/*.mdc`.
- Respect architecture and code organization conventions.
- Do not include unrelated refactors.
- If the slice introduces or wires an external service or third-party integration (for example S3-compatible storage, analytics, email, OAuth, or similar), also update the relevant docs and environment examples in the same change so the integration is actually operable by another developer.
- In those cases, include operator-facing setup guidance covering:
  - which environment variables are required
  - how to obtain each value from the external service
  - any required dashboard, bucket, credential, callback, or permission setup steps
  - any relevant public/base URL or secret-handling notes needed to run the feature correctly

6. Update GitHub tracking
- Keep execution tracking in GitHub:
  - Update slice issue progress notes.
  - Update parent epic status if needed.
  - Add implementation summary and validation notes to the slice issue.
- Keep product-definition updates in docs whenever implementation or follow-up user instructions materially change requirements, architecture, or execution definition.
- `docs/product` remains the source of truth for definition; GitHub remains the source of truth for execution status.
- Required transitions:
  - Slice: move to `In Progress` during or after implementation handoff, but do **not** move it to `Done`
  - Epic: keep `In Progress` while any non-done slices remain; do not move the epic to `Done` from this command unless the user explicitly asked for that workflow
- Ensure the matching `Work Order` doc remains lifecycle-valid with `status: ACTIVE` when it is the current approved slice definition.
- Update the matching `Work Order` `implementation_status` to `IN_PROGRESS` when implementation starts, unless it is already `IMPLEMENTED`.

For token retrieval, stable IDs, and `curl` patterns to update the Project `4` `Status` field, see `docs/process/github-project-tracking.md` → **GitHub GraphQL API**.

7. Validate
- Choose validation scope using `.cursor/rules/validation-checklist.mdc`.
- For behavioral or higher-risk implementation changes, run:
  - `npm run test`
  - `npm run type-check`
  - `npm run lint`
  - `npm run validate-build`
- For trivial low-risk edits inside the slice, run the narrowest relevant automated check instead, usually `npm run lint`.

## Delegation guardrails

- Never delegate the whole slice blindly.
- The main agent must always retain ownership of:
  - scope control
  - architectural consistency
  - resolving conflicts, overlaps, or contradictory outputs produced by delegated tasks
  - final doc/GitHub sync
  - final validation and user summary
- Delegated coding tasks should have disjoint write scopes whenever possible.
- Delegated research tasks should return filtered findings, not raw context dumps.
- If delegated outputs conflict with each other or with the main implementation, the main agent must resolve the conflict explicitly instead of passing the inconsistency through to the final result.
- The main agent must choose the best final implementation when delegated outputs disagree, and should reconcile code, tests, docs, and user-facing behavior into one coherent slice.
- If multiple delegated tasks run in parallel, the command should explicitly note:
  - what each task owns
  - what result the main agent is waiting for
  - what work can continue without waiting
- Prefer parallel delegation for:
  - independent read-only exploration questions
  - isolated tests vs implementation
  - separate modules that do not share the same file set
- Prefer single-task delegation for:
  - large context digestion
  - focused codebase audits
  - narrow, self-contained patches
- If delegation would create merge risk or duplicate work, keep it local instead.

## Output format

Return:

1. `Implemented`: what was completed for this slice
2. `Exit criteria`: each criterion as `met` / `not met`
3. `Functional test steps`: manual step-by-step checks
4. `Test cases`: concise `Given / When / Then` cases
5. `Delegation used`: what was delegated, what stayed local, and why
6. `Tracking updated`: GitHub status and Work Order lifecycle / implementation-status changes applied
7. `External service setup`: only when applicable; required env vars plus concise steps to obtain/configure them

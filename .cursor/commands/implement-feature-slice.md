# Implement GitHub Slice

Implement one Work Order ticket from GitHub with minimal, reviewable changes using the hybrid product-doc workflow.

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
  - linked `PRD`
  - linked `FRD`
  - linked `Blueprints`
- From the slice ticket body, extract:
  - linked `Blueprint`
  - linked `Work Order`
- Read the referenced `PRD`, `FRD`, `Blueprint`, and `Work Order` from `docs/product/`.
- Treat the product docs as the implementation contract and GitHub as the execution-tracking layer.
- If any required document link is missing from the Epic or ticket, stop and report which reference is missing instead of guessing.
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

4. Implement only this slice
- Keep changes minimal and scoped.
- Follow `AGENTS.md` and `.cursor/rules/*.mdc`.
- Respect architecture and code organization conventions.
- Do not include unrelated refactors.

5. Update GitHub tracking
- Keep execution tracking in GitHub:
  - Update slice issue progress notes.
  - Update parent epic status if needed.
  - Add implementation summary and validation notes to the slice issue.
- Keep product-definition updates in docs whenever implementation or follow-up user instructions materially change requirements, architecture, or execution definition.
- Docs remain the source of truth for definition; GitHub remains the source of truth for execution status.
- Required transitions:
  - Slice: move to `In Progress` during or after implementation handoff, but do **not** move it to `Done`
  - Epic: keep `In Progress` while any non-done slices remain; do not move the epic to `Done` from this command unless the user explicitly asked for that workflow
- Update the matching `Work Order` document status from its initial planning state to `ACTIVE` when implementation starts.

6. Validate
- Run:
  - `npm run type-check`
  - `npm run lint`
  - `npm run validate-build` (or minimal affected build check if preferred)

## Output format

Return:

1. `Implemented`: what was completed for this slice
2. `Exit criteria`: each criterion as `met` / `not met`
3. `Functional test steps`: manual step-by-step checks
4. `Test cases`: concise `Given / When / Then` cases
5. `Tracking updated`: GitHub status and Work Order status changes applied

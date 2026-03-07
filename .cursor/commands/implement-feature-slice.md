# Implement GitHub Slice

Implement one slice issue from GitHub with minimal, reviewable changes.

## Inputs

- `slice_issue`: GitHub issue number or full URL (examples: `45`, `https://github.com/MineiToshio/PandaTrack/issues/45`)
- optional `extra_context`: short chat notes, constraints, or preferences

## Steps

1. Resolve the slice issue from GitHub
- Use GitHub MCP to read the slice issue in `MineiToshio/PandaTrack`.
- Accept either number or URL input.
- Validate the issue has `type:slice`.

2. Resolve parent epic and planning context
- From the slice issue, resolve the parent epic issue.
- Read the parent epic body completely (it contains full feature context).
- Read the slice body, acceptance criteria, and status in the Project board.
- If needed, read related linked issues/PRs for blocking context.

3. Build implementation contract
- Treat as binding for this execution:
  - Slice objective/scope from the slice issue
  - Epic requirements, constraints, acceptance criteria, and test plan from the parent epic
- If GitHub issue content conflicts with the current user instruction, follow the user and then update GitHub issue content to match.

4. Implement only this slice
- Keep changes minimal and scoped.
- Follow `AGENTS.md` and `.cursor/rules/*.mdc`.
- Respect architecture and code organization conventions.
- Do not include unrelated refactors.

5. Update GitHub tracking
- Keep source of truth in GitHub:
  - Update slice issue status/progress notes.
  - Update parent epic status if needed.
  - Add implementation summary and validation notes to the slice issue.
- Required transitions:
  - Slice: `Todo` -> `In Progress` -> `Done` (or `Blocked` via comment + `In Progress`/`Todo` as appropriate)
  - Epic: `In Progress` while any non-done slices remain; `Done` only when all slices are done.

6. Validate
- Run:
  - `npm run type-check`
  - `npm run lint`
  - minimal affected build check (or `npm run build` if needed)

## Output format

Return:

1. `Implemented`: what was completed for this slice
2. `Files changed`: path + short reason
3. `Validation`: command results and failures if any
4. `Exit criteria`: each criterion as `met` / `not met`
5. `GitHub sync`: what was updated in slice/epic issues and project status
6. `Functional test steps`: manual step-by-step checks
7. `Test cases`: concise `Given / When / Then` cases

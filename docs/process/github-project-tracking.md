# GitHub Project Tracking Runbook

## Purpose

Centralize the minimum information needed to access and operate PandaTrack planning in GitHub.

GitHub Project and its issues are the source of truth for feature scope and execution status.

## Quick Links

- Repository: https://github.com/MineiToshio/PandaTrack
- Issues: https://github.com/MineiToshio/PandaTrack/issues
- Active Project (feature delivery): https://github.com/users/MineiToshio/projects/4
- Projects (user): https://github.com/users/MineiToshio/projects

## Canonical Mapping

- One feature (`FEAT-XXXX`) -> one Epic issue
- One Epic issue -> multiple Slice sub-issues
- Every Epic/Slice should be added to the GitHub Project board
- Keep issue titles concise and readable.
- Distinguish epic vs slice using `type:*` labels, not title prefixes.
- Automation inputs should use GitHub issue number or full GitHub issue URL.

## Labels

- `type:epic`
- `type:slice`
- `area:store`
- `area:purchase`
- `area:payments`
- `area:shipments`
- `area:dashboard`

Do not use `status:*` labels. Status is tracked only through the GitHub Project `Status` field.

## Board Statuses

- `Todo`
- `In Progress`
- `Done`

Current project status source of truth is the GitHub Project `Status` field (`Todo`, `In Progress`, `Done`).

## Epic Template (Issue)

- Title: `FEAT-XXXX: <feature name>`
- Must include:
  - Goal
  - Scope
  - Acceptance criteria
  - Test plan with explicit unit, integration, and E2E expectations

## Slice Template (Sub-issue)

- Title: `<small deliverable>`
- Must include:
  - Parent Epic reference
  - Clear scope boundary
  - `Testing` section that marks unit, integration, and E2E as required or not required with a short reason
  - `Validation notes` section (`npm run type-check`, `npm run lint`, `npm run validate-build`, or equivalent scoped checks)

## Security Rules

- Never commit PATs, OAuth tokens, or auth headers to the repository.
- Keep credentials in local environment variables or system keychain only.

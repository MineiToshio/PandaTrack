# GitHub Project Tracking Runbook

## Purpose

Centralize the minimum information needed to access and operate PandaTrack planning in GitHub.

## Quick Links

- Repository: https://github.com/MineiToshio/PandaTrack
- Issues: https://github.com/MineiToshio/PandaTrack/issues
- Active Project (feature packets): https://github.com/users/MineiToshio/projects/4
- Projects (user): https://github.com/users/MineiToshio/projects
- Feature packets: `docs/product/feature-packets/`

## Canonical Mapping

- One feature packet file -> one Epic issue
- One Epic issue -> multiple Slice sub-issues
- Every Epic/Slice should be added to the GitHub Project board
- Keep issue titles concise and readable.
- Distinguish epic vs slice using `type:*` labels, not title prefixes.

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

- `Backlog`
- `Ready`
- `In Progress`
- `Review`
- `Done`

Current project status source of truth is the GitHub Project `Status` field (`Todo`, `In Progress`, `Done`).

## Epic Template (Issue)

- Title: `FEAT-XXXX: <feature name>`
- Must include:
  - Packet link (`docs/product/feature-packets/<file>.md`)
  - Goal
  - Scope
  - Acceptance criteria

## Slice Template (Sub-issue)

- Title: `[FEAT-XXXX] Slice: <small deliverable>`
- Must include:
  - Parent Epic reference
  - Clear scope boundary
  - Validation notes (type-check/lint/build or equivalent)

## Security Rules

- Never commit PATs, OAuth tokens, or auth headers to the repository.
- Keep credentials in local environment variables or system keychain only.

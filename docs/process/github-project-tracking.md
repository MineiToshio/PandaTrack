# GitHub Project Tracking Runbook

## Purpose

Centralize the minimum information needed to access and operate PandaTrack execution tracking in GitHub.

GitHub Project and its issues are the source of truth for execution status.
`docs/product` is the source of truth for product definition.

## Quick Links

- Repository: https://github.com/MineiToshio/PandaTrack
- Issues: https://github.com/MineiToshio/PandaTrack/issues
- Active Project (feature delivery): https://github.com/users/MineiToshio/projects/4
- Projects (user): https://github.com/users/MineiToshio/projects

## Canonical Mapping

- One `FRD` -> one Epic issue
- One Epic issue -> multiple `Work Order` tickets
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

- Title: same as the `FRD` title whenever practical
- Must include:
  - link to parent `PRD`
  - link to matching `FRD`
  - links to related `Blueprints`
  - checklist of linked `Work Orders`
  - short status/blocker notes when needed
- Must not include:
  - full duplicated FRD content

## Ticket Template (Work Order Issue)

- Title: same as the `Work Order` title whenever practical
- Must include:
  - Parent Epic reference
  - link to parent `PRD`
  - link to parent `FRD`
  - link to parent `Blueprint`
  - link to matching `Work Order`
  - brief execution notes and blockers if needed
- Must not include:
  - full duplicated Work Order content

## Security Rules

- Never commit PATs, OAuth tokens, or auth headers to the repository.
- Keep credentials in local environment variables or system keychain only.

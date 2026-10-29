# Note on format

ADRs in this repository live in `docs/design/decisions/` and use a four-digit number prefix without the `ADR-` prefix (e.g. `0034-store-account-reconciliation-adjustment.md`). ADRs also carry YAML frontmatter with: `title`, `date`, `status`, `session`, `owner`, `trigger`, `updates`, and `extends`.

Copy the block below and replace the placeholders. Use lowercase `accepted`, `proposed`, or `superseded` for `status`. Keep `extends` only when the decision extends an existing ADR; add `supersedes` when it replaces one. Save as `docs/design/decisions/NNNN-short-kebab-title.md` using the next free number after the highest existing ADR number, and add a row to `docs/design/decisions/README.md` in the same change.

```markdown
---
title: "ADR NNNN - [Decision Title]"
date: YYYY-MM-DD
status: proposed
session: "[Work context that produced the decision]"
owner: "[Decision owner]"
trigger: "[Finding or change that required the decision]"
updates: "[Comma-separated repository-relative paths changed to carry the decision]"
extends: "[Related ADR numbers and the decisions being extended, if applicable]"
---

# NNNN: [Decision Title]

- Status: Proposed
- Date: `YYYY-MM-DD`
- Owner:
- Related feature:

## Context

Describe the technical/product context and constraints.

## Decision

State the decision clearly and specifically.

## Alternatives considered

1. Option A

- Pros:
- Cons:
- Why not chosen:

2. Option B

- Pros:
- Cons:
- Why not chosen:

## Consequences

### Positive

-

### Negative / tradeoffs

-

## Rollout notes

- Migration or implementation notes:
- Monitoring considerations:

## References

-
```

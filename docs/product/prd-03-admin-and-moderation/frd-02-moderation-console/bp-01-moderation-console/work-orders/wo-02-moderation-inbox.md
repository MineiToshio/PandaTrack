---
id: WO-02
type: WORK_ORDER
slug: moderation-inbox
title: Moderation Inbox
status: DRAFT
parent: BP-01
source_issue: 129
implementation_status: PLANNED
last_updated: 2026-07-22
---

# WO-02 Moderation Inbox

## Summary

Vertical slice that builds the moderation inbox: a server-only aggregate read model that gathers the four pending categories, and a prioritized list UI with category counts, an empty state, and links that route the administrator to the inline controls owned by PRD-02 (FRD-04). This is the core value of the first release.

## In Scope

- Server-only aggregate read model `src/lib/data/admin/moderationQueueQueries.ts` composing pending stores, open reports, pending change requests, and pending product-type requests.
- Impact ordering (reported and removable stores first, product-type suggestions last).
- Inbox UI: prioritized list, per-category counts, empty state, and per-item links to the action surface.
- Sensitive fields read through the admin-only path, never through the public governance read model.
- Analytics for opening an inbox item.
- Unit tests for the aggregate and its ordering; E2E for the inbox and its routing.

## Out of Scope

- The moderation mutations themselves (approve, remove, resolve, apply, approve product type); owned by PRD-02 (FRD-04).
- Segmented queues, filters, and bulk actions (later release).
- The audit viewer (`WO-03`).

## Requirements

- `FR-02-05`: Aggregate the four pending categories into one list.
- `FR-02-06`: Order items by impact.
- `FR-02-07`: Each item links to where the administrator acts.
- `FR-02-08`: Show a count per category.
- `FR-02-09`: Read on a server-only path; sensitive fields through a secure admin data layer.
- `FR-02-10`: Present a clear empty state.
- `FR-02-13`: Emit analytics for opening an inbox item.

Relevant business rules:

- `BR-02-02`: The inbox routes to the inline controls; it does not define parallel actions.
- `BR-02-03`: Sensitive moderation data is read through a server-only path, not the public model.

Relevant acceptance criteria:

- `AC-02-02` Administrator sees the prioritized inbox.
- `AC-02-03` Empty inbox.
- `AC-02-04` Item routes to the inline controls.

## Blueprints

- `BP-01` runtime component coverage: aggregate read layer, console UI layer, verification layer. Depends on `WO-01` (shell and gating) and PRD-03 (FRD-01) · `WO-01` (secure reads).

## E2E Acceptance Tests

- An administrator with pending items sees them aggregated and ordered by impact, with per-category counts (`AC-02-02`).
- With nothing pending, the inbox shows its empty state (`AC-02-03`).
- Opening a store item routes to the store detail with its inline controls (`AC-02-04`).
- The public governance read model is not used to fetch reporter identity or raw report text for the inbox (`BR-02-03`).

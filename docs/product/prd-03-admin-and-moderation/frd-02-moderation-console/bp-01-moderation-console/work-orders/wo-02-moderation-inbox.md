---
id: WO-02
type: WORK_ORDER
slug: moderation-inbox
title: Moderation Inbox
status: DRAFT
parent: BP-01
source_issue: 129
implementation_status: PLANNED
last_updated: 2026-07-23
---

# WO-02 Moderation Inbox

## Summary

Vertical slice that builds the moderation inbox: a server-only aggregate read model that gathers the four persisted pending categories and derives a fifth row type (flag candidate / suggested removal) per the `FR-02-05` rule when a store accumulates 2 or more open reports, shaping each item's per-type review payload, a master-detail presentation (queue plus review pane on desktop, stacked queue plus full-width detail on mobile), the five per-type review panels (pending store, report, flag candidate / suggested removal, change request including its drift variant, product-type suggestion), and the invocation of the server actions owned by PRD-02, [FRD-04](../../../../prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md) from each review. This is the core value of the first release: the administrator reviews and acts without leaving the console.

## In Scope

- Server-only aggregate read model `src/lib/data/admin/moderationQueueQueries.ts` composing pending stores, open reports, pending change requests, and pending product-type requests, and shaping the per-type review payload for each item.
- Deriving the flag-candidate (suggested-removal) row when a store accumulates 2 or more open reports, collapsing that store's individual report rows into the single derived row.
- Impact ordering (reported and removable stores first, product-type suggestions last).
- Master-detail inbox UI: prioritized queue, per-category counts, empty state; desktop queue plus review pane with the top item auto-previewed; mobile stacked queue routing to a full-width review with a back link.
- The five per-type review panels and their action sets: pending store (approve, remove), report (resolve, dismiss, plus a secondary remove path), flag candidate / suggested removal (flag, unflag, remove), change request (apply, reject, including itemized add/remove/keep deltas for list fields and, on drift, a three-value per-field view tagged "Ya aplicado" or "En conflicto"), product-type suggestion (approve, reject).
- Invoking the corresponding FRD-04 server actions from each review action (the console is the caller; it does not implement the mutations).
- Invoking the shared removal-reason modal owned by FRD-04 from the pending-store, report, and suggested-removal reviews.
- Sensitive fields read through the admin-only path, never through the public governance read model.
- Analytics for opening an inbox item.
- Unit tests for the aggregate, its ordering, and the per-type payload shaping; E2E for the inbox, the master-detail selection, each review, and the mobile stacked navigation, matching the acceptance criteria below.

## Out of Scope

- The moderation server actions themselves (approve, remove, flag, unflag, resolve, dismiss, apply, reject for both change requests and product types) and the removal-reason modal's definition; owned by PRD-02, [FRD-04](../../../../prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md). WO-02 invokes these; it does not build them.
- Segmented queues, filters, bulk actions, moderator assignment, SLA timers, and content-language queue routing (later release).
- The audit viewer (`WO-03`).

## Requirements

- `FR-02-05`: Aggregate the four pending categories into one list.
- `FR-02-06`: Order items by impact.
- `FR-02-07`: Each item opens a per-type review from which the administrator invokes the owning action.
- `FR-02-08`: Show a count per category.
- `FR-02-09`: Read on a server-only path; sensitive fields through a secure admin data layer.
- `FR-02-10`: Present a clear empty state.
- `FR-02-13`: Emit analytics for opening an inbox item.
- `FR-02-14`: Pending-store review with approve and remove actions.
- `FR-02-15`: Report review with resolve, dismiss, and a secondary remove path.
- `FR-02-16`: Flag-candidate (suggested-removal) review with flag, unflag, and remove actions.
- `FR-02-17`: Change-request review with apply and reject actions, including the drift notice and per-field tags.
- `FR-02-18`: Product-type-suggestion review with approve and reject actions.
- `FR-02-19`: Desktop master-detail presentation with impact-ordered queue and auto-preview of the top item.
- `FR-02-20`: Mobile stacked queue routing to a full-width detail with a back link.
- `FR-02-21`: Removal from any review uses the FRD-04 reason-selection modal.

Relevant business rules:

- `BR-02-02`: The console invokes the FRD-04 server actions in place; it does not fork the store lifecycle or re-implement them.
- `BR-02-03`: Sensitive moderation data is read through a server-only path, not the public model.

Relevant acceptance criteria:

- `AC-02-02` Administrator sees the prioritized inbox.
- `AC-02-03` Empty inbox.
- `AC-02-04` Item opens its per-type review.
- `AC-02-07` Open review: pending store.
- `AC-02-08` Open review: report.
- `AC-02-09` Open review: flag candidate / suggested removal.
- `AC-02-10` Open review: change request.
- `AC-02-11` Open review: product-type suggestion.
- `AC-02-12` Change request with drift.
- `AC-02-13` Desktop master-detail selection.
- `AC-02-14` Mobile stacked queue.

## Blueprints

- `BP-01` runtime component coverage: aggregate read layer, console UI layer, verification layer. Depends on `WO-01` (shell and gating), PRD-03 (FRD-01) · `WO-01` (secure reads), and PRD-02, FRD-04 · [WO-09](../../../../prd-02-collector-app/frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md) (store approval and removal), [WO-10](../../../../prd-02-collector-app/frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-10-report-resolution.md) (report resolution), [WO-11](../../../../prd-02-collector-app/frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-11-change-request-review.md) (change-request review), and [WO-12](../../../../prd-02-collector-app/frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-12-product-type-request-approval.md) (product-type approval) for the server actions each review invokes. Those work orders own and deliver the actions and mutations; `WO-02` only consumes them.

## E2E Acceptance Tests

- An administrator with pending items sees them aggregated and ordered by impact, with per-category counts (`AC-02-02`).
- A store with 2 or more open reports appears once in the queue as a single suggested-removal row, and not as its individual report rows (`AC-02-02`, `FR-02-05`).
- With nothing pending, the inbox shows its empty state (`AC-02-03`).
- Opening a pending-store item renders its review with approve and remove actions, invoking the FRD-04 store actions (`AC-02-04`, `AC-02-07`).
- Opening a report item renders its review with resolve, dismiss, and the admin-only reporter identity and raw text markers (`AC-02-08`).
- Opening a flag-candidate item renders its review with flag/unflag and remove actions (`AC-02-09`).
- Opening a change-request item renders its diff and requester comment, with apply and reject actions (`AC-02-10`).
- Opening a product-type-suggestion item renders its catalog preview, with approve and reject actions (`AC-02-11`).
- A change request whose store changed since submission shows the drift notice with a three-value per-field view tagged "Ya aplicado" or "En conflicto", and list fields show their add/remove/keep deltas (`AC-02-12`).
- On a desktop viewport, selecting a queue row renders that item's review in the pane, and the top item is auto-previewed on load (`AC-02-13`).
- On a mobile viewport, opening a queue row routes to a full-width review with a back link to the queue (`AC-02-14`).
- The public governance read model is not used to fetch reporter identity or raw report text for the inbox or any review (`BR-02-03`).

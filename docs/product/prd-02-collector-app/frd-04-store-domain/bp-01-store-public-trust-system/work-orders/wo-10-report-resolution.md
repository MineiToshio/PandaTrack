---
id: WO-10
type: WORK_ORDER
slug: report-resolution
title: Report Resolution
status: DRAFT
parent: BP-01
source_features: []
source_issue: 132
implementation_status: PLANNED
last_updated: 2026-07-22
---

# WO-10 Report Resolution

## Summary

Add the admin inline resolution of store reports from the governance panel: move an open `StoreReport` from `OPEN` to `REVIEWED` or `DISMISSED`, and give administrators a secure, admin-only view of the raw report details and reporter identity through a new server-only admin data-access layer. These actions are gated by the durable administrator role and audit trail from [PRD-03 (FRD-01)](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md), and the moderation console defined by [PRD-03 (FRD-02)](../../../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md) routes administrators to them.

## In Scope

- Admin inline **resolve / dismiss** control on the governance panel: `StoreReport` `OPEN` to `REVIEWED` or `DISMISSED`.
- Resolution frees the reporter to file a new report for that store, exactly as `AC-04-12` already specifies (the re-report path after resolution already exists; this work order is what causes a report to reach a resolved state).
- A **new server-only admin data-access layer** that exposes raw report free-text and reporter identity to administrators only. This is additive and must never widen the public governance read model (`getStoreGovernanceSummary`); the existing non-admin guarantee (`BR-04-13`) stays honored unchanged.
- `requireAdmin()` gating on the resolve / dismiss mutations and on the admin report read, with an `AdminAuditLog` entry via `writeAuditEntry()` for `report.resolve` and `report.dismiss`.
- PostHog analytics for the user-visible actions: `store_report_resolved`, `store_report_dismissed`, namespaced under `POSTHOG_EVENTS.STORE`, carrying identifiers only (never raw report text or reporter identity).

## Out of Scope

- Store-state moderation (approve, remove, flag/unflag) owned by `WO-09`.
- Change-request review (`WO-11`) and product-type approval (`WO-12`).
- The public community reports summary and the reporter-side report create/update flow, both already shipped by `WO-06`.
- The moderation inbox that aggregates open reports across stores (owned by PRD-03, FRD-02); this work order provides the inline resolution the inbox links to.
- Any change to the one-open-report-per-user invariant (`BR-04-14`) or the re-report acceptance (`AC-04-12`), which already exist.

## Requirements

- `FR-04-44`: Admin inline resolve / dismiss of an open store report; `OPEN` to `REVIEWED` or `DISMISSED`; frees the reporter to re-report (`AC-04-12`).
- `FR-04-45`: Raw report free-text and reporter identity are admin-only, read through a server-only admin data-access layer, never by widening the public governance read model.
- `FR-04-51`: `requireAdmin()` gating plus `AdminAuditLog` entries with stable action keys (`report.resolve`, `report.dismiss`).

Relevant business rules:

- `BR-04-13`: Public governance summaries must not expose requester identity or raw free-text to non-admin viewers; this stays honored.
- `BR-04-14`: One open report per (user, store); once resolved, the user may file a new report.
- `BR-04-25`: Raw report free-text and reporter identity are admin-only and read through a server-only admin data-access layer; the public read model must not be widened.
- `BR-04-29`: Every moderation mutation is gated by `requireAdmin()` and writes an audit entry with a stable action key and no PII.

Relevant acceptance criteria:

- `AC-04-24` Resolve or dismiss a report inline.
- `AC-04-25` Raw report details are admin-only.
- `AC-04-12` Re-report after resolution (already covered; the resolution here is what enables it).
- `AC-04-30` Every moderation action is gated and audited.

## Blueprints

- [BP-01](../bp-01-store-public-trust-system.md) extension points:
  - data model layer: the `StoreReport` `OPEN` to `REVIEWED` / `DISMISSED` transition.
  - query layer: a new server-only admin read (for example under `src/lib/data/admin/`) for raw report detail and reporter identity, kept strictly separate from `getStoreGovernanceSummary`.
  - server action layer: resolve / dismiss actions gated by `requireAdmin()`, each writing an audit entry.
  - UI flow layer: the admin-only resolution affordance inside the governance panel on store detail.
- See the [admin data-access-layer contract](../bp-01-store-public-trust-system.md#admin-data-access-layer-contract-planned) and [admin moderation gating contract](../bp-01-store-public-trust-system.md#admin-moderation-gating-contract-planned) in BP-01.

## Dependencies

- [PRD-03 (FRD-01) · WO-01](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/bp-01-admin-identity-and-access-platform/work-orders/wo-01-role-admin-plugin-and-audit-foundation.md) for the durable `role`, `requireAdmin()`, `AdminAuditLog`, and `writeAuditEntry()`.
- `WO-06 Store Governance Flows` for the governance panel and the `StoreReport` model these controls operate on.
- Parallelizable with `WO-09` and `WO-12` once the FRD-01 foundation exists.

## E2E Acceptance Tests

- An administrator resolves an open report from the governance panel; the `StoreReport` moves to `REVIEWED`, and an `AdminAuditLog` entry with `report.resolve` is written.
- An administrator dismisses an open report; it moves to `DISMISSED`, and an `AdminAuditLog` entry with `report.dismiss` is written.
- After a report is resolved, its reporter can file a new report for the same store (`AC-04-12`), and the earlier resolved report remains in history.
- An administrator can see the raw free-text and reporter identity through the admin data-access layer; a non-admin viewer of the same store sees neither in the public governance summary.
- A non-administrator invoking the resolve or dismiss action directly is refused by `requireAdmin()` before any change runs, and no audit entry is written.

## Notes

- GitHub tracking: this work order needs a corresponding sub-issue under BP-01 (`source_issue: TBD`); create it and keep the sub-issue order aligned with the Work Order sequence per `github-tracking-sync.mdc`.
- The admin data-access layer must be a distinct server-only module; do not add reporter identity or raw text to any read model reachable from a public route.

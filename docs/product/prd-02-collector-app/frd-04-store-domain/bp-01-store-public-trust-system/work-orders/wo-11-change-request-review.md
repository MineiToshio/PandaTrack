---
id: WO-11
type: WORK_ORDER
slug: change-request-review
title: Change Request Review
status: DRAFT
parent: BP-01
source_features: []
source_issue: TBD
implementation_status: PLANNED
last_updated: 2026-07-22
---

# WO-11 Change Request Review

## Summary

Add the admin inline review of a `StoreChangeRequest`: approve it (applying the requested changes to the store) or reject it (closing it without applying). The critical contract is that approval must **rebase** the stored diff against the store's current state at approval time and apply it transactionally, including relation fields, never blind-applying a stale diff. After any store write, other open change requests on the same store are re-evaluated and superseded when their diff becomes empty. These actions are gated by the durable administrator role and audit trail from [PRD-03 (FRD-01)](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md), and the moderation console defined by [PRD-03 (FRD-02)](../../../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md) routes administrators to them.

## In Scope

- Admin inline **approve** control for an open `StoreChangeRequest`:
  - Re-derive the diff against the store's **current** state at approval time (rebase), not the state the request was authored against.
  - Apply the resulting changes in **one transaction**, including relation fields: `contactChannels`, `addresses`, `productTypeKeys`, and `importCountries`.
  - Persist `reviewedByUserId` and `reviewedAt`.
- **Drift detection and surfacing:** when the store's current state has changed under the affected fields since the request was filed, surface the drift to the administrator rather than silently applying stale values.
- Admin inline **reject** control: close the request without applying it.
- **Supersede rule:** after any write to a store (direct edit, an applied change request, or a moderation transition), re-evaluate other open change requests on the same store; a request whose diff is now empty against the new state is superseded (invalidated). This extends the existing author-side no-op discard (`BR-04-16`) to cross-request invalidation.
- `requireAdmin()` gating on the approve / reject mutations, with an `AdminAuditLog` entry via `writeAuditEntry()` for `changeRequest.apply` and `changeRequest.reject`.
- PostHog analytics for the user-visible actions: `store_change_request_applied`, `store_change_request_rejected`, namespaced under `POSTHOG_EVENTS.STORE`, carrying identifiers and an `applied_field_count` context (never the free-text comment).

## Out of Scope

- The reporter/author-side change-request create, update, and no-op-discard flow, already shipped by `WO-06` (`AC-04-13`, `AC-04-14`).
- Store-state moderation (`WO-09`), report resolution (`WO-10`), and product-type approval (`WO-12`).
- Immutability of `sellerType` and country, already enforced by `BR-04-17`; approval must not apply changes to those fields.
- The moderation inbox that aggregates pending change requests (owned by PRD-03, FRD-02).

## Requirements

- `FR-04-46`: Admin approve / reject of a `StoreChangeRequest`; on approval, rebase the diff against the store's current state and apply transactionally including relation fields; persist `reviewedByUserId` / `reviewedAt`; rejection closes without applying; the stored diff is never blind-applied.
- `FR-04-47`: Detect and surface drift when the stored diff no longer cleanly applies to the current store state.
- `FR-04-48`: After any store write, supersede other open change requests on the same store whose diff is now empty.
- `FR-04-51`: `requireAdmin()` gating plus `AdminAuditLog` entries with stable action keys (`changeRequest.apply`, `changeRequest.reject`).

Relevant business rules:

- `BR-04-16`: Change requests persist only changed fields and are discarded when no effective diff remains (the author-side base this extends).
- `BR-04-17`: `sellerType` and country are immutable through edit / change-request flows.
- `BR-04-26`: Approval must rebase and apply relation fields transactionally; the stored diff must never be blind-applied; drift must be surfaced.
- `BR-04-27`: After any store write, other open requests whose diff is now empty are superseded.
- `BR-04-29`: Every moderation mutation is gated by `requireAdmin()` and writes an audit entry with a stable action key and no PII.

Relevant acceptance criteria:

- `AC-04-26` Change-request approval rebases against current state.
- `AC-04-27` Change-request drift is surfaced, not blind-applied.
- `AC-04-28` Other open change requests are superseded after a store write.
- `AC-04-30` Every moderation action is gated and audited.

## Blueprints

- [BP-01](../bp-01-store-public-trust-system.md) extension points:
  - data model layer: `StoreChangeRequest.reviewedByUserId` / `reviewedAt`; the applied / rejected terminal states.
  - query layer: a transactional apply that rebases the diff and writes relation fields; the cross-request supersede sweep after any store write.
  - server action layer: approve / reject actions gated by `requireAdmin()`, each writing an audit entry.
  - UI flow layer: the admin-only approve / reject affordance and the drift-surfacing view in the governance panel.
- See the [rebase-apply contract](../bp-01-store-public-trust-system.md#change-request-rebase-apply-contract-planned) and [admin moderation gating contract](../bp-01-store-public-trust-system.md#admin-moderation-gating-contract-planned) in BP-01.

## Dependencies

- [PRD-03 (FRD-01) · WO-01](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/bp-01-admin-identity-and-access-platform/work-orders/wo-01-role-admin-plugin-and-audit-foundation.md) for the durable `role`, `requireAdmin()`, `AdminAuditLog`, and `writeAuditEntry()`.
- `WO-09 Store Approval and Removal` first: the supersede-after-write sweep must fire on the store-state moderation writes introduced there (approve, remove, flag/unflag) as well as on direct edits, so the store-write surface `WO-09` establishes is a prerequisite.
- `WO-06 Store Governance Flows` for the `StoreChangeRequest` model, the diff persistence, and the governance panel.

## E2E Acceptance Tests

- An administrator approves an open change request; the diff is re-derived against the store's current state and applied in one transaction, including `contactChannels`, `addresses`, `productTypeKeys`, and `importCountries`; `reviewedByUserId` / `reviewedAt` are set; an `AdminAuditLog` entry with `changeRequest.apply` is written.
- When the store changed under the affected fields after the request was filed, the administrator is shown the drift rather than the stored values being silently applied.
- An administrator rejects a change request; it is closed without applying, and an `AdminAuditLog` entry with `changeRequest.reject` is written.
- After any store write (a direct edit, an applied change request, or a moderation transition), a second open change request whose diff is now empty against the new state is superseded.
- Approval never mutates `sellerType` or country even if a stale diff appears to contain them.
- A non-administrator invoking the approve or reject action directly is refused by `requireAdmin()` before any change runs, and no audit entry is written.

## Notes

- GitHub tracking: this work order needs a corresponding sub-issue under BP-01 (`source_issue: TBD`); create it and keep the sub-issue order aligned with the Work Order sequence per `github-tracking-sync.mdc`.
- The rebase-and-apply must be a single transaction so a partial relation write cannot leave the store inconsistent; the supersede sweep runs in the same write path that mutated the store.

---
id: WO-11
type: WORK_ORDER
slug: change-request-review
title: Change Request Review
status: ACTIVE
parent: BP-01
source_features: []
source_issue: 133
implementation_status: PLANNED
last_updated: 2026-07-23
---

# WO-11 Change Request Review

## Summary

Add the admin inline review of a `StoreChangeRequest`: approve it (applying the requested changes to the store) or reject it (closing it without applying). The critical contract is that approval must **rebase** the stored diff against the store's current state at approval time and apply it transactionally, including relation fields, never blind-applying a stale diff. After any store write, other open change requests on the same store are re-evaluated and superseded when their diff becomes empty. These actions are gated by the durable administrator role and audit trail from [PRD-03 (FRD-01)](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md), and the moderation console defined by [PRD-03 (FRD-02)](../../../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md) routes administrators to them.

## In Scope

- Admin inline **approve** control for an open `StoreChangeRequest`:
  - Re-derive the diff against the store's **current** state at approval time (rebase), not the state the request was authored against.
  - Apply the resulting changes in **one transaction**, including relation fields: `contactChannels`, `addresses`, `productTypeKeys`, and `importCountries`.
  - Persist `reviewedByUserId` and `reviewedAt`.
- **Drift detection and surfacing (v1, diff-only derivable):** the review surface shows each changed field as a two-value row (**"Ahora"** = the store's current value, **"Propuesta"** = the requested value). Two drift signals are derivable from diff-only storage and are surfaced:
  - **Per-field "already applied":** when a field's current value already equals the proposed value, the rebase drops it and the field is tagged **"Ya aplicado"**, never re-written.
  - **Store-level "changed since filed":** when `store.updatedAt > changeRequest.updatedAt`, a cautionary banner tells the administrator the store moved after the request was authored; the values shown reflect the current state and only the changes that still have effect are applied.
  - The stored diff holds only proposed values, not a base snapshot; a true per-field three-value conflict view (`cuando se propuso` / `ahora` / `propuesta` with an "En conflicto" tag) is **not derivable here** and is deferred to the moderation console ([PRD-03 (FRD-02)](../../../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md)), which must first decide a forward-only base-snapshot capture (see `Assumptions`).
- Admin inline **reject** control: close the request without applying it (`REJECTED` + reviewer stamp).
- **Supersede rule:** after any write to a store (direct edit, an applied change request, or a moderation transition), re-evaluate other open change requests on the same store; a request whose diff is now empty against the new state moves to the terminal **`SUPERSEDED`** status (invalidated), with `reviewedAt` stamped (system time) and `reviewedByUserId` left `null` because no human decided it. This extends the existing author-side no-op discard (`BR-04-16`) to cross-request invalidation.
- `requireAdmin()` gating on the approve / reject mutations, with an `AdminAuditLog` entry via `writeAuditEntry()` for `changeRequest.apply` and `changeRequest.reject`.
- PostHog analytics for the user-visible actions: `store_change_request_applied`, `store_change_request_rejected`, namespaced under `POSTHOG_EVENTS.STORE`, carrying identifiers (`store_slug`, `change_request_id`), plus `applied_field_count` and `superseded_count` on the applied event (never the free-text comment). Superseding emits no dedicated event: it is a system side effect fired by three distinct write paths, so it carries no user interaction of its own.

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
  - data model layer: `StoreChangeRequest.reviewedByUserId` / `reviewedAt`; the `APPROVED` / `REJECTED` terminal states plus a new `SUPERSEDED` value on `StoreChangeRequestStatus` for cross-request invalidation.
  - query layer: a transactional apply that rebases the diff and writes relation fields; the shared cross-request supersede sweep (`supersedeStaleChangeRequests`) invoked inside every store-write transaction.
  - server action layer: approve / reject actions gated by `requireAdmin()`, each writing an audit entry.
  - UI flow layer: the admin-only approve / reject affordance and the drift-surfacing view in the governance panel.
- See the [rebase-apply contract](../bp-01-store-public-trust-system.md#change-request-rebase-apply-contract-planned) and [admin moderation gating contract](../bp-01-store-public-trust-system.md#admin-moderation-gating-contract-planned) in BP-01.

## Dependencies

- [PRD-03 (FRD-01) · WO-01](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/bp-01-admin-identity-and-access-platform/work-orders/wo-01-role-admin-plugin-and-audit-foundation.md) for the durable `role`, `requireAdmin()`, `AdminAuditLog`, and `writeAuditEntry()`.
- `WO-09 Store Approval and Removal` first: the supersede-after-write sweep must fire on the store-state moderation writes introduced there (approve, remove, flag/unflag) as well as on direct edits, so the store-write surface `WO-09` establishes is a prerequisite.
- `WO-06 Store Governance Flows` for the `StoreChangeRequest` model, the diff persistence, and the governance panel.

## E2E Acceptance Tests

- An administrator approves an open change request; the diff is re-derived against the store's current state and applied in one transaction, including `contactChannels`, `addresses`, `productTypeKeys`, and `importCountries`; `reviewedByUserId` / `reviewedAt` are set; an `AdminAuditLog` entry with `changeRequest.apply` is written.
- When the store changed after the request was filed (`store.updatedAt > changeRequest.updatedAt`), the administrator sees the "changed since filed" banner, any field whose current value already matches the proposal is tagged "Ya aplicado" and excluded, and only the surviving changes are applied; stored values are never silently applied.
- An administrator rejects a change request; it is closed without applying, and an `AdminAuditLog` entry with `changeRequest.reject` is written.
- After any store write (a direct edit, an applied change request, or a moderation transition), a second open change request whose diff is now empty against the new state moves to `SUPERSEDED` (with `reviewedAt` set and `reviewedByUserId` null), while a second request that still has a non-empty diff stays `PENDING`.
- Approval never mutates `sellerType` or country even if a stale diff appears to contain them.
- A non-administrator invoking the approve or reject action directly is refused by `requireAdmin()` before any change runs, and no audit entry is written.

## Assumptions

- **Convention-driven (already decided by repository rules, applied not asked):**
  - Server Actions stay thin and delegate to the data layer; the approve / reject mutations live in `src/lib/data/stores/*` and the actions in `stores/[slug]/_actions/` (`AGENTS.md` section 4, `coding-standards.mdc`, `prisma-data-layer.mdc`).
  - Boundary input is validated with Zod; expected errors are typed (mirroring `StoreModerationError`) and translated to copy, never sent to Sentry; only unexpected errors are captured (`error-handling-validation.mdc`, `sentry-error-handling.mdc`).
  - Both actions gate with `requireAdmin()` (actor id never taken from the client) and write the audit entry with `writeAuditEntry(..., tx)` inside the same transaction (`BR-04-29`).
  - The modal controls use Optimistic Confirmation: the surface confirms synchronously and the parent coordinator reverts with a toast on failure (`optimistic-client-updates.mdc`).
  - The review surface reuses the canonical `Modal` shell of `StoreGovernanceSummaryModal` (an admin superset section), not a new modal (`modal-canonical-pattern.mdc`, `react-next-components.mdc`).
  - Copy lives in `src/i18n/locales/{es,en}/stores.json`; no hardcoded user-facing strings; no em dashes (`english-code-only.mdc`, `next-intl-translation-apis.mdc`).
  - Events are centralized in `POSTHOG_EVENTS.STORE` and emitted server-side (`posthog-events.mdc`).
- **`sellerType` and country are immutable structurally, not just by check:** `EditableStoreInput`, `EditableStoreDiff`, and `buildEditableStoreDiff` (`src/lib/data/stores/storeGovernanceQueries.ts` / `storeGovernanceMutations.ts`) do not carry those fields, so an apply can never mutate them even if a tampered diff appeared to contain them (`BR-04-17`). This is proven by a test, not by added guard logic.
- **Drift v1 semantics are bounded by diff-only storage.** The stored diff persists only proposed values; the base value at submission is not persisted, so a true three-value conflict is not derivable at this surface. The v1 model surfaces the two signals that are derivable (per-field "already applied" and the store-level "changed since filed" banner) and applies only the changes that still have effect. This is consistent with `BR-04-16`'s no-op discard and satisfies `FR-04-47` (drift surfaced, never silently applied) without a schema change.
- **Console seam (deferred decision, kept visible):** the richer three-value drift view documented for the moderation console ([PRD-03 (FRD-02)](../../../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md)) is equally non-derivable without a persisted base. Enabling it requires deciding a **forward-only base-snapshot capture in `upsertStoreChangeRequest`** at FRD-02 WO-02 enrichment time (persist the affected fields' base values alongside the diff, applied only to requests filed after the change). This slice does not add that capture; it records the seam so the decision is explicit at the console, not buried.

## UX Notes

- The admin review lives inside the existing governance modal (`StoreGovernanceSummaryModal`) as an admin-only section, populated server-side only when the viewer is an administrator, mirroring the report-resolution admin section from [WO-10](wo-10-report-resolution.md). It is not a separate route or modal.
- Each pending request renders: requester handle and submitted date, then an `adm-diff` field list with one row per changed field showing **"Ahora" (current)** and **"Propuesta" (proposed)**. A field whose current value already equals the proposed value carries a **"Ya aplicado"** tag and is excluded from the apply.
- When `store.updatedAt > changeRequest.updatedAt`, a `role="alert"` cautionary banner (**"La tienda cambió desde esta solicitud"**) precedes the field list. The primary action stays **"Aprobar y aplicar"** (it applies only the surviving fields); the secondary is **"Rechazar"**. There is no separate "resolve conflict" flow in v1.
- When the rebased diff is empty (every field already applied), the request is superseded rather than applied; the surface reflects a "no changes left to apply" state instead of a live apply CTA.

## Technical Notes

- **Rebase algorithm (approval).** Load the current `EditableStore` (`getEditableStoreBySlug`, which already returns the id and all relation arrays). Merge the stored diff over the current store with `mergeEditableStoreWithChangeRequest(currentStore, storedDiff)` to build an `EditableStoreInput`, normalize it (`normalizeEditableStoreInput`), then recompute `buildEditableStoreDiff(currentStore, normalized)` to get the **effective (rebased) diff**. Fields present in the stored diff but absent from the effective diff are the "already applied" set. If the effective diff is empty, apply nothing and supersede the request instead.
- **Single transaction.** Apply the effective diff, stamp `reviewedByUserId` / `reviewedAt` on the request (status `APPROVED`), run the supersede sweep, and write the `changeRequest.apply` audit entry, all inside one `prisma.$transaction`, so a partial relation write cannot leave the store inconsistent.
- **Reuse the write machinery.** Extract the transactional body of `updateStoreEditableFields` (`storeGovernanceMutations.ts`) into a `tx`-accepting helper `writeEditableStoreFields(tx, store, input)` and reuse it from both the direct-edit path and the change-request apply path, so both share the same relation-write logic.
- **Shared supersede sweep.** Add `supersedeStaleChangeRequests(tx, storeId, { excludeId? })` in `storeGovernanceMutations.ts`. For each other `PENDING` request on the store, recompute its effective diff against the new store state; when empty, set status `SUPERSEDED`, stamp `reviewedAt`, leave `reviewedByUserId` null. Invoke it inside the transaction of all three store-write paths: the direct edit (`updateStoreEditableFields`), the moderation transitions (`runModerationTransition` in `storeModerationMutations.ts`, which imports the sweep one-way), and the new apply.
- **Module placement.** The apply / reject mutations and the sweep are co-located in `storeGovernanceMutations.ts` (where the diff / normalize / merge / write machinery already lives), avoiding cross-module export of private helpers. `storeModerationMutations.ts` imports only `supersedeStaleChangeRequests`.
- **Admin read.** A new server-only `src/lib/data/admin/adminStoreChangeRequestQueries.ts` returns each `PENDING` request with its full diff, requester identity, and submitted date (and may precompute the effective / already-applied split). It is injected into `StoreGovernanceSummaryModal` via a new optional prop populated in `stores/[slug]/page.tsx` only when `isAdmin`. It never widens the public `getStoreGovernanceSummary`.
- **Schema change.** Add `SUPERSEDED` to the `StoreChangeRequestStatus` enum (Prisma migration via `migrate dev`, then `prisma generate`, then `type-check`). The `reviewedBy` relation and `reviewedByUserId` / `reviewedAt` columns already exist on the model.

## Security Notes

- Both mutations and the admin read are gated by `requireAdmin()` before any query or write; a non-administrator is refused before any change runs and no audit entry is written.
- Requester identity and the full diff are exposed only through the server-only admin data-access module; the public governance read model is never widened (`FR-04-45`, `BR-04-25`, `BR-04-13`).
- Audit entries store identifiers and an optional non-sensitive note only, never the free-text change-request comment (`BR-04-29`).
- Supersede writes no audit entry of its own: there is no `changeRequest.supersede` action key, and it is not an administrator decision. The audit entry of the write that triggered it is the record.

## Observability Notes

- `store_change_request_applied`: `{ store_slug, change_request_id, applied_field_count, superseded_count }`.
- `store_change_request_rejected`: `{ store_slug, change_request_id }`.
- No supersede event (system side effect fired by three write paths). Never emit the free-text comment.

## Open Decisions (resolved)

- **Drift v1 semantics:** honest two-value model (`Ahora` / `Propuesta`) plus per-field "Ya aplicado" tag and the store-level "changed since filed" banner; apply only surviving fields. The rich three-value console view is deferred with the base-snapshot seam noted above.
- **`SUPERSEDED` terminal state:** added to the enum; `reviewedAt` set, `reviewedByUserId` null.
- **Supersede implementation point:** shared `supersedeStaleChangeRequests(tx, ...)` inside all three store-write transactions.

## Notes

- GitHub tracking: this work order is tracked by issue `#133` under BP-01; keep the sub-issue order aligned with the Work Order sequence per `github-tracking-sync.mdc`.
- The rebase-and-apply must be a single transaction so a partial relation write cannot leave the store inconsistent; the supersede sweep runs in the same write path that mutated the store.

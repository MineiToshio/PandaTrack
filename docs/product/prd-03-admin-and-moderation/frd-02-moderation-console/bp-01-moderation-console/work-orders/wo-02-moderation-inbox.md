---
id: WO-02
type: WORK_ORDER
slug: moderation-inbox
title: Moderation Inbox
status: ACTIVE
parent: BP-01
source_issue: 129
implementation_status: IN_PROGRESS
last_updated: 2026-07-24
---

# WO-02 Moderation Inbox

## Summary

Vertical slice that builds the moderation inbox: a server-only aggregate read model that gathers the four persisted pending categories and derives a fifth row type (flag candidate / suggested removal) per the `FR-02-05` rule when a store accumulates 2 or more open reports, shaping each item's per-type review payload, a master-detail presentation (queue plus review pane on desktop, stacked queue plus full-width detail on mobile), the five per-type review panels (pending store, report, flag candidate / suggested removal, change request including its drift variant, product-type suggestion), and the invocation of the server actions owned by PRD-02, [FRD-04](../../../../prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md) from each review. This is the core value of the first release: the administrator reviews and acts without leaving the console.

## In Scope

- Server-only aggregate read model `src/lib/data/admin/moderationQueueQueries.ts` composing pending stores, open reports, pending change requests, and pending product-type requests, and shaping the per-type review payload for each item. Each store-derived row carries the store `slug`, `name`, and moderation `status` so the review can invoke the slug-based FRD-04 actions and offer "Ver tienda"; product-type rows carry the `requestId` and catalog preview.
- Deriving the flag-candidate (suggested-removal) row when a store accumulates 2 or more open reports, collapsing that store's individual report rows into the single derived row. The threshold is the named constant `STORE_FLAG_REPORT_THRESHOLD` in `src/lib/constants.ts`, not a repeated literal.
- Impact ordering across five tiers, highest first: flag candidate (suggested removal), open reports, pending stores, change requests, product-type suggestions; oldest first within each tier.
- Master-detail inbox UI: prioritized queue, per-category counts, empty state; desktop queue plus review pane with the top item auto-previewed when no item is explicitly selected; mobile stacked queue routing to a full-width review with a back link. Selection is a server-resolved route (`?item=<type>:<id>` search param), read by the inbox Server Component, mirroring the audit viewer's `?page=N` pattern.
- The five per-type review panels and their action sets: pending store (approve, remove), report (resolve, dismiss, plus a secondary remove path), flag candidate / suggested removal (flag, unflag, remove), change request (apply, reject, including itemized add/remove/keep deltas for list fields and, on drift, the honest two-value per-field view: "Ahora" and "Propuesta" with a per-field "Ya aplicado" tag and a store-level drift banner), product-type suggestion (approve, reject as a small localized form).
- Invoking the corresponding FRD-04 server actions from each review action (the console is the caller; it does not implement the mutations), and refreshing the console after a successful action with a console-side `router.refresh()`, without modifying the FRD-04-owned actions.
- Invoking the shared removal-reason modal owned by FRD-04 from the pending-store, report, and suggested-removal reviews; the modal is promoted to a location importable from both the store route subtree and the admin route subtree.
- Sensitive fields read through the admin-only path, never through the public governance read model.
- Analytics for opening an inbox item (`admin_inbox_item_opened` with an `item_type` property), emitted from a small client island.
- Unit tests for the aggregate, its ordering, its flag-candidate derivation and collapse, and the per-type payload shaping; a narrow, skippable admin E2E for the inbox render (empty and populated) and one or two review flows, matching the acceptance criteria below.

## Out of Scope

- The moderation server actions themselves (approve, remove, flag, unflag, resolve, dismiss, apply, reject for both change requests and product types) and the removal-reason modal's definition; owned by PRD-02, [FRD-04](../../../../prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md). WO-02 invokes these; it does not build them. Promoting the existing removal modal to a shared location is a placement move, not a redefinition of the mutation.
- The sidebar "Moderacion" pending-count badge. The collector shell navigation ships without a count field, and wiring a live count would require computing the aggregate on every app page, not only `/admin`. Deferred as a later enhancement; the in-inbox per-category counters (`FR-02-08`) stay in scope.
- A persisted base-snapshot capture for change requests. The stored diff holds only proposed values; the console reuses the honest two-value drift cut already shipped for the store-detail surface, so no schema change and no three-value "En conflicto" view.
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
- `FR-02-17`: Change-request review with apply and reject actions, including the two-value drift notice (current vs proposed), the per-field "Ya aplicado" tag, and the store-level drift banner.
- `FR-02-18`: Product-type-suggestion review with approve and reject actions.
- `FR-02-19`: Desktop master-detail presentation with impact-ordered queue and auto-preview of the top item.
- `FR-02-20`: Mobile stacked queue routing to a full-width detail with a back link.
- `FR-02-21`: Removal from any review uses the FRD-04 reason-selection modal.

Relevant business rules:

- `BR-02-02`: The console invokes the FRD-04 server actions in place; it does not fork the store lifecycle or re-implement them. The post-action refresh is a console-side concern (`router.refresh()`), so the FRD-04 actions stay unaware of the admin route.
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

## Assumptions

- **Convention-driven (already decided by repository rules, applied not asked):**
  - The aggregate read model is a server-only module under `src/lib/data/admin/`, never instantiating Prisma outside `src/lib/prisma.ts` (`prisma-data-layer.mdc`, ADR 0015).
  - Console UI lives in route-level `_components/` under the admin group; reuse `EmptyState`, `Modal`, `Chip`, `Button`, and `Table` from `src/components/core` and `src/components/modules` before adding new pieces (`coding-standards.mdc`, `react-next-components.mdc`, `docs/design/components.md`).
  - Review actions use Optimistic Confirmation: the surface confirms synchronously and the parent coordinator reverts with a toast on failure (`optimistic-client-updates.mdc`).
  - All copy lives in `src/i18n/locales/{es,en}/admin.json`, no hardcoded strings, no em dashes; `getTranslations` on the server and `useTranslations` on the client (`english-code-only.mdc`, `next-intl-translation-apis.mdc`, `AGENTS.md` section 4).
  - Semantic design tokens, `cn()`, semantic HTML, responsive behavior, and lucide icons (`theme-light-dark.mdc`, `tailwind-semantic-html.mdc`, `responsive-design.mdc`, `icons.mdc`).
  - The removal confirmation reuses the canonical Semantic Depth modal (`modal-canonical-pattern.mdc`, ADR 0008).
  - Analytics events are centralized in `POSTHOG_EVENTS`; a view event is client-side, mutation events stay server-side inside the FRD-04 actions (`posthog-events.mdc`).
- **The FRD-04 actions are slug-based, so the aggregate must carry the slug.** `store.approve`, `store.remove`, `store.flag`, and `store.unflag` (in `stores/[slug]/_actions/moderateStore.ts`) take the store `slug` and `locale`; report and change-request actions additionally take `reportId` / `changeRequestId`; `productType.approve` / `productType.reject` (in `admin/_actions/moderateProductTypeRequest.ts`) take `requestId`. The admin DALs (`getAdminOpenStoreReports`, `getAdminPendingStoreChangeRequests`) are keyed by `storeId`, so `moderationQueueQueries.ts` joins the store to expose `slug`, `name`, and `status` per row.
- **Drift v1 is the honest two-value cut, reused as-is.** `src/lib/data/admin/adminStoreChangeRequestQueries.ts` already returns `AdminPendingStoreChangeRequest` with per-field `AdminChangeRequestFieldRow` rows carrying `current` and `proposed`, an `alreadyApplied` flag, plus `storeDriftedSinceSubmission` and `effectiveDiffEmpty`. The stored `StoreChangeRequest` diff persists only proposed values, with no base snapshot, so a three-value "En conflicto" view is not derivable. The console reuses these rows verbatim, consistent with PRD-02, FRD-04 · [WO-11](../../../../prd-02-collector-app/frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-11-change-request-review.md) (`FR-04-47`).
- **The product-type review is a small localized form, not a one-click approve.** `productType.approve` requires `nameEs` and `nameEn` (each 1 to 50) plus an optional `key`; the DAL returns a single `suggestedName` and a `suggestedKeySlug`. The review pre-fills both localized names from `suggestedName` and lets the administrator edit them before approving.

## UX Notes

- The desktop inbox is the two-column master-detail: the queue on the left, the review pane on the right, with the top item auto-previewed on load so the pane is never blank (`FR-02-19`). Selecting a row updates the `?item=<type>:<id>` search param; the Server Component re-resolves the selection and renders that item's review in the pane.
- On mobile (below the master-detail breakpoint) the inbox shows the queue only; opening an item routes to a full-width review with a "Bandeja" back link (`FR-02-20`). Focus moves into the review on open; the back link is an early focus stop (FDD-02 section 8).
- The change-request review shows the field-by-field diff with list deltas ("Se agrega" / "Se elimina" / "Se mantiene"); on drift it shows the store-level "cambio desde que se propuso" banner, each affected field as "Ahora" and "Propuesta", and a "Ya aplicado" tag on fields whose current value already equals the proposal. There is no "En conflicto" tag and no third value.
- The removal control opens the shared FRD-04 removal modal (a `role="alertdialog"` with a reason radiogroup), not a console-local confirmation (`FR-02-21`). The reasons are the four shipped `StoreRemovalReason` values.

## Technical Notes

- **Aggregate composition.** `moderationQueueQueries.ts` reads pending stores (they are `PENDING`, outside `PUBLIC_VISIBLE_STORE_STATUSES`), open reports and pending change requests per store through the admin DALs, and pending product-type requests globally through `getAdminPendingStoreProductTypeRequests()`. It groups open reports per store; when a store's open-report count reaches `STORE_FLAG_REPORT_THRESHOLD` (2), it emits one derived flag-candidate row and drops that store's individual report rows. The same read shapes both the queue row and the selected item's review payload so the two never drift apart.
- **Selection routing.** The inbox is a Server Component reading `searchParams.item`. The value is `<type>:<id>` where `type` is one of `report`, `flag`, `pending_store`, `change_request`, `product_type`, because the ids live in different tables. No explicit `item` selects the top row on desktop (auto-preview) and renders the bare queue on mobile.
- **Post-action refresh.** The three store-scoped FRD-04 actions revalidate only `/{locale}/stores/...`; `moderateProductTypeRequest` already revalidates `/{locale}/admin`. After a successful review action the console client calls `router.refresh()` to re-read the aggregate, in parallel with the optimistic local removal of the resolved item. The FRD-04 actions are not modified (`BR-02-02`).
- **Removal modal placement.** `StoreRemovalModal` currently lives in `stores/[slug]/_components/`, a subtree the admin route cannot import. It is promoted to a shared location importable by both trees (for example `src/components/modules/`), with no duplication, and invoked from the reviews wrapping `removeStoreAction` (slug, `removalReason`, optional note).
- **Constant.** `STORE_FLAG_REPORT_THRESHOLD = 2` in `src/lib/constants.ts`.

## Security Notes

- The aggregate read and every review payload run on a server-only, admin-only path; reporter identity and raw report text are read only through the admin DALs, never through the public `getStoreGovernanceSummary` (`BR-02-03`, mirroring PRD-02, FRD-04 `FR-04-45`).
- Each review action still authorizes on its own inside the FRD-04 action (`requireAdmin()`); the console is the caller, not a second authorization boundary. The `?item` param carries only a type and id, never sensitive payload.

## Observability Notes

- Add `INBOX_ITEM_OPENED: "admin_inbox_item_opened"` to `POSTHOG_EVENTS.ADMIN` in `src/lib/constants.ts`, emitted from a small client island keyed on the selected item, carrying `{ item_type }` (`report` / `flag_candidate` / `pending_store` / `change_request` / `product_type`), following the `AdminSpaceEnteredCapture` precedent. This is a view event, so it is client-side; the mutation events stay inside the FRD-04 actions.

## Dependencies

- `WO-01` (shell, gating, `admin` namespace, `ROUTES.admin`, the `Administracion` nav section, and `POSTHOG_EVENTS.ADMIN`).
- PRD-03, FRD-01 · `WO-01` (implemented): `requireAdmin()`, `getIsAdmin()`, the admin DAL boundary.
- PRD-02, FRD-04 · [WO-09](../../../../prd-02-collector-app/frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md) through [WO-12](../../../../prd-02-collector-app/frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-12-product-type-request-approval.md) (implemented): the ten moderation server actions, the admin DALs, the `StoreRemovalModal`, `StoreRemovalReason`, the `SUPERSEDED` status, and `PUBLIC_VISIBLE_STORE_STATUSES`.

## Testing Notes

- Unit tests target the pure aggregate logic in `moderationQueueQueries.ts`: composition of the four categories, flag-candidate derivation and report-row collapse at the threshold, five-tier impact ordering with oldest-first within a tier, and per-type payload shaping. These do not require a seeded database when the composition is factored into pure functions over the DAL results.
- A narrow admin E2E covers the inbox render (empty state and a populated queue with per-category counts) and one or two review flows with the admin account, reusing `signInAsAdmin` and `shouldSkipAdminE2E` so it skips when `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` are absent (WO-01 pattern). Seeding all five item types in E2E is out of scope; the derivation and ordering are proven in unit tests.

## Validation

- Behavioral / medium-risk change (new data-access module, server/client boundary, routing search-param state, analytics): run `npm run test`, `npm run type-check`, `npm run lint`, and `npm run validate-build`, plus the new admin E2E spec on a Better-Auth-trusted port (`docs/development/testing.md`).

## E2E Acceptance Tests

- An administrator with pending items sees them aggregated and ordered by impact, with per-category counts (`AC-02-02`).
- A store with 2 or more open reports appears once in the queue as a single suggested-removal row, and not as its individual report rows (`AC-02-02`, `FR-02-05`).
- With nothing pending, the inbox shows its empty state (`AC-02-03`).
- Opening a pending-store item renders its review with approve and remove actions, invoking the FRD-04 store actions (`AC-02-04`, `AC-02-07`).
- Opening a report item renders its review with resolve, dismiss, and the admin-only reporter identity and raw text markers (`AC-02-08`).
- Opening a flag-candidate item renders its review with flag/unflag and remove actions (`AC-02-09`).
- Opening a change-request item renders its diff and requester comment, with apply and reject actions (`AC-02-10`).
- Opening a product-type-suggestion item renders its catalog preview with editable `es`/`en` names, with approve and reject actions (`AC-02-11`).
- A change request whose store changed since submission shows the store-level drift banner, each affected field as "Ahora" and "Propuesta" with a "Ya aplicado" tag where the current value already equals the proposal, and list fields showing their add/remove/keep deltas (`AC-02-12`).
- On a desktop viewport, selecting a queue row renders that item's review in the pane, and the top item is auto-previewed on load (`AC-02-13`).
- On a mobile viewport, opening a queue row routes to a full-width review with a back link to the queue (`AC-02-14`).
- The public governance read model is not used to fetch reporter identity or raw report text for the inbox or any review (`BR-02-03`).

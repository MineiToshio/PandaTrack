---
id: WO-08
type: WORK_ORDER
slug: order-side-removed-store-tombstone
title: Order-Side Removed-Store Tombstone
status: ACTIVE
parent: BP-02
source_features: []
source_issue: 136
implementation_status: PLANNED
last_updated: 2026-07-23
---

# WO-08 Order-Side Removed-Store Tombstone

## Summary

Render collector orders that reference a removed (`REJECTED`) store without breaking. Where an order surfaces its store (order list rows, order detail header), the store name stays visible as plain text and a neutral tombstone marker is added: a compact "store no longer available" marker in the dense list surfaces and a fuller line under the store name in the detail hero. The message is neutral by default ("Esta tienda ya no está disponible") and uses sanction wording only when the store's `removalReason` is the abuse category. The order row is never hidden and never errors.

This slice is the order-domain half of a cross-FRD requirement. The store-side moderation lifecycle, the `REJECTED` state, and the `Store.removalReason` enum are owned by [FRD-04 · BP-01 · WO-09](../../../frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md), which is already implemented. This slice only consumes them to render the tombstone; it introduces no new store-side state and never re-classifies removal reasons.

## In Scope

- Extend the order read models in `src/lib/data/orders/orderQueries.ts` so the order list and order detail payloads carry the referenced store's moderation `status` and `removalReason` alongside the existing `store { id, name, slug }` shape. Only the two selects that feed the affected surfaces change: `getOrdersList` and `getOrderDetail`.
- Keep the store name visible as plain text (it is already plain text today) and add a tombstone marker where an order surfaces its store when `store.status === "REJECTED"`. The marker is compact in the list surfaces (icon + tooltip + screen-reader text) and a fuller inline line in the detail hero.
- Use the sanction wording only when `isSanctionRemovalReason(store.removalReason)` is true (the abuse category); all other reasons use the neutral message.
- Add the tombstone strings to `src/i18n/locales/{es,en}/stores.json` under a dedicated `orderTombstone` group (see UX Notes for why `stores.json` and not `orders.json`).
- Keep every non-removed store unchanged (live name and, once a store link exists, its link to store detail).

## Out of Scope

- The store-side moderation actions, the `REJECTED` transition, the `Store.removalReason` column and `StoreRemovalReason` enum, and `isSanctionRemovalReason`: all owned by [FRD-04 · BP-01 · WO-09](../../../frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md).
- The public store surfaces (listing, search, store detail): a `REJECTED` store already 404s there by design; this slice touches only order surfaces.
- Delivery and dashboard surfaces that also render a store name (`DeliveryCard`, `DeliveriesTable`, `DeliveryDetailHero`, `DeliverySummaryCard`, `DashboardActivityRow` / `DashboardActivityZone`, `DashboardCollectionZone`). `FR-04-42` is scoped to collector orders; those other surfaces would show a stale store name for a removed store and are a documented sibling follow-up that will reuse the same `resolveStoreTombstone` helper and the same `stores.json` copy. See Dependencies and the Cross-domain notes in [FRD-04](../../../frd-04-store-domain/frd-04-store-domain.md) and [FRD-05](../../frd-05-order-payment-shipment.md).
- Any change to order lifecycle, payments, deliveries, or filters.

## Requirements

- `FR-04-42` (owned by FRD-04, delivered here): collector orders referencing a `REJECTED` store keep rendering, with a neutral tombstone message by default and sanction wording only for an abuse `removalReason`.

Relevant business rule:

- `BR-04-23` (order-side portion): the persisted `removalReason` drives the message shown on referencing orders; neutral by default, sanction wording only for the abuse category.

Relevant acceptance criteria:

- `AC-04-22`: an order that references a removed store still renders; its store surface shows the neutral tombstone message by default and the sanction wording when the `removalReason` is an abuse category.

## Assumptions

- The store-side dependency is already satisfied. `Store.removalReason` (enum `StoreRemovalReason`: `DUPLICATE`, `CLOSED_OR_INACTIVE`, `FALSE_INFO`, `ABUSE`), the `REJECTED` status, and `isSanctionRemovalReason` (in `src/lib/store/removalReason.ts`, where only `ABUSE` is a sanction) all exist and are consumed as-is.
- There is no live "View store" link to suppress today. `BP-02` describes a "View store" affordance in an overflow menu, but it is not implemented: the `orders.detail.actions.viewStore` string ("Ver tienda") is an orphan key with no usage in code, and `OrderActionsCard` renders only `createDelivery` and `edit`. The store name is already plain text (not a link) in every order surface. If a "View store" affordance is added in a later slice, it must hide or disable itself when `store.status === "REJECTED"` (the target 404s).
- The store row is retained by the tombstone (never hard-deleted), so `store.name` is still returned by the query. This slice preserves that historical name on the order surface rather than erasing it.

## UX Notes

Per-surface presentation (accompany the name, do not replace it):

- `OrderCard` (list, mobile) and `OrdersTable` (row, desktop): a compact inline marker next to the store name. A lucide icon plus the core `Tooltip` (`@/components/core/Tooltip`) carrying the full message, plus screen-reader-only text so the state is announced. The name stays as plain text; the row is never hidden.
- `OrderDetailHero`: a fuller treatment. Under the store `<h1>`, a short line rendering the full message (muted for the neutral variant, `--warning` tone for the sanction variant).
- `OrderDetailContent`: pass-through only. It threads the new `store.status` and `store.removalReason` fields down to the hero. There is no store link to hide here today (see Assumptions).

Neutral vs sanction:

- The two variants use distinct lucide icons, each with its own `aria-label`, so the difference is never conveyed by color alone.

Copy placement (`stores.json`, not `orders.json`):

- The copy is semantically about a store, and the neutral wording already exists in `src/i18n/locales/{es,en}/stores.json`. The list surfaces read the `orderListing` namespace and the detail reads the `orders` namespace, so putting the strings in either order namespace would force a duplicated key that can diverge. A single `orderTombstone` group in `stores.json` is read by all order surfaces via `useTranslations("stores")` and by the future delivery and dashboard follow-ups.
- Keys: `orderTombstone.neutral` and `orderTombstone.sanction`.
  - `neutral` (es): `"Esta tienda ya no está disponible."` / (en): `"This store is no longer available."` (reuses the existing store-side wording).
  - `sanction` (es): `"Esta tienda fue retirada por incumplir nuestras políticas."` / (en): `"This store was removed for violating our policies."` The exact sanction wording is subject to copywriting review; the two-variant structure is fixed. The sanction copy never exposes the reporter identity or any report free text.

## Technical Notes

- Query selects: add `status: true, removalReason: true` inside the existing `store: { select: { ... } }` in `getOrdersList` (the list `select`) and `getOrderDetail`. Do not touch `getOrderById` (feeds only the edit page, where the store is locked), `getOrderHeader`, or `listOrders`: none of them feed the affected surfaces.
- Types: extend `OrdersListPageItem["store"]` and `OrderDetailFull["store"]` from `{ id; name; slug }` to `{ id; name; slug; status: StoreStatus; removalReason: StoreRemovalReason | null }`.
- Variant helper: add a pure function `resolveStoreTombstone(store)` in `src/lib/store/` (next to `removalReason.ts`) that returns whether the store is removed and which variant (`neutral` | `sanction`) applies, reusing `isSanctionRemovalReason`. It must never re-derive the abuse classification; it only reads the `removalReason` value that WO-09 persisted. This keeps the neutral-vs-sanction decision in one tested place shared by all surfaces.
- Shared presentation component: a route-level `StoreTombstoneNotice` in `src/app/[locale]/(app)/orders/_components/share/` with a `variant: "compact" | "full"` prop, using `useTranslations("stores")` internally. It is a route-level component (the smallest valid scope per the reuse rule), so it is not registered in `docs/design/components.md`, which catalogs only `src/components/core` and `src/components/modules`. If the delivery and dashboard follow-ups adopt it, it is promoted to `src/components/modules` at that point and cataloged then.
- Data boundary: the new fields are added in the data layer (`orderQueries.ts`), never queried from the components, per `.agents/rules/prisma-data-layer.mdc`.

## Accessibility Notes

- The tombstone is not signaled by color alone: the marker carries a lucide icon with an `aria-label` and screen-reader-only text, and the detail hero renders the message as real, announceable text (`.agents/rules/role-accessibility.mdc`, ADR 0006).
- In the compact list surfaces the full message is available through the core `Tooltip` (hover and focus) in addition to the screen-reader text.

## Observability Notes

- No analytics. The tombstone is a passive render with no clickable interaction, so it does not meet the `posthog-events.mdc` "meaningful clickable interaction" bar. No `POSTHOG_EVENTS` entry is added.

## Dependencies

- [FRD-04 · BP-01 · WO-09](../../../frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md) is already implemented: it introduced the `REJECTED` status, the `Store.removalReason` enum, and the `isSanctionRemovalReason` helper that this slice reads. The dependency is satisfied, so this slice can be implemented now.
- Sibling follow-up (not blocking): the delivery and dashboard surfaces that render a store name should later show the same tombstone marker, reusing `resolveStoreTombstone` and the `stores.json` copy this slice introduces. Tracked as a documented gap, not part of this slice.

## Affected Surfaces

- order list rows: `OrderCard` and `OrdersTable` (compact marker)
- order detail header: `OrderDetailHero` (full line); `OrderDetailContent` passes the new fields through
- the order read models in `src/lib/data/orders/orderQueries.ts` that feed those surfaces (`getOrdersList`, `getOrderDetail`)

## Testing

- Unit (required): `resolveStoreTombstone` variant selection across a non-removed store, each neutral reason (`DUPLICATE`, `CLOSED_OR_INACTIVE`, `FALSE_INFO`), and the sanction reason (`ABUSE`).
- Component (required): a focused render test on `OrderDetailHero` and one list surface asserting that the marker plus screen-reader text appears for a `REJECTED` store and does not appear for an `APPROVED` store, for both the neutral and sanction variants.
- E2E (deferred, documented): a full cross-domain scenario (create an order, remove its store as an admin, then view the order as the collector) is disproportionate for a passive render that does not depend on routing, redirects, or form submission. `e2e/store-moderation.spec.ts` and `signInAsAdmin` exist but the moderation spec does not create orders, so the scenario would need a new seeded order-plus-store fixture. Coverage is provided at the unit and component level for this slice; the end-to-end path is a documented follow-up to add alongside the delivery and dashboard tombstone work.

## Notes

- This work order was created as the split-off follow-up of [FRD-04 · BP-01 · WO-09](../../../frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md) and enriched to implementation-ready in its own pass.
- Cross-domain reference: see the FRD-04 Cross-domain notes entry for the order-side tombstone and the matching design record in [FDD-05](../../fdd-05-order-payment-shipment.md).

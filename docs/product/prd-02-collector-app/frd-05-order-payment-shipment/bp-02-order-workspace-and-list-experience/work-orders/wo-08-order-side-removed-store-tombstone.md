---
id: WO-08
type: WORK_ORDER
slug: order-side-removed-store-tombstone
title: Order-Side Removed-Store Tombstone
status: DRAFT
parent: BP-02
source_features: []
source_issue: 136
implementation_status: PLANNED
last_updated: 2026-07-23
---

# WO-08 Order-Side Removed-Store Tombstone

## Summary

Render collector orders that reference a removed (`REJECTED`) store without breaking. Where an order surfaces its store (order list rows, order detail header, and any order surface that shows the store name or links to store detail), a removed store must show a neutral tombstone message by default ("Esta tienda ya no esta disponible") and sanction wording only when the store's `removalReason` is the abuse category. The order row is never hidden and never errors.

This slice is the order-domain half of a cross-FRD requirement. The store-side moderation lifecycle, the `REJECTED` state, and the `Store.removalReason` enum are owned by [FRD-04 · BP-01 · WO-09](../../../frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md). This slice only consumes them to render the tombstone; it introduces no new store-side state.

## In Scope

- Extend the order read models in `src/lib/data/orders/orderQueries.ts` so the order list and order detail payloads carry the referenced store's moderation `status` and `removalReason` alongside the existing `store { id, name, slug }` shape.
- Render a neutral tombstone where an order surfaces its store when `store.status === "REJECTED"`: replace the live store name/link with the tombstone message and suppress the link to the (now 404) store detail page.
- Use the sanction wording only when `isSanctionRemovalReason(store.removalReason)` is true (the abuse category); all other reasons use the neutral message.
- Localize the tombstone strings in `src/i18n/locales/{es,en}/orders.json`.
- Keep every non-removed store unchanged (live name and link to store detail).

## Out of Scope

- The store-side moderation actions, the `REJECTED` transition, the `Store.removalReason` column and `StoreRemovalReason` enum, and `isSanctionRemovalReason`: all owned by [FRD-04 · BP-01 · WO-09](../../../frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md).
- The public store surfaces (listing, search, store detail): a `REJECTED` store already 404s there by design; this slice touches only order surfaces.
- Any change to order lifecycle, payments, deliveries, or filters.

## Requirements

- `FR-04-42` (owned by FRD-04, delivered here): collector orders referencing a `REJECTED` store keep rendering, with a neutral tombstone message by default and sanction wording only for an abuse `removalReason`.

Relevant business rule:

- `BR-04-23` (order-side portion): the persisted `removalReason` drives the message shown on referencing orders; neutral by default, sanction wording only for the abuse category.

Relevant acceptance criteria:

- `AC-04-22`: an order that references a removed store still renders; its store surface shows the neutral tombstone message by default and the sanction wording when the `removalReason` is an abuse category.

## Dependencies

- [FRD-04 · BP-01 · WO-09](../../../frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md) must ship first: it introduces the `REJECTED` status, the `Store.removalReason` enum, and the `isSanctionRemovalReason` helper that this slice reads. This slice cannot be implemented before that field and status exist.

## Affected Surfaces

The order surfaces that render the store name or link to store detail today (to be confirmed against the code at implementation time):

- order list rows (`OrderCard`, `OrdersTable`)
- order detail header (`OrderDetailHero` / `OrderSummaryHeader`) and its `View store` affordance
- the order read models in `src/lib/data/orders/orderQueries.ts` that feed those surfaces

## E2E Acceptance Tests

- A collector order that references a store which was later removed (`REJECTED`) still renders in the order list and on the order detail page; the store surface shows the neutral tombstone message and no longer links to the store detail page.
- When the store's `removalReason` is the abuse category, the order surface shows the sanction wording instead of the neutral message.

## Notes

- This work order is `DRAFT` pending its own enrichment pass; it was created as the split-off follow-up of [FRD-04 · BP-01 · WO-09](../../../frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md).
- Cross-domain reference: see the FRD-04 Cross-domain notes entry for the order-side tombstone.

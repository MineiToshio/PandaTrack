---
id: WO-06
type: WORK_ORDER
slug: collection-overview-zone
title: Collection Overview Zone
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0016
source_issue: 111
implementation_status: IMPLEMENTED
last_updated: 2026-07-10
---

# WO-06 Collection Overview Zone

## Summary

Implement the dashboard's collection-overview zone end-to-end: total non-cancelled orders, total products (sum of item quantity), order-status distribution, spend by product type, and top stores by spend / order count.

## Prerequisites

- [`WO-01`](wo-01-dashboard-aggregation-foundation.md) — collection totals, by-type, and top-stores aggregation

## In Scope

- the collection-overview zone on the dashboard page
- total non-cancelled orders and total products (Σ `OrderItem.quantity` on non-cancelled orders)
- order-status distribution across `OrderStatus`
- spend by product type (`OrderItem.productTypeKey`), in base currency
- **product count by type**: Σ `OrderItem.quantity` grouped by product type, shown alongside the spend-by-type breakdown (`FR-06-20`)
- top stores by spend and/or order count, each linking into the store surface (store CTAs must use the shared preference-driven URL helper per `FR-06-16`)
- empty state when the collector has no collection data yet
- the `FR-06-13` partial note on money-based breakdowns
- `dashboard` locale keys for this zone
- PostHog events (zone viewed, top-store CTA clicked, product-type segment clicked)
- automated tests, at minimum one E2E asserting totals exclude cancelled orders, products sum item quantity, and top stores render with working links

## Out of Scope

- obligations, budget, spend, and activity zones
- per-store or per-type drill-down views (future extension)
- any mutation

## Requirements

- `FR-06-11`, `FR-06-14`, `FR-06-15`, `FR-06-16`
- `BR-06-05`, `BR-06-07`

## Blueprints

- [`BP-01`](../bp-01-dashboard-aggregation-and-surface.md) — collection-totals contract

## E2E Acceptance Tests

- Total orders and total products exclude `CANCELLED` orders; products equal the sum of item quantities.
- The status distribution reflects the collector's orders by `OrderStatus`.
- Spend by product type renders in base currency.
- Top stores render ranked, and each store link uses the shared preference-driven URL helper.

## Analytics

- PostHog event when the collection zone is viewed
- PostHog event when a top-store CTA is clicked
- PostHog event when a product-type segment is clicked

## Implementation Decisions

- **The KPI overview strip ships with this Work Order.** The FDD models it as its own zone (`dash-span-12`, four tinted tiles) but no Work Order named it in scope. Its four figures are exactly this Work Order's totals: orders and products (In Scope above), committed value (`BR-06-05`), and distinct stores. The FDD also places those totals **only** in the strip, never repeated inside the collection zone, so the strip is the required home for them. It is therefore built here rather than left unassigned.
- **The collection zone renders the `FR-06-13` partial note**, which the prototype omits. This Work Order's In Scope requires it on the money-based breakdowns, and the shared `.fx-warning` banner is documented as "reused on cash + collection zones". The design record's intent overrides the prototype's omission.
- **The status bar excludes cancelled orders**, so its segments sum exactly to the "Pedidos" tile. `BR-06-07` keeps cancelled orders out of collection-state rollups, and the prototype's illustrative numbers (which include a "Cancelado" segment) would otherwise make the bar disagree with the total it sits beneath. Legend chips reuse the canonical `StatusChip` (`kind="orderStatus"`, ADR 0002) rather than a bespoke mapping.
- **Each order's committed value is distributed across its items.** Committed money lives on the order, not on its items, so by-type spend weights each item by `unitPrice × quantity`, falling back to quantity when no item carries a price. Summing `unitPrice × quantity` directly reported zero for every order priced only at order level, which hid the breakdown entirely. The by-type split therefore sums to the committed total it is drawn from.
- **The KPI strip names its own partiality.** The count tiles include FX-unreconciled orders; the money tile cannot (`FR-06-13`). The committed tile carries a warning marker and the strip states how many orders are excluded, so `7 pedidos` next to a smaller committed figure does not read as a contradiction.
- **Categories are ranked, capped, and folded.** The design shows exactly four categories; the catalog has sixteen. Each breakdown ranks its own measure, keeps the top four (coloured `accent → cool → warm → success`), and folds the remainder into a neutral "Otros" slice. Spend-by-type and count-by-type are ranked independently, because an item without a `unitPrice` contributes quantity but no committed value, so the two orderings can legitimately differ.
- **`FR-06-16` is honoured by the listing CTAs, not the store rows.** The zone's "Ver tiendas" header link and the empty-state "Explorar tiendas" CTA both use `buildStoresNavHref`, exactly as the shell nav does. Individual top-store rows link to that store's **detail** page (`/stores/{slug}`), which is not the public listing and therefore takes no preference query. The aggregation layer now carries `storeSlug` and a distinct `totalStores` count to support this.
- **Product-type legend rows are links** into the orders list filtered by that type (`?productType=<key>`), which is what the "product-type segment clicked" analytics event measures. The "Otros" bucket is inert, since it maps to no single filter.

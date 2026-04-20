---
id: WO-07
type: WORK_ORDER
slug: currency-reconciliation-filter-and-bulk-fx-reconciliation
title: Currency Reconciliation Filter and Bulk FX Reconciliation
status: DRAFT
parent: BP-02
source_features:
  - FEAT-0014
source_issue: 104
last_updated: 2026-04-19
implementation_status: PLANNED
---

# WO-07 Currency Reconciliation Filter and Bulk FX Reconciliation

## Summary

Add the `Needs currency update` filter to the orders list and implement the bulk FX reconciliation flow that lets collectors apply a new exchange rate to multiple orders at once after changing their base currency in Settings.

## Prerequisites

This work order must not begin until the following slice is fully implemented:

- **FRD-07 · BP-01 · [WO-05](../../../frd-07-user-settings/bp-01-user-settings-identity-and-preferences/work-orders/wo-05-preferences-currency-country-product-types-and-budget.md)** — Base currency preference field in User Settings. `user.baseCurrencyCode` must be readable from the session before the reconciliation filter has anything to compare against.
- **FRD-05 · BP-02 · [WO-06](./wo-06-orders-list-filters-expansion-rows-and-overdue-payment-signals.md)** — Orders list with URL-backed filters. WO-07 extends the existing `parseOrderListingParams` and filter sidebar rather than building a separate list.

## In Scope

- `Needs currency update` filter option added to the orders list filter sidebar
- URL param `?fxStatus=needs_reconciliation` for the filter
- Filter chip label `Currency update needed` / `Actualización de divisa pendiente`
- Reconciliation eligibility query: orders where `currencyCode !== user.baseCurrencyCode` AND the order impacts the current or a future budget period (`FR-05-37`)
- Bulk reconciliation flow grouped by currency pair (`from → to`) (`FR-05-38`)
- Apply one exchange rate per group to all eligible orders in that pair
- Allow deferring reconciliation for manual per-order updates later
- PostHog analytics events for filter use and bulk reconciliation actions
- Spanish and English localization

## Out of Scope

- Per-order exchange rate editing (already available via the order edit form in WO-04)
- Changing the user's base currency preference (FRD-07)
- Retroactive rewriting of stored `totalCost` or payment amounts (amounts stay anchored to order currency per FRD-05 confirmed decisions)
- Dashboard rollups and budget calculations (FRD-06)

## Requirements

- `FR-05-36`
- `FR-05-37`
- `FR-05-38`
- `BR-05-13`
- `BR-05-14`

## Blueprints

- [BP-02](../bp-02-order-workspace-and-list-experience.md) list filter contract
- [BP-02](../bp-02-order-workspace-and-list-experience.md) `fxStatus` URL param convention

## Open Questions

- Exact definition of "impacts current or future budget period" (`FR-05-37`) — whether this is based on `orderDate`, `expectedDeliveryTo`, or the presence of pending payments. Must be aligned with FRD-06 budget period logic before implementation begins.
- Whether bulk reconciliation lives as a modal over the orders list or as a dedicated route (e.g., `/purchases/reconcile`). Decision should be made during the discovery phase of this WO.
- Whether to show an in-app notification or banner when the user changes base currency and there are orders pending reconciliation.

## Notes

- The FRD-05 Implementation Notes define the URL param and chip copy: filter label `Needs currency update`, chip label `Currency update needed`, param `fxStatus=needs_reconciliation`.
- Reconciliation does not rewrite stored monetary amounts; it updates only the `exchangeRate` field on each order.
- Orders where `currencyCode === user.baseCurrencyCode` are never eligible (no conversion needed).

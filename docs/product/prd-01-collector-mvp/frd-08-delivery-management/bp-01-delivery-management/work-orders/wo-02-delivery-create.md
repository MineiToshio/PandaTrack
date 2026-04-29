---
id: WO-02
type: WORK_ORDER
slug: delivery-create
title: Delivery Create
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0015
source_issue: 98
last_updated: 2026-04-28
implementation_status: PLANNED
---

# WO-02 Delivery Create

## Summary

Implement the delivery creation experience end-to-end, covering both entry points defined by the FRD: creating a delivery from an order (with store and eligible products preselected) and creating a delivery from the standalone route (store selection first, then eligible products grouped by source order).

This slice delivers a demo-able create flow that persists a new delivery, marks newly selected products as `IN_TRANSIT`, and re-derives the `OrderStatus` of every affected order within the same transaction. It also includes a minimal stub detail page at `/deliveries/[id]` so the post-create redirect lands on a real route; **FRD-08 · BP-01 · WO-03** replaces that stub with the full read-only detail view.

## Prerequisites

- [`WO-01`](wo-01-delivery-foundation.md) — Prisma schema, eligibility helper, product-state transition helpers, shared Zod schemas, and `deriveOrderStatus` integration wrapper

## In Scope

- create-delivery from order entry point: the create view opens with store prefilled and the eligible products of that source order preselected
- standalone create-delivery flow: store selector that only lists stores with at least one eligible product, followed by the grouped product selector
- store-scoped product selection grouped by source order, using the eligibility helper from `WO-01`
- minimum-one-product invariant on save: a new delivery must include at least one selected product
- delivery date (required, prefilled with today, past-or-current only)
- delivery cost (required, `0` allowed), delivery currency (default to user base currency when present)
- exchange-rate input when delivery currency differs from the user base currency
- optional expected arrival date range
- optional carrier and optional tracking free-text fields
- automatic promotion of newly selected products to `IN_TRANSIT` when the delivery is saved (regardless of their prior state)
- create mutation and server action, including the `deriveOrderStatus` call for every affected order within the same transaction
- new `getStoresWithEligibleProducts` query in `src/lib/data/deliveries/deliveryQueries.ts`
- stub detail page at `src/app/[locale]/(app)/deliveries/[id]/page.tsx` (shows `humanReadableId` and delivery date; replaced by WO-03)
- redirect to `/deliveries/[id]` after a successful create
- PostHog analytics events for the create flow
- automated tests covering the create path (unit where it makes sense, plus at least one E2E path that creates a delivery and verifies the affected orders' status is re-derived)

## Out of Scope

- edit flow (covered in [`WO-05`](wo-05-delivery-edit.md))
- full detail read-only view (covered in [`WO-03`](wo-03-delivery-detail-read-only.md))
- detail actions such as mark delivered, reopen, cancel, delete, note edit (covered in [`WO-04`](wo-04-delivery-detail-actions.md))
- deliveries list (covered in [`WO-06`](wo-06-deliveries-list.md))
- list filters (covered in [`WO-07`](wo-07-deliveries-list-filters.md))

## Requirements

- `FR-08-04` through `FR-08-11`
- `FR-08-14` through `FR-08-20`
- `BR-08-02`, `BR-08-03`

## Blueprints

- [`BP-01`](../bp-01-delivery-management.md) — create/edit contract (create side), eligibility contract, one-store boundary

## Dependencies

The following stubs from `WO-01` are filled in by this slice:

| Stub comment                             | File                                           | What to implement                                                        |
| ---------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| `// createDelivery — WO-02`              | `src/lib/data/deliveries/deliveryMutations.ts` | Full create mutation (see Technical Notes)                               |
| `// getStoresWithEligibleProducts` (new) | `src/lib/data/deliveries/deliveryQueries.ts`   | Query returning store ids + names where the user has ≥1 eligible product |

## Assumptions

- `Delivery.cost` is stored as an integer (same convention as `Order.totalCost`). The UI collects a decimal input and converts to integer before submitting, using the same `sanitizeDecimalInput` pattern already in place for orders.
- `deliveryCreateSchema` in `src/lib/deliveries/deliveryValidation.ts` is already complete and does not need changes.
- `persistDerivedOrderStatuses` in `src/lib/data/deliveries/deliveryMutations.ts` is already implemented by WO-01 and is called inside the `createDelivery` transaction.
- `getEligibleProductsForStore` in `src/lib/data/deliveries/deliveryQueries.ts` is already implemented by WO-01 and is the source of truth for the product selector.
- The "Create Delivery" primary action button in `src/app/[locale]/(app)/orders/[id]/_components/OrderActionBar.tsx` is already rendered (currently `aria-disabled`). This slice converts it to a real `Link`.
- `generateHumanReadableId` in `src/lib/deliveries/deliveryIdentifier.ts` follows the same per-user per-day sequence as orders and is called inside the create transaction.

## Technical Notes

### Routes

| Path                                             | Purpose                                  |
| ------------------------------------------------ | ---------------------------------------- |
| `src/app/[locale]/(app)/deliveries/new/page.tsx`  | Create delivery page (both entry points) |
| `src/app/[locale]/(app)/deliveries/[id]/page.tsx` | Stub detail page (replaced by WO-03)     |

**From-order entry point**: The "Create Delivery" button in `OrderActionBar.tsx` navigates to `/deliveries/new?sourceOrderId={orderId}`. The page validates that the `sourceOrderId` order belongs to the authenticated user before rendering.

**Standalone entry point**: `/deliveries/new` with no `sourceOrderId` param. The page renders the store selector as step 1.

### Queries

**`getStoresWithEligibleProducts(userId)`** — new function in `src/lib/data/deliveries/deliveryQueries.ts`. Returns `{ storeId, storeName }[]` for all stores where the user has at least one order item with `deliveryState IN (NONE, ARRIVED_AT_STORE)`. Used to populate the store selector in the standalone flow. Does not include product counts (names only).

**`getEligibleProductsForStore(storeId, userId)`** — existing WO-01 function. Called once a store is known (either from `sourceOrderId` resolution or from user selection in standalone flow). Provides the grouped product data for the product selector.

### Mutation

**`createDelivery`** in `src/lib/data/deliveries/deliveryMutations.ts`:

```
Input: DeliveryCreateInput (from deliveryValidation.ts) + userId
Transaction:
  1. Validate all productIds belong to orders with storeId === input.storeId (one-store boundary)
  2. Generate humanReadableId via generateHumanReadableId(userId, deliveryDate)
  3. Create Delivery record
  4. Create DeliveryOrderItem rows for each productId
  5. Set deliveryState = IN_TRANSIT for all selected items (getNextItemDeliveryState("create"))
  6. Collect affected orderIds and call persistDerivedOrderStatuses(tx, orderIds)
Output: { deliveryId }
```

The mutation must reject any create attempt whose final `productIds` set is empty. A delivery without products is invalid and must never be persisted.

### Server Action

Located at `src/app/[locale]/(app)/deliveries/new/_actions/createDeliveryAction.ts`. Validates session, calls `createDelivery`, handles expected errors (one-store violation, no eligible products), captures unexpected errors with Sentry.

### Stub detail page

`src/app/[locale]/(app)/deliveries/[id]/page.tsx` — Server Component. Fetches `Delivery.humanReadableId` and `Delivery.deliveryDate` for the authenticated user, renders a minimal confirmation. Returns 404 if the delivery does not belong to the user. WO-03 replaces the full content while keeping the route and auth pattern.

### OrderActionBar wiring

In `src/app/[locale]/(app)/orders/[id]/_components/OrderActionBar.tsx`, the "Create Delivery" button currently has `aria-disabled="true"` and `onClick={(e) => e.preventDefault()`. Replace with a `Link` to `/${locale}/deliveries/new?sourceOrderId={orderId}`. Remove the `Tooltip` wrapper that explains the disabled state. The PostHog event `POSTHOG_EVENTS.ORDER.CREATE_DELIVERY_CLICKED` is already wired; keep it on the `Link` via `data-ph-event`.

## UX Notes

### From-order flow

1. User taps "Create Delivery" on an order detail → navigates to `/deliveries/new?sourceOrderId={orderId}`.
2. Page loads with the store field prefilled (read-only) and **all eligible products from that source order pre-checked** in the product selector. Products from other eligible orders of the same store also appear below (unchecked) so the user can add them to the same delivery.
3. User adjusts product selection, fills in cost and date fields, submits.

### Standalone flow

1. User navigates to `/deliveries/new` with no `sourceOrderId`.
2. Step 1: store selector dropdown showing only stores where the user has ≥1 eligible product (names only).
3. After store selection, the product selector loads with all eligible products for that store (ungrouped initially, no pre-checks).
4. User selects products, fills in fields, submits.

### Product selector UI

- Flat list with non-interactive group header rows per source order (shows `humanReadableId` + `orderDate`).
- Checkbox row per product showing: product name, quantity.
- A "select all in this order" convenience toggle on each group header.
- Empty selector state: shown when `getEligibleProductsForStore` returns no products (edge case if another delivery was created concurrently — show inline error and refresh link).

### Exchange rate field

- Hidden entirely when `deliveryCurrencyCode === userBaseCurrencyCode`.
- Shown as a required field when they differ.
- Use the same numeric decimal input pattern as the order create form.

### No eligible stores empty state (standalone)

If `getStoresWithEligibleProducts` returns an empty list, show a contextual empty state explaining that all current order products are either delivered or already in another delivery. Link to the orders list.

## Security Notes

- **`sourceOrderId` ownership check**: On page load for `/deliveries/new?sourceOrderId={id}`, fetch `order.userId` and assert it equals `session.userId` before rendering. Return 404 (not 403) if the order does not belong to the user to avoid enumeration.
- **One-store boundary in mutation**: `createDelivery` must verify that every `productId` in the input belongs to an order where `order.storeId === input.storeId`. Reject with `PRODUCTS_FROM_DIFFERENT_STORE` if any mismatch is found. This check is in addition to the Zod schema validation.
- **Eligible state check in mutation**: `createDelivery` must verify that every `productId` has `deliveryState IN (NONE, ARRIVED_AT_STORE)` at write time. Reject with `PRODUCT_NOT_ELIGIBLE` if any item has moved to `IN_TRANSIT` or `DELIVERED` between page load and submit (concurrent delivery creation race condition).

## Observability Notes

| Event                                          | When                                                 | Properties                                                                 |
| ---------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `POSTHOG_EVENTS.ORDER.CREATE_DELIVERY_CLICKED` | User taps the button on order detail (already wired) | `orderId`, `status`                                                        |
| `POSTHOG_EVENTS.DELIVERY.CREATE_FLOW_OPENED`   | Page mounts for `/deliveries/new`                    | `entryPoint: "from_order" \| "standalone"`, `sourceOrderId` (when present) |
| `POSTHOG_EVENTS.DELIVERY.CREATED`              | Server Action returns success                        | `deliveryId`, `productCount`, `orderCount`, `entryPoint`                   |

Both new event names must be added to `POSTHOG_EVENTS` in `src/lib/constants.ts` under a `DELIVERY` namespace.

Sentry scope: wrap the `createDelivery` call in the Server Action with `withScope`. Do not capture expected errors (`PRODUCTS_FROM_DIFFERENT_STORE`, `PRODUCT_NOT_ELIGIBLE`, `NO_PRODUCTS_SELECTED`). Capture unexpected errors with the delivery input shape (minus any PII) as context.

## E2E Acceptance Tests

- Creating a delivery from an order entry point opens the create view with the store prefilled and the eligible products from that source order preselected.
- The standalone create flow only lists stores that have at least one eligible product, and the resulting product selector groups rows by source order.
- Newly selected products that were not previously `IN_TRANSIT` become `IN_TRANSIT` automatically when the delivery is saved.
- After creating a delivery that includes products from an order, that order's `OrderStatus` updates to reflect the new delivery association (for example `OPEN` → `PARTIALLY_IN_TRANSIT` or `IN_TRANSIT`).
- A delivery cannot be created with products from more than one store.
- A delivery cannot be created with zero selected products.
- Delivery currency defaults to the user base currency when present and requires an exchange-rate input when it differs.

## Analytics

- PostHog event when the create flow is opened (differentiating the from-order and standalone entry points)
- PostHog event when a delivery is successfully created, with counts of products and source orders involved

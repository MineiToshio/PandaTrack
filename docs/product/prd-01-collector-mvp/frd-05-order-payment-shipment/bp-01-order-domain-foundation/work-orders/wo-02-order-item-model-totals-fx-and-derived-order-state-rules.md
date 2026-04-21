---
id: WO-02
type: WORK_ORDER
slug: order-item-model-totals-fx-and-derived-order-state-rules
title: Order Item Model, Totals, FX, and Derived Order-State Rules
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0014
last_updated: 2026-04-18
implementation_status: IMPLEMENTED
---

# WO-02 Order Item Model, Totals, FX, and Derived Order-State Rules

## Summary

Implement the `OrderItem` Prisma model, total-cost derivation rules, discrepancy modal contract, one-FX-per-order validation, and the pure `deriveOrderStatus` function that converts item delivery associations into a six-state order status. List and detail views depend on this slice being complete before rendering derived summaries.

## In Scope

- `OrderItem` Prisma model with all persistence fields
- Item display ordering with drag-and-drop reorder support (`position` field)
- Item deletion rules including delivery-association guard
- Derived itemized total from `quantity × unitPrice`
- Discrepancy modal rule: conditions, save-time decisions, and i18n keys
- Exchange-rate validation contract for order currency vs. base currency
- Six-state `OrderStatus` derivation algorithm exposed as a pure function `deriveOrderStatus`
- `hasUnpaidBalance` derived field shape definition for use in detail queries
- Zod schema extensions for item rows within the create/edit flows
- Unit tests for state derivation and item validation logic

## Out of Scope

- Payment entry UI
- Delivery creation UI
- Orders workspace list rendering
- State re-derivation triggers (FRD-08's responsibility — it calls `deriveOrderStatus` when delivery states change)

## Requirements

- `FR-05-06` through `FR-05-16`
- `FR-05-32` through `FR-05-35`
- `BR-05-01` through `BR-05-07`

## Blueprints

- `BP-01` order create contract
- `BP-01` state-transition rules

## Schema Contract

### `OrderItem` model fields

| Field            | Type                          | Notes                                                                      |
| ---------------- | ----------------------------- | -------------------------------------------------------------------------- |
| `id`             | `String @id @default(cuid())` |                                                                            |
| `orderId`        | `String`                      | FK to `Order`, cascade delete                                              |
| `userId`         | `String`                      | FK to `User`, cascade delete — enables auth checks without joining `Order` |
| `name`           | `String`                      | Required. Display name for the item                                        |
| `quantity`       | `Int @default(1)`             | Required. Minimum 1                                                        |
| `unitPrice`      | `Int?`                        | Optional. Minor units (cents × 100). Example: $25.50 → 2550                |
| `productTypeKey` | `String?`                     | Optional. FK to `StoreProductType.key`, Restrict on delete                 |
| `position`       | `Int`                         | Display order within the order. Lower value = displayed first              |
| `createdAt`      | `DateTime @default(now())`    |                                                                            |
| `updatedAt`      | `DateTime @updatedAt`         |                                                                            |

Indexes: `orderId`, `userId`.

#### Monetary amounts

`unitPrice` follows the same minor-unit convention as `Order.totalCost` (WO-01): all values are `Int` representing cents × 100.

Examples:

- `$25.50 USD → 2550`
- `S/. 100.00 PEN → 10000`

UI components divide by 100 and format before display. A `unitPrice` of `0` is valid (a free item).

#### Product type

`productTypeKey` is a foreign key to `StoreProductType.key` with `onDelete: Restrict`. This links the item to the global product type catalog already used by user preferences and store assignments. The displayed label is resolved in the UI from the i18n key `productTypes.{key}`, consistent with other surfaces that reference the catalog.

When displaying product type options in the item form, the UI shows the full global `StoreProductType` catalog. Filtering by the store's assigned types via `StoreProductTypeAssignment` is intentionally omitted: stores may carry product types that are not yet reflected in their recorded assignments, and the field is optional — the collector can always leave it blank.

#### Position field

`position` is an integer representing display order within the parent order. Lower values appear first. Before persisting, the mutation normalizes positions to consecutive integers starting at 1 to prevent gaps and duplicates. Two items within the same order must not share the same position value.

## Order State Derivation

### Six-state `OrderStatus` enum

```
OPEN
PARTIALLY_IN_TRANSIT
IN_TRANSIT
PARTIALLY_DELIVERED
COMPLETED
CANCELLED
```

### State definitions

| State                  | Spanish display        | Condition                                                                                                          |
| ---------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `OPEN`                 | Abierta                | No items associated with any non-cancelled delivery                                                                |
| `PARTIALLY_IN_TRANSIT` | En camino parcial      | At least 1 item in an `IN_TRANSIT` delivery; at least 1 item with no active delivery                               |
| `IN_TRANSIT`           | En camino              | All items associated with `IN_TRANSIT` deliveries; none delivered yet                                              |
| `PARTIALLY_DELIVERED`  | Parcialmente entregada | At least 1 item in a `DELIVERED` delivery; not all items are delivered. Takes priority over `PARTIALLY_IN_TRANSIT` |
| `COMPLETED`            | Completada             | All items associated with `DELIVERED` deliveries                                                                   |
| `CANCELLED`            | Cancelada              | Order was cancelled; state does not re-derive from delivery changes                                                |

Items associated with `CANCELLED` deliveries are treated as having no active delivery for derivation purposes.

### Priority algorithm

Evaluate top-to-bottom and return the first match:

1. If ALL items are in `DELIVERED` deliveries → `COMPLETED`
2. If at least 1 item is in a `DELIVERED` delivery → `PARTIALLY_DELIVERED`
3. If ALL items are in `IN_TRANSIT` deliveries → `IN_TRANSIT`
4. If at least 1 item is in an `IN_TRANSIT` delivery → `PARTIALLY_IN_TRANSIT`
5. Otherwise → `OPEN`

### `deriveOrderStatus` function contract

```ts
type ItemDeliveryState = "open" | "in_transit" | "delivered";

interface OrderItemState {
  itemId: string;
  deliveryState: ItemDeliveryState;
}

function deriveOrderStatus(items: OrderItemState[]): Exclude<OrderStatus, "CANCELLED">;
```

- The caller maps delivery records to `ItemDeliveryState` before calling this function.
- `CANCELLED` is never returned; it is set exclusively by the cancel mutation.
- An empty `items` array returns `OPEN`.
- This function is pure: no side effects, no database access.

The function lives in `src/lib/orders/orderState.ts`. State re-derivation triggers are [`FRD-08`](../../../../frd-08-delivery-management/frd-08-delivery-management.md)'s responsibility — FRD-08 calls `deriveOrderStatus` and persists the result within the delivery mutation transaction.

### `hasUnpaidBalance` derived field

```ts
// Derived at query time — never persisted
hasUnpaidBalance: order.totalCost > sum(order.payments.map((p) => p.amount));
```

This boolean must be included in any detail or list query that surfaces payment warnings. It is not a database column. WO-03 owns the payment sum calculation; this WO defines the field's meaning and shape.

## Totals and FX

### Itemized total

```ts
itemizedTotal = items
  .filter((item) => item.unitPrice !== null)
  .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
```

`itemizedTotal` is derived in application code, never persisted. It uses integer arithmetic to avoid floating-point drift. It is only meaningful when at least one item has a `unitPrice`.

### Discrepancy modal

The discrepancy modal appears **only** when both conditions are true:

1. Every item in the order has a non-null `unitPrice`
2. `itemizedTotal !== order.totalCost`

If either condition is false, the save proceeds without the modal.

**Modal options and i18n keys:**

| Action                 | i18n key                                | Copy ES                              | Copy EN                           |
| ---------------------- | --------------------------------------- | ------------------------------------ | --------------------------------- |
| Keep entered total     | `orders.discrepancyModal.keepEntered`   | "Mantener el total ingresado"        | "Keep entered total"              |
| Use calculated total   | `orders.discrepancyModal.useCalculated` | "Usar el total calculado ({amount})" | "Use calculated total ({amount})" |
| Go back without saving | `orders.discrepancyModal.goBack`        | "Volver"                             | "Go back"                         |

The modal body must display both the entered total and the calculated total formatted in the order's currency so the user can compare before deciding.

### Exchange-rate validation

When `currencyCode !== user.baseCurrencyCode`, `exchangeRate` is required. Validation contract:

```ts
exchangeRate: z.number().min(0.01).max(99999.99).multipleOf(0.01);
```

- Minimum `0.01`: covers currencies worth more than the base (e.g. KWD/USD ≈ 3.26)
- Maximum `99,999.99`: covers high-value pairs (e.g. USD/VND ≈ 25,000) with significant headroom
- Precision: 2 decimal places

This validation lives in the Zod schema (`orderValidation.ts`), not at the database level.

## Item Deletion Rules

An item may be deleted while in **edit mode**, regardless of order status.

An item **may not** be deleted if it is associated with any non-cancelled delivery (linked via `DeliveryOrderItem`).

When a blocked deletion is attempted:

- Show a modal explaining the item cannot be deleted because it belongs to a delivery.
- Display the delivery's human-readable identifier as a **navigable link** to that delivery's detail page.
- The user must first remove the item from the delivery before deleting it from the order.

Item deletions performed during an edit session are **pending until the user saves** the order. Discarding the edit abandons pending deletions without applying them.

## Item Display and Reordering

- Items are displayed in ascending `position` order.
- On create, the first row starts at `position = 1`. Each new row appended at the bottom gets `position = max + 1`.
- A "+" button appears on hover between any two adjacent rows, allowing insertion at a specific position. Positions of subsequent rows shift down by 1.
- Drag-and-drop reordering is supported within the edit session.
- Tab from the last cell of the last row adds a new row at the bottom.
- All position changes are in-memory during the edit session and persisted atomically on save.

## Module Structure

| Path                                    | Responsibility                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `src/lib/orders/orderState.ts`          | Pure `deriveOrderStatus` function                                              |
| `src/lib/orders/orderValidation.ts`     | Zod schemas including item rows and FX validation (extends WO-01 base schemas) |
| `src/lib/data/orders/orderQueries.ts`   | Extend with `hasUnpaidBalance` in detail query shape                           |
| `src/lib/data/orders/orderMutations.ts` | Extend with item create, update, reorder, and delete operations                |

Module paths must be validated against `.cursor/rules/project-structure.mdc` and `.cursor/rules/prisma-data-layer.mdc` at implementation time, as the cursor rules are the authority on file placement.

## Security Notes

- `OrderItem.userId` enables direct authorization checks on item operations without joining through `Order`. All item mutations must validate that `userId` matches the authenticated session before proceeding.
- Item deletion eligibility (delivery association check) must be performed inside the same transaction as the delete to prevent TOCTOU races.
- `productTypeKey` is validated at the Zod boundary against active `StoreProductType` keys before any database write.
- `position` values are normalized server-side before persistence; raw client-provided position arrays must not be trusted directly.

## Technical Notes

- `position` normalization: before persisting, sort the client-provided item list by intended position and rewrite positions as consecutive integers starting at 1.
- The `deriveOrderStatus` result must be persisted within the same transaction as any mutation that changes item delivery associations. This is FRD-08's responsibility, but the order mutation module must expose an update path that accepts a pre-computed status.
- `unitPrice` of `0` is valid. The discrepancy condition uses `!== null` to check price presence, not truthiness.
- Integer arithmetic must be used throughout itemized total calculation to avoid floating-point drift.

## UX Notes

- Drag-and-drop handle visible on hover only, to reduce visual noise during normal reading.
- The "+" insert-between-rows button appears on hover only.
- The discrepancy modal shows both values with full currency formatting (e.g. "$125.00 USD") so the user can compare at a glance.
- The item deletion block modal includes the delivery link inline in the message body, not in a separate callout section.
- Validation triggers on blur for `name` and `quantity`; `unitPrice` and `productTypeKey` validate at save time.

## Assumptions

- The `Delivery` model will carry a `status` field that includes `IN_TRANSIT` and `DELIVERED` states, defined in [`FRD-08`](../../../../frd-08-delivery-management/frd-08-delivery-management.md). The derivation algorithm depends on these values being queryable at mutation time.
- The `DeliveryOrderItem` join table is the authoritative link between deliveries and order items. The delivery association check for item deletion operates on this table.
- `StoreProductType` keys are managed by the admin app and are globally consistent. The stored key references the global catalog. The UI shows all catalog types without filtering by store assignment.

## Unit Tests

### `deriveOrderStatus`

| Scenario                                        | Input                    | Expected               |
| ----------------------------------------------- | ------------------------ | ---------------------- |
| No items in any delivery                        | all `open`               | `OPEN`                 |
| 1 of 3 items in `IN_TRANSIT` delivery           | 1 `in_transit`, 2 `open` | `PARTIALLY_IN_TRANSIT` |
| All items in `IN_TRANSIT` deliveries            | all `in_transit`         | `IN_TRANSIT`           |
| 1 of 3 items in `DELIVERED` delivery            | 1 `delivered`, 2 `open`  | `PARTIALLY_DELIVERED`  |
| All items in `DELIVERED` deliveries             | all `delivered`          | `COMPLETED`            |
| Mix: 1 `delivered` + 1 `in_transit` + 1 `open`  | mixed                    | `PARTIALLY_DELIVERED`  |
| Items with `CANCELLED` delivery treated as open | all remapped to `open`   | `OPEN`                 |
| Empty item list                                 | `[]`                     | `OPEN`                 |

### `hasUnpaidBalance`

| Scenario                                        | Expected |
| ----------------------------------------------- | -------- |
| `totalCost = 10000`, payments sum = `10000`     | `false`  |
| `totalCost = 10000`, payments sum = `7000`      | `true`   |
| `totalCost = 10000`, no payments                | `true`   |
| `COMPLETED` order with payments sum < totalCost | `true`   |

### Item validation

- `quantity` below 1 is rejected
- `unitPrice` of `0` is valid
- `unitPrice` of negative value is rejected
- `productTypeKey` not in active catalog is rejected at Zod boundary

## E2E Acceptance Tests

- Saving an itemized order derives totals correctly from quantity and unit price.
- The discrepancy modal appears only when every item has a unit price and the derived total differs from the manually entered total.
- Choosing "Use calculated total" replaces the entered total and saves the order.
- Fully delivered orders (all items in `DELIVERED` deliveries) move to `COMPLETED` even when payment is still owed.
- `COMPLETED` orders with outstanding balance show the unpaid signal in both list and detail.
- Dragging an item row to a new position persists the updated order after save.
- Inserting a row between two existing items places it at the correct position after save.
- Attempting to delete an item linked to a delivery shows the delivery link in the block modal.

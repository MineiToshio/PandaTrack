---
id: WO-01
type: WORK_ORDER
slug: delivery-foundation
title: Delivery Foundation
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0015
source_issue: 97
last_updated: 2026-04-30
implementation_status: IMPLEMENTED
---

# WO-01 Delivery Foundation

## Summary

Establish the delivery persistence model, enums, shared validation schemas, eligibility helpers, product-state transition helpers, and the `deriveOrderStatus` integration wrapper that every downstream delivery slice depends on.

This Work Order is the foundation slice for [`BP-01`](../bp-01-delivery-management.md). By design it ships no UI and no routes. It is validated with unit tests, not with an E2E path.

## In Scope

- Prisma models for `Delivery` and the delivery-to-product association, including cost, currency, dates, note, lifecycle state, and audit fields
- `DeliveryStatus` enum (`IN_TRANSIT`, `DELIVERED`, `CANCELLED`) with the rule that state is derived from lifecycle actions rather than edited directly
- `OrderItemDeliveryState` enum (`NONE`, `ARRIVED_AT_STORE`, `IN_TRANSIT`, `DELIVERED`) persisted on `OrderItem` to represent the three product milestones defined in `BR-08-02`
- Prisma migration for the new and expanded schema
- shared Zod validation schemas for delivery create, edit, and lifecycle mutations (consumed by multiple later slices)
- shared eligibility query helper: returns eligible products grouped by source order for a given store, excluding products already delivered or already attached to another active delivery
- shared product-state transition helpers: recalculate product delivery state from delivery mutations (create, edit-add, edit-remove, mark delivered, reopen, cancel, delete)
- `deriveOrderStatus` integration wrapper (`persistDerivedOrderStatuses`) that takes a set of affected order IDs and persists the re-derived `OrderStatus` within the caller transaction, using the pure function from [`FRD-05 · BP-01 · WO-02`](../../../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md)
- delivery data-access module skeleton under `src/lib/data/deliveries/` (query and mutation entry points that later slices will fill in)
- unit tests for product-state transition helpers, mapping helpers, and the `deriveOrderStatus` integration wrapper

## Out of Scope

- any UI, including "shared" components
- delivery create, edit, detail, list, or action routes
- delivery mutation flows that a user invokes
- standalone "mark as arrived at store" action (belongs to the UI slice that introduces that interaction)
- PostHog events (belong to the vertical slices that introduce user-visible actions)
- dashboard aggregation

## Requirements

- `FR-08-01` through `FR-08-03`
- `FR-08-13`
- `FR-08-18` through `FR-08-24`
- `BR-08-01`, `BR-08-02`, `BR-08-03`, `BR-08-07`

## Blueprints

- [`BP-01`](../bp-01-delivery-management.md) — eligibility contract, lifecycle contract, and the shared-helper decisions this foundation implements

## Schema Contract

### `DeliveryStatus` enum

| Value        | Description                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------- |
| `IN_TRANSIT` | Default status when a delivery is created. The package is on its way to the user.           |
| `DELIVERED`  | Set by the `markDelivered` lifecycle action. All associated products become `DELIVERED`.    |
| `CANCELLED`  | Set by the `cancel` lifecycle action. All associated products return to `ARRIVED_AT_STORE`. |

### `OrderItemDeliveryState` enum

Persisted on `OrderItem.deliveryState`. Represents the three product milestones from `BR-08-02`.

| Value              | Meaning                                                                     | Maps to `ItemDeliveryState` for order-status derivation |
| ------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| `NONE`             | Product has never been associated with a delivery.                          | `"open"`                                                |
| `ARRIVED_AT_STORE` | Product is physically at the store and not currently in an active delivery. | `"open"`                                                |
| `IN_TRANSIT`       | Product is included in a `IN_TRANSIT` delivery.                             | `"in_transit"`                                          |
| `DELIVERED`        | Product is included in a `DELIVERED` delivery.                              | `"delivered"`                                           |

`NONE` and `ARRIVED_AT_STORE` both map to `"open"` for order-status derivation because neither state represents an active delivery association. The distinction between them is only relevant at the product display level.

### `Delivery` model fields

| Field                 | Type                                  | Notes                                                                                                                                       |
| --------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | `String @id @default(cuid())`         |                                                                                                                                             |
| `humanReadableId`     | `String @unique`                      | Format: `DLV-YYYYMMDD-NN`. Generated by `generateDeliveryHumanReadableId()` in `src/lib/deliveries/deliveryIdentifier.ts`.                  |
| `storeId`             | `String`                              | FK to `Store`, cascade delete. One delivery belongs to exactly one store (`FR-08-01`).                                                      |
| `userId`              | `String`                              | FK to `User`, cascade delete. Duplicated from the parent store context for direct auth without join (`data-layer-user-id-duplication.mdc`). |
| `status`              | `DeliveryStatus @default(IN_TRANSIT)` | Always `IN_TRANSIT` at creation. Never edited directly (`FR-08-13`).                                                                        |
| `deliveryDate`        | `DateTime`                            | Required shipping date. Past or current dates only (`FR-08-05`).                                                                            |
| `expectedArrivalFrom` | `DateTime?`                           | Optional start of expected arrival range (`FR-08-11`).                                                                                      |
| `expectedArrivalTo`   | `DateTime?`                           | Optional end of expected arrival range (`FR-08-11`).                                                                                        |
| `cost`                | `Int`                                 | Required, including `0` (`FR-08-07`). Minor units (cents × 100), same convention as `Order.totalCost`.                                      |
| `currencyCode`        | `String`                              | Required 3-letter ISO code (`FR-08-08`).                                                                                                    |
| `exchangeRate`        | `Decimal?`                            | Required only when `currencyCode` differs from `user.baseCurrencyCode` (`FR-08-10`). Precision: 2 decimal places, range 0.01–99999.99.      |
| `needsExchangeRateUpdate` | `Boolean @default(false)`         | Stale-rate flag (`FR-08-10a`). Set `true` in the same transaction as a base-currency change for deliveries whose currency differs from the new base; mirrors `Order.needsExchangeRateUpdate`. Cleared when the delivery is edited (per-delivery edit is the reconciliation path). Never mutates the stored rate. |
| `note`                | `String?`                             | Private note field (`FR-08-26`). Max 2000 characters.                                                                                       |
| `createdAt`           | `DateTime @default(now())`            |                                                                                                                                             |
| `updatedAt`           | `DateTime @updatedAt`                 |                                                                                                                                             |

Indexes: `storeId`, `userId`, `status`.

### `OrderItem` model — added field

| Field           | Type                                    | Notes                                                                   |
| --------------- | --------------------------------------- | ----------------------------------------------------------------------- |
| `deliveryState` | `OrderItemDeliveryState @default(NONE)` | Maintained by every delivery mutation. Never edited by order mutations. |

### `DeliveryOrderItem` model (unchanged)

Junction table linking `Delivery` ↔ `OrderItem`. Cascade delete on both sides. No additional fields needed for MVP.

## Product-State Transition Rules

Implemented as pure functions in `src/lib/deliveries/deliveryState.ts`. No database access.

| Delivery mutation | Items affected                | `OrderItemDeliveryState` transition                      |
| ----------------- | ----------------------------- | -------------------------------------------------------- |
| `create`          | all items in the new delivery | `NONE` → `IN_TRANSIT`; `ARRIVED_AT_STORE` → `IN_TRANSIT` |
| `edit-add`        | newly added items             | `NONE` → `IN_TRANSIT`; `ARRIVED_AT_STORE` → `IN_TRANSIT` |
| `edit-remove`     | removed items                 | `IN_TRANSIT` → `ARRIVED_AT_STORE`                        |
| `mark-delivered`  | all items in delivery         | `IN_TRANSIT` → `DELIVERED`                               |
| `reopen`          | all items in delivery         | `DELIVERED` → `IN_TRANSIT`                               |
| `cancel`          | all items in delivery         | `IN_TRANSIT` → `ARRIVED_AT_STORE`                        |
| `delete`          | all items in delivery         | `IN_TRANSIT` → `ARRIVED_AT_STORE`                        |

**Note on `FR-08-19`:** When a product is added to a delivery (`create` or `edit-add`), it immediately transitions to `IN_TRANSIT`. If it was `NONE` before, it effectively "skips" `ARRIVED_AT_STORE` as a resting state. After a cancel or delete, it returns to `ARRIVED_AT_STORE` — which is what `FR-08-24` requires. The automatic "mark as arrived" described in `FR-08-19` is captured by this irreversible progression: once a product has been in a delivery, it is always at least `ARRIVED_AT_STORE`.

**Note on `FR-08-24` and cancelled `DELIVERED` deliveries:** Cancelling a `DELIVERED` delivery directly is not a supported action. The user must reopen first (`DELIVERED` → `IN_TRANSIT`), then cancel (`IN_TRANSIT` → `ARRIVED_AT_STORE`). Action availability flags (implemented in WO-03/WO-04) enforce this.

## Zod Schema Contract

Defined in `src/lib/deliveries/deliveryValidation.ts`. Consumed by WO-02 through WO-05 server actions.

### `deliveryCreateSchema`

| Field                 | Validation                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `storeId`             | `cuid()`                                                                                                   |
| `deliveryDate`        | shipping date, must be ≤ today (`FR-08-05`)                                                                |
| `expectedArrivalFrom` | `date?`                                                                                                    |
| `expectedArrivalTo`   | `date?`, must be ≥ `expectedArrivalFrom` when both provided                                                |
| `cost`                | `int`, `min(0)`, `max(999_999_999)`                                                                        |
| `currencyCode`        | 3-letter ISO, validated against allowed collector currencies                                               |
| `exchangeRate`        | `min(0.01)`, `max(99999.99)`, `multipleOf(0.01)` — nullable, required when currency differs from user base |
| `productIds`          | `cuid[]`, `min(1)`                                                                                         |

### `deliveryEditSchema`

Same shape as create, all fields optional except `deliveryId`. `productIds` must still have at least 1 item when provided.

### Lifecycle schemas

`deliveryMarkDeliveredSchema`, `deliveryReopenSchema`, `deliveryCancelSchema`, `deliveryDeleteSchema` — each requires only `deliveryId: cuid()`.

`deliveryNoteUpdateSchema` — requires `deliveryId: cuid()` and `note: string | null`, max 2000 characters.

## Module Structure

| Path                                                       | Responsibility                                                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/lib/deliveries/deliveryIdentifier.ts`                 | `generateDeliveryHumanReadableId(tx, userId, date)` — `DLV-YYYYMMDD-NN` generator                  |
| `src/lib/deliveries/deliveryState.ts`                      | `mapToItemDeliveryState()`, `getNextItemDeliveryState()`, `isEligibleForDelivery()` — pure helpers |
| `src/lib/deliveries/deliveryValidation.ts`                 | Shared Zod schemas and inferred TypeScript types                                                   |
| `src/lib/data/deliveries/deliveryQueries.ts`               | `getEligibleProductsForStore()` + stubs for WO-03/WO-06                                            |
| `src/lib/data/deliveries/deliveryMutations.ts`             | `persistDerivedOrderStatuses()` + stubs for WO-02 through WO-05                                    |
| `src/lib/deliveries/_tests/deliveryState.test.ts`          | Unit tests for pure state helpers                                                                  |
| `src/lib/data/deliveries/_tests/deliveryMutations.test.ts` | Unit tests for `persistDerivedOrderStatuses` wrapper                                               |

## Eligibility Contract

```ts
type EligibleProduct = {
  orderItemId: string;
  orderItemName: string;
  quantity: number;
  productTypeKey: string | null;
  orderId: string;
  orderHumanReadableId: string;
  orderDate: Date;
};

type EligibleProductsResult = {
  byOrder: Array<{
    orderId: string;
    orderHumanReadableId: string;
    orderDate: Date;
    products: EligibleProduct[];
  }>;
};

function getEligibleProductsForStore(
  storeId: string,
  userId: string,
  excludeDeliveryId?: string, // edit mode: re-include current delivery's items
): Promise<EligibleProductsResult>;
```

Eligible items: `deliveryState` is `NONE` or `ARRIVED_AT_STORE`. Items with `IN_TRANSIT` or `DELIVERED` state are excluded entirely — not shown as disabled options (`BR-08-03`). Results are ordered by `orderDate` ascending, then `position` ascending within each order.

## `deriveOrderStatus` Integration Wrapper

```ts
// src/lib/data/deliveries/deliveryMutations.ts
async function persistDerivedOrderStatuses(tx: Prisma.TransactionClient, orderIds: string[]): Promise<void>;
```

For each unique order ID:

1. Load the order's `status` and all items with their `deliveryState` via `tx.orderItem.findMany`.
2. Skip if order not found or if `status === CANCELLED` (cancelled orders are never updated by delivery mutations).
3. Map each `OrderItemDeliveryState` → `ItemDeliveryState` using `mapToItemDeliveryState`.
4. Call pure `deriveOrderStatus(mappedItems)` from `src/lib/orders/orderState.ts`.
5. Persist via `tx.order.update` only if the derived status differs from the current status.

This function must be called inside the same transaction as any delivery mutation that changes product-to-delivery associations.

## Security Notes

- `Delivery.userId` enables direct authorization checks on delivery operations without joining through orders or stores. All delivery mutations must validate that `userId` matches the authenticated session before proceeding.
- The eligibility query filters by both `storeId` and `userId` to prevent cross-user product leakage.
- Eligibility checks at query time (not just at write time) are a best-effort guard. The mutation layer must re-verify eligibility inside the transaction to prevent TOCTOU races.

## Technical Notes

- `ARRIVED_AT_STORE` and `NONE` both map to `"open"` for `deriveOrderStatus`. This means order status derivation is unaffected by the `arrived_at_store` product milestone — an order stays `OPEN` until items are `IN_TRANSIT`.
- `Delivery.cost` uses minor units (cents × 100), consistent with `Order.totalCost` and `OrderItem.unitPrice`.
- `humanReadableId` is generated within the same transaction as the delivery create, using the same daily-sequence algorithm as orders (`src/lib/orders/orderIdentifier.ts`) with the `DLV-` prefix.
- The existing `deriveItemDeliveryState` function in `src/lib/data/orders/orderQueries.ts` derives item display state from delivery join records at query time. After WO-01, `OrderItem.deliveryState` is the persisted source of truth for product state. UI slices (WO-03 and WO-06) will read from `deliveryState` directly rather than re-deriving from joins.

## Assumptions

- A delivery is always created in `IN_TRANSIT` status. There is no separate "preparing" state before items ship. The `arrived_at_store` milestone belongs to the product level (`OrderItemDeliveryState`), not the delivery level.
- Standalone "mark as arrived at store" (without creating a delivery) is a user-facing action that belongs to a later UI slice. WO-01 defines the state and the transition helpers but does not implement the action.
- The migration file is at `prisma/migrations/20260427000000_expand_delivery_model/migration.sql`. The existing dev database had a pre-existing checksum mismatch on an earlier migration; the schema was applied via `prisma db push --accept-data-loss` and the migration file was created manually to preserve history.
- The `build` script temporarily carried a one-off `prisma migrate resolve --rolled-back` step to work around that checksum mismatch. It was removed once `prisma migrate status` confirmed the database was clean and up to date (2026-07-10); the workaround is no longer needed and no equivalent step remains in `build`.

## E2E Acceptance Tests

This foundation slice is exempt from the "must include an E2E acceptance path" rule because by design it ships no UI.

Validation is done via unit tests that cover, at minimum:

- product-state transition helpers return the correct `OrderItemDeliveryState` for each mutation type
- `mapToItemDeliveryState` maps all four enum values correctly
- `isEligibleForDelivery` returns true only for `NONE` and `ARRIVED_AT_STORE`
- `persistDerivedOrderStatuses` skips empty order lists, skips `CANCELLED` orders, updates status when derived differs, skips update when derived matches, deduplicates order IDs

## Unit Test Matrix

### `deliveryState.test.ts`

| Scenario                                     | Expected           |
| -------------------------------------------- | ------------------ |
| `mapToItemDeliveryState(NONE)`               | `"open"`           |
| `mapToItemDeliveryState(ARRIVED_AT_STORE)`   | `"open"`           |
| `mapToItemDeliveryState(IN_TRANSIT)`         | `"in_transit"`     |
| `mapToItemDeliveryState(DELIVERED)`          | `"delivered"`      |
| `getNextItemDeliveryState("create")`         | `IN_TRANSIT`       |
| `getNextItemDeliveryState("edit-add")`       | `IN_TRANSIT`       |
| `getNextItemDeliveryState("edit-remove")`    | `ARRIVED_AT_STORE` |
| `getNextItemDeliveryState("mark-delivered")` | `DELIVERED`        |
| `getNextItemDeliveryState("reopen")`         | `IN_TRANSIT`       |
| `getNextItemDeliveryState("cancel")`         | `ARRIVED_AT_STORE` |
| `getNextItemDeliveryState("delete")`         | `ARRIVED_AT_STORE` |
| `isEligibleForDelivery(NONE)`                | `true`             |
| `isEligibleForDelivery(ARRIVED_AT_STORE)`    | `true`             |
| `isEligibleForDelivery(IN_TRANSIT)`          | `false`            |
| `isEligibleForDelivery(DELIVERED)`           | `false`            |

### `deliveryMutations.test.ts`

| Scenario                                                | Expected                          |
| ------------------------------------------------------- | --------------------------------- |
| Empty `orderIds`                                        | `findFirst` not called            |
| Order not found                                         | `update` not called               |
| Order is `CANCELLED`                                    | `update` not called               |
| All items `IN_TRANSIT`, current `OPEN`                  | Updates to `IN_TRANSIT`           |
| All items `IN_TRANSIT`, current `IN_TRANSIT`            | No update                         |
| All items `DELIVERED`, current `OPEN`                   | Updates to `COMPLETED`            |
| All items `ARRIVED_AT_STORE`, current `IN_TRANSIT`      | Updates to `OPEN`                 |
| Mixed `IN_TRANSIT` + `ARRIVED_AT_STORE`, current `OPEN` | Updates to `PARTIALLY_IN_TRANSIT` |
| Duplicate order IDs in input                            | `findFirst` called only once      |

## Notes

- The `Delivery` `status` field must be queryable at mutation time because order and payment rules in [`FRD-05 · BP-01 · WO-01`](../../../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-01-currency-catalog-order-identifiers-and-persistence-contracts.md) depend on `DELIVERED` visibility.
- This foundation intentionally excludes server actions tied to a specific user-facing flow. Those belong in their respective vertical slices (`WO-02` through `WO-07`).

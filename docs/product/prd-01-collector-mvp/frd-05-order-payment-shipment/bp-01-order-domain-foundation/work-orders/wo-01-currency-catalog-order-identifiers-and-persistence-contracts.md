---
id: WO-01
type: WORK_ORDER
slug: currency-catalog-order-identifiers-and-persistence-contracts
title: Currency Catalog, Order Identifiers, and Persistence Contracts
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0014
last_updated: 2026-04-19
implementation_status: IMPLEMENTED
---

# WO-01 Currency Catalog, Order Identifiers, and Persistence Contracts

## Summary

Establish the currency validation strategy, order identifier scheme, and persistence contracts for the `Order`, `OrderPayment`, and `OrderHistory` models — including the delete and cancel rules that govern how orders and their dependencies are removed or transitioned.

## In Scope

- Currency validation strategy using the existing hardcoded catalog from user settings
- `Order` Prisma model with all persistence fields: human-readable identifier, currency, exchange rate, total cost, note, status, and audit timestamps
- `OrderPayment` Prisma model
- `OrderHistory` Prisma model with i18n-compatible event pattern
- `OrderStatus` and `OrderHistoryEventType` enums
- Order identifier generation logic (date-based prefix + per-user daily sequence)
- Delete and cancel rule contracts including delivery cascade behavior
- Zod validation schemas for create, edit, cancel, and delete flows
- Order query and mutation module structure under the private app data layer
- Unit tests for the identifier generator

## Out of Scope

- Spreadsheet form UX
- Order list filtering
- Delivery eligibility and product allocation
- Order item fields (covered in WO-02)
- Payment entry UI and balance guards (covered in WO-03)

## Requirements

- `FR-05-03` through `FR-05-05`
- `FR-05-14` through `FR-05-16`
- `FR-05-21` through `FR-05-25`
- `BR-05-07` through `BR-05-12`

## Blueprints

- `BP-01` currency contract
- `BP-01` delete-versus-cancel decision

## Currency Strategy

Currency is not stored in a database table. The permitted set of order currencies is the same hardcoded catalog used by user settings: `ALLOWED_COLLECTOR_BASE_CURRENCY_CODES` exported from `src/lib/catalog/collectorCountries.ts`.

The `currencyCode` field on `Order` is a plain `String` validated at the Zod boundary against `isAllowedCollectorBaseCurrency()` — the same validator used for `baseCurrencyCode` on `User`. Localized currency labels are resolved in the UI from the i18n namespace key `currencies.{code}`, consistent with the currency display in user settings.

## Order Identifier Strategy

Human-readable identifiers follow the format `ORD-YYYYMMDD-NN`:

- `YYYYMMDD` is the calendar date of order creation in UTC
- `NN` is a one-based per-user daily sequence counter
- Overflow beyond two digits is permitted (`ORD-20260418-100` is valid)
- Two orders from different users on the same day may share the same `NN` without conflict
- Generation: within a single database transaction, query the current MAX sequence for `(userId, date)` and increment by one. This approach is safe for MVP serverless volumes.
- `humanReadableId` carries a `@unique` constraint enforced at the database level as a last-resort integrity guard

## Schema Contracts

### `OrderStatus` enum

```
OPEN
PARTIALLY_IN_TRANSIT
IN_TRANSIT
PARTIALLY_DELIVERED
COMPLETED
CANCELLED
```

`PARTIALLY_IN_TRANSIT` and `IN_TRANSIT` were added in WO-02 to distinguish between items in active deliveries and items already delivered to the collector. See WO-02 for the full derivation algorithm.

### `OrderHistoryEventType` enum

```
ORDER_CREATED
ORDER_EDITED
ORDER_CANCELLED
ORDER_REACTIVATED
PAYMENT_ADDED
PAYMENT_DELETED
NOTE_UPDATED
```

### `Order` model fields

| Field                  | Type                          | Notes                                                             |
| ---------------------- | ----------------------------- | ----------------------------------------------------------------- |
| `id`                   | `String @id @default(cuid())` |                                                                   |
| `storeId`              | `String`                      | FK to `Store`                                                     |
| `userId`               | `String`                      | FK to `User`                                                      |
| `humanReadableId`      | `String @unique`              | `ORD-YYYYMMDD-NN`, generated server-side                          |
| `orderDate`            | `DateTime`                    | Set by the user; distinct from `createdAt`                        |
| `expectedDeliveryFrom` | `DateTime?`                   | Start of expected delivery range                                  |
| `expectedDeliveryTo`   | `DateTime?`                   | End of expected delivery range                                    |
| `currencyCode`         | `String`                      | Validated against `ALLOWED_COLLECTOR_BASE_CURRENCY_CODES`         |
| `exchangeRate`         | `Decimal?`                    | Required only when `currencyCode` differs from `baseCurrencyCode` |
| `totalCost`            | `Int`                         | Minor units (cents × 100). Example: $25.50 → 2550                 |
| `note`                 | `String?`                     | User-authored private note; inline-editable                       |
| `status`               | `OrderStatus`                 | Default `OPEN`; system-derived                                    |
| `createdAt`            | `DateTime @default(now())`    |                                                                   |
| `updatedAt`            | `DateTime @updatedAt`         |                                                                   |

Indexes: `storeId`, `userId`, `status`.

### `OrderPayment` model fields

| Field         | Type                          | Notes                                             |
| ------------- | ----------------------------- | ------------------------------------------------- |
| `id`          | `String @id @default(cuid())` |                                                   |
| `orderId`     | `String`                      | FK to `Order`, cascade delete                     |
| `userId`      | `String`                      | FK to `User`                                      |
| `amount`      | `Int`                         | Minor units (cents × 100). Example: $25.50 → 2550 |
| `paymentDate` | `DateTime`                    | Set by the user                                   |
| `createdAt`   | `DateTime @default(now())`    |                                                   |
| `updatedAt`   | `DateTime @updatedAt`         |                                                   |

Indexes: `orderId`, `userId`.

### `OrderHistory` model fields

| Field       | Type                          | Notes                                 |
| ----------- | ----------------------------- | ------------------------------------- |
| `id`        | `String @id @default(cuid())` |                                       |
| `orderId`   | `String`                      | FK to `Order`, cascade delete         |
| `userId`    | `String`                      | FK to `User`                          |
| `eventType` | `OrderHistoryEventType`       | Determines the i18n key               |
| `metadata`  | `Json @default("{}")`         | Dynamic interpolation values for i18n |
| `createdAt` | `DateTime @default(now())`    | No `updatedAt`; entries are immutable |

Index: `orderId`.

## Monetary Amounts

All monetary amounts (`Order.totalCost`, `OrderPayment.amount`) are stored as `Int` in minor currency units (cents × 100).

Examples:

- `$25.50 USD → 2550`
- `S/. 100.00 PEN → 10000`

The `exchangeRate` field uses `Decimal` to preserve precision for fractional exchange rates (e.g. `3.720000`).

UI components are responsible for dividing by 100 and formatting before display.

## OrderHistory i18n Pattern

`OrderHistory` stores no human-readable description. The UI resolves display text by calling `t(eventType, metadata)` against the active locale. `metadata` carries the dynamic interpolation values the translation string needs.

| eventType           | metadata shape                              | Example text (ES)               |
| ------------------- | ------------------------------------------- | ------------------------------- |
| `ORDER_CREATED`     | `{}`                                        | "Orden creada"                  |
| `ORDER_EDITED`      | `{ "fields": ["totalCost", "orderDate"] }`  | "Orden actualizada"             |
| `ORDER_CANCELLED`   | `{}`                                        | "Orden cancelada"               |
| `ORDER_REACTIVATED` | `{}`                                        | "Orden reactivada"              |
| `PAYMENT_ADDED`     | `{ "amount": 2550, "currencyCode": "USD" }` | "Pago de $25.50 USD registrado" |
| `PAYMENT_DELETED`   | `{ "amount": 2550, "currencyCode": "USD" }` | "Pago de $25.50 USD eliminado"  |
| `NOTE_UPDATED`      | `{}`                                        | "Nota actualizada"              |

One `ORDER_EDITED` entry is generated per edit session regardless of how many fields changed. `metadata.fields` lists the modified field names for reference. History entries for cancelled orders are preserved; entries are cascade-deleted only when the order is physically deleted.

## Delete and Cancel Contracts

Delete and cancel share the same eligibility rule and differ only in the outcome for the order record: delete removes it physically; cancel transitions it to `CANCELLED` and preserves it.

### Shared eligibility rule

Both operations are **blocked** when at least one `OrderItem` of the order is linked to a non-cancelled delivery (via `DeliveryOrderItem`). When the rule is not met:

- The UI renders the affordance as disabled with a tooltip that instructs the collector to first unlink the affected items from their delivery.
- The Server Action re-validates the rule server-side and rejects the mutation with a clear error code even if the client state was stale.

Delivery links pointing to deliveries in `CANCELLED` state do not count as live links and do not block the operation.

Because of this rule there is no delivery cascade: cancel and delete never mutate live delivery records.

### Delete rules

When eligibility is met, show a confirmation modal that:

- Names the order by its `humanReadableId` and store.
- When payment records exist, states that those payments will be removed together with the order.

On confirm, the mutation executes atomically inside a single `prisma.$transaction`:

1. Re-validate the shared eligibility rule.
2. Delete all `OrderPayment` records for this order.
3. Delete any residual `DeliveryOrderItem` rows that point to cancelled deliveries for this order's items.
4. Delete `OrderHistory` entries for this order.
5. Delete `OrderItem` rows for this order.
6. Delete the `Order` row.

### Cancel rules

When eligibility is met, show the same context-aware confirmation modal adapted for cancellation wording. The collector is informed that existing payment records for the order will be removed.

On confirm, the mutation executes atomically inside a single `prisma.$transaction`:

1. Re-validate the shared eligibility rule.
2. Delete all `OrderPayment` records for this order.
3. Update `Order.status` to `CANCELLED`.
4. Append an `ORDER_CANCELLED` history entry.

`OrderItem`, `OrderHistory`, and links to already-cancelled deliveries are preserved so the cancelled order keeps its historical record intact.

### Reactivation

A `CANCELLED` order may be returned to `OPEN` without preconditions via `reactivateOrder`. The mutation executes atomically:

1. Update `Order.status` to `OPEN`.
2. Append an `ORDER_REACTIVATED` history entry.

Payment records removed during cancellation are not restored. Existing history entries (including `ORDER_CANCELLED`) are preserved so the lifecycle remains auditable.

## Module Structure

| Path                                           | Responsibility                                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/lib/data/orders/orderQueries.ts`          | Read operations: get by id, list with filters                                                         |
| `src/lib/data/orders/orderMutations.ts`        | Create, edit, cancel, reactivate, delete (delete and cancel share the eligibility rule defined above) |
| `src/lib/data/orders/orderPaymentMutations.ts` | Add and delete payments                                                                               |
| `src/lib/data/orders/orderHistoryMutations.ts` | Append history entries                                                                                |
| `src/lib/orders/orderIdentifier.ts`            | Identifier generation helper                                                                          |
| `src/lib/orders/orderValidation.ts`            | Zod schemas for create, edit, cancel, delete                                                          |

All query and mutation functions accept `userId` as an explicit parameter and scope every database operation to that user.

## Security Notes

- All query operations filter by `userId` at the data layer; no cross-user data access is possible through a missing predicate.
- Server actions validate the session before passing `userId` to data functions.
- `currencyCode` is validated against the permitted allowlist at the Zod boundary before any database write.
- `humanReadableId` is generated server-side and never accepted as user input.
- `userId` on `OrderPayment` and `OrderHistory` enables authorization checks without a join to `Order` on every payment delete or history append.

## Technical Notes

- `orderDate` is user-provided and distinct from `createdAt`, which Prisma sets automatically.
- `exchangeRate` is required only when `currencyCode` differs from the user's `baseCurrencyCode`. This validation lives in the Zod schema, not at the database level.
- The delete-eligibility check (no `DELIVERED` deliveries) must be performed inside the same transaction as the delete mutation to prevent TOCTOU races.

## Assumptions

- The `Delivery` model will carry a `status` field that includes a `DELIVERED` state, defined in [`FRD-08`](../../../../frd-08-delivery-management/frd-08-delivery-management.md). The delete and cancel rules in this WO depend on that field being queryable at mutation time.
- The `DeliveryOrderItem` join table already present in the schema is the authoritative link between deliveries and order items. Cascade logic operates on this table.
- Currency i18n keys follow the existing pattern `currencies.{code}` already used in user settings locale files.

## E2E Acceptance Tests

- New orders receive a stable human-readable identifier in `ORD-YYYYMMDD-NN` format.
- Two orders created by the same user on the same date receive consecutive identifiers.
- Two orders created by different users on the same date may share the same `NN` without conflict.
- The order form defaults `currencyCode` to the user's saved `baseCurrencyCode` when set.
- Attempting to delete an order with a delivered delivery is blocked with a clear error.
- Deleting an order with payments or in-transit deliveries shows a confirmation modal before proceeding.
- Cancelling an order removes its payment records and sets its status to `CANCELLED`.
- A cancelled order can be returned to `OPEN`; payment records and deliveries are not restored.
- Deleting an order that is the sole source of a delivery's items removes the delivery entirely.
- Deleting an order that shares a delivery with another order removes only the link; the delivery remains.

## Unit Tests (Identifier Generator)

- First order of the day for a user → sequence is `01`
- Second order of the same day for the same user → sequence is `02`
- First order of a new calendar day → sequence resets to `01`
- Date segment uses UTC and is unaffected by server timezone
- Concurrent create calls for the same user and day do not produce duplicate identifiers (integration test with a real transaction)

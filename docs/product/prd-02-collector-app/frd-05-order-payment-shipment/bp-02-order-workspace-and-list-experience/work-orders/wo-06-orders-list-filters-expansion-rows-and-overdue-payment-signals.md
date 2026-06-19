---
id: WO-06
type: WORK_ORDER
slug: orders-list-filters-expansion-rows-and-overdue-payment-signals
title: Orders List, Filters, Expansion Rows, and Overdue Payment Signals
status: ACTIVE
parent: BP-02
source_features:
  - FEAT-0014
last_updated: 2026-06-16
implementation_status: IMPLEMENTED
---

# WO-06 Orders List, Filters, Expansion Rows, and Overdue Payment Signals

## Summary

Build the orders workspace list at `/orders`: a paginated, URL-backed list of order cards with a filter sidebar, removable filter chips, a default active-orders view, expandable cards that reveal associated items, an overdue-delivery warning signal, and a payment-progress summary per card. This slice replaces the current placeholder page and becomes the collector's primary entry point for reviewing and acting on their order history.

## Prerequisites

This work order depends on the following slices being fully implemented before implementation begins:

- **FRD-05 · BP-01 · [WO-01](../../bp-01-order-domain-foundation/work-orders/wo-01-currency-catalog-order-identifiers-and-persistence-contracts.md)** — Prisma schema for `Order`, `OrderStatus`, `OrderHistory`, and the module layout under `src/lib/data/orders/`.
- **FRD-05 · BP-01 · [WO-02](../../bp-01-order-domain-foundation/work-orders/wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md)** — `OrderItem` schema and `deliveryState` derivation per item.
- **FRD-05 · BP-01 · [WO-03](../../bp-01-order-domain-foundation/work-orders/wo-03-order-payments-balances-and-payment-mutation-rules.md)** — `OrderPayment` schema and `calculatePaymentSummary` for the aggregated paid amount used in the card.
- **FRD-05 · BP-02 · [WO-04](./wo-04-order-create-and-edit-form-with-spreadsheet-style-item-entry.md)** — Create route `/orders/new` so the empty-state CTA has a target.

WO-06 does not introduce any Prisma migration. It adds `getOrdersList` to the existing `orderQueries.ts` module and a `parseOrderListingParams` utility parallel to the Stores listing pattern.

## In Scope

- Paginated orders list route at `/orders`, replacing the current placeholder
- Filter sidebar (drawer, same pattern as Stores) with date range, store, product type, status, and free-text product-name filters
- URL-backed filter state: `?q`, `?productType`, `?status`, `?store`, `?dateFrom`, `?dateTo`, `?sort`, `?page`
- User-facing sort control with five options (`recent`, `oldest`, `store-asc`, `payment-asc`, `total-desc`), default `recent` (`FR-05-28`)
- Default active-orders filter when no URL params are present
- Grouped `Solo activas` chip when the URL status set matches the default active set exactly
- Removable filter chips for all active filters
- `Restablecer` button to reset to the default active view
- Order cards showing store name, order date, status badge, expected delivery range, total cost, and payment progress
- `Atrasada` overdue warning chip and highlighted delivery range
- `Impago` pill for `COMPLETED` orders with pending payment
- Expandable cards revealing associated items (name, quantity, delivery state badge)
- Empty states for no orders and for no results matching active filters
- Pagination with `?page=` and `pageSize = 30` (`ORDER_LIST_PAGE_SIZE`)
- Back navigation from detail to list preserving filter state via `?returnTo=`
- `isOrderOverdue` pure helper with unit tests
- PostHog analytics events
- Spanish and English localization

## Out of Scope

- Order create and edit form ([WO-04](./wo-04-order-create-and-edit-form-with-spreadsheet-style-item-entry.md))
- Order detail view ([WO-05](./wo-05-order-detail-view-private-note-payments-panel-and-action-menu.md))
- Delivery allocation screens ([FRD-08](../../../frd-08-delivery-management/frd-08-delivery-management.md))
- Dashboard rollups ([FRD-06](../../../frd-06-dashboard-reminders/frd-06-dashboard-reminders.md))
- `Needs currency update` filter and bulk FX reconciliation (`FR-05-36` through `FR-05-38`) — planned as future `WO-07` under `BP-02` once FRD-07 base-currency settings are complete
- Rate limiting
- Prisma migrations

## Requirements

- `FR-05-26` through `FR-05-31`
- `FR-05-35`
- `BR-05-12`

## Blueprints

- [BP-02](../bp-02-order-workspace-and-list-experience.md) list filter contract
- [BP-02](../bp-02-order-workspace-and-list-experience.md) expandable-card decision
- [BP-02](../bp-02-order-workspace-and-list-experience.md) default active-orders filter decision
- [BP-02](../bp-02-order-workspace-and-list-experience.md) `returnTo` back-navigation contract

## Route

| Route              | File                                     | Purpose                               |
| ------------------ | ---------------------------------------- | ------------------------------------- |
| `/[locale]/orders` | `src/app/[locale]/(app)/orders/page.tsx` | Server-rendered paginated orders list |

The existing `page.tsx` currently renders `AppPlaceholderPage` and is replaced entirely by this slice.

## Module Structure

Placement must be validated against `.agents/rules/project-structure.mdc` and `.agents/rules/react-next-components.mdc` at implementation time.

```
src/app/[locale]/(app)/orders/
  page.tsx                        Server — resolves session userId, parses URL params,
                                            applies default filter, fetches paginated list
  _components/
    OrderListContent.tsx          Server — page hero, filter chips, paginated list or empty state
    OrderCard.tsx                 Client — collapsed card + expand toggle + items render
    OrderListFilters.tsx          Client — filter drawer (same drawer pattern as Stores)
    OrderListFilterChips.tsx      Client — active chips + Restablecer button
    OrderListEmptyState.tsx       Server — no orders / no results variants
  _utils/
    orderListingParams.ts         parseOrderListingParams, DEFAULT_ACTIVE_STATUSES
```

`getOrdersList` is added to `src/lib/data/orders/orderQueries.ts` (owned by WO-01).

`isOrderOverdue` is added to `src/lib/orders/orderDerivedState.ts`.

## Default Filter Behavior

When the collector navigates to `/orders` with no `?status=` params — including first-time access and navigation from the sidebar or any app-internal link — the page applies the active-orders default:

```ts
export const DEFAULT_ACTIVE_STATUSES: OrderStatus[] = [
  "OPEN",
  "PARTIALLY_IN_TRANSIT",
  "IN_TRANSIT",
  "PARTIALLY_DELIVERED",
];
```

`parseOrderListingParams` returns `statuses: DEFAULT_ACTIVE_STATUSES` when no `status` param is present, so the default applies transparently to the query without a server redirect. The URL is made canonical on the client via `router.replace` on mount when the resolved filter state differs from what the URL shows, so shared or bookmarked URLs always reflect the active filter.

`Restablecer` navigates to `/orders` with no params, which re-applies the default on the next render.

## UX Notes

### Page header

`AppPageHero` with no `BackNavLink` (orders is a root-level workspace):

- Title (ES): "Órdenes" · (EN): "Orders"
- Primary action: `Button` → `/orders/new` · (ES): "Nuevo pedido" · (EN): "New order"

### Filter sidebar

Same drawer pattern as the Stores listing (`src/app/[locale]/(app)/stores/_components/StoreListingFilters.tsx`):

- Trigger button positioned above the chip row
- Filters: date range (from / to single date pickers), store (searchable select), product type (multi-select chips), status (multi-select chips exposing all six order states), free-text product name
- `Aplicar filtros` / `Apply filters` updates the URL with all selected values
- `Restablecer` / `Reset` inside the sidebar clears all sidebar selections and navigates to the canonical default active-orders URL with the four explicit `status` params

Status filter option labels use the Spanish display names defined in **FRD-05 · BP-01 · [WO-02](../../bp-01-order-domain-foundation/work-orders/wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md)**. All six states are selectable: `OPEN`, `PARTIALLY_IN_TRANSIT`, `IN_TRANSIT`, `PARTIALLY_DELIVERED`, `COMPLETED`, `CANCELLED`.

### Filter chips

- When the URL contains exactly the four `DEFAULT_ACTIVE_STATUSES`: render one grouped chip `Solo activas` / `Active only`
- When the URL contains any other status combination: render individual status chips, one per selected status
- All other active filters (store, product type, date range, text query) render as individual removable chips
- Removing the `Solo activas` chip removes all `?status=` params from the URL; other filters remain active; orders of all statuses are shown
- Removing an individual filter chip removes only that param from the URL
- `Restablecer` / `Reset` appears as a secondary action alongside the chips only when at least one non-default filter is active; the grouped `Solo activas` default chip alone does not show `Restablecer`
- Opening the filter sidebar while `Solo activas` is applied shows the four active-status options checked inside the status group

### Order card — collapsed

Each card in the list renders the following sections:

**Header row:** store name (primary emphasis) · order date (secondary, formatted per locale)

**Meta row:** item count (e.g. "3 items") · total cost formatted in order currency · payment progress percentage (e.g. "75% pagado" / "75% paid")

**Payment bar:** thin progress bar from 0% to 100% using theme-aware semantic tokens

**Status row:** `OrderStatusBadge` · `Impago` / `Unpaid` pill when `status === "COMPLETED"` and `hasUnpaidBalance === true` (`FR-05-35`) · `Atrasada` / `Overdue` warning chip when `isOrderOverdue` returns `true`

**Delivery row:** expected delivery range formatted per locale; when overdue the range text renders in warning color

**Expand trigger:** chevron icon on the trailing edge of the card; toggles the expanded items section

The `humanReadableId` is not shown on the list card; it appears only in the order detail view (WO-05).

**Desktop (≥ md):** horizontal card with store name, date, and meta on the left; status badges and delivery range on the right.

**Mobile (< md):** single-column vertical stack in the order above.

### Order card — expanded

On expand, a section below the collapsed content reveals the order items:

```
[item name]  ×  [quantity]   [delivery state badge]
[item name]  ×  [quantity]   [delivery state badge]
```

Items render in `position ASC` order. Delivery state chips (`orderItemDeliveryChip.tsx`) use four states and localized labels:

- `open` → "Pendiente" / "Pending"
- `arrived_at_store` → "Listo en tienda" / "Ready at store"
- `in_transit` → "En tránsito" / "In transit"
- `delivered` → "Entregado" / "Delivered"

Individual payment records are not shown in the expanded card. The payment percentage and progress bar on the collapsed card are the list-level financial summary; full payment detail is available in the order detail view (WO-05).

Multiple cards may be expanded simultaneously.

### Overdue signal

**Condition:** `isOrderOverdue(order, today)` returns `true` when `expectedDeliveryTo !== null AND expectedDeliveryTo < today AND status NOT IN ("COMPLETED", "CANCELLED")`.

**Visual:** `Atrasada` / `Overdue` chip with `warning` semantic token color in the status row, plus the expected delivery range text rendered in warning color in the delivery row.

### Empty states

**No orders (user has no orders at all):**

- Icon: `ShoppingBag` from lucide-react
- Title (ES): "Todavía no tienes pedidos" · (EN): "You have no orders yet"
- Body (ES): "Registra tu primer pedido y lleva el control de tus pagos y entregas desde un solo lugar."
- Body (EN): "Record your first order and keep track of your orders, payments, and deliveries in one place."
- CTA (ES): "Nuevo pedido" · (EN): "New order" → `/orders/new`

**No results matching active filters:**

- Icon: `SearchX` from lucide-react
- Title (ES): "No encontramos pedidos con esos filtros" · (EN): "No orders match those filters"
- Action: `Restablecer` / `Reset` button → `/orders`

### Back navigation from detail

When rendering order card links, pass the current full list URL (including all active filter params and `?page=`) as a `?returnTo=` query param encoded on the detail link:

```
/orders/[id]?returnTo={encodeURIComponent(currentListUrl)}
```

The order detail page (WO-05) reads `searchParams.returnTo` and uses it as the `BackNavLink` href, falling back to `/orders` when absent. The `returnTo` value is validated to be a relative path before use to prevent open redirect from a crafted URL.

## Technical Notes

### `getOrdersList` query shape

Added to `src/lib/data/orders/orderQueries.ts`:

```ts
interface OrderListFilters {
  nameQuery?: string;
  productTypeKeys?: string[];
  storeId?: string;
  statuses?: OrderStatus[];
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
}

interface OrderListItem {
  id: string;
  orderDate: Date;
  expectedDeliveryFrom: Date | null;
  expectedDeliveryTo: Date | null;
  currencyCode: string;
  totalCost: number; // Int — minor units
  status: OrderStatus;
  store: { id: string; name: string; slug: string };
  itemCount: number;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    deliveryState: "open" | "arrived_at_store" | "in_transit" | "delivered";
  }>;
  paidAmount: number; // Int — sum of OrderPayment.amount for this order
  paymentPercentage: number; // derived: Math.round((paidAmount / totalCost) * 100)
  hasUnpaidBalance: boolean; // paidAmount < totalCost
}

interface OrderListResult {
  orders: OrderListItem[];
  totalCount: number;
  page: number;
  pageSize: number; // 30
}
```

`paidAmount` is computed by including all `OrderPayment` records for each order and summing their `amount` fields in TypeScript within the query module. `paymentPercentage` and `hasUnpaidBalance` are derived in the query module, not in the component.

Items are ordered by `position ASC`. All order and item data is fetched for the current page only — no lazy loading on expand.

`totalCount` is fetched via `prisma.order.count` with the same filter conditions, using `Promise.all` alongside the main query.

### `parseOrderListingParams`

Added to `src/app/[locale]/(app)/orders/_utils/orderListingParams.ts`, mirroring the Stores pattern in `src/app/[locale]/(app)/stores/_utils/listingParams.ts`:

```ts
export const DEFAULT_ACTIVE_STATUSES: OrderStatus[] = [
  "OPEN",
  "PARTIALLY_IN_TRANSIT",
  "IN_TRANSIT",
  "PARTIALLY_DELIVERED",
];

export function parseOrderListingParams(
  raw: Record<string, string | string[] | undefined>,
): OrderListFilters { ... }
```

When no `?status=` param is present, `parseOrderListingParams` returns `statuses: DEFAULT_ACTIVE_STATUSES`. Invalid `OrderStatus` enum values in the URL are silently dropped to prevent query errors.

### `Solo activas` chip detection

`OrderListFilterChips` detects the grouped chip state by comparing the resolved `statuses` array to `DEFAULT_ACTIVE_STATUSES`:

```ts
const isDefaultActiveSet =
  statuses.length === DEFAULT_ACTIVE_STATUSES.length && DEFAULT_ACTIVE_STATUSES.every((s) => statuses.includes(s));
```

When `isDefaultActiveSet` is `true`, render `Solo activas` / `Active only` as a single chip. Any other combination renders individual status chips.

### `isOrderOverdue`

Added to `src/lib/orders/orderDerivedState.ts`:

```ts
export function isOrderOverdue(order: { expectedDeliveryTo: Date | null; status: OrderStatus }, today: Date): boolean {
  if (!order.expectedDeliveryTo) return false;
  if (order.status === "COMPLETED" || order.status === "CANCELLED") return false;
  return order.expectedDeliveryTo < today;
}
```

`today` is passed as a `Date` prop from the server component to `OrderCard` to avoid hydration mismatches between server and client render times.

### Pagination

`pageSize = 30` (`ORDER_LIST_PAGE_SIZE`). Prisma query uses `skip = (page - 1) * pageSize` and `take = pageSize`. Invalid or missing `?page=` values default to `1`.

### Order sort

The orders list exposes a **user-facing sort control** (`FR-05-28`), backed by a `?sort` URL param. `ORDER_LIST_SORT_VALUES` (in `src/lib/orders/orderListSort.ts`) defines the five available sorts: `recent`, `oldest`, `store-asc`, `payment-asc`, and `total-desc`. The default is `recent` (`DEFAULT_ORDER_LIST_SORT`), for which `resolveOrderBy` returns `{ orderDate: "desc" }` (most recent first). `parseOrderListingParams` validates the `?sort` value against `ORDER_LIST_SORT_VALUES` and falls back to `recent` when absent or invalid; the default value is omitted from the canonical URL.

### Monetary formatting

Minor-unit values (`totalCost`, `paidAmount`) are formatted for display using the existing money helpers from WO-01. No new formatting utilities are introduced.

## Security Notes

- `page.tsx` resolves `userId` from the active session only. `getOrdersList` is always called with the scoped `userId`.
- All filter params are parsed and validated by `parseOrderListingParams` before reaching the query; invalid enum values are dropped silently.
- The `storeId` filter is applied as an additional `where` condition scoped to `userId` to prevent cross-user store enumeration through the filter.
- `returnTo` values are URL-decoded and validated to be relative paths before use in `BackNavLink` to prevent open redirect from a crafted URL.

## Observability

- Unexpected errors in `getOrdersList` or the server component are captured with Sentry.
- Expected empty results (no orders, no filter matches) are not reported to Sentry.

## Analytics

All event names are added to `POSTHOG_EVENTS` in `src/lib/constants.ts`.

| Event constant                    | When it fires                          |
| --------------------------------- | -------------------------------------- |
| `orders_list_filtered`            | User applies filters from the sidebar  |
| `orders_list_filter_chip_removed` | User removes an individual filter chip |
| `orders_list_filters_reset`       | User clicks `Restablecer`              |
| `orders_list_card_expanded`       | User expands an order card             |
| `orders_list_card_collapsed`      | User collapses an order card           |
| `orders_list_page_changed`        | User navigates to a different page     |

## Assumptions

- WO-05 (`getOrderDetail` and `BackNavLink`) is extended to read `searchParams.returnTo` and use it for the back link href; this is a small addition to WO-05 and does not require a separate work order.
- `deliveryState` per item is already derivable from the data loaded by WO-02 without additional joins.
- `OrderCard` receives `today` as a `Date` prop from the server component to keep `isOrderOverdue` comparisons consistent between server and client.
- The filter drawer reuses the visual template from `StoreListingFilters` but is not extracted to a shared abstraction; if a third consumer appears, extract then.
- Monetary display reuses existing money-format helpers from WO-01.

## Unit Tests

### `isOrderOverdue`

| Scenario                      | `expectedDeliveryTo` | `status`    | `today` | Expected |
| ----------------------------- | -------------------- | ----------- | ------- | -------- |
| No delivery range set         | `null`               | `OPEN`      | any     | `false`  |
| Delivery date in the future   | tomorrow             | `OPEN`      | today   | `false`  |
| Delivery date exactly today   | today                | `OPEN`      | today   | `false`  |
| Delivery date yesterday       | yesterday            | `OPEN`      | today   | `true`   |
| Delivery yesterday, COMPLETED | yesterday            | `COMPLETED` | today   | `false`  |
| Delivery yesterday, CANCELLED | yesterday            | `CANCELLED` | today   | `false`  |

### `parseOrderListingParams` — default application

| Scenario                | Input                               | Expected `statuses`       |
| ----------------------- | ----------------------------------- | ------------------------- |
| No status param present | `{}`                                | `DEFAULT_ACTIVE_STATUSES` |
| Single valid status     | `{ status: "OPEN" }`                | `["OPEN"]`                |
| Invalid status value    | `{ status: "FAKE" }`                | `[]`                      |
| Multiple statuses       | `{ status: ["OPEN", "CANCELLED"] }` | `["OPEN", "CANCELLED"]`   |

### `Solo activas` chip detection

| Scenario                            | `statuses`                                                              | Expected chip            |
| ----------------------------------- | ----------------------------------------------------------------------- | ------------------------ |
| Exactly the four default statuses   | `["OPEN", "PARTIALLY_IN_TRANSIT", "IN_TRANSIT", "PARTIALLY_DELIVERED"]` | `Solo activas` (grouped) |
| Superset — default plus `COMPLETED` | default + `"COMPLETED"`                                                 | Individual chips         |
| Subset — default minus one          | `["OPEN", "IN_TRANSIT", "PARTIALLY_IN_TRANSIT"]`                        | Individual chips         |
| Empty — no status filter            | `[]`                                                                    | No status chip           |

## E2E Acceptance Tests

### Default filter

- Navigating to `/orders` with no params redirects to the canonical orders-list URL with `status=OPEN`, `status=PARTIALLY_IN_TRANSIT`, `status=IN_TRANSIT`, and `status=PARTIALLY_DELIVERED`. Orders in `COMPLETED` and `CANCELLED` are not visible.
- The `Solo activas` chip is visible; no individual status chips appear.
- The URL remains explicit about the active statuses in the default view.

### Filter sidebar

- Opening the filter sidebar shows all six status options, store select, product type, date range, and free-text name field.
- When the default `Solo activas` view is active, the four active-status options are already checked in the sidebar.
- Selecting specific statuses and applying replaces the `Solo activas` chip with individual status chips in the URL and in the chip row.
- Applying a store filter adds a chip with the store name label.
- Applying a date range adds `Desde` and `Hasta` chips.
- Applying a free-text query adds a search chip with the query value.

### Filter chips

- Removing the `Solo activas` chip clears `?status=` from the URL; orders of all statuses appear; other active filters are preserved.
- Removing an individual filter chip removes only that filter from the URL.
- Clicking `Restablecer` navigates to `/orders` and the list reverts to the default active-orders view.
- When the chip row only contains the grouped `Solo activas` default chip, `Restablecer` is hidden because there is no additional filter state to clear.

### Card — collapsed

- Each card shows store name, order date, item count, total cost, payment percentage, progress bar, status badge, and expected delivery range.
- An order with `status === "COMPLETED"` and unpaid balance shows the `Impago` pill next to the status badge.

### Card — overdue

- An order whose `expectedDeliveryTo` is in the past and whose status is not `COMPLETED` or `CANCELLED` shows the `Atrasada` chip and the delivery range text in warning color.
- An order in `COMPLETED` does not show `Atrasada` regardless of its delivery date.

### Card — expand

- Clicking the chevron expands the card and shows the list of items with name, quantity, and delivery state badge.
- Clicking the chevron again collapses the card.
- Multiple cards can be expanded simultaneously without affecting each other.

### Empty states

- A user with no orders sees the `ShoppingBag` empty state with "Todavía no tienes pedidos" and a "Nuevo pedido" CTA.
- A user with orders but active filters that match nothing sees the `SearchX` empty state with a `Restablecer` button.

### Pagination

- A user with more than 30 orders sees pagination controls. Navigating to page 2 updates `?page=2` in the URL and shows the next 30 orders.
- Direct URL access to `?page=2` with active filters renders the correct page and preserves the filter chips.

### Back navigation

- Navigating from a filtered list to an order card and using the detail page back link returns to the list with the same filters and page active.
- Navigating directly to the detail page URL (no `?returnTo=`) shows `/orders` as the back link destination.

### Status filter — all six states

- The status filter in the sidebar exposes all six order states as selectable options: `OPEN`, `PARTIALLY_IN_TRANSIT`, `IN_TRANSIT`, `PARTIALLY_DELIVERED`, `COMPLETED`, `CANCELLED`.
- Selecting `CANCELLED` shows cancelled orders in the list.

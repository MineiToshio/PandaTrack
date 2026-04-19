---
id: WO-04
type: WORK_ORDER
slug: order-create-and-edit-form-with-spreadsheet-style-item-entry
title: Order Create and Edit Form With Spreadsheet-Style Item Entry
status: ACTIVE
parent: BP-02
source_features:
  - FEAT-0014
last_updated: 2026-04-19
implementation_status: PLANNED
---

# WO-04 Order Create and Edit Form With Spreadsheet-Style Item Entry

## Summary

Build the order create and edit experience: a single-page form starting with a searchable store selector, followed by date and currency fields, a spreadsheet-style item entry grid, and a total-cost input with discrepancy confirmation. Covers create route, edit route, empty state when no stores exist in the system, store-creation redirect flow, keyboard-friendly item rows, drag-and-drop reorder, exchange-rate conditional field, and a non-blocking base-currency info banner.

## Prerequisites

This work order depends on the following slices being fully implemented before implementation begins:

- **FRD-05 · BP-01 · [WO-01](../../bp-01-order-domain-foundation/work-orders/wo-01-currency-catalog-order-identifiers-and-persistence-contracts.md)** — Prisma schema for `Order`, `OrderStatus`, `OrderHistory`, validation schemas in `src/lib/orders/orderValidation.ts`, and data modules in `src/lib/data/orders/`
- **FRD-05 · BP-01 · [WO-02](../../bp-01-order-domain-foundation/work-orders/wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md)** — Prisma schema for `OrderItem`, `position` field, discrepancy modal rules, `deriveOrderStatus`, and item validation extensions

WO-04 does not include any Prisma migration. It consumes the modules and schemas defined in WO-01 and WO-02.

## In Scope

- Create route at `purchases/new`
- Edit route at `purchases/[id]/edit`
- Searchable store selector with store-creation redirect path
- Empty state when no stores exist in the system
- Order date defaulting to current date
- Expected delivery date range picker (optional)
- Currency select with base-currency default
- Exchange-rate field (conditional: only when order currency differs from base currency)
- Non-blocking info banner when user has no base currency configured
- Spreadsheet-style item rows: name, quantity, unit price (optional), product type (optional)
- Drag-and-drop item reorder with keyboard accessibility
- Total-cost entry and discrepancy modal (three-way decision)
- Redirect to order detail after successful save
- Discard-changes confirmation in edit mode
- PostHog analytics events

## Out of Scope

- Private note field (inline-editable in detail view — WO-05)
- Order list filters (WO-06)
- Detail-view action menu (WO-05)
- Delivery allocation flows (FRD-08)
- Prisma migration (WO-01, WO-02)
- Rate limiting

## Requirements

- `FR-05-04` through `FR-05-16`
- `FR-05-23`
- `BR-05-04` through `BR-05-07`
- `BR-05-11`

## Package Dependencies

Two new packages must be added before implementation begins:

| Package | Purpose |
|---------|---------|
| `@dnd-kit/core` | Drag-and-drop sensor and context provider |
| `@dnd-kit/sortable` | Sortable list preset for item rows |
| `react-day-picker` | Single date picker and date range picker |

## Routes

| Route | File | Purpose |
|-------|------|---------|
| `/[locale]/purchases/new` | `src/app/[locale]/(app)/purchases/new/page.tsx` | Create order |
| `/[locale]/purchases/[id]/edit` | `src/app/[locale]/(app)/purchases/[id]/edit/page.tsx` | Edit order |

Shared components between create and edit live in `src/app/[locale]/(app)/purchases/_components/share/`.

Server actions live in `src/app/[locale]/(app)/purchases/_actions/orderActions.ts` and call into `src/lib/data/orders/orderMutations.ts`.

## Form Field Order

The form is a single page. Fields appear in this order:

1. **Store** — searchable select (required); placed first so the collector discovers a missing store before filling any other data
2. **Order date** — single date picker; defaults to current date (required)
3. **Expected delivery range** — date range picker; both bounds optional
4. **Currency** — required select; defaults to `user.baseCurrencyCode` when set
5. **Exchange rate** — conditional; only visible when `currencyCode !== user.baseCurrencyCode` and `baseCurrencyCode` is not null
6. **Items** — spreadsheet grid; at least one row required
7. **Total cost** — required monetary input

The private note field is not part of this form. It is inline-editable from the order detail view (WO-05).

## UX Notes

### Store selector

- Uses the existing `SearchSelect` core component (`src/components/core/SearchSelect.tsx`)
- All stores are loaded server-side at page render and passed as props; `SearchSelect` filters locally (sufficient for MVP volume)
- A **"+ Create store"** option always appears at the bottom of the dropdown list
- When the search input has text and no results match, the option reads **"+ Create [typed name]"**
- Both options redirect to `/stores/new?returnTo=order-create`; the typed-name variant also appends `&name={value}` to prefill the store name field
- After the store is created, the store creation flow redirects to `/purchases/new?store={id}`, which preselects the new store in the selector

### Empty state (no stores in the system)

When the store list is empty, hide the form body and render a centered empty state:

- Icon: `Store` from `lucide-react`
- Title (ES): **"Primero, agrega una tienda"**
- Title (EN): **"Start with a store"**
- Body (ES): *"Para crear una orden necesitas al menos una tienda registrada. Agrega la primera y vuelve aquí cuando estés listo."*
- Body (EN): *"To create an order, you'll need at least one store on record. Add your first one and come back when you're ready."*
- CTA (ES): **"Crear tienda"** → `/stores/new`
- CTA (EN): **"Create store"** → `/stores/new`

### Date fields

- `orderDate`: single date picker. Defaults to today. Required.
- `expectedDeliveryFrom` / `expectedDeliveryTo`: range mode on the same `react-day-picker` calendar. Both bounds optional.
  - Single click: sets `from = to = selected day`
  - Two-click range: sets `from` and `to` independently
  - Valid states: both empty · both same · `from < to`. Setting `to` without `from` is invalid.

### Currency and exchange rate

- Currency select defaults to `user.baseCurrencyCode` when set; empty and required when not set
- Exchange rate field is hidden when `currencyCode === user.baseCurrencyCode` or when `baseCurrencyCode` is null
- Exchange rate appears dynamically when `currencyCode !== user.baseCurrencyCode` and `baseCurrencyCode` is set
- Helper text on exchange rate field identifies the conversion direction (e.g., "USD → PEN")

### Base currency not configured

When `user.baseCurrencyCode` is null, render a non-blocking `info` banner inside the currency section:

- Visual treatment: `info` variant (`bg-info/12 border border-info/35 rounded-xl`)
- Icon: `Info` from `lucide-react`
- Copy (ES): *"¿Compras en varias monedas? Configura tu moneda base y PandaTrack convertirá automáticamente cada orden para que puedas ver tu presupuesto en un solo lugar."* Link: **"Configurar ahora →"** → `/settings`
- Copy (EN): *"Buying in multiple currencies? Set your base currency and PandaTrack will automatically convert each order so you can see your full budget in one place."* Link: **"Set it up now →"** → `/settings`
- The banner does not block saving. Orders created without a base currency will surface in the `Needs currency update` filter (`FR-05-36`) once the user later configures their base currency in Preferences.

### Item spreadsheet

**Desktop (≥ md):** horizontal grid with columns `[drag handle | name (flex) | quantity (80 px) | unit price (120 px) | product type (150 px) | delete]`

**Mobile (< md):** each item row collapses to a single-column vertical stack: name → quantity → unit price → product type. The delete button moves to the top-right of the item block. The drag handle remains visible.

**Drag-and-drop:**

- Library: `@dnd-kit/sortable` with `MouseSensor` (desktop) and `TouchSensor` (mobile)
- TouchSensor activation constraint: `delay: 250ms, tolerance: 5px` to avoid conflict with page scroll
- Desktop: drag handle icon visible only on hover (`opacity-0 group-hover:opacity-100`)
- Mobile: drag handle always visible at `opacity-30` at rest, `opacity-100` when the row is being dragged or is active
- Long-press on the row activates drag on touch devices

**Keyboard navigation:** Tab from the last cell of the last row adds a new empty row (per WO-02).

**Row minimum:** at least one item row is required before saving.

**Product type select:** shows the full global `StoreProductType` catalog. Not filtered by the order's store assignment. Field is optional.

**Validation timing:** `name` and `quantity` validate on blur; `unitPrice` and `productTypeKey` validate at save time (per WO-02).

### Discrepancy modal

Appears only when every item has a non-null `unitPrice` AND `itemizedTotal !== totalCost`. Three options: keep entered total · use calculated total · go back without saving. Copy and i18n keys follow the WO-02 spec (`orders.discrepancyModal.*`).

### Post-save redirect

- Create: redirect to `/purchases/[id]` + success toast "Orden creada" / "Order created"
- Edit: redirect to `/purchases/[id]` + success toast "Orden guardada" / "Order saved"

### Discard changes (edit mode only)

When the user navigates away from edit with unsaved changes, show a confirmation before leaving:

- Message (ES): *"¿Salir sin guardar? Los cambios que hiciste no se guardarán."*
- Message (EN): *"Leave without saving? Changes you made will not be saved."*
- Confirm: "Salir" / "Leave" · Cancel: "Quedarse" / "Stay"

Does not apply to the create form.

### Page header

Both routes use `BackNavLink` (`appearance="pill"`) in a `space-y-3` stack above `AppPageHero`:

- **Create** — back → `/purchases` · title (ES): "Nueva orden" · title (EN): "New order"
- **Edit** — back → `/purchases/[id]` · title (ES): "Editar orden · [humanReadableId]" · title (EN): "Edit order · [humanReadableId]"

The form body uses `APP_SHELL_FORM_RAIL_CLASSNAME` to keep fields at a comfortable reading width.

## Technical Notes

- All monetary inputs (total cost, unit price) are entered by the user as decimal values (e.g., "25.50") and converted to minor units (× 100) before passing to the data layer. Display paths divide by 100 and format before rendering.
- The `returnTo=order-create` query param is read by the store creation server action to determine the post-create redirect rather than the default store list.
- Store list is fetched in the server component and passed as props to the `SearchSelect` client component — no separate API call needed.
- `@dnd-kit/sortable` `position` normalization (consecutive integers from 1) is applied client-side before sending the save payload; raw client position arrays are not trusted server-side.
- Item add and delete operations during an edit session are pending until the user explicitly saves. Discarding the edit abandons all pending item mutations without applying them.
- Items blocked from deletion (linked to a non-cancelled delivery) show the block modal defined in WO-02 with a navigable delivery identifier link.
- The form uses `useActionState` + Zod + `FormData` (no react-hook-form), consistent with the `CreateStoreForm` pattern.
- `exchangeRate` Zod validation (`z.number().min(0.01).max(99999.99)`) runs only when the exchange rate field is visible.
- `humanReadableId` is generated server-side by WO-01's identifier module and is never part of the form payload.

## Security Notes

- Create and edit server actions validate the active session before reading `userId`.
- All data operations in `orderMutations.ts` scope queries to `userId` (defined in WO-01).
- `currencyCode` is validated against `ALLOWED_COLLECTOR_BASE_CURRENCY_CODES` at the Zod boundary before any database write.
- `position` values from the client payload are normalized server-side; raw position arrays are not trusted.
- Store change eligibility (`BR-05-11`) — blocked unless the order is `OPEN` with no deliveries — is enforced in the Zod schema and re-validated in the server action before the mutation runs.

## Observability

- Unexpected server action failures are captured with Sentry.
- Expected Zod validation failures are not sent to Sentry to avoid noise.

## Analytics

All event names are centralized in `POSTHOG_EVENTS` in `src/lib/constants.ts`.

| Event constant | When it fires |
|---------------|--------------|
| `order_created` | Create server action completes successfully |
| `order_edited` | Edit server action completes successfully |
| `order_create_discarded` | User confirms leaving the create form without saving |
| `order_discrepancy_modal_opened` | Discrepancy modal appears at save time |
| `order_discrepancy_resolved` | User picks one of the three discrepancy options; include property `resolution: "kept_entered" \| "used_calculated" \| "cancelled"` |

## Blueprints

- `BP-02` form contract
- `BP-02` action hierarchy decision
- `BP-02` store-creation redirect pattern

## E2E Acceptance Tests

### Create — happy path

- User opens `/purchases/new` · selects a store · fills required fields · adds items · enters a total cost · saves → order is created and user lands on the detail page with a success toast.
- On create, order date prefills with today's date and currency defaults to the user's base currency when configured.

### Empty state

- User opens `/purchases/new` when no stores exist → sees "Primero, agrega una tienda" copy and "Crear tienda" CTA instead of the form.

### Store-creation redirect

- User searches for a store that does not exist and clicks "＋ Create [name]" → lands on `/stores/new` with the store name prefilled.
- After creating the store, user is redirected to `/purchases/new` with the new store preselected in the selector.

### Exchange rate and currency

- Selecting a currency matching the user's base currency keeps the exchange rate field hidden.
- Selecting a different currency makes the exchange rate field appear with the correct conversion direction label.
- When the user has no base currency configured, the info banner is visible and the exchange rate field does not appear.

### Item spreadsheet — keyboard

- Tabbing from the last cell of the last row adds a new empty row.
- User can add multiple rows and navigate between cells without using the mouse.

### Item spreadsheet — reorder

- User drags an item row to a new position; the reordered list persists after save.

### Item spreadsheet — delete block

- Attempting to delete an item linked to a non-cancelled delivery shows the block modal with a navigable delivery identifier link.

### Discrepancy modal

- When every item has a unit price and the derived total differs from the entered total, the discrepancy modal appears.
- Choosing "Use calculated total" replaces the entered total and saves the order.
- Choosing "Keep entered total" saves with the manually entered total.
- Choosing "Go back" closes the modal without saving.
- When at least one item has no unit price, the modal does not appear regardless of total values.

### Edit and discard

- Edit form opens with all existing order data pre-populated.
- After editing and saving, user lands on the detail page with a success toast.
- Navigating away from edit with unsaved changes shows the discard confirmation.
- Confirming discard navigates away without saving; cancelling returns to the edit form.

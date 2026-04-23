---
id: WO-04
type: WORK_ORDER
slug: order-create-and-edit-form-with-spreadsheet-style-item-entry
title: Order Create and Edit Form With Spreadsheet-Style Item Entry
status: ACTIVE
parent: BP-02
source_features:
  - FEAT-0014
last_updated: 2026-04-22
implementation_status: IN_PROGRESS
---

# WO-04 Order Create and Edit Form With Spreadsheet-Style Item Entry

## Summary

Build the order create and edit experience: a single-page form starting with a searchable store selector, followed by date and currency fields, a spreadsheet-style item entry grid, and a total-cost input with discrepancy confirmation. Covers create route, edit route, empty state when no stores exist in the system, store-creation redirect flow, settings round-trip when configuring base currency from the form banner, keyboard-friendly item rows, drag-and-drop reorder, exchange-rate conditional field, and a non-blocking base-currency info banner.

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
- Non-blocking info banner when user has no base currency configured, with a settings deep link that preserves return context (`?returnTo=order-create`)
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

| Package             | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `@dnd-kit/core`     | Drag-and-drop sensor and context provider |
| `@dnd-kit/sortable` | Sortable list preset for item rows        |
| `react-day-picker`  | Single date picker and date range picker  |

## Routes

| Route                           | File                                                  | Purpose      |
| ------------------------------- | ----------------------------------------------------- | ------------ |
| `/[locale]/purchases/new`       | `src/app/[locale]/(app)/purchases/new/page.tsx`       | Create order |
| `/[locale]/purchases/[id]/edit` | `src/app/[locale]/(app)/purchases/[id]/edit/page.tsx` | Edit order   |

Shared components between create and edit live in `src/app/[locale]/(app)/purchases/_components/share/`.

Date inputs are promoted to app-wide primitives and live in `src/components/core/`:

- `src/components/core/DatePickerInput.tsx` — single date picker. Exposes `disableFuture?: boolean` (default `false`) to opt into hiding any day after today; the order form passes `disableFuture` for `orderDate`, while the delivery range picker keeps future dates selectable.
- `src/components/core/DateRangePickerInput.tsx` — two-click range picker, domain-agnostic.

Both are thin wrappers around `react-day-picker` and are reusable across features (e.g., future payment-date and shipment-window pickers in FRD-05 BP-01).

Server actions live in `src/app/[locale]/(app)/purchases/_actions/orderActions.ts` and call into `src/lib/data/orders/orderMutations.ts`.

## Form Field Order

The form is a single page. Fields appear in this order:

1. **Store** — searchable select (required); placed first so the collector discovers a missing store before filling any other data. Rendered side-by-side with **Currency** in a two-column row on `sm` and up; stacks on mobile.
2. **Currency** — required select; auto-filled from the selected store's country (see _Currency and exchange rate_ below). Placed next to the store field to make the country-to-currency relationship visually explicit.
3. **Order date** — single date picker; defaults to current date (required)
4. **Expected delivery range** — date range picker; both bounds optional
5. **Exchange rate** — conditional; only visible when `currencyCode !== user.baseCurrencyCode` and `baseCurrencyCode` is not null. Rendered in its own row below the dates so it never pushes the currency field off the store row.
6. **Items** — spreadsheet grid; at least one row required
7. **Total cost** — required monetary input

The private note field is not part of this form. It is inline-editable from the order detail view (WO-05).

## UX Notes

### Store selector

- Uses the existing `SearchSelect` core component (`src/components/core/SearchSelect.tsx`)
- All stores are loaded server-side at page render and passed as props; `SearchSelect` filters locally (sufficient for MVP volume)
- A **"+ Create store"** option always appears at the bottom of the dropdown list
- When the search input has text and no results match, the option reads **"+ Create [typed name]"**
- Both options redirect to `/stores/new?returnTo=order-create` (query value is the shared app constant `RETURN_TO_ORDER_CREATE` in `src/lib/constants.ts`, same as the settings banner — param name matches `AUTH_RETURN_TO_PARAM` / `returnTo`); the typed-name variant also appends `&name={value}` to prefill the store name field
- After the store is created, the store creation flow redirects to `/purchases/new?store={id}`, which preselects the new store in the selector

### Empty state (no stores in the system)

When the store list is empty, hide the form body and render a centered empty state:

- Icon: `Store` from `lucide-react`
- Title (ES): **"Primero, agrega una tienda"**
- Title (EN): **"Start with a store"**
- Body (ES): _"Para crear una orden necesitas al menos una tienda registrada. Agrega la primera y vuelve aquí cuando estés listo."_
- Body (EN): _"To create an order, you'll need at least one store on record. Add your first one and come back when you're ready."_
- CTA (ES): **"Crear tienda"** → `/stores/new`
- CTA (EN): **"Create store"** → `/stores/new`

### Date fields

- `orderDate`: uses `DatePickerInput` from `src/components/core/` with `disableFuture` enabled. Defaults to today. Required.
- `expectedDeliveryFrom` / `expectedDeliveryTo`: uses `DateRangePickerInput` from `src/components/core/`. Both bounds optional; future dates are selectable because deliveries are inherently forward-looking.
  - Single click: sets `from = to = selected day`
  - Two-click range: sets `from` and `to` independently
  - Valid states: both empty · both same · `from < to`. Setting `to` without `from` is invalid.
- Both pickers render their `react-day-picker` calendar inside a popover with a custom `CalendarChevron` (lucide icons, `strokeWidth={2.5}`) and prev/next controls styled as `bg-surface → hover:bg-primary` chips so the navigation reads clearly against the popover background in both light and dark themes.

### Currency and exchange rate

- Currency select is placed next to the store selector so the country-to-currency link stays visible while the collector sets up the order.
- **Default resolution order (create mode):**
  1. When a store is already selected (either via `?store={id}` after the store-creation redirect, or chosen by the user), the currency defaults to that store's country primary currency using `PRIMARY_CURRENCY_BY_COUNTRY[store.countryCode]` from `src/lib/catalog/collectorCountries.ts`.
  2. When no store is selected, the currency defaults to `user.baseCurrencyCode` when set.
  3. Otherwise, the currency is empty and remains required.
- **Store change behavior:** every time the user picks a different store (or creates one), the currency field is overwritten with that store's country primary currency. The user can still manually override the currency afterwards for orders placed in a non-default currency (e.g., a US-based store invoicing in EUR).
- **Edit mode:** the saved `currencyCode` of the order is always preserved on load, regardless of the current store's country. It is only overwritten if the user explicitly changes the store within the edit session.
- The hint _"Auto-filled from the store's country. Change it if the order is in a different currency."_ / _"Se autocompleta según el país de la tienda. Cambiala si la orden es en otra moneda."_ sits directly beneath the currency select so the auto-fill behavior is never silent.
- `getUserStores` in `src/lib/data/stores/storeQueries.ts` must return `countryCode` alongside `id` and `name` so the form can compute the default currency client-side without a second round-trip.
- Exchange rate field is hidden when `currencyCode === user.baseCurrencyCode` or when `baseCurrencyCode` is null.
- Exchange rate appears dynamically when `currencyCode !== user.baseCurrencyCode` and `baseCurrencyCode` is set. It renders in its own full-width row below the dates (at half width on `sm` and up) to keep the store/currency row stable as the field toggles on and off.
- Helper text on the exchange rate field identifies the conversion direction (e.g., "USD → PEN").

### Base currency not configured

When `user.baseCurrencyCode` is null, render a non-blocking `info` banner inside the currency section:

- Visual treatment: `info` variant (`bg-info/12 border border-info/35 rounded-xl`)
- Icon: `Info` from `lucide-react`
- Copy (ES): _"¿Compras en varias monedas? Configura tu moneda base y PandaTrack convertirá automáticamente cada orden para que puedas ver tu presupuesto en un solo lugar."_ Link: **"Configurar ahora →"** → `/[locale]/settings?returnTo=order-create` (value must match `RETURN_TO_ORDER_CREATE`; param key is `returnTo` / `AUTH_RETURN_TO_PARAM`).
- Copy (EN): _"Buying in multiple currencies? Set your base currency and PandaTrack will automatically convert each order so you can see your full budget in one place."_ Link: **"Set it up now →"** → same URL shape with `?returnTo=order-create`.
- The banner does not block saving. Orders created without a base currency will surface in the `Needs currency update` filter (`FR-05-36`) once the user later configures their base currency in Preferences.

### Settings round-trip (`returnTo=order-create` from order create)

When the collector opens Settings from the base-currency banner, the URL includes `?returnTo=order-create` so the collector can return to the new-order flow without losing context.

**Settings page** (`src/app/[locale]/(app)/settings/page.tsx`):

- If `searchParams.returnTo === RETURN_TO_ORDER_CREATE`, render a pill **`BackNavLink`** above the page hero (same chrome as the create-order header), linking to `/[locale]/purchases/new`.
- Link label (ES): **"Volver al formulario de nueva orden"** · (EN): **"Back to new order form"** (`settings.returnToOrderCreate`).

**Preferences save** (`SettingsPreferencesSection`):

- When that same `returnTo` value is active, a **successful** "Save preferences" (including after the currency-change confirmation modal) **`router.push`**es to `/[locale]/purchases/new` so the collector lands back on the new-order form after configuring base currency (or other preferences).

This reuses the same `returnTo` contract as the store-creation path; only the post-action destination differs (store create → `/purchases/new?store={id}`; settings save → `/purchases/new`).

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

**Insert between rows (desktop only):** the divider between any two adjacent item rows is itself the hit area for inserting a new row, letting the collector add a new empty row exactly between those two items without scrolling to the footer button.

- The inserter does **not** introduce vertical space between rows. Its wrapper has zero height; the visible hit area is absolutely positioned on top of the border that already separates two rows (`md:border-b`), with a small hit area (≈12 px tall) straddling that border so the pointer can land on it from either row.
- At rest the inserter is invisible. On hover (or keyboard focus), two elements fade in together:
  - A small circular "+" icon (`bg-primary` / `text-primary-foreground`, ~16 px) **pinned to the left**, horizontally aligned with the drag-handle column of the rows (same left offset as `md:px-2`).
  - A horizontal accent line (`bg-primary`, 1 px tall) that spans from the **right edge of the icon** to the end of the row. The line starts flush against the ball — there is no gap between the right edge of the icon and the left edge of the line, and the line never crosses or extends past the left edge of the icon (no "tail" to the left of the ball).
- The entire line is the clickable target: clicking anywhere along the gap — not just on the "+" icon — inserts the new row. The "+" icon is a visual affordance only and is marked `aria-hidden`.
- Clicking inserts a new empty row at that index and focuses the name input of the new row.
- Mobile (< md): the inserter is not rendered. Adding rows on mobile uses the explicit "Agregar artículo" footer button or the Tab-from-last-cell shortcut.
- The inserter is only rendered _between_ existing rows. It is not rendered above the first row or below the last row.
- Keyboard: the inserter button is focusable and activatable with `Enter` / `Space`. `aria-label` uses the i18n key `orders.form.itemInsertBetweenLabel` (_"Insertar artículo aquí"_ / _"Insert item here"_).
- The inserted row is always the same empty row shape produced by `createEmptyRow` (quantity defaults to `1`). Position normalization at save time (WO-02) handles the renumbering; the grid does not need to reshuffle `position` on insert.

**Product type select:** shows the full global `StoreProductType` catalog. Not filtered by the order's store assignment. Field is optional.

**Validation timing:** `name` and `quantity` validate on blur; `unitPrice` and `productTypeKey` validate at save time (per WO-02).

### Discrepancy modal

Appears only when every item has a non-null `unitPrice` AND `itemizedTotal !== totalCost`. Three options: keep entered total · use calculated total · go back without saving. Copy and i18n keys follow the WO-02 spec (`orders.discrepancyModal.*`).

### Post-save redirect

- Create: redirect to `/purchases/[id]` + success toast "Orden creada" / "Order created"
- Edit: redirect to `/purchases/[id]` + success toast "Orden guardada" / "Order saved"

### Discard changes (edit mode only)

When the user navigates away from edit with unsaved changes, show a confirmation before leaving:

- Message (ES): _"¿Salir sin guardar? Los cambios que hiciste no se guardarán."_
- Message (EN): _"Leave without saving? Changes you made will not be saved."_
- Confirm: "Salir" / "Leave" · Cancel: "Quedarse" / "Stay"

Does not apply to the create form.

### Page header

Both routes use `BackNavLink` (`appearance="pill"`) in a `space-y-3` stack above `AppPageHero`:

- **Create** — back → `/purchases` · title (ES): "Nueva orden" · title (EN): "New order"
- **Edit** — back → `/purchases/[id]` · title (ES): "Editar orden · [humanReadableId]" · title (EN): "Edit order · [humanReadableId]"

The form body uses `APP_SHELL_FORM_RAIL_CLASSNAME` to keep fields at a comfortable reading width.

## Technical Notes

- All monetary inputs (total cost, unit price) are entered by the user as decimal values (e.g., "25.50") and converted to minor units (× 100) before passing to the data layer. Display paths divide by 100 and format before rendering.
- The `returnTo=order-create` query value is centralized as `RETURN_TO_ORDER_CREATE` in `src/lib/constants.ts`. The store-creation flow reads it (via `searchParams` on `/stores/new`) so the client redirect after create goes to `/purchases/new?store={id}` instead of the default store detail/list.
- The order form builds store-create and settings links with the `returnTo` query key from `AUTH_RETURN_TO_PARAM` (`src/lib/auth/authRedirect.ts`) so the param name stays aligned with auth callbacks.
- The settings page and `SettingsPreferencesSection` read the same `returnTo` value for the back link and post-save redirect to `/purchases/new` (see _Settings round-trip_ above).
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

| Event constant                   | When it fires                                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `order_created`                  | Create server action completes successfully                                                                                        |
| `order_edited`                   | Edit server action completes successfully                                                                                          |
| `order_create_discarded`         | User confirms leaving the create form without saving                                                                               |
| `order_discrepancy_modal_opened` | Discrepancy modal appears at save time                                                                                             |
| `order_discrepancy_resolved`     | User picks one of the three discrepancy options; include property `resolution: "kept_entered" \| "used_calculated" \| "cancelled"` |

## Blueprints

- `BP-02` form contract
- `BP-02` action hierarchy decision
- `BP-02` store-creation redirect pattern

## E2E Acceptance Tests

### Create — happy path

- User opens `/purchases/new` · selects a store · fills required fields · adds items · enters a total cost · saves → order is created and user lands on the detail page with a success toast.
- On create, order date prefills with today's date. Currency defaults to the selected store's country primary currency; when no store is selected yet, it falls back to `user.baseCurrencyCode` when configured.

### Empty state

- User opens `/purchases/new` when no stores exist → sees "Primero, agrega una tienda" copy and "Crear tienda" CTA instead of the form.

### Store-creation redirect

- User searches for a store that does not exist and clicks "＋ Create [name]" → lands on `/stores/new` with the store name prefilled.
- After creating the store, user is redirected to `/purchases/new` with the new store preselected in the selector.

### Exchange rate and currency

- Selecting a currency matching the user's base currency keeps the exchange rate field hidden.
- Selecting a different currency makes the exchange rate field appear with the correct conversion direction label.
- When the user has no base currency configured, the info banner is visible and the exchange rate field does not appear.

### Base currency banner → Settings → back to new order

- From `/purchases/new`, the base-currency banner CTA navigates to `/settings?returnTo=order-create`.
- On Settings, the pill back control **"Volver al formulario de nueva orden"** / **"Back to new order form"** is visible and targets `/purchases/new`.
- Saving preferences successfully while that query context is active redirects to `/purchases/new` (user can also use the back link without saving).

### Store-driven currency auto-fill

- Selecting an Argentine store sets currency to `ARS`; selecting a Japanese store afterwards overwrites it to `JPY`.
- After the store-creation redirect (`/purchases/new?store={id}`) lands on the form with a preselected store, the currency field is already populated with that store's country primary currency.
- In edit mode, opening an order whose saved currency differs from the current store's country primary currency preserves the saved currency. Changing the store within the edit session overwrites the currency to match the new store's country primary currency.
- After the store sets the currency automatically, manually changing the currency to a different allowed code does not revert on save, and the selected value is the one persisted.

### Item spreadsheet — keyboard

- Tabbing from the last cell of the last row adds a new empty row.
- User can add multiple rows and navigate between cells without using the mouse.

### Item spreadsheet — reorder

- User drags an item row to a new position; the reordered list persists after save.

### Item spreadsheet — insert between rows

- Hovering the gap between two item rows on desktop reveals the "+" inserter; clicking it adds a new empty row between those two items and moves focus to the name input of the new row.
- The inserter is not rendered above the first row or below the last row; new rows at the end still use the "Agregar artículo" footer button or the Tab-from-last-cell shortcut.

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

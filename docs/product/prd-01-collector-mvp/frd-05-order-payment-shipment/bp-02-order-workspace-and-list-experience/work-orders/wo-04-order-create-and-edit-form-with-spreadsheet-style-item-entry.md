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

- Create route at `orders/new`
- Edit route at `orders/[id]/edit`
- Searchable store selector with store-creation redirect path
- Empty state when no stores exist in the system
- Order date defaulting to current date
- Expected delivery date range picker (optional)
- Currency select with base-currency default
- Exchange-rate field (conditional: only when order currency differs from base currency)
- Non-blocking info banner when user has no base currency configured, with a settings deep link that preserves return context (`?returnTo=order-create`)
- Spreadsheet-style item rows: name, quantity, unit price (optional), product type (optional)
- Spreadsheet-style keyboard shortcuts standardized on `Ctrl + Shift` (literal `Ctrl` on both macOS and Windows — same keycap label on every platform) as the base combo for cell/row actions, plus `Alt + Shift + ↑/↓` for reorder (VSCode "move line" convention): `Ctrl + Shift + ↑/↓` vertical row navigation, `Ctrl + Shift + ←/→` adjacent-column navigation, `Ctrl + Shift + Enter` insert row below, `Ctrl + Shift + Backspace` delete row, `Alt + Shift + ↑/↓` reorder, plus existing `Tab` from last cell
- Keyboard shortcut discoverability: help icon + tooltip next to the "Agregar artículo" button lists every shortcut
- Product-type inheritance on new rows (new rows inherit the nearest preceding non-empty product type)
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
| `/[locale]/orders/new`       | `src/app/[locale]/(app)/orders/new/page.tsx`       | Create order |
| `/[locale]/orders/[id]/edit` | `src/app/[locale]/(app)/orders/[id]/edit/page.tsx` | Edit order   |

Shared components between create and edit live in `src/app/[locale]/(app)/orders/_components/share/`.

Date inputs are promoted to app-wide primitives and live in `src/components/core/`:

- `src/components/core/DatePickerInput.tsx` — single date picker. Exposes `disableFuture?: boolean` (default `false`) to opt into hiding any day after today; the order form passes `disableFuture` for `orderDate`, while the delivery range picker keeps future dates selectable.
- `src/components/core/DateRangePickerInput.tsx` — two-click range picker, domain-agnostic.

Both are thin wrappers around `react-day-picker` and are reusable across features (e.g., future payment-date and shipment-window pickers in FRD-05 BP-01).

Server actions live in `src/app/[locale]/(app)/orders/_actions/orderActions.ts` and call into `src/lib/data/orders/orderMutations.ts`.

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
- After the store is created, the store creation flow redirects to `/orders/new?store={id}`, which preselects the new store in the selector

### Empty state (no stores in the system)

When the store list is empty, hide the form body and render a centered empty state:

- Icon: `Store` from `lucide-react`
- Title (ES): **"Primero, agrega una tienda"**
- Title (EN): **"Start with a store"**
- Body (ES): _"Para crear un pedido necesitas al menos una tienda registrada. Agrega la primera y vuelve aquí cuando estés listo."_
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
- The hint _"Auto-filled from the store's country. Change it if the order is in a different currency."_ / _"Se autocompleta según el país de la tienda. Cámbiala si el pedido está en otra moneda."_ sits directly beneath the currency select so the auto-fill behavior is never silent.
- `getUserStores` in `src/lib/data/stores/storeQueries.ts` must return `countryCode` alongside `id` and `name` so the form can compute the default currency client-side without a second round-trip.
- Exchange rate field is hidden when `currencyCode === user.baseCurrencyCode` or when `baseCurrencyCode` is null.
- Exchange rate appears dynamically when `currencyCode !== user.baseCurrencyCode` and `baseCurrencyCode` is set. It renders in its own full-width row below the dates (at half width on `sm` and up) to keep the store/currency row stable as the field toggles on and off.
- Helper text on the exchange rate field identifies the conversion direction (e.g., "USD → PEN").

### Base currency not configured

When `user.baseCurrencyCode` is null, render a non-blocking `info` banner inside the currency section:

- Visual treatment: `info` variant (`bg-info/12 border border-info/35 rounded-xl`)
- Icon: `Info` from `lucide-react`
- Copy (ES): _"Te mostramos cuánto llevas gastado en total, aunque tengas pedidos en tiendas de distintos países. Solo elige tu moneda base y convertimos cada pedido a esa moneda por ti."_ Link: **"Elegir moneda base →"** → `/[locale]/settings?returnTo=order-create` (value must match `RETURN_TO_ORDER_CREATE`; param key is `returnTo` / `AUTH_RETURN_TO_PARAM`).
- Copy (EN): _"We'll show you how much you've spent in total, even when you buy from stores in different countries. Just choose your base currency and we'll convert each order to it for you."_ Link: **"Choose base currency →"** → same URL shape with `?returnTo=order-create`.
- The banner does not block saving. Orders created without a base currency will surface in the `Needs currency update` filter (`FR-05-36`) once the user later configures their base currency in Preferences.

### Settings round-trip (`returnTo=order-create` from order create)

When the collector opens Settings from the base-currency banner, the URL includes `?returnTo=order-create` so the collector can return to the new-order flow without losing context.

**Settings page** (`src/app/[locale]/(app)/settings/page.tsx`):

- If `searchParams.returnTo === RETURN_TO_ORDER_CREATE`, render a pill **`BackNavLink`** above the page hero (same chrome as the create-order header), linking to `/[locale]/orders/new`.
- Link label (ES): **"Volver al formulario de nuevo pedido"** · (EN): **"Back to new order form"** (`settings.returnToOrderCreate`).

**Preferences save** (`SettingsPreferencesSection`):

- When that same `returnTo` value is active, a **successful** "Save preferences" (including after the currency-change confirmation modal) **`router.push`**es to `/[locale]/orders/new` so the collector lands back on the new-order form after configuring base currency (or other preferences).

This reuses the same `returnTo` contract as the store-creation path; only the post-action destination differs (store create → `/orders/new?store={id}`; settings save → `/orders/new`).

### Item spreadsheet

**Desktop (≥ md):** horizontal grid with columns `[drag handle | name (flex) | quantity (80 px) | unit price (120 px) | product type (150 px) | delete]`

**Mobile (< md):** each item row collapses to a single-column vertical stack: name → quantity → unit price → product type. The delete button moves to the top-right of the item block. The drag handle remains visible.

**Drag-and-drop:**

- Library: `@dnd-kit/sortable` with `MouseSensor` (desktop) and `TouchSensor` (mobile)
- TouchSensor activation constraint: `delay: 250ms, tolerance: 5px` to avoid conflict with page scroll
- Desktop: drag handle icon visible only on hover (`opacity-0 group-hover:opacity-100`)
- Mobile: drag handle always visible at `opacity-30` at rest, `opacity-100` when the row is being dragged or is active
- Long-press on the row activates drag on touch devices

**Keyboard navigation (spreadsheet-style):** the grid exposes a full keyboard shortcut surface so collectors can enter a run of items without ever leaving the keyboard. All shortcuts are handled by a single unified `onKeyDown` on every cell input so coverage is uniform across the four columns.

**Modifier standardization (cross-platform safe harbor):** every cell/row action uses `Ctrl + Shift` as the base combo — **literal Ctrl on both macOS and Windows** (`event.ctrlKey`, not `metaKey`). Reordering uses `Alt + Shift + ↑/↓` as an explicitly distinct combo (VSCode "move line" convention) to avoid stacking a third modifier on top of an already two-modifier chord, and because reorder is a power-user action that benefits from living in its own mnemonic space.

**Why `Ctrl + Shift` (and not something simpler):** we iterated through every single-modifier option and each had a fatal OS-level or browser-level conflict:

| Modifier attempt                       | Fatal conflict                                                                                                                                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Alt` alone (Option on Mac)            | Firefox on macOS binds `Option + ←/→` to browser history back/forward, and some macOS configs scroll the page on `Option + ↑/↓`. Event is intercepted by the OS/browser before reaching our handler, so `preventDefault()` cannot save us. |
| `Cmd/Ctrl` (`metaKey`/`ctrlKey`) alone | `Cmd + ←/→` is browser history on macOS; `Ctrl + ←/→` is "switch Space" on macOS Mission Control. Both eaten before the page.                                                                                                              |
| `Ctrl` literal alone                   | Same Mission Control / Spaces binding on macOS (`Ctrl + arrows`, `Ctrl + ↑` = Mission Control).                                                                                                                                            |

`Ctrl + Shift` is the first combo that is free of OS-level bindings on macOS **and** free of browser history shortcuts everywhere. Its only conflicts are _text-editing_ shortcuts inside inputs (`Ctrl + Shift + ←/→` = extend word selection on Windows, `Ctrl + Shift + Backspace` = delete previous word on some platforms) — those reach our handler and we override them cleanly with `preventDefault()`. The collector still has `Home` / `End` / double-click-to-select for word-level caret navigation.

Ergonomic trade-off: `Ctrl + Shift + key` is three keys, one more than a single-modifier combo. We accepted this because reliability beats ergonomics when the simpler combos don't actually work everywhere.

| Shortcut                                   | Behavior                                                                                                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tab` / `Shift + Tab`                      | Horizontal cell-to-cell traversal (native browser focus order).                                                                                                                   |
| `Tab` from last cell (Type) of last row    | Appends a new row (with inherited product type) and focuses its Name cell. Legacy behavior per WO-02.                                                                             |
| `Ctrl + Shift + ↑` / `Ctrl + Shift + ↓`    | Moves focus to the **same column** of the previous / next row. Hard stop at the first / last row. Pre-selects destination text.                                                   |
| `Ctrl + Shift + ←` / `Ctrl + Shift + →`    | Moves focus to the **previous** / **next** column of the current row, one step at a time (Name ↔ Qty ↔ Price ↔ Type). Pre-selects destination text. Hard stop at Name / Type.     |
| `Ctrl + Shift + Enter`                     | Inserts a new row **below** the current row (with inherited product type) and focuses its Name cell.                                                                              |
| `Ctrl + Shift + Backspace` (or `+ Delete`) | Deletes the current row and moves focus to the same column of the previous row (or next if first). Respects the "at least one row" rule — does nothing when only one row remains. |
| `Alt + Shift + ↑` / `Alt + Shift + ↓`      | Reorders the current row up / down by one position, keeping focus on the exact same cell (VSCode "move line" convention).                                                         |

Behavior notes:

- Focused cell contents are re-selected after both vertical (`Ctrl + Shift + ↑/↓`) and horizontal (`Ctrl + Shift + ←/→`) navigation (`HTMLInputElement.select()`) so the collector can immediately start typing to replace the value — Excel-style "overwrite on move." Re-selection is intentionally skipped for row creation and reorder paths (focus moves but the existing value, if any, is preserved for editing).
- The handler requires `ctrlKey && shiftKey && !metaKey && !altKey` for the core shortcuts — so `Cmd + Shift + key` (Mac) or `Ctrl + Alt + Shift + key` combos are **not** hijacked, preserving every native browser/OS chord that layers on top of `Shift`.
- `Cmd/Ctrl + Backspace` (clear input to start of line on macOS) is **not** hijacked. All other native text-editing shortcuts (`Cmd/Ctrl + A`, `Cmd/Ctrl + Z`, `Shift + arrows` selection, etc.) are left untouched.

**Discoverability — keyboard shortcut help:** a small `Keyboard` icon (from `lucide-react`) is placed immediately to the right of the **"Artículos" section heading** in the form, matching the inline-tooltip pattern already used by the currency and exchange-rate labels. Hovering or keyboard-focusing the icon opens a tooltip listing every shortcut in `<kbd>`-styled rows, rendered via the shared `Tooltip` component. The standalone React component lives at `src/app/[locale]/(app)/orders/_components/share/OrderItemsShortcutsHelp.tsx`.

- **Placement rationale:** the affordance is co-located with the section title because that is where the user's eye lands first when scanning the form, and it mirrors the existing currency/exchange-rate tooltip pattern — consistent with the rest of the form. An earlier placement next to the "Agregar artículo" footer button was rejected: it anchored discovery too close to the end of the scroll region, making the icon easy to miss on long orders and inconsistent with every other hint tooltip in this page.
- **Mobile:** the entire help affordance is hidden via `hidden md:inline-flex` on breakpoints below `md`. Grid shortcuts require a physical keyboard, so touch-only devices (phones) don't get the icon. Tablets hitting the `md` breakpoint with a paired keyboard still see it.
- **OS-aware key labels:** `Ctrl` and `Shift` are labeled identically on every OS (the physical keycap legend matches on Mac and Windows keyboards), so no detection is needed for the core shortcuts. The only OS-dependent label is the `Alt` key for the reorder shortcut, which renders as **"Option"** on macOS-family devices (Mac, iPad, iPhone, iPod) and as **"Alt"** on Windows / Linux. Detection lives in a local `useIsMac()` hook using a lazy `useState` initializer that reads `navigator.userAgent` and `navigator.platform`, defaulting to `false` on SSR to avoid hydration mismatches.
- **Accessibility:** the trigger is a real `<button>` (inherited from `Tooltip`), reachable via `Tab`, labelled by `sr-only` text (`orders.form.itemsShortcutsHelpLabel`), and the tooltip panel is associated via `aria-describedby`. `Escape` closes the panel when opened via keyboard focus.
- Content copy lives under `orders.form.itemsShortcuts*` in both Spanish and English translation catalogs.

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

**Product type inheritance on row creation:** every new item row inherits the product type of the nearest preceding row that has a non-empty `productTypeKey`. Because a collector typically logs several items of the same type in a single order (e.g. five manga volumes, then two art books), the sensible default is "same as previous" rather than empty.

- Applies to **all four** row-creation paths, uniformly: the "Agregar artículo" footer button, `Tab` from the last cell of the last row, the between-rows `+` inserter, and the `Cmd/Ctrl + Enter` shortcut.
- Algorithm (see `inheritProductTypeFromPrevious` in `src/lib/orders/orderItemUtils.ts`): starting from `insertIndex - 1`, walk the current rows backwards and copy the first non-empty `productTypeKey` found. If every preceding row has an empty type, the new row keeps its empty default.
- Inheritance is **one-shot** at creation time — it seeds the new row but does not create a linked binding. The collector can freely change the type of the new row afterwards without affecting the source row, and vice versa.
- Applies identically in both `create` and `edit` modes; the helper operates purely on the current client-side rows, so it works for pre-existing order rows loaded in edit mode the same way it works for rows added during the session.
- The inheritance walk is strictly **backwards** (above → below). Rows above index 0 have no predecessor, so inserting at index 0 always produces an empty product type; new rows appended at the end pick up the last row's type if set.

**Validation timing:** `name` and `quantity` validate on blur; `unitPrice` and `productTypeKey` validate at save time (per WO-02).

### Discrepancy modal

Appears only when every item has a non-null `unitPrice` AND `itemizedTotal !== totalCost`. Three options: keep entered total · use calculated total · go back without saving. Copy and i18n keys follow the WO-02 spec (`orders.discrepancyModal.*`).

### Post-save redirect

- Create: redirect to `/orders/[id]` + success toast "Pedido creado" / "Order created"
- Edit: redirect to `/orders/[id]` + success toast "Pedido guardado" / "Order saved"

### Discard changes (edit mode only)

When the user navigates away from edit with unsaved changes, show a confirmation before leaving:

- Message (ES): _"¿Salir sin guardar? Los cambios que hiciste no se guardarán."_
- Message (EN): _"Leave without saving? Changes you made will not be saved."_
- Confirm: "Salir" / "Leave" · Cancel: "Quedarse" / "Stay"

Does not apply to the create form.

### Page header

Both routes use `BackNavLink` (`appearance="pill"`) in a `space-y-3` stack above `AppPageHero`:

- **Create** — back → `/orders` · title (ES): "Nuevo pedido" · title (EN): "New order"
- **Edit** — back → `/orders/[id]` · title (ES): "Editar pedido · [humanReadableId]" · title (EN): "Edit order · [humanReadableId]"

The form body uses `APP_SHELL_FORM_RAIL_CLASSNAME` to keep fields at a comfortable reading width.

## Technical Notes

- All monetary inputs (total cost, unit price) are entered by the user as decimal values (e.g., "25.50") and converted to minor units (× 100) before passing to the data layer. Display paths divide by 100 and format before rendering.
- The `returnTo=order-create` query value is centralized as `RETURN_TO_ORDER_CREATE` in `src/lib/constants.ts`. The store-creation flow reads it (via `searchParams` on `/stores/new`) so the client redirect after create goes to `/orders/new?store={id}` instead of the default store detail/list.
- The order form builds store-create and settings links with the `returnTo` query key from `AUTH_RETURN_TO_PARAM` (`src/lib/auth/authRedirect.ts`) so the param name stays aligned with auth callbacks.
- The settings page and `SettingsPreferencesSection` read the same `returnTo` value for the back link and post-save redirect to `/orders/new` (see _Settings round-trip_ above).
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

- User opens `/orders/new` · selects a store · fills required fields · adds items · enters a total cost · saves → order is created and user lands on the detail page with a success toast.
- On create, order date prefills with today's date. Currency defaults to the selected store's country primary currency; when no store is selected yet, it falls back to `user.baseCurrencyCode` when configured.

### Empty state

- User opens `/orders/new` when no stores exist → sees "Primero, agrega una tienda" copy and "Crear tienda" CTA instead of the form.

### Store-creation redirect

- User searches for a store that does not exist and clicks "＋ Create [name]" → lands on `/stores/new` with the store name prefilled.
- After creating the store, user is redirected to `/orders/new` with the new store preselected in the selector.

### Exchange rate and currency

- Selecting a currency matching the user's base currency keeps the exchange rate field hidden.
- Selecting a different currency makes the exchange rate field appear with the correct conversion direction label.
- When the user has no base currency configured, the info banner is visible and the exchange rate field does not appear.

### Base currency banner → Settings → back to new order

- From `/orders/new`, the base-currency banner CTA navigates to `/settings?returnTo=order-create`.
- On Settings, the pill back control **"Volver al formulario de nuevo pedido"** / **"Back to new order form"** is visible and targets `/orders/new`.
- Saving preferences successfully while that query context is active redirects to `/orders/new` (user can also use the back link without saving).

### Store-driven currency auto-fill

- Selecting an Argentine store sets currency to `ARS`; selecting a Japanese store afterwards overwrites it to `JPY`.
- After the store-creation redirect (`/orders/new?store={id}`) lands on the form with a preselected store, the currency field is already populated with that store's country primary currency.
- In edit mode, opening an order whose saved currency differs from the current store's country primary currency preserves the saved currency. Changing the store within the edit session overwrites the currency to match the new store's country primary currency.
- After the store sets the currency automatically, manually changing the currency to a different allowed code does not revert on save, and the selected value is the one persisted.

### Item spreadsheet — keyboard

- `Tab` / `Shift + Tab` cycle through the four cells in visual order across rows; the user can fill and traverse the whole grid without touching the mouse.
- `Tab` from the last cell (Type) of the last row appends a new row and focuses its Name cell.
- `Ctrl + Shift + ↓` on any cell moves focus to the same column of the next row; the new input's existing text is pre-selected so typing replaces it. On the last row, `Ctrl + Shift + ↓` does nothing (hard stop).
- `Ctrl + Shift + ↑` on any cell moves focus to the same column of the previous row; pre-selects text. Hard stop on the first row.
- `Ctrl + Shift + ←` / `Ctrl + Shift + →` move focus to the previous / next column of the current row one step at a time (Name ↔ Qty ↔ Price ↔ Type); the destination text is pre-selected. On the first column `Ctrl + Shift + ←` does nothing; on the last column `Ctrl + Shift + →` does nothing.
- `Ctrl + Shift + Enter` on any cell inserts a new row directly below the current row (seeded with the inherited product type) and moves focus to its Name cell.
- `Ctrl + Shift + Backspace` (and `Ctrl + Shift + Delete`) on any cell deletes the current row and moves focus to the same column of the previous row; if the current row is the first, focus moves to the next row instead. Shortcut is a no-op when only one row exists.
- `Alt + Shift + ↑` / `Alt + Shift + ↓` reorder the current row up / down by one position, keeping focus on the exact same cell.
- When `Cmd/Meta` is pressed alongside `Ctrl + Shift`, none of the grid shortcuts fire — native browser/OS chords (for example `Cmd + Ctrl + Shift + 4` screenshot-to-clipboard on macOS) continue to work.

### Item spreadsheet — shortcut discoverability

- A `Keyboard` help icon is rendered to the right of the "Artículos" section heading (not next to the footer "Agregar artículo" button); it is focusable via `Tab`.
- Hovering or keyboard-focusing the icon opens a tooltip that lists all grid shortcuts with localized descriptions, plus a reminder that Tab / Shift+Tab move between cells.
- On macOS-family devices (Mac, iPad, iPhone) the modifier key is labeled **Option**; on Windows and Linux it is labeled **Alt**. Detection runs client-side after mount (SSR defaults to "Alt").
- On breakpoints below `md` (phones) the icon is hidden entirely — shortcuts don't apply to touch-only input.
- The tooltip supports `Escape` to close when opened via keyboard focus.

### Item spreadsheet — reorder

- User drags an item row to a new position; the reordered list persists after save.
- Keyboard reorder: focusing any cell of a row and pressing `Alt + Shift + ↑` / `Alt + Shift + ↓` moves the row by one position; the reordered list persists after save.

### Item spreadsheet — insert between rows

- Hovering the gap between two item rows on desktop reveals the "+" inserter; clicking it adds a new row between those two items (with product type inherited from the row above) and moves focus to the name input of the new row.
- The inserter is not rendered above the first row or below the last row; new rows at the end still use the "Agregar artículo" footer button, the Tab-from-last-cell shortcut, or `Ctrl + Shift + Enter` on the last row.

### Item spreadsheet — product type inheritance

- Creating a new row via any of the four entry points (`Agregar artículo` button, `Tab` from last cell, `+` between-rows inserter, `Cmd/Ctrl + Enter`) seeds the new row's Type with the first non-empty `productTypeKey` found by walking the current rows backwards from the insertion point.
- When no preceding row has a product type, the new row keeps Type empty (the current behavior before this rule was introduced).
- Inheritance is one-shot: changing the Type of the new row afterwards does not affect the source row, and changing the source row's Type does not retroactively change the new row's Type.
- Applies identically in create and edit modes.

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

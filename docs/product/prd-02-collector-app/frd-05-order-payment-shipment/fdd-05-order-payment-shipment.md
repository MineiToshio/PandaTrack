---
id: FDD-05
type: FDD
slug: order-payment-shipment
title: Orders, Payments & Shipment — Feature Design Document
status: ACTIVE
parent: FRD-05
last_updated: 2026-08-08
prototype: ./prototype/order-payment-shipment.html
design_system: ../../../design/README.md
demo_anchors:
  - "#orders"
  - "#order-detail"
  - "#order-create"
  - "#s7-orders-list-default"
  - "#s7-orders-list-filters-open"
  - "#s7-orders-list-empty-initial"
  - "#s7-orders-list-empty-filtered"
  - "#s7-order-detail-active"
  - "#s7-order-detail-cancelled"
  - "#s7-order-detail-completed-unpaid"
  - "#s7-order-detail-delete-modal"
  - "#s7-order-detail-cancel-modal"
  - "#s7-order-detail-pay-modal"
  - "#s7-order-create-step-1"
  - "#s7-order-create-step-2"
  - "#s7-order-create-step-3"
  - "#s7-order-create-step-4"
  - "#s7-order-create-step-5"
  - "#s7-order-create-empty-stores"
  - "#s7-order-create-discrepancy-modal"
  - "#s7-order-edit"
  - "#s7-order-edit-discard-modal"
  - "#s7-order-detail-overdue"
  - "#s7-order-detail-partially-paid"
  - "#s7-order-create-step-3-validation"
  - "#s7-order-create-step-1-from-store"
  - "#s7-orders-list-mobile"
  - "#s7-order-detail-mobile"
  - "#s7-order-create-mobile"
  - "#s7-order-edit-mobile"
  - "#s7-order-edit-discard-mobile"
  - "#s7-order-create-add-product-mobile"
  - "#s7-orders-list-loading"
  - "#s7-orders-list-loading-mobile"
  - "#s7-orders-list-empty-initial-mobile"
  - "#s7-orders-list-empty-filtered-mobile"
  - "#s7-orders-list-filters-mobile"
  - "#s7-order-detail-overdue-mobile"
  - "#s7-order-detail-cancelled-mobile"
  - "#s7-order-detail-completed-unpaid-mobile"
  - "#s7-order-detail-pay-mobile"
  - "#s7-order-detail-delete-mobile"
  - "#s7-order-detail-cancel-mobile"
  - "#s7-order-create-step-2-mobile"
  - "#s7-order-create-step-3-mobile"
  - "#s7-order-create-discrepancy-mobile"
  - "#s7-order-create-empty-stores-mobile"
  - "#s7-fx-reconciliation-mobile"
  - "#s7-product-type-picker-mobile"
  - "#s7-store-picker-mobile"
  - "#s7-currency-picker-mobile"
  - "#s7-date-range-picker-mobile"
  - "#s7-date-range-picker"
  - "#s7-orders-list-fx-banner"
  - "#s7-fx-reconciliation-modal"
---

# FDD-05 · Orders, Payments & Shipment — Feature Design Document

> **What this document is.** The FDD is "the prototype in words": the durable, text
> form of the visual and interaction design for FRD-05, so the feature's design is
> reconstructible without depending on the redesign subproject. It
> pairs with the self-contained prototype at [`./prototype/order-payment-shipment.html`](./prototype/order-payment-shipment.html)
> (the pixel truth) and is governed by the design system in
> [`docs/design/`](../../../design/README.md) (the system rules).
>
> **Three-source rule.** This document **references** the design system for system-wide
> rules (tokens, components, motion, states, copy voice), **describes** what is specific
> to Orders, Payments & Shipment, and **cites the prototype** for the exact pixel. When
> this FDD and the design system disagree on a system-wide rule, `docs/design/` wins. When
> this FDD and the prototype disagree on an Orders-specific visual, the prototype wins
> until this FDD is corrected in the same change.
>
> **Language.** Prose is English (repository docs convention); user-facing copy is quoted
> verbatim in Spanish (`es` is the default locale). The `en` equivalents live in
> `src/i18n/locales/en/orders.json` (with list copy under the `orderListing` namespace).
>
> **Amendment — Store-level payments (v5, 2026-08-08).** Money moved from a per-order payment
> ledger to the store (`StorePayment`, with an optional, declared `PaymentAllocation` per
> order/item — `docs/design/decisions/0025-store-level-payments-declared-allocations.md`). This
> consolidates the three implementation phases (3a orders-list view, 3b order-detail/store-aside,
> 4 payment sheet + create-flow advance) into one section; none of it is yet reflected in the
> prototype HTML below (see the follow-up note at the end).
>
> - **Orders list — "Por tienda" view.** A second view, `?view=store` (toggled next to the sort
>   control, remembered per collector via a cookie), groups every store's pending products with a
>   per-currency debt summary and a "Registrar pago" entry point per group, in place of the
>   per-order payment percentage the `#s7-orders-list-*` anchors below still show. The classic "Por
>   pedido" list itself dropped the payment-progress column/bar, the paid/partial/unpaid filter
>   pills, and the `payment-asc` sort. New components: `OrderListViewToggle`, `StoreGroupedView`,
>   `StoreGroupHeader`, `StorePendingProductRow`, `StorePendingProductCard` under
>   `src/app/[locale]/(app)/orders/_components/`.
> - **Amendment — compact view switcher (2026-08-09).** `OrderListViewToggle` was rebuilt from two
>   full-width `ToggleChoiceGroup` chips into a compact segmented control (same grammar as
>   `ThemeToggle`): icon + label per option in the desktop toolbar (`variant="label"`), icon-only
>   with a `Tooltip` in the mobile sticky row (`variant="icon-only"`, mirrors
>   `FilterTriggerButton`'s icon-only convention) so it stops competing with the search field for
>   width. Behavior (`?view=`, cookie, sort reset, `orders_list_view_changed`) is unchanged.
> - **Order detail hero.** The protagonist figure is now the order's TOTAL, a stable number that
>   never moves as payments come and go (superseding "the outstanding balance ('Saldo pendiente')
>   against the total" in §1 below). Below it: while this order has an allocation, "Asignado {X} de
>   {Y}" plus a progress bar (allocated/total); while it has none, a "Deuda de la tienda: {Z}" link
>   into the store detail (green "A favor {|Z|}" when the store owes the collector instead). A "Pago
>   completado" chip joins the status chips once allocated is greater than or equal to the total.
>   Dropped: the old "Saldo pendiente"/"de {total}" amount swap and the payment-percent meta segment.
> - **Payments card.** The totals block reads "Asignado" / "Por asignar" (was "Total pagado" /
>   "Saldo pendiente"). A payment shared with other orders shows a "Parte de un pago de {total} a
>   {tienda}" subtitle on its row, and its delete-confirm copy makes clear only this order's slice is
>   removed, not the whole payment. A new empty state ("Sin pagos asignados a este pedido" + "Ver
>   deuda de la tienda") replaces the blank rows list when nothing is allocated yet.
> - **Sticky bar.** The primary CTA reads "Saldar {X}" once something is already allocated
>   (continuing a payment), "Anotar pago" while nothing is (a first one), regardless of order status.
> - **Cancel modal** (`#s7-order-detail-cancel-modal`). The payments-choice radios are "Queda a
>   favor de {tienda}" (`credit`, default) / "Lo doy por perdido" (`lost`), replacing the earlier
>   "Conservarlos" / "Quitarlos"; the question copy is "Pagaste {X} de este pedido. ¿Qué hacemos con
>   ese dinero?".
> - **Store detail aside** (FRD-04, not pictured in this FDD). A "Deuda pendiente" row per currency
>   (green "A favor" when negative), a "Registrar pago" action opening the store payment sheet below
>   (shipped active, not the placeholder-disabled state an earlier draft of this note described),
>   and a "Ver mis pedidos en esta tienda" link.
> - **Store payment sheet** (`StorePaymentSheet`, `src/components/modules/StorePaymentSheet/`). A
>   `ModalSheet` (ADR 0008) reachable from the "Por tienda" view and the store detail aside above: an
>   amount + date + currency header, then one row per standing order (its own amount field) that
>   expands to one row per product (its own amount field or a "Saldado" toggle). Shows the running
>   "Sin asignar" remainder and blocks submit on any line exceeding its own ceiling or the payment
>   exceeding the store's debt (`FR-05-43`).
> - **Order create — "¿Pagaste algo hoy?".** An optional toggle in the confirm step (Paso 3) with
>   "Pagué todo" / "Adelanto" quick options, an amount field, and a payment-date field (default
>   today); submitting creates the order and its pre-assigned payment together (`FR-05-45`).
>
> **Follow-up (explicit, not scheduled):** the prototype HTML and its `#s7-orders-list-*` /
> `#s7-order-detail-*` anchors have not been updated for this model; the FDD prose above and the
> shipped implementation are the source of truth in the meantime (per the Authority order in
> `.agents/rules/frd-design-documentation.mdc`).

---

## 1. Overview & screens covered

Orders, Payments & Shipment is the **central collector workspace**: the place where a
collector records what they bought, what it cost, how much has been paid, and whether the
order is still open, partially in transit, completed, or cancelled. It is the first of the
three lifecycle workspaces and the one the Deliveries workspace (FRD-08) was deliberately
modeled after — same shell, same list/detail/wizard grammar, same action hierarchy.

The one defining trait of Orders, and the divergence Deliveries calls out by contrast:
**the protagonist datum is a money amount, not an arrival window.** An order is the
financial commitment the collector is paying down over time, so the detail hero leads with
the outstanding balance ("Saldo pendiente") against the total, and fulfillment timing is a
caption. The two states are kept conceptually distinct end-to-end (`FR-05-32`/`FR-05-33`):
status is system-derived from fulfillment, while payment progress is tracked separately —
which is why a `COMPLETED` order can still carry a visible unpaid signal.

### Screens in this FDD

The prototype is the S7 workshop demo; it carries the full Velvet redesign plus a few
**superseded** sections retained for provenance. The canonical create flow is a **3-step
wizard** (Datos → Productos y costos → Confirmar); the `step-4`/`step-5`,
`step-3-validation`, and `step-1-from-store` anchors belong to an earlier 5-step iteration
and are **not** the design of record (see §9 and the create spec's methodology note).

| #   | Screen                                  | Route                        | Prototype anchor                           |
| --- | --------------------------------------- | ---------------------------- | ------------------------------------------ |
| 1   | Orders list (default)                   | `/{locale}/orders`           | `#s7-orders-list-default`                  |
| 2   | List · loading                          | `/{locale}/orders`           | `#s7-orders-list-loading`                  |
| 3   | List · empty (initial)                  | `/{locale}/orders`           | `#s7-orders-list-empty-initial`            |
| 4   | List · empty (filtered)                 | `/{locale}/orders?…`         | `#s7-orders-list-empty-filtered`           |
| 5   | List · FilterDrawer open                | `/{locale}/orders`           | `#s7-orders-list-filters-open`             |
| 6   | List · FX banner                        | `/{locale}/orders`           | `#s7-orders-list-fx-banner`                |
| 7   | Modal · FX reconciliation               | (list overlay)               | `#s7-fx-reconciliation-modal`              |
| 8   | Order detail · active                   | `/{locale}/orders/[id]`      | `#s7-order-detail-active`                  |
| 9   | Order detail · overdue                  | `/{locale}/orders/[id]`      | `#s7-order-detail-overdue`                 |
| 10  | Order detail · partially paid           | `/{locale}/orders/[id]`      | `#s7-order-detail-partially-paid`          |
| 11  | Order detail · completed + unpaid       | `/{locale}/orders/[id]`      | `#s7-order-detail-completed-unpaid`        |
| 12  | Order detail · cancelled                | `/{locale}/orders/[id]`      | `#s7-order-detail-cancelled`               |
| 13  | Detail · inline pay form                | (detail expand)              | `#s7-order-detail-pay-modal`               |
| 14  | Modal · cancel order                    | (detail overlay)             | `#s7-order-detail-cancel-modal`            |
| 15  | Modal · delete order                    | (detail overlay)             | `#s7-order-detail-delete-modal`            |
| 16  | Create · step 1 (Datos)                 | `/{locale}/orders/new`       | `#s7-order-create-step-1`                  |
| 17  | Create · step 2 (Productos y costos)    | `/{locale}/orders/new`       | `#s7-order-create-step-2`                  |
| 18  | Create · step 3 (Confirmar)             | `/{locale}/orders/new`       | `#s7-order-create-step-3`                  |
| 19  | Create · no eligible stores             | `/{locale}/orders/new`       | `#s7-order-create-empty-stores`            |
| 20  | Modal · discrepancy                     | (create overlay)             | `#s7-order-create-discrepancy-modal`       |
| 21  | Calendar · date-range picker            | (create/edit popover)        | `#s7-date-range-picker`                    |
| 22  | Edit order (all-open)                   | `/{locale}/orders/[id]/edit` | `#s7-order-edit`                           |
| 23  | Modal · discard changes                 | (edit overlay)               | `#s7-order-edit-discard-modal`             |
| 24  | Mobile · list                           | `/{locale}/orders`           | `#s7-orders-list-mobile`                   |
| 25  | Mobile · list loading                   | `/{locale}/orders`           | `#s7-orders-list-loading-mobile`           |
| 26  | Mobile · list empty (initial)           | `/{locale}/orders`           | `#s7-orders-list-empty-initial-mobile`     |
| 27  | Mobile · list empty (filtered)          | `/{locale}/orders?…`         | `#s7-orders-list-empty-filtered-mobile`    |
| 28  | Mobile · FilterDrawer (bottom sheet)    | `/{locale}/orders`           | `#s7-orders-list-filters-mobile`           |
| 29  | Mobile · FX reconciliation (full sheet) | (list overlay)               | `#s7-fx-reconciliation-mobile`             |
| 30  | Mobile · detail                         | `/{locale}/orders/[id]`      | `#s7-order-detail-mobile`                  |
| 31  | Mobile · detail overdue                 | `/{locale}/orders/[id]`      | `#s7-order-detail-overdue-mobile`          |
| 32  | Mobile · detail cancelled               | `/{locale}/orders/[id]`      | `#s7-order-detail-cancelled-mobile`        |
| 33  | Mobile · detail completed + unpaid      | `/{locale}/orders/[id]`      | `#s7-order-detail-completed-unpaid-mobile` |
| 34  | Mobile · pay sheet                      | (detail overlay)             | `#s7-order-detail-pay-mobile`              |
| 35  | Mobile · cancel sheet                   | (detail overlay)             | `#s7-order-detail-cancel-mobile`           |
| 36  | Mobile · delete sheet                   | (detail overlay)             | `#s7-order-detail-delete-mobile`           |
| 37  | Mobile · create (step 1)                | `/{locale}/orders/new`       | `#s7-order-create-mobile`                  |
| 38  | Mobile · create (step 2)                | `/{locale}/orders/new`       | `#s7-order-create-step-2-mobile`           |
| 39  | Mobile · create (step 3)                | `/{locale}/orders/new`       | `#s7-order-create-step-3-mobile`           |
| 40  | Mobile · add product sheet              | (create overlay)             | `#s7-order-create-add-product-mobile`      |
| 41  | Mobile · discrepancy sheet              | (create overlay)             | `#s7-order-create-discrepancy-mobile`      |
| 42  | Mobile · no eligible stores             | `/{locale}/orders/new`       | `#s7-order-create-empty-stores-mobile`     |
| 43  | Mobile · store picker                   | (create overlay)             | `#s7-store-picker-mobile`                  |
| 44  | Mobile · currency picker                | (create overlay)             | `#s7-currency-picker-mobile`               |
| 45  | Mobile · product-type picker            | (create overlay)             | `#s7-product-type-picker-mobile`           |
| 46  | Mobile · date-range picker (full sheet) | (create/edit overlay)        | `#s7-date-range-picker-mobile`             |
| 47  | Mobile · edit                           | `/{locale}/orders/[id]/edit` | `#s7-order-edit-mobile`                    |
| 48  | Mobile · discard sheet                  | (edit overlay)               | `#s7-order-edit-discard-mobile`            |
| 49  | (provenance) Section index — list       | —                            | `#orders`                                  |
| 50  | (provenance) Section index — detail     | —                            | `#order-detail`                            |
| 51  | (provenance) Section index — create     | —                            | `#order-create`                            |
| 52  | (superseded) Create · step 4 (5-step)   | —                            | `#s7-order-create-step-4`                  |
| 53  | (superseded) Create · step 5 (5-step)   | —                            | `#s7-order-create-step-5`                  |
| 54  | (superseded) Create · step 3 validation | —                            | `#s7-order-create-step-3-validation`       |
| 55  | (superseded) Create · step 1 from store | —                            | `#s7-order-create-step-1-from-store`       |

Requirements traced throughout: `FR-05-01 … FR-05-38`, `BR-05-01 … BR-05-18`,
`AC-05-01 … AC-05-07` (see [`frd-05-order-payment-shipment.md`](./frd-05-order-payment-shipment.md)).
Status-chip mapping is governed by [ADR 0002](../../../design/decisions/0002-status-chip-mapping.md);
the detail/aside grammar by [ADR 0003](../../../design/decisions/0003-demo-decisions.md);
the inline secondary-action card by [ADR 0011](../../../design/decisions/0011-mobile-detail-secondary-actions.md).

---

## 2. Layout & structure per screen

All product screens live inside the collector **App Shell** (PUSH `Sidebar` + `Header`
topbar + content column) — see [interface-patterns.md → Layout & app shell](../../../design/interface-patterns.md).
The shell is system chrome and is **not** redefined here; only the content column is
Orders-specific.

### 2.1 Orders list (`#s7-orders-list-default`)

Vertical rhythm, top to bottom:

```
app-topbar (sticky)     título "Pedidos" (desktop, no breadcrumb at list root)
page-heading            <h1>Pedidos</h1> + meta "5 activos · 1 cerrado"
orders-toolbar          search · FilterTriggerButton · sort Select · [+ Nuevo pedido]
orders-filter-chips     removable chips for active filters (default: "Solo activas")
fx banner               s7-orders-list-fx-banner — only when pendingFxCount > 0
card (tabular list)      orders-table-head + order-row × N + pagination
```

Unlike the card-grid the FRD originally sketched, the redesign settled on a **tabular
list**. **Desktop columns** (left→right) on the `order-row`:
`[store-avatar s32] · Pedido / Tienda (col-store) · Productos (col-product) · Estado
(col-status) · Total (col-total) · % Pago (col-progress) · [expand-toggle chevron]`.

- **Pedido / Tienda**: store name in `font-weight 600`, then the **order date** in `MonoCode`
  and the **expected arrival**, joined on one line (`26 jul 2026 · llega 1–30 nov`) from
  **1360px** up and stacked on two lines below it.

**Design decision, 2026-08-05 — the row shows the expected arrival and drops the order code.**
This supersedes the earlier version of these two bullets, which put `ORD-YYYYMMDD-NN` in the
secondary line and gave the table no arrival column at all. Two reasons. First, `FR-05-29` always
required the expected delivery range in the row and this design never carried it, so the list
could be filtered by delivery date (`deliveryFrom` / `deliveryTo` / "Entrega atrasada") while
showing nothing to check the filter against. Second, the identifier is detail-surface metadata by
`FR-05-03` and `WO-06`; it is still searchable, still on the detail hero with its copy button,
still in the breadcrumb, and still on the dashboard rows.

It lives **inside `col-store`**, joined to the order date where the cell is wide enough and
stacked under it where it is not. Two other shapes were tried and rejected. A **column** cost an
eighth track that squeezed the other five hard enough to wrap the payment cell's percentage under
its own progress bar between 1024px and 1280px, and the value is null on many orders, so it does
not earn permanent horizontal space. **Joining unconditionally** fails at the narrow end: this
line is `truncate`d, and `truncate` cuts from the right, so a cell too narrow silently eats the
arrival — the value being added. The responsive split keeps the compact single line where it is
safe and degrades to two full-width lines where it is not.

**The 1360px switch is measured, not chosen.** Against the real corpus (491 orders with a window,
median 28 characters, longest 37 — `12 feb 2026 · esperada 1 jun – 31 jul` in `es`,
`May 27, 2026 · arrives Sep 20 – Oct 31` in `en`), forcing the single line and counting clipped
nodes over 100 rows gives: **1152px → 14 clipped, 1230px → 2, 1280px → 0, 1360px → 0 in both
locales, 1600px → 0**. The true boundary is near 1250px; 1360px keeps roughly 18 characters of
headroom for longer future windows, longer month names and other locales. Below it the stacked
form clips nothing, and the `·` separator is hidden so it never orphans at the start of a line.
Re-measure this number if the window format or the column widths change.

- **Expected arrival line**: the window via `formatArrivalWindow` (`src/lib/arrivalWindow.ts`,
  shared with the deliveries list) — `llega 15–22 ago`, collapsing to a single date when both
  ends fall on the same day (image intake writes both ends from one stated date, so this is
  common). Once the window has elapsed the verb becomes `esperada …` in `--warning` (`WO-06`);
  a `COMPLETED` / `CANCELLED` order renders no line at all rather than promising an arrival.
  "Elapsed" is `resolveOrderArrivalDueDate` (window close, or its start when open-ended), the
  same rule the status chip, the "Entrega atrasada" filter and the dashboard now share.
- **% Pago** (`col-progress`): a mini progress bar (≈60×3px, left-anchored) followed by the
  percentage in `.num` with `min-width: 3.2ch`. Bar color is role-driven: `--accent` for a
  normal partial payment, `--warning` for overdue/unpaid-with-balance, `--success` at 100%.
- **Terminal-state dimming**: `COMPLETED` rows render at `opacity: 0.75` — closed but not
  hidden; `CANCELLED` rows only appear when the user explicitly includes that status.

Each `order-row` is expandable; the chevron reveals an inline product list (every item

**Design decision, 2026-08-06 — the expanded drawer lists every product.** It used to stop at five and print `"+ N más…"`, which was inert text: it named products it would not show, while the row's own Products column already printed the true total beside it and the quick-arrival modal already offered the full list. The mobile card never capped, so the same order showed five items on a monitor and all of them on a phone; this is desktop catching up to it, not a new behaviour. Real distribution here is p50 = 1 item, p90 = 6, p99 = 15, max = 32, so the cap fired on about one row in eight while the tall case it guarded against is a single order in 560. Because an uncapped drawer (~56px per row, so ~1,900px at 32 items) pushes the expand chevron far above the fold, the drawer now ends with its own collapse action, mirroring the mobile card whose toggle already sat below its items. FDD-08 never specified a cap; the deliveries list had it as undocumented drift and loses it here too.
with item-icon + name + subtype + item-state + qty + price, then `"+ N más…"` and an
`"Abrir detalle →"` link). Default visible sort is **newest first** (CB-01: a deliberate
divergence from `FR-05-28`'s original oldest-first, because collectors manage recent orders
first).

A thin right-aligned row above the list (below `orders-filter-chips`, shown only from 2 rows
up) carries a single `Expand all` / `Collapse all` toggle (`ExpandAllToggle`) driving one
shared multi-open expansion set for every row on the current page + filter — the desktop
table is no longer a single-open accordion. Its label always shows the _next_ action
(`"Expandir todo"` until every row is open, then `"Colapsar todo"`), while `aria-pressed`
carries the true `true`/`false`/`mixed` state for assistive tech.

The **FX banner** (`#s7-orders-list-fx-banner`, `role="status"`, `aria-live="polite"`,
leading `refresh-cw` in `--accent`) sits between the chips and the list when
`pendingFxCount > 0`; its tonal CTA opens the FX reconciliation modal (§5.6).

### 2.2 Order detail (`#s7-order-detail-active` and state variants)

Two-column `detail-grid`: a main column + a **sticky aside** (ADR 0003 Decision 7).

```
app-topbar     breadcrumb "Pedidos › ORD-YYYYMMDD-NN"  (id in JetBrains Mono)
overdue banner (only when overdue) — role="alert", between topbar and back-link
back-link      "← Pedidos"
detail-grid
  main         detail-hero (top-accent) → Productos subcard (open) → Historial subcard (closed)
  aside        Pagos card → Acciones card → Tu nota privada card
```

The aside ordering is **Pagos → Acciones → Nota** (the payment ledger, not a generic
summary, leads here — the divergence from Deliveries' Resumen-first aside). Unlike delivery
detail, **order detail keeps the Historial subcard** (`FR-05-22`/`BR-05-09`): an automatic,
**read-only** lifecycle log, closed by default and desktop-only.

**Hero anatomy** (`detail-hero.s8-card-accent`, `view-transition-name: order-{id}`):

1. `detail-hero-head`: `StoreAvatar s56` + store name + `ORD-…` (with a copy button on
   mobile) + status `Chip` (sometimes dual — see per-state table). The store name links to the
   store's detail page (`order_view_store_clicked`), carrying `returnTo`/`returnLabel` so that
   page's back link reads "Volver al pedido {orderId}" instead of the default "back to listing"
   (`FR-05-23`, mirrors the mechanism `frd-04-store-domain.md` documents on the store side).
2. `s8-eyebrow-chip`: `"Tu pedido · {currency}"` (the warm-possessive section identity).
3. **Protagonist block** (the divergence from Deliveries): label `"Saldo pendiente"` → the
   large outstanding amount in `detail-hero-amount.num` → sub `"de {total} {currency}"`
   (`detail-hero-amount-sub`) → a `progress` bar of payment → a caption
   `"{pct}% pagado · entrega estimada {fecha}"`.

**Per-state hero** (prototype anchors in parentheses):

| State                                                    | Hero treatment                                                                                                                                |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Active (`#s7-order-detail-active`)                       | Single status chip (e.g. `info` "Parcialmente en camino"); balance in default ink; progress bar `--accent`                                    |
| Overdue (`#s7-order-detail-overdue`)                     | `role="alert"` banner above + **dual chip** (status + `warning` "Atrasado Nd"); progress bar `--warning` when unpaid                          |
| Partially paid (`#s7-order-detail-partially-paid`)       | Progress between 0–100%; `--warning` progress when overdue/unpaid                                                                             |
| Completed + unpaid (`#s7-order-detail-completed-unpaid`) | **Dual chip**: `success` "Completo" (`package-check`) + `warning` "Saldo pendiente" (`alert-triangle`); hero figure and bar in `--warning`    |
| Cancelled (`#s7-order-detail-cancelled`)                 | `detail-hero` at `opacity 0.75`; `neutral` "Cancelado" (`ban`); label switches to "Total"; cancellation-reason callout (`role="note"`) if any |

**Productos subcard** (`subcard.is-open.s8-card-cool`, expanded by default): `item-row`s,
each with an item-type icon, the product name + optional subtype, an item-state chip
(`s7-istate`: `none` / `transit` / `delivered`), read-only qty, and unit price. It closes
with `"Crear entrega con estos productos"`.

### 2.3 Create (`#s7-order-create-step-1/2/3`)

A 3-step `WizardAccordion` inside `form-grid` (main wizard column + sticky `form-sidebar`
holding the reactive Resumen). One step is open at a time; "Continuar" is forward-gated by
inline validation; backward navigation is always free (`is-done` steps re-expand without
data loss). Each step is a `section-card.section-card-wizard` carrying `step-num` +
`is-active`/`is-done` state.

```
stepper      ①Datos · ②Productos y costos · ③Confirmar
step 1       Tienda (combobox) · Moneda (select) · Fecha orden · Fecha aprox. entrega (range)
step 2       OrderItemsGrid spreadsheet · "Usar este total" · Costo total · Tipo de cambio (+ "Hoy")
step 3       Resumen card (surface-elevated) + info banner "se creará en estado Abierto"
```

The **store-from-context** entry (`?storeId=…`, ADR 0001 D2) renders step 1's store as a
field-as-attribute accent container with a `"↳ DESDE TIENDA"` badge and a
`"cambiar la tienda"` inline link; the currency auto-fills from the store's default. The
**empty-stores gate** (`#s7-order-create-empty-stores`) replaces step-1's fields with a
`store`-icon empty state and a `"Crear primera tienda"` CTA.

### 2.4 Edit (`#s7-order-edit`)

**Edit is not a wizard.** It uses the **L020 all-open** pattern (parity with delivery-edit):
stacked, always-expanded `section-card`s with **static** headers (not buttons), CTA
`"Guardar cambios"` + `"Cancelar"` in a `form-footer`, and the same sticky reactive Resumen
rail (whose values render in `--warning` to signal the editing context). The **store and
currency are immutable** (`BR-05-11`): each renders as a read-only `<div>` with a `lock`
icon and an explanatory helper. Cancelling with pending changes opens the discard modal
(§5.7); the breadcrumb is the 3-level `Pedidos › ORD-… › Editar pedido`.

---

## 3. Visual treatment

Orders introduces **no new tokens, palettes, surfaces, or type ramps.** It consumes the
Velvet system as-is. This section records only how the FRD _applies_ the system; the
definitions live in [visual-foundations.md](../../../design/visual-foundations.md) and
[tokens-css.md](../../../design/tokens-css.md).

### 3.1 Color roles

| Role in this FRD                                             | Token / class                        | Where                                  |
| ------------------------------------------------------------ | ------------------------------------ | -------------------------------------- |
| Primary CTA (`Crear pedido`, `Anotar pago`, `Crear entrega`) | `--accent` (Button primary)          | wizard step 3, hero aside, action bar  |
| Hero / Acciones surface accent                               | `s8-card-accent` (top-accent border) | detail hero, Acciones card             |
| Pagos / Productos surface                                    | `s8-card-cool` (`--accent-cool`)     | Productos subcard, aside cards         |
| Private note surface                                         | `s8-card-warm` (`--accent-warm`)     | aside Tu nota privada                  |
| In-transit / partial status                                  | `--info`                             | `chip info` + `s7-istate transit`      |
| Overdue (derived) / unpaid balance                           | `--warning`                          | `chip warning` "Atrasado Nd"; hero bar |
| Completed status                                             | `--success`                          | `chip success` "Completo"; paid 100%   |
| Cancelled status                                             | `--neutral` + `--text-muted`         | `chip neutral` + dimmed hero           |
| Destructive (delete)                                         | `--destructive`                      | Button destructive-ghost, delete modal |

The **Chip-Eyebrow + Top-Accent** pattern (`s8-eyebrow-chip` + `s8-card-accent/cool/warm`)
is the system's section-identity device — see [interface-patterns.md](../../../design/interface-patterns.md).
Status color is **never** carried by color alone: every chip is icon + label
([ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md)). The
unpaid signal on a `COMPLETED` order (`FR-05-35`) is therefore carried by a labelled
`warning` chip plus the `--warning` progress bar, never by the hue alone.

### 3.2 Typography

- Store names and row titles: body semibold (`font-weight 600`).
- Order identifiers `ORD-YYYYMMDD-NN` and (in Productos) delivery references: **JetBrains
  Mono** via `MonoCode` (renders in `--text-secondary`,
  [ADR 0007](../../../design/decisions/0007-text-muted-outdoor-code-mono-reassignment.md)).
- The hero outstanding balance uses the large `detail-hero-amount` ramp — the same slot
  Deliveries repurposes for an arrival range; here it carries money, the protagonist datum.
- Eyebrow chips and the `"↳ DESDE TIENDA"` badge use uppercase + wide tracking per the system.
- Numerals (totals, amounts, percentages, dates, counts) use the `.num` tabular treatment.

### 3.3 Shape, radius & elevation

Standard system values, no overrides: cards at the standard radius, pills/chips fully
rounded, border-first elevation (the system is border-led, not shadow-led). The cancelled
hero deliberately reads as "closed" via reduced opacity and a `neutral` chip rather than a
top-accent. Overlays (modals/sheets) use the system's elevated treatment via the canonical
`Modal`; the FX full-screen sheet is the documented exception under
[ADR 0008](../../../design/decisions/0008-modal-enhancement.md).

---

## 4. Components consumed

Everything below already exists in the catalog — see
[components.md](../../../design/components.md). Orders, Payments & Shipment is an
**assembly of existing components**; it must not fork or reinvent any of them.

| Component                              | Tier        | Role in FRD-05                                                                                                                                                                  |
| -------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Sidebar`, `Header`                    | module      | App shell chrome (PUSH sidebar, breadcrumbs/lang/theme topbar)                                                                                                                  |
| `StoreAvatar`                          | core        | s32 in list rows, s56 in detail hero                                                                                                                                            |
| `MonoCode`                             | core        | `ORD-…` identifiers in rows, hero, breadcrumb                                                                                                                                   |
| `StatusChip`                           | core        | Order + item status, per [ADR 0002](../../../design/decisions/0002-status-chip-mapping.md)                                                                                      |
| `CodeCopyButton`                       | core        | copy the `ORD-…` in the mobile hero                                                                                                                                             |
| `Button`                               | core        | primary / accent (tonal) / ghost / destructive-ghost hierarchy                                                                                                                  |
| `ViewTransitionLink`                   | core        | list row → detail (`view-transition-name: order-{id}`)                                                                                                                          |
| `FilterTriggerButton` + `FilterDrawer` | core/module | list filtering (`FR-05-26`); side drawer (desktop) / bottom sheet (mobile, ADR 0003 D8)                                                                                         |
| `AppliedFilterChip`                    | core        | removable active-filter chips, incl. the default "Solo activas"                                                                                                                 |
| `ListPagination` / `PerPageSelect`     | module      | desktop summary + page-size select + numbered nav / mobile summary + "Cargar más" ([ADR 0018](../../../design/decisions/0018-list-pagination-page-size-and-desktop-summary.md)) |
| `Select`                               | core        | sort, currency                                                                                                                                                                  |
| `WizardAccordion`                      | module      | 3-step create flow                                                                                                                                                              |
| `StoreCombobox`                        | module      | create store selection (+ inline "Crear nueva tienda" with `returnTo` context)                                                                                                  |
| `OrderItemsGrid`                       | module      | spreadsheet item entry (keyboard nav, drag reorder) — `FR-05-06`…`FR-05-10`, `BR-05-04`                                                                                         |
| `DateRangePickerInput`                 | core        | estimated delivery range (with quick-range presets)                                                                                                                             |
| `DateInput`                            | core        | order date, payment date                                                                                                                                                        |
| `Textarea`                             | core        | inline-editable private note, cancellation reason                                                                                                                               |
| `CollapsibleSubcard`                   | module      | Productos / Historial subcards                                                                                                                                                  |
| `AsideSummary` / `DetailSidebar`       | module      | Pagos / Acciones / Nota rail; reactive create/edit Resumen                                                                                                                      |
| `PrivateNoteCard`                      | module      | inline-editable private note (autosave on blur, ~800ms debounce — `FR-05-21`)                                                                                                   |
| `Modal` (`ModalDialog` / `ModalSheet`) | module      | pay / cancel / delete / discard / discrepancy / FX overlays — [ADR 0008](../../../design/decisions/0008-modal-enhancement.md)                                                   |
| `FxReconciliationModal`                | module      | bulk FX reconciliation grouped by currency pair (`FR-05-36`…`FR-05-38`)                                                                                                         |
| `MobilePicker`                         | module      | mobile store / currency / product-type / date-range pickers                                                                                                                     |
| `EmptyState`                           | module      | initial empty, filtered empty, no-eligible-stores                                                                                                                               |
| `Skeleton`                             | core        | list loading                                                                                                                                                                    |
| `Toast`                                | core        | payment-complete achievement, save confirmations, add-payment failure reverts                                                                                                   |
| `MascotBubble`                         | core        | celebratory register only — empty states and the payment-complete toast                                                                                                         |

Implementation contracts (not design surfaces): the `getOrdersList` / `getOrderDetail`
queries, the `pendingFxCount` derivation, `deriveOrderStatus` (`BR-05-02`), and the
payment / lifecycle / note server actions.

---

## 5. Interactions & states

### 5.1 Cross-cutting states

Owned by the system — see [states.md](../../../design/states.md) and
[ADR 0013](../../../design/decisions/0013-cross-cutting-state-system.md). FRD-05 instances:

- **Loading** (`#s7-orders-list-loading` / `#s7-orders-list-loading-mobile`): card-style
  skeletons (avatar placeholder + text bars + chip + progress placeholder), disabled
  toolbar, `aria-busy="true"`. SSR-delivered — no fake client fallback.
- **Empty, initial** (`#s7-orders-list-empty-initial`): `MascotBubble sleeping`,
  `"Aún no hay pedidos"`, `"Anota tu primer pedido y empieza a seguir tus compras desde
aquí."`, primary CTA `"Anotar primer pedido"`.
- **Empty, filtered** (`#s7-orders-list-empty-filtered`): `MascotBubble confused`,
  `"Sin resultados"`, ghost CTA `"Limpiar filtros"`; toolbar and chips stay visible.
- **No eligible stores** (`#s7-order-create-empty-stores`): `store` icon,
  `"Sin tiendas aún"`, CTA `"Crear primera tienda"` → `/stores/new`.

Route-error / 404 are system screens, not Orders-specific mocks.

### 5.2 Status-chip mapping (ADR 0002)

The list "Estado" column applies a display hierarchy (distinct from the `BR-05-02`
derivation): conditions are evaluated top-down and the first match wins.

| Condition                                            | Chip label               | Variant   | Icon             |
| ---------------------------------------------------- | ------------------------ | --------- | ---------------- |
| `CANCELLED`                                          | `Cancelado`              | `neutral` | `ban`            |
| `COMPLETED` (+ optional unpaid warning badge)        | `Completo`               | `success` | `package-check`  |
| `status != COMPLETED` + `expectedDeliveryTo < today` | `Atrasado Nd` (derived)  | `warning` | `alert-triangle` |
| `IN_TRANSIT`                                         | `En camino`              | `info`    | `truck`          |
| `PARTIALLY_IN_TRANSIT`                               | `Parcialmente en camino` | `info`    | `truck`          |
| `PARTIALLY_DELIVERED`                                | `Parcialmente entregado` | `info`    | `truck`          |
| `OPEN` + `paymentPercentage === 100`                 | `Pagado`                 | `success` | `check-circle`   |
| `OPEN`                                               | `Abierto`                | `neutral` | `clock`          |

Item-level chips (`s7-istate`): `transit` ("En camino"), `delivered` ("Entregado"), `none`
("Pendiente en tienda" / "Listo en tienda" depending on item delivery state).

### 5.3 Payment flow (`FR-05-17`…`FR-05-20`, `BR-05-10`)

Adding a payment is an **inline expand inside the Pagos card** on desktop
(`#s7-order-detail-pay-modal`) — the rest of the page stays visible so the collector sees
the outstanding balance while entering an amount. The amount field offers two quick-pick
`filter-pill`s: `"Saldo pendiente ($X)"` and `"Mitad ($X/2)"`, both computed on the
**remaining balance** (never the gross total). A payment greater than the remaining balance
is rejected (`FR-05-19`). Deleting a `pay-row` opens a destructive confirmation modal
(`role="alertdialog"`) and is awaited — the row is removed only after the server confirms;
there is no optimistic delete and no undo toast. A payment that exactly clears the balance fires a celebratory toast with
`MascotBubble celebrating` (`"¡Cubierto! Una pre-orden menos. ✨"`).

### 5.4 Lifecycle actions (`FR-05-23`, ADR 0011 — the action hierarchy)

Secondary affordances live in an inline **Acciones card** at the foot of the detail (not a
split button, not a `⋯` overflow), on both desktop and mobile.

| State            | Primary                     | Rest                                                                                                  |
| ---------------- | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| Active / overdue | **Crear entrega** (`truck`) | Editar (ghost) · Ver tienda (ghost) · Cancelar (ghost) · Eliminar (destructive-ghost)                 |
| Completed        | **Crear entrega**           | Editar + Ver tienda + Eliminar; **no Cancelar** (a completed order cannot be cancelled)               |
| Cancelled        | **Reactivar pedido**        | Ver tienda (enabled); Eliminar (enabled); Editar + Crear entrega **disabled** with explanatory helper |

`Ver tienda` is never disabled by order status: it is the same store, orderable or not, so viewing it carries no lifecycle precondition. It links to the store's detail page carrying `returnTo`/`returnLabel` so that page's back link reads "Volver al pedido {orderId}" (`order_view_store_clicked`, shared with the store-name link in the hero, §2.4).

`Cancelar` and `Eliminar` share one eligibility rule (`FR-05-24`/`FR-05-25`): both are
disabled (with a `title` tooltip) when any item is linked to a non-cancelled delivery.
**Reactivate carries no modal** (reversible, `BR-05-17`): it runs directly.

### 5.5 Modals (adaptive — desktop dialog / mobile `ModalSheet`, ADR 0008)

- **Anotar pago** — desktop inline expand (§5.3); **mobile** opens a dedicated bottom sheet
  (`#s7-order-detail-pay-mobile`) with a highlighted "Saldo pendiente" panel.
- **Cancelar pedido** (`#s7-order-detail-cancel-modal`, `tone-warning`, `ban`): keeps the
  record, preserves payments/history, reversible via reactivate; optional `"Motivo
(opcional)"` textarea; footer `Volver` + `--warning` CTA `"Cancelar pedido"`.
- **Eliminar pedido** (`#s7-order-detail-delete-modal`, `tone-destructive`, `trash-2`):
  irreversible; deletes payments + history; deliveries untouched; **type-to-confirm**
  (`"eliminar"`) gates the CTA (parity desktop + mobile).
- **Importe no coincide** (`#s7-order-create-discrepancy-modal`, `tone-warning`): the
  2-option discrepancy modal (CB-02 / `FR-05-13`) — `"Volver y corregir"` /
  `"Guardar de todos modos"`; the entered total is authoritative, no auto-replace.
- **¿Salir sin guardar?** (`#s7-order-edit-discard-modal`, `tone-warning`): edit-cancel
  guard; `"Quedarse"` / `"Salir"`.
- **FX reconciliation** (`#s7-fx-reconciliation-modal`): bulk update grouped by currency
  pair with a "Hoy" prefill per group and a defer option (`FR-05-38`); renders as a
  full-screen sheet on mobile (`#s7-fx-reconciliation-mobile`).

### 5.6 Optimistic behavior & motion

All mutations are **optimistic** — see the `optimistic-client-updates` policy and
[motion.md](../../../design/motion.md):

- Payment add/delete and lifecycle changes update the hero/ledger locally and revert with a
  toast on failure (the parent coordinator owns rollback). The private note is the
  documented exception (`FR-05-21`): it waits for server confirmation before showing
  `"Guardada hace Ns"`.
- Modal/sheet flows close **synchronously** on submit (Optimistic Confirmation).
- List row → detail and create-confirm → detail use **View Transitions** keyed
  `order-{id}` (the row's `view-transition-name` matches the detail hero); the create
  confirm card uses `order-create-confirm`.
- Within the wizard, only one step is expanded; advancing animates the accordion.

> Note: the prototype approximates View Transitions with a CSS fade+slide and runs the
> mascot walk continuously; the canonical View Transitions API
> ([ADR 0014](../../../design/decisions/0014-motion-system-and-view-transitions.md)) and the
> mascot cooldown are implementation concerns, not design changes.

### 5.7 Removed-store tombstone (`FR-04-42`, `AC-04-22`)

This is the order-side render of a cross-FRD requirement whose store-side lifecycle
(`REJECTED` status + `Store.removalReason`) is owned by
[FRD-04 · BP-01 · WO-09](../../frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md)
and delivered here by
[BP-02 · WO-08](bp-02-order-workspace-and-list-experience/work-orders/wo-08-order-side-removed-store-tombstone.md).
[FDD-04](../../frd-04-store-domain/fdd-04-store-domain.md) deferred the exact order-row pixel
to this FDD because a `REJECTED` store is a **collector-order** surface, not a store surface
(the store detail route 404s and no store-detail tombstone screen exists).

Presentation **accompanies** the store name, it does not replace it: the store row is
retained by the tombstone, so the historical `store.name` stays visible as plain text and a
marker is added next to it. This preserves the collector's "who did I buy from" context
across a list of orders spanning many stores.

| Surface                     | Marker treatment                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `OrderCard` (mobile list)   | Compact inline marker beside the name: lucide icon + core `Tooltip` with the full message + screen-reader text |
| `OrdersTable` row (desktop) | Same compact inline marker beside the name                                                                     |
| `OrderDetailHero`           | Fuller inline line under the store `<h1>`: neutral rendered muted, sanction rendered in `--warning` tone       |
| `OrderDetailContent`        | Pass-through: threads `store.status` + `store.removalReason` to the hero; no store link to hide today          |

Variant selection is neutral by default and sanction only for the abuse category, driven by
`isSanctionRemovalReason(store.removalReason)` via the shared `resolveStoreTombstone` helper.
The order side **never re-classifies** removal reasons; it consumes the value WO-09 persisted.
The two variants use distinct lucide icons, each with an `aria-label`, so the state is never
color-only (ADR 0006), and the hero message is real, announceable text.

Presentation is a small route-level `StoreTombstoneNotice`
(`orders/_components/share/`, `variant: "compact" | "full"`) reading `useTranslations("stores")`.
It is intentionally **not** mocked in the FRD-05 prototype (which predates this record); it is
reconstructible from this section plus the copy row in §6. The delivery and dashboard surfaces
that also render a store name are a documented sibling follow-up (they would show a stale name
for a removed store) and will reuse the same helper and copy; `FR-04-42` itself is scoped to
collector orders.

---

## 6. Copy & voice

Voice is constant and tone is per-surface — see [ux-copy.md](../../../design/ux-copy.md)
and the workshop voice library. FRD-05 keeps the canonical glossary (`pedido ↔ order`,
`tienda ↔ store`, `entrega ↔ delivery`) — see [glossary.md](../../glossary.md). Strings
live in `src/i18n/locales/{es,en}/orders.json` (list copy under `orderListing`).

Key strings (es), by surface and tone:

| Surface                            | Tone                    | String                                                                                                                              |
| ---------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| List heading meta                  | neutral, factual        | `"{active} activos · {closed} cerrado"`                                                                                             |
| List search placeholder            | helpful                 | `"Código o producto (ORD-20260428-01, Evangelion OST…)"`                                                                            |
| Hero eyebrow                       | warm-possessive         | `"Tu pedido · {currency}"`                                                                                                          |
| Hero balance label                 | factual                 | `"Saldo pendiente"` / `"de {total} {currency}"`                                                                                     |
| Hero progress caption              | reassuring              | `"{pct}% pagado · entrega estimada {date}"`                                                                                         |
| Payment success (full)             | celebratory-restrained  | `"¡Cubierto! Una pre-orden menos. ✨"`                                                                                              |
| Overdue banner                     | alerting                | `"Atrasado {days} días"` · `"Estimado el {date} · aún sin entrega confirmada"`                                                      |
| Private note placeholder           | inviting                | `"Escribe una nota o recordatorio para este pedido…"`                                                                               |
| FX banner                          | confidence-building     | `"Tienes {count} pedidos con el tipo de cambio desactualizado. Actualízalos para que tus reportes reflejen tu moneda base actual."` |
| Empty (initial)                    | encouraging             | `"Aún no hay pedidos"`                                                                                                              |
| Empty (filtered)                   | neutral                 | `"Sin resultados"`                                                                                                                  |
| No eligible stores                 | explanatory             | `"Sin tiendas aún"`                                                                                                                 |
| Edit, immutable store              | explanatory             | `"La tienda no se puede cambiar una vez creado el pedido."`                                                                         |
| Discrepancy modal title            | factual                 | `"Importe no coincide"`                                                                                                             |
| Delete confirm body                | concrete                | `"Se eliminarán también los pagos y el historial asociados. Las entregas vinculadas no se verán afectadas."`                        |
| Removed-store tombstone (neutral)  | factual, non-accusatory | `"Esta tienda ya no está disponible."`                                                                                              |
| Removed-store tombstone (sanction) | firm, non-accusatory    | `"Esta tienda fue retirada por incumplir nuestras políticas."`                                                                      |

The two removed-store tombstone strings (§5.7) live in `src/i18n/locales/{es,en}/stores.json`
under a dedicated `orderTombstone` group, not in `orders.json`: the copy is store-semantic,
the neutral wording already exists store-side, and the order list and detail surfaces read
different namespaces (`orderListing` and `orders`), so a single store-namespace home avoids a
duplicated key. The exact sanction wording is subject to copywriting review; the neutral vs
sanction split is fixed by `Store.removalReason`. See
[WO-08](bp-02-order-workspace-and-list-experience/work-orders/wo-08-order-side-removed-store-tombstone.md).

Tone rule for this FRD: **confirmations and errors carry no mascot** (decálogo #6); the
panda appears only in the celebratory/empty register (sleeping/confused empty states, the
payment-complete toast) — never on cancel, delete, reactivate, or error.

---

## 7. Responsive

Mobile-first; desktop is extra room (decálogo #10). Breakpoint behavior is the system's —
see [interface-patterns.md → Responsive](../../../design/interface-patterns.md). FRD-05
specifics:

- **List → cards** (`#s7-orders-list-mobile`): the tabular rows collapse into vertical
  `s7-order-card`s (avatar, store title, `{fecha del pedido}`, status chip, the expected-arrival
  line stacked under it (`llega …` / `esperada …` in `--warning`, omitted on a terminal order),
  status chip, progress bar, meta `"N productos · X% pagado · $total"`). The order code is not on the card;
  see the 2026-08-05 decision under Desktop columns. The page action row is a sticky search +
  icon-only `FilterTriggerButton` (with count badge) + `[+ Nuevo]`; chips stay removable; a
  per-card `s7-mob-card-expand-row` chevron expands items inline; footer is `"Cargar más"`.
  Tapping the card navigates to detail.
- **Detail → stacked** (`#s7-order-detail-mobile`): hero → state-aware subcards (Productos
  open; Pagos open when balance > 0, closed otherwise; Nota closed; **Historial omitted on
  mobile**) → inline Acciones card → **sticky single-primary action bar**. The primary sits
  on the right and is the highest-frequency action per state (payment over delivery); the bar
  carries **no `⋯`**. The bar background uses `color-mix(in oklab, …)` + blur — **`oklab`,
  not `oklch`** (lesson L074); the scroll container gets bottom padding so it never occludes
  content.
- **Create → mobile wizard** (`#s7-order-create-mobile`, `…step-2/3-mobile`): a compact
  `"Paso X de 3 · {paso}"` eyebrow + segmented progress bar; locked future steps use a
  `lock` icon (not opacity); sticky footer `[Atrás] [Continuar →]`. Store/currency/
  product-type/date pickers open dedicated `MobilePicker` sheets; the order-date field uses
  the native `<input type="date">`; add/edit product opens a bottom sheet.
- **Modals → sheets**: pay, cancel, delete, discard, discrepancy render as `ModalSheet`
  (vaul) on mobile; the FX flow renders as a full-screen sheet.

Known issue inherited at the list level: the mobile action row can overflow the viewport by
a few pixels at ~390px (tracked in the FRD).

---

## 8. Accessibility (FRD-05 specifics)

Baseline is WCAG 2.2 AA in both themes (decálogo #8). System-wide a11y rules live in
[interface-patterns.md → Accessibility](../../../design/interface-patterns.md). What
matters specifically here:

- **Status never by color alone**: every order/item chip is icon + label
  ([ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md)); the
  `COMPLETED`-but-unpaid case is a labelled `warning` chip, not a hue.
- **Expandable rows & subcards**: `aria-expanded` + `aria-controls` on the toggle; expansion
  is keyboard-operable; the desktop chevron is `align-self: start` (L059).
- **Overdue banner**: `role="alert"`, announced on load.
- **Progress bar**: `role="progressbar"` with `aria-valuenow/min/max` and an `aria-label`.
- **Disabled actions explain themselves**: cancelled-state Editar/Crear entrega keep
  `disabled` + `aria-disabled="true"` plus a textual reason; delete/cancel eligibility
  tooltips state why (`FR-05-24`/`FR-05-25`).
- **Modals**: `role="dialog"` / `alertdialog` + `aria-modal` + `aria-labelledby`; the
  type-to-confirm delete input is a real labelled field; focus returns to the trigger on close.
- **Payment form**: `aria-label="Formulario de nuevo pago"`; per-field labels; errors via
  `aria-describedby`; the pay-row delete control names the amount and date.
- **Copy button**: the mobile hero `ORD-…` copy control has an accessible label.
- **Spreadsheet**: `role="grid"` / `gridcell` with descriptive input `aria-label`s and
  documented keyboard navigation/reorder shortcuts.
- **Note autosave**: the `"Guardada hace Ns"` indicator is `aria-live="polite"`; the undo
  toast is a `status` region with a focusable "Deshacer" button.
- **FX banner**: `role="status"` + `aria-live="polite"`.

---

## 9. Sources & provenance

- **Pixel truth**: [`./prototype/order-payment-shipment.html`](./prototype/order-payment-shipment.html)
  (self-contained; opens standalone in light + dark; default palette Velvet). 55 sections,
  including a few superseded 5-step-wizard anchors retained for provenance (see §1). Verified S15.
- **System rules**: [`docs/design/`](../../../design/README.md) — visual-foundations,
  tokens-css, interface-patterns, components, motion, states, ux-copy, and ADRs
  0001/0002/0003/0006/0007/0008/0011/0013/0014.
- **Functional contract**: [`frd-05-order-payment-shipment.md`](./frd-05-order-payment-shipment.md)
  and its blueprints/work-orders (`bp-01-order-domain-foundation`,
  `bp-02-order-workspace-and-list-experience`).
- **Workshop raw material (historical)**: distilled from the redesign subproject; see git history. This FDD + the
  prototype are the durable record.

---
id: FDD-08
type: FDD
slug: delivery-management
title: Delivery Management — Feature Design Document
status: ACTIVE
parent: FRD-08
last_updated: 2026-08-03
prototype: ./prototype/delivery-management.html
design_system: ../../../design/README.md
demo_anchors:
  - "#deliveries"
  - "#delivery-create"
  - "#s9-delivery-detail"
  - "#s9-delivery-detail-delivered"
  - "#s9-delivery-detail-cancelled"
  - "#s9-delivery-create-standalone"
  - "#s9-delivery-create-empty"
  - "#s9-delivery-edit"
  - "#s9-deliveries-list-empty"
  - "#s9-deliveries-list-empty-filtered"
  - "#s9-deliveries-list-loading"
  - "#s9-delivery-mark-delivered-modal"
  - "#s9-delivery-cancel-modal"
  - "#s9-delivery-delete-modal"
  - "#s9-deliveries-list-mobile"
  - "#s9-delivery-detail-mobile"
  - "#s9-delivery-create-mobile"
  - "#s9-mark-delivered-sheet-mobile"
  - "#s9-delivery-actions-sheet-mobile"
---

# FDD-08 · Delivery Management — Feature Design Document

> **What this document is.** The FDD is "the prototype in words": the durable, text
> form of the visual and interaction design for FRD-08, so the feature's design is
> reconstructible without depending on the redesign subproject. It
> pairs with the self-contained prototype at [`./prototype/delivery-management.html`](./prototype/delivery-management.html)
> (the pixel truth) and is governed by the design system in
> [`docs/design/`](../../../design/README.md) (the system rules).
>
> **Three-source rule.** This document **references** the design system for system-wide
> rules (tokens, components, motion, states, copy voice), **describes** what is specific
> to Delivery Management, and **cites the prototype** for the exact pixel. When this FDD
> and the design system disagree on a system-wide rule, `docs/design/` wins. When this
> FDD and the prototype disagree on a Delivery-specific visual, the prototype wins until
> this FDD is corrected in the same change.
>
> **Language.** Prose is English (repository docs convention); user-facing copy is quoted
> verbatim in Spanish (`es` is the default locale). The `en` equivalents live in
> `src/i18n/locales/en/deliveries.json`.

---

## 1. Overview & screens covered

Delivery Management is the store-scoped workspace where a collector consolidates eligible
order products into one `entrega` (delivery), tracks its lifecycle, and resolves delivered
products back into the order domain. It is the third collector workspace and is designed as
a **sibling of the Orders workspace** (FRD-05): same shell, same list/detail/wizard
grammar, same action hierarchy. A returning user should recognize Deliveries as "the same
app, a different noun" — this parity is the primary design constraint, not a nice-to-have.

The one deliberate divergence from Orders: **the protagonist datum is the arrival window,
not a money amount.** A delivery is a thing the collector is _waiting on_, so the hero
leads with "when does it land", and cost is demoted to a caption.

### Screens in this FDD

| #   | Screen                         | Route                                      | Prototype anchor                     |
| --- | ------------------------------ | ------------------------------------------ | ------------------------------------ |
| 1   | Deliveries list (default)      | `/{locale}/deliveries`                     | `#deliveries`                        |
| 2   | List · empty (initial)         | `/{locale}/deliveries`                     | `#s9-deliveries-list-empty`          |
| 3   | List · empty (filtered)        | `/{locale}/deliveries?…`                   | `#s9-deliveries-list-empty-filtered` |
| 4   | List · loading                 | `/{locale}/deliveries`                     | `#s9-deliveries-list-loading`        |
| 5   | Delivery detail · `IN_TRANSIT` | `/{locale}/deliveries/[id]`                | `#s9-delivery-detail`                |
| 6   | Delivery detail · `DELIVERED`  | `/{locale}/deliveries/[id]`                | `#s9-delivery-detail-delivered`      |
| 7   | Delivery detail · `CANCELLED`  | `/{locale}/deliveries/[id]`                | `#s9-delivery-detail-cancelled`      |
| 8   | Create · from order            | `/{locale}/deliveries/new?sourceOrderId=…` | `#delivery-create`                   |
| 9   | Create · standalone            | `/{locale}/deliveries/new`                 | `#s9-delivery-create-standalone`     |
| 10  | Create · no eligible products  | `/{locale}/deliveries/new`                 | `#s9-delivery-create-empty`          |
| 11  | Edit delivery                  | `/{locale}/deliveries/[id]/edit`           | `#s9-delivery-edit`                  |
| 12  | Modal · mark delivered         | (detail overlay)                           | `#s9-delivery-mark-delivered-modal`  |
| 13  | Modal · cancel delivery        | (detail overlay)                           | `#s9-delivery-cancel-modal`          |
| 14  | Modal · delete delivery        | (detail overlay)                           | `#s9-delivery-delete-modal`          |
| 15  | Mobile · list                  | `/{locale}/deliveries`                     | `#s9-deliveries-list-mobile`         |
| 16  | Mobile · detail                | `/{locale}/deliveries/[id]`                | `#s9-delivery-detail-mobile`         |
| 17  | Mobile · create (step 2)       | `/{locale}/deliveries/new`                 | `#s9-delivery-create-mobile`         |
| 18  | Mobile · mark-delivered sheet  | (detail overlay)                           | `#s9-mark-delivered-sheet-mobile`    |
| 19  | Mobile · more-actions sheet    | (detail overlay)                           | `#s9-delivery-actions-sheet-mobile`  |

Requirements traced throughout: `FR-08-01 … FR-08-34`, `BR-08-01 … BR-08-07`,
`AC-08-01 … AC-08-05` (see [`frd-08-delivery-management.md`](./frd-08-delivery-management.md)).
Status-chip mapping is governed by [ADR 0002](../../../design/decisions/0002-status-chip-mapping.md);
the detail/aside grammar by [ADR 0003](../../../design/decisions/0003-demo-decisions.md).

---

## 2. Layout & structure per screen

All product screens live inside the collector **App Shell** (PUSH `Sidebar` + `Header`
topbar + content column) — see [interface-patterns.md → Layout & app shell](../../../design/interface-patterns.md).
The shell is system chrome and is **not** redefined here; only the content column is
Delivery-specific.

### 2.1 Deliveries list (`#deliveries`)

Vertical rhythm, top to bottom:

```
app-topbar (sticky)     título "Entregas" (desktop, no breadcrumb at list root)
page-heading            <h1>Entregas</h1> + meta "3 en camino · 24 recibidas"
orders-toolbar          search · FilterTriggerButton · sort select · [+ Nueva entrega]
orders-filter-chips     removable chips for active filters (default: "En camino")
card (tabular list)     header row + expandable rows + pagination
```

The list reuses the Orders tabular pattern verbatim. **Desktop columns** (left→right):
`[StoreAvatar s32] · Entrega / Tienda · Productos · Estado · Costo · Llegada est. · [expand chevron]`.

- **Entrega / Tienda**: store name in `font-weight 600`, then `DLV-YYYYMMDD-NN · enviada {fecha}`
  in `MonoCode` + secondary text.
- **Llegada est.**: compact range — `IN_TRANSIT` shows `"llega 15–22 may"` /
  `"esperada 25–30 abr"`; `DELIVERED` shows `"Recibida {fecha}"` (FR-08-31); `CANCELLED`
  shows `"—"`.
- **Terminal-state dimming**: `DELIVERED` rows at `opacity: 0.75`, `CANCELLED` at `0.6` —
  parity with `COMPLETED` orders. (See prototype rows 4 and 5.)

Each row is `data-expandable`; the chevron expands an inline **flat** product list (no
source-order grouping at list level — FR-08-32) ending in an `"Abrir detalle →"` link. The
default sort is **oldest → newest** (`deliveryDate ASC`, FR-08-30).

A thin right-aligned row above the list (below `orders-filter-chips`, shown only from 2 rows
up) carries a single `Expand all` / `Collapse all` toggle (`ExpandAllToggle`), the same
component and shared multi-open expansion mechanism used by the orders list — the desktop
table is no longer a single-open accordion. Its label always shows the _next_ action
(`"Expandir todo"` until every row is open, then `"Colapsar todo"`), while `aria-pressed`
carries the true `true`/`false`/`mixed` state for assistive tech.

### 2.2 Delivery detail (`#s9-delivery-detail` and state variants)

Two-column `detail-grid`: a main column + a **sticky aside** (ADR 0003 Decision 7).

```
app-topbar     breadcrumb "Entregas › DLV-YYYYMMDD-NN"  (id in JetBrains Mono)
back-link      "← Entregas"
detail-grid
  main         hero (top-accent) → Productos subcard (cool, expanded)
  aside        Resumen (cool) → Acciones (accent + zap) → Tu nota privada (warm)
```

The **aside order is frozen** (Resumen → Acciones → Nota) and the eyebrow vocabulary is
frozen (§9.17 of the workshop PLAYBOOK, now carried by ADR 0003). There is **no Historial
card** — BR-08-05 excludes the automatic timeline from the delivery MVP, unlike order
detail. Do not add it for symmetry.

**Hero anatomy** (`detail-hero.s8-card-accent`, `view-transition-name: dlv-{humanId}`):

1. `detail-hero-head`: `StoreAvatar s56` + store name + `DLV-…` with a copy button + status `Chip`.
2. `s8-eyebrow-chip`: `"Tu entrega · N productos"` (tone follows state: accent in transit,
   `tone-success` delivered, `tone-destructive` dimmed when cancelled).
3. **Protagonist block** (the divergence from Orders): label `"Llegada estimada"` →
   large range in `detail-hero-amount` → sub `"enviada el {fecha}"` → a temporal
   `progress` bar of the window → a muted caption carrying cost (`¥3.800 (≈ $24,70 USD)`
   when FX applies). When the delivery reads as pending FX reconciliation (derived per
   `FR-08-10a`: the stored rate does not convert into the current base currency) the converted
   amount is **suppressed** — the caption reads `"… · conversión pendiente"` and a
   `tone-warning` `"Tipo de cambio pendiente"` chip sits beside the status chip in the head —
   so a stale rate is never shown as a value. Resolved by editing the delivery, which saves the
   rate together with the base it converts into (the reconciliation path; mirrors the order FX chip).

**Per-state hero** (prototype anchors in parentheses):

| State                                         | Hero treatment                                                                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IN_TRANSIT` (`#s9-delivery-detail`)          | ETA window + progress + `"quedan N días…"`                                                                                                                                |
| `DELIVERED` (`#s9-delivery-detail-delivered`) | `"ENTREGA RECIBIDA"` uppercase in `--success` with `check-circle`, sub `"el {receivedDate} · enviada el {fecha}"` — parity with the uppercase paid-in-full hero of orders |
| `CANCELLED` (`#s9-delivery-detail-cancelled`) | `"ENTREGA CANCELADA"` uppercase in `--text-muted`; head at `opacity 0.8`; neutral `border-top` (no top-accent); note `"Los N productos volvieron a Listo en tienda…"`     |

**Productos subcard** (`subcard.is-open.s8-card-cool`, expanded by default): products are
grouped **by source order** (FR-08-18) — a mono uppercase label `"DESDE ORD-… · {fecha}"`
where `ORD-…` links to the order detail — then `item-row`s, each with an item-type icon, the
product name, an item-state chip (`s7-istate`: `En camino` / `Entregado` / `Listo en tienda`),
and read-only qty. Source-order grouping here is _traceability context_, not the primary
hierarchy: the collector reads one delivery first, then the origin of its products.

### 2.3 Create & edit (`#delivery-create`, `#s9-delivery-create-standalone`, `#s9-delivery-edit`)

**Create** is a 4-step `WizardAccordion` (one step open at a time; "Continuar" always
enabled, inline-validated on click — see [interface-patterns.md → Forms](../../../design/interface-patterns.md)
and the PLAYBOOK):

```
stepper      Tienda · Productos · Datos de la entrega · Confirmar
form-grid    wizard accordion (left)  +  form-sidebar (right: live Resumen only)
```

Two entry points share the wizard:

- **From order** (`#delivery-create`, `?sourceOrderId=…`): Step 1 is pre-completed via
  **field-as-attribute** (badge `"↳ Desde ORD-…"` + store + a "Cambiar" button — ADR 0001
  D2). Step 2 is active with the source order's products pre-selected; other eligible orders
  of the same store appear as **expanded, unchecked** groups (visible, not hidden). Back-link
  `"← Volver al pedido"`.
- **Standalone** (`#s9-delivery-create-standalone`, no params): Step 1 active with the
  `StoreCombobox` open; it lists **only stores with ≥1 eligible product** (FR-08-17), each
  option showing `"N productos sin entregar"`. Back-link `"← Entregas"`.

**Edit** (`#s9-delivery-edit`, `/[id]/edit`) is **not** a wizard: stacked, always-visible
section cards (parity with order-edit), CTA `"Guardar cambios"` + `"Descartar cambios"`. The
**store is immutable** (field-as-attribute with an explanatory helper); removed products take
a `--warning` tint with an inline `"Al guardar vuelve a Listo en tienda"`. Edit is only
reachable while `IN_TRANSIT` (FR-08-24).

The aside in both flows is a single **Resumen** card (AsideSummary). The "Atajos" card was
removed (R3, 2026-06-14); the only surviving shortcut is `⌘/Ctrl + Enter` to submit, shown
as plain text beside the step-4 CTA.

---

## 3. Visual treatment

Delivery Management introduces **no new tokens, palettes, surfaces, or type ramps.** It
consumes the Velvet system as-is. This section records only how the FRD _applies_ the
system; the definitions live in
[visual-foundations.md](../../../design/visual-foundations.md) and
[tokens-css.md](../../../design/tokens-css.md).

### 3.1 Color roles

| Role in this FRD                                                | Token / class                        | Where                                  |
| --------------------------------------------------------------- | ------------------------------------ | -------------------------------------- |
| Primary CTA (`Marcar como llegada`, `Crear entrega`, `Reabrir`) | `--accent` (Button primary)          | hero aside, wizard step 4              |
| Hero / Acciones surface accent                                  | `s8-card-accent` (top-accent border) | detail hero, Acciones card             |
| Resumen / Productos surface                                     | `s8-card-cool` (`--accent-cool`)     | aside Resumen, Productos subcard       |
| Private note surface                                            | `s8-card-warm` (`--accent-warm`)     | aside Tu nota privada                  |
| `IN_TRANSIT` status                                             | `--info`                             | `Chip info` + `s7-istate transit`      |
| Overdue (derived)                                               | `--warning`                          | `Chip warning` "Atrasada Nd"           |
| `DELIVERED` status                                              | `--success`                          | `Chip success` + uppercase hero        |
| `CANCELLED` status                                              | `--neutral` + `--text-muted`         | `Chip neutral` + dimmed hero           |
| Destructive (delete)                                            | `--destructive`                      | Button destructive-ghost, delete modal |

The **Chip-Eyebrow + Top-Accent** pattern (`s8-eyebrow-chip` + `s8-card-accent/cool/warm`)
is the system's section-identity device — see [interface-patterns.md](../../../design/interface-patterns.md).
Status color is **never** carried by color alone: every chip is icon + label
([ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md)).

### 3.2 Typography

- Store names and row titles: body semibold (`font-weight 600`).
- Delivery identifiers `DLV-YYYYMMDD-NN` and order identifiers `ORD-…`: **JetBrains Mono**
  via `MonoCode` (renders in `--text-secondary`, [ADR 0007](../../../design/decisions/0007-text-muted-outdoor-code-mono-reassignment.md)).
- The hero arrival window uses the large `detail-hero-amount` ramp — the _same_ slot that
  shows the money total in order detail, intentionally repurposed for the date range.
- Eyebrow chips and source-order labels use uppercase + wide tracking per the system.
- Numerals (cost, dates, counts) use the `.num` tabular treatment.

### 3.3 Shape, radius & elevation

Standard system values, no overrides: cards at the standard radius, pills/chips fully
rounded, border-first elevation (the system is border-led, not shadow-led). The cancelled
hero deliberately **drops** the top-accent and uses a neutral `border-top` to read as
"closed". Overlays (modals/sheets) use the system's elevated treatment via the canonical
`Modal`.

---

## 4. Components consumed

Everything below already exists in the catalog — see
[components.md](../../../design/components.md). Delivery Management is an **assembly of
existing components**; it must not fork or reinvent any of them.

| Component                              | Tier   | Role in FRD-08                                                                                                                                                                  |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Sidebar`, `Header`                    | module | App shell chrome (PUSH sidebar, breadcrumbs/lang/theme topbar)                                                                                                                  |
| `StoreAvatar`                          | core   | s32 in list rows, s56 in detail hero                                                                                                                                            |
| `MonoCode`                             | core   | `DLV-…` and `ORD-…` identifiers                                                                                                                                                 |
| `StatusChip`                           | core   | Delivery + item status, per [ADR 0002](../../../design/decisions/0002-status-chip-mapping.md)                                                                                   |
| `Button`                               | core   | primary / ghost / destructive-ghost hierarchy                                                                                                                                   |
| `CodeCopyButton`                       | core   | copy the `DLV-…` in the hero                                                                                                                                                    |
| `ViewTransitionLink`                   | core   | list row → detail (`view-transition-name: dlv-{humanId}`)                                                                                                                       |
| `FilterTriggerButton` + `FilterDrawer` | module | list filtering (FR-08-28/29)                                                                                                                                                    |
| `AppliedFilterChip`                    | core   | removable active-filter chips                                                                                                                                                   |
| `ListPagination` / `PerPageSelect`     | module | desktop summary + page-size select + numbered nav / mobile summary + "Cargar más" ([ADR 0018](../../../design/decisions/0018-list-pagination-page-size-and-desktop-summary.md)) |
| `WizardAccordion`                      | module | 4-step create flow                                                                                                                                                              |
| `StoreCombobox`                        | module | standalone store selection (eligible stores only)                                                                                                                               |
| `Checkbox`                             | core   | binary per-product selection (atomic unit, no qty selector — FR-08-04a)                                                                                                         |
| `DateInput` / `DateRangePickerInput`   | core   | shipping date / estimated arrival range                                                                                                                                         |
| `Select`                               | core   | sort, currency                                                                                                                                                                  |
| `CollapsibleSubcard`                   | module | Productos subcard, eligible-product groups                                                                                                                                      |
| `AsideSummary` / `DetailSidebar`       | module | Resumen / Acciones / Nota rail                                                                                                                                                  |
| `PrivateNoteCard`                      | module | inline-editable private note                                                                                                                                                    |
| `Modal` (`ModalDialog` / `ModalSheet`) | module | mark-delivered / cancel / delete overlays — [ADR 0008](../../../design/decisions/0008-modal-enhancement.md)                                                                     |
| `MobilePicker`                         | module | mobile date/currency pickers                                                                                                                                                    |
| `EmptyState`                           | module | initial empty, filtered empty, no-eligible-products                                                                                                                             |
| `Skeleton`                             | core   | list loading                                                                                                                                                                    |

New data needs (Phase B, not design): a `getDeliveriesForList` query and `markDelivered` /
`reopen` / `cancel` / `delete` / `updateNote` mutations. These are implementation contracts,
not design surfaces.

---

## 5. Interactions & states

### 5.1 Cross-cutting states

Owned by the system — see [states.md](../../../design/states.md) and
[ADR 0013](../../../design/decisions/0013-cross-cutting-state-system.md). FRD-08 instances:

- **Loading** (`#s9-deliveries-list-loading`): table skeleton (3 shimmer rows) + toolbar
  skeleton, `aria-busy="true"`. SSR-delivered — no fake client fallback.
- **Empty, initial** (`#s9-deliveries-list-empty`): `truck` accent icon-tile, `"Sin entregas
todavía"`, FRD copy, CTAs `[+ Nueva entrega]` (primary) + `[Ver mis pedidos]` (ghost).
- **Empty, filtered** (`#s9-deliveries-list-empty-filtered`): `search-x` muted icon, `"Sin
resultados con estos filtros"`, an echo of the search term, CTA `[Limpiar filtros]`; toolbar
  and chips stay visible.
- **No eligible products** (`#s9-delivery-create-empty`): `package-x` icon, `"Sin productos
elegibles"`, FRD copy, CTAs `[Ver mis pedidos]` (primary) + `[Volver a entregas]` (ghost).

There is **no route-error / 404 mock specific to deliveries** — those are system screens
(S10) and live in `docs/design`, not here.

### 5.2 Status-chip mapping (ADR 0002)

| State                                      | Chip label                             | Variant   | Icon           |
| ------------------------------------------ | -------------------------------------- | --------- | -------------- |
| `IN_TRANSIT`                               | `En camino`                            | `info`    | `truck`        |
| `IN_TRANSIT` + `expectedArrivalTo < today` | `Atrasada Nd` (derived, replaces base) | `warning` | `alert-circle` |
| `DELIVERED`                                | `Llegó`                                | `success` | `check-circle` |
| `CANCELLED`                                | `Cancelada`                            | `neutral` | `ban`          |

Item-level chips (`s7-istate`): `En camino` (transit), `Entregado` (delivered), `Listo en
tienda` (arrived).

### 5.3 Lifecycle actions (FR-08-26/27 — the action hierarchy)

One primary, one secondary, destructive in overflow — identical grammar to orders.

| State        | Primary                                   | Rest                                                                                         |
| ------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| `IN_TRANSIT` | **Marcar como llegada** (`package-check`) | Editar (ghost) · Cancelar (ghost) · Eliminar (destructive-ghost)                             |
| `DELIVERED`  | **Reabrir entrega** (`rotate-ccw`)        | Editar + Eliminar **disabled** with helper `"Reabre la entrega para editarla o eliminarla."` |
| `CANCELLED`  | **Reabrir entrega**                       | Eliminar (enabled) + helper `"Al reabrir, los productos vuelven a En camino."`               |

**Mark delivered** opens a modal (§5.4). **Reopen carries no modal** (non-destructive,
decision S9-D3): it runs directly with a neutral-undo toast (ADR 0001 D4).

### 5.4 Modals (adaptive — desktop dialog / mobile `ModalSheet`, ADR 0008)

- **Marcar como llegada** (`#s9-delivery-mark-delivered-modal`, `tone-success`,
  `package-check`): a required **Fecha de recepción** (date, ≤ today, default today) + a
  success info box `"Los N productos pasarán a Entregado y los pedidos origen se
actualizarán…"`; footer `Cancelar` ghost + `--success` CTA `"Marcar como llegada"` (FR-08-22).
- **Cancelar entrega** (`#s9-delivery-cancel-modal`, `tone-warning`, `ban`): explains the
  record is kept, products return to **Listo en tienda**, reversible via reopen; footer
  `Volver` + `--warning` CTA `"Cancelar entrega"`.
- **Eliminar entrega** (`#s9-delivery-delete-modal`, `tone-destructive`, `trash-2`):
  irreversible; products return to Listo en tienda; **source orders untouched**; a
  type-to-confirm input (`"Escribe eliminar para confirmar"`) gates the CTA. Only invokable
  in `IN_TRANSIT` / `CANCELLED` (BR-08-07).

### 5.5 Optimistic behavior & motion

All mutations are **optimistic** — see
[optimistic-client-updates.mdc] policy and [motion.md](../../../design/motion.md):

- Modal/sheet flows close **synchronously** on submit (Optimistic Confirmation); the
  hero/chips update locally; on failure they revert with a toast (the parent coordinator owns
  rollback).
- List row → detail uses **View Transitions** keyed `dlv-{humanId}` (the row's
  `view-transition-name` matches the detail hero).
- Within the wizard, only one step is expanded; advancing animates the accordion.
- Hover/press, reduced-motion, and the transform/opacity rule are all system-level and
  inherited unchanged.

> Note: the prototype approximates View Transitions with a CSS fade+slide and runs the
> mascot walk continuously; the canonical View Transitions API and the mascot cooldown are
> implementation concerns, not design changes.

---

## 6. Copy & voice

Voice is constant and tone is per-surface — see [ux-copy.md](../../../design/ux-copy.md)
and the workshop voice library. FRD-08 keeps the canonical glossary (`entrega ↔ delivery`,
`pedido ↔ order`, `tienda ↔ store`) — see [glossary.md](../../glossary.md). Strings
live in `src/i18n/locales/{es,en}/deliveries.json`.

Key strings (es), by surface and tone:

| Surface                  | Tone                   | String                                                                                                                         |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| List heading meta        | neutral, factual       | `"3 en camino · 24 recibidas"`                                                                                                 |
| List search placeholder  | helpful                | `"Código o producto (DLV-20260508-01, NGE OST…)"`                                                                              |
| Hero eyebrow             | warm-possessive        | `"Tu entrega · N productos"`                                                                                                   |
| Delivered hero           | celebratory-restrained | `"ENTREGA RECIBIDA"`                                                                                                           |
| Cancelled hero note      | reassuring             | `"Los N productos volvieron a Listo en tienda y quedaron disponibles para otra entrega."`                                      |
| Private note placeholder | inviting               | `"Escribe una nota o recordatorio para esta entrega…"`                                                                         |
| Private note helper      | concrete               | `"Número de tracking, instrucciones del courier o el contexto para retomarla después."`                                        |
| Mark-delivered info      | confidence-building    | `"Los N productos pasarán a Entregado y los pedidos origen se actualizarán. Podrás reabrir la entrega si algo no llegó bien."` |
| Empty (initial)          | encouraging            | `"Sin entregas todavía"`                                                                                                       |
| Empty (filtered)         | neutral                | `"Sin resultados con estos filtros"`                                                                                           |
| No eligible              | explanatory            | `"Sin productos elegibles"`                                                                                                    |
| Edit, immutable store    | explanatory            | `"La tienda no se puede cambiar: los productos de la entrega dependen de ella…"`                                               |
| Submit shortcut          | quiet                  | `"o presiona ⌘ Enter"`                                                                                                         |

Tone rule for this FRD: **confirmations and errors carry no mascot** (decálogo #6); the
panda appears only in the celebratory/empty register.

---

## 7. Responsive

Mobile-first; desktop is extra room (decálogo #10). Breakpoint behavior is the system's —
see [interface-patterns.md → Responsive](../../../design/interface-patterns.md). FRD-08
specifics:

- **List → cards** (`#s9-deliveries-list-mobile`): the tabular rows collapse into vertical
  `s7-mob-card`s (StoreAvatar s40, store title, `DLV-… · enviada {fecha}`, status chip, meta
  `"N productos · llega X–Y"` + cost). The action row is search + icon-only
  `FilterTriggerButton` (with count badge) + `[+ Nueva]`; chips stay removable; footer is a
  results summary + `"Cargar más"` — the shared `ListPagination` mobile layout, no numbered
  pages or per-page selector on mobile ([ADR 0018](../../../design/decisions/0018-list-pagination-page-size-and-desktop-summary.md)).
- **Detail → stacked** (`#s9-delivery-detail-mobile`): hero → grouped products → Resumen →
  Nota, with a **sticky single-primary action bar** (`[⋯] [Editar accent] [Marcar llegada
primary]`); `⋯` opens the more-actions sheet (`#s9-delivery-actions-sheet-mobile`). The
  bar background uses `color-mix(in oklab, …)` + blur — **`oklab`, not `oklch`** (lesson
  L074); the main column gets bottom padding so the bar never occludes content.
- **Create → mobile wizard** (`#s9-delivery-create-mobile`): a compact `"Paso 2 de 4 ·
Productos"` eyebrow, compact field-as-attribute, sticky footer `[Atrás] [counter]
[Continuar →]`; date/currency use `MobilePicker`.
- **Modals → sheets**: mark-delivered (`#s9-mark-delivered-sheet-mobile`) and more-actions
  (`#s9-delivery-actions-sheet-mobile`) render as `ModalSheet` (vaul) on mobile.

Known issue inherited from the order list: the mobile action row can overflow the viewport
by a few pixels at 390px (tracked in the FRD).

---

## 8. Accessibility (FRD-08 specifics)

Baseline is WCAG 2.2 AA in both themes (decálogo #8). System-wide a11y rules live in
[interface-patterns.md → Accessibility](../../../design/interface-patterns.md). What
matters specifically here:

- **Status never by color alone**: every delivery/item chip is icon + label
  ([ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md)).
- **Expandable rows**: `aria-expanded` on the chevron; expansion is keyboard-operable.
- **Disabled actions explain themselves**: in `DELIVERED`, Editar/Eliminar are not opacity-only
  — a textual helper states _why_ they're disabled (reopen first).
- **Modals**: `role="dialog"` / `alertdialog` + `aria-modal` + `aria-labelledby`; the
  type-to-confirm delete input is a real labelled field.
- **Copy button**: the hero `DLV-…` copy control has an `aria-label` (`"Copiar código de
entrega"`).
- **Product selection** in the wizard: each `Checkbox` is keyboard-operable (Space); eligible
  groups expose `aria-expanded`; inline validation is announceable (`role="alert"`).
- **Sticky mobile bar**: does not trap focus and does not cover content (padding-bottom on
  the scroll container).
- **Forms**: every field labelled; the required asterisk has accessible text; the
  `StoreCombobox` uses `role="combobox/listbox/option"`.

---

## 9. Sources & provenance

- **Pixel truth**: [`./prototype/delivery-management.html`](./prototype/delivery-management.html)
  (self-contained; opens standalone in light + dark; default palette Velvet). Verified S15.
- **System rules**: [`docs/design/`](../../../design/README.md) — visual-foundations,
  tokens-css, interface-patterns, components, motion, states, ux-copy, and ADRs
  0001/0002/0003/0006/0007/0008/0011/0013.
- **Functional contract**: [`frd-08-delivery-management.md`](./frd-08-delivery-management.md)
  and its blueprint/work-orders.
- **Workshop raw material (historical)**: distilled from the redesign subproject; see git history. This FDD + the prototype are the
  durable record.

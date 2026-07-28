---
id: FDD-06
type: FDD
slug: dashboard
title: Dashboard — Feature Design Document
status: ACTIVE
parent: FRD-06
last_updated: 2026-07-11
prototype: ./prototype/dashboard.html
design_system: ../../../design/README.md
demo_anchors:
  - "#dashboard"
  - "#d6-dashboard-empty"
  - "#d6-dashboard-over-budget"
  - "#d6-dashboard-no-budget"
  - "#d6-dashboard-loading"
  - "#d6-dashboard-mobile"
---

# FDD-06 · Dashboard — Feature Design Document

> **What this document is.** The FDD is "the prototype in words": the durable, text
> form of the visual and interaction design for FRD-06, so the feature's design is
> reconstructible without depending on the redesign subproject. It pairs with the
> self-contained prototype at [`./prototype/dashboard.html`](./prototype/dashboard.html)
> (the pixel truth) and is governed by the design system in
> [`docs/design/`](../../../design/README.md) (the system rules).
>
> **Three-source rule.** This document **references** the design system for system-wide
> rules (tokens, components, motion, states, copy voice), **describes** what is specific
> to the Dashboard, and **cites the prototype** for the exact pixel. When this FDD and the
> design system disagree on a system-wide rule, `docs/design/` wins. When this FDD and the
> prototype disagree on a Dashboard-specific visual, the prototype wins until this FDD is
> corrected in the same change.
>
> **Language.** Prose is English (repository docs convention); user-facing copy is quoted
> verbatim in Spanish (`es` is the default locale). The `en` equivalents live in
> `src/i18n/locales/en/dashboard.json`.

---

## 1. Overview & screens covered

The Dashboard ("Hoy") is the **first private screen after sign-in** (`FR-06-01`). Its job
is to turn scattered order, payment, and delivery data into the few money and collection
decisions a collector actually makes, **all in the user's base currency** (`FR-06-14`). It
is **read-only** (`FR-06-15`): it aggregates existing domain data and every actionable
element is a navigation link into the surface that owns the mutation (orders, deliveries,
stores, settings). There are no Dashboard-local mutations, no forms, no wizards, no modals.

The Dashboard is **not a sibling list/detail workspace** like Orders (FRD-05) or Deliveries
(FRD-08). It is a single scrollable **read-only overview** built from the same shell and the
same card grammar (Chip-Eyebrow + Top-Accent surfaces, status chips, `num` tabular figures),
laid out as a responsive **12-column grid of stacked zones**. The primary design constraint
is _glance-ability_: the protagonist number of each zone leads, supporting detail is demoted,
and color status is always paired with an icon/label cue.

Reading order, top to bottom, and its functional-group mapping:

1. **KPI overview strip** — a low-weight roll-up of `FR-06-11` totals (base currency, `FR-06-14`)
2. **Caja y obligaciones** — `FR-06-02 … FR-06-05`, `FR-06-19`, `FR-06-13`
3. **Presupuesto** — `FR-06-06`
4. **Puntualidad de llegadas** — `FR-06-17`
5. **Tendencias** (three range-scoped line charts) — `FR-06-07`, `FR-06-08`, `FR-06-09`, `FR-06-21`, `FR-06-12`
6. **Movimiento de pedidos** (recent / upcoming / overdue tabs) — `FR-06-10`
7. **Próximos pagos** — `FR-06-18` (`FR-06-04`, `FR-06-07`)
8. **Colección** — `FR-06-11`, `FR-06-20`

The **empty / first-run** state (`FR-06-22`) is a full screen of its own.

### Screens in this FDD

| #   | Screen                        | Route                 | Prototype anchor            |
| --- | ----------------------------- | --------------------- | --------------------------- |
| 1   | Dashboard (default)           | `/{locale}/dashboard` | `#dashboard`                |
| 2   | Dashboard · empty / first-run | `/{locale}/dashboard` | `#d6-dashboard-empty`       |
| 3   | Dashboard · over-budget       | `/{locale}/dashboard` | `#d6-dashboard-over-budget` |
| 4   | Dashboard · no-budget         | `/{locale}/dashboard` | `#d6-dashboard-no-budget`   |
| 5   | Dashboard · loading           | `/{locale}/dashboard` | `#d6-dashboard-loading`     |
| 6   | Dashboard · mobile            | `/{locale}/dashboard` | `#d6-dashboard-mobile`      |

Requirements traced throughout: `FR-06-01 … FR-06-22`, `BR-06-01 … BR-06-08`,
`AC-06-01 … AC-06-07` (see [`frd-06-dashboard.md`](./frd-06-dashboard.md)).
Status-chip mapping is governed by [ADR 0002](../../../design/decisions/0002-status-chip-mapping.md);
the tinted icon-tile treatment by [ADR 0005](../../../design/decisions/0005-dashboard-microstat-icon-tile.md);
the icon+label status contract by [ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md).

---

## 2. Layout & structure per screen

All product screens live inside the collector **App Shell** (PUSH `Sidebar` + `Header`
topbar + content column) — see [interface-patterns.md → Layout & app shell](../../../design/interface-patterns.md).
The shell is system chrome and is **not** redefined here; only the content column is
Dashboard-specific. The active sidebar item is **Hoy** (`layout-dashboard`).

### 2.1 Dashboard (`#dashboard`)

Vertical rhythm, top to bottom:

```
app-topbar (sticky)     título "Hoy" (desktop)
page-heading            <h1>Hola, Sergio</h1> + meta "jueves 18 jun · todo en S/ (soles)"
dash-grid               12-col grid on desktop (≥1024px), single column below
```

The greeting heading is a Dashboard-specific affordance (not used by the list workspaces):
it reinforces the "home" register and carries the **base-currency reminder** in its meta
(`FR-06-14`). The body is `.dash-grid` — a single column below `1024px`, `repeat(12, 1fr)`
with a `20px` gap above it, capped by the shell content width. Zone spans, desktop-side:

```
KPI overview strip        dash-span-12   (kpi-strip · 4 tinted tiles)
ZONA 1 Caja y oblig.      dash-span-8    (s8-card-accent · top-accent · dash-stretch)
Right column              dash-span-4    (right-stack · Presupuesto + Puntualidad)
ZONA 3 Tendencias         dash-span-12   (top-warm · scoped range picker + 3 line charts)
ZONA 4b Movimiento        dash-span-6    (top-info · tabbed activity)
ZONA 4c Próximos pagos    dash-span-6    (top-warning · itemized payments)
ZONA 5 Colección          dash-span-12   (s8-card-warm · top-warm)
```

The top-accent / colored-edge variants give each zone a section identity without inventing new
chrome: cash leads with the **accent** edge (the primary decision), budget is **cool** (a calm
gauge), punctuality is **success**, trends and collection are **warm**, activity is **info**,
and upcoming payments is **warning**. Colored edges are the system's `top-*` hairline, not
filled backgrounds, so the surfaces stay quiet.

### 2.2 Zone anatomy

**KPI overview strip** (`dash-span-12`, `.kpi-strip`). A row of **four real cards** — each on
`--surface-elevated` with a hairline border, a **3px colored top edge**, and a **tinted lucide
icon tile** (`14%`-mix background in its accent). The four accents are in a **fixed order**
(`accent → cool → warm → success`), one metric each: **Pedidos** (`package`, `38`),
**Productos** (`boxes`, `112`), **Valor de pedidos** (`wallet`, `S/ 18,400`), **Tiendas** (`store`,
`9`). This is a low-weight glance summary of `FR-06-11` totals; "Valor de pedidos" (`Order.totalCost`,
paid + still owed — the word "comprometido" is avoided as confusing) is labeled distinctly so it is
never read as disbursed spend, and carries an always-available tooltip explaining it. The
partial/complete state is shown by the icon only (info-toned; warning-toned naming the excluded
count when FX-unreconciled orders are dropped), never by changing the label — no separate caption
(`BR-06-05`). Money uses thousand separators. Tinted-icon treatment per [ADR 0005](../../../design/decisions/0005-dashboard-microstat-icon-tile.md).

**ZONA 1 · Caja y obligaciones** (`s8-card-accent top-accent`, span-8, stretched to the row).
Eyebrow `wallet · "Caja y obligaciones"`, title `"Lo que tienes que tener listo"`, a
`"Ver pedidos →"` link. Body, stacked:

- **A pagar este mes** — the protagonist `kpi-amount` (`S/ 1.840,00`) with a `kpi-sub` naming
  the folded-in overdue portion: `"Incluye S/ 520,00 ya atrasados de pedidos cuya llegada
estimada ya pasó."` (`FR-06-02`, `BR-06-01`).
- **Próximos meses** — a **framed mini bar chart** (`.mini-chart`): a bordered surface with a
  baseline axis and faint gridlines, five month columns (`jul … nov`), each a `.mini-bar` whose
  height encodes the outstanding total, with the amount + month label below (`FR-06-03`,
  `BR-06-02`). The whole chart is a single `role="img"` with an aria-label enumerating the five
  values.
- **Pagado vs pendiente** — a segmented `.paidbar`: `seg-paid` in `--success` and `seg-pending`
  in a warning-tone mix (`color-mix(--warning 82%, --text-primary)`). The `.paidbar-label`
  states the committed total (`Comprometido S/ 18.400 en toda la colección`) and the
  `.paidbar-ends` legend splits it into **Pagado S/ 13.790** and **Pendiente · deuda viva
  S/ 4.610** — i.e. committed = paid + deuda viva (`FR-06-19`, `FR-06-04`, `BR-06-08`).
- **Deuda sin fecha** — a `kpi-sub` informative note: `"Además, S/ 760,00 en pedidos sin fecha
de llegada estimada — informativo, fuera de los totales por mes."` (`FR-06-05`, `BR-06-02`).
- The **FX partial-totals warning** (`.fx-warning`) closes the zone when any order is FX-pending
  (`FR-06-13`, see §5.3).

**Right column** (`dash-span-4 dash-stretch right-stack`). A **flex column** (`height:100%`,
gap `18px`) that fills the height of Caja. It holds two cards, both `rc-grow` (`flex:1 1 0`,
vertically centered):

- **ZONA 2 · Presupuesto** (`s8-card-cool top-cool`). Eyebrow `gauge · "Presupuesto"`, title
  `"Este ciclo"`. The hero is `consumed / budget` (`S/ 1.290 / 2.000`) with a `kpi-sub`
  reminding that this is the **budget cycle** and equals disbursed-this-month; then a
  `.budget-meter` whose fill class encodes the band (`is-ok` `< 80%` green / `is-warn`
  `80–100%` amber / `is-over` `> 100%` red), and a `.budget-legend` pairing a status **chip**
  (icon + label, `"65% · vas bien"`) with the remaining amount (`"Quedan S/ 710"`) (`FR-06-06`,
  `BR-06-03`).
- **ZONA 2b · Puntualidad de llegadas** (`top-success`). Eyebrow `clock · "Puntualidad"`, title
  `"Llegadas a tiempo"`. A donut splits **on-time** (`--success`) vs **late** (`--warning`),
  center reads `78% · A tiempo`, followed by a two-row legend and a plain-language `kpi-sub`
  (`"De cada 10 pedidos, unos 8 llegan dentro de la ventana estimada."`) (`FR-06-17`).

> **Adaptive-donut rule (load-bearing).** The Puntualidad donut is the **flexible element** of
> the right column. It uses `.donut.is-fluid` (`width:auto; aspect-ratio:1/1; height:100%;
max-width:100%; max-height:280px`), horizontally centered inside a `flex:1 1 auto` slot. Both
> right-column cards are `rc-grow`, and the column is stretched to Caja's height. Because Caja is
> **taller when the FX warning shows** and **shorter when it does not**, the donut **grows or
> shrinks** (staying square, up to ~280px) to absorb the difference, so Presupuesto + Puntualidad
> always match the Caja card's height with no dead space. The donut is the single element that
> flexes; Presupuesto's content stays fixed.

**ZONA 3 · Tendencias** (`top-warm`, span-12). A **scoped charts section**. The header
(`.charts-head`) carries the eyebrow `line-chart · "Gráficos"`, the title `"Tendencias"`, a
one-line note that the range applies **only** to these charts, and — pinned to the right — the
**date-range picker** (§5.4). Below, a `.charts-grid` of **three hand-rolled SVG line charts**:

- **Gasto por mes** — single series, filled **area** in `--accent`, a **direct last-point
  label** (`S/ 1,290`), and hover crosshair + tooltip (`FR-06-07`, `FR-06-08`, `BR-06-04`). The
  series is order payments **plus** delivery shipping cost, merged into one total per month —
  delivery cost is never plotted as its own series (`BR-06-09`).
- **Pedidos hechos vs llegados** — two series with a text legend (`Hechos` `--accent` /
  `Llegados` `--accent-cool`) and hover (`FR-06-09`, `BR-06-06`). "Arrived" means an order has at
  least one item that has **left the `NONE` delivery state** (`AC-06-07`).
- **Deuda viva** — single series trend, area in `--warning`, direct last-point label
  (`S/ 4,610`): the outstanding balance at each month's close (`FR-06-21`).

Each chart is a `600×220` viewBox with four gridlines, an axis-label row, dots per point, an
optional area polygon and last-point label, plus a hover crosshair (`lc-cross`), per-series hover
dots (`lc-hoverdot`), and a floating tooltip (`lc-tip`). The current-month points are reconciled
to the cards (spend ends at `1.290`, deuda viva ends at `4.610`).

**ZONA 4b · Movimiento de pedidos** (`top-info`, span-6). Eyebrow `list · "Movimiento de
pedidos"` (the visible `h2` is visually hidden — the eyebrow is the label). Below the eyebrow, a
`.mini-tabs` switcher (`Últimos` / `Próximas llegadas` / `Atrasados` with a count `badge`) drives
three `.activity-pane`s (`FR-06-10`):

- **Últimos** (recent ~10 by order date): `.activity-item` rows — `StoreAvatar s32` + store name
  - `MonoCode` `ORD-…` + amount + date. The FX-pending Surugaya row shows `¥ 9.800` and
    `"12 jun · FX pendiente"` (order currency, not a misleading base figure). Footer link
    `"Ver todos los pedidos →"`.
- **Próximas llegadas** (next 30 days): rows with an `info` chip `"llega {fecha}"` (`truck`),
  footer `"Ir a entregas →"`.
- **Atrasados** (overdue): rows with a `warning` chip `"atrasado Nd"` (`alert-circle`), footer
  `"Revisar atrasados →"`.

**ZONA 4c · Próximos pagos** (`top-warning`, span-6). Eyebrow `alarm-clock · "Próximos pagos"`,
title `"Lo que toca pagar"`. An itemized list of upcoming payments (`FR-06-18`): each row is a
`StoreAvatar` · amount (`num`) · a due-date chip. The **nearest** payment carries a `warning`
`"vence pronto"` chip (`calendar-clock`); the rest carry an `info` `"vence {fecha}"` chip
(`calendar`). A single left-aligned `"Ver pedidos →"` link closes the zone — **no divider and no
total footer**.

**ZONA 5 · Colección** (`s8-card-warm top-warm`, span-12). Eyebrow `boxes · "Tu colección"`,
title `"El panorama completo"`, a `"Ver tiendas →"` link (`FR-06-11`, `FR-06-20`). Body:

- **Por estado del pedido** — a slim **stacked status bar** (`.status-bar`: `sg-open` /
  `sg-transit` / `sg-done` / `sg-cancel`) plus a chip legend `Abierto` (accent, `circle-dot`) ·
  `En camino` (info, `truck`) · `Completo` (success, `circle-check`) · `Cancelado` (neutral,
  `ban`), each with its count.
- **coll-row ×2** — four distribution blocks laid out as **two rows of two columns** (`.coll-row`)
  so the bar lists get the full column width. **Row 1 (two donuts):** **Gasto por categoría · dinero** (donut
  with the committed total in its center + legend rows; the center value is **abbreviated** when
  large — `S/ 234.3K`, `S/ 1.2M` — so it always fits the ring, with the full grouped amount on a
  hover `title`) · **Productos por estado de entrega** (a
  second donut, item quantity split by delivery state — `Entregado` `--success` / `En camino`
  `--info` / `Listo en tienda` `--accent-warm` / `Pendiente en tienda` neutral, empty states
  dropped; center shows the product count. Labels are shared with the item-delivery `StatusChip`).
  **Row 2 (two ranked bar lists):** **Productos por categoría · conteo** (count bars, `FR-06-20`) ·
  **Tiendas top** (a ranked `.dist-row` list, `StoreAvatar s24` + amount). In both bar lists the
  name sits in a fixed-width column so every bar starts at the same x and spans the remaining
  width; long names truncate with a native `title` tooltip for the full text.

### 2.3 State variants

- **Empty / first-run** (`#d6-dashboard-empty`): see §5.1 and §5.2 — every zone in a calm
  empty/CTA state, no fake data (`FR-06-22`).
- **Over-budget** (`#d6-dashboard-over-budget`): only the budget zone changes — fill goes
  `is-over` (red **plus** a diagonal hatch), chip becomes `destructive` `"122% · pasado"`,
  remainder flips to a destructive `"S/ 430 de más"`, and a caption states the hatch marks the
  excess without relying on color. The prototype isolates the budget card plus a stub of the
  Desembolso card for focus; in production the full grid renders with only the budget zone in
  this state.
- **No-budget** (`#d6-dashboard-no-budget`): the budget zone swaps the meter for a `.config-cta`
  block — a `target` icon-tile, an explanatory line, and a primary CTA `"Configurar
presupuesto"` → settings (`FR-06-06`). No meaningless percentage is shown.
- **Loading** (`#d6-dashboard-loading`): the content column is `aria-busy="true"` and the grid is
  filled with `Skeleton` shapes mirroring the zone silhouettes (KPI/hero, gauge, bar block, list
  rows). SSR-delivered — no fake client fallback (see [states.md](../../../design/states.md)).
- **Mobile** (`#d6-dashboard-mobile`): see §7.

---

## 3. Visual treatment

The Dashboard introduces **no new tokens, palettes, surfaces, or type ramps.** It consumes the
Velvet system as-is. This section records only how the FRD _applies_ the system; the definitions
live in [visual-foundations.md](../../../design/visual-foundations.md) and
[tokens-css.md](../../../design/tokens-css.md).

### 3.1 Color roles

| Role in this FRD                                | Token / class                                                | Where                                          |
| ----------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| KPI-tile accents (fixed 4-color order)          | `--accent` / `--accent-cool` / `--accent-warm` / `--success` | KPI strip top edges + icon tiles               |
| Cash zone section identity (primary decision)   | `s8-card-accent` (top-accent)                                | Zona 1                                         |
| Budget zone section identity                    | `s8-card-cool` (`--accent-cool`)                             | Presupuesto                                    |
| Punctuality / trends / collection identity      | `--success` / `--accent-warm`                                | Puntualidad, Tendencias, Colección top edges   |
| Paid segment / on-time / budget OK / spend line | `--success` (paid) / `--accent` (spend)                      | paidbar, punt donut, meter `is-ok`, gasto line |
| Pending / late / budget warn / debt line        | warning-tone (`--warning` mixes)                             | paidbar pending, punt donut late, deuda line   |
| Placed vs arrived series                        | `--accent` / `--accent-cool`                                 | hechos-vs-llegados line chart                  |
| Budget over (> 100%) + FX warning               | `--destructive` / `--warning`                                | meter `is-over` (+ hatch); `.fx-warning`       |
| Upcoming/overdue activity + nearest payment     | `--info` / `--warning`                                       | activity chips, próximos-pagos chips           |
| Collection status distribution                  | accent / info / success / neutral                            | `.status-bar` + legend chips                   |

The **Chip-Eyebrow + Top-Accent** pattern is the system's section-identity device — see
[interface-patterns.md](../../../design/interface-patterns.md). Status is **never** carried by
color alone: every percentage/status chip is icon + label, and the over-budget meter adds a
**diagonal hatch** so "over" is distinguishable without color
([ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md)).

### 3.2 Typography

- Zone protagonist figures use the large `kpi-amount` ramp (weight 700, tight tracking) — the
  Dashboard's equivalent of the order/delivery hero amount.
- `kpi-label` is the uppercase, wide-tracked muted caption above each figure.
- Order identifiers `ORD-…` in activity/payment lists render in **JetBrains Mono**
  ([ADR 0007](../../../design/decisions/0007-text-muted-outdoor-code-mono-reassignment.md)).
- All monetary and count values use the `.num` tabular-figures treatment so columns align.
- Eyebrow chips and section kpi-labels use uppercase + wide tracking per the system.

### 3.3 Shape, radius & elevation

Standard system values, no overrides: cards at the standard radius, pills/chips and bars fully
rounded, KPI tiles and the `.mini-chart` on `--surface-elevated` with hairline borders,
border-first elevation (the system is border-led, not shadow-led). Charts are border-free
hand-rolled SVG (line charts) or CSS bars (mini-chart, dist bars, status bar); donuts are SVG
rings; the budget meter is a rounded track filled with a token color.

---

## 4. Components consumed

Everything below already exists in the catalog — see
[components.md](../../../design/components.md). The Dashboard is an **assembly of existing
components**; it must not fork or reinvent any of them.

| Component                               | Tier   | Role in FRD-06                                                      |
| --------------------------------------- | ------ | ------------------------------------------------------------------- |
| `Sidebar`, `Header`                     | module | App shell chrome (PUSH sidebar, lang/theme topbar)                  |
| `AppPageHero` / page-heading            | module | Greeting `<h1>` + base-currency meta                                |
| `StatusChip`                            | core   | Budget/status chips, activity chips, status distribution (ADR 0002) |
| `StoreAvatar`                           | core   | `s32` in activity/payment rows, `s24` in "tiendas top"              |
| `MonoCode`                              | core   | `ORD-…` identifiers in activity/payment lists                       |
| `Button` (`link` / `primary` / `ghost`) | core   | "Ver pedidos →" links, empty-state CTAs, "Configurar presupuesto"   |
| `ViewTransitionLink`                    | core   | activity/payment row / zone link → owning surface                   |
| `Skeleton`                              | core   | loading-state silhouettes                                           |
| `EmptyState`                            | module | empty/first-run zone states, no-budget configure block              |

**Dashboard-specific presentational pieces** (candidates for promotion to
[components.md](../../../design/components.md) **if reused elsewhere** — flagged here, not defined
as FDD-local system rules, not yet added to the catalog):

| Piece              | What it is                                                                             |
| ------------------ | -------------------------------------------------------------------------------------- |
| `KpiBlock`         | `kpi-label` + `kpi-amount` + optional `kpi-sub` — the zone protagonist                 |
| `BudgetMeter`      | rounded track + status-banded fill (`is-ok` / `is-warn` / `is-over` + hatch)           |
| `Bar` (mini-chart) | the framed CSS mini bar chart (surface + baseline axis + faint gridlines)              |
| `LineChart`        | hand-rolled SVG line/area chart with legend, last-point label, hover crosshair/tooltip |
| `Donut`            | SVG ring chart (fixed-size in collection; **adaptive `is-fluid`** in punctuality)      |
| `RangeControl`     | trigger + popover (preset chips + custom from→to calendar) scoped to the trend charts  |
| `PaidBar`          | the segmented paid-vs-pending bar with dot legend                                      |
| `FxPartialNotice`  | the `.fx-warning` banner                                                               |
| `StatusStackedBar` | the slim collection status bar + chip legend                                           |
| `PaymentsTable`    | the itemized upcoming-payments list (avatar · amount · due chip)                       |

These are **chart/metric presentation primitives**, not new design-system tokens. New data needs
(Phase B, not design): a single `getDashboardAggregate` query payload plus the range-scoped trend
series. These are implementation contracts, not design surfaces.

---

## 5. Interactions & states

### 5.1 Cross-cutting states

Owned by the system — see [states.md](../../../design/states.md) and
[ADR 0013](../../../design/decisions/0013-cross-cutting-state-system.md). FRD-06 instances:

- **Loading** (`#d6-dashboard-loading`): per-zone `Skeleton` silhouettes inside an
  `aria-busy="true"` content column. SSR-delivered, no client fallback.
- **Empty / first-run** (`#d6-dashboard-empty`): a full-screen calm empty state — see §5.2.
- **No-budget** (`#d6-dashboard-no-budget`): budget-zone configure affordance instead of a
  percentage.
- There is **no Dashboard-specific 404 / route-error mock** — those are system screens and live
  in `docs/design`, not here.

### 5.2 Empty / first-run state (`FR-06-22`)

For a brand-new collector with nothing recorded, no budget, and nothing owed, **every zone shows
a calm empty or CTA state — never fake data**:

- **KPI strip**: the four tiles keep their tinted edges/icons but show `0` / `S/ 0` in muted text.
- **Caja y obligaciones**: `A pagar este mes` reads `S/ 0,00` (muted) above an `.empty-zone`
  (`piggy-bank`) `"No debes nada por ahora"` with an explanatory line.
- **Presupuesto**: the `.config-cta` block (`target` icon) with `"Configurar presupuesto"` →
  settings — same affordance as the no-budget state.
- **Puntualidad**: a quiet `.empty-zone` (`clock` ring) `"Aún no hay entregas para medir la
puntualidad."`
- **Tendencias**: the range picker is **inert/disabled**; each of the three charts shows a small
  `.empty-zone sm` `"Aún no hay datos suficientes."`
- **Movimiento de pedidos**: an `.empty-zone` (`package-plus`) `"Todavía no registraste pedidos"`
  with the primary CTA `"Crear tu primer pedido"` → orders.
- **Próximos pagos**: an `.empty-zone` (`calendar-check`) `"No tienes pagos próximos"`.
- **Colección**: an `.empty-zone` (`sparkles`) `"Tu colección aparecerá aquí"` with a ghost CTA
  `"Explorar tiendas"` → stores.

The two "first action" CTAs (create first order, explore stores) are the intended activation path;
the stores link uses the preference-driven URL helper, not a hardcoded `/stores` (`FR-06-16`).

### 5.3 FX partial-totals warning (`FR-06-13`, `AC-06-05`)

When at least one order is flagged `needsExchangeRateUpdate` (currency ≠ base, not cancelled),
base-currency roll-ups **exclude** those orders and the cash zone shows a `warning`-toned
`.fx-warning` banner (`role="status"`): an `alert-triangle` icon, the explanation that totals are
**partial until reconciliation**, and a `"Reconciliar tipo de cambio"` link to the orders
reconciliation flow. The prototype seeds two FX-pending orders so the banner is visible by
default; the Surugaya order also appears in the recent-activity list captioned `"FX pendiente"` and
shown in **order currency** (`¥`) rather than a misleading base-currency figure. The banner's
presence is what makes Caja taller, which the right column's adaptive donut absorbs (§2.2).

### 5.4 Range picker (`FR-06-12`, `AC-06-06`)

The trend section owns a single **date-range picker** pinned to its header, applying **only** to
its three line charts. It is a trigger + popover:

- **Trigger** (`.range-trigger`, `aria-haspopup="dialog"`, `aria-expanded`): a `calendar` icon, a
  label (default `"Últimos 6 meses"`), and a chevron.
- **Popover** (`role="dialog"`): a **Rangos rápidos** group of preset chips — `3 m`, `6 m`
  (default active), `12 m`, `Año en curso` (YTD), `Todo` — then a separator and a **Rango
  personalizado** single-month calendar (prev/next nav, Monday-first grid) that selects a
  **from → day → to** range, gated by an `"Aplicar rango"` button that stays disabled until both
  ends are chosen. Picking a preset resets any custom selection and re-labels the trigger; both
  paths re-render all three charts and close the popover with focus returned to the trigger.

Selecting a range re-renders **only** the trend charts. It does **not** touch the current-month
figures (a pagar este mes, presupuesto/desembolsado este mes) or the collection roll-ups — those
are fixed to the active period (`FR-06-12`).

> Note: the prototype regenerates plausible monthly points deterministically per range purely to
> demonstrate that the control drives its charts and nothing else, and reconciles the last point of
> the spend and debt charts to the card figures. Real series come from the aggregation payload.

### 5.5 Activity tabs & read-only model

The `.mini-tabs` in Movimiento de pedidos toggle `is-active` panes locally (recent / upcoming /
overdue). Per `FR-06-15`, the Dashboard performs **no mutations**: every interactive element is
exactly one of (a) a navigation link/CTA into the owning surface, (b) the chart range picker, or
(c) the activity tab switcher — and (b)/(c) only re-render local presentation. There are no
optimistic updates, confirm modals, or inline editing. This is the deliberate inverse of the
optimistic-mutation default that governs the list workspaces.

### 5.6 Motion

Inherited from the system — see [motion.md](../../../design/motion.md) and
[ADR 0014](../../../design/decisions/0014-motion-system-and-view-transitions.md). Bars, the budget
fill, and chart lines animate on the emphasis curve; tab and preset changes are opacity/transform
only; reduced-motion is honored at the system level. The prototype approximates inter-screen
transitions with a CSS fade+slide — the canonical View Transitions API is an implementation
concern.

---

## 6. Copy & voice

Voice is constant and tone is per-surface — see [ux-copy.md](../../../design/ux-copy.md). The
Dashboard keeps the canonical glossary (`pedido ↔ order`, `entrega ↔ delivery`, `tienda ↔ store`)
— see [glossary.md](../../glossary.md). Strings live in `src/i18n/locales/{es,en}/dashboard.json`.

Key strings (es), by surface and tone:

| Surface               | Tone                   | String                                                                                                                                  |
| --------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Greeting              | warm, personal         | `"Hola, Sergio"` + meta `"jueves 18 jun · todo en S/ (soles)"`                                                                          |
| Cash zone title       | direct, plain          | `"Lo que tienes que tener listo"`                                                                                                       |
| A pagar — overdue sub | concrete               | `"Incluye S/ 520,00 ya atrasados de pedidos cuya llegada estimada ya pasó."`                                                            |
| Deuda sin fecha note  | reassuring             | `"Además, S/ 760,00 en pedidos sin fecha de llegada estimada — informativo, fuera de los totales por mes."`                             |
| Budget OK chip        | encouraging            | `"65% · vas bien"` + `"Quedan S/ 710"`                                                                                                  |
| Budget over chip      | factual, not scolding  | `"122% · pasado"` + `"S/ 430 de más"`                                                                                                   |
| Budget cycle helper   | clarifying             | `"Consumido en el ciclo actual (reinicia el día 1). Es la misma plata desembolsada este mes."`                                          |
| No-budget CTA         | inviting               | `"Pon un tope mensual y te avisamos con color cuando te acerques."` → `"Configurar presupuesto"`                                        |
| Punctuality helper    | plain                  | `"De cada 10 pedidos, unos 8 llegan dentro de la ventana estimada."`                                                                    |
| Trends scope note     | clarifying             | `"El rango de la derecha aplica sólo a estos tres gráficos."`                                                                           |
| FX warning            | calm, actionable       | `"… Sus saldos quedan fuera de estos totales hasta reconciliarlos, así que las cifras son parciales."` → `"Reconciliar tipo de cambio"` |
| Overdue activity chip | neutral-urgent         | `"atrasado 12 d"`                                                                                                                       |
| Nearest payment chip  | gentle-urgent          | `"vence pronto"`                                                                                                                        |
| Empty · cash          | reassuring             | `"No debes nada por ahora"`                                                                                                             |
| Empty · movimiento    | encouraging            | `"Todavía no registraste pedidos"` → `"Crear tu primer pedido"`                                                                         |
| Empty · colección     | inviting               | `"Tu colección aparecerá aquí"` → `"Explorar tiendas"`                                                                                  |
| Collection zone title | celebratory-restrained | `"El panorama completo"`                                                                                                                |
| Order-value KPI label | distinct from spend    | `"Valor de pedidos"` (+ tooltip: `"Suma del valor de todos tus pedidos activos: lo que ya pagaste más lo que aún debes."`)              |

Tone rule for this FRD: the Dashboard is **read-only**, so it carries **no confirmations or
errors**; the mascot register applies only to the empty/celebratory edges (the floating panda
bubble), never inside a money figure (decálogo #6).

---

## 7. Responsive

Mobile-first; desktop is extra room (decálogo #10). Breakpoint behavior is the system's — see
[interface-patterns.md → Responsive](../../../design/interface-patterns.md). FRD-06 specifics:

- **Grid → single column** below `1024px`: the 12-col grid collapses so every zone is full width,
  stacked in reading order (KPI → cash → budget → punctuality → trends → movimiento → próximos
  pagos → colección). The cash zone stays first because it carries the decision the collector
  opens the app to make.
- **Mobile** (`#d6-dashboard-mobile`): the full stack, rebuilt for a ~390px column (rendered in a
  412px phone frame). Same zones and same values, restacked:
  - **KPI strip** goes **2×2** (`grid-template-columns: repeat(2, 1fr)`).
  - **Cash zone** keeps its mini bar chart, paidbar (with the dot legend stacked vertically),
    deuda-sin-fecha note, and FX warning.
  - **Presupuesto** and **Puntualidad** become separate stacked cards; the punctuality donut is a
    fixed `150px` centered ring (the adaptive rule is a desktop-column concern only).
  - **Tendencias**: the three line charts render **full width, stacked**, as static SVG; the range
    picker degrades to a **read-only** `range-trigger` (an `img`-labelled "Últimos 6 meses" chip),
    no popover.
  - **Movimiento de pedidos**: same tabs, made horizontally scrollable (`overflow-x:auto`).
  - **Colección**: the status bar + the three distribution blocks stack in a single column.
    No zone is hidden on mobile — density is reduced, not content.

---

## 8. Accessibility (FRD-06 specifics)

Baseline is WCAG 2.2 AA in both themes (decálogo #8). System-wide a11y rules live in
[interface-patterns.md → Accessibility](../../../design/interface-patterns.md). What matters
specifically here:

- **Status never by color alone**: every budget/status/activity chip is icon + label, and the
  over-budget meter adds a diagonal **hatch** so "over" is perceivable without hue
  ([ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md)).
- **Charts are labelled**: the `.mini-chart`, `.budget-meter`, `.status-bar`, both donuts, and the
  three line charts are each `role="img"` with an `aria-label` stating the values / series /
  percentage (and "excedido" on the over-budget meter); legends are text, not color-only.
- **Range picker is keyboard-operable**: the trigger exposes `aria-haspopup="dialog"` +
  `aria-expanded`; the popover is `role="dialog"`; presets are a labelled button group; calendar
  days are real `role="gridcell"` buttons; `Escape` closes and returns focus to the trigger.
- **Activity tabs**: the `.mini-tabs` use `role="tablist"/"tab"/"tabpanel"` with `aria-selected`;
  panes toggle `is-active`; the overdue count is a real text `badge`, not a dot.
- **Activity / payment links** expose a meaningful accessible name (store + identifier) and a
  visible focus ring; the whole row is a single focusable link.
- **Loading**: the content column sets `aria-busy="true"` while skeletons are shown.
- **Read-only is honest**: nothing that looks actionable mutates; every actionable control either
  navigates or re-renders local presentation, so there are no hidden side effects for AT users.

---

## 9. Sources & provenance

- **Pixel truth**: [`./prototype/dashboard.html`](./prototype/dashboard.html) (self-contained;
  opens standalone in light + dark; default palette Velvet; six anchors: `#dashboard`,
  `#d6-dashboard-empty`, `#d6-dashboard-over-budget`, `#d6-dashboard-no-budget`,
  `#d6-dashboard-loading`, `#d6-dashboard-mobile`).
- **System rules**: [`docs/design/`](../../../design/README.md) — visual-foundations, tokens-css,
  interface-patterns, components, motion, states, ux-copy, and ADRs 0002/0005/0006/0007/0013/0014.
- **Functional contract**: [`frd-06-dashboard.md`](./frd-06-dashboard.md) and its blueprint
  [`bp-01-dashboard-aggregation-and-surface`](./bp-01-dashboard-aggregation-and-surface/bp-01-dashboard-aggregation-and-surface.md).
- **Upstream domains read (not redefined here)**: orders / payments / FX from
  [`FRD-05`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md); delivery state and
  arrival punctuality from [`FRD-08`](../frd-08-delivery-management/frd-08-delivery-management.md);
  base currency, budget, and budget reset day from
  [`FRD-07`](../frd-07-user-settings/frd-07-user-settings.md).
- **Workshop raw material (historical)**: the Velvet system and shell chrome were originally
  produced by the redesign subproject; this FDD + the prototype are the durable record and stand
  on their own.

## 10. Implementation deviations from this record

The dashboard shipped across [`BP-01 · WO-01…WO-06`](bp-01-dashboard-aggregation-and-surface/bp-01-dashboard-aggregation-and-surface.md). Where the built screen departs from the prototype above, it is recorded here so this document stays the truth of what exists. Each deviation is argued in its owning Work Order.

- **Zone tone `cool`, not `info`** (`WO-05`, Movimiento). The prototype uses a `top-info` edge, but the design system's `Eyebrow` / top-accent vocabulary has no `info` tone, and `PLAYBOOK §9.17` forbids inventing one without an ADR. The zone uses the frozen `cool` tone, whose meaning ("system / data") fits an activity list. **Update the prototype, not the code**, unless an ADR adds `info` to the tone vocabulary.

- **"Desembolsado este mes" lives in the head of the "Gasto por mes" chart card** (`WO-04`), not folded into the Presupuesto figure. The prototype folds it in on the assumption that the budget cycle equals the calendar month, which only holds when `budgetResetDayOfMonth` is 1. `FR-06-07` requires the **calendar-month** total while `BR-06-03` keeps the budget on its own cycle, so the two figures legitimately differ. The prototype's `kpi-sub` line "Es la misma plata desembolsada este mes" is therefore **not** implemented.

- **ZONA 5 renders the `FR-06-13` partial-totals notice** (`WO-06`), which the prototype omits. `WO-06` requires it on the money-based breakdowns, and the `.fx-warning` CSS is documented as "reused on cash + collection zones". The design record's intent overrides the prototype's omission.

- **The KPI overview strip ships with `WO-06`.** The zone table models it as its own zone, but no Work Order named it in scope. Its four figures are exactly `WO-06`'s totals (orders, products, committed per `BR-06-05`, stores), and this record places those totals **only** in the strip, never repeated inside ZONA 5 — so the strip is their required home.

- **The status bar excludes cancelled orders** (`WO-06`), so its segments sum exactly to the "Pedidos" tile (`BR-06-07`). The prototype's illustrative `Cancelado 2` segment would make the bar disagree with the total it sits beneath. Legend chips reuse the canonical `StatusChip` (ADR 0002) instead of the prototype's bespoke `circle-dot` / `truck` / `circle-check` / `ban` mapping.

- **Categories are ranked, capped at four, and folded into "Otros"** (`WO-06`). The prototype shows exactly four; the catalog has sixteen. Spend-by-category and count-by-category rank independently, because an item without a `unitPrice` contributes quantity but no committed value.

- **Puntualidad measures the delivery's dispatch date** (`WO-05`), the only arrival date on record. The zone says so in a caption, and its legend reads "En plazo / Fuera de plazo" rather than the prototype's "A tiempo / Tarde": an order that reached the store on time but shipped late is counted outside the window, and only "in window" is provable. Arrivals with no dispatch date are reported separately, never guessed into a bucket.

- **A `loading.tsx` skeleton mirrors the grid** (`ADR 0013`). The page loads every order in one aggregation pass; the prototype has no loading state.

- **The page-heading date reads as the locale formats it.** The prototype writes `jueves 18 jun`; `Intl.DateTimeFormat` renders `viernes, 10 jul` in `es` and `Friday, Jul 10` in `en`. The comma belongs to the locale, and removing it would mean hand-rolling a weekday table per language. The date comes from `generatedAt` in the collector's timezone, since it is a real instant rather than a domain date.

- **Per-order amounts read in the base currency wherever they can be converted** (`FR-06-13`, `FR-06-14`). The order's own currency is the fallback, used only when the order is FX-pending, and the row is then marked `· FX pendiente` — matching the prototype's `¥ 9.800` row. This governs both Movimiento and Lo que toca pagar, which had disagreed with each other.

- **"Desembolsado este mes" and "Gasto por mes" now include delivery shipping cost**, not just order payments (`FR-06-07`, `FR-06-08`, `BR-06-04`, `BR-06-09`). The prototype's `S/ 1,290` figure predates this and reflects order payments only. Delivery cost is folded into the same total rather than drawn as a second series — plotting a typical shipping cost against a typical order total on one axis would be disproportionate.

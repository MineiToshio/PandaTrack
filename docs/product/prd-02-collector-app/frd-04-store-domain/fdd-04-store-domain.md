---
id: FDD-04
type: FDD
slug: store-domain
title: Store Domain — Feature Design Document
status: ACTIVE
parent: FRD-04
last_updated: 2026-06-16
prototype: ./prototype/store-domain.html
design_system: ../../../design/README.md
demo_anchors:
  - "#stores"
  - "#s6-stores-list-default"
  - "#s6-stores-list-loading"
  - "#s6-stores-list-empty"
  - "#s6-stores-list-filters-open"
  - "#store-detail"
  - "#s6-store-detail-published-viewer"
  - "#s6-store-detail-other-user"
  - "#s6-store-detail-pending"
  - "#s6-store-detail-person"
  - "#s6-store-detail-report-modal"
  - "#s6-store-detail-reports-summary"
  - "#store-create"
  - "#s6-store-create-step-1-type"
  - "#s6-store-create-step-2-identity"
  - "#s6-store-create-step-2-logo-set"
  - "#s6-store-create-step-2-error"
  - "#s6-store-create-step-3-categories"
  - "#s6-store-create-category-request"
  - "#s6-store-create-step-4-channels"
  - "#s6-store-create-step-5-review"
  - "#s6-store-create-step-5-preview"
  - "#s6-store-create-duplicate-detected"
  - "#s6-store-create-logo-upload"
  - "#s6-store-create-edit-mode"
---

# FDD-04 · Store Domain — Feature Design Document

> **What this document is.** The FDD is "the prototype in words": the durable, text
> form of the visual and interaction design for FRD-04, so the feature's design is
> reconstructible without depending on the redesign subproject. It
> pairs with the self-contained prototype at [`./prototype/store-domain.html`](./prototype/store-domain.html)
> (the pixel truth) and is governed by the design system in
> [`docs/design/`](../../../design/README.md) (the system rules).
>
> **Three-source rule.** This document **references** the design system for system-wide
> rules (tokens, components, motion, states, copy voice), **describes** what is specific
> to the Store Domain, and **cites the prototype** for the exact pixel. When this FDD
> and the design system disagree on a system-wide rule, `docs/design/` wins. When this
> FDD and the prototype disagree on a Store-specific visual, the prototype wins until
> this FDD is corrected in the same change.
>
> **Language.** Prose is English (repository docs convention); user-facing copy is quoted
> verbatim in Spanish (`es` is the default locale). The `en` equivalents live in
> `src/i18n/locales/en/stores.json`.

---

## 1. Overview & screens covered

The Store Domain is the **public trust and discovery layer** of PandaTrack and the only
collector workspace that is partly anonymous: it is reachable by any visitor, while
creation, reviews, notes, reports, and change requests require authentication. It is the
seller-identity spine the rest of the app hangs orders, deliveries, and reminders from.

Two design constraints make the Store Domain diverge from the order/delivery workspaces:

1. **The list is a responsive CARD GRID, not a tabular list.** Stores are browsed visually
   (avatar, categories, trust signals) the way a directory is, not scanned in rows like
   transactions. This is the deliberate exception to the otherwise-shared list grammar.
2. **The protagonist datum is _trust_, not money or time.** Rating, review count, moderation
   status, and "ships to" signals lead; everything else is supporting context. The detail
   page is a single main reading column (FR-04-32) precisely so trust reads before catalog.

A third constraint is privacy: **Person stores** hide logo, contact channels, and addresses
publicly (FR-04-21), and a Person store may be marked `private` so it is visible only to its
creator (FR-04-33/34, [ADR 0009](../../../design/decisions/0009-private-person-stores.md)).

### Screens in this FDD

| #   | Screen                             | Route                          | Prototype anchor                      |
| --- | ---------------------------------- | ------------------------------ | ------------------------------------- |
| 1   | Stores list (default)              | `/{locale}/stores`             | `#s6-stores-list-default` / `#stores` |
| 2   | List · loading                     | `/{locale}/stores`             | `#s6-stores-list-loading`             |
| 3   | List · empty (filtered)            | `/{locale}/stores?…`           | `#s6-stores-list-empty`               |
| 4   | List · FilterDrawer open           | `/{locale}/stores?…`           | `#s6-stores-list-filters-open`        |
| 5   | Store detail · base                | `/{locale}/stores/[slug]`      | `#store-detail`                       |
| 6   | Detail · `APPROVED` owner view     | `/{locale}/stores/[slug]`      | `#s6-store-detail-published-viewer`   |
| 7   | Detail · `APPROVED` other user     | `/{locale}/stores/[slug]`      | `#s6-store-detail-other-user`         |
| 8   | Detail · `PENDING` + disclaimer    | `/{locale}/stores/[slug]`      | `#s6-store-detail-pending`            |
| 9   | Detail · `PERSON` (reduced fields) | `/{locale}/stores/[slug]`      | `#s6-store-detail-person`             |
| 10  | Detail · report modal              | (detail overlay)               | `#s6-store-detail-report-modal`       |
| 11  | Detail · reports & suggestions     | (detail section)               | `#s6-store-detail-reports-summary`    |
| 12  | Create wizard · base               | `/{locale}/stores/new`         | `#store-create`                       |
| 13  | Create · step 1 (type)             | `/{locale}/stores/new`         | `#s6-store-create-step-1-type`        |
| 14  | Create · step 2 (identity)         | `/{locale}/stores/new`         | `#s6-store-create-step-2-identity`    |
| 15  | Create · step 2 (logo set)         | `/{locale}/stores/new`         | `#s6-store-create-step-2-logo-set`    |
| 16  | Create · step 2 (name error)       | `/{locale}/stores/new`         | `#s6-store-create-step-2-error`       |
| 17  | Create · step 3 (categories)       | `/{locale}/stores/new`         | `#s6-store-create-step-3-categories`  |
| 18  | Create · category request modal    | (wizard overlay)               | `#s6-store-create-category-request`   |
| 19  | Create · step 4 (channels)         | `/{locale}/stores/new`         | `#s6-store-create-step-4-channels`    |
| 20  | Create · step 5 (review)           | `/{locale}/stores/new`         | `#s6-store-create-step-5-review`      |
| 21  | Create · existing-store preview    | (wizard overlay)               | `#s6-store-create-step-5-preview`     |
| 22  | Create · duplicate detected        | (wizard overlay/inline)        | `#s6-store-create-duplicate-detected` |
| 23  | Create · logo crop & confirm       | (wizard overlay)               | `#s6-store-create-logo-upload`        |
| 24  | Edit store                         | `/{locale}/stores/[slug]/edit` | `#s6-store-create-edit-mode`          |

Requirements traced throughout: `FR-04-01 … FR-04-34`, `BR-04-01 … BR-04-21`,
`AC-04-01 … AC-04-15` (see [`frd-04-store-domain.md`](./frd-04-store-domain.md)).
Status-chip mapping is governed by [ADR 0002](../../../design/decisions/0002-status-chip-mapping.md);
the detail/aside grammar by [ADR 0003](../../../design/decisions/0003-demo-decisions.md);
private Person stores by [ADR 0009](../../../design/decisions/0009-private-person-stores.md);
modals by [ADR 0008](../../../design/decisions/0008-modal-enhancement.md).

---

## 2. Layout & structure per screen

All Store screens live inside the collector **App Shell** (PUSH `Sidebar` + `Header`
topbar + content column) — see [interface-patterns.md → Layout & app shell](../../../design/interface-patterns.md).
The shell is system chrome and is **not** redefined here; only the content column is
Store-specific. (In the prototype, the shell is `.app-shell` › `.app-sidebar` +
`.app-content` › `.app-topbar`.)

### 2.1 Stores list (`#s6-stores-list-default`)

Vertical rhythm, top to bottom:

```
app-topbar (sticky)   título "Tiendas" + contador "47 tiendas" (right-aligned)
page hero             eyebrow mono "Directorio" + display "Dónde comprar" + subtitle
toolbar               search · [Filtrar] (ghost) · sort Select · [+ Nueva tienda] (primary)
filter-chips          removable .filter-chip pills for each active filter
store-grid            responsive CARD GRID of StoreCard
pagination            desktop numeric Pagination / mobile "Cargar más"
```

The defining choice: the body is a **responsive CSS card grid** (1 col `<640px` → 2 cols
`640–1024px` → 3 cols `>1024px`, grid `gap-[14px]`), **not** the tabular row pattern used by
orders/deliveries. Each cell is a `.store-card` anchor (`<a href>` to the detail), so the
whole card is one keyboardable link.

**StoreCard anatomy** (component `StoreCard`, fixed-height card): `StoreAvatar` s56 — the store
**logo** when one is set (same as the detail hero), otherwise an accent-tint monogram for
`RETAILER`/`PROXY` and a `user` icon + muted tint for `PERSON` → store name with an inline type
icon (`store` 12px for `RETAILER` / `truck` 12px for `PROXY` / `user` 12px muted for `PERSON`) → `map-pin` + country name → a row of `chip accent`
**product-type** chips (icon + label) with a `chip neutral` `"+N más"` overflow pill → an
"Importa de" text line in `text-muted` (or a muted "no imports" fallback) → a top-bordered
stats row (rating number bold `.num` + review count, the viewer's order count when present,
and a `StarRating` on the right). **No neutral type/presence signal chips and no trust chips
render on the card** — only product-type chips. `StoreCommerceSignalPills` exists in the
`share/` folder but is **not used** by `StoreCard`. **Moderation status chips are not rendered
on cards** (S6.1 decision, FRD Current Implementation Notes); status appears only on detail.

Active filters surface above the grid as removable `.filter-chip` pills
(`Recibe pedidos ×`, `Vinyl ×`, `Envía a CO ×`); free-text search is **not** counted as a
filter (FR-04-13).

### 2.2 Store detail (`#store-detail`, `#s6-store-detail-*`)

Two-column `detail-grid`: a main reading column + a **sticky aside** (ADR 0003 Decision 7),
collapsing to one column on mobile.

```
app-topbar     back-link "← Tiendas" (ghost sm) + store name <h2>
detail-grid
  main         StoreHero (detail-hero) → stacked collapsible subcards
  aside        Resumen → Acciones → Tu nota privada  (sticky top:80px)
```

**StoreHero** (prototype `.detail-hero`, a `.card`-style surface): `detail-hero-head` =
`store-avatar s56` + identity block (display name + `map-pin` city/country + a status
`chip`) + a right-aligned rating block (`.stars` + `"4.7 · 92 reseñas"`). Below the head:
the description in `text-secondary`, then (non-`PERSON` only) a commercial chip row that renders
only the signals that apply: `chip info` `Tienda física` (`store`) / `chip info` `Web`
(`globe`), `chip success` for in-stock, and `chip warning` for accepts-pre-orders. A `PROXY`
has null stock / pre-order and no catalog, so it only ever shows presence chips here, plus a
`chip neutral` **"Proxy"** badge (`truck`) next to the name to signal it is an intermediary
(FR-04-39). There is **no** "Envía a N países" chip. The richer
"other user" variant additionally adopts the system Chip-Eyebrow + Top-Accent surface
treatment on the aside cards (`.s8-card-warm`, `.s8-eyebrow-chip`).

**Stacked subcards** (prototype `.subcard.is-open[data-collapsible]`, expanded by default;
header is `.subcard-toggle` with `.eyebrow` + a `text-muted` count + `.chev`):

- **Categorías** — `chip accent` per assigned product type.
- **Importa desde** — `chip neutral` per import country (full name, not code).
- **Contactos** (`RETAILER` and `PROXY` only) — `.channel-row`s: `.channel-icon` (Lucide or Simple Icon) +
  `.label` + `.value` + a ghost `IconButton` (`external-link` / `copy`). Header shows the
  channel count.
- **Direcciones** (`RETAILER` and `PROXY` only) — `.channel-row`s with `map-pin` + label + address + a map
  `IconButton`.
- **Reseñas** — a prominent rating block (38px number + `.stars` 20px + count, separated by
  `border-bottom`), the viewer's own review form on a tinted panel, then `.review-row`s
  (`store-avatar s32` + name + `.stars` + `when` + text). The community-reviews surface is
  authenticated-only: the full list is loaded server-side **only when a session is present**, so
  anonymous visitors load no reviews and the list does not render for them. For a signed-in
  viewer the section shows a 4-review community preview and a single full-width ghost reveal CTA
  (`"Ver todas las N reseñas"`) that expands to all remaining reviews in one click — there is
  no incremental batching (FR-04-24, BR-04-07).

**Aside rail** (prototype `aside` › `.card.elevated`): the order is frozen
**Resumen → Acciones → Tu nota privada**; the cards inside change by viewer role (§5.6).

**State variants** (prototype anchors in parentheses):

| State / viewer                                         | Treatment                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APPROVED` owner (`#s6-store-detail-published-viewer`) | Owner aside: viewer "Resumen", "Anotar pedido aquí" primary, "Editar tienda" ghost, "Reportar tienda" destructive-ghost, private note; pending reports surface via the governance-summary banner above the layout (not an aside chip)                                                             |
| `APPROVED` other user (`#s6-store-detail-other-user`)  | Viewer aside: "Anotar pedido aquí" primary, "Sugerir cambios" ghost (signed-in), "Reportar tienda" destructive-ghost; warm-toned private note (`.s8-card-warm`). No "Guardar tienda" action exists                                                                                                |
| `PENDING` (`#s6-store-detail-pending`)                 | A soft disclaimer banner before the hero ("En revisión…"), visible only to creator/admins; detail metadata is non-indexable (BR-04-04)                                                                                                                                                            |
| `PERSON` (`#s6-store-detail-person`)                   | No logo, no Contactos subcard, no Direcciones subcard; avatar is the `user` icon (FR-04-21/23, AC-04-05)                                                                                                                                                                                          |
| `PROXY`                                                | Logo shown (like `RETAILER`, not the `user` icon); a `chip neutral` "Proxy" badge (`truck`) next to the name; Contactos + Direcciones subcards kept; the categories/imports subcard keeps **Importa desde** but omits the product-types block; no stock / pre-order chips (FR-04-38/39, AC-04-19) |

**404-guard on private Person stores:** a `private` Person store renders for its creator
only; any other viewer must get a not-found response, not a hidden page
([ADR 0009](../../../design/decisions/0009-private-person-stores.md), BR-04-21). The
route-error/404 surface itself is a system screen (S10), not mocked here.

### 2.3 Create wizard & edit (`#s6-store-create-step-*`, `#s6-store-create-edit-mode`)

**Create** is a **5-step `WizardAccordion`** (prototype `.form-grid` → wizard column +
`.form-sidebar` Resumen; horizontal `.stepper#sc-stepper` with numbered `.step-num` dots):

```
stepper      Tipo · Identidad · Categorías · Canales · Listo
form-grid    wizard accordion (left)  +  form-sidebar (right: live Resumen, sticky)
form footer  autosave indicator "Guardado en este navegador" + --success check
```

Only the active `.section-card-wizard` step is expanded; completed steps collapse to a
summary in their head. Step state is autosaved to `localStorage` between steps (FRD Current
State). The aside is a single **Resumen** card mirroring the live form (Tipo, Nombre, País,
Categorías, Estado).

- **Step 1 — Tipo** (`#s6-store-create-step-1-type`): a **three-way** `.big-choice` seller-type
  picker (`ToggleChoiceGroup` tiles), each with a one-line helper — **Comercio** (`store`
  icon; "Un negocio que te vende sus productos"), **Persona** (`user` icon; "Un vendedor
  individual — amigo, scout, revendedor"), and **Proxy** (`truck` icon; "Un intermediario que
  compra por ti (p. ej. ZenMarket)"). Values map to `sellerType` `RETAILER` / `PERSON` /
  `PROXY`. When `PERSON` is chosen, a `border-top` section reveals the **"Perfil privado"**
  `Switch` — shown _only_ for Person type (FR-04-34, ADR 0009). Choosing **Proxy** gates the
  downstream steps: the categories selection and the stock / pre-order switches are hidden and
  cleared (FR-04-38), while the logo and Canales step are kept (FR-04-39); Proxy keeps the
  5-step flow, Persona uses 4 (no Canales).
- **Step 2 — Identidad** (`#s6-store-create-step-2-identity`): `grid-2` Nombre `Input` +
  País `Combobox`; description `Textarea`; presence multi-select; import-countries multi-select
  `Combobox`. **Logo (RETAILER and PROXY only)** is a drop/upload zone; once set
  (`#s6-store-create-step-2-logo-set`) it shows a 150×150 thumbnail + file name/size + ghost
  "Edit"/"Remove". Name blur with ≥2 chars triggers duplicate detection (§5.5). The
  name-error variant (`#s6-store-create-step-2-error`) gives the field a `--destructive`
  border + inline `ErrorMessage`.
- **Step 3 — Categorías** (`#s6-store-create-step-3-categories`): selectable `.cat-chip`s
  - a dashed inline `"Solicitar nueva categoría"` chip opening the request modal; then a
    presence section and a **"Comportamiento comercial"** section grouping the
    `Tiene stock` / `Recibe preórdenes` switches. For a **`PROXY`** the categories block and
    the "Comportamiento comercial" switches are hidden (a proxy has no catalog, FR-04-38);
    only presence and import countries remain in this step.
- **Step 4 — Canales** (`#s6-store-create-step-4-channels`): **staged-add** contact channels
  and addresses — the add form starts collapsed; nothing is appended until the user confirms
  (no empty rows). Per-type value validation is inline; an open add-form **blocks advancing**.
- **Step 5 — Listo** (`#s6-store-create-step-5-review`): read-only recap of every field
  (channels/addresses rendered as **real values, never counts** — FRD Notes), a terms
  checkbox, and the final `"Crear tienda"` primary CTA; the Resumen chip reads `info`
  `Pendiente` for normal users.

**Edit** (`#s6-store-create-edit-mode`, `/[slug]/edit`) reuses the wizard layout pre-filled.
Store **type and country are immutable** (BR-04-17). For a normal user editing an `APPROVED`
store the submit produces a `StoreChangeRequest` rather than a direct mutation
(FR-04-29, AC-04-13); `PENDING` stores are directly editable only by creator/admins
(FR-04-30, AC-04-15). In edit mode the review step ("Listo") adds an **"Estado de la tienda"**
card carrying a single `InlineSwitch` — **"Marcar tienda como cerrada"** — on the shared
elevated-surface treatment, with helper copy explaining that closed stores are hidden from
the listing by default and drop out of the order-creation picker. The switch rides the same
direct-edit-vs-change-request derivation as every other field (FR-04-37); it is absent from
the create flow (a new store is always active).

---

## 3. Visual treatment

The Store Domain introduces **no new tokens, palettes, surfaces, or type ramps.** It
consumes the Velvet system as-is. This section records only how the FRD _applies_ the
system; the definitions live in
[visual-foundations.md](../../../design/visual-foundations.md) and
[tokens-css.md](../../../design/tokens-css.md).

### 3.1 Color roles

| Role in this FRD                                       | Token / class                                | Where                                                              |
| ------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------ |
| Primary CTA (`Nueva tienda`, `Crear tienda`, `Editar`) | `--accent` (Button primary)                  | toolbar, wizard step 5, owner aside                                |
| Category & selected affordances                        | `chip accent` / `.cat-chip` (accent ~10%)    | StoreCard, detail categorías, step 3                               |
| Neutral signals (import countries, overflow, Persona)  | `chip neutral`                               | detail "Importa desde", card "+N más"                              |
| Presence (physical/online) / pending status            | `--info` (`chip info`)                       | hero presence chips, pending chip                                  |
| Stock available                                        | `--success` (`chip success`)                 | hero stock chip, autosave check                                    |
| Accepts pre-orders / FLAGGED warning                   | `--warning` (`chip warning`)                 | hero pre-orders chip (FLAGGED banner is prototype-only — see §5.3) |
| Warm private-note surface                              | `s8-card-warm` + `s8-eyebrow-chip tone-warm` | aside "Tu nota privada"                                            |
| Destructive (report)                                   | `--destructive`                              | Button destructive-ghost (report)                                  |

The **Chip-Eyebrow + Top-Accent** pattern (`s8-eyebrow-chip` + `s8-card-*`) is the system's
section-identity device — see [interface-patterns.md](../../../design/interface-patterns.md).
Status color is **never** carried by color alone: every chip is icon + label
([ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md)).

### 3.2 Typography

- Store names and section labels: body semibold; section labels in the wizard at 14px bold.
- The list hero eyebrow (`"Directorio"`) and subcard eyebrows use uppercase + wide tracking.
- Identifiers, ratings, counts, totals, and file sizes use the `.num` tabular treatment.
- The reviews rating block uses the large 38px / `font-weight 700` number.
- `MonoCode` (JetBrains Mono, [ADR 0007](../../../design/decisions/0007-text-muted-outdoor-code-mono-reassignment.md))
  is reserved for any code-like identifier; the Store Domain leans on slugs and names, not a
  human-id, so mono is used sparingly compared with orders/deliveries.

### 3.3 Shape, radius & elevation

Standard system values, no overrides: cards at `--radius-xl` (12px), pills/chips fully
rounded, border-first elevation (the system is border-led, not shadow-led). Skeleton cards
pulse `--border → --surface-elevated`. Overlays (modals/sheets) use the system's elevated
treatment via the canonical `Modal`.

---

## 4. Components consumed

Everything below already exists in the catalog — see
[components.md](../../../design/components.md). The Store Domain is an **assembly of existing
components plus a small set of module-local pieces** (`StoreCard`, `StoreHero`,
`StoreSubcard`, `ReviewRow`, `ReportReasonPicker`, `DuplicateAlertInline`); it must not fork
or reinvent system primitives.

| Component                              | Tier        | Role in FRD-04                                                                                                                    |
| -------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `Sidebar`, `Header`                    | module      | App shell chrome (PUSH sidebar, topbar)                                                                                           |
| `StoreAvatar`                          | core        | s56 in cards & hero, s32 in reviews / duplicate candidates                                                                        |
| `StatusChip`                           | core        | Trust & status chips, per [ADR 0002](../../../design/decisions/0002-status-chip-mapping.md)                                       |
| `Button` / `IconButton`                | core        | primary / ghost / destructive-ghost hierarchy; channel actions                                                                    |
| `Input` / `Textarea` / `Combobox`      | core        | name, description, country/import country, private note                                                                           |
| `Select`                               | core        | list sort, channel-type select                                                                                                    |
| `Switch`                               | core        | "Perfil privado", "Tiene stock", "Recibe preórdenes"                                                                              |
| `Checkbox`                             | core        | terms acceptance (step 5)                                                                                                         |
| `FilterTriggerButton` + `FilterDrawer` | module      | list filtering — closes via X/Esc only, not outside-click (FR-04-13)                                                              |
| `AppliedFilterChip`                    | core        | removable active-filter chips                                                                                                     |
| `Pagination` / `ListPagination`        | core/module | desktop numeric / mobile "Cargar más"                                                                                             |
| `WizardAccordion` / `Stepper`          | module      | 5-step create flow                                                                                                                |
| `ImageCropper`                         | module      | logo crop-and-confirm step (FR-04-31)                                                                                             |
| `ProgressBar`                          | core        | logo upload progress                                                                                                              |
| `DetailSidebar` / `SectionCard`        | module      | aside rail; subcard container                                                                                                     |
| `PrivateNoteCard`                      | module      | inline-editable private note                                                                                                      |
| `Modal` (`ModalDialog` / `ModalSheet`) | module      | report / category-request / duplicate / logo / preview overlays — [ADR 0008](../../../design/decisions/0008-modal-enhancement.md) |
| `EmptyState` / `MascotBubble`          | module      | filtered-empty state                                                                                                              |
| `Skeleton`                             | core        | list loading                                                                                                                      |
| `Toast`                                | module      | create/edit/report confirmations                                                                                                  |

New data needs (Phase B, not design): the listing/detail queries and the
create/edit/review/note/report/change-request mutations. The named query and action
contracts are owned by the FRD — see [Screens and Data Contract](./frd-04-store-domain.md#screens-and-data-contract)
(e.g. `getPublicStoresListingPage`, `getStoreBySlug`, `getStoreGovernanceSummary`).
These are implementation contracts, not design surfaces.

---

## 5. Interactions & states

### 5.1 Cross-cutting states

Owned by the system — see [states.md](../../../design/states.md) and
[ADR 0013](../../../design/decisions/0013-cross-cutting-state-system.md). FRD-04 instances:

- **Loading** (`#s6-stores-list-loading`): a grid of 6 `.skeleton-card`s (each mirroring the
  StoreCard: avatar + 2 lines + 2 chip rows + stats), `aria-busy="true"` on the grid,
  `aria-hidden="true"` per skeleton; toolbar inputs disabled. SSR-delivered — no fake client
  fallback.
- **Empty, filtered** (`#s6-stores-list-empty`): `EmptyState` + `MascotBubble` in the
  `sleeping` variant, `"Sin resultados"`, a suggestion to loosen filters, a ghost
  `"Limpiar filtros"`; toolbar and chips stay active.
- **No empty-initial mock**: the directory is seeded, so the workshop only mocks the
  filtered-empty case.

### 5.2 Filtering (`#s6-stores-list-filters-open`)

The `FilterDrawer` (right panel on desktop, right-edge `Sheet` on mobile) overlays the list,
which dims to 35% opacity with `pointer-events:none`. **It dismisses only via its close (X)
control and Esc — never via outside-click** (FR-04-13). Sections in order: Categorías
(pills), Presencia (pills), País (search + pills), Importa desde (search + pills), Otros
(switches: Recibe pre-órdenes / Tiene stock / Mostrar tiendas cerradas). Enabling **"Mostrar
tiendas cerradas"** opts closed (inactive) stores back into the results, which are hidden by
default (FR-04-36); it surfaces as an applied-filter chip like the other switches. Footer: ghost `"Limpiar"` +
primary `"Aplicar"`. Logic: **OR within a family, AND between families** (FR-04-14/15,
AC-04-07). The `FilterTriggerButton` shows a tinted active state with an applied-filter badge
count; free text does not increment that count.

### 5.3 Status-chip mapping (ADR 0002)

| Concept               | Chip label         | Variant   | Icon             |
| --------------------- | ------------------ | --------- | ---------------- |
| Moderation `APPROVED` | `Aprobada`         | `accent`  | (detail only)    |
| Moderation `PENDING`  | `En revisión`      | `info`    | `clock`          |
| Moderation `FLAGGED`  | `Con reportes`     | `warning` | `alert-circle`   |
| Presence physical     | `Tienda física`    | `info`    | `store`          |
| Presence online       | `Web`              | `info`    | `globe`          |
| Has stock             | (in-stock label)   | `success` | `package-check`  |
| Accepts pre-orders    | (pre-orders label) | `warning` | `calendar-clock` |

The commercial chips (physical / online / stock / pre-orders) render on the **detail hero**
(non-`PERSON` only; a `PROXY` only ever shows presence chips since it has null stock / pre-order,
plus its "Proxy" badge); moderation chips render on **detail only**, not on list cards (S6.1). The
`FLAGGED` "Con reportes" mapping is **prototype-only and not reachable on the shipped public
detail page**: `getStoreBySlug` resolves only `PENDING`/`APPROVED` stores, so `FLAGGED` (and
`REJECTED`) stores 404 rather than rendering a warning chip or banner. There is **no** "Envía a
N países" chip anywhere. Person stores omit the contact/presence chips entirely.

### 5.4 Detail actions by viewer role (§2.2 aside)

One primary, ghost secondaries, destructive last — the same action grammar as the rest of the
app. As shipped, the **Acciones** card composes the same three building blocks for every
viewer and only toggles the edit affordance by auth/permission (prototype + FRD US-03/05,
BR-04-12):

- **"Anotar pedido aquí"** (primary, `plus-circle`) — rendered **unconditionally for all
  viewers**, including anonymous ones; it links to the new-order route. There is **no** distinct
  "Inicia sesión para anotar pedidos" sign-in CTA.
- **Edit affordance** — rendered only when `canAccessEditRoute` (a session exists). Its label
  and icon swap by permission: direct **"Editar tienda"** (`pencil`) when `canDirectlyEdit`,
  otherwise the change-request variant **"Sugerir cambios"** (`git-pull-request-arrow`).
- **"Reportar tienda"** (destructive-ghost, `flag`) — always rendered; the report submit itself
  still requires authentication.

There is **no** "Guardar tienda" / watchlist action anywhere in the code. The owner's pending
reports surface is the governance-summary banner above the layout, not an aside button. The
private note (`StoreNoteForm`) occupies the third aside slot for any viewer. Admin moderation
tooling beyond this is an Open Question, not yet built.

### 5.5 Create-flow interactions

- **Duplicate detection** (`#s6-store-create-duplicate-detected`): on Nombre blur with ≥2
  trimmed chars, `DuplicateAlertInline` (`role="alert"`) lists up to 5 candidates across all
  countries (AC-04-03), each linking to an existing-store **preview modal**
  (`#s6-store-create-step-5-preview`). On submit, if a **same-country** candidate is at/above
  threshold, a confirmation `Modal` blocks submit with `"Cancelar"` / `"Crear de todos modos"`
  (AC-04-04, BR-04-08/09).
- **Category request** (`#s6-store-create-category-request`): a `Modal` with a 0/50 name field
  and an optional 0/500 reason; closes on cancel or send + a confirmation `Toast` (FR-04-28).
- **Logo crop & confirm** (`#s6-store-create-logo-upload`): an intermediate crop modal with a
  `ProgressBar` during upload and `"Cancelar"` / `"Guardar logo"`, before the logo persists
  (FR-04-31).
- **Staged-add** (step 4): channels/addresses never insert an empty row; an open add-form
  blocks advancing with an inline warning.
- **Submit**: normal users create `PENDING` and redirect to `/{locale}/stores/[slug]` with a
  `Toast` `"Tienda creada — pendiente de revisión"` (info tone, AC-04-01, BR-04-10); admins
  create `APPROVED` (AC-04-02).

### 5.6 Report & reports-summary

- **Report modal** (`#s6-store-detail-report-modal`): detail dims behind a `Modal`
  (`role="dialog"`) with a `ReportReasonPicker` (single-select reasons: Info incorrecta,
  Posible estafa o fraude, Contenido inapropiado, Tienda duplicada), an optional context
  `Textarea`, and `"Cancelar"` / `"Enviar reporte"` (FR-04-27, one open report per store —
  BR-04-14, re-report after resolution AC-04-12).
- **Reports & suggestions** (`#s6-store-detail-reports-summary`): an in-flow section with two
  blocks — **Reportes de la comunidad** (counts by reason; other users' identities and
  free-text hidden, BR-04-13; the viewer sees their own open report with an edit CTA) and
  **Solicitudes de cambio** (pending change-request summary; the viewer sees their own with a
  continue CTA). Personalized viewer info appears **before** the aggregated summary
  (AC-04-09/10/11).

### 5.7 Optimistic behavior & motion

Mutations are **optimistic** — see the `optimistic-client-updates` policy and
[motion.md](../../../design/motion.md):

- Modal/sheet flows (report, category request, duplicate confirm) close **synchronously** on
  submit (Optimistic Confirmation); the surface updates locally and reverts on failure with a
  toast (the parent coordinator owns rollback).
- Note save, review create/edit, and filter apply update the visible state immediately.
- List card → detail uses **View Transitions**
  ([ADR 0014](../../../design/decisions/0014-motion-system-and-view-transitions.md)); the
  prototype approximates this with a CSS fade+slide.
- Within the wizard, only one step is expanded; advancing animates the accordion.
- Hover/press, reduced-motion, and the transform/opacity rule are system-level and inherited
  unchanged.

---

## 6. Copy & voice

Voice is constant and tone is per-surface — see [ux-copy.md](../../../design/ux-copy.md).
FRD-04 keeps the canonical glossary (`tienda ↔ store`, `pedido ↔ order`, `reseña ↔ review`)
— see [glossary.md](../../glossary.md). Strings live in
`src/i18n/locales/{es,en}/stores.json`.

Key strings (es), by surface and tone:

| Surface                   | Tone                | String                                                                                                         |
| ------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| List hero eyebrow / title | inviting            | `"Directorio"` · `"Dónde comprar"`                                                                             |
| List result count         | neutral, factual    | `"47 tiendas"`                                                                                                 |
| List CTA                  | direct              | `"Nueva tienda"`                                                                                               |
| Empty (filtered)          | gentle              | `"Sin resultados"`                                                                                             |
| Step 1 helper             | orienting           | `"Esto cambia los campos siguientes."`                                                                         |
| Private profile helper    | reassuring          | `"Solo tú puedes verlo. No aparece en el directorio público ni en búsquedas."`                                 |
| Duplicate inline          | curious, low-stakes | `"Tiendas similares encontradas"` · `"¿Es alguna de estas?"`                                                   |
| Pending disclaimer        | calm                | `"En revisión. Visible en la app; no indexable en buscadores."`                                                |
| Private note helper       | concrete            | `"Acuerdos con la tienda, fechas importantes, instrucciones especiales o el contexto para retomarlo después."` |
| Report send               | accountable         | `"Enviar reporte"`                                                                                             |
| Category request          | helpful             | `"Solicitar nueva categoría"`                                                                                  |
| Autosave indicator        | quiet               | `"Guardado en este navegador"`                                                                                 |
| Submit toast              | confidence-building | `"Tienda creada — pendiente de revisión"`                                                                      |

Tone rule for this FRD: **confirmations, reports, and errors carry no mascot** (decálogo #6);
the panda appears only in the empty/celebratory register (e.g. the `sleeping` mascot in the
filtered-empty state).

---

## 7. Responsive

Mobile-first; desktop is extra room (decálogo #10). Breakpoint behavior is the system's —
see [interface-patterns.md → Responsive](../../../design/interface-patterns.md). FRD-04
specifics:

- **List grid**: 1 column `<640px` → 2 columns `640–1024px` → 3 columns `>1024px`. The toolbar
  collapses to search + icon-only `FilterTriggerButton` (with count badge) + `[+ Nueva]`;
  pagination becomes a `"Cargar más"` ghost button.
- **FilterDrawer → Sheet**: on mobile the drawer renders as a right-edge `Sheet` (vaul); same
  sections, same X/Esc dismissal contract.
- **Detail → stacked**: the two-column `detail-grid` collapses to one column (hero → subcards
  → aside cards). Primary navigation moves into the topbar burger drawer.
- **Wizard → mobile**: the wizard fills the viewport with no tab bar; the `Stepper` scrolls
  horizontally; date/currency/country pickers use the mobile picker pattern. Modals
  (report, category request, duplicate, logo, preview) render as `ModalSheet`.

---

## 8. Accessibility (FRD-04 specifics)

Baseline is WCAG 2.2 AA in both themes (decálogo #8). System-wide a11y rules live in
[interface-patterns.md → Accessibility](../../../design/interface-patterns.md). What matters
specifically here:

- **Status never by color alone**: every trust/moderation chip is icon + label
  ([ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md)).
- **Whole-card links**: each `StoreCard` is an `<a>` to the detail, keyboard-focusable; the
  result count is exposed for screen readers.
- **Loading grid**: `aria-busy="true"` + `aria-label`; skeletons `aria-hidden="true"`.
- **FilterDrawer**: `role="dialog"`, `aria-modal="true"`, `aria-label="Filtrar tiendas"`;
  switches expose `aria-pressed` + descriptive `aria-label`.
- **Collapsible subcards**: each toggle is a real `<button>`, keyboard-operable.
- **Disclaimer banner**: announceable via `role="alert"` / `aria-live` when it changes.
- **Modals**: `role="dialog"` + `aria-modal` + `aria-labelledby`; the `DuplicateAlertInline`
  is `role="alert"` for automatic announcement.
- **Channel actions**: each `IconButton` has a descriptive `aria-label`
  (e.g. `"Visitar sitio web"`, `"Copiar email"`).
- **Forms**: required fields use `aria-required`; inline errors use `aria-describedby`;
  selectable category chips expose `aria-pressed`; the private-profile `Switch` and the
  interactive review stars carry descriptive labels; the `ProgressBar` exposes
  `aria-valuenow/min/max`.

---

## 9. Sources & provenance

- **Pixel truth**: [`./prototype/store-domain.html`](./prototype/store-domain.html)
  (self-contained; opens standalone in light + dark; default palette Velvet). Verified S15.
- **System rules**: [`docs/design/`](../../../design/README.md) — visual-foundations,
  tokens-css, interface-patterns, components, motion, states, ux-copy, and ADRs
  0002/0003/0006/0007/0008/0009/0013/0014.
- **Functional contract**: [`frd-04-store-domain.md`](./frd-04-store-domain.md) and its
  blueprint/work-orders.
- **Workshop raw material (historical)**: distilled from the redesign subproject; see git history. This FDD + the prototype are the
  durable record.

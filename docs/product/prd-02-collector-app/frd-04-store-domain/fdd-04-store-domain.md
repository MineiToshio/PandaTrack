---
id: FDD-04
type: FDD
slug: store-domain
title: Store Domain — Feature Design Document
status: ACTIVE
parent: FRD-04
last_updated: 2026-08-08
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
  - "#s6-store-detail-admin-pending"
  - "#s6-store-detail-remove-modal"
  - "#s6-store-detail-report-notice"
  - "#s6-store-detail-admin-governance"
  - "#s6-store-change-request-review"
  - "#s6-store-change-request-review-drift"
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
>
> **Amendment — Store-level payments on the store detail page (2026-08-08, `FR-04-55`–`FR-04-58`).**
> The money model (`StorePayment`, declared `PaymentAllocation`) is owned by FRD-05
> ([`docs/design/decisions/0025-store-level-payments-declared-allocations.md`](../../../design/decisions/0025-store-level-payments-declared-allocations.md));
> this note covers only the four things `#store-detail` itself adds. None of this is pictured
> in the prototype HTML below (see the follow-up note at the end of this block).
>
> - **"Resumen" card, new stacked row.** Below the order-count/spend rows, one "Deuda pendiente
>   {amount}" row per currency the viewer has ordered from or paid this store in
>   (`StoreDebtSummaryRows`). A negative debt (the store owes the collector back) swaps to the
>   success tone, "A favor {amount}", rather than a debt figure. The rows, like the rest of the
>   card, are entirely absent when the viewer has never ordered from or paid this store.
> - **"Acciones" card, new second row.** A ghost "Registrar pago" button (`CircleDollarSign`
>   icon, `StoreRegisterPaymentButton`) sits directly below the existing "Anotar pedido aquí"
>   primary and above the edit affordance, opening the shared `StorePaymentSheet`
>   (`src/components/modules/StorePaymentSheet/`) pre-targeted at this store. Disabled only when
>   the viewer has no debt row at all for this store (never ordered, never paid); it stays enabled
>   when a row is a credit ("A favor") since that is still a real balance to declare against a new
>   order. The disabled state wraps the button in a `Tooltip` reading "Sin deuda pendiente con esta
>   tienda". Below it,
>   an inline hyperlink "Ver mis pedidos en esta tienda" (`ExternalLink` icon, same recipe as the
>   "Resumen" card's "Ver pedidos vinculados" link) navigates to `/orders?view=store`.
> - **New main-column subcard, "Pagos a esta tienda"** (`StorePaymentsSection`, a
>   `CollapsibleSection` with a `Wallet`-icon accent eyebrow and a count badge), positioned right
>   after the Categorías/Importa desde subcard and before Contactos. Renders nothing when the
>   viewer has never paid this store (no empty state, the card is simply absent). Each row: a
>   monospace date, an amount right-aligned in bold, an optional "Nota: {note}" caption line, a
>   warning-tone "Sin asignar {amount}" `Chip` when the payment carries an undeclared remainder,
>   and a ghost icon-only delete button (`X`, 28px hit target, with a descriptive
>   `aria-label` naming the amount and date). Delete opens the canonical destructive `Modal`
>   (`role="alertdialog"`, non-dismissible backdrop) titled "¿Eliminar este pago?", whose body
>   copy names the affected allocation count when the payment has any ("Se eliminará el pago de
>   {amount} del {date}. Se perderá su asignación con {N} pedido(s).") or a plain single-sentence
>   variant when it has none. A list beyond the server's row cap adds a trailing caption, "y {N}
>   más".
>
> **Follow-up (explicit, not scheduled):** the `#store-detail` prototype anchors have not been
> updated for this amendment; this FDD prose is the source of truth in the meantime (per the
> Authority order in `.agents/rules/frd-design-documentation.mdc`).

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

| #   | Screen                             | Route                          | Prototype anchor                        |
| --- | ---------------------------------- | ------------------------------ | --------------------------------------- |
| 1   | Stores list (default)              | `/{locale}/stores`             | `#s6-stores-list-default` / `#stores`   |
| 2   | List · loading                     | `/{locale}/stores`             | `#s6-stores-list-loading`               |
| 3   | List · empty (filtered)            | `/{locale}/stores?…`           | `#s6-stores-list-empty`                 |
| 4   | List · FilterDrawer open           | `/{locale}/stores?…`           | `#s6-stores-list-filters-open`          |
| 5   | Store detail · base                | `/{locale}/stores/[slug]`      | `#store-detail`                         |
| 6   | Detail · `APPROVED` owner view     | `/{locale}/stores/[slug]`      | `#s6-store-detail-published-viewer`     |
| 7   | Detail · `APPROVED` other user     | `/{locale}/stores/[slug]`      | `#s6-store-detail-other-user`           |
| 8   | Detail · `PENDING` + disclaimer    | `/{locale}/stores/[slug]`      | `#s6-store-detail-pending`              |
| 9   | Detail · `PERSON` (reduced fields) | `/{locale}/stores/[slug]`      | `#s6-store-detail-person`               |
| 10  | Detail · report modal              | (detail overlay)               | `#s6-store-detail-report-modal`         |
| 11  | Detail · reports & suggestions     | (detail section)               | `#s6-store-detail-reports-summary`      |
| 12  | Create wizard · base               | `/{locale}/stores/new`         | `#store-create`                         |
| 13  | Create · step 1 (type)             | `/{locale}/stores/new`         | `#s6-store-create-step-1-type`          |
| 14  | Create · step 2 (identity)         | `/{locale}/stores/new`         | `#s6-store-create-step-2-identity`      |
| 15  | Create · step 2 (logo set)         | `/{locale}/stores/new`         | `#s6-store-create-step-2-logo-set`      |
| 16  | Create · step 2 (name error)       | `/{locale}/stores/new`         | `#s6-store-create-step-2-error`         |
| 17  | Create · step 3 (categories)       | `/{locale}/stores/new`         | `#s6-store-create-step-3-categories`    |
| 18  | Create · category request modal    | (wizard overlay)               | `#s6-store-create-category-request`     |
| 19  | Create · step 4 (channels)         | `/{locale}/stores/new`         | `#s6-store-create-step-4-channels`      |
| 20  | Create · step 5 (review)           | `/{locale}/stores/new`         | `#s6-store-create-step-5-review`        |
| 21  | Create · existing-store preview    | (wizard overlay)               | `#s6-store-create-step-5-preview`       |
| 22  | Create · duplicate detected        | (wizard overlay/inline)        | `#s6-store-create-duplicate-detected`   |
| 23  | Create · logo crop & confirm       | (wizard overlay)               | `#s6-store-create-logo-upload`          |
| 24  | Edit store                         | `/{locale}/stores/[slug]/edit` | `#s6-store-create-edit-mode`            |
| 25  | Detail · admin on `PENDING`        | `/{locale}/stores/[slug]`      | `#s6-store-detail-admin-pending`        |
| 26  | Detail · removal modal (admin)     | (detail overlay)               | `#s6-store-detail-remove-modal`         |
| 27  | Detail · derived report notice     | `/{locale}/stores/[slug]`      | `#s6-store-detail-report-notice`        |
| 28  | Governance panel · admin           | (detail overlay)               | `#s6-store-detail-admin-governance`     |
| 29  | Change-request review (admin)      | (admin surface)                | `#s6-store-change-request-review`       |
| 30  | Change-request review · drift      | (admin surface)                | `#s6-store-change-request-review-drift` |

Screens 25 through 30 (plus the softened `PENDING` disclaimer) document the **admin inline
moderation scope** (`FR-04-40 … FR-04-51`, `BR-04-22 … BR-04-29`, `AC-04-20 … AC-04-31`),
**planned, not yet shipped**. They render only for an administrator viewer, gated server-side
by `requireAdmin()` (see [PRD-03 · FRD-01](../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md)),
and every mutation is audited (§5.8). A non-admin viewer sees the unchanged public surfaces.

Requirements traced throughout: `FR-04-01 … FR-04-51`, `BR-04-01 … BR-04-29`,
`AC-04-01 … AC-04-31` (see [`frd-04-store-domain.md`](./frd-04-store-domain.md)).
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
pagination            desktop: summary + per-page Select + numbered nav / mobile: summary + "Cargar más"
```

The defining choice: the body is a **responsive CSS card grid** (1 col `<640px` → 2 cols
`640–1024px` → 3 cols `>1024px`, grid `gap-[14px]`), **not** the tabular row pattern used by
orders/deliveries. Each cell is a `.store-card` anchor (`<a href>` to the detail), so the
whole card is one keyboardable link.

**StoreCard anatomy** (component `StoreCard`, fixed-height card): `StoreAvatar` s56 — the store
**logo** when one is set (same as the detail hero), otherwise an accent-tint monogram for
`RETAILER`/`PROXY` and a `user` icon + muted tint for `PERSON` → store name with an inline type
icon (`store` 12px for `RETAILER` / `truck` 12px for `PROXY` / `user` 12px muted for `PERSON`) → `map-pin` + country name, followed by a `· lock 11px + "Privada"` marker in `text-secondary` at medium weight when the store is the **viewer's own private** one (added 2026-08-05) → a row of `chip accent`
**product-type** chips (icon + label) with a `chip neutral` `"+N más"` overflow pill → an
"Importa de" text line in `text-muted` (or a muted "no imports" fallback) → a top-bordered
stats row (rating number bold `.num` + review count, the viewer's order count when present,
and a `StarRating` on the right). **No neutral type/presence signal chips and no trust chips
render on the card** — only product-type chips. `StoreCommerceSignalPills` exists in the
`share/` folder but is **not used** by `StoreCard`. **Moderation status chips are not rendered
on cards** (S6.1 decision, FRD Current Implementation Notes); status appears only on detail.

The privacy marker above is deliberately **not** a chip, and that is what keeps the S6.1 decision
intact. It is inline text in the country band, so the chip row stays exactly what it was: product
types and their overflow pill. Three things ruled the chip row out. It is optional (a store with
no categories renders none, which is precisely what an image-intake store looks like, so the
marker would vanish where it matters most), its slots are capped at four (the marker would cost a
real category), and the `neutral` variant it would have used is already the overflow pill's, so
two unrelated meanings would share one appearance in one row. The country band renders on every
card, which also gives the marker a constant vertical position to scan down a column.

The marker is keyed on **ownership**, not on `isPrivate` alone: it says something about the
person looking ("this one is yours, and hidden"), so `StoreCard` takes a `viewerId` and shows it
only when the viewer created the store. The store **detail** page does not yet make this
distinction and renders "Privada, solo tú la ves" on `isPrivate` alone, which is wrong for an
admin viewing somebody else's private store; that is a known defect, not the pattern to copy.

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
  picker (`ToggleChoiceGroup` tiles) — since the set is a fixed three, the tiles stack in one
  column on mobile and expand to a single balanced row of three on desktop (`md+`), skipping the
  default two-column tile grid that would orphan the third tile — each with a one-line helper — **Comercio** (`store`
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
  `Combobox`. **Logo (RETAILER and PROXY only)** is a click/drop/paste zone (`FR-04-53`); once set
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
  `PHONE`/`WHATSAPP` accept a plain local number and normalize it against the country chosen in
  Step 2 (`FR-04-54`) rather than requiring the collector to type a country code.
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

### 2.4 Admin inline moderation & governance (planned, `FR-04-40 … FR-04-51`)

This scope is **planned, not yet shipped**. It layers admin-only affordances onto the same
detail surface described in §2.2 without changing the public reading column. Everything below
renders only when the viewer is an administrator (gated server-side by `requireAdmin()`); a
non-admin sees the unchanged public store. The admin surfaces reuse the existing detail
grammar, the canonical `Modal` ([ADR 0008](../../../design/decisions/0008-modal-enhancement.md)),
and the report-modal / governance-panel patterns already in the prototype: no new component
families are introduced.

**Admin moderation cluster on the aside** (`#s6-store-detail-admin-pending`,
`#s6-store-detail-report-notice`). A `card elevated` **"Moderación"** panel sits in the sticky
aside rail, carrying the same one-primary / ghost / destructive action grammar as every other
Acciones card. As shipped by [BP-01 · WO-09](bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md),
the panel renders in the `DetailSidebar` **Gestión** slot (its dedicated governance/admin slot)
rather than a new slot above Resumen, because the aside slot order is inviolable per
[ADR 0003 · Decision 7](../../../design/decisions/0003-demo-decisions.md):

- On a `PENDING` store: **"Aprobar tienda"** (primary, `check-circle`) → `APPROVED`;
  **"Retirar tienda"** (destructive-ghost, `ban`) → opens the removal modal.
- On an `APPROVED` store: **"Ver reportes"** (ghost) → governance panel; **"Retirar tienda"**
  (destructive-ghost).
- There is **no** "mark with a report notice" control, in any state. The cluster offers two
  decisions, publish or take down, plus the way to act on the reports themselves. The middle
  "mark it" option is deliberately absent: the product informs the buyer that reports exist and
  removes stores it judges harmful, and it does not publish its own verdict on a seller in
  between (`FR-04-43`, [ADR 0019](../../../design/decisions/0019-derived-trust-signals-moderation-status-lifecycle-only.md)).

**Derived report notice** (`#s6-store-detail-report-notice`, `FR-04-43`, BR-04-24). Independent of
moderation status and of who is viewing. When the store has at least one open report
(`STORE_REPORT_NOTICE_THRESHOLD` = 1), a `store-banner warning` (`role="alert"`) renders above the
layout for **every** viewer, anonymous included, and the hero carries a `chip warning`
**"Con reportes"** (`alert-circle`) beside the lifecycle status chip. Both are **derived reads**, not
a status: the banner appears when the first report is filed and is gone on the next read once the
last open report is resolved or dismissed. On a `PENDING` store with open reports, the calm pending
disclaimer renders first and this notice second: lifecycle statement, then report information. The
notice never hides the store and never affects indexing.

**Softened `PENDING` disclaimer** (`FR-04-50`, `AC-04-31`). The pending banner is demoted from
the alarmist warning treatment to the calm base `store-banner` (info tone): it frames the store
as under review, not as unverified or untrustworthy data. Same copy for public viewer, creator,
and admin; the admin simply gains the moderation panel beside it.

**Removal modal** (`#s6-store-detail-remove-modal`). The canonical `Modal` (dimmed detail
behind, `role="dialog"` + `aria-modal`), reusing the report-modal shell and the
`report-reasons` / `report-reason.is-selected` reason picker. Reasons are split into two labeled
groups: **Motivos neutrales** (`Tienda duplicada`, `Tienda cerrada o inactiva`,
`Información falsa o engañosa`) and a single **Motivo de sanción** (`Abuso, estafa o fraude`),
each group a `radiogroup`. An optional internal note feeds the audit entry. The confirm CTA is
**"Retirar tienda"** (destructive). Removal is a **tombstone, not a hard delete** (BR-04-22/23):
the store leaves every public surface and 404s on its own URL, but the row is retained so
referencing records keep resolving. Helper copy states the wording contract: neutral reasons
drive the neutral order message, only the abuse reason uses sanction wording.

**Removed-store tombstone (order-side).** A `REJECTED` store 404s on the public detail route
(no store-detail tombstone screen exists), so the tombstone is a **collector-order** surface,
not a store surface. Where a referencing order shows its store, it renders a neutral line by
default, `"Esta tienda ya no está disponible"`, and sanction wording only when the
`removalReason` is an abuse category (`FR-04-42`, `AC-04-22`, BR-04-23). The exact order-row
pixel belongs to the order surfaces and is now documented in the FDD-05 design record
([FDD-05 · §5.7 Removed-store tombstone](../frd-05-order-payment-shipment/fdd-05-order-payment-shipment.md)),
delivered by [FRD-05 · BP-02 · WO-08](../frd-05-order-payment-shipment/bp-02-order-workspace-and-list-experience/work-orders/wo-08-order-side-removed-store-tombstone.md);
it is intentionally **not** mocked in this prototype, which has no order-detail surface.

**Admin governance panel** (`#s6-store-detail-admin-governance`). The public
reports-and-suggestions summary (§5.6) has an admin superset: the same modal shell lists each
**open report** as an `adm-report-row` exposing the raw free-text detail **and** reporter
identity (`"Reportado por @handle"`, `lock`-noted as admin-only), with per-report **"Resolver"**
(primary) and **"Descartar"** (ghost) actions moving `StoreReport` from `OPEN` to `REVIEWED` /
`DISMISSED` (`FR-04-44`, `AC-04-24`). Raw detail and identity come from a server-only admin
data-access layer and never widen the public governance read model (`FR-04-45`, BR-04-25,
`AC-04-25`). The change-requests block links each pending request to its review surface.

Implementation reconciliation ([BP-01 · WO-10](bp-01-store-public-trust-system/work-orders/wo-10-report-resolution.md)):
the admin superset is delivered as an admin-only section **inside the existing
`StoreGovernanceSummaryModal`** (an optional `adminReports` prop populated server-side only when
the viewer is an administrator), not a separate modal, so the public modal and read model stay
untouched for non-admins. The raw rows are read through `getAdminOpenStoreReports(storeId)`
(`src/lib/data/admin/adminStoreReportQueries.ts`), and a resolution is accountable through the
`report.resolve` / `report.dismiss` audit entry only (no reviewer column is added to
`StoreReport`).

**Change-request review** (`#s6-store-change-request-review`). A focused `card elevated` review
surface: requester + submitted date, then an **`adm-diff` field list**, one `adm-diff-row` per
changed field showing the current store value (`adm-diff-before`, labeled **"Ahora"**) →
the requested value (`adm-diff-after`, labeled **"Propuesta"**). Footer is **"Aprobar y aplicar"**
(primary) and **"Rechazar"** (ghost). Approval **rebases** the diff onto the store's current state
and applies it, relation fields included, in one transaction (`FR-04-46`, BR-04-26, `AC-04-26`);
the stored diff is never blind-applied.

**Drift variant** (`#s6-store-change-request-review-drift`). Drift surfacing at this surface is
bounded to what diff-only storage supports (no base snapshot is persisted). When the store changed
after the request was filed (`store.updatedAt > changeRequest.updatedAt`), a `store-banner warning`
(`role="alert"`) surfaces the store-level drift (**"La tienda cambió desde esta solicitud"**); a
field whose current value already equals the proposal is marked with an informational **"Ya
aplicado"** tag on its `adm-diff-row` and is excluded from the apply. The primary CTA stays
**"Aprobar y aplicar"** and applies only the changes that still have effect; stale values are never
applied silently (`FR-04-47`, `AC-04-27`). The richer per-field three-value conflict view (`cuando
se propuso` / `ahora` / `propuesta` with an "En conflicto" tag) is **not derivable here** and is
deferred to the moderation console ([FRD-02](../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md)),
which must first decide a forward-only base-snapshot capture in `upsertStoreChangeRequest`.

---

## 3. Visual treatment

The Store Domain introduces **no new tokens, palettes, surfaces, or type ramps.** It
consumes the Velvet system as-is. This section records only how the FRD _applies_ the
system; the definitions live in
[visual-foundations.md](../../../design/visual-foundations.md) and
[tokens-css.md](../../../design/tokens-css.md).

### 3.1 Color roles

| Role in this FRD                                       | Token / class                                | Where                                                             |
| ------------------------------------------------------ | -------------------------------------------- | ----------------------------------------------------------------- |
| Primary CTA (`Nueva tienda`, `Crear tienda`, `Editar`) | `--accent` (Button primary)                  | toolbar, wizard step 5, owner aside                               |
| Category & selected affordances                        | `chip accent` / `.cat-chip` (accent ~10%)    | StoreCard, detail categorías, step 3                              |
| Neutral signals (import countries, overflow, Persona)  | `chip neutral`                               | detail "Importa desde", card "+N más"                             |
| Presence (physical/online) / pending status            | `--info` (`chip info`)                       | hero presence chips, pending chip                                 |
| Stock available                                        | `--success` (`chip success`)                 | hero stock chip, autosave check                                   |
| Accepts pre-orders / report notice                     | `--warning` (`chip warning`)                 | hero pre-orders chip; derived report banner + "Con reportes" chip |
| Warm private-note surface                              | `s8-card-warm` + `s8-eyebrow-chip tone-warm` | aside "Tu nota privada"                                           |
| Destructive (report)                                   | `--destructive`                              | Button destructive-ghost (report)                                 |

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

| Component                              | Tier   | Role in FRD-04                                                                                                                                                                  |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Sidebar`, `Header`                    | module | App shell chrome (PUSH sidebar, topbar)                                                                                                                                         |
| `StoreAvatar`                          | core   | s56 in cards & hero, s32 in reviews / duplicate candidates                                                                                                                      |
| `StatusChip`                           | core   | Trust & status chips, per [ADR 0002](../../../design/decisions/0002-status-chip-mapping.md)                                                                                     |
| `Button` / `IconButton`                | core   | primary / ghost / destructive-ghost hierarchy; channel actions                                                                                                                  |
| `Input` / `Textarea` / `Combobox`      | core   | name, description, country/import country, private note                                                                                                                         |
| `Select`                               | core   | list sort, channel-type select                                                                                                                                                  |
| `Switch`                               | core   | "Perfil privado", "Tiene stock", "Recibe preórdenes"                                                                                                                            |
| `Checkbox`                             | core   | terms acceptance (step 5)                                                                                                                                                       |
| `FilterTriggerButton` + `FilterDrawer` | module | list filtering — closes via X/Esc only, not outside-click (FR-04-13)                                                                                                            |
| `AppliedFilterChip`                    | core   | removable active-filter chips                                                                                                                                                   |
| `ListPagination` / `PerPageSelect`     | module | desktop summary + page-size select + numbered nav / mobile summary + "Cargar más" ([ADR 0018](../../../design/decisions/0018-list-pagination-page-size-and-desktop-summary.md)) |
| `WizardAccordion` / `Stepper`          | module | 5-step create flow                                                                                                                                                              |
| `ImageCropper`                         | module | logo crop-and-confirm step (FR-04-31)                                                                                                                                           |
| `ProgressBar`                          | core   | logo upload progress                                                                                                                                                            |
| `DetailSidebar` / `SectionCard`        | module | aside rail; subcard container                                                                                                                                                   |
| `PrivateNoteCard`                      | module | inline-editable private note                                                                                                                                                    |
| `Modal` (`ModalDialog` / `ModalSheet`) | module | report / category-request / duplicate / logo / preview overlays — [ADR 0008](../../../design/decisions/0008-modal-enhancement.md)                                               |
| `EmptyState` / `MascotBubble`          | module | filtered-empty state                                                                                                                                                            |
| `Skeleton`                             | core   | list loading                                                                                                                                                                    |
| `Toast`                                | module | create/edit/report confirmations                                                                                                                                                |

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
| Derived: open reports | `Con reportes`     | `warning` | `alert-circle`   |
| Presence physical     | `Tienda física`    | `info`    | `store`          |
| Presence online       | `Web`              | `info`    | `globe`          |
| Has stock             | (in-stock label)   | `success` | `package-check`  |
| Accepts pre-orders    | (pre-orders label) | `warning` | `calendar-clock` |

The commercial chips (physical / online / stock / pre-orders) render on the **detail hero**
(non-`PERSON` only; a `PROXY` only ever shows presence chips since it has null stock / pre-order,
plus its "Proxy" badge); moderation chips render on **detail only**, not on list cards (S6.1).

Only the first two rows are **moderation status**: they state where the store sits in its lifecycle.
"Con reportes" is a **derived trust signal**, not a status. It renders whenever the store has at
least one open report, alongside whichever lifecycle chip applies, and it disappears when the last
open report is resolved (`FR-04-43`, §2.4). It is deliberately **not** rendered on list cards
(`WO-13` D6): the notice is a detail-page surface, and a listing signal would require a
denormalized counter the data layer does not keep. `REJECTED` has no chip because it stays a public
404 **by design** and surfaces only as an order-side tombstone (§2.4, `FR-04-42`). There is **no**
"Envía a N países" chip anywhere. Person stores omit the contact/presence chips entirely.

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

**Added 2026-08-08 (`FR-04-56`/`FR-04-57`, see the store-level payments amendment at the top of
this document):** a "Registrar pago" ghost button sits between "Anotar pedido aquí" and the edit
affordance, and a "Ver mis pedidos en esta tienda" inline link sits below it, before the edit
affordance's block.

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

### 5.8 Admin inline moderation & governance (planned, `FR-04-40 … FR-04-51`)

Admin-only, gated by `requireAdmin()`, and layered onto the detail surface (§2.4). Every
mutation is **optimistic** like the rest of the app and each one writes an append-only
`AdminAuditLog` entry through the shared audit helper (`FR-04-51`, BR-04-29); the audit is a
backend concern with **no visual footprint beyond a confirmation `Toast`** in the existing toast
pattern (§5.7). The planned analytics events (`store_approved`, `store_removed`, `store_report_resolved`,
`store_report_dismissed`, `store_change_request_applied`, `store_change_request_rejected`, plus the
product-type pair) fire alongside the audit write. The two report-resolution events carry an
`open_reports_remaining` count, so a resolution that reached `0` is the one that cleared the store's
public notice.

- **Approve** (`#s6-store-detail-admin-pending`): optimistic state transition on the detail; the
  status chip and the pending disclaimer update in place, then a confirmation toast. There is no
  flag or unflag transition: the report notice is derived, so no control writes it (`FR-04-43`).
- **Report notice** (`#s6-store-detail-report-notice`): not an interaction. It is a read-time
  derivation that appears and clears on its own as reports are filed and resolved. The only
  optimistic movement it has is the one below: resolving the last open report clears the banner and
  the "Con reportes" chip in the same local update that removes the report row, restoring both from
  the returned `openReportsRemaining` if the action fails.
- **Remove** (`#s6-store-detail-remove-modal`): the modal closes synchronously on confirm
  (Optimistic Confirmation); the store drops from the current view and the referencing-order
  tombstone message is derived from the chosen `removalReason` category. Removal is a tombstone,
  reversal is out of scope for the inline controls.
- **Resolve / dismiss report** (`#s6-store-detail-admin-governance`): the report row updates or
  leaves the open list optimistically; resolving frees the reporter to file a new report
  (`AC-04-12`, `AC-04-24`).
- **Change-request review** (`#s6-store-change-request-review`): approve rebases and applies in
  one transaction; after any store write, other open change requests whose diff is now empty move
  to `SUPERSEDED` so stale requests do not linger (`FR-04-48`, BR-04-27); surfaced to their
  authors through the existing personalized governance summary, not a new surface.
- **Drift** (`#s6-store-change-request-review-drift`): drift surfacing is bounded to what diff-only
  storage supports. A store-level banner appears when the store changed after the request was filed,
  each field whose current value already matches the proposal is tagged "Ya aplicado" and excluded,
  and the apply proceeds with only the changes that still have effect; stale values are never
  applied silently (`FR-04-47`, `AC-04-27`). The per-field three-value "En conflicto" view is
  deferred to the console behind a base-snapshot decision.

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

### 6.1 Admin moderation copy (planned, `FR-04-40 … FR-04-51`)

Admin-only strings for the scope in §2.4 / §5.8. Voice is **operational and neutral**: it names
the action and its consequence plainly, without alarm or mascot. These belong to the same
`stores.json` namespace as the rest of the domain.

| Surface                                  | Tone                          | String                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Softened pending disclaimer (`FR-04-50`) | calm, non-alarmist            | `"Tienda en revisión"` · `"Una persona de la comunidad creó esta tienda y el equipo la está revisando. Ya puedes usarla con normalidad; solo no aparece en buscadores hasta que se apruebe."`                                                                                                                           |
| Report notice (`FR-04-43`)               | informative, never accusatory | `"Esta tienda tiene reportes por revisar"` · `"Personas de la comunidad reportaron que la información publicada aquí podría no estar correcta, y el equipo todavía no la revisa. Un reporte no califica a la tienda: para eso están las reseñas. Sigue visible; revisa sus datos con atención y decide por tu cuenta."` |
| Moderation actions                       | operational                   | `"Aprobar tienda"` · `"Ver reportes"` · `"Retirar tienda"` (there is no mark/unmark control, `FR-04-43`)                                                                                                                                                                                                                |
| Removal modal                            | plain, factual                | `"Retirar tienda"` · `"Elige el motivo. La tienda deja de ser pública, pero los pedidos que la referencian se conservan."`                                                                                                                                                                                              |
| Removal reasons                          | neutral vs sanción            | neutral: `"Tienda duplicada"` · `"Tienda cerrada o inactiva"` · `"Información falsa o engañosa"`; sanción: `"Abuso, estafa o fraude"`                                                                                                                                                                                   |
| Order tombstone (`FR-04-42`)             | neutral by default            | `"Esta tienda ya no está disponible"` (sanction wording only for the abuse category)                                                                                                                                                                                                                                    |
| Report resolution                        | operational                   | `"Resolver"` · `"Descartar"` · `"Detalles y autor visibles solo para administradores."`                                                                                                                                                                                                                                 |
| Change-request review                    | operational                   | `"Aprobar y aplicar"` · `"Rechazar"` · `"Ahora"` · `"Propuesta"` · `"Al aprobar, los cambios se recalculan sobre el estado actual de la tienda."`                                                                                                                                                                       |
| Change-request drift (`FR-04-47`)        | cautionary                    | `"La tienda cambió desde esta solicitud"` · `"Ya aplicado"` (per-field, excluded from the apply). The per-field `"En conflicto"` / `"Revisar conflictos"` copy is deferred to the console.                                                                                                                              |

The softened pending disclaimer **supersedes** the earlier alarmist copy
(`detail.pendingDisclaimerMessage`, "aún no ha sido verificada… revisar con precaución"): per
`AC-04-31` the pending state must read as under review, not as untrustworthy data. The `en`
equivalents live in `src/i18n/locales/en/stores.json`.

**The report-notice copy is a mandatory rewrite, not an edit.** The shipped `flaggedDisclaimer`
strings ("Esta tienda acumula reportes con credibilidad." / "This store has accumulated credible
reports.") are deleted along with their keys and replaced by `reportNoticeTitle` /
`reportNoticeMessage` and `detail.reportNotice`, carrying the copy in the table above
([BP-01 · WO-13](bp-01-store-public-trust-system/work-orders/wo-13-derived-report-notice-and-flag-removal.md)).
The old wording asserted that somebody had validated the reports, and nobody had. Three rules govern
the replacement and any future edit of it:

1. **The subject is the information, never the seller.** The notice says the published information
   may not be right. It never says or implies the store is dishonest, a scam, or fraudulent.
2. **It states that the reports are unreviewed.** That is the whole point of showing it: a report
   exists and the team has not looked at it yet.
3. **It hands the decision to the reader.** A report is not a rating; reviews and ratings are where
   a store's quality is judged. The notice informs, then explicitly leaves the judgment to the buyer.

The `en` string is normative in its own right, not a translation gloss of the `es` one. Both are
quoted verbatim in [WO-13](bp-01-store-public-trust-system/work-orders/wo-13-derived-report-notice-and-flag-removal.md).

---

## 7. Responsive

Mobile-first; desktop is extra room (decálogo #10). Breakpoint behavior is the system's —
see [interface-patterns.md → Responsive](../../../design/interface-patterns.md). FRD-04
specifics:

- **List grid**: 1 column `<640px` → 2 columns `640–1024px` → 3 columns `>1024px`. The toolbar
  collapses to search + icon-only `FilterTriggerButton` (with count badge) + `[+ Nueva]`;
  pagination becomes a centered results summary + a `"Cargar más"` ghost button — no numbered
  pages and no per-page selector on mobile, the same `ListPagination` mobile layout used by
  orders and deliveries ([ADR 0018](../../../design/decisions/0018-list-pagination-page-size-and-desktop-summary.md)).
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

Admin moderation scope (§2.4, planned) specifics:

- **Admin controls have accessible names**: every moderation control is a real `<button>` or
  link with a visible text label ("Aprobar tienda", "Retirar tienda", "Resolver", "Descartar",
  "Aprobar y aplicar"); no icon-only affordance is unlabeled.
- **Severity is never color-only**: the derived report notice, the "Con reportes" and "En conflicto"
  chips, and the drifted diff row each pair color with an icon and text label
  ([ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md)); the
  `.is-drift` row does not rely on its tint alone.
- **Removal modal focus**: follows the canonical modal pattern
  ([ADR 0008](../../../design/decisions/0008-modal-enhancement.md)): `role="dialog"` +
  `aria-modal="true"` + `aria-labelledby`, focus trapped and returned to the invoking control on
  close. The two reason groups are `radiogroup`s with `aria-checked` roving state.
- **Drift is announced**: the store-level "changed since filed" banner is `role="alert"` so the
  drift is announced when it appears, before any apply is attempted.
- **Governance rows**: raw report detail and reporter identity are admin-only content; the
  admin-only caveat is exposed as text (`lock` icon plus label), not conveyed by styling alone.

---

## 9. Sources & provenance

- **Pixel truth**: [`./prototype/store-domain.html`](./prototype/store-domain.html)
  (self-contained; opens standalone in light + dark; default palette Velvet). Verified S15;
  extended 2026-07-22 with the admin inline moderation screens (`#s6-store-detail-admin-pending`,
  `#s6-store-detail-remove-modal`, `#s6-store-detail-report-notice`,
  `#s6-store-detail-admin-governance`, `#s6-store-change-request-review`,
  `#s6-store-change-request-review-drift`).
- **System rules**: [`docs/design/`](../../../design/README.md) — visual-foundations,
  tokens-css, interface-patterns, components, motion, states, ux-copy, and ADRs
  0002/0003/0006/0007/0008/0009/0013/0014.
- **Functional contract**: [`frd-04-store-domain.md`](./frd-04-store-domain.md) and its
  blueprint/work-orders, including the admin inline moderation scope `FR-04-40 … FR-04-51`,
  `BR-04-22 … BR-04-29`, `AC-04-20 … AC-04-31` (planned, gated by
  [PRD-03 · FRD-01](../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md)).
- **Workshop raw material (historical)**: distilled from the redesign subproject; see git history. This FDD + the prototype are the
  durable record.

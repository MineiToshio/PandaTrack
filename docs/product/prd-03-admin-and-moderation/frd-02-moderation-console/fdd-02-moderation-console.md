---
id: FDD-02
type: FDD
slug: moderation-console
title: Moderation Console - Feature Design Document
status: ACTIVE
parent: FRD-02
last_updated: 2026-07-24
prototype: ./prototype/moderation-console.html
design_system: ../../../design/README.md
demo_anchors:
  - "#inbox"
  - "#review-store"
  - "#review-report"
  - "#review-flag"
  - "#review-change"
  - "#review-change-drift"
  - "#review-type"
  - "#inbox-empty"
  - "#audit"
  - "#access-denied"
---

# FDD-02 · Moderation Console - Feature Design Document

> **What this document is.** The design record for the Moderation Console (PRD-03, FRD-02). It describes what is specific to the admin surface: its screens, their states, and the copy. It does not restate the design system; it references it.
>
> **Three-source rule.** Authority order is shipped implementation, then this FDD prose, then the prototype. The prototype (`./prototype/moderation-console.html`) is a non-authoritative visual aid and may drift from shipped pixels.
>
> **Language.** User-facing copy is Spanish-default and English-available, sourced from `src/i18n/locales/{es,en}/admin.json`. Strings quoted here are the `es` reference.

---

## 1. Overview and screens covered

The Moderation Console is the administrator's home for keeping the public store layer trustworthy. It is a prioritized inbox plus a read-only audit log, not a segmented multi-queue console. Three design constraints shape it:

- It reviews in place. The inbox aggregates what is pending, prioritizes it, and lets the administrator review and act on each item without leaving the console. The privileged actions themselves are the same server actions owned by PRD-02 (FRD-04); the console invokes them, it does not fork the store lifecycle or define a parallel set of controls.
- It is impact-ordered: reported and removable stores read above low-risk items such as product-type suggestions.
- It is localized and lives inside the collector App Shell, so it inherits the shell chrome rather than inventing new navigation. The sidebar shows the collector navigation (Hoy, Pedidos, Entregas, Tiendas, Ajustes) plus an Administracion entry point (Moderacion, active; Registro), so the admin area reads as a section of the app, not a separate mini-app. The Administracion entry point renders only for administrators (`FR-02-22`); the prototype always shows it because it depicts the admin's own view, not the collector view a non-admin would see. A pending-count badge on the Moderacion entry is a later enhancement, not built in the first release: wiring a live count into the shell nav would require computing the aggregate on every app page, so v1 shows the backlog shape through the in-inbox category counters instead.

### Desktop presentation decision (master-detail split)

The desktop inbox is a **master-detail split**: a compact queue list on the left, and a review pane on the right that renders the selected item. Rationale, in short: the earlier full-width rows put data on the left and one button on the right with dead space between, which reads wrong on wide screens; the split turns that empty middle into the review itself. It also closes the visibility gap owners flagged, because clicking an item now shows its full review in context instead of appearing to do nothing, so a solo administrator decides without leaving the queue, which is the standard console pattern for clearing a backlog fast. It reuses the system split-layout family (a primary reading area beside a companion column, see [interface-patterns.md](../../../design/interface-patterns.md)) rather than inventing chrome. On mobile the split degrades to a stacked queue, and opening an item routes to a full-width detail screen with a back link, so no side-by-side layout is forced onto a narrow viewport.

### Screens in this FDD

| #   | Screen                            | Route                         | Prototype anchor       |
| --- | --------------------------------- | ----------------------------- | ---------------------- |
| 1   | Moderation inbox (master-detail)  | `/[locale]/admin`             | `#inbox`               |
| 2   | Review: pending store             | `/[locale]/admin` (item open) | `#review-store`        |
| 3   | Review: report                    | `/[locale]/admin` (item open) | `#review-report`       |
| 4   | Review: suggested removal (flag)  | `/[locale]/admin` (item open) | `#review-flag`         |
| 5   | Review: change request            | `/[locale]/admin` (item open) | `#review-change`       |
| 6   | Review: change request with drift | `/[locale]/admin` (item open) | `#review-change-drift` |
| 7   | Review: product-type suggestion   | `/[locale]/admin` (item open) | `#review-type`         |
| 8   | Empty inbox                       | `/[locale]/admin` (nothing)   | `#inbox-empty`         |
| 9   | Audit log viewer                  | `/[locale]/admin/audit`       | `#audit`               |
| 10  | Access denied                     | `/[locale]/admin` (refused)   | `#access-denied`       |

Screens 2 to 7 are the per-type review views rendered inside the right pane of the master-detail on desktop, or as their own full-width screen on mobile. Traces `FR-02-01` through `FR-02-13`, `BR-02-01` through `BR-02-04`, and `AC-02-01` through `AC-02-06`, plus the FRD-04 moderation actions (`FR-04-40` through `FR-04-51`) that each review invokes. Governing decisions: the admin platform ADR recorded for FRD-01, and the App Shell patterns in the design system.

## 2. Layout and structure per screen

The console lives inside the collector App Shell (sidebar plus topbar); see [interface-patterns.md](../../../design/interface-patterns.md). Only the content column is described here.

### 2.1 Moderation inbox, master-detail (`#inbox`)

```
+----------------------------------------------------------------------+
|  Bandeja de moderacion                                               |
|  [Reportes 1] [Tiendas 2] [Cambios 2] [Tipos 1]        <- counts     |
+--------------------------+-------------------------------------------+
|  ! Reporte  Panda Store  |  REPORTE                                  |
|  ! Baja     Figuras XYZ  |  Panda Store   Minorista . Chile . Aprob. |
|  o Pendiente Nueva Tienda|  -----------------------------------------|
|  ~ Cambio   Anime Shop   |  Reporte: SPAM  "..."  @user (solo admin) |
|  ~ Cambio   Retro Cards  |  Reportes anteriores en esta tienda       |
|  + Tipo     "Sobres..."  |  [Resolver] [Descartar] | [Retirar] Ver > |
+--------------------------+-------------------------------------------+
      queue (master)                    review pane (detail)
```

The content column is a two-column grid (`.mod-split`): a queue column (`.mod-queue`) of compact rows preceded by a row of category counters (`.queue-counts`), and a review pane (`.mod-detail-pane`). Each queue row (`.mod-row`) carries a leading category glyph and severity color, a category eyebrow, a primary label (the entity), a short meta line, and a trailing chevron. Rows are ordered by impact, not recency. Selecting a row marks it selected (`.is-selected`, an accent-tinted surface and rail) and renders that item's review in the pane.

On the desktop landing, the pane previews the top item so the surface is never blank; an explicit empty-selection placeholder (`.mod-empty-pane`) exists for completeness. The queue and every per-type review panel live once in the DOM; the pane shows one panel at a time. This is a router within the console, not a set of separate pages.

### 2.2 Per-type review anatomy and actions

Every review panel (`.mod-detail`) shares one anatomy: a header (`.mod-detail-head`) with a tinted category eyebrow, the entity title, and a row of metadata tags (`.mod-meta` wrapping `.chip` elements: seller type, country, presence, moderation status); one or more content sections (`.mod-sec`) with a compact uppercase section title; and an actions footer (`.mod-actions`) on a warm surface. The actions in each panel are the FRD-04 server actions; the console is their caller, it does not re-implement them.

**(a) Pending store (`#review-store`).** Section: store summary as submitted (`.mod-kv`: seller type, country, presence, categories, contact channels, import countries). Actions: `Aprobar` (success, `store.approve`, `FR-04-40`), `Retirar` (destructive-ghost, opens the removal modal, `store.remove`, `FR-04-41`), `Ver tienda` (link, opens the store detail). A helper line explains that approving publishes and indexes the store, while removing excludes it from public surfaces.

**(b) Report (`#review-report`).** Sections: the store mini-summary in the header; the report card (reason chip, free-text quote, reporter identity marked admin-only); and prior reports on the same store. Actions: `Resolver` (primary, `report.resolve`, `FR-04-44`), `Descartar` (secondary, `report.dismiss`), a divider, then `Retirar tienda` (destructive-ghost, removal modal, `store.remove`) and `Ver tienda` (link). The reporter identity and raw text are labeled "Solo visible para administradores", reflecting that they come from the server-only admin data layer (`FR-04-45`, `BR-02-03`), never the public governance read model.

**(c) Suggested removal, flag candidate (`#review-flag`).** A store accumulating credible reports. The header carries a strong "N reportes acumulados" tag; the section lists the accumulated reports (reason chip, quote, admin-only reporter). Actions: `Marcar` / `Quitar marca` (warning tonal toggle, `store.flag` / `store.unflag`, `FR-04-43`), `Retirar` (destructive-ghost, removal modal, `store.remove`), `Ver tienda` (link). A helper line contrasts marking (stays visible with a stronger warning) with removing (excluded from public surfaces).

**(d) Change request (`#review-change`).** Sections: a field-by-field diff and the requester comment. The stored change request is a field-level replacement diff: for list fields the server persists the entire proposed array, not a per-item delta (see `buildEditableStoreDiff` in `src/lib/data/stores/storeGovernanceMutations.ts`). The review therefore derives the per-item deltas by comparing the current store against the proposed set, so an administrator never reads a bare proposed list. A helper line (`.diff-note`) states the semantics up front: applying replaces each list with exactly the proposed set. Each field renders in its own card (`.diff-field`): scalar fields as a struck-through before value, an arrow, and the highlighted proposed value (`.diff-scalar`, `.diff-before` / `.diff-after`); list fields (contact channels, addresses, categories, import countries) as itemized rows (`.diff-items`, `.diff-item`), each carrying an icon, the value, and a text tag that classifies it as "Se agrega" (`+`, success tint), "Se elimina" (`-`, destructive tint, value struck), or "Se mantiene" (`=`, neutral muted). Actions: `Aprobar y aplicar` (success intent, `changeRequest.apply`, `FR-04-46`), `Rechazar` (destructive-ghost, `changeRequest.reject`), `Ver tienda` (link). A demo link cross-navigates to the drift variant.

**(d2) Change request with drift (`#review-change-drift`).** The same anatomy plus a drift notice (`.store-banner.warning`) at the top explaining that the store changed after the request was filed, and that approval recalculates against the current state before applying (`FR-04-47`, `BR-04-26`). The stored change request persists only proposed values, with no base snapshot, so the value the requester originally saw is not derivable; the drift view is the honest two-value cut already shipped for the store-detail surface (PRD-02, FRD-04 · WO-11), not a three-value conflict view. Each affected field shows two values, "Ahora" (the current store value, `.is-current`) and "Propuesta" (`.is-proposed`), plus a single derived tag "Ya aplicado" (`.drift-tag.applied`) when the current value already equals the proposal, so approving is a no-op for that field. There is no "En conflicto" tag and no "Cuando se propuso" column, because neither is derivable from diff-only storage. A per-field note states the consequence in words. Non-drifted fields render normally with the scalar or itemized presentation of (d). The action set is the same actions as (d), and the primary action stays `Aprobar y aplicar`, which re-derives the diff against the current store state and applies only the fields that still have effect; a helper line clarifies that approval keeps each list exactly as proposed.

**(e) Product-type suggestion (`#review-type`).** Sections: the requester and reason; and a catalog preview (`.mod-catalog`) showing what approval authors, the `es` and `en` names plus the generated `key`. Actions: `Aprobar` (primary, `productType.approve`, `FR-04-49`, authors the global catalog entry) and `Rechazar` (secondary, `productType.reject`).

### 2.3 Removal modal

A shared confirmation modal (`.m01-overlay` / `.m01b-modal`, `role="alertdialog"`) reachable from the pending-store, report, and suggested-removal reviews. It ports the canonical Semantic Depth modal (M01-B) verbatim: a blurred backdrop, a destructive tonal icon-circle, title, subtitle, a reason body, and a footer separated by a divider; see [interface-patterns.md](../../../design/interface-patterns.md) and `.agents/rules/modal-canonical-pattern.mdc`. The body is a reason radiogroup over the four shipped `StoreRemovalReason` values, grouped as neutral (`Tienda duplicada`, `Cerrada o inactiva`, `Informacion falsa`) plus a single sanction reason (`Abuso o estafa`), and the reason is persisted as `removalReason` (`FR-04-41`, `BR-04-23`). The console reuses the FRD-04 removal modal as shipped; the earlier five-reason list in the prototype is superseded by the shipped enum per the three-source rule. The primary action is destructive; it dismisses Esc, on the close control, and on outside click. In production this modal wraps the same `store.remove` action as the inline `Retirar`.

### 2.4 Empty inbox (`#inbox-empty`)

A centered success-style panel: "nothing pending" reads as a first-class success, not a failure.

### 2.5 Audit log viewer (`#audit`)

A read-only table (`.audit`) with a header row and one row per entry, newest first, plus a pagination control. Column order is Cuando, Admin, Accion, Objetivo, Motivo, mapping to the `AdminAuditLog` fields UTC timestamp, actor, action key, target, reason when present. The action keys shown are the stable keys defined for `FR-04-51` (for example `store.remove`, `report.resolve`, `changeRequest.apply`, `productType.approve`).

### 2.6 Access denied (`#access-denied`)

A centered empty-style panel with an icon, a short heading, and a line explaining the space is for administrators. It never renders moderation data. In practice a refused user is redirected; this state exists for the direct-hit case and for the prototype.

## 3. Visual treatment

The Moderation Console introduces no new tokens, palettes, surfaces, or type ramps. It consumes the system as-is, and it ports the exemplar chrome verbatim: the same App Shell (rounded-card sidebar plus topbar), demo header (Pantallas dropdown, five-palette switch, theme toggle), buttons (`.btn` with `primary` / `ghost` / `destructive-ghost` / `destructive` / `warning` / `accent` / `link`), chips (`.chip` and `.eyebrow-chip` tones), cards, banners (`.store-banner`), and the Semantic Depth modal, reusing the same class names where portable so the console is visually indistinguishable from the rest of the product. This section records only how the FRD applies the system; definitions live in [visual-foundations.md](../../../design/visual-foundations.md).

### 3.1 Color roles

| Role in this FRD                   | Token / class                 | Where                                                       |
| ---------------------------------- | ----------------------------- | ----------------------------------------------------------- |
| Critical items (reports, removals) | `--destructive`               | queue severity rail and glyph, report reason chips          |
| Attention items (pending, changes) | `--warning`                   | queue severity glyph, flag toggle, drift banner and tags    |
| Low-risk items (product types)     | `--info`                      | queue severity glyph                                        |
| Selected queue row                 | `--accent`                    | `.mod-row.is-selected` tinted surface + rail                |
| Diff scalar before / after         | muted / `--text-primary`      | `.diff-before` (struck) / `.diff-after`                     |
| Diff list delta                    | `--success` / `--destructive` | `.diff-item.is-add` / `.diff-item.is-remove`; keep is muted |
| Drift current value / tags         | `--warning` / `--success`     | `.dv-cell.is-current`; `.drift-tag.conflict` / `.applied`   |
| Primary and confirm actions        | `--accent` / `--destructive`  | `.btn.primary` review confirm; `.btn.destructive` removal   |
| Counters                           | chip / `--surface-elevated`   | `.queue-counts` `.qcount`                                   |

Solid action buttons take their label color from the ported button classes exactly as the design system defines them: `.btn.primary` and `.btn.destructive` carry a near-white label, `.btn.warning` a dark label, so contrast holds in both themes across all five palettes without a console-local token.

### 3.2 Typography

Inherits the system ramp: queue row labels at body-strong, meta lines at small muted, review titles at the panel heading size, section titles at small uppercase muted, and the audit table at tabular small with `font-variant-numeric: tabular-nums` for timestamps. See [visual-foundations.md](../../../design/visual-foundations.md).

### 3.3 Shape, radius, and elevation

Queue rows, review panels, the audit table, and the modal use the standard card surface, border, and radius tokens; no bespoke elevation beyond the shared shadow tokens.

## 4. Components consumed

The console is an assembly of existing components plus a small set of module-local pieces. See [components.md](../../../design/components.md).

| Component   | Tier   | Role in FRD-02                                       |
| ----------- | ------ | ---------------------------------------------------- |
| App Shell   | module | hosts the console (sidebar plus topbar)              |
| Button      | core   | review actions, pagination                           |
| Chip        | core   | category counters, metadata tags, reason chips       |
| Modal       | module | removal confirmation (Semantic Depth, `alertdialog`) |
| Empty State | module | empty inbox, empty selection, access denied          |
| Table       | core   | audit log                                            |

Module-local, non-reusable pieces named for clarity only: `ModerationQueue`, `QueueRow`, `ReviewPanel`, `FieldDiff`, `ReportCard`, `QueueCounts`, `AuditRow`. None introduces a new system primitive; if any becomes reusable it must be registered in `components.md`.

## 5. Interactions and states

### 5.1 Cross-cutting states

Empty, loading, and error follow the system defaults in [states.md](../../../design/states.md). The inbox empty state is a first-class success ("nothing pending"), not a failure. The empty-selection placeholder in the review pane is a neutral prompt, not an error.

### 5.2 Master-detail selection and routing

Selecting a queue row opens its review in the right pane (desktop) or routes to a full-width detail screen (mobile). The prototype demonstrates this with a hash router; in the app the selection is a route the shell resolves. The console does not mutate governance state on selection; the mutation happens when the administrator invokes a review action.

### 5.3 Review actions are FRD-04 actions

Every action in a review panel dispatches the corresponding FRD-04 server action (`store.approve`, `store.remove`, `store.flag`, `store.unflag`, `report.resolve`, `report.dismiss`, `changeRequest.apply`, `changeRequest.reject`, `productType.approve`, `productType.reject`), each gated by `requireAdmin()` and each writing an `AdminAuditLog` entry (`FR-04-51`, `BR-04-29`). The console is the caller. When an action reaches a terminal state, the item leaves the inbox on the next read, and the pane advances to the next item or the empty-selection prompt.

### 5.4 Optimistic behavior and motion

Following the optimistic-updates policy, a review action applies optimistically and the modal or sheet closes synchronously on submit, with the parent coordinator owning rollback plus the failure toast. Motion follows [motion.md](../../../design/motion.md).

## 6. Copy and voice

Tone follows [ux-copy.md](../../../design/ux-copy.md); terminology follows [../../glossary.md](../../glossary.md). Copy lives in the `admin` namespace (`admin.json`).

### 6.1 Inbox and queue

| Surface          | Tone          | String (`es`)                                                                                       |
| ---------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| Inbox title      | plain, direct | "Bandeja de moderacion"                                                                             |
| Inbox subtitle   | plain         | "Todo lo pendiente por revisar, ordenado por impacto. Elige un elemento para revisarlo aqui mismo." |
| Counters         | terse         | "Reportes", "Tiendas", "Cambios", "Tipos"                                                           |
| Queue categories | terse         | "Reporte", "Baja sugerida", "Tienda pendiente", "Cambio propuesto", "Tipo de producto"              |
| Empty selection  | neutral       | "Selecciona un elemento de la bandeja para revisarlo aqui."                                         |
| Empty inbox      | reassuring    | "Todo al dia", "No hay nada pendiente por moderar."                                                 |
| Back to queue    | destination   | "Bandeja"                                                                                           |

The four counters map to the four persisted categories (Reportes, Tiendas, Cambios, Tipos). "Baja sugerida" is a derived row, not a fifth persisted category: it appears when 2 or more open reports on the same store collapse into it (see `FR-02-05`), and it counts inside the "Tiendas" counter bucket alongside pending stores, since both are store-level items awaiting a store decision.

### 6.2 Review sections and fields

| Surface            | String (`es`)                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Section titles     | "Resumen de la tienda", "Reporte", "Reportes anteriores en esta tienda", "Reportes acumulados", "Cambios propuestos", "Comentario de quien propone", "Motivo", "En el catalogo"                                          |
| Store fields       | "Tipo de vendedor", "Pais", "Presencia", "Categorias", "Canales de contacto", "Importa desde"                                                                                                                            |
| Catalog fields     | "Nombre en espanol", "Nombre en ingles", "Clave", "Al aprobar se crea esta entrada global del catalogo"                                                                                                                  |
| Status / meta tags | "En revision", "Aprobada", "{n} reportes acumulados", "{n} campos modificados", "Con desfase"                                                                                                                            |
| Reason chips       | "Spam", "Abuso", "Duplicada", "Informacion falsa", "Otro"                                                                                                                                                                |
| Admin-only markers | "Reportada por", "Propuesto por", "Solo visible para administradores", "Solo admin"                                                                                                                                      |
| Diff helper (list) | "Al aprobar, cada lista (categorias, canales, direcciones, importaciones) queda exactamente como se propone."                                                                                                            |
| Diff field kinds   | "campo de texto", "lista · reemplazo completo"                                                                                                                                                                           |
| List delta tags    | "Se agrega", "Se elimina", "Se mantiene"                                                                                                                                                                                 |
| Drift notice       | "La tienda cambio desde que se propuso este cambio.", "Al aprobar se recalcula contra el estado actual de la tienda."                                                                                                    |
| Drift value labels | "Ahora", "Propuesta"                                                                                                                                                                                                     |
| Drift derived tag  | "Ya aplicado" (la propuesta ya coincide con el estado actual: aprobar no cambia nada). No hay tag "En conflicto" ni valor "Cuando se propuso": el diff almacenado guarda solo los valores propuestos, sin snapshot base. |

### 6.3 Actions and modal

| Surface                | Tone        | String (`es`)                                                                                                                                               |
| ---------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Store actions          | verb-first  | "Aprobar", "Retirar", "Ver tienda"                                                                                                                          |
| Report actions         | verb-first  | "Resolver", "Descartar", "Retirar tienda", "Ver tienda"                                                                                                     |
| Flag actions           | verb-first  | "Marcar", "Quitar marca", "Retirar", "Ver tienda"                                                                                                           |
| Change actions         | verb-first  | "Aprobar y aplicar", "Rechazar", "Ver tienda"                                                                                                               |
| Change actions (drift) | verb-first  | "Aprobar y aplicar", "Rechazar", "Ver tienda" (same primary as non-drift; approval re-derives against the current store, matching WO-11)                    |
| Product-type actions   | verb-first  | "Aprobar", "Rechazar"                                                                                                                                       |
| Removal modal          | plain, calm | title "Retirar tienda"; subtitle "Elige un motivo. La tienda dejara de mostrarse en las superficies publicas; los pedidos que la referencian se conservan." |
| Removal reasons        | terse       | "Tienda duplicada", "Cerrada o inactiva", "Informacion falsa", "Abuso o estafa" (the four shipped `StoreRemovalReason` values)                              |
| Removal footer         | plain       | "Cancelar", "Retirar tienda"                                                                                                                                |

### 6.4 Audit

| Surface          | Tone  | String (`es`)                                                   |
| ---------------- | ----- | --------------------------------------------------------------- |
| Audit title      | plain | "Registro de actividad"                                         |
| Audit pagination | plain | "Mas antiguos"                                                  |
| Access denied    | plain | "Acceso restringido", "Esta area es solo para administradores." |

## 7. Responsive

Only FRD-specific behavior; the rest defers to [interface-patterns.md](../../../design/interface-patterns.md).

**Desktop (`>= 861px`).** The inbox is the two-column master-detail: queue on the left, review pane on the right, both visible at once. The queue keeps a comfortable fixed measure while the pane takes the remaining width, so the wide-screen space is used by the review rather than left empty.

**Mobile (`< 861px`).** The split collapses to one column. The inbox shows the queue only; opening an item swaps to a full-width review with a back link to the queue (a list-then-detail navigation, not a side-by-side pane). The store summary and diff rows restack to a single column, the category counters wrap above the list, and the actions footer sticks to the bottom of the review so the primary decisions stay reachable. The audit table scrolls horizontally inside its own container so the page body never scrolls sideways.

## 8. Accessibility (FRD-02 specifics)

Beyond the system WCAG 2.2 AA baseline:

- **List-detail relationship.** The queue is a list of actionable rows, each with an accessible name that states the category and the entity; the review pane is the detail for the selected row. Selection is conveyed by more than color: the selected row carries a tinted surface, an accent rail, and the pane content changes.
- **Focus into the detail.** Opening an item moves focus to the review pane so keyboard users land on the review, not back at the top of the queue; on mobile the back link is an early focus stop that returns to the queue.
- **Action naming.** Every action button reads as an unambiguous verb plus object ("Aprobar", "Retirar tienda", "Aprobar y aplicar"); icon-only affordances (theme, back) carry accessible labels. The removal control opens a `role="alertdialog"` with a labelled reason radiogroup, and the destructive confirm is distinct from cancel.
- **Severity is never color-only.** Each queue row and review carries a text category label and a glyph in addition to the severity color; reason chips pair an icon with the reason text.
- **Diff and drift markers are never color-only.** Each list-delta row pairs its tint with an icon (`+` / `-` / `=`) and a written tag ("Se agrega" / "Se elimina" / "Se mantiene"); each drift field pairs its tint with a written derived tag ("Ya aplicado") and a plain-language note, and the two drift values carry the text labels "Ahora" / "Propuesta". No add/remove/keep or drift state is signalled by color alone.
- **Admin-only data is marked in text.** Reporter identity and raw report text carry a visible "Solo visible para administradores" marker, not a color cue alone.
- The audit table uses proper header cells; the access-denied state is announced and focus moves to its heading.

## 9. Sources and provenance

- Pixel truth: `./prototype/moderation-console.html`.
- System rules: `docs/design/` (App Shell, split layout, tables, chips, modals, empty states, tokens) and the admin platform ADR recorded for FRD-01.
- Functional contract: [frd-02-moderation-console.md](frd-02-moderation-console.md) for the console requirements, and PRD-02 FRD-04 (`FR-04-40` through `FR-04-51`) for the moderation actions each review invokes.

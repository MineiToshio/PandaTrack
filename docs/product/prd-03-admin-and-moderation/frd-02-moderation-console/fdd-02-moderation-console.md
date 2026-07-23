---
id: FDD-02
type: FDD
slug: moderation-console
title: Moderation Console - Feature Design Document
status: ACTIVE
parent: FRD-02
last_updated: 2026-07-22
prototype: ./prototype/moderation-console.html
design_system: ../../../design/README.md
demo_anchors:
  - "#inbox"
  - "#inbox-empty"
  - "#audit"
  - "#access-denied"
---

# FDD-02 · Moderation Console - Feature Design Document

> **What this document is.** The design record for the Moderation Console (PRD-03, FRD-02). It describes what is specific to the admin surface: its two screens, their states, and the copy. It does not restate the design system; it references it.
>
> **Three-source rule.** Authority order is shipped implementation, then this FDD prose, then the prototype. The prototype (`./prototype/moderation-console.html`) is a non-authoritative visual aid and may drift from shipped pixels.
>
> **Language.** User-facing copy is Spanish-default and English-available, sourced from `src/i18n/locales/{es,en}/admin.json`. Strings quoted here are the `es` reference.

---

## 1. Overview and screens covered

The Moderation Console is the administrator's home for keeping the public store layer trustworthy. It is deliberately minimal: a single prioritized inbox and a read-only audit log, not a segmented multi-queue console. Three design constraints shape it:

- It is a router, not a control panel: the inbox lists what is pending and links to the inline controls owned by PRD-02 (FRD-04); it does not host the moderation actions themselves.
- It is impact-ordered: reported and removable stores read above low-risk items such as product-type suggestions.
- It is localized and lives inside the collector App Shell, so it inherits the shell chrome rather than inventing new navigation.

### Screens in this FDD

| #   | Screen           | Route                       | Prototype anchor |
| --- | ---------------- | --------------------------- | ---------------- |
| 1   | Moderation inbox | `/[locale]/admin`           | `#inbox`         |
| 2   | Audit log viewer | `/[locale]/admin/audit`     | `#audit`         |
| 3   | Access denied    | `/[locale]/admin` (refused) | `#access-denied` |

Traces `FR-02-01` through `FR-02-13`, `BR-02-01` through `BR-02-04`, and `AC-02-01` through `AC-02-06`. Governing decisions: the admin platform ADR recorded for FRD-01, and the App Shell patterns in the design system.

## 2. Layout and structure per screen

The console lives inside the collector App Shell (sidebar plus topbar); see [interface-patterns.md](../../../design/interface-patterns.md). Only the content column is described here.

### 2.1 Moderation inbox (`#inbox`)

```
+--------------------------------------------------------------+
|  Bandeja de moderacion                                       |
|  [Tiendas 3] [Reportes 2] [Cambios 1] [Tipos 4]   <- counts  |
+--------------------------------------------------------------+
|  ! Reporte  · Panda Store · SPAM             Revisar  >      |
|  ! Baja     · Figuras XYZ · 3 reportes       Revisar  >      |
|  o Pendiente· Nueva Tienda · sin aprobar     Revisar  >      |
|  ~ Cambio   · Anime Shop · 4 campos          Revisar  >      |
|  + Tipo     · "Sobres coleccionables"        Revisar  >      |
+--------------------------------------------------------------+
```

The content column is a single vertical list (`.inbox-list`) preceded by a row of category counters (`.queue-counts`). Each row (`.inbox-item`) carries a leading category glyph and severity color, a primary label (the entity and why it is pending), a secondary detail line, and a trailing action affordance that links to where the administrator acts. Rows are ordered by impact, not recency.

### 2.2 Audit log viewer (`#audit`)

```
+--------------------------------------------------------------+
|  Registro de actividad                                       |
+--------------------------------------------------------------+
|  Cuando        Admin    Accion          Objetivo    Motivo   |
|  22 jul 14:03  owner    store.remove    Panda Store  spam    |
|  22 jul 13:58  owner    report.resolve  Figuras XYZ  -       |
+--------------------------------------------------------------+
|  [ Mas antiguos ]                                            |
```

A read-only table (`.audit-table`) with a header row and one row per entry, newest first, plus a pagination control. Columns map to the `AdminAuditLog` fields.

### 2.3 Access denied (`#access-denied`)

A centered empty-style panel (`.access-denied`) with an icon, a short heading, and a line explaining the space is for administrators. It never renders moderation data. In practice a refused user is redirected; this state exists for the direct-hit case and for the prototype.

## 3. Visual treatment

The Moderation Console introduces no new tokens, palettes, surfaces, or type ramps. It consumes the system as-is. This section records only how the FRD applies it; definitions live in [visual-foundations.md](../../../design/visual-foundations.md).

### 3.1 Color roles

| Role in this FRD                   | Token / class             | Where                         |
| ---------------------------------- | ------------------------- | ----------------------------- |
| Critical items (reports, removals) | `--destructive`           | inbox severity glyph and rail |
| Attention items (pending, changes) | `--warning`               | inbox severity glyph          |
| Low-risk items (product types)     | `--info` / `--text-muted` | inbox severity glyph          |
| Primary action (`Revisar`)         | `--accent`                | inbox row affordance          |
| Counters                           | `chip` / `--surface-warm` | `.queue-counts`               |

### 3.2 Typography

Inherits the system ramp: row primary labels at body-strong, secondary lines at small muted, the audit table at tabular small with `font-variant-numeric: tabular-nums` for timestamps. See [visual-foundations.md](../../../design/visual-foundations.md).

### 3.3 Shape, radius, and elevation

Inbox rows and the audit table use the standard card surface, border, and radius tokens; no bespoke elevation.

## 4. Components consumed

The console is an assembly of existing components plus a small set of module-local pieces. See [components.md](../../../design/components.md).

| Component   | Tier   | Role in FRD-02                          |
| ----------- | ------ | --------------------------------------- |
| App Shell   | module | hosts the console (sidebar plus topbar) |
| Button      | core   | `Revisar` affordance, pagination        |
| Chip        | core   | category counters                       |
| Empty State | module | empty inbox, access denied              |
| Table       | core   | audit log                               |

Module-local, non-reusable pieces named for clarity only: `InboxItem`, `QueueCounts`, `AuditRow`. None introduces a new system primitive; if any becomes reusable it must be registered in `components.md`.

## 5. Interactions and states

### 5.1 Cross-cutting states

Empty, loading, and error follow the system defaults in [states.md](../../../design/states.md). The inbox empty state is a first-class success ("nothing pending"), not a failure.

### 5.2 Inbox routing

Opening a row navigates to the action surface (for a store, its detail with the inline controls owned by PRD-02, FRD-04). The console does not mutate governance state; when the administrator resolves an item at its surface, it leaves the inbox on the next read.

### 5.3 Optimistic behavior and motion

The console is read-and-route, so it carries little optimistic state of its own; the optimistic confirmation happens at the action surfaces (FRD-04). Motion follows [motion.md](../../../design/motion.md) and the `optimistic-client-updates` policy.

## 6. Copy and voice

Tone follows [ux-copy.md](../../../design/ux-copy.md); terminology follows [../../glossary.md](../../glossary.md). Copy lives in the `admin` namespace (`admin.json`).

| Surface          | Tone            | String (`es`)                             |
| ---------------- | --------------- | ----------------------------------------- |
| Inbox title      | plain, direct   | "Bandeja de moderacion"                   |
| Counters         | terse           | "Tiendas", "Reportes", "Cambios", "Tipos" |
| Empty inbox      | reassuring      | "No hay nada pendiente por moderar."      |
| Row action       | verb-first      | "Revisar"                                 |
| Audit title      | plain           | "Registro de actividad"                   |
| Audit pagination | plain           | "Mas antiguos"                            |
| Access denied    | plain, no blame | "Esta area es solo para administradores." |

## 7. Responsive

Only FRD-specific behavior; the rest defers to [interface-patterns.md](../../../design/interface-patterns.md). On narrow viewports the category counters wrap above the list, and each inbox row collapses its secondary detail under the primary label while keeping the action affordance reachable. The audit table scrolls horizontally inside its own container so the page body never scrolls sideways.

## 8. Accessibility (FRD-02 specifics)

Beyond the system WCAG 2.2 AA baseline: category severity is never color-only (each row carries a text label and glyph); the inbox is a list with each row an actionable link with an accessible name that states the category and entity; the audit table uses proper header cells; the access-denied state is announced and focus moves to its heading.

## 9. Sources and provenance

- Pixel truth: `./prototype/moderation-console.html`.
- System rules: `docs/design/` (App Shell, tables, chips, empty states, tokens) and the admin platform ADR recorded for FRD-01.
- Functional contract: [frd-02-moderation-console.md](frd-02-moderation-console.md), which owns the requirements and data contracts this design serves.

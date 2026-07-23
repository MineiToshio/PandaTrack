---
id: BP-01
type: BLUEPRINT
slug: moderation-console
title: Moderation Console
status: DRAFT
parent: FRD-02
children:
  - WO-01
  - WO-02
  - WO-03
last_updated: 2026-07-22
implementation_status: PLANNED
---

# BP-01 Moderation Console

## Overview

This blueprint describes how to build the admin surface defined in [FRD-02](../frd-02-moderation-console.md): a localized, role-gated space at `/[locale]/admin` with a prioritized moderation inbox and an audit log viewer. It consumes the platform from PRD-03 (FRD-01) and routes to the inline controls owned by PRD-02 (FRD-04). It builds UI; it does not define moderation logic.

## Blueprint Goals

- Stand up a localized admin route group gated by `requireAdmin()`.
- Build a server-only aggregate read model that gathers the four pending categories into one list.
- Present a prioritized inbox that routes to the inline controls, plus an audit log viewer.

## Requirement Coverage

- Admin space and shell: `FR-02-01`, `FR-02-02`, `FR-02-03`, `FR-02-04`.
- Moderation inbox: `FR-02-05`, `FR-02-06`, `FR-02-07`, `FR-02-08`, `FR-02-09`, `FR-02-10`.
- Audit log viewer: `FR-02-11`, `FR-02-12`.
- Analytics: `FR-02-13`.
- Business rules: `BR-02-01` through `BR-02-04`.

## Runtime Components

### 1. Routing and gating layer

- Primary source(s): new route group `src/app/[locale]/(admin)/`, its `layout.tsx`, and `src/proxy.ts`.
- Current responsibilities: `proxy.ts` gates private routes by session presence only; no admin route exists.
- Role: add the admin route group under `[locale]`; gate its layout with `requireAdmin()`; add the admin prefix to the proxy for an optimistic redirect only.

### 2. Localization layer

- Primary source(s): new `admin` namespace under `src/i18n/locales/{es,en}/admin.json`; next-intl wiring.
- Current responsibilities: existing namespaces localize the collector app.
- Role: hold all admin copy; Spanish default, English available; no hardcoded strings.

### 3. Aggregate read layer

- Primary source(s): new `src/lib/data/admin/moderationQueueQueries.ts` (server-only), composed from existing per-store governance reads.
- Current responsibilities: `getStoreGovernanceSummary` serves the public transparency modal, including anonymous visitors.
- Role: gather pending stores, open reports, pending change requests, and pending product-type requests into one prioritized list; read sensitive fields through this admin-only path, never by widening the public read model.

### 4. Console UI layer

- Primary source(s): new `_components` under the admin route group (inbox list, category counts, empty state, audit table).
- Current responsibilities: none.
- Role: render the inbox and the audit viewer; each inbox item links to where the admin acts.

### 5. Verification layer

- Primary source(s): unit tests for the aggregate read and ordering; E2E for the gated space, the inbox, and the audit viewer.
- Role: prove non-admins are refused, the inbox aggregates and orders correctly, items route to the inline controls, and the console renders in both languages.

## Current System Contracts

### Gating contract

- The admin layout calls `requireAdmin()`; a refused user never renders console data.
- The proxy adds the admin prefix for an optimistic redirect; it is not the authorization boundary.

### Aggregate read contract

- The inbox read is server-only and admin-only; it composes the existing per-store governance reads rather than widening the public model.
- Items are ordered by impact: reported and removable stores first, then pending stores and change requests, then product-type suggestions.

### Routing-to-action contract

- Each inbox item carries a link to its action surface (for a store, its detail with inline controls in PRD-02, FRD-04); the console does not mutate governance state itself.
- The audit viewer reads `AdminAuditLog` (PRD-03, FRD-01) newest first.

## Architectural Decisions Already Visible

- The console lives under `[locale]` so it is localized and stays inside the i18n routing and the proxy matcher; a bare `/admin` is avoided.
- The inbox is a read-and-route surface; moderation mutations remain owned by the store domain, keeping one lifecycle per action rather than a duplicate control set.
- The route group and i18n structure are chosen so a subdomain move and content-language routing are additive later.

## Planned Extension Points

- A segmented multi-queue console with tabs, filters, and bulk actions.
- Content-language and country routing of queues (store `countryCode` already exists).
- Moderator assignment and, eventually, resource-scoped permissions.

## Risks and Constraints

- Reusing the public governance read model would leak reporter identity and raw text; the admin read must be a separate server-only path.
- Over-investing in queue sophistication for a single administrator is waste; the first release stays a single inbox.
- Localizing the console is a repo rule, not optional; the `admin` namespace must exist from the first slice.

## ADR Need

No new ADR is required beyond the platform ADR recorded for FRD-01; this blueprint applies that decision. If the later subdomain move is taken, record it then.

## Implementation Plan

Execution order:

1. `WO-01` (vertical): admin route group, `requireAdmin()` gating, proxy prefix, localized shell, and the `admin` i18n namespace. Establishes the space and its access boundary.
2. `WO-02` (vertical): the moderation inbox, its server-only aggregate read model, prioritized listing with category counts, empty state, routing to the inline controls, and analytics.
3. `WO-03` (vertical): the audit log viewer over `AdminAuditLog`, with baseline pagination and analytics.

`WO-01` depends on PRD-03 (FRD-01) · `WO-01` for `requireAdmin()`. `WO-02` and `WO-03` depend on `WO-01` (the shell and gating) and can proceed in parallel after it. There is no foundation slice here: the only shared non-UI artifact (the aggregate read) is used by a single flow (the inbox), so it lives in `WO-02`.

## Linked Work Orders

- `work-orders/wo-01-admin-space-shell-and-gating.md`
- `work-orders/wo-02-moderation-inbox.md`
- `work-orders/wo-03-audit-log-viewer.md`

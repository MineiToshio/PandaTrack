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
last_updated: 2026-07-23
implementation_status: PLANNED
---

# BP-01 Moderation Console

## Overview

This blueprint describes how to build the admin surface defined in [FRD-02](../frd-02-moderation-console.md): a localized, role-gated space at `/[locale]/admin` with a prioritized moderation inbox, a per-type review for each pending item, and an audit log viewer. It consumes the platform from PRD-03 (FRD-01) and invokes, in place, the server actions owned by PRD-02, [FRD-04](../../../prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md). It builds UI; it does not define moderation logic.

## Blueprint Goals

- Stand up a localized admin route group gated by `requireAdmin()`.
- Build a server-only aggregate read model that gathers the four pending categories into one list and feeds each item's per-type review payload.
- Present a prioritized master-detail inbox (queue plus review pane on desktop, stacked queue plus full-width detail on mobile) whose per-type reviews invoke the FRD-04 server actions in place, plus an audit log viewer.

## Requirement Coverage

- Admin space and shell: `FR-02-01`, `FR-02-02`, `FR-02-03`, `FR-02-04`.
- Moderation inbox: `FR-02-05`, `FR-02-06`, `FR-02-07`, `FR-02-08`, `FR-02-09`, `FR-02-10`.
- Audit log viewer: `FR-02-11`, `FR-02-12`.
- Analytics: `FR-02-13`.
- Per-type review: `FR-02-14` through `FR-02-21`.
- Admin navigation entry point (role-gated UX): `FR-02-22`.
- Business rules: `BR-02-01` through `BR-02-05`.

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
- Role: gather pending stores, open reports, pending change requests, and pending product-type requests into one prioritized list, and shape the per-type review payload for each item (store summary, report plus prior reports, accumulated reports, change-request diff plus drift, product-type catalog preview); read sensitive fields through this admin-only path, never by widening the public read model.

### 4. Console UI layer

- Primary source(s): new `_components` under the admin route group (queue list, category counts, empty state, the master-detail split, one review panel per item type, the removal-reason modal invocation, audit table).
- Current responsibilities: none.
- Role: render the inbox queue and, for the selected item, its per-type review; on desktop the queue and review pane sit side by side with the top item auto-previewed, on mobile the queue is a single stacked column and opening an item routes to a full-width review with a back link. Every review action invokes the corresponding FRD-04 server action in place; the console renders and calls, it does not own the mutation. Also renders the audit viewer.

### 5. Verification layer

- Primary source(s): unit tests for the aggregate read and ordering; E2E for the gated space, the inbox, and the audit viewer.
- Role: prove non-admins are refused, the inbox aggregates and orders correctly, each per-type review renders and invokes its FRD-04 action, and the console renders in both languages.

## Current System Contracts

### Gating contract

- The admin layout calls `requireAdmin()`; a refused user never renders console data.
- The proxy adds the admin prefix for an optimistic redirect; it is not the authorization boundary.
- The app shell's admin navigation entry point (PRD-02, FRD-03) is role-conditional as a UX affordance only; `requireAdmin()` at the admin layout remains the actual security boundary regardless of whether the entry is shown (`FR-02-22`, `BR-02-05`).

### Aggregate read contract

- The inbox read is server-only and admin-only; it composes the existing per-store governance reads rather than widening the public model.
- The read groups open reports per store and derives a flag-candidate (suggested-removal) row when a store's open-report count reaches a threshold of 2 or more; that derived row collapses the store's individual report rows into one in the queue. The threshold is a named constant, to be promoted to `src/lib/constants.ts` at implementation time rather than repeated as a literal.
- Items are ordered by impact: derived flag-candidate rows and other reported or removable stores first, then pending stores and change requests, then product-type suggestions. Flag candidates are a derived queue row, not a fifth persisted aggregation category; the four persisted categories stay pending stores, open reports, pending change requests, and pending product-type requests.
- The same read shapes both the queue row and the selected item's per-type review payload, so the two never drift apart.

### Invoke-in-place contract

- Each inbox item opens a per-type review rendered inside the console; the review's actions invoke the FRD-04 server actions directly, by their stable audit action keys: `store.approve`, `store.remove`, `store.flag`, `store.unflag`, `report.resolve`, `report.dismiss`, `changeRequest.apply`, `changeRequest.reject`, `productType.approve`, `productType.reject`. All ten are owned and implemented by PRD-02, [FRD-04](../../../prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md); the console is their caller, never their owner, and does not mutate governance state outside of invoking them.
- Store removal from any review (pending store, report, suggested removal) goes through the shared reason-selection modal defined by FRD-04, not a console-local confirmation.
- The audit viewer reads `AdminAuditLog` (PRD-03, FRD-01) newest first, using the same action keys above as the `action` column values.

## Architectural Decisions Already Visible

- The console lives under `[locale]` so it is localized and stays inside the i18n routing and the proxy matcher; a bare `/admin` is avoided.
- The inbox is a review-and-invoke surface: it renders per-type reviews and calls the FRD-04 server actions directly, but moderation mutations remain owned by the store domain, keeping one lifecycle per action rather than a duplicate control set. The distinction preserved is caller versus owner, not router versus actor.
- The desktop presentation is a master-detail split (queue plus review pane) rather than full-width rows with an outbound link, so the wide-viewport space is used by the review itself; mobile keeps a list-then-detail navigation instead of forcing a side-by-side layout onto a narrow viewport.
- The route group and i18n structure are chosen so a subdomain move and content-language routing are additive later.

## Planned Extension Points

- A segmented multi-queue console with tabs, filters, and bulk actions.
- Content-language and country routing of queues (store `countryCode` already exists).
- Moderator assignment and, eventually, resource-scoped permissions.

## Risks and Constraints

- Reusing the public governance read model would leak reporter identity and raw text; the admin read must be a separate server-only path.
- Over-investing in queue sophistication for a single administrator is waste; the first release stays a single inbox, now with per-type review rather than a segmented multi-queue console.
- Localizing the console is a repo rule, not optional; the `admin` namespace must exist from the first slice.
- Invoking the FRD-04 server actions in place makes this blueprint dependent on those actions' signatures and audit-key contract; a breaking change on the FRD-04 side (PRD-02, [WO-09](../../../prd-02-collector-app/frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md) through [WO-12](../../../prd-02-collector-app/frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-12-product-type-request-approval.md)) requires a matching change here.

## ADR Need

No new ADR is required beyond the platform ADR recorded for FRD-01; this blueprint applies that decision. If the later subdomain move is taken, record it then.

## Implementation Plan

Execution order:

1. `WO-01` (vertical): admin route group, `requireAdmin()` gating, proxy prefix, localized shell, and the `admin` i18n namespace. Establishes the space and its access boundary.
2. `WO-02` (vertical): the moderation inbox, its server-only aggregate read model (feeding both the queue and the per-type review payloads), the master-detail presentation (desktop queue plus review pane with auto-preview, mobile stacked queue plus full-width detail), the five per-type review panels including the change-request drift variant, the shared removal-reason modal invocation, invoking the FRD-04 server actions from each review, and analytics.
3. `WO-03` (vertical): the audit log viewer over `AdminAuditLog`, with baseline pagination and analytics.

`WO-01` depends on PRD-03 (FRD-01) · `WO-01` for `requireAdmin()`. `WO-02` additionally depends on PRD-02, FRD-04 · [WO-09](../../../prd-02-collector-app/frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-09-store-approval-and-removal.md) through [WO-12](../../../prd-02-collector-app/frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-12-product-type-request-approval.md) for the server actions each review invokes. `WO-02` and `WO-03` depend on `WO-01` (the shell and gating) and can proceed in parallel after it. There is no foundation slice here: the only shared non-UI artifact (the aggregate read) is used by a single flow (the inbox), so it lives in `WO-02`.

## Linked Work Orders

- `work-orders/wo-01-admin-space-shell-and-gating.md`
- `work-orders/wo-02-moderation-inbox.md`
- `work-orders/wo-03-audit-log-viewer.md`

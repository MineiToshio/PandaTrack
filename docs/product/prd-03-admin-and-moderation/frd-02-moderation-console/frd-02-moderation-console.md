---
id: FRD-02
type: FRD
slug: moderation-console
title: Moderation Console
status: DRAFT
parent: PRD-03
children:
  - BP-01
last_updated: 2026-07-22
implementation_status: PLANNED
---

# FRD-02 Moderation Console

## Overview

This FRD defines the visible admin surface: a localized space at `/[locale]/admin`, gated by the administrator role, where the administrator sees everything pending moderation in one place and moves from there to act. The first release is deliberately a single moderation inbox plus an audit log viewer, not a segmented multi-queue console.

The console is a router, not a second home for moderation logic. The privileged actions themselves (approve a store, remove a store, resolve a report, apply a change request, approve a product type) live inline in the collector app and are owned by PRD-02 (FRD-04). The console aggregates what is pending, prioritizes it, and links the administrator to where those inline controls are. It consumes the role, `requireAdmin()`, and the audit log from [FRD-01](../frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md).

## Domain Goal

Give one administrator a short review loop: open the admin space, see what needs attention ordered by impact, act, and move on, with a clear accountability trail always one click away.

## Current State

### Implemented

- No admin route or space exists. Route protection is session-presence only (`src/proxy.ts`, `src/app/[locale]/(app)/layout.tsx`); no role awareness.
- Read-only governance aggregates exist and are surfaced in a community-transparency modal (`getStoreGovernanceSummary`, `StoreGovernanceSummaryModal`), but nothing aggregates pending work across stores for a moderator.

### Planned

- A localized admin space at `/[locale]/admin` gated by `requireAdmin()`.
- A moderation inbox aggregating pending stores, open reports, pending change requests, and pending product-type requests into one prioritized list that links to the inline controls.
- An audit log viewer reading `AdminAuditLog`.

## User Stories

### US-01 One place to moderate

As an administrator, I want a single space that shows everything pending, so that I do not have to hunt store by store to find what needs review.

### US-02 Impact-first triage

As an administrator, I want the most consequential items (reported and removable stores) surfaced before low-risk ones (product-type suggestions), so that harm is addressed first.

### US-03 Act where the content is

As an administrator, I want each pending item to take me to where I act on it, so that the inbox stays a fast router rather than a duplicate set of controls.

### US-04 Operate in my language

As an administrator or future moderator, I want the console in Spanish or English, so that the surface is usable as the team grows across languages.

### US-05 See the trail

As an administrator, I want to review the audit log, so that I can see who did what and when.

## Functional Requirements

### Admin space and shell

- `FR-02-01`: The system must serve a localized admin space at `/[locale]/admin`, gated by `requireAdmin()` in its layout.
- `FR-02-02`: The system must add the admin path to the proxy route prefixes for an optimistic redirect of non-administrators, while keeping `requireAdmin()` as the real boundary.
- `FR-02-03`: The admin space must be localized through a dedicated `admin` i18n namespace, with Spanish as the default and English available, and no hardcoded copy.
- `FR-02-04`: A non-administrator reaching the admin space must be refused (redirected or shown an access-denied state), never shown moderation data.

### Moderation inbox

- `FR-02-05`: The inbox must aggregate, into one list, the pending stores, open reports, pending change requests, and pending product-type requests.
- `FR-02-06`: The inbox must order items by impact, with reported and removable stores ahead of lower-risk items such as product-type suggestions.
- `FR-02-07`: Each inbox item must link to where the administrator acts on it (typically the store detail with its inline controls, owned by PRD-02, FRD-04).
- `FR-02-08`: The inbox must show a count per category so the administrator can see the shape of the backlog at a glance.
- `FR-02-09`: The inbox read must run on a server-only data path; any sensitive field (raw report text, reporter identity) must be read through a secure admin data layer, never through the public governance read model.
- `FR-02-10`: The inbox must present a clear empty state when nothing is pending.

### Audit log viewer

- `FR-02-11`: The system must provide an audit log viewer listing `AdminAuditLog` entries newest first, showing actor, action, target, UTC timestamp, and reason when present.
- `FR-02-12`: The audit log viewer must support baseline pagination or a simple recent-window view so it stays usable as entries accumulate.

### Analytics

- `FR-02-13`: The console must emit analytics for administrator navigation and for opening an inbox item, following the shared PostHog conventions.

## Business Rules

- `BR-02-01`: The admin space is localized like the rest of the product; user-facing copy lives in the `admin` i18n namespace, never hardcoded.
- `BR-02-02`: The inbox is a router to the inline controls owned by PRD-02 (FRD-04); it must not define a parallel set of moderation actions.
- `BR-02-03`: Sensitive moderation data is admin-only and must be read through a server-only path; the public governance read model must not be widened to serve it.
- `BR-02-04`: The route group and i18n structure must be chosen so a later move to a subdomain and a later content-language queue routing are additive changes, not rewrites.

## Acceptance Criteria

### `AC-02-01` Non-administrator cannot reach the admin space

- Given an authenticated user whose `role` is `user`
- When they navigate to `/{locale}/admin`
- Then `requireAdmin()` refuses access
- And they never see any moderation data

### `AC-02-02` Administrator sees the prioritized inbox

- Given an administrator with pending items across categories
- When they open `/{locale}/admin`
- Then the inbox lists the pending stores, open reports, pending change requests, and pending product-type requests
- And reported and removable stores appear ahead of product-type suggestions
- And each category shows a count

### `AC-02-03` Empty inbox

- Given an administrator with nothing pending
- When they open the inbox
- Then a clear empty state is shown

### `AC-02-04` Item routes to the inline controls

- Given a pending item in the inbox
- When the administrator opens it
- Then they are taken to where they act on it (for a store, its detail with the inline controls)

### `AC-02-05` Audit log viewer

- Given existing `AdminAuditLog` entries
- When the administrator opens the audit log viewer
- Then entries are listed newest first with actor, action, target, timestamp, and reason when present

### `AC-02-06` Localized console

- Given the admin space
- When it is opened under `/es/admin` and under `/en/admin`
- Then all copy renders from the `admin` namespace in the matching language, with no hardcoded strings

## Implementation Notes

- The admin space is embedded in the same app and deployment, under `[locale]` so the console is localized; a bare non-localized `/admin` is avoided because it would escape both the i18n routing and the proxy matcher (`src/proxy.ts` matches `/` and `/(es|en)/:path*`).
- The inbox aggregate should be a dedicated server-only read model (for example `src/lib/data/admin/moderationQueueQueries.ts`) composed from the existing per-store governance reads, not a widening of the public `getStoreGovernanceSummary`.
- The console gates in the admin layout with `requireAdmin()`; layout-level checks are acceptable here because the layout is the admin boundary, but every action reached from the inbox still authorizes on its own (those actions live in FRD-04).

## State Model

### Access state

- `authorized`: session resolves to `role` `admin`; the admin space renders.
- `refused`: no session or `role` `user`; optimistic redirect at the proxy, hard refusal at `requireAdmin()`.

### Inbox item state

- `pending`: the item is unresolved and appears in the inbox (store `PENDING`, report `OPEN`, change request `PENDING`, product-type request `PENDING`).
- `resolved`: once the underlying action (owned by FRD-04) reaches a terminal state, the item leaves the inbox on the next read.

## Screens and Data Contract

### Screens in this FDD

| #   | Screen           | Route                       | Prototype anchor |
| --- | ---------------- | --------------------------- | ---------------- |
| 1   | Moderation inbox | `/[locale]/admin`           | `#inbox`         |
| 2   | Audit log viewer | `/[locale]/admin/audit`     | `#audit`         |
| 3   | Access denied    | `/[locale]/admin` (refused) | `#access-denied` |

Design detail for these screens lives in the FDD: [fdd-02-moderation-console.md](fdd-02-moderation-console.md).

## Cross-domain notes

- The console consumes the role, `requireAdmin()`, and `AdminAuditLog` from PRD-03 (FRD-01) · [BP-01](../frd-01-admin-identity-and-access/bp-01-admin-identity-and-access-platform/bp-01-admin-identity-and-access-platform.md).
- Every inbox item routes to an action owned by PRD-02 (FRD-04): store approval and removal, report resolution, change-request review, and product-type approval. The inbox links to those inline controls; it does not implement them.

## Confirmed

- The admin space is embedded and localized under `/[locale]/admin`, gated by `requireAdmin()`.
- The first release is a single prioritized inbox plus an audit viewer, not a segmented multi-queue console.
- The inbox is a router to the inline controls owned by FRD-04.

## Open Questions

- Whether the first release routes every item to inline controls, or lets a small subset (for example approving a product-type request) be actioned directly from the inbox.
- The exact impact-ordering weights across the four categories.

## Out of Scope

- The full segmented console with per-queue tabs, filters, bulk actions, and enriched detail (a later release).
- Moderator assignment, SLA timers, and content-language queue routing (data shapes are prepared in FRD-01 and the store domain; the surface is not built).
- The privileged store transitions and inline controls themselves (PRD-02, FRD-04).
- Serving the console from a subdomain.

## Linked Blueprints

- `docs/product/prd-03-admin-and-moderation/frd-02-moderation-console/bp-01-moderation-console/bp-01-moderation-console.md`

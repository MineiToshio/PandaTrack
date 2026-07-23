---
id: FRD-02
type: FRD
slug: moderation-console
title: Moderation Console
status: DRAFT
parent: PRD-03
children:
  - BP-01
last_updated: 2026-07-23
implementation_status: PLANNED
---

# FRD-02 Moderation Console

## Overview

This FRD defines the visible admin surface: a localized space at `/[locale]/admin`, gated by the administrator role, where the administrator sees everything pending moderation in one place and moves from there to act. The first release is deliberately a single moderation inbox plus an audit log viewer, not a segmented multi-queue console.

The console reviews in place, not a second home for moderation logic. The privileged actions themselves (approve a store, remove a store, resolve a report, apply a change request, approve a product type) are owned by PRD-02 ([FRD-04](../../prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md)); the console invokes those same server actions from a per-type review it renders inside itself, it does not fork the store lifecycle or re-implement them. The console aggregates what is pending, prioritizes it, and lets the administrator open each item's review and act on it without leaving the console. It consumes the role, `requireAdmin()`, and the audit log from [FRD-01](../frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md).

## Domain Goal

Give one administrator a short review loop: open the admin space, see what needs attention ordered by impact, act, and move on, with a clear accountability trail always one click away.

## Current State

### Implemented

- No admin route or space exists. Route protection is session-presence only (`src/proxy.ts`, `src/app/[locale]/(app)/layout.tsx`); no role awareness.
- Read-only governance aggregates exist and are surfaced in a community-transparency modal (`getStoreGovernanceSummary`, `StoreGovernanceSummaryModal`), but nothing aggregates pending work across stores for a moderator.

### Planned

- A localized admin space at `/[locale]/admin` gated by `requireAdmin()`.
- A moderation inbox aggregating pending stores, open reports, pending change requests, and pending product-type requests into one prioritized list, each item opening a per-type review in the console.
- An audit log viewer reading `AdminAuditLog`.

## User Stories

### US-01 One place to moderate

As an administrator, I want a single space that shows everything pending, so that I do not have to hunt store by store to find what needs review.

### US-02 Impact-first triage

As an administrator, I want the most consequential items (reported and removable stores) surfaced before low-risk ones (product-type suggestions), so that harm is addressed first.

### US-03 Review without leaving the queue

As an administrator, I want each pending item to open its own review right inside the console, so that I can decide without losing my place in the queue or hunting for a duplicate set of controls.

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

- `FR-02-05`: The inbox must aggregate, into one list, the pending stores, open reports, pending change requests, and pending product-type requests. The queue derives a flag-candidate row when a store accumulates 2 or more open reports, collapsing that store's individual report rows into the single derived row.
- `FR-02-06`: The inbox must order items by impact, with reported and removable stores ahead of lower-risk items such as product-type suggestions.
- `FR-02-07`: Each inbox item must open a per-type review in the console from which the administrator invokes the owning action (the PRD-02, FRD-04 server action for that item type); a secondary "Ver tienda" link to the store detail remains available from the review.
- `FR-02-08`: The inbox must show a count per category so the administrator can see the shape of the backlog at a glance.
- `FR-02-09`: The inbox read must run on a server-only data path; any sensitive field (raw report text, reporter identity) must be read through a secure admin data layer, never through the public governance read model, consistent with the reporter-identity and raw-text admin-only boundary owned by PRD-02, [FRD-04](../../prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md) (`FR-04-45`).
- `FR-02-10`: The inbox must present a clear empty state when nothing is pending.

### Audit log viewer

- `FR-02-11`: The system must provide an audit log viewer listing `AdminAuditLog` entries newest first, showing actor, action, target, UTC timestamp, and reason when present.
- `FR-02-12`: The audit log viewer must support baseline pagination or a simple recent-window view so it stays usable as entries accumulate.

### Analytics

- `FR-02-13`: The console must emit analytics for administrator navigation and for opening an inbox item, following the shared PostHog conventions.

### Per-type review

These reviews invoke the moderation actions owned by PRD-02, [FRD-04](../../prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md) (`FR-04-40` through `FR-04-51`); the console is their caller, not their owner.

- `FR-02-14`: Opening a pending-store item must render a review showing the store's submitted summary (seller type, country, presence, categories, contact channels, import countries), with actions to approve (`FR-04-40`) or remove (`FR-04-41`) the store.
- `FR-02-15`: Opening a report item must render a review showing the report reason, free text, admin-only reporter identity, and prior reports on the same store, with actions to resolve or dismiss the report (`FR-04-44`) and a secondary path to remove the store (`FR-04-41`).
- `FR-02-16`: Opening a flag-candidate (suggested-removal) item (a row derived per the `FR-02-05` rule, not a persisted category) must render a review showing the store's accumulated reports, with actions to flag or unflag the store (`FR-04-43`) and a secondary path to remove it (`FR-04-41`).
- `FR-02-17`: Opening a change-request item must render a review showing the field-by-field diff and the requester's comment, with actions to apply (`FR-04-46`) or reject the request; when the underlying store changed since submission, the review must show a drift notice and tag each affected field, matching the FRD-04 drift handling (`FR-04-47`). For list fields the review must itemize the diff as add, remove, and keep deltas, because the stored request replaces the whole list with the proposed set.
- `FR-02-18`: Opening a product-type-suggestion item must render a review showing the requester, the reason, and a catalog preview (`es`/`en` names and the generated key), with actions to approve (`FR-04-49`) or reject the request.
- `FR-02-19`: On viewports wide enough for the master-detail split, the inbox must present the queue and the selected item's review side by side, ordered by impact, and must auto-preview the top item when no item is explicitly selected.
- `FR-02-20`: Below the master-detail breakpoint, the inbox must show the queue as a single stacked column; opening an item must route to a full-width review screen with a back link to the queue.
- `FR-02-21`: Removing a store from any review (pending store, report, or suggested removal) must go through the reason-selection removal modal owned by PRD-02, FRD-04 (`FR-04-41`), not a console-local confirmation.

### Admin navigation entry point

- `FR-02-22`: The admin navigation entry point in the collector app shell (the links to `/[locale]/admin`) must render only for users whose `role` is `admin`; for any non-administrator it must not appear in the menu at all. This conditional rendering is a UX affordance, not a security boundary: it does not replace `requireAdmin()` (`FR-02-01`), which stays the actual authorization check regardless of nav visibility. The entry point itself is owned and rendered by the app shell, PRD-02, [FRD-03](../../prd-02-collector-app/frd-03-collector-app-shell/frd-03-collector-app-shell.md), which must consume the signed-in user's role to decide whether to render it.

## Business Rules

- `BR-02-01`: The admin space is localized like the rest of the product; user-facing copy lives in the `admin` i18n namespace, never hardcoded.
- `BR-02-02`: The console invokes the moderation actions owned by PRD-02, [FRD-04](../../prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md) in place, from a per-type review rendered inside the console; it must not fork the store lifecycle or re-implement those actions. The distinction the console preserves is caller versus owner, not router versus actor.
- `BR-02-03`: Sensitive moderation data is admin-only and must be read through a server-only path; the public governance read model must not be widened to serve it. This mirrors the reporter-identity and raw-text boundary owned by PRD-02, FRD-04 (`FR-04-45`).
- `BR-02-04`: The route group and i18n structure must be chosen so a later move to a subdomain and a later content-language queue routing are additive changes, not rewrites.
- `BR-02-05`: Hiding the admin navigation entry for non-administrators is presentation only; it is never the security mechanism. Every admin route and every action it invokes still authorizes server-side (`requireAdmin()` at the admin layout, plus each FRD-04 server action's own check), so a hidden control must never be treated as sufficient access control on its own.

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
- And a store with 2 or more open reports appears as one suggested-removal row, not as its individual report rows

### `AC-02-03` Empty inbox

- Given an administrator with nothing pending
- When they open the inbox
- Then a clear empty state is shown

### `AC-02-04` Item opens its per-type review

- Given a pending item in the inbox
- When the administrator opens it
- Then a per-type review renders inside the console with the actions for that item type
- And a secondary "Ver tienda" link is available to the store detail

### `AC-02-05` Audit log viewer

- Given existing `AdminAuditLog` entries
- When the administrator opens the audit log viewer
- Then entries are listed newest first with actor, action, target, timestamp, and reason when present

### `AC-02-06` Localized console

- Given the admin space
- When it is opened under `/es/admin` and under `/en/admin`
- Then all copy renders from the `admin` namespace in the matching language, with no hardcoded strings

### `AC-02-07` Open review: pending store

- Given a pending-store item in the inbox
- When the administrator opens it
- Then the review shows the store's submitted summary
- And Approve and Remove actions are available, invoking the FRD-04 store actions (`FR-04-40`, `FR-04-41`)

### `AC-02-08` Open review: report

- Given an open-report item in the inbox
- When the administrator opens it
- Then the review shows the report reason, quote, and admin-only reporter identity, plus prior reports on the store
- And Resolve and Dismiss actions are available, invoking `FR-04-44`

### `AC-02-09` Open review: flag candidate / suggested removal

- Given a store with 2 or more open reports (a flag-candidate row derived per `FR-02-05`)
- When the administrator opens its item
- Then the review lists the accumulated reports
- And Flag/Unflag and Remove actions are available, invoking `FR-04-43` and `FR-04-41`

### `AC-02-10` Open review: change request

- Given a pending change-request item
- When the administrator opens it
- Then the review shows the field-by-field diff and the requester comment
- And list fields show per-item add, remove, and keep deltas, since the stored request replaces the whole list with the proposed set
- And Apply and Reject actions are available, invoking `FR-04-46`

### `AC-02-11` Open review: product-type suggestion

- Given a pending product-type-request item
- When the administrator opens it
- Then the review shows the requester, the reason, and the catalog preview
- And Approve and Reject actions are available, invoking `FR-04-49`

### `AC-02-12` Change request with drift

- Given a change request whose store changed after submission
- When the administrator opens its review
- Then a drift notice is shown, and each affected field presents three values (the value when it was proposed, the current value, and the proposed value) tagged "Ya aplicado" when the current value already equals the proposal or "En conflicto" when the current value changed and differs from it
- And list fields show per-item deltas ("Se agrega", "Se elimina", "Se mantiene"), since applying replaces the list with the proposed set
- And approving re-derives the diff against the current store state, applying only the changes that still have effect (`FR-04-47`)

### `AC-02-13` Desktop master-detail selection

- Given the inbox open on a desktop viewport
- When the administrator selects a queue row
- Then that item's review renders in the detail pane without navigating away from the queue
- And the top item is auto-previewed when nothing is explicitly selected

### `AC-02-14` Mobile stacked queue

- Given the inbox open on a mobile viewport
- When the administrator opens a queue row
- Then the app routes to a full-width review screen
- And a back link returns to the queue

### `AC-02-15` Admin nav entry shown only to administrators

- Given a signed-in user whose `role` is `user`
- When the app shell renders its navigation
- Then no admin navigation entry appears in the menu
- Given a signed-in user whose `role` is `admin`
- When the app shell renders its navigation
- Then the admin navigation entry appears and leads to `/[locale]/admin`

### `AC-02-16` Direct admin navigation still requires `requireAdmin()`

- Given a non-administrator who navigates directly to `/[locale]/admin`
- When the request reaches the admin layout
- Then `requireAdmin()` refuses access regardless of whether the nav entry was ever shown to that user
- This ties to `FR-02-01` and `AC-02-01`: nav visibility and server-side authorization are separate mechanisms and both must hold

## Implementation Notes

- The admin space is embedded in the same app and deployment, under `[locale]` so the console is localized; a bare non-localized `/admin` is avoided because it would escape both the i18n routing and the proxy matcher (`src/proxy.ts` matches `/` and `/(es|en)/:path*`).
- The admin space nests inside the collector app route group (`src/app/[locale]/(app)/admin/`) so it inherits the App Shell chrome and session context instead of re-rendering them; the group name is invisible in the URL, which stays `/[locale]/admin`.
- The inbox aggregate should be a dedicated server-only read model (for example `src/lib/data/admin/moderationQueueQueries.ts`) composed from the existing per-store governance reads, not a widening of the public `getStoreGovernanceSummary`; the same aggregate also feeds the per-type review payloads (`FR-02-14` through `FR-02-18`), so the queue row and its review read from one source.
- The console gates in the admin layout with `requireAdmin()`; layout-level checks are acceptable here because the layout is the admin boundary, but every action reached from the inbox still authorizes on its own (those actions live in FRD-04).

## State Model

### Access state

- `authorized`: session resolves to `role` `admin`; the admin space renders.
- `refused`: no session or `role` `user`; optimistic redirect at the proxy, hard refusal at `requireAdmin()`.

### Inbox item state

- `pending`: the item is unresolved and appears in the inbox. Four row types read directly off a persisted state: pending store `PENDING`, report `OPEN`, change request `PENDING`, product-type request `PENDING`. The fifth row type, flag candidate (suggested removal), is not a persisted state: it is derived when a store, `PENDING` or `APPROVED`, has 2 or more open reports, and it replaces that store's individual report rows in the queue for as long as the count holds.
- `resolved`: once the underlying action (owned by FRD-04) reaches a terminal state, the item leaves the inbox on the next read. A derived flag-candidate row leaves the inbox once the store is flagged into a terminal outcome, removed, or its open-report count drops below 2, at which point any remaining open report goes back to showing as its own row.

## Screens and Data Contract

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

Screens 2 to 7 are the per-type review views (`FR-02-14` through `FR-02-18`), rendered inside the master-detail pane on desktop and as a full-width screen on mobile (`FR-02-19`, `FR-02-20`). Design detail for these screens lives in the FDD: [fdd-02-moderation-console.md](fdd-02-moderation-console.md).

## Cross-domain notes

- The console consumes the role, `requireAdmin()`, and `AdminAuditLog` from PRD-03 (FRD-01) · [BP-01](../frd-01-admin-identity-and-access/bp-01-admin-identity-and-access-platform/bp-01-admin-identity-and-access-platform.md).
- Every inbox item opens a per-type review that invokes an action owned by PRD-02, [FRD-04](../../prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md): store approval and removal, report resolution, change-request review, and product-type approval. The console invokes those actions in place; it does not implement them.
- The app shell (PRD-02, [FRD-03](../../prd-02-collector-app/frd-03-collector-app-shell/frd-03-collector-app-shell.md)) renders the primary navigation and must gate the admin entry point (`FR-02-22`) by the signed-in user's role, consuming the `requireAdmin()`/role data owned by PRD-03 (FRD-01).

## Confirmed

- The admin space is embedded and localized under `/[locale]/admin`, gated by `requireAdmin()`.
- The first release is a single prioritized inbox plus an audit viewer, not a segmented multi-queue console.
- The console reviews in place: opening an item renders a per-type review inside the console (desktop master-detail pane, mobile full-width detail) from which the administrator invokes the PRD-02, FRD-04 server action for that item; the console is the caller, not the owner, of those actions. Confirmed 2026-07-23.

## Open Questions

- The exact impact-ordering weights across the four categories.

## Out of Scope

- The full segmented console with per-queue tabs, filters, and bulk actions (a later release).
- Moderator assignment, SLA timers, and content-language queue routing (data shapes are prepared in FRD-01 and the store domain; the surface is not built).
- The privileged store transitions and the server actions themselves (PRD-02, FRD-04); the console invokes them, it does not implement them.
- Serving the console from a subdomain.

## Linked Blueprints

- `docs/product/prd-03-admin-and-moderation/frd-02-moderation-console/bp-01-moderation-console/bp-01-moderation-console.md`

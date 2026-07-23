---
id: WO-01
type: WORK_ORDER
slug: admin-space-shell-and-gating
title: Admin Space Shell and Gating
status: DRAFT
parent: BP-01
source_issue: 128
implementation_status: PLANNED
last_updated: 2026-07-23
---

# WO-01 Admin Space Shell and Gating

## Summary

Vertical slice that stands up the admin space: a localized route group at `/[locale]/admin` gated by `requireAdmin()`, with the proxy prefix, the admin shell chrome, an access-denied state, and the `admin` i18n namespace. This is the access boundary and frame that the inbox and audit viewer render inside.

## In Scope

- New route group `src/app/[locale]/(admin)/` with its `layout.tsx` gating on `requireAdmin()`.
- Add the admin path prefix to `src/proxy.ts` for an optimistic redirect of non-administrators.
- Admin shell chrome (header, navigation between inbox and audit, locale handling) and an access-denied state.
- New `admin` i18n namespace under `src/i18n/locales/{es,en}/admin.json`, Spanish default, English available.
- Role-conditional admin navigation entry point in the collector app shell (PRD-02, FRD-03): the links to the admin space render only for users whose role is `admin`, per `FR-02-22`.
- Analytics for entering the admin space.
- E2E covering gated access in both languages.
- E2E covering nav visibility by role: a non-admin sees no admin navigation entry; an admin sees it and it leads to `/[locale]/admin`.

## Out of Scope

- The inbox aggregate and listing (`WO-02`) and the audit viewer (`WO-03`).
- Any moderation mutation (PRD-02, FRD-04).
- The `requireAdmin()` helper itself (delivered in PRD-03, FRD-01, `WO-01`).

## Requirements

- `FR-02-01`: Serve a localized admin space at `/[locale]/admin`, gated by `requireAdmin()`.
- `FR-02-02`: Add the admin path to the proxy prefixes for an optimistic redirect, keeping `requireAdmin()` as the real boundary.
- `FR-02-03`: Localize the space through an `admin` namespace, Spanish default, English available, no hardcoded copy.
- `FR-02-04`: Refuse non-administrators without showing moderation data.
- `FR-02-22`: The admin navigation entry point renders only for users whose `role` is `admin`; for a non-administrator it must not appear in the menu.

Relevant business rules:

- `BR-02-01`: All admin copy lives in the `admin` namespace.
- `BR-02-04`: Route group and i18n structure chosen so subdomain and content-language routing are additive later.
- `BR-02-05`: Hiding the admin nav entry is presentation only; `requireAdmin()` remains the actual security boundary.

Relevant acceptance criteria:

- `AC-02-01` Non-administrator cannot reach the admin space.
- `AC-02-06` Localized console.
- `AC-02-15` Admin nav entry shown only to administrators.
- `AC-02-16` Direct admin navigation still requires `requireAdmin()`.

## Blueprints

- `BP-01` runtime component coverage: routing and gating layer, localization layer, console UI layer (shell chrome and access-denied). Depends on PRD-03 (FRD-01) · `WO-01`.

## E2E Acceptance Tests

- A `user`-role account navigating to `/{locale}/admin` is redirected or shown access-denied and sees no moderation data (`AC-02-01`).
- An `admin`-role account reaches the admin shell.
- The shell renders from the `admin` namespace under both `/es/admin` and `/en/admin` (`AC-02-06`).
- A `user`-role account sees no admin navigation entry in the app shell menu; an `admin`-role account sees it and it leads to `/{locale}/admin` (`AC-02-15`).
- A `user`-role account who navigates directly to `/{locale}/admin` is still refused regardless of nav visibility (`AC-02-16`).

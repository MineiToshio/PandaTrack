---
id: WO-01
type: WORK_ORDER
slug: role-admin-plugin-and-audit-foundation
title: Role, Admin Plugin, and Audit Foundation
status: DRAFT
parent: BP-01
source_issue: 126
implementation_status: PLANNED
last_updated: 2026-07-22
---

# WO-01 Role, Admin Plugin, and Audit Foundation

## Summary

Foundation slice for the admin platform. Adds the database-backed administrator role through the `better-auth` admin plugin, introduces the append-only `AdminAuditLog` model, and ships the two server helpers (`requireAdmin()`, `writeAuditEntry()`) that every downstream privileged slice depends on. Ships no UI and does not change who is an administrator yet; the cutover happens in `WO-02`.

## In Scope

- Enable the `better-auth` admin plugin in `src/lib/auth/auth.ts` with explicit `adminRoles` and a default role of `user`.
- Prisma schema: add `role`, `banned`, `banReason`, `banExpires` to `User` and `impersonatedBy` to `Session`; add the `AdminAuditLog` model; write and apply the migration; run `prisma generate`.
- `requireAdmin()` server helper built on `getSession()`, refusing non-administrators before any work runs.
- `writeAuditEntry({ actorId, action, targetType, targetId, reason? })` append-only writer plus read helpers for later use.
- The shared audit action-key vocabulary (`store.approve`, `store.remove`, `report.resolve`, `report.dismiss`, `changeRequest.apply`, `changeRequest.reject`, `productType.approve`, `productType.reject`).
- Unit tests for `requireAdmin()` and `writeAuditEntry()`.

## Out of Scope

- Changing `getIsAdmin()` to read the role, bootstrapping the first admin, and retiring `ADMIN_EMAILS` (that is `WO-02`).
- Any admin-facing UI or route group (FRD-02).
- Any privileged store transition or inline control (PRD-02, FRD-04).
- Ban and impersonation surfaces.

## Requirements

- `FR-01-01`: Store a moderation `role` on `User`, values `admin` and `user`, defaulting to `user`.
- `FR-01-02`: Enable the `better-auth` admin plugin so `role` and its forward-compatible fields exist.
- `FR-01-03`: New users default to `role` `user`, with no self-elevation path.
- `FR-01-04`: Provide a server-side `requireAdmin()` helper.
- `FR-01-06`: Configure `adminRoles` explicitly and keep the default role at `user`.
- `FR-01-10`: Add an append-only `AdminAuditLog` (actor, action, target type and id, UTC timestamp, optional reason).
- `FR-01-11`: Provide `writeAuditEntry()`.
- `FR-01-12`: Audit entries reference records by id and store no sensitive content.

Relevant business rules:

- `BR-01-02`: `AdminAuditLog` is append-only; no update or delete path.
- `BR-01-04`: The audit log never stores reporter PII or report free text.
- `BR-01-05`: The action-key vocabulary is shared and stable once defined.

## Blueprints

- `BP-01` runtime component coverage: auth configuration layer (admin plugin), data model layer (`role`, plugin fields, `AdminAuditLog`, migration), authorization helper layer (`requireAdmin()`), audit layer (`writeAuditEntry()` and read helpers), verification layer (unit tests).

## E2E Acceptance Tests

This is the foundation slice; by design it ships no UI, so it is exempt from the standalone E2E path and is validated with unit and integration tests instead:

- `requireAdmin()` allows an `admin` user and refuses a `user` before any work runs (`AC-01-01`, `AC-01-02`).
- A newly created account has `role` `user` (`AC-01-06`).
- `writeAuditEntry()` creates a row with actor, action, target type and id, and a UTC timestamp, and stores no report free text or reporter identity (`AC-01-04`).
- The data layer exposes no update or delete path for `AdminAuditLog` (`AC-01-05`).

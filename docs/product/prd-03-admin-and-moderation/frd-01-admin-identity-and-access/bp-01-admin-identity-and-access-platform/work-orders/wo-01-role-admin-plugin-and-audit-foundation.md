---
id: WO-01
type: WORK_ORDER
slug: role-admin-plugin-and-audit-foundation
title: Role, Admin Plugin, and Audit Foundation
status: ACTIVE
parent: BP-01
source_issue: 126
implementation_status: PLANNED
last_updated: 2026-07-23
---

# WO-01 Role, Admin Plugin, and Audit Foundation

## Summary

Foundation slice for the admin platform. Adds the database-backed administrator role through the `better-auth` admin plugin, introduces the append-only `AdminAuditLog` model, and ships the two server helpers (`requireAdmin()`, `writeAuditEntry()`) that every downstream privileged slice depends on. Ships no UI and does not change who is an administrator yet; the cutover happens in `WO-02`.

## In Scope

- Enable the `better-auth` admin plugin in `src/lib/auth/auth.ts` as `admin({ adminRoles: ["admin"], defaultRole: "user" })`, keeping both values explicit.
- Prisma schema: add `role` (`String @default("user")`, non-nullable), `banned`, `banReason`, `banExpires` to `User` and `impersonatedBy` to `Session`; add the `AdminAuditLog` model with a real foreign key to `User`; write and apply the migration with the standard `migrate dev` flow; run `prisma generate`.
- `requireAdmin()` server helper co-located in `src/lib/auth/auth-server.ts`, built on `getSession()`; it throws a typed error for non-administrators before any work runs and returns the session/user when the check passes.
- `writeAuditEntry({ actorId, action, targetType, targetId, reason? }, tx?)` append-only writer that accepts an optional Prisma transaction client, plus read helpers for later use.
- The shared audit action-key vocabulary (`store.approve`, `store.remove`, `store.flag`, `store.unflag`, `report.resolve`, `report.dismiss`, `changeRequest.apply`, `changeRequest.reject`, `productType.approve`, `productType.reject`).
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

## Assumptions

These follow established repository conventions and are applied without re-deciding them:

- The audit data module lives at `src/lib/data/admin/adminAuditMutations.ts` and `src/lib/data/admin/adminAuditQueries.ts`, importing the singleton Prisma client, per `.agents/rules/project-structure.mdc` (ADR 0015) and `.agents/rules/prisma-data-layer.mdc`.
- No Prisma access happens in components; all access stays in the data module (`AGENTS.md` section 4, `.agents/rules/prisma-data-layer.mdc`).
- The migration uses the standard `migrate dev` flow with the four-step definition of done (SQL applied, `prisma generate`, `type-check` passing), per `.agents/rules/prisma-migration-workflow.mdc`. The added fields are additive columns with defaults plus one new table, so the hand-written-SQL fallback is not needed.
- A `requireAdmin()` refusal is an expected error and is not reported to Sentry; only unexpected errors are captured (`.agents/rules/error-handling-validation.mdc`, `.agents/rules/sentry-error-handling.mdc`).
- Unit tests live under `src/lib/auth/_tests/` and `src/lib/data/admin/_tests/`, matching the existing `src/lib/auth/_tests/` layout, with scope per `.agents/rules/testing-strategy.mdc` and `.agents/rules/validation-checklist.mdc`. This slice ships no UI, so it is exempt from E2E.
- The admin plugin ships inside `better-auth` (`better-auth/plugins`, already installed at `^1.6.23`); no new dependency is added.
- This slice does not touch `.env.example`; the `ADMIN_EMAILS` retirement belongs to WO-02.

## Technical Notes

### `role` field

- `role` is `String @default("user")` and non-nullable on `User`, so every account resolves to a concrete role and `AC-01-06` holds without app-layer coalescing.
- `requireAdmin()` grants access by testing membership of `admin` in the stored role value rather than strict equality, to stay forward-compatible with the plugin's comma-separated multi-role format.
- A Prisma enum is intentionally not used: the plugin's `set-role` endpoint writes role strings, which an enum column would reject.

### `AdminAuditLog` model

- Fields: `id`, `actorId` (foreign key to `User`), `action String`, `targetType String`, `targetId String`, `reason String?`, `createdAt DateTime @default(now())`.
- `actorId` is a real relation to `User` (referential integrity; the actor is always an existing account). This adds an inverse relation on `User`.
- Indexes: `@@index([actorId])`, `@@index([targetType, targetId])`, `@@index([createdAt])`, matching how the later audit viewer (FRD-02 · WO-03) filters by actor, by target, and orders by time.
- `action` and `targetType` are stored as strings validated against constant vocabularies in code, not database enums, so the vocabulary can stay stable (`BR-01-05`) without a migration per new key.
- The module exposes create plus read helpers only; there is no update or delete path (`BR-01-02`, `AC-01-05`).

### `writeAuditEntry()` contract

- Signature: `writeAuditEntry({ actorId, action, targetType, targetId, reason? }, tx?)`, resolving the client as `tx ?? prisma`.
- Passing a transaction client lets a downstream privileged mutation wrap the action and its audit write in a single `prisma.$transaction`, so no orphaned or missing audit rows are possible (`FR-01-11`).

### `requireAdmin()` contract

- `requireAdmin()` resolves the session through `getSession()`, verifies the database role, throws a typed error for non-administrators before any work runs, and returns the resolved session/user when the check passes.
- The proxy/middleware layer stays an optimistic redirect only and is never the authorization boundary (`FR-01-05`, ADR 0017).
- The helper is inert in this slice: no account has `role` `admin` until the WO-02 bootstrap, and no privileged caller exists yet, so it is exercised only by unit tests with mocked roles here.

### Plugin configuration

- Enabled as `admin({ adminRoles: ["admin"], defaultRole: "user" })`, both values explicit (`FR-01-06`).

## Security Notes

- Enabling the admin plugin registers the privileged `/api/auth/admin/*` endpoints (for example `set-role`, `ban`, `impersonate`, `set-password`, `list-users`). These are account-takeover grade by construction and are gated by the plugin to `adminRoles`.
- Because no account has `role` `admin` until the WO-02 bootstrap, this surface is inert in this slice; it becomes reachable only after WO-02 grants the first administrator.
- Individual plugin endpoints are not disabled (the plugin does not support that cleanly); the explicit `adminRoles` and `defaultRole` plus the absence of any admin account are the controls for this release.
- Audit entries reference records by type and id and never copy report free text or reporter identity (`FR-01-12`, `BR-01-04`).

## Observability Notes

- `requireAdmin()` refusals are expected authorization outcomes and must not be captured by Sentry; only unexpected failures are reported.

## Dependencies

- `requireAdmin()` and `writeAuditEntry()` are consumed by every privileged slice in FRD-02 (moderation console) and by the inline moderation controls in [FRD-04 · Store Domain](../../../../prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md) (PRD-02). The `store.flag` and `store.unflag` action keys anticipate that consumer.
- WO-02 depends on this slice for the role machinery it cuts `getIsAdmin()` over to.

---
id: BP-01
type: BLUEPRINT
slug: admin-identity-and-access-platform
title: Admin Identity and Access Platform
status: DRAFT
parent: FRD-01
children:
  - WO-01
  - WO-02
last_updated: 2026-07-23
implementation_status: PLANNED
---

# BP-01 Admin Identity and Access Platform

## Overview

This blueprint describes how to build the platform defined in [FRD-01](../frd-01-admin-identity-and-access.md): a database-backed administrator role, its server-side enforcement, a safe transition off the environment allowlist, and an append-only audit trail. It ships schema, auth configuration, and server helpers; it ships no UI. The visible admin surface consumes this platform from PRD-03 (FRD-02), and the collector app's inline moderation controls consume it from PRD-02 (FRD-04).

## Blueprint Goals

- Introduce a durable `role` on `User` through the `better-auth` admin plugin.
- Provide `requireAdmin()` as the single server-side authorization gate for every privileged action.
- Cut over from `ADMIN_EMAILS` to the database role without an owner lockout.
- Provide `AdminAuditLog` plus `writeAuditEntry()` as the shared accountability primitive.

## Requirement Coverage

- Role and identity: `FR-01-01`, `FR-01-02`, `FR-01-03`.
- Server authorization: `FR-01-04`, `FR-01-05`, `FR-01-06`.
- Bootstrap and migration: `FR-01-07`, `FR-01-08`, `FR-01-09`.
- Audit trail: `FR-01-10`, `FR-01-11`, `FR-01-12`.
- Business rules: `BR-01-01` through `BR-01-05`.

## Runtime Components

### 1. Auth configuration layer

- Primary source(s): `src/lib/auth/auth.ts`, `src/lib/auth/auth-server.ts`.
- Current responsibilities: configure `better-auth` with the Prisma adapter and `nextCookies()`; resolve the session server-side; compute admin identity from `ADMIN_EMAILS`.
- Role: add the admin plugin with explicit `adminRoles` and a default role of `user`; after cutover, rewrite `getIsAdmin()` to read the database `role`.

### 2. Data model layer

- Primary source(s): `prisma/schema.prisma`, `generated/prisma/client`.
- Current responsibilities: `User` and `Session` models with no role concept.
- Role: add `role` (and the plugin's `banned`, `banReason`, `banExpires` on `User`; `impersonatedBy` on `Session`); add the `AdminAuditLog` model; own the migration.

### 3. Authorization helper layer

- Primary source(s): `requireAdmin()` co-located in `src/lib/auth/auth-server.ts`, built on `getSession()`.
- Current responsibilities: none; authorization today is a boolean read inside individual store actions.
- Role: expose `requireAdmin()` that resolves the session, verifies the role, throws a typed error for non-administrators before any work runs, and returns the resolved session/user when the check passes; become the mandatory gate cited by every privileged action across FRD-02 and FRD-04. Redirects belong to the route/page layer, not to this helper.

### 4. Audit layer

- Primary source(s): new module `src/lib/data/admin/adminAuditMutations.ts` and `adminAuditQueries.ts`.
- Current responsibilities: none.
- Role: expose `writeAuditEntry({ actorId, action, targetType, targetId, reason? }, tx?)` writing an append-only row, where the optional Prisma transaction client lets a caller make the audit write atomic with its mutation; expose read queries consumed by the audit viewer (FRD-02, WO-03). No update or delete path.

### 5. Verification layer

- Primary source(s): unit and integration tests under `src/lib/auth/_tests/` and `src/lib/data/admin/_tests/`.
- Current responsibilities: none for admin identity.
- Role: unit-test `requireAdmin()` and `writeAuditEntry()`; integration-test the cutover so an `admin` role is honored and the retired allowlist is no longer authoritative.

## Current System Contracts

### Role contract

- `role` defaults to `user` for every account; only an administrator can change a role, through the plugin's server-gated endpoint.
- `requireAdmin()` is the only sanctioned way to authorize privileged work; it reads the database role, never the client.

### Bootstrap contract

- The bootstrap is a committed, idempotent maintenance script (`scripts/bootstrap-admin.ts`, run via `npx tsx`) rather than a Prisma migration, because the target account differs per environment and a migration keyed to a fixed id or email would be brittle across dev, preview/staging, and prod. It follows the existing idempotent data-script pattern (`scripts/backfill-store-search-name.ts`, `scripts/seed-dev-data.ts`).
- The bootstrap identifies the owner by a supplied email and resolves it to the account's `user id` inside the script, then writes the role by id; running it twice is a no-op. The email is the stable per-environment key; the resolved id differs per environment.
- `ADMIN_EMAILS` is removed from configuration and `.env.example` only after the bootstrap is verified in the target environment. The per-environment cutover order is bootstrap, then verify, then deploy the `getIsAdmin()` flip and the allowlist removal, so the owner is never locked out.
- The two existing admin behaviors (store auto-approval, direct edit) switch from the env read to the role read with no behavioral change; `getIsAdmin()` is rewritten to read `session.user.role` via `roleGrantsAdmin()` and keeps its non-throwing boolean signature so its call sites, including the UI/visibility reads, stay unchanged.
- The bootstrap writes no audit entry. It is an operator-run provisioning step with no in-app actor, so it is a documented exception to the audit-write contract; a `role.grant` action key with a `user` target type is deferred until the in-app grant path ships in FRD-02.

### Audit-write contract

- Every privileged mutation calls `writeAuditEntry()` with a stable action key from the shared vocabulary (`store.approve`, `store.remove`, `store.flag`, `store.unflag`, `report.resolve`, `report.dismiss`, `changeRequest.apply`, `changeRequest.reject`, `productType.approve`, `productType.reject`).
- `action` and `targetType` are stored as strings validated against constant vocabularies in code, not database enums, so the vocabulary can stay stable without a migration per new key.
- The entry stores identifiers plus an optional non-sensitive reason; it never stores report free text or reporter identity.

## Architectural Decisions Already Visible

- Adopt the `better-auth` admin plugin rather than a hand-rolled role column: same effort on the current stack, and the plugin's field shape (`role`, `banned`, `impersonatedBy`) is the forward-compatible migration path to resource-scoped permissions later.
- Layered authorization: server-enforced `requireAdmin()` at every action and data fetch; the proxy performs optimistic redirects only.
- Single authority for admin identity: database role after bootstrap, env retired.
- Append-only audit that references records rather than snapshotting their content, to keep the PII and retention surface minimal.

## Planned Extension Points

- Ban and impersonation surfaces (schema present via the plugin, no UI in this release).
- Resource-scoped permissions and moderator specialization scopes via the plugin's access-control layer.
- Audit-log retention and tamper-evidence, if accountability requirements grow.

## Risks and Constraints

- A bootstrap done wrong could lock the owner out; verification before allowlist removal is mandatory.
- The plugin migration touches auth core tables; it must follow the Prisma migration workflow and regenerate the client.
- The plugin's privileged endpoints are account-takeover grade; `adminRoles` and the default role must be set explicitly.

## ADR Need

An ADR is warranted: adopting the `better-auth` admin plugin, retiring the environment allowlist, and standardizing server-enforced `requireAdmin()` plus an append-only audit log is a cross-feature architectural decision consumed by FRD-02 and by PRD-02 (FRD-04).

## Implementation Plan

Execution order, with the foundation first:

1. `WO-01` (foundation): role, admin plugin, and audit schema plus the server helpers and their unit tests. No UI; validated by unit tests.
2. `WO-02` (vertical): bootstrap the first administrator and retire the environment allowlist, cutting `getIsAdmin()` over to the database role.

`WO-02` depends on `WO-01`. Both are prerequisites for every downstream slice in FRD-02 and for the inline moderation slices in PRD-02 (FRD-04); those may proceed in parallel once `WO-01` lands, but the allowlist retirement in `WO-02` should complete before the admin surface is exercised in a shared environment.

## Linked Work Orders

- `work-orders/wo-01-role-admin-plugin-and-audit-foundation.md`
- `work-orders/wo-02-admin-bootstrap-and-env-retirement.md`

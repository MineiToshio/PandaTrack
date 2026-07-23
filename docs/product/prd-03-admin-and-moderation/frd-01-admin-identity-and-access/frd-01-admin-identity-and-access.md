---
id: FRD-01
type: FRD
slug: admin-identity-and-access
title: Admin Identity and Access Platform
status: DRAFT
parent: PRD-03
children:
  - BP-01
last_updated: 2026-07-23
implementation_status: PLANNED
---

# FRD-01 Admin Identity and Access Platform

## Overview

This FRD defines the foundation that turns "administrator" from an environment allowlist into a durable, database-backed role, and the accountability trail that records every privileged action. It is the platform that both the collector app's inline moderation controls (PRD-02, FRD-04) and this PRD's moderation console (PRD-03, FRD-02) depend on.

It owns four things: the administrator role and its enforcement on the server, the one-time bootstrap that grants the first administrator, the retirement of the `ADMIN_EMAILS` environment allowlist, and an append-only audit log of privileged actions. It is a non-UI platform FRD: it ships schema, auth configuration, server helpers, and tests, but no screens. The visible admin surface lives in PRD-03 (FRD-02).

## Domain Goal

Make administrator identity durable, enforceable on the server, and accountable, without locking the owner out during the transition and without opening a privilege-escalation path.

## Current State

### Implemented

- Administrator identity is a transitional environment allowlist. `getIsAdmin()` (`src/lib/auth/auth-server.ts`) reads `ADMIN_EMAILS`, lowercases and trims it, and compares it to the session email.
- Two privileged behaviors already branch on `getIsAdmin`: admin-created stores are auto-approved, and admins may edit any store directly (`src/app/[locale]/(app)/stores/new/_actions/createStore.ts`, `src/app/[locale]/(app)/stores/[slug]/edit/_actions/saveStoreEdit.ts`).
- Auth runs on `better-auth` `1.6.23` with `plugins: [nextCookies()]` only (`src/lib/auth/auth.ts`). No admin plugin, no `role` field.

### Planned

- A durable `role` on `User`, enforced by a server-side `requireAdmin()` helper on every privileged action and route.
- The `better-auth` admin plugin enabled, providing `role` plus forward-compatible ban and impersonation fields.
- A one-time bootstrap that grants the first administrator, after which `ADMIN_EMAILS` is removed and `getIsAdmin` reads the database role.
- A new `AdminAuditLog` model and a `writeAuditEntry()` helper consumed by every privileged mutation.

## User Stories

### US-01 Durable administrator

As the product owner, I want my administrator status stored in the database, so that admin identity does not depend on an environment variable that is easy to drift or misconfigure.

### US-02 Safe transition

As the product owner, I want the switch from the environment allowlist to the database role to be proven before the allowlist is removed, so that I am never locked out of administration.

### US-03 Accountability

As an administrator, I want every privileged action recorded, so that who did what, to which record, and when is always answerable.

### US-04 No escalation

As the product owner, I want every non-administrator to default to the lowest privilege and to be unable to grant themselves the role, so that the admin surface cannot be reached by a normal user.

## Functional Requirements

### Role and identity

- `FR-01-01`: The system must store a moderation `role` on `User`, with at least the values `admin` and `user`, defaulting to `user`.
- `FR-01-02`: The system must enable the `better-auth` admin plugin so that `role` and its forward-compatible fields (`banned`, `banReason`, `banExpires` on `User`; `impersonatedBy` on `Session`) exist in the schema.
- `FR-01-03`: Every newly created user must receive `role` `user` by default, with no path that lets a user set or elevate their own role.

### Server authorization

- `FR-01-04`: The system must provide a server-side `requireAdmin()` helper that resolves the session, verifies the database role, and refuses non-administrators before any privileged work runs.
- `FR-01-05`: Every privileged action, route handler, and admin data fetch must call `requireAdmin()`; the middleware/proxy layer must be treated as an optimistic redirect only, never as the authorization boundary.
- `FR-01-06`: Privileged `better-auth` admin endpoints (role change, and the deferred ban and impersonation endpoints) must be treated as a threat surface, with `adminRoles` configured explicitly and the default role kept at `user`.

### Bootstrap and migration

- `FR-01-07`: The system must provide a one-time, idempotent bootstrap that grants the first administrator by setting `role` `admin` on the owner's account. The bootstrap identifies the owner by a supplied email and resolves it to the account's `user id` inside the operation; the email is the stable per-environment key and the resolved id differs per environment.
- `FR-01-08`: After the bootstrap is verified, `getIsAdmin()` must read the database `role` and the `ADMIN_EMAILS` environment allowlist must be removed, leaving the database role as the single source of truth.
- `FR-01-09`: The two existing admin-gated behaviors (store auto-approval and direct edit) must continue to work unchanged once they read the database role instead of the environment allowlist.

### Audit trail

- `FR-01-10`: The system must provide an append-only `AdminAuditLog` recording, for each privileged action, the actor id, the action key, the target type and id, a UTC timestamp, and an optional reason or metadata field.
- `FR-01-11`: The system must provide a `writeAuditEntry()` helper that every privileged mutation calls as part of the same transaction or immediately after the action succeeds.
- `FR-01-12`: Audit entries must reference the affected record by type and id and must not copy sensitive content (raw report text, reporter identity, secrets) into the log.

## Business Rules

- `BR-01-01`: After the bootstrap, the database `role` is the single authority for "is administrator"; the environment allowlist is retired and must not grant admin in parallel.
- `BR-01-02`: `AdminAuditLog` is append-only; the system must expose no update or delete path for it.
- `BR-01-03`: Impersonation and ban management have no UI in this release; the plugin must still default every user to `user` and keep those endpoints admin-only.
- `BR-01-04`: The audit log must never store personal data of reporters or the free-text body of reports; it stores identifiers and an optional non-sensitive reason only.
- `BR-01-05`: The action key vocabulary (`store.approve`, `store.remove`, `store.flag`, `store.unflag`, `report.resolve`, `report.dismiss`, `changeRequest.apply`, `changeRequest.reject`, `productType.approve`, `productType.reject`) is shared across the domains that write audit entries and must stay stable once defined.

## Acceptance Criteria

### `AC-01-01` Non-administrator refused on the server

- Given an authenticated user whose `role` is `user`
- When they invoke a privileged action directly (bypassing the hidden UI)
- Then `requireAdmin()` refuses the action before any mutation runs
- And no `AdminAuditLog` entry is written

### `AC-01-02` Administrator recognized by database role

- Given a user whose `role` is `admin`
- When they invoke a privileged action
- Then `requireAdmin()` allows it
- And the outcome is identical whether or not `ADMIN_EMAILS` is set

### `AC-01-03` Bootstrap grants the first administrator

- Given a fresh environment where the owner has `role` `user`
- When the one-time bootstrap runs for the owner's account
- Then the owner's `role` becomes `admin`
- And re-running the bootstrap makes no further change (idempotent)

### `AC-01-04` Audit entry on a privileged action

- Given an administrator performing a privileged action on a target record
- When the action succeeds
- Then an `AdminAuditLog` entry exists with the actor id, action key, target type and id, and a UTC timestamp
- And the entry contains no raw report text or reporter identity

### `AC-01-05` Audit entries are immutable

- Given an existing `AdminAuditLog` entry
- When any code path attempts to update or delete it
- Then no such path exists in the data layer

### `AC-01-06` New users default to the lowest privilege

- Given a newly created account through any sign-up path
- When the account is persisted
- Then its `role` is `user`
- And no self-service path can change it

## Implementation Notes

- Reverse-engineered from the current implementation: the env allowlist and the two admin-gated store behaviors already exist and must keep working after the cutover (`src/lib/auth/auth-server.ts`, `src/app/[locale]/(app)/stores/new/_actions/createStore.ts`, `.../stores/[slug]/edit/_actions/saveStoreEdit.ts`).
- The admin plugin schema change touches the auth core tables (`user`, `session`); it must follow the Prisma migration workflow and run `prisma generate` so the client picks up the new fields.
- The bootstrap should be an idempotent, reviewable step (a migration or a guarded one-off script keyed by the owner's user id), verified to work before `ADMIN_EMAILS` is deleted from configuration and `.env.example`.
- `requireAdmin()` and `writeAuditEntry()` belong in the data/auth layer, not in components; the admin plugin endpoints live inside `better-auth`'s handler and are not covered by the app's own `requireAdmin()`.

## State Model

### Role state

- `user`: default for every account; no privileged access.
- `admin`: granted by bootstrap or by an existing administrator through the plugin; unlocks privileged actions and the admin space.

### Account moderation state (schema present, deferred surface)

- `banned`, `banReason`, `banExpires`: created by the plugin, defaulted safe; no UI in this release.

### Audit entry state

- `AdminAuditLog` rows are write-once; there is no lifecycle beyond creation.

## Confirmed

- Administrator identity moves to a database `role` using the `better-auth` admin plugin (ADR to be recorded).
- The environment allowlist is retired only after the bootstrap is verified.
- The audit log is append-only and stores identifiers plus an optional non-sensitive reason, never PII.
- Impersonation, ban management, and resource-scoped permissions are deferred; the schema shape keeps them available without rework.
- The bootstrap ships as a committed, idempotent maintenance script (`scripts/bootstrap-admin.ts`, run via `npx tsx`), not a Prisma migration, so it runs per environment against the target database and can be verified before the allowlist is removed. It identifies the owner by a supplied email resolved to the account's `user id`.
- The bootstrap writes no audit entry: it is an operator-run provisioning step with no in-app actor, and the action vocabulary (`BR-01-05`) stays stable. A `role.grant` action key with a `user` target type is deferred until the in-app grant path ships in FRD-02.
- A second administrator is granted durably through the plugin's server-gated role endpoint via the admin UI in FRD-02, which writes a `role.grant` audit entry when that path ships. Interim, the same bootstrap script serves as the operator path by running it with another account's email.

## Open Questions

- None. The bootstrap mechanism, per-environment owner identification, audit handling, and the second-administrator grant path are resolved above (see WO-02).

## Out of Scope

- Any admin-facing screen; the admin shell and console live in PRD-03 (FRD-02).
- The store-moderation transitions and inline controls themselves; owned by PRD-02 (FRD-04).
- Impersonation and ban management surfaces.
- Resource-scoped permissions and moderator specialization scopes.

## Linked Blueprints

- `docs/product/prd-03-admin-and-moderation/frd-01-admin-identity-and-access/bp-01-admin-identity-and-access-platform/bp-01-admin-identity-and-access-platform.md`

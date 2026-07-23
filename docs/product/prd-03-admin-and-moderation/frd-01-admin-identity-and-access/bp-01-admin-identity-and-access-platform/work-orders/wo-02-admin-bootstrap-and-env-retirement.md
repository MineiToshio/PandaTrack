---
id: WO-02
type: WORK_ORDER
slug: admin-bootstrap-and-env-retirement
title: Admin Bootstrap and Environment Allowlist Retirement
status: DRAFT
parent: BP-01
implementation_status: PLANNED
last_updated: 2026-07-22
---

# WO-02 Admin Bootstrap and Environment Allowlist Retirement

## Summary

Vertical slice that flips administrator identity from the environment allowlist to the database role. Grants the first administrator through a one-time idempotent bootstrap, rewrites `getIsAdmin()` to read the role, and removes `ADMIN_EMAILS` so the database becomes the single source of truth. Proves the grant before the allowlist is removed, so the owner is never locked out.

## In Scope

- A one-time, idempotent bootstrap that sets `role` `admin` on the owner's account, keyed by the owner's user id (a Prisma migration or a guarded maintenance script).
- Rewrite `getIsAdmin()` (`src/lib/auth/auth-server.ts`) to read the database `role`.
- Remove `ADMIN_EMAILS` from configuration and `.env.example` after the grant is verified.
- Keep the two existing admin behaviors (store auto-approval, direct edit) working through the role read.
- Integration tests covering the cutover.

## Out of Scope

- The role machinery, plugin, and helpers themselves (delivered in `WO-01`).
- Any admin UI (FRD-02) and any privileged store transition (PRD-02, FRD-04).
- Adding a second administrator through a UI.

## Requirements

- `FR-01-07`: Provide a one-time, idempotent bootstrap that grants the first administrator.
- `FR-01-08`: After verification, `getIsAdmin()` reads the database role and `ADMIN_EMAILS` is removed.
- `FR-01-09`: Store auto-approval and direct edit keep working through the role read.
- `FR-01-05`: Privileged work stays gated by `requireAdmin()`; the proxy remains an optimistic redirect only.

Relevant business rules:

- `BR-01-01`: After bootstrap, the database role is the single authority; the allowlist is retired and must not grant admin in parallel.
- `BR-01-03`: Ban and impersonation stay UI-less; users still default to `user`.

## Blueprints

- `BP-01` runtime component coverage: auth configuration layer (`getIsAdmin` cutover), data model layer (bootstrap grant), verification layer (integration tests). Depends on `WO-01`.

## E2E Acceptance Tests

- After the bootstrap runs, the owner's account has `role` `admin`, and re-running the bootstrap changes nothing (`AC-01-03`).
- With `ADMIN_EMAILS` unset, an `admin`-role user still passes `requireAdmin()` and can perform the two existing admin behaviors (`AC-01-02`, `FR-01-09`).
- A `user`-role account is refused every privileged action after the cutover (`AC-01-01`).

---
id: WO-02
type: WORK_ORDER
slug: admin-bootstrap-and-env-retirement
title: Admin Bootstrap and Environment Allowlist Retirement
status: ACTIVE
parent: BP-01
source_issue: 127
implementation_status: IN_PROGRESS
last_updated: 2026-07-23
---

# WO-02 Admin Bootstrap and Environment Allowlist Retirement

## Summary

Vertical slice that flips administrator identity from the environment allowlist to the database role. Grants the first administrator through a one-time idempotent bootstrap script, rewrites `getIsAdmin()` to read the database role, and removes `ADMIN_EMAILS` so the database becomes the single source of truth. The grant is proven per environment before the allowlist is removed, so the owner is never locked out.

## In Scope

- A one-time, idempotent bootstrap that sets `role` `admin` on the owner's account, delivered as a committed maintenance script `scripts/bootstrap-admin.ts` with a `db-bootstrap-admin` entry in `package.json`, following the existing idempotent data-script pattern (`scripts/backfill-store-search-name.ts`, `scripts/seed-dev-data.ts`): `dotenv/config`, the `PrismaPg` adapter, a `Usage:` header, and a loud failure when the target account does not exist.
- The bootstrap identifies the owner by a supplied email (a CLI argument or an `ADMIN_BOOTSTRAP_EMAIL` variable) and resolves it to the account's `user id` inside the script, then writes the role by id. The email is the stable per-environment key; the resolved id differs per environment.
- Rewrite `getIsAdmin()` (`src/lib/auth/auth-server.ts`) to read the database `role`, reusing the existing `roleGrantsAdmin()` membership check, and keeping its non-throwing boolean signature so all four call sites stay unchanged.
- Remove `ADMIN_EMAILS` from configuration and `.env.example`, and the `ADMIN_EMAILS_KEY` read in `auth-server.ts`, after the grant is verified.
- Keep the two existing admin behaviors (store auto-approval, direct edit) and the two admin-gated UI/visibility reads working through the role read.
- Integration tests covering the cutover.

## Out of Scope

- The role machinery, plugin, and helpers themselves (delivered in `WO-01`).
- Any admin UI (FRD-02) and any privileged store transition (PRD-02, FRD-04).
- Adding a second administrator through a UI (see Dependencies for the interim path).

## Requirements

- `FR-01-07`: Provide a one-time, idempotent bootstrap that grants the first administrator, keyed by the owner's account resolved from a supplied email to its `user id`.
- `FR-01-08`: After verification, `getIsAdmin()` reads the database role and `ADMIN_EMAILS` is removed.
- `FR-01-09`: Store auto-approval and direct edit keep working through the role read.
- `FR-01-05`: Privileged work stays gated by `requireAdmin()`; the proxy remains an optimistic redirect only.

Relevant business rules:

- `BR-01-01`: After bootstrap, the database role is the single authority; the allowlist is retired and must not grant admin in parallel.
- `BR-01-03`: Ban and impersonation stay UI-less; users still default to `user`.
- `BR-01-05`: The audit action vocabulary stays stable; the bootstrap is a documented exception that writes no audit entry (see Security Notes).

## Blueprints

- `BP-01` runtime component coverage: auth configuration layer (`getIsAdmin` cutover), data model layer (bootstrap grant), verification layer (integration tests). Depends on `WO-01`.

## Technical Notes

- `getIsAdmin()` today (`src/lib/auth/auth-server.ts`) reads `process.env.ADMIN_EMAILS`. It has four consumers, and not all are privileged mutations:
  - `src/app/[locale]/(app)/stores/new/_actions/createStore.ts` decides `APPROVED` vs `PENDING` on store creation.
  - `src/app/[locale]/(app)/stores/[slug]/edit/_actions/saveStoreEdit.ts` authorizes direct edit.
  - `src/app/[locale]/(app)/stores/[slug]/page.tsx` uses `isAdmin` as a non-throwing boolean for private-store access (returns `notFound()`, not 403, per ADR 0009) and the `canDirectlyEdit` hint.
  - `src/app/[locale]/(app)/stores/[slug]/edit/page.tsx` uses `isAdmin` for the `canDirectlyEdit` hint and the page title.
- Rewrite `getIsAdmin(session)` to read `session.user.role` via the existing `roleGrantsAdmin()` helper, keeping the boolean, non-throwing signature. Replacing the call sites with `requireAdmin()` is rejected: `requireAdmin()` throws, which suits privileged mutations but would break the page consumers that use `isAdmin` to compute UI hints and 404 visibility. This slice adds no new privileged action, so the store consumers keep their boolean pattern, now backed by the role.
- `getIsAdmin()` and `roleGrantsAdmin()` must share a single role-membership check so the `admin` token is resolved identically in both paths. As built, the shared `roleGrantsAdmin()` check lives in a dependency-free `src/lib/auth/adminRole.ts` module (no server-only imports) so `getIsAdmin()`, `requireAdmin()`, and the bootstrap script all consume the same membership logic; the script cannot import `auth-server.ts` because it pulls in `next/headers`.
- `requireAdmin()` (already reading `session.user.role`) remains the throwing server gate for genuinely privileged mutations (`FR-01-05`).
- The bootstrap script imports `PrismaClient` from the generated client with the `PrismaPg` adapter and `dotenv/config`, exactly like the existing data scripts; it runs with `npx tsx` against the target environment's `DATABASE_URL`.

## Cutover Sequence (per environment)

Run in order in each environment (dev, preview/staging DB, prod) so the owner is never locked out (`BR-01-01`, US-02):

1. Run `scripts/bootstrap-admin.ts` in the environment so the owner's account gets `role` `admin`.
2. Verify the grant (the owner's account reads `role` `admin`; a second run is a no-op).
3. Only then deploy the code that flips `getIsAdmin()` to the role read and removes `ADMIN_EMAILS` from configuration and `.env.example`.

Deploying the flip before the bootstrap has run and been verified in that environment would drop the owner's admin access, so the order is mandatory.

## Security Notes

- The bootstrap writes no `AdminAuditLog` entry. The audit trail records in-app moderation actions on content records (`store`, `report`, `changeRequest`, `productType`) performed by a session actor; the bootstrap is an operator-run provisioning step against the database with no in-app actor. The action vocabulary (`BR-01-05`) has no `role.grant` key and must stay stable. This is a documented exception. A `role.grant` key with a `user` target type is deferred until the in-app grant path (a real actor and target) ships in FRD-02.
- The bootstrap only elevates; it never demotes and never touches any account other than the one resolved from the supplied email.

## Dependencies

- Depends on `WO-01` (role column, admin plugin, `requireAdmin()`, `roleGrantsAdmin()`, audit schema and helper), which is implemented.
- Second-administrator grant path: durably, a second administrator is granted through the `better-auth` admin plugin's server-gated role endpoint (`adminRoles: ["admin"]`) via the admin UI in FRD-02, which writes a `role.grant` audit entry when that path ships. Interim, the same `scripts/bootstrap-admin.ts` serves as the operator path by running it with another account's email. Adding a second administrator through a UI is out of scope for this slice.

## E2E Acceptance Tests

- After the bootstrap runs, the owner's account has `role` `admin`, and re-running the bootstrap changes nothing (`AC-01-03`).
- With `ADMIN_EMAILS` unset, an `admin`-role user still passes `requireAdmin()` and can perform the two existing admin behaviors (`AC-01-02`, `FR-01-09`).
- A `user`-role account is refused every privileged action after the cutover (`AC-01-01`).

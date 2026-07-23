---
title: ADR 0017 — Admin identity and access platform (database role, requireAdmin gate, embedded console)
date: 2026-07-22
status: accepted
session: PRD-03 admin and moderation platform definition (2026-07-22)
owner: Sergio Minei
trigger: FRD-01 (PRD-03) explicitly flags this as a cross-feature architectural decision, consumed by PRD-03 FRD-02 and by PRD-02 FRD-04's inline moderation
updates: docs/product/prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md, docs/product/prd-03-admin-and-moderation/frd-01-admin-identity-and-access/bp-01-admin-identity-and-access-platform/bp-01-admin-identity-and-access-platform.md
---

# ADR 0017 — Admin identity and access platform

## Context

PandaTrack already ships community governance submission in the store domain (PRD-02, FRD-04): any
collector can create a store, report a store, propose a change request, or suggest a product type.
None of those records has a resolver. There is no role in the database, no privileged route, and no
mutation that approves a store, resolves a report, applies a change request, or authors a suggested
product type. Admin identity today is a transitional environment allowlist (`ADMIN_EMAILS`, read by
`getIsAdmin()` in `src/lib/auth/auth-server.ts`), which only gates two existing behaviors (admin-created
store auto-approval, direct edit of any store).

Three constraints shaped the decision:

1. **Pending stores are publicly visible by design.** Approval gates search-engine indexing and trust
   signals, not in-app visibility, so that two collectors cannot independently create duplicate stores
   for the same seller. Because unmoderated stores are therefore live the moment they are created, a
   working takedown path is a first-release requirement, not a later refinement.
2. **Middleware cannot be the authorization boundary.** Next.js has shipped a documented class of
   middleware-bypass vulnerability (the CVE-2025-29927 family, where a crafted request skips
   middleware-only checks). PandaTrack's own proxy (`src/proxy.ts`) already treats route protection as
   session-presence only, with no role awareness; extending that pattern to admin routes without a
   server-enforced check on the privileged actions themselves would inherit the same class of risk.
3. **The product architecture names two apps, one deployment.** `AGENTS.md` describes a "Public Landing
   App" and a "Private Admin App", but PandaTrack ships as a single Next.js repository and deployment.
   The admin surface has to fit that shape rather than imply a second codebase.

## Decision

Adopt a single admin identity and access platform, owned by PRD-03 (FRD-01) and consumed by PRD-03
(FRD-02) and PRD-02 (FRD-04):

1. **Database-backed role via the `better-auth` admin plugin.** Add a `role` field on `User` (values
   `admin` and `user`, defaulting to `user`) through the plugin, with `adminRoles` configured explicitly
   and the default role kept at `user`. No self-service path lets a user set or elevate their own role.
2. **One authority for admin identity.** After a one-time, idempotent bootstrap grants the first
   administrator and that bootstrap is verified in the target environment, `getIsAdmin()` reads the
   database role and the `ADMIN_EMAILS` environment allowlist is removed from configuration and
   `.env.example`. The database role never runs in parallel with the allowlist once retired.
3. **Layered server-side authorization.** A `requireAdmin()` helper resolves the session, verifies the
   database role, and refuses non-administrators before any privileged work runs. Every privileged
   action, route handler, and admin data fetch calls it. The proxy/middleware layer is treated as an
   optimistic redirect only, an early UX shortcut, never the authorization boundary.
4. **Append-only audit trail.** An `AdminAuditLog` model, written through a shared `writeAuditEntry()`
   helper, records the actor id, a stable action key, the target type and id, a UTC timestamp, and an
   optional non-sensitive reason for every privileged mutation. It references affected records by type
   and id; it never snapshots report free text, reporter identity, or other sensitive payloads. No
   update or delete path is exposed for it.
5. **Embedded, localized admin surface.** The visible admin console lives at `/[locale]/admin`, inside
   the same repository and deployment as the rest of PandaTrack, localized through the same i18n system
   (`es` default, `en` available) and the same proxy route-prefix pattern already used by the collector
   app's private routes.

## Alternatives considered

### A. Hand-rolled role column instead of the `better-auth` admin plugin

- Pros: no new plugin surface; the schema stays exactly as small as the current feature needs.
- Cons: same implementation effort as enabling the plugin, but loses the plugin's forward-compatible
  fields (`banned`, `banReason`, `banExpires` on `User`; `impersonatedBy` on `Session`) and its
  access-control layer for resource-scoped permissions, both of which are explicit planned extension
  points for this platform (ban/impersonation surfaces, moderator specialization).
- Why not chosen: no effort savings today, and it closes off the forward-compatible migration path the
  plugin already provides.

### B. Separate admin application or repository

- Pros: strict isolation of the privileged surface from the public/collector code paths; a compromised
  collector-app dependency cannot reach admin code directly.
- Cons: violates the product architecture's one-repo, one-deployment constraint (`AGENTS.md` §3); forces
  duplicated auth configuration, session handling, and i18n setup across two codebases; introduces drift
  risk between the two apps' understanding of roles and audit vocabulary.
- Why not chosen: the isolation benefit does not outweigh maintaining two deployments and two copies of
  auth/i18n plumbing for a single-administrator first release.

### C. Admin surface on a separate subdomain now

- Pros: a distinct origin gives cookie and CORS isolation between the collector app and the admin
  console, and reads as a clearer boundary in infrastructure terms.
- Cons: requires cookie-domain and `trustedOrigins` changes in `src/lib/auth/auth.ts` (currently scoped
  to a single origin), plus DNS and deployment routing work, none of which the current single
  administrator release needs.
- Why not chosen: deferred, not rejected. If the console grows into a multi-moderator, higher-trust
  surface, moving it to a subdomain is a documented future path; it is out of scope for this decision.

### D. Bare, non-localized `/admin` route

- Pros: simplest possible route shape; no i18n wiring needed.
- Cons: escapes the app's locale-prefixed routing (`src/i18n/routing.ts`, `src/i18n/request.ts`) and the
  proxy's locale-aware matcher (`src/proxy.ts`), so it would need its own parallel routing and
  redirect logic instead of reusing the pattern every other private route already follows; breaks the
  stated requirement that a future team of moderators can operate in Spanish or English.
- Why not chosen: duplicates infrastructure the app already has for no benefit.

## Consequences

### Positive

- One place answers "is this account an administrator": the database role, checked through
  `requireAdmin()`. No parallel allowlist and no client-trusted signal.
- The audit trail makes every privileged action (store approval and removal, report resolution, change
  request review, product-type authoring) attributable and reviewable without exposing reporter
  identity or raw report text.
- The plugin's schema shape (`role`, `banned`, `impersonatedBy`) is a forward-compatible base for ban,
  impersonation, and resource-scoped permissions without another migration when those ship.
- The admin console reuses the collector app's i18n, routing, and proxy conventions instead of
  duplicating them, keeping the "one repo, one deployment" architecture intact.

### Negative / tradeoffs

- The plugin migration touches auth-core tables (`user`, `session`), which is higher-risk than a typical
  domain migration and must follow the hand-written-migration workflow (`prisma-migration-workflow.mdc`)
  with careful verification before the environment allowlist is removed; a bootstrap done wrong could
  lock the product owner out of administration.
- The plugin's privileged endpoints (role change, and the deferred ban and impersonation endpoints) are
  account-takeover grade threat surface by construction; `adminRoles` and the default role must stay
  explicit, and any future addition of moderators goes through this same surface.
- `requireAdmin()` must be called correctly at every privileged call site; unlike a single middleware
  check, a layered gate depends on each new action remembering to call it. This is treated as
  the safer trade because a middleware-only check is exactly the pattern the CVE-2025-29927 class of
  bypass defeats.
- The admin surface stays same-origin with the collector app for now; the subdomain isolation considered
  in Alternative C is deferred, not delivered, so origin-level separation is not part of this release.

## References

- `docs/product/prd-03-admin-and-moderation/prd-03-admin-and-moderation.md`
- `docs/product/prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md`
- `docs/product/prd-03-admin-and-moderation/frd-01-admin-identity-and-access/bp-01-admin-identity-and-access-platform/bp-01-admin-identity-and-access-platform.md`
- `docs/product/prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md`
- `docs/product/prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md` (admin moderation actions, `FR-04-40` through `FR-04-51`)
- `src/lib/auth/auth.ts`, `src/lib/auth/auth-server.ts`, `src/proxy.ts`
- `.agents/rules/prisma-migration-workflow.mdc`

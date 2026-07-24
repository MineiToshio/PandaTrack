---
id: WO-01
type: WORK_ORDER
slug: admin-space-shell-and-gating
title: Admin Space Shell and Gating
status: ACTIVE
parent: BP-01
source_issue: 128
implementation_status: IN_PROGRESS
last_updated: 2026-07-23
---

# WO-01 Admin Space Shell and Gating

## Summary

Vertical slice that stands up the admin space: a localized admin segment nested inside the collector app group at `/[locale]/(app)/admin` (URL `/[locale]/admin`) gated by `requireAdmin()`, with the proxy prefix, the inherited App Shell chrome, a role-gated Administracion navigation section, an access-denied state, and the `admin` i18n namespace. This is the access boundary and frame that the inbox and audit viewer render inside. The admin landing and the audit route render stub content in this slice; the inbox (`WO-02`) and the audit table (`WO-03`) fill them later.

## In Scope

- New admin segment nested inside the collector app group at `src/app/[locale]/(app)/admin/` with its `layout.tsx` gating on `requireAdmin()`, so it inherits the collector App Shell chrome (sidebar plus topbar) rather than re-rendering it. The URL stays `/[locale]/admin` because the group name is invisible in the path.
- Add the admin path prefix to `src/proxy.ts` for an optimistic redirect of non-administrators.
- Inherited App Shell chrome plus a role-gated Administracion navigation section (Moderacion leading to `/[locale]/admin`, Registro leading to `/[locale]/admin/audit`) and an access-denied state.
- New `admin` i18n namespace under `src/i18n/locales/{es,en}/admin.json`, Spanish default, English available, registered in the `src/i18n/request.ts` manifest.
- Role-conditional Administracion navigation section in the collector app shell (PRD-02, [FRD-03](../../../../prd-02-collector-app/frd-03-collector-app-shell/frd-03-collector-app-shell.md)): the section and its links render only for users whose role is `admin`, per `FR-02-22`; a non-administrator never sees it.
- Stub landing content at `/[locale]/admin` and a stub route at `/[locale]/admin/audit`, both rendered inside the inherited shell; the inbox aggregate (`WO-02`) and the audit table (`WO-03`) fill these later.
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

## Assumptions

- The admin identity platform is already in place and consumed as-is: `requireAdmin()` (throwing `AdminAccessError`, returning the resolved session) and `getIsAdmin(session)` (non-throwing boolean) live in `src/lib/auth/auth-server.ts`, backed by `roleGrantsAdmin()` and the `better-auth` admin plugin `role` field. This slice consumes them; it does not add or change them (owned by PRD-03, FRD-01).
- The collector App Shell exists and is server-gated at `src/app/[locale]/(app)/layout.tsx` (session presence plus email-verification snapshot), rendering the `AppLayout` chrome. Nesting the admin segment inside `(app)` reuses that gate and chrome without duplication.
- No Prisma reads or mutations are introduced by this slice beyond the session read already performed by the shell layer; the moderation aggregate and the audit read arrive in `WO-02` and `WO-03`.

## Technical Notes

- Route placement: the admin segment nests at `src/app/[locale]/(app)/admin/` so it inherits `(app)/layout.tsx` (the collector session gate and the `AppLayout` chrome). A sibling `(admin)` group was rejected because it would not inherit `(app)/layout.tsx` and would force re-rendering the shell and duplicating the session and verification gates. The URL is unchanged (`/[locale]/admin`); the group name does not appear in the path.
- Gating: `src/app/[locale]/(app)/admin/layout.tsx` is a server component that calls `requireAdmin()`. It catches `AdminAccessError` and issues a server `redirect()` to `/[locale]/dashboard` as the effective refusal path; the access-denied screen is the rendered fallback for the direct-hit case. `requireAdmin()` remains the real authorization boundary regardless of nav visibility.
- Proxy: add an `admin` key to `ROUTES` in `src/lib/constants.ts` and add `ROUTES.admin` to `PRIVATE_ROUTE_PREFIXES` in `src/proxy.ts`. The existing matcher `["/", "/(es|en)/:path*"]` already captures `/es/admin` and `/en/admin`, so no matcher change is needed. The proxy stays an optimistic session-cookie redirect only, never the authorization boundary (`FR-02-02`).
- i18n: create `src/i18n/locales/es/admin.json` and `src/i18n/locales/en/admin.json` and register the namespace in the hand-maintained manifest inside `src/i18n/request.ts` (namespaces are not auto-discovered). Messages are provided globally through the single `NextIntlClientProvider` at `src/app/[locale]/layout.tsx`, so the namespace is then available to both `getTranslations({ namespace: "admin" })` on the server and `useTranslations("admin")` on the client, with no per-group provider wiring.
- Nav model: the shell server layout computes `isAdmin = getIsAdmin(session)` and threads that boolean prop through `AppLayout` (client) to `Sidebar` (`src/components/modules/Sidebar.tsx`) and `AppNavDrawer`. Only the boolean crosses the client boundary; the role string is never exposed to the client. `src/app/[locale]/(app)/_components/AppLayout/navigationConfig.ts` is extended to support a grouped Administracion section (Moderacion, Registro) in addition to the existing flat items, and the lucide icon maps in `Sidebar.tsx` and `AppNavDrawer.tsx` gain the new entries.

## UX Notes

- Access refusal is a redirect to the collector dashboard as the effective behavior, with a minimal access-denied panel (from the `admin` namespace, copy per FDD-02 §6.4) as the fallback for a direct hit that is not redirected. It never renders moderation data (`FR-02-04`, `AC-02-01`, `AC-02-16`).
- The Administracion section is a permanent part of the collector sidebar for administrators: because the admin segment nests inside `(app)`, an administrator sees the section across the whole app, not only inside `/admin`, matching the design intent in FDD-02 §1.
- The admin landing (`/[locale]/admin`) and the audit route (`/[locale]/admin/audit`) render stub content inside the inherited shell in this slice; their functional views arrive in `WO-02` and `WO-03`.

## Security Notes

- `requireAdmin()` at the admin layout is the authorization boundary; the proxy is an optimistic redirect only, consistent with ADR 0017 and the middleware-bypass rationale it records.
- Hiding the Administracion navigation for non-administrators is presentation only and never the security mechanism (`BR-02-05`); every admin route still authorizes server-side.
- `AdminAccessError` is an expected authorization outcome and must not be reported to Sentry; the layout translates it into the redirect described above.
- The shell threads only a boolean `isAdmin` to the client; no role string or other privileged data crosses the boundary.

## Observability Notes

- Add a new `POSTHOG_EVENTS.ADMIN` group in `src/lib/constants.ts` with `SPACE_ENTERED: "admin_space_entered"` and emit it once on mount from a small client island following the `DashboardZoneView` precedent (`src/app/[locale]/(app)/dashboard/_components/DashboardZoneView.tsx`), keeping the surrounding admin surface server-rendered. This is a view event, so it is client-side; server-side emission is reserved for mutations (`FR-02-13`).

## Dependencies

- PRD-03, FRD-01 · `WO-01` (implemented): `requireAdmin()`, `getIsAdmin()`, the `role` field, and `AdminAuditLog`.
- PRD-02, [FRD-03](../../../../prd-02-collector-app/frd-03-collector-app-shell/frd-03-collector-app-shell.md): the collector App Shell that owns and renders the Administracion entry point (`FR-02-22`); this slice extends its navigation config and threads the admin boolean through it.
- `WO-02` and `WO-03` depend on this slice for the shell and gating and fill the stub landing and audit route respectively.

## Testing Notes

- Reuse the existing E2E helpers in `e2e/_helpers/auth.ts`: `signInAsAdmin` (with `shouldSkipAdminE2E` so admin specs skip when `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` are absent) and `signInAndLandOnDashboard` / `skipUnlessAuthenticatedEnv` for the plain-user path. No new test capability is introduced.
- A new spec covers `AC-02-01` (plain user refused, no moderation data), `AC-02-06` (localized console under both `/es/admin` and `/en/admin`), `AC-02-15` (admin nav entry shown only to administrators and leading to `/[locale]/admin`), and `AC-02-16` (direct navigation still refused). This is the first spec to exercise the `/es` locale, since existing specs only drive `/en`.
- Operational dependency: the admin E2E path requires an account that has been granted admin via `npm run db-bootstrap-admin -- <email>`; when the admin credentials are absent the admin-path assertions skip rather than fail, per the existing guard.

## Validation

- Behavioral / medium-risk change (routing, server/client boundary, proxy, i18n wiring): run `npm run test`, `npm run type-check`, `npm run lint`, and `npm run validate-build`, plus the new admin E2E spec on a Better-Auth-trusted port (`docs/development/testing.md`).

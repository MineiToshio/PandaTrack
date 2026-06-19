---
id: FRD-03
type: FRD
slug: collector-app-shell
title: Collector App Shell and Dashboard-first Navigation
status: ACTIVE
parent: PRD-02
children:
  - BP-01
last_updated: 2026-06-16
source_features:
  - FEAT-0011
implementation_status: IMPLEMENTED
---

# FRD-03 Collector App Shell and Dashboard-first Navigation

## Overview

This FRD defines the private collector workspace shell that gives PandaTrack a stable app frame before the deeper collector workflows are filled in.

## Current State

### Implemented

- shared private app layout
- dashboard-first private entry
- desktop sidebar expand/collapse behavior with two distinct modes: the **manual collapse/expand toggle is PUSH** (it changes the pinned `expanded` state, which drives `--sidebar-current-w` and shifts the content column's `padding-left`); **hover-expand is FLOAT** (a collapsed rail widens to full width on hover/focus and overlays the content — it raises its `z-index` and casts a shadow, and never shifts the content column). The implementation reflects only the pinned `expanded` state into `--sidebar-current-w` (`AppLayout.tsx`); the transient hover state is local to the sidebar and intentionally does not push.
- touch-friendly drawer navigation; on mobile/tablet the burger `AppNavDrawer` is the **single** primary navigation surface (the earlier `MobileTabBar` was built and then removed in the redesign — see `FR-03-04` note)
- route-aware content header, constrained to `[☰]` + breadcrumb + title; it does not host back navigation, an overflow menu, or the account avatar (see `FR-03-05` note)
- locale/theme controls in the header; the sidebar surface uses `bg-surface-elevated`
- lower-shell account trigger (`ShellAccountMenu`) in the desktop sidebar and mobile drawer, with account actions moved out of the content header and `Settings` living in the lower account menu instead of the main nav list
- tests for layout behavior and E2E app-shell navigation

### Removed during the redesign

- `MobileTabBar` (4-tab bottom bar) — built in an earlier pass and then removed; its token `--mobile-tab-bar-h` and `mobileTabBar.*` i18n keys were dropped. The burger drawer is the sole primary mobile navigation.
- The floating action button (`FAB`) and the idle `MascotBubble` are no longer mounted by the app layout. The component files remain in the repo but are not consumed by the shell.

### Adopted cross-app redesign patterns

These are owned by the redesign design system (documented in `docs/design/PLAYBOOK.md` and the ADRs in `docs/design/decisions/`), not introduced as shell-specific functional requirements: the **adaptive `Modal`** (renders a centered dialog on desktop and a bottom sheet on mobile), the **single-primary sticky action bar** for detail/create/edit screens, and the **Chip Eyebrow + Top-Accent** section-card treatment.

## Functional Requirements

- `FR-03-01`: Signed-in routes must render inside a reusable collector app shell. **Implementation note:** route protection is enforced at the server layout boundary (`(app)/layout.tsx`) before the client shell renders: no session redirects to `/{locale}/sign-in`; an email-verification snapshot in state `blocked` redirects to the verify-email gate (carrying a `returnTo` back to the dashboard) before any `(app)` content is shown. Only `verified`, `not_applicable`, or `grace` states reach the shell.
- `FR-03-02`: The dashboard must be the default private entry destination. **Implementation note:** the dashboard route (`/{locale}/dashboard`) renders an `AppPlaceholderPage` + `AppComingSoonCard` placeholder (the dashboard feature itself is out of scope for the MVP — see the FDD §1); it exists so the shell always has a stable landing surface, and offers CTAs into `Orders` and `Stores`.
- `FR-03-03`: The desktop sidebar must support expanded and collapsed states. **Redesign note:** implemented as two modes — the **manual toggle is PUSH** (shifts the content column) and **hover/focus-expand is FLOAT** (overlays the content and leaves it in place). The collapsed rail is `--sidebar-w-collapsed` (`4rem`, icons only); the expanded sidebar is `--sidebar-w-expanded` (`15rem`, icons + labels). Only the pinned (toggled) state pushes the content; hover-expand floats. The desktop sidebar exists only at `≥1024px` (`lg:flex`); below that it is `display:none` and navigation moves to the drawer.
- `FR-03-04`: The mobile and tablet experience must replace hover-dependent behavior with a drawer pattern. **Redesign note:** the burger `AppNavDrawer` is the single primary mobile navigation; the `MobileTabBar` that briefly implemented a 4-tab bottom bar was removed (token and i18n keys dropped).
- `FR-03-05`: The content header must support route-aware title and contextual chrome. **Redesign note (ADR 0011):** "contextual chrome" is intentionally limited to `[☰]` + breadcrumb + title. The header does not host back navigation, an overflow (`⋯`) menu, or the account avatar; contextual actions (secondary actions, back links, CTAs) live in the page content (`<main>`), not in the shell header.
- `FR-03-06`: Locale, theme, and account actions must be available from the shell. **Redesign note:** locale and theme toggles live in the header; the account trigger (`ShellAccountMenu`) lives in the lower shell area, not the header. The sidebar surface color is `bg-surface-elevated`. The earlier `FAB` is no longer mounted by the shell.
- `FR-03-07`: Sidebar preference may be persisted locally in the browser. **Redesign note:** the pinned expand/collapse state is owned by the `useSidebarState` hook and persisted to `localStorage` under the key `appShellSidebarExpanded` (string `"true"`/`"false"`; default `expanded`). The value is read after mount (not during SSR) to avoid hydration mismatch, and is reflected on the content column through the `--sidebar-current-w` CSS variable. The transient hover-expand (FLOAT) state is **not** persisted.
- `FR-03-08`: Shell interactions should be instrumentable and shell failures should be observable without noisy duplication. **Redesign note:** the idle `MascotBubble` was removed from the shell (it competed with sticky action bars and added no flow value). Instrumentation is the `POSTHOG_EVENTS.APP_SHELL` namespace (see Analytics); failures are handled by two shell boundaries — `(app)/error.tsx` (captures to Sentry tagged `area: "app_shell"`, `role="alert"`, offers retry + go-home) and `(app)/not-found.tsx` (neutral, **no** Sentry capture — a missing page is not an error per ADR 0013).

- `FR-03-09`: The primary navigation set is fixed for the MVP: `Dashboard`, `Stores`, `Orders`, `Deliveries`, `Settings`. The desktop sidebar renders all five rows; the mobile drawer renders the four route rows and **omits `Settings`** (Settings is reachable from the lower-shell account menu, per `FR-03-06`). Exactly one row is `is-active` at a time, derived from the first path segment after the locale; an unknown segment falls back to `Dashboard`.
- `FR-03-10`: Selected nav entry-points carry curated default filters in their `href` so the destination opens focused on active work: `Orders` opens with the active-status filter set (`status=OPEN&status=PARTIALLY_IN_TRANSIT&status=IN_TRANSIT&status=PARTIALLY_DELIVERED`), `Deliveries` opens with `status=IN_TRANSIT`, and `Stores` may carry the user's saved preference filters (country / product-type) when those preferences resolve to still-active catalog options, otherwise a bare `/stores`. Only the nav/drawer entry-points apply these defaults; other entry-points (chips, address bar, back-nav) land on the bare URL.
- `FR-03-11`: The content header renders route-aware breadcrumbs derived from the pathname. First-level routes (locale + one primary segment) show a title only (no breadcrumb chain). Nested routes show the parent-area crumb as a link plus the current page as the (presentational) title, never duplicating the leaf in both crumb and title. Detail/edit pages may inject a dynamic middle crumb (entity name) and override the title through the shared header-title context (`HeaderTitleProvider` / `SetHeaderTitle`); the `:id` segment of a store/order edit path is skipped in favor of that injected entity crumb.
- `FR-03-12`: When the signed-in user is within the email-verification grace window (`grace` state), the shell renders a sticky `VerifyEmailBanner` above it and offsets the shell by `--app-banner-offset` (`56px`); the sidebar and sticky header re-anchor below the banner. Outside the grace window (verified / not applicable) no banner renders and the offset is `0px`. (The `blocked` state never reaches the shell — see `FR-03-01`.)

## Business Rules

- `BR-03-01`: Dashboard is the private starting point.
- `BR-03-02`: `Pre-orders` stay conceptually grouped under orders in MVP navigation.
- `BR-03-03`: Shell clarity matters more than novelty.
- `BR-03-04`: The content header owns page context, not primary account actions.
- `BR-03-05`: Lower-shell account affordances should stay aligned between desktop sidebar and mobile drawer.
- `BR-03-06`: `Settings` is an account-area destination, not a primary nav destination: it lives in the lower-shell account menu (desktop sidebar footer + mobile drawer) and is not listed in the mobile drawer's primary route list.
- `BR-03-07`: The content header is presentational chrome and never the document's primary heading; exactly one `h1` lives in `<main>` per view so the heading outline stays correct.
- `BR-03-08`: A missing private page is a neutral 404 (no error capture), while a thrown shell render error is an alert that is captured once to Sentry; the two are distinct boundaries and must not be collapsed.

## Acceptance Criteria

### `AC-03-01`

- Given a signed-in user opens the collector workspace
- When the private layout renders
- Then the dashboard appears inside the shared app shell.

### `AC-03-02`

- Given the user is on mobile or tablet
- When they navigate the private workspace
- Then the shell uses an explicit drawer pattern instead of hover-only behavior.

### `AC-03-03`

- Given the user navigates between first-level and nested routes
- When the header renders
- Then it adapts page context appropriately.

### `AC-03-04`

- Given the shell exposes account actions
- When the user is on desktop or mobile/tablet
- Then the account trigger appears in the lower shell navigation area rather than in the content header.

### `AC-03-05`

- Given the desktop sidebar is collapsed to the rail
- When the user hovers or focuses into it
- Then the rail widens to full width and overlays the content (FLOAT) without shifting the content column
- And when the user instead clicks the collapse/expand toggle, the content column shifts (PUSH) and the new pinned state persists across reloads.

### `AC-03-06`

- Given an unauthenticated request to an `(app)` route
- When the server layout evaluates the session
- Then the request is redirected to sign-in before any shell content renders
- And a user whose verification is `blocked` is redirected to the verify-email gate instead.

### `AC-03-07`

- Given the user navigates the mobile drawer
- When the primary route list renders
- Then it shows Dashboard, Stores, Orders, and Deliveries (Settings is reached from the lower account menu).

## Screens and Data Contract

The shell is **persistent chrome, not a screen**: it wraps every authenticated route under `/{locale}/(app)/*`. It has no list/detail/wizard of its own, so this section documents (a) the shell frame's render-time contract and (b) the one placeholder route the shell ships itself (the dashboard). Workspace routes (`orders`, `deliveries`, `stores`, `settings`) own their own data contracts in their respective FRDs and render inside this frame. Visual layout is owned by the [FDD](fdd-03-collector-app-shell.md); this section fixes purpose, data loaded, components/state, and states.

### Shell frame — `/{locale}/(app)/layout.tsx` (server) + `AppLayout` (client)

- **Purpose:** the stable app frame (sidebar + header + content column) every authenticated route inherits.
- **Guard / data loaded (server):** `getSession()` (redirects to sign-in when absent); `getVerificationSnapshot(userId)` (drives the `blocked` redirect, the `grace` banner, and a day-six reminder side-effect); then in parallel `getAppShellUserIdentity(userId)` (username / name / avatar for the account trigger, with a session-name fallback), `getCollectorPreferencesSnapshot(userId)` + `listCountryCodes` + `listActiveStoreProductTypeKeys` (to compute the preference-aware `Stores` nav href via `buildStoresNavHref`), and the `auth.signOut` label.
- **Client state (`AppLayout`):** pinned sidebar `expanded` (persisted), transient `floatingOpen` (hover/focus), mobile `drawerOpen`, and a mutable `currentUser` exposed through `ShellIdentityContext` so settings/avatar changes update the chrome live. Wraps children in `ToastProvider` and `HeaderTitleProvider`.
- **States:** authenticated/verified → plain shell; `grace` → shell + sticky `VerifyEmailBanner` + `--app-banner-offset: 56px`; `blocked` → never rendered (redirected); unauthenticated → never rendered (redirected). A skip link (`#main-content`) precedes the sidebar.

### Dashboard placeholder — `/{locale}/dashboard`

- **Purpose:** the default private landing surface (`FR-03-02`); a placeholder until the dashboard feature is built (out of scope for the MVP — FDD §1).
- **Data loaded:** translations only (`dashboard`, `appLayout` namespaces) + page metadata via `buildPageMetadata`. No domain queries.
- **Actions:** navigation only — primary CTA → `/orders`, ghost CTA → `/stores` (both emit `app_shell_placeholder_cta_clicked`).
- **States:** static placeholder (`AppComingSoonCard`); no loading/empty/error of its own.

### Shell error boundary — `/{locale}/(app)/error.tsx`

- **Purpose:** catch render/runtime errors anywhere inside the authenticated shell.
- **Behavior:** client boundary; captures the error to Sentry once (`tags.area = "app_shell"`, `extra.digest`); renders an `EmptyState` (`appearance="page"`, `role="alert"`, destructive tone) with `Retry` (calls `reset()`) and `Go home` (→ dashboard).

### Shell 404 boundary — `/{locale}/(app)/not-found.tsx`

- **Purpose:** unknown authenticated path.
- **Behavior:** neutral `EmptyState` (no Sentry capture per ADR 0013), keeps the shell chrome, offers `Home` (→ dashboard) and `Orders` CTAs.

## State Model

The shell has no persisted domain entity. Its stateful surfaces are UI/session states.

### Sidebar display state (client)

| State             | Width                          | Pushes content?   | Persisted? | Trigger                                                       |
| ----------------- | ------------------------------ | ----------------- | ---------- | ------------------------------------------------------------- |
| Expanded (pinned) | `--sidebar-w-expanded` (15rem) | yes               | yes        | default; collapse/expand toggle                               |
| Collapsed (rail)  | `--sidebar-w-collapsed` (4rem) | yes (offset 4rem) | yes        | collapse/expand toggle                                        |
| Collapsed + FLOAT | `--sidebar-w-expanded` (15rem) | **no** (overlays) | no         | hover or focus into the collapsed rail; reverts on leave/blur |

`--sidebar-current-w` mirrors only the pinned state (`expanded ? expanded-w : collapsed-w`); FLOAT is local to the sidebar (`z-40` + shadow over `z-20`) and never written to `--sidebar-current-w`. The pinned choice persists in `localStorage["appShellSidebarExpanded"]`; toggling clears any open FLOAT. Below `1024px` the sidebar is hidden entirely and this state is inert.

### Mobile drawer state (client)

`drawerOpen` (boolean), `false` by default. The top-bar `[☰]` opens it; backdrop click, `Esc`, focus-scope dismissal, or selecting a nav row closes it. Focus is scoped while open (`useFocusScope`) and returned to the burger button on close. Hidden at `≥1024px`.

### Verification access state (server, render-time)

`VerificationAccessState ∈ { not_applicable, verified, grace, blocked }` from `getVerificationSnapshot`. Mapping to shell render:

| State            | Shell renders         | Banner | `--app-banner-offset` | Side effect                    |
| ---------------- | --------------------- | ------ | --------------------- | ------------------------------ |
| `not_applicable` | yes                   | no     | `0px`                 | none                           |
| `verified`       | yes                   | no     | `0px`                 | none                           |
| `grace`          | yes                   | yes    | `56px`                | day-six reminder (best-effort) |
| `blocked`        | no (redirect to gate) | —      | —                     | —                              |

## Error Contract

The shell performs no domain mutations, so it has no typed mutation error codes of its own; its "errors" are render/navigation outcomes:

- **Unauthenticated:** server `redirect` to `/{locale}/sign-in` (no error surfaced).
- **Verification `blocked`:** server `redirect` to the verify-email gate with a `returnTo` to the dashboard.
- **Unexpected render error inside the shell:** caught by `(app)/error.tsx`, captured once to Sentry (`area: "app_shell"`), recoverable via `Retry`/`Go home`. No duplicate noisy reporting.
- **Unknown path:** `(app)/not-found.tsx`, neutral, **not** captured to Sentry (ADR 0013).
- **Account sign-out:** delegated to `authClient.signOut`; on success routes to sign-in and refreshes (failures are owned by the auth client, not the shell).

The shell delegates all data-layer/typed errors to the workspace FRDs it frames.

## Analytics

Shell events live under `POSTHOG_EVENTS.APP_SHELL` in `src/lib/constants.ts`. Real event names:

- sidebar / nav: `app_shell_sidebar_toggled` (props: `state` collapsed/expanded, `viewport`, `route`), `app_shell_nav_clicked` (declarative `data-ph-event`; props: `destination`, `navigation_level: "primary"`, `viewport` on desktop, and `stores_href_kind` for the Stores row — `preference_filters` | `plain`).
- drawer: `app_shell_drawer_opened` (props: `viewport` mobile/tablet, `route`).
- account menu: `app_shell_account_menu_toggled` (props: `action` opened/closed, `surface` desktop/drawer, `route`), `app_shell_account_menu_item_clicked` (declarative; props: `destination` settings/sign-out/privacy/terms, `surface`).
- top-bar controls: `app_shell_theme_changed` (props: `route`), `app_shell_locale_changed` (props: `locale`, `route`).
- dashboard placeholder: `app_shell_placeholder_cta_clicked` (props: `source: "dashboard"`, `target` orders/stores).
- defined but currently unused by the shell: `app_shell_mascot_hidden`, `app_shell_mascot_shown` (the `MascotBubble` is no longer mounted — see "Removed during the redesign").

Sign-out additionally fires the auth-domain event `POSTHOG_EVENTS.AUTH.SIGNOUT` (the shell triggers it; the event is owned by the auth taxonomy, not `APP_SHELL`).

## Linked Blueprint

- `docs/product/prd-02-collector-app/frd-03-collector-app-shell/bp-01-collector-workspace-shell/bp-01-collector-workspace-shell.md`

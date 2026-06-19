---
id: BP-01
type: BLUEPRINT
slug: collector-workspace-shell
title: Collector Workspace Shell
status: ACTIVE
parent: FRD-03
children:
  - WO-01
  - WO-02
  - WO-03
last_updated: 2026-06-16
implementation_status: IMPLEMENTED
---

# BP-01 Collector Workspace Shell

## Purpose

Describe the client-side shell that wraps private collector routes and gives PandaTrack a stable navigation frame.

## Runtime Components

- `src/app/[locale]/(app)/layout.tsx` (server boundary: session + verification gating, identity/preference loading)
- `src/app/[locale]/(app)/_components/AppLayout/AppLayout.tsx` (client shell root; owns `--sidebar-current-w`, drawer state, `ShellIdentityContext`, `ToastProvider`, `HeaderTitleProvider`)
- `src/components/modules/Sidebar.tsx` (desktop sidebar; PUSH toggle + FLOAT hover/focus expand)
- `src/components/modules/Header.tsx` (top bar: burger + breadcrumb + presentational title + lang/theme — this is the header the shell mounts; `_components/AppLayout/ContentHeader.tsx` is a sibling variant)
- `src/app/[locale]/(app)/_components/AppLayout/AppNavDrawer.tsx` (mobile burger drawer; focus-scoped)
- `src/app/[locale]/(app)/_components/AppLayout/ShellAccountMenu.tsx` (lower-shell account trigger + menu, shared desktop/drawer)
- `src/app/[locale]/(app)/_components/AppLayout/navigationConfig.ts` (nav item set + active-route + curated entry-point hrefs)
- `src/app/[locale]/(app)/_utils/pageHeader.ts` (breadcrumb + title derivation)
- `src/app/[locale]/(app)/_components/AppLayout/HeaderTitleContext.tsx` + `SetHeaderTitle.tsx` (dynamic title / middle-crumb injection)
- `src/hooks/useSidebarState.ts` (pinned expand/collapse persistence)
- `src/hooks/useIsMobile.ts` (SSR-safe viewport hook)
- `src/app/[locale]/(app)/dashboard/page.tsx` + `_components/AppPlaceholderPage.tsx` + `AppComingSoonCard`
- `src/app/[locale]/(app)/error.tsx` + `not-found.tsx` (shell boundaries)
- locale copy in `src/i18n/locales/{es,en}/app-layout.json` (`appLayout.*`) and `dashboard.json`
- shell tests in `src/app/[locale]/(app)/_components/AppLayout/_tests/*` and `_utils/_tests/pageHeader.test.ts`

## Architecture Notes

- route protection is enforced at the server layout boundary before the shell renders; the same boundary runs the email-verification gate (`blocked` → redirect, `grace` → banner + offset)
- the app shell itself is a client component for interactive sidebar, hover-FLOAT, drawer, and live-identity state
- the manual collapse/expand toggle PUSHes the content (drives `--sidebar-current-w`); hover/focus-expand FLOATs (overlay, never persisted)
- the shell keeps the dashboard as the stable entry surface (a placeholder for the MVP) while later domains attach under it

## Linked Work Orders

- `docs/product/prd-02-collector-app/frd-03-collector-app-shell/bp-01-collector-workspace-shell/work-orders/wo-01-private-shell-and-responsive-navigation.md`
- `docs/product/prd-02-collector-app/frd-03-collector-app-shell/bp-01-collector-workspace-shell/work-orders/wo-02-route-aware-header-and-dashboard-entry.md`
- `docs/product/prd-02-collector-app/frd-03-collector-app-shell/bp-01-collector-workspace-shell/work-orders/wo-03-shell-observability-and-polish.md`

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
last_updated: 2026-03-21
implementation_status: IMPLEMENTED
---

# BP-01 Collector Workspace Shell

## Purpose

Describe the client-side shell that wraps private collector routes and gives PandaTrack a stable navigation frame.

## Runtime Components

- `src/app/[locale]/(app)/layout.tsx`
- `src/app/[locale]/(app)/_components/AppLayout/*`
- `src/app/[locale]/(app)/dashboard/page.tsx`
- locale copy in `src/i18n/locales/{es,en}/app-layout.json`
- shell tests in `src/app/[locale]/(app)/_components/AppLayout/_tests/*`

## Architecture Notes

- route protection is enforced at the server layout boundary before the shell renders
- the app shell itself is a client component for interactive sidebar and drawer state
- the shell keeps the dashboard as the stable entry surface while later domains attach under it

## Linked Work Orders

- `docs/product/prd-01-collector-mvp/frd-03-collector-app-shell/bp-01-collector-workspace-shell/work-orders/wo-01-private-shell-and-responsive-navigation.md`
- `docs/product/prd-01-collector-mvp/frd-03-collector-app-shell/bp-01-collector-workspace-shell/work-orders/wo-02-route-aware-header-and-dashboard-entry.md`
- `docs/product/prd-01-collector-mvp/frd-03-collector-app-shell/bp-01-collector-workspace-shell/work-orders/wo-03-shell-observability-and-polish.md`

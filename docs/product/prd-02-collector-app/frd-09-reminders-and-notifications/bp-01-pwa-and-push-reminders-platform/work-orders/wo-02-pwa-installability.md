---
id: WO-02
type: WORK_ORDER
slug: pwa-installability
title: PWA Installability
status: DRAFT
parent: BP-01
source_features: []
implementation_status: PLANNED
last_updated: 2026-07-13
---

# WO-02 PWA Installability

## Summary

Make the collector app installable as a PWA: a token-sourced web app manifest via the Next.js metadata route, a maskable PWA icon set generated from the existing app icon, the iOS/theme metadata on the locale layout, and a hand-rolled service worker registered on authenticated app load. This slice registers the worker only; it carries no push logic yet.

## Prerequisites

- [`WO-01`](wo-01-push-platform-foundation.md): shared plumbing (no direct dependency on push transport, but this slice lands on top of the foundation)

## In Scope

- web app manifest at `src/app/manifest.ts` (Next.js metadata route) declaring `name`, `short_name`, `start_url`, `scope`, `display: standalone`, and `theme_color` / `background_color` sourced from the design tokens (`FR-09-02`)
- PWA icon set at `192x192`, `512x512`, and a `512x512` maskable variant, generated from `src/app/icon.svg` and served from `public/` (`FR-09-03`)
- `appleWebApp` and `themeColor` metadata added to the locale layout at `src/app/[locale]/layout.tsx` so iOS installs render correctly (`FR-09-03`)
- hand-rolled plain-JavaScript service worker at `public/sw.js`, scaffolded with a versioned identifier and clean update behavior; in this slice it only takes control cleanly and must not cache domain data (`FR-09-05` handlers are added in WO-03)
- a client service-worker registration module invoked from the authenticated app shell, idempotent and fail-closed (a registration error is captured but never blocks the shell) (`FR-09-04`)
- PostHog install analytics where measurable: `pwa_install_prompt_shown` and `pwa_installed` (from the `appinstalled` event where the browser exposes it), namespaced under `POSTHOG_EVENTS.NOTIFICATIONS` in `src/lib/constants.ts`
- E2E coverage asserting the manifest is served and linked and that the service worker registers on an authenticated load
- unit coverage for the manifest builder (token-sourced colors, required fields present)

## Out of Scope

- `push` and `notificationclick` handlers in the service worker (WO-03)
- browser subscription, permission flow, and the settings Notifications section (WO-03)
- the dispatch route, cron, and reminders (WO-04)
- any offline data caching or background sync

## Requirements

- `FR-09-01`, `FR-09-02`, `FR-09-03`, `FR-09-04`
- installability contract from [`BP-01`](../bp-01-pwa-and-push-reminders-platform.md#contracts)

## Blueprints

- [`BP-01`](../bp-01-pwa-and-push-reminders-platform.md): installability contract, hand-rolled-worker decision, token-sourced manifest decision

## Analytics

- `pwa_install_prompt_shown`, `pwa_installed` under `POSTHOG_EVENTS.NOTIFICATIONS`, finalized per [`posthog-events`](../../../../../../.agents/rules/posthog-events.mdc). Install measurement is best-effort because not every browser exposes the prompt / `appinstalled` signals.

## Notes

- The service worker is hand-rolled per [ADR 0010](../../../../../design/decisions/0010-ui-primitive-libraries-policy.md) spirit; no `workbox` / `serwist` / `next-pwa`.
- Registration must fail closed: the app shell renders normally even if the worker fails to register (`FR-09-04`).
- The worker must be versioned so a later WO-03 update (adding push handlers) replaces it cleanly without serving stale behavior.
- Because iOS Safari requires an installed home-screen app before Web Push works, correct `appleWebApp` / manifest metadata here is a prerequisite for the WO-03 opt-in flow to function on iOS.

## E2E Acceptance Tests

- Loading the authenticated app serves a valid web app manifest that is linked from the document and declares `display: standalone` with token-sourced theme colors.
- The manifest exposes the `192`, `512`, and maskable `512` icons, and each icon asset resolves.
- On an authenticated load, the service worker registers successfully; a forced registration failure is handled without breaking the app shell.
- Install analytics fire where the browser exposes the corresponding signals.

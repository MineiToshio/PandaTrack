---
id: WO-02
type: WORK_ORDER
slug: pwa-installability
title: PWA Installability
status: ACTIVE
parent: BP-01
source_issue: 115
source_features: []
implementation_status: IMPLEMENTED
last_updated: 2026-07-14
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

## Assumptions

- `name` and `short_name` both use `APP_NAME` ("PandaTrack", `src/lib/constants.ts`) unchanged. `APP_NAME` is a brand constant, not localized copy, so this does not require an `src/i18n/locales/**` entry; there is no shorter product-approved short name today, and "PandaTrack" (10 characters) already fits within the practical `short_name` length browsers use for home-screen labels.
- `start_url` and `scope` are both `/`, matching `ROUTES.home` (`src/lib/constants.ts`) and the sitemap's home entry (`src/app/sitemap.ts`). The root route is the marketing landing surface; there is no separate "app entry" URL to prefer for MVP.
- The service-worker registration client component (`src/app/[locale]/(app)/_components/AppLayout/ServiceWorkerRegistration.tsx`) is mounted from `AppLayout.tsx` (`src/app/[locale]/(app)/_components/AppLayout/AppLayout.tsx`), which is already a `"use client"` component and is the single shared render root for every authenticated `(app)` route. This avoids adding a second client boundary and matches FR-09-04's requirement that registration happen "when an authenticated collector loads the app."
- Registration and install-analytics logic live in `src/lib/pwa/` (`registerServiceWorker.ts`, `installAnalytics.ts`) rather than inline in the component, so both are independently unit-testable and follow the "second file in a category promotes to a domain folder" rule in `.agents/rules/project-structure.mdc`.
- A Sentry capture on registration failure is a single `Sentry.captureException(error, { extra: { action: "registerServiceWorker" } })` call per attempt (module-level guard prevents repeats within a page session), matching the simple capture pattern already used in `src/app/[locale]/(app)/settings/_actions/profileActions.ts` rather than introducing a new `Sentry.withScope` wrapper. An unsupported browser (no `serviceWorker` in `navigator`) is treated as an expected, silent no-op and is never captured.

## Technical Notes

### Token values mirrored into the manifest

The Web App Manifest spec allows only one static string per color field, so `src/app/manifest.ts` mirrors the **light-mode** Velvet tokens from `src/app/globals.css` (documented in `docs/design/visual-foundations.md`):

- `theme_color` = `#5d33bd`, mirrored from light `--accent: oklch(46% 0.2 290)`.
- `background_color` = `#e6e6f5`, mirrored from light `--background: oklch(93% 0.02 285)`.

These are computed conversions (OKLCH to sRGB hex), not the flat `#7c3aed` brand purple already hardcoded in `src/app/apple-icon.tsx` and baked into `src/app/icon.svg`. FR-09-02 explicitly requires the manifest colors to come "from the design tokens rather than hardcoded hex duplicated from elsewhere", which rules out reusing that icon-tile color for `theme_color`/`background_color`.

Because the manifest cannot react to `prefers-color-scheme` or the app's own theme toggle, the locale layout's `viewport` export (`src/app/[locale]/layout.tsx`) separately declares a `themeColor` array with both light and dark `--accent` values (`#5d33bd` light, `#ac91ff` dark, the latter from `oklch(74% 0.19 290)`), keyed by `(prefers-color-scheme: light|dark)` media queries. This is the closest static approximation available for the mobile browser chrome color; it tracks OS appearance, not the collector's stored `localStorage` theme preference (there is no way for a static manifest or head meta tag to read that).

### PWA icon generation

`public/icons/icon-192.png` and `icon-512.png` are direct rasterizations of `src/app/icon.svg` (same rounded-square purple tile with transparent corners used by the favicon). `icon-512-maskable.png` renders the same source SVG at 62% of a 512x512 canvas, composited onto a solid `#7c3aed` background that fills the canvas edge to edge, so the "PT" mark stays within the maskable safe zone (the ~80%-diameter centered circle) regardless of which mask shape (circle, squircle, rounded square) the OS applies, and the surrounding solid color hides the seam from the source icon's own rounded corners. Generated with a one-off `sharp`-based Node script kept in the session scratchpad (not committed).

### Service-worker registration placement

Registration is invoked from `ServiceWorkerRegistration.tsx`, a small client component mounted once inside `AppLayout.tsx` (the shared shell for every route under `src/app/[locale]/(app)/`). This satisfies "registered when an authenticated collector loads the app" without adding a new client boundary. `src/lib/pwa/registerServiceWorker.ts` guards against duplicate calls with a module-level flag and fails closed: an unsupported browser is a silent no-op, and a registration error is caught, reported once to Sentry, and never rethrown, so the shell always renders.

### Install-event analytics caveats per browser

`beforeinstallprompt` and `appinstalled` are Chromium-specific (Chrome, Edge, Samsung Internet, other Chromium-based Android browsers). iOS Safari, desktop Safari, and Firefox never fire either event; a collector can still install PandaTrack there (Safari's native "Add to Home Screen" flow, for example), but `pwa_install_prompt_shown` and `pwa_installed` will simply never fire for that install, matching the FRD's "install analytics fire where the browser exposes the corresponding signals" acceptance criterion. This is best-effort observability, not a complete install funnel.

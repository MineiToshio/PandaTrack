---
id: BP-01
type: BLUEPRINT
slug: growth-and-observability-foundation
title: Growth and Observability Foundation
status: ACTIVE
parent: FRD-02
children:
  - WO-01
  - WO-02
last_updated: 2026-06-16
implementation_status: IMPLEMENTED
---

# BP-01 Growth and Observability Foundation

## Purpose

Describe the technical layer that captures public behavior through PostHog and unexpected failures through Sentry.

## Runtime Components

- `src/lib/constants.ts` — `POSTHOG_EVENTS` (111 events, 8 categories) and `FEATURE_FLAGS` (runtime PostHog flags)
- `src/lib/analytics/posthogDataAttributes.ts` — `getPosthogDataAttributes()` and `serializePosthogProps()` helpers
- `src/lib/analytics/posthog-server.ts` — `getPostHogClient()` singleton for server-side capture via `posthog-node`
- `src/instrumentation-client.ts` — PostHog browser init + delegated click delegate; Sentry client init + `onRouterTransitionStart`
- `src/instrumentation.ts` — Next.js `register()` hook; loads server/edge Sentry configs; exports `onRequestError`
- `sentry.server.config.ts` — Sentry init for Node.js runtime
- `sentry.edge.config.ts` — Sentry init for edge runtime
- `src/app/global-error.tsx` — root-layout error boundary (Sentry capture + self-contained fallback UI)
- `src/app/[locale]/(app)/error.tsx` — app-shell subtree error boundary (Sentry capture with `area: "app_shell"` tag)
- `next.config.ts` — PostHog ingest reverse proxy (`/ingest/*` rewrites) + Sentry webpack plugin (`withSentryConfig`)

## Architecture Notes

- Client capture is primarily declarative through `data-ph-event` and related helpers; a single delegated listener on `document` handles all clicks.
- Server capture is reserved for conversion outcomes and flows where the client cannot be trusted as the final source of truth (e.g., Server Actions for store mutations and auth flows).
- The PostHog ingest proxy routes browser events through the app domain (`/ingest`) to reduce ad-blocker interference.
- Monitoring stays non-blocking and avoids noisy duplicate reporting; each error boundary captures once.
- Session Replay is enabled at 10% session sampling and 100% error session sampling.

## Linked Work Orders

- `docs/product/prd-01-public-landing/frd-02-growth-and-observability-foundation/bp-01-growth-and-observability-foundation/work-orders/wo-01-public-analytics-foundation.md`
- `docs/product/prd-01-public-landing/frd-02-growth-and-observability-foundation/bp-01-growth-and-observability-foundation/work-orders/wo-02-runtime-monitoring-baseline.md`

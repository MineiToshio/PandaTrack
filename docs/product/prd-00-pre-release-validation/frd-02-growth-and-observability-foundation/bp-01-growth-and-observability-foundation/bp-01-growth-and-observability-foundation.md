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
last_updated: 2026-03-21
implementation_status: IMPLEMENTED
---

# BP-01 Growth and Observability Foundation

## Purpose

Describe the technical layer that captures public behavior through PostHog and unexpected failures through Sentry.

## Runtime Components

- Analytics constants in `src/lib/constants.ts`
- Client helpers in `src/lib/analytics/posthogDataAttributes.ts`
- Server analytics client in `src/lib/analytics/posthog-server.ts`
- Sentry instrumentation and runtime hooks

## Architecture Notes

- Client capture is primarily declarative through `data-ph-event` and related helpers.
- Server capture is reserved for conversion outcomes and flows where the client cannot be trusted as the final source of truth.
- Monitoring stays non-blocking and should avoid noisy duplicate reporting.

## Linked Work Orders

- `docs/product/prd-00-pre-release-validation/frd-02-growth-and-observability-foundation/bp-01-growth-and-observability-foundation/work-orders/wo-01-public-analytics-foundation.md`
- `docs/product/prd-00-pre-release-validation/frd-02-growth-and-observability-foundation/bp-01-growth-and-observability-foundation/work-orders/wo-02-runtime-monitoring-baseline.md`

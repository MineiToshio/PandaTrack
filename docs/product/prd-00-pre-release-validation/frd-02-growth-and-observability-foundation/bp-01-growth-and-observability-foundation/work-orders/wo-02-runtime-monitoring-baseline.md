---
id: WO-02
type: WORK_ORDER
slug: runtime-monitoring-baseline
title: Runtime Monitoring Baseline
status: ACTIVE
parent: BP-01
last_updated: 2026-06-16
source_features:
  - FEAT-0003
implementation_status: IMPLEMENTED
---

# WO-02 Runtime Monitoring Baseline

## Summary

Enable Sentry across all execution contexts (client, server, edge, global boundary) so unexpected errors are observable without blocking normal user paths.

## In Scope

- client Sentry init with Session Replay (`src/instrumentation-client.ts`)
- server Sentry init (`sentry.server.config.ts`) and edge Sentry init (`sentry.edge.config.ts`)
- `onRequestError` hook for automatic server/edge request error capture
- `onRouterTransitionStart` hook for client navigation traces
- `global-error.tsx` root-layout boundary
- `(app)/error.tsx` app-shell subtree boundary with `area: "app_shell"` tag
- Sentry webpack plugin (source map upload, debug-log tree shaking)

## Out of Scope

- operational alert routing
- incident triage workflow
- per-module Sentry context enrichment (owned by the individual feature FRDs)

## Requirements

- `FR-02-04`
- `FR-02-05`
- `FR-02-06`

## Blueprints

- `BP-01`

## E2E Acceptance Tests

- Controlled runtime errors are visible in Sentry capture paths
- Monitoring does not break normal page interaction

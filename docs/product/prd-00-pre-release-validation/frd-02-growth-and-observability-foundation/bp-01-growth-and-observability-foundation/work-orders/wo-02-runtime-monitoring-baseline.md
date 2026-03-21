---
id: WO-02
type: WORK_ORDER
slug: runtime-monitoring-baseline
title: Runtime Monitoring Baseline
status: ACTIVE
parent: BP-01
last_updated: 2026-03-21
source_features:
  - FEAT-0003
implementation_status: IMPLEMENTED
---

# WO-02 Runtime Monitoring Baseline

## Summary

Enable Sentry across the public app so unexpected client, server, edge, and global errors are observable.

## In Scope

- client/server/edge Sentry setup
- request error capture
- global error capture

## Out of Scope

- operational alert routing
- incident triage workflow

## Requirements

- `FR-02-04`
- `FR-02-05`
- `FR-02-06`

## Blueprints

- `BP-01`

## E2E Acceptance Tests

- Controlled runtime errors are visible in Sentry capture paths
- Monitoring does not break normal page interaction

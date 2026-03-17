---
id: WO-02
type: WORK_ORDER
slug: route-aware-header-and-dashboard-entry
title: Route-aware Header and Dashboard Entry
status: DONE
parent: BP-01
last_updated: 2026-03-16
source_features:
  - FEAT-0011
---

# WO-02 Route-aware Header and Dashboard Entry

## Summary

Make the dashboard the default private entry and support route-aware page context in the shell header.

## In Scope

- dashboard-first entry
- first-level titles
- nested-route contextual chrome

## Out of Scope

- global search
- domain-specific data widgets

## Requirements

- `FR-03-02`
- `FR-03-05`
- `BR-03-01`

## Blueprints

- `BP-01`

## E2E Acceptance Tests

- Dashboard opens as the collector landing route
- Header adapts between first-level and nested routes

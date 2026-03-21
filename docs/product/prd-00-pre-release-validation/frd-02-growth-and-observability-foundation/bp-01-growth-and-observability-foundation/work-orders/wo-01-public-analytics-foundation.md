---
id: WO-01
type: WORK_ORDER
slug: public-analytics-foundation
title: Public Analytics Foundation
status: ACTIVE
parent: BP-01
last_updated: 2026-03-21
source_features:
  - FEAT-0002
implementation_status: IMPLEMENTED
---

# WO-01 Public Analytics Foundation

## Summary

Establish the PostHog event model for landing interactions and waitlist outcomes.

## In Scope

- centralized event names
- CTA interaction tracking
- waitlist success/failure tracking
- server-side identify on successful waitlist submit

## Out of Scope

- advanced funnel dashboards
- private-app behavior analytics outside the foundation layer

## Requirements

- `FR-02-01`
- `FR-02-02`
- `FR-02-03`

## Blueprints

- `BP-01`

## E2E Acceptance Tests

- Landing CTA interactions emit the expected event contract
- Waitlist success and failure produce distinct analytics outcomes

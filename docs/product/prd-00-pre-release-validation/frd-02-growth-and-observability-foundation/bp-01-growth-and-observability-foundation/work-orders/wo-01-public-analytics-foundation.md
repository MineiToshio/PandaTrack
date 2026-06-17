---
id: WO-01
type: WORK_ORDER
slug: public-analytics-foundation
title: Public Analytics Foundation
status: ACTIVE
parent: BP-01
last_updated: 2026-06-16
source_features:
  - FEAT-0002
implementation_status: IMPLEMENTED
---

# WO-01 Public Analytics Foundation

## Summary

Establish the PostHog event model for landing interactions and sign-up conversion outcomes.

## In Scope

- centralized `POSTHOG_EVENTS` constants in `src/lib/constants.ts`
- CTA interaction tracking via declarative `data-ph-event` attributes
- sign-up and sign-in conversion tracking (`AUTH` category)
- server-side PostHog capture for auth flows and Server Actions

## Out of Scope

- advanced funnel dashboards
- private-app behavior analytics outside the foundation layer

## Requirements

- `FR-02-01`
- `FR-02-02` (superseded — waitlist removed 2026-06-15; sign-up conversion tracked via AUTH events)
- `FR-02-03` (superseded — user identification now via sign-up/sign-in flows)

## Blueprints

- `BP-01`

## E2E Acceptance Tests

- Landing CTA interactions emit the expected event contract
- Sign-up success and failure produce distinct analytics outcomes (`AUTH.SIGNUP_SUCCESS` / `AUTH.SIGNUP_FAILED`)

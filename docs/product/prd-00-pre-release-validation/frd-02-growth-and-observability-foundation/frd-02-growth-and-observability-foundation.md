---
id: FRD-02
type: FRD
slug: growth-and-observability-foundation
title: Growth and Observability Foundation
status: ACTIVE
parent: PRD-00
children:
  - BP-01
last_updated: 2026-03-16
source_features:
  - FEAT-0002
  - FEAT-0003
implementation_status: IMPLEMENTED
---

# FRD-02 Growth and Observability Foundation

## Overview

This FRD captures the public-phase instrumentation and runtime-observability baseline that made the landing measurable and debuggable.

It combines:

- PostHog analytics for meaningful public interactions
- Sentry runtime monitoring across client, server, edge, and global boundaries

## Functional Requirements

- `FR-02-01`: Public CTA and interaction events must be measurable through centralized PostHog event names.
- `FR-02-02`: Waitlist submit, success, and failure outcomes must be captured as analytics events.
- `FR-02-03`: Successful waitlist submits must identify the user by email for segmentation.
- `FR-02-04`: Runtime exceptions must be capturable in client, server, and edge execution contexts.
- `FR-02-05`: Global App Router errors must be captured through the product error boundary path.
- `FR-02-06`: Instrumentation must remain non-blocking for normal user interactions.

## Confirmed Implementation Signals

- `POSTHOG_EVENTS` constants exist and are reused by analytics helpers
- server-side PostHog capture supports waitlist and auth flows
- Sentry integration files and global error hooks exist in the app

## Acceptance Criteria

### `AC-02-01`

- Given a visitor interacts with key public CTAs
- When the interaction occurs
- Then the corresponding PostHog event is emitted through the shared naming model.

### `AC-02-02`

- Given a waitlist submission succeeds or fails
- When the server action completes
- Then analytics capture the correct outcome event.

### `AC-02-03`

- Given an unexpected runtime error occurs
- When the relevant boundary executes
- Then Sentry receives the exception without blocking the user path.

## Linked Blueprint

- `docs/product/prd-00-pre-release-validation/frd-02-growth-and-observability-foundation/bp-01-growth-and-observability-foundation/bp-01-growth-and-observability-foundation.md`

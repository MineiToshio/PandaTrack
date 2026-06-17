---
id: WO-02
type: WORK_ORDER
slug: waitlist-capture-and-share-state
title: Waitlist Capture and Share State
status: SUPERSEDED
parent: BP-01
last_updated: 2026-06-16
source_features:
  - FEAT-0001
  - type:slice ticket for mirrored waitlist capture work
  - type:slice ticket for mirrored post-submit share-state work
implementation_status: SUPERSEDED_BY_GO_LIVE
---

# WO-02 Waitlist Capture and Share State

> **SUPERSEDED — go-live transition (redesign S11, 2026-06-15).** This work order
> describes the waitlist capture feature that was **fully removed** at go-live. The
> waitlist form, server action (`submitWaitlist.ts`), validation schema
> (`waitlistSchema.ts`), success/share state, and external integrations
> (ConvertKit / Google Sheets) no longer exist in `src/`. Requirements `FR-01-02`
> through `FR-01-07` are no longer in effect. Retained for historical context only.

## Summary (historical)

Implement the waitlist form, validation, server submission, and post-success share state
for the pre-release flow.

## In Scope (historical)

- email validation
- optional name and comment
- server action integration
- success/share state
- locale-aware error handling

## Out of Scope (historical)

- full account signup
- private route creation

## Requirements (historical — no longer in effect)

- `FR-01-02` — superseded
- `FR-01-03` — superseded
- `FR-01-04` — superseded
- `FR-01-05` — superseded
- `FR-01-06` — superseded
- `FR-01-07` — superseded

## Blueprints

- `BP-01`

## E2E Acceptance Tests (historical — not applicable)

These tests were never shipped to `e2e/` for the pre-release flow; the existing
`e2e/landing.spec.ts` instead asserts the **absence** of the waitlist form
(`#waitlist-email` must have count 0).

- ~~Invalid email shows validation feedback~~
- ~~Valid submit reaches success state~~
- ~~Recoverable provider failure maps to generic error UI~~

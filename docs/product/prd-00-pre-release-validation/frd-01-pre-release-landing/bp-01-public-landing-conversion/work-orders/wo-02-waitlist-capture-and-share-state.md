---
id: WO-02
type: WORK_ORDER
slug: waitlist-capture-and-share-state
title: Waitlist Capture and Share State
status: DONE
parent: BP-01
last_updated: 2026-03-16
source_features:
  - FEAT-0001
  - type:slice ticket for mirrored waitlist capture work
  - type:slice ticket for mirrored post-submit share-state work
---

# WO-02 Waitlist Capture and Share State

## Summary

Implement the waitlist form, validation, server submission, and post-success share state for the pre-release flow.

## In Scope

- email validation
- optional name and comment
- server action integration
- success/share state
- locale-aware error handling

## Out of Scope

- full account signup
- private route creation

## Requirements

- `FR-01-02`
- `FR-01-03`
- `FR-01-04`
- `FR-01-05`
- `FR-01-06`
- `FR-01-07`

## Blueprints

- `BP-01`

## E2E Acceptance Tests

- Invalid email shows validation feedback
- Valid submit reaches success state
- Recoverable provider failure maps to generic error UI

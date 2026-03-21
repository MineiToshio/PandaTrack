---
id: WO-03
type: WORK_ORDER
slug: critical-e2e-workflow-baseline
title: Critical E2E Workflow Baseline
status: ACTIVE
parent: BP-01
last_updated: 2026-03-21
source_features:
  - FEAT-0010
implementation_status: IMPLEMENTED
---

# WO-03 Critical E2E Workflow Baseline

## Summary

Protect critical App Router flows through Playwright for landing, auth, and app-layout behavior.

## In Scope

- landing CTAs and waitlist path coverage
- auth redirect and recovery coverage
- app layout navigation baseline

## Out of Scope

- every future collector workflow

## Requirements

- `FR-02-04`
- `FR-02-05`
- `FR-02-06`

## Blueprints

- `BP-01`

## E2E Acceptance Tests

- `e2e/landing.spec.ts`, `e2e/auth.spec.ts`, and `e2e/app-layout.spec.ts` cover the intended critical browser paths

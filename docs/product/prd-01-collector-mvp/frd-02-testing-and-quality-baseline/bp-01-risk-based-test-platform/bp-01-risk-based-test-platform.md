---
id: BP-01
type: BLUEPRINT
slug: risk-based-test-platform
title: Risk-based Test Platform
status: ACTIVE
parent: FRD-02
children:
  - WO-01
  - WO-02
  - WO-03
last_updated: 2026-03-16
implementation_status: IMPLEMENTED
---

# BP-01 Risk-based Test Platform

## Purpose

Describe how PandaTrack chooses test types, organizes test files, and validates critical workflows.

## Runtime Components

- repository scripts for `npm run test` and `npm run test:e2e`
- colocated `_tests` folders
- `e2e/` domain-based specs
- strategy docs in `docs/development/testing.md`

## Architecture Notes

- tests are chosen by risk, not by blanket policy
- App Router limitations push critical route behavior toward Playwright
- tests stay close to the feature they protect

## Linked Work Orders

- `docs/product/prd-01-collector-mvp/frd-02-testing-and-quality-baseline/bp-01-risk-based-test-platform/work-orders/wo-01-testing-standards-and-tooling.md`
- `docs/product/prd-01-collector-mvp/frd-02-testing-and-quality-baseline/bp-01-risk-based-test-platform/work-orders/wo-02-landing-and-auth-baseline-coverage.md`
- `docs/product/prd-01-collector-mvp/frd-02-testing-and-quality-baseline/bp-01-risk-based-test-platform/work-orders/wo-03-critical-e2e-workflow-baseline.md`

---
id: WO-01
type: WORK_ORDER
slug: locale-routing-and-translation-baseline
title: Locale Routing and Translation Baseline
status: DONE
parent: BP-01
last_updated: 2026-03-16
source_features:
  - FEAT-0005
---

# WO-01 Locale Routing and Translation Baseline

## Summary

Establish route-level localization and translation loading for the public web.

## In Scope

- `es` default locale
- `en` alternate locale
- locale-aware copy loading
- locale-preserving links for public routes

## Out of Scope

- CMS-driven translations
- runtime translation editing

## Requirements

- `FR-03-01`
- `FR-03-02`

## Blueprints

- `BP-01`

## E2E Acceptance Tests

- `/` renders Spanish by default
- `/en` renders English content with correct navigation behavior

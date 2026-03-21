---
id: WO-01
type: WORK_ORDER
slug: private-shell-and-responsive-navigation
title: Private Shell and Responsive Navigation
status: ACTIVE
parent: BP-01
last_updated: 2026-03-21
source_features:
  - FEAT-0011
implementation_status: IMPLEMENTED
---

# WO-01 Private Shell and Responsive Navigation

## Summary

Build the private collector shell with desktop sidebar behavior and touch-friendly drawer navigation.

## In Scope

- desktop shell
- expanded and collapsed sidebar
- drawer navigation for touch devices

## Out of Scope

- business-domain implementations under the shell

## Requirements

- `FR-03-01`
- `FR-03-03`
- `FR-03-04`

## Blueprints

- `BP-01`

## E2E Acceptance Tests

- Signed-in private routes render inside the shell
- Mobile and tablet navigation uses the drawer pattern

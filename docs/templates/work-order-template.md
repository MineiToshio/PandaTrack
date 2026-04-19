---
id: WO-XX
type: WORK_ORDER
slug: descriptive-slug
title: Replace With Title
status: <DRAFT | ACTIVE | BLOCKED | SUPERSEDED>
parent: BP-XX
source_features: []
source_issue: <github-issue-number>
implementation_status: <PLANNED | IN_PROGRESS | PARTIALLY_IMPLEMENTED | IMPLEMENTED>
last_updated: YYYY-MM-DD
---

# WO-XX Replace With Title

`Work Orders` are the operational contract for implementation. Use them as the executable slice-level source for scope, requirements, and acceptance tests.

`source_issue` must be populated with the GitHub slice issue number as soon as the matching ticket is created. Leave it unset only while the Work Order exists in docs before its GitHub counterpart has been opened.

## Summary

Describe the exact slice of work this document covers and the implementation outcome it should produce.

## In Scope

List the concrete deliverables, behaviors, and surfaces this work order is responsible for.

## Out of Scope

List adjacent work that should not be included in this slice, even if it is related.

## Requirements

Reference the FRD requirements, business rules, and any slice-specific expectations this implementation must satisfy.

## Blueprints

Point to the relevant blueprint sections, technical boundaries, or extension points that govern this work.

## E2E Acceptance Tests

Describe the end-to-end scenarios that should pass when this work order is correctly implemented.

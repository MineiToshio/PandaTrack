---
id: WO-03
type: WORK_ORDER
slug: profile-basics-username-name-and-avatar
title: Profile Basics: Username, Name, and Avatar
status: DRAFT
parent: BP-04
source_features:
  - FEAT-0013
last_updated: 2026-04-03
implementation_status: PLANNED
---

# WO-03 Profile Basics: Username, Name, and Avatar

## Summary

Implement the `Profile` section of settings for username editing, display-name editing, and profile-image management using the agreed validation and upload patterns.

## In Scope

- username field with helper rules text
- inline format validation and availability state
- dedicated username save flow
- name editing
- profile-image display, hover affordance, replace/remove flow, and crop-confirm reuse
- profile-image persistence to `user-images`

## Out of Scope

- account email changes
- password changes or password setup
- country/currency/product-type preferences
- budget controls

## Requirements

- `FR-07-04` through `FR-07-12`
- `BR-07-02` through `BR-07-05`

## Blueprints

- `BP-04` username-edit contract
- `BP-04` avatar contract

## E2E Acceptance Tests

- User can update name successfully.
- Username field shows invalid-state feedback for malformed input.
- Username field shows taken-state feedback when another user already owns the same normalized value.
- User can upload, crop, save, replace, and remove a profile image using the shared image flow.

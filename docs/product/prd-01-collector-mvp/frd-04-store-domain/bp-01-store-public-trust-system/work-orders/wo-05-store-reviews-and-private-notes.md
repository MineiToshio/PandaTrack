---
id: WO-05
type: WORK_ORDER
slug: store-reviews-and-private-notes
title: Store Reviews and Private Notes
status: ACTIVE
parent: BP-01
source_issue: 74
last_updated: 2026-03-17
---

# WO-05 Store Reviews and Private Notes

## Summary

Add the first trust-and-memory layer around stores through public reviews and private store notes.

## In Scope

- create/edit one public review per user per store
- persisted `averageRating` and `reviewCount` updates
- private store notes for authenticated users
- review and note read/write boundaries
- on-demand review composer inside the public reviews section
- current user's review pinned first with inline edit entry point
- half-star `overallRating` input in `0.5` steps
- public review comments that preserve line breaks when displayed

## Out of Scope

- order-required review eligibility
- advanced trust formulas
- moderation tooling for abusive reviews

## Requirements

- `FR-01-24`: Users must be able to create or edit one public review per store.
- `FR-01-25`: Store-level aggregate trust fields must be persisted instead of recalculated on every read.
- `FR-01-26`: Users must be able to save private notes on stores.

Relevant acceptance signals:

- one-review-per-user rule is enforced
- aggregate values update on create and edit
- private notes remain user-scoped and never leak into public payloads
- review composer stays hidden until the user explicitly opens it
- the signed-in user's existing review renders first in the public list
- `overallRating` supports `0.5` increments
- public comments preserve intentional line breaks in read mode

## Blueprints

- `BP-01` extension points:
  - data model layer
  - query layer
  - server action layer
  - detail and authenticated UI entry points

## E2E Acceptance Tests

- User can create a first review for a store.
- User can edit their existing review instead of creating a second one.
- Aggregate rating/count update after review changes.
- User opens the review composer from the reviews section instead of seeing it expanded by default.
- User sees their own review first and can reopen the composer from its edit button.
- User can create and read a private note in authenticated context.
- Private note content never appears on public store detail.

## Status Note

Active. Review and private-note flows are now being implemented against the existing schema foundations.

---
id: WO-05
type: WORK_ORDER
slug: store-reviews-and-private-notes
title: Store Reviews and Private Notes
status: PLANNED
parent: BP-01
source_issue: 74
last_updated: 2026-03-16
---

# WO-05 Store Reviews and Private Notes

## Summary

Add the first trust-and-memory layer around stores through public reviews and private store notes.

## In Scope

- create/edit one public review per user per store
- persisted `averageRating` and `reviewCount` updates
- private store notes for authenticated users
- review and note read/write boundaries

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
- User can create and read a private note in authenticated context.
- Private note content never appears on public store detail.

## Status Note

Planned. Schema foundations exist, but product and technical execution are still pending.

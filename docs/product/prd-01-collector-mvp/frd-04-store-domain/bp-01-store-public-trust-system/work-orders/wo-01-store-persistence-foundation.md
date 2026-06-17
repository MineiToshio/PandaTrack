---
id: WO-01
type: WORK_ORDER
slug: store-persistence-foundation
title: Store Persistence Foundation
status: ACTIVE
parent: BP-01
source_issue: 69
last_updated: 2026-03-21
implementation_status: IMPLEMENTED
---

# WO-01 Store Persistence Foundation

## Summary

Establish the schema and persistence foundation required for the store domain so every later store flow depends on one consistent model.

## In Scope

- store core schema
- moderation and activity states
- presence, contacts, addresses, import countries, and product-type assignments
- future-facing trust/governance tables
- baseline store-linked order and delivery relations

## Out of Scope

- store creation UI
- public listing and detail UI
- logo upload
- review submission flow

## Requirements

- `FR-04-01`: The system must model stores as a first-class domain entity.
- `FR-04-02`: A store must support `BUSINESS` and `PERSON` types.
- `FR-04-03`: A store must support repeatable presence values `ONLINE` and `PHYSICAL`.
- `FR-04-04`: A store must support core identity fields including `name`, `slug`, `description`, `countryCode`, moderation state, and activity state.
- `FR-04-05`: A store must support related metadata for product types, import countries, contact channels, and addresses.

Relevant acceptance signals:

- schema validates
- relations and indexes reflect the intended domain
- baseline write paths can support downstream slices

## Blueprints

- `BP-01` runtime component coverage:
  - data model layer
  - query layer preparation

## E2E Acceptance Tests

No standalone E2E test is required for this work order because this slice is schema and persistence foundation work, not a complete user-facing flow.

## Status Note

Implemented and represented in the current Prisma schema.

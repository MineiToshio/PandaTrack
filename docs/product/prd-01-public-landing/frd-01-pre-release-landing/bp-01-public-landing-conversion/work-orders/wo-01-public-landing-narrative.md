---
id: WO-01
type: WORK_ORDER
slug: public-landing-narrative
title: Public Landing Narrative
status: SUPERSEDED
parent: BP-01
last_updated: 2026-06-16
source_features:
  - FEAT-0001
  - type:slice ticket for the mirrored landing narrative work
implementation_status: IMPLEMENTED
---

# WO-01 Public Landing Narrative

> **SUPERSEDED (go-live, S11).** The narrative sections were shipped and remain in
> production. The waitlist section this work order anticipated was removed at go-live;
> the hero primary CTA now navigates to `/sign-up` instead. Narrative sections
> (hero, user-fit, features, banner, FAQ, footer) are all implemented.

## Summary

Ship the public pre-release landing narrative so visitors can understand PandaTrack
before interacting with the waitlist.

## In Scope

- hero section
- user-fit/problem framing
- features grid
- banner CTA
- FAQs
- footer

## Out of Scope

- authenticated product entry
- dashboard or collector workflows

## Requirements

- `FR-01-01`
- `FR-01-08`

## Blueprints

- `BP-01`

## E2E Acceptance Tests

- Landing loads all core sections in `es` and `en` ✅ (shipped)
- Primary CTA navigates to `/sign-up` ✅ (verified in `e2e/landing.spec.ts`)

> _Original note "Primary CTA path reaches the waitlist section" is stale — the
> waitlist section was removed. CTA destination is now `/sign-up`._

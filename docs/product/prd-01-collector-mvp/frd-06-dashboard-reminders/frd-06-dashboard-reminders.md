---
id: FRD-06
type: FRD
slug: dashboard-reminders
title: Dashboard and Reminders
status: DRAFT
parent: PRD-01
children:
  - BP-03
last_updated: 2026-03-16
source_features:
  - FUTURE-DASHBOARD-ATTENTION
---

# FRD-06 Dashboard and Reminders

## Purpose

Define what information the PandaTrack dashboard and reminder system must surface for collectors in the MVP.

## Dashboard Goal

The dashboard is the main decision screen after sign-in. Its job is not to show everything. Its job is to tell the user what needs attention now.

## Core Questions

- How much do I need to pay this month and next month?
- What should already have arrived, and what is late?
- How much budget do I have left this month?
- How much have I spent this month and in previous months?
- How many products have I ordered, from which stores, and how have those stores performed for me?

## Functional Requirements

- `FR-06-01`: The dashboard must be the first private destination after sign-in.
- `FR-06-02`: The dashboard must summarize upcoming payment obligations.
- `FR-06-03`: The dashboard must summarize overdue or late-arrival situations.
- `FR-06-04`: The dashboard must show monthly budget remaining.
- `FR-06-05`: The dashboard must show current-month spend and historical monthly spend.
- `FR-06-06`: The dashboard must surface order volume signals by month.
- `FR-06-07`: The dashboard must connect order and store information so the user can evaluate store outcomes over time.
- `FR-06-08`: The dashboard must use the user's base currency for summary totals.
- `FR-06-09`: The product must support reminders inside the app.
- `FR-06-10`: The product must support reminders by email.
- `FR-06-11`: Reminder content must be derived from order, payment, shipment, and expected-arrival data.
- `FR-06-12`: Dashboard surfaces and reminder delivery should stay consistent in meaning.

## Reminder Categories

### Confirmed MVP reminder intents

- payment due soon
- item should already have arrived
- shipment requires follow-up
- order needs attention before the user forgets it

### Deferred

- push notifications
- WhatsApp notifications

## Open Questions

- exact reminder trigger thresholds are not yet defined
- exact email cadence is not yet defined
- it is not yet decided whether reminders appear as a feed, cards, badges, or a mixed model
- it is not yet decided whether historical dashboard analytics need filtering by store, month, or category in MVP

## Linked Blueprints

- `docs/product/prd-01-collector-mvp/frd-06-dashboard-reminders/bp-03-dashboard-attention-system/bp-03-dashboard-attention-system.md`

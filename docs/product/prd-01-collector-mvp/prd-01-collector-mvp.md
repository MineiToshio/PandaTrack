---
id: PRD-01
type: PRD
slug: collector-mvp
title: PandaTrack Collector MVP
status: ACTIVE
parent: null
children:
  - FRD-01
  - FRD-02
  - FRD-03
  - FRD-04
  - FRD-05
  - FRD-06
  - FRD-07
  - FRD-08
last_updated: 2026-04-04
---

# PRD-01 PandaTrack Collector MVP

## Purpose

Define the authenticated collector product that follows PandaTrack's pre-release validation phase.

This PRD covers:

- account access and recovery
- quality and testing foundations for AI-assisted delivery
- the private collector workspace shell
- the store trust domain
- the collector workflow domains for orders, payments, deliveries, reminders, and preferences

## Product Summary

PandaTrack helps collectors organize orders, payments, shipments, reminders, and store trust context in one place.

This PRD begins after the pre-release phase has already delivered a public landing, localization, SEO, legal pages, analytics, and observability.

The collector MVP is designed for collectors who buy across many channels, wait long periods for deliveries, manage partial payments, and need a dashboard that turns scattered information into clear decisions.

## Problem

Collectors often buy through Instagram, WhatsApp, websites, Facebook, and direct seller contact. Once the order is placed, the information becomes fragmented across chats, screenshots, invoices, emails, and memory.

This creates predictable problems:

- users lose visibility into what they ordered and from which store
- users forget what is fully paid vs partially paid
- users miss follow-ups on late or silent shipments
- users struggle to estimate upcoming spending
- users lack a trustworthy store layer when buying repeatedly from the same seller

## Product Goal

Deliver a collector-first system that makes it easy to:

- sign up, recover access, and safely enter the private workspace
- understand the product through a dashboard-first shell
- understand current order status
- understand payment obligations
- track shipments and partial deliveries
- evaluate stores before buying again
- receive timely reminders in-app and by email
- use one dashboard as the main decision surface

## Target Users

### Primary user

A collector who:

- buys from multiple stores and informal channels
- manages multiple active orders at once
- often deals with pre-orders, long waits, and partial payments
- wants reliable follow-up and clear budget visibility

### Secondary user

A collector with lower order volume who still wants:

- a trustworthy order history
- reminders for important follow-ups
- a clean summary of spending and deliveries

## Product Principles

- Collector-first, not generic ecommerce admin
- Clear status before advanced automation
- Budget awareness without accounting complexity
- Trust and memory in the same workflow
- Strong defaults, simple states, low ambiguity

## MVP Workflow Priority

1. Account access and protected collector entry
2. Dashboard-first collector workspace shell
3. Store discovery and trust signals
4. Order tracking
5. Payment tracking
6. Shipment tracking
7. Dashboard clarity
8. Reminders and alerts
9. User settings required to support the above

## Scope

### In scope

- Authenticated collector workspace
- Account access, verification lifecycle, and password recovery
- Risk-based testing baseline for critical workflows
- Dashboard-first private navigation
- Public store discovery and store trust layer
- Orders as the primary tracked transaction entity with line items, derived totals, and private notes
- Partial and complete payment tracking per order
- Delivery tracking as a store-scoped workflow that may group products from multiple orders
- Monthly budget and dashboard reporting
- In-app reminders and email reminders
- User settings for budget, preferred currency, and notification preferences
- User settings for account identity, profile management, preferred country and product types, budget defaults, and store-entry defaults

### Out of scope

- Full collection management
- Wishlist management
- Push notifications in MVP
- WhatsApp notifications in MVP
- Attachment management in MVP
- Dynamic metadata systems for stores
- Advanced finance and accounting features
- Full moderation backoffice for stores

## Core Product Entities

- `User`
- `Session`
- `Store`
- `Order`
- `OrderPayment`
- `Delivery`
- `OrderItem`
- `Reminder`
- `UserSettings`
- `Budget`

## Core User Flows

### Create or recover access

1. User signs up with email/password or Google.
2. User can return through sign-in or password recovery.
3. Email/password users complete a grace-based verification lifecycle.
4. Authenticated users enter the collector workspace through the dashboard.

### Discover and evaluate a store

1. User searches or browses stores.
2. User opens a store profile.
3. User reviews trust signals, moderation state, and public details.
4. User decides whether to use that store for future orders.

### Track a new order

1. User creates an order linked to a store.
2. User sets order currency, exchange-rate context when needed, key dates, and expected delivery window.
3. User adds items with quantity, optional unit price, and optional product type.
4. User records payment progress over time from the order detail view.

### Track delivery progress

1. User creates or updates a delivery for one store.
2. User links one or more eligible order items from that store to that delivery.
3. User updates delivery state until delivery or reopens it when corrections are needed.
4. User sees which orders are fully or partially delivered and which delivered orders still have pending payment.

### Use the dashboard

1. User opens the dashboard first after sign-in.
2. User sees upcoming payments, delayed arrivals, budget usage, and delivery signals.
3. User decides what to pay, follow up, or review next.

### Manage account settings

1. User opens the account menu from the app shell.
2. User can review their username, profile image, and account entry options.
3. User can update personal profile fields and account credentials according to the linked auth method.
4. User can define country, base currency, collected product types, and budget defaults.
5. The store listing can open with defaults aligned to the user's saved preferences when the user enters it from private shell navigation ([`FR-07-28`](frd-07-user-settings/frd-07-user-settings.md#functional-requirements); **FRD-07** · [BP-01](frd-07-user-settings/bp-01-user-settings-identity-and-preferences/bp-01-user-settings-identity-and-preferences.md) · [WO-06 _store-entry-defaults-from-user-preferences_](frd-07-user-settings/bp-01-user-settings-identity-and-preferences/work-orders/wo-06-store-entry-defaults-from-user-preferences.md)). Other surfaces that link to the same listing should follow the same URL rule once they exist ([FRD-06 cross-domain notes](frd-06-dashboard-reminders/frd-06-dashboard-reminders.md#cross-domain-notes)).

### Receive reminders

1. The system detects important events or risk conditions.
2. The user sees reminders in-app.
3. The user also receives email reminders for qualifying cases.

## Release-Level Success Criteria

- Users can create or recover access without support intervention.
- Private routes remain protected while public discovery routes stay public.
- Users understand where they are and what to do next from the collector shell.
- Users can track active orders without depending on memory or chat history.
- Users can distinguish order status from payment status clearly.
- Users can identify late or risk-prone shipments quickly.
- Users can see budget and upcoming payment pressure in their own base currency.
- Users can evaluate store trust before placing another order.
- Dashboard answers the highest-priority collector questions quickly.
- Users can identify themselves clearly inside the private shell and manage their account without support intervention.

## MVP Questions the Product Must Answer

- How much do I need to pay this month and next month?
- What should already have arrived, and what is late?
- How much budget do I have left this month?
- How much have I spent this month and in previous months?
- How many products have I ordered, from which stores, and how have those stores performed for me?

## Risks

- Multi-currency conversion introduces finance and reporting complexity.
- Reminder quality may define perceived product value more than raw CRUD coverage.
- Store quality and duplicate prevention directly affect trust in the whole system.
- Auth and route-protection regressions would block the whole collector workspace.
- A weak testing baseline would make AI-assisted delivery brittle as the product expands.
- Overdefining future domains too early could create brittle requirements.

## Linked FRDs

- `docs/product/prd-01-collector-mvp/frd-01-account-access-and-recovery/frd-01-account-access-and-recovery.md`
- `docs/product/prd-01-collector-mvp/frd-02-testing-and-quality-baseline/frd-02-testing-and-quality-baseline.md`
- `docs/product/prd-01-collector-mvp/frd-03-collector-app-shell/frd-03-collector-app-shell.md`
- `docs/product/prd-01-collector-mvp/frd-04-store-domain/frd-04-store-domain.md`
- `docs/product/prd-01-collector-mvp/frd-05-order-payment-shipment/frd-05-order-payment-shipment.md`
- `docs/product/prd-01-collector-mvp/frd-06-dashboard-reminders/frd-06-dashboard-reminders.md`
- `docs/product/prd-01-collector-mvp/frd-07-user-settings/frd-07-user-settings.md`
- `docs/product/prd-01-collector-mvp/frd-08-delivery-management/frd-08-delivery-management.md`

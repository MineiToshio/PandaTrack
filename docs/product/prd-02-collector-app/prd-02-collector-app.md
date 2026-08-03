---
id: PRD-02
type: PRD
slug: collector-app
title: PandaTrack Collector App
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
  - FRD-09
  - FRD-10
  - FRD-11
last_updated: 2026-07-28
---

# PRD-02 PandaTrack Collector App

## Purpose

Define PandaTrack's authenticated collector application — the private product surface that complements the public landing (PRD-01).

This is the durable identity of the app. Its current release is an MVP, but "MVP" is a maturity stage, not the product's name: the same PRD-02 will keep evolving into a more complete, robust product without changing its identity.

This PRD covers:

- account access and recovery
- quality and testing foundations for AI-assisted delivery
- the private collector workspace shell
- the store trust domain
- the collector workflow domains for orders, payments, deliveries, reminders, and preferences
- assisted order intake: creating an order from an image instead of retyping it ([`FRD-11`](frd-11-order-image-intake/frd-11-order-image-intake.md))

## Product Summary

PandaTrack helps collectors organize orders, payments, deliveries, reminders, and store trust context in one place.

It builds on the public landing surface (PRD-01), which already delivers the landing, localization, SEO, legal pages, analytics, and observability.

The collector app is designed for collectors who buy across many channels, wait long periods for deliveries, manage partial payments, and need a dashboard that turns scattered information into clear decisions.

## Problem

Collectors often buy through Instagram, WhatsApp, websites, Facebook, and direct seller contact. Once the order is placed, the information becomes fragmented across chats, screenshots, invoices, emails, and memory.

This creates predictable problems:

- users lose visibility into what they ordered and from which store
- users forget what is fully paid vs partially paid
- users miss follow-ups on late or silent deliveries
- users struggle to estimate upcoming spending
- users lack a trustworthy store layer when buying repeatedly from the same seller

## Product Goal

Deliver a collector-first system that makes it easy to:

- sign up, recover access, and safely enter the private workspace
- understand the product through a dashboard-first shell
- understand current order status
- understand payment obligations
- track deliveries and partial deliveries
- evaluate stores before buying again
- receive timely reminders as web push notifications from an installable app ([`FRD-09`](frd-09-reminders-and-notifications/frd-09-reminders-and-notifications.md))
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
6. Delivery tracking
7. Dashboard clarity ([`FRD-06`](frd-06-dashboard/frd-06-dashboard.md) is dashboard-only)
8. Reminders and alerts (delivered by [`FRD-09`](frd-09-reminders-and-notifications/frd-09-reminders-and-notifications.md) as an installable PWA with Web Push; this is why reminders are no longer bundled into the dashboard FRD)
9. User settings required to support the above
10. Assisted order intake from an image ([`FRD-11`](frd-11-order-image-intake/frd-11-order-image-intake.md)). It sits after the core workflow because it depends on the order, store, and settings domains already existing, and because it is an acceleration of order tracking rather than a new tracked concept.

## Scope

### In scope

- Authenticated collector workspace
- Account access, verification lifecycle, and password recovery
- Risk-based testing baseline for critical workflows
- Dashboard-first private navigation
- Public store discovery and store trust layer
- Orders as the primary tracked transaction entity with line items, derived totals, and private notes
- Assisted order intake from an image (a chat screenshot, a store email, a web page, a photo of a receipt), including the extraction engine, the unskippable "Revisa y confirma" review screen, the product breakdown rule with split and merge, the single creation selector with its floating action button, the OS-level "Compartir a Panda" share target, and the monthly photo quota with its spend guards ([`FRD-11`](frd-11-order-image-intake/frd-11-order-image-intake.md))
- Partial and complete payment tracking per order
- Delivery tracking as a store-scoped workflow that may group products from multiple orders
- Monthly budget and dashboard reporting
- Installable PWA experience and web push reminders for upcoming payments and arrivals ([`FRD-09`](frd-09-reminders-and-notifications/frd-09-reminders-and-notifications.md))
- Controlled failure experience: full 404 and error-surface coverage across all app surfaces ([`FRD-10`](frd-10-error-experience-hardening/frd-10-error-experience-hardening.md))
- User settings for budget, preferred currency, and notification preferences
- User settings for account identity, profile management, preferred country and product types, budget defaults, and store-entry defaults
- Minimal inline store moderation performed by administrators inside the collector app: approve a pending store, remove a store with a public tombstone, resolve a community report, apply or reject a community change request, and approve a suggested product type (`FRD-04`); the administrator role and the audit trail that records these actions are consumed from [PRD-03 · FRD-01](../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md)

### Out of scope

- Full collection management
- Wishlist management
- Email and SMS notifications (reminder delivery is Web Push only, per [`FRD-09`](frd-09-reminders-and-notifications/frd-09-reminders-and-notifications.md))
- WhatsApp notifications in MVP
- Attachment management in MVP
- Dynamic metadata systems for stores
- Advanced finance and accounting features
- Audio-note transcription, a Telegram or email capture inbox, and any WhatsApp API integration; these are named and excluded by [`FRD-11`](frd-11-order-image-intake/frd-11-order-image-intake.md)
- The full moderation backoffice and admin console (dedicated admin space, moderation inbox, audit log viewer, role and access platform); owned by [PRD-03 (Admin and Moderation)](../prd-03-admin-and-moderation/prd-03-admin-and-moderation.md)

## Core Product Entities

- `User` (extended with a moderation role consumed from [PRD-03 · FRD-01](../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md))
- `Session`
- `Store`
- `Order`
- `OrderPayment`
- `Delivery`
- `OrderItem`
- `Reminder`
- `UserSettings`
- `Budget`
- `ImageIntakeUsage` and `ImageIntakePeriod` (assisted intake consumption ledger and its per-period aggregate, [`FRD-11`](frd-11-order-image-intake/frd-11-order-image-intake.md))

## Relationship to PRD-03 (Admin and Moderation)

Store moderation is split across two PRDs by ownership, not by feature: [PRD-03](../prd-03-admin-and-moderation/prd-03-admin-and-moderation.md) owns the administrator role, the `/[locale]/admin` console, and the audit-log platform; PRD-02 (`FRD-04`) owns the store lifecycle transitions themselves and the inline moderation controls that trigger them inside the collector app. A single moderation outcome, such as approving a store, therefore spans both: the inline action lives here (PRD-02 · FRD-04), while the role that gates it and the audit entry it produces come from [PRD-03 · FRD-01](../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md). Sequencing crosses PRDs: PRD-03's role and audit foundation (PRD-03 · FRD-01) must land before this PRD's inline moderation actions can ship.

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

### Create an order from an image

1. User screenshots the chat, the store email, the web page, or photographs the paper receipt.
2. User either shares it straight into PandaTrack from the system share sheet, or opens the app and picks "Desde una imagen" in the creation selector.
3. The system extracts a draft (store, products, total, payments, delivery) and shows it on "Revisa y confirma", marking what it assumed and quoting the source phrase behind each product group.
4. User corrects what needs correcting and presses "Crear pedido". Nothing is written before that ([`FRD-11`](frd-11-order-image-intake/frd-11-order-image-intake.md)).

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
5. The store listing can open with defaults aligned to the user's saved preferences when the user enters it from private shell navigation ([`FR-07-28`](frd-07-user-settings/frd-07-user-settings.md#functional-requirements); **FRD-07** · [BP-01](frd-07-user-settings/bp-01-user-settings-identity-and-preferences/bp-01-user-settings-identity-and-preferences.md) · [WO-06 _store-entry-defaults-from-user-preferences_](frd-07-user-settings/bp-01-user-settings-identity-and-preferences/work-orders/wo-06-store-entry-defaults-from-user-preferences.md)). Other surfaces that link to the same listing should follow the same URL rule once they exist ([FRD-06 cross-domain notes](frd-06-dashboard/frd-06-dashboard.md#cross-domain-notes)).

### Receive reminders

1. The user installs the app as a PWA or enables notifications from settings.
2. The system detects upcoming payments and upcoming or overdue arrivals.
3. The user receives web push notifications that deep link back into the relevant order or delivery ([`FRD-09`](frd-09-reminders-and-notifications/frd-09-reminders-and-notifications.md)).

## Release-Level Success Criteria

- Users can create or recover access without support intervention.
- Private routes remain protected while public discovery routes stay public.
- Users understand where they are and what to do next from the collector shell.
- Users can track active orders without depending on memory or chat history.
- Users can distinguish order status from payment status clearly.
- Users can identify late or risk-prone deliveries quickly.
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
- Pending stores are publicly visible by design (to prevent duplicate creation), so removal speed and quality directly protect trust in the store layer.
- Assisted intake introduces the first external AI dependency and the first variable cost. A model that invents a value the user cannot detect would corrupt every total and dashboard signal, so the mandatory review screen and the spend guards in [`FRD-11`](frd-11-order-image-intake/frd-11-order-image-intake.md) are load-bearing, not polish.

## Linked FRDs

- `docs/product/prd-02-collector-app/frd-01-account-access-and-recovery/frd-01-account-access-and-recovery.md`
- `docs/product/prd-02-collector-app/frd-02-testing-and-quality-baseline/frd-02-testing-and-quality-baseline.md`
- `docs/product/prd-02-collector-app/frd-03-collector-app-shell/frd-03-collector-app-shell.md`
- `docs/product/prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md`
- `docs/product/prd-02-collector-app/frd-05-order-payment-shipment/frd-05-order-payment-shipment.md`
- `docs/product/prd-02-collector-app/frd-06-dashboard/frd-06-dashboard.md`
- `docs/product/prd-02-collector-app/frd-07-user-settings/frd-07-user-settings.md`
- `docs/product/prd-02-collector-app/frd-08-delivery-management/frd-08-delivery-management.md`
- `docs/product/prd-02-collector-app/frd-09-reminders-and-notifications/frd-09-reminders-and-notifications.md`
- `docs/product/prd-02-collector-app/frd-10-error-experience-hardening/frd-10-error-experience-hardening.md`
- `docs/product/prd-02-collector-app/frd-11-order-image-intake/frd-11-order-image-intake.md`

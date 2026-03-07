# Glossary

## Purpose

This glossary defines shared terms used across PandaTrack product and feature documentation.

## Product and domain terms

- **Collector**: A user who buys and tracks collectible items across multiple stores/channels.
- **Store**: A seller source (e.g., website, Instagram, WhatsApp contact) where purchases are made.
- **Trust Signal**: A reliability indicator for a store (reviews, feedback, response quality, delivery consistency).
- **Purchase**: A buying record linked to one store and one or more items.
- **Item**: A collectible unit within a purchase (e.g., one manga volume, one figure).
- **Pre-order**: A purchase made before item release or stock availability.
- **Deposit**: Partial upfront payment for a pre-order.
- **Remaining Balance**: Amount still owed after deposits/partial payments.
- **Shipment**: A delivery unit linked to a purchase; one purchase can have multiple shipments.
- **Split Shipment**: When items from one purchase are delivered in separate shipment batches.
- **Shipment Status**: Current delivery state (e.g., waiting, shipped, in transit, delivered, delayed).
- **Carrier**: Shipping provider used for a shipment.
- **Tracking Code**: Carrier identifier used to follow shipment progress.
- **Payment Outlook**: Monthly view of upcoming balances and expected payments.
- **Dashboard**: Summary view that answers status, shipment, and payment questions at a glance.

## Process and documentation terms

- **Epic Issue**: Single source issue for one feature (requirements, data contract, AC, tests, risks).
- **Slice Issue**: Sub-issue under an epic representing one implementation increment.
- **Acceptance Criteria (AC)**: Testable Given/When/Then conditions that define done behavior.
- **Definition of Done (DoD)**: Global quality and delivery checklist required before closing a feature.
- **ADR (Architecture Decision Record)**: Lightweight record of a technical decision, alternatives, and tradeoffs.
- **Prompt Pack**: Reusable prompts for implementation, review, bugfix, and test generation.
- **MVP**: Minimum viable release focused on core workflow value.
- **In scope / Out of scope**: Explicit boundary of what a feature/release includes or excludes.

## Engineering and platform terms

- **Server Component**: Next.js React component rendered on the server by default.
- **Client Boundary**: Component subtree marked with `"use client"` for interactivity/browser APIs.
- **Boundary Validation**: Input validation at system edges (forms, APIs, external payloads), typically with Zod.
- **Atomic Write**: Multi-step database write that must succeed/fail as one operation (transaction).
- **Observability**: Ability to monitor behavior via analytics, logs, and error tracking.
- **PostHog Event**: Analytics event used to track user interactions.
- **`POSTHOG_EVENTS`**: Central constants map for approved analytics event names.
- **Sentry Capture**: Error reporting for unexpected failures.
- **i18n**: Internationalization setup supporting localized copy (`es`, `en`).

## Status vocabulary (recommended)

- **Draft**: Document/feature is being prepared and not yet implementation-ready.
- **Ready**: Requirements are clear enough for implementation.
- **In Progress**: Feature is actively being implemented.
- **Review**: Feature is implemented and under validation/review.
- **Done**: Feature passed DoD and is ready to ship or already shipped.

## Naming note

Use these terms consistently in docs and GitHub issues to reduce ambiguity.

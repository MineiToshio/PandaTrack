---
id: FRD-06
type: FRD
slug: dashboard-reminders
title: Dashboard and Reminders
status: DRAFT
parent: PRD-01
children:
  - BP-01
last_updated: 2026-06-16
source_features:
  - FUTURE-DASHBOARD-ATTENTION
implementation_status: PLACEHOLDER
---

# FRD-06 Dashboard and Reminders

## Current State

**The dashboard is a placeholder.** The route `/{locale}/dashboard` is implemented and reachable after sign-in, but it renders a coming-soon card with two navigation CTAs instead of real data. None of the functional requirements below are implemented. All work orders under BP-01 are unstarted.

The placeholder provides:

- a page title and welcome subtitle (from the `dashboard` locale namespace) plus a hero eyebrow (from the `appLayout` namespace, `pageHero.eyebrow`)
- a coming-soon card (`AppComingSoonCard`) with two anchor buttons: **View my orders** (`/{locale}/orders`) and **Explore stores** (`/{locale}/stores`). The Stores CTA href is built with a hardcoded `` `/${locale}${ROUTES.stores}` ``, not the shared preference-driven helper — an existing inconsistency with the cross-domain note below, not only a prospective one.
- SEO metadata (`meta.title` / `meta.description`) via `buildPageMetadata`
- PostHog CTA tracking via `POSTHOG_EVENTS.APP_SHELL.PLACEHOLDER_CTA_CLICKED` (see Analytics section)

The FDD and interactive prototype for the planned dashboard are **not yet authored** (S15 produced FDDs for other UI-bearing FRDs; FRD-06 was deferred because it is a placeholder). Visuals, layout, and component breakdown will be defined when the feature moves to active implementation.

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
- `FR-06-13`: Dashboard rollups denominated in the user's **current** base currency must not silently merge historical orders using an exchange-rate snapshot that was recorded against a **different** base currency preference. Fidelity rules: show order and payment amounts in the **order currency** where needed; exclude non-reconciled affected orders from single-currency budget totals; and show a visible warning that totals are partial until reconciliation is completed.

## Reminder Categories

### Confirmed MVP reminder intents

- payment due soon
- item should already have arrived
- shipment requires follow-up
- order needs attention before the user forgets it

### Deferred

- push notifications
- WhatsApp notifications

## Screens and Data Contract

> The real data contract will be documented here when implementation begins. The section below describes ONLY what is currently live.

### `/{locale}/dashboard` — Placeholder page

- **Purpose**: holds the dashboard route slot and directs users to active sections while the feature is built.
- **Component**: `src/app/[locale]/(app)/dashboard/page.tsx` (Server Component)
- **Data loaded**: none. No queries are issued. Translations are loaded from the `dashboard` and `appLayout` namespaces via `getTranslations`. The `dashboard` namespace is backed by both locale files (`src/i18n/locales/es/dashboard.json` and `src/i18n/locales/en/dashboard.json`).
- **Server actions invoked**: none.
- **States**:
  - **Normal (only state)**: renders `AppPlaceholderPage` with hero (`eyebrow`, `title`, `welcome`) and `AppComingSoonCard` with two CTA buttons.
  - No loading, empty, error, or 404 states — the page is fully static.
- **Guards**: the route lives under `(app)/`, so it requires an authenticated session (enforced by the app shell middleware). No additional role or ownership guard.
- **SEO metadata**: generated via `buildPageMetadata` with `namespace: "dashboard"`, `pathSegment: "dashboard"`, keys `meta.title` and `meta.description`.

## Analytics

> Analytics for the real dashboard cards and reminders are not yet implemented. The following event is the only one currently in use on this route.

| Event constant                                     | Event string                          | Trigger                                                                                                                                           |
| -------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POSTHOG_EVENTS.APP_SHELL.PLACEHOLDER_CTA_CLICKED` | `"app_shell_placeholder_cta_clicked"` | User clicks either CTA on the placeholder card. Props: `{ source: "dashboard", target: "orders" }` or `{ source: "dashboard", target: "stores" }` |

## Open Questions

- exact reminder trigger thresholds are not yet defined
- exact email cadence is not yet defined
- it is not yet decided whether reminders appear as a feed, cards, badges, or a mixed model
- it is not yet decided whether historical dashboard analytics need filtering by store, month, or category in MVP
- FDD and prototype are not yet authored for this FRD; they will be created before implementation starts (per `frd-design-documentation.mdc`)

## Cross-domain notes

**Cross-FRD** means this FRD depends on a requirement, blueprint, or work order that **lives under another FRD**. Plain labels like `WO-06` or `BP-01` are not unique across the PRD, so the owning **FRD** and a **file link** are spelled out below.

- When the dashboard (or any other non-shell surface) adds a link or CTA to the **public store listing** (`/{locale}/stores`), that href **must** use the same **preference-driven URL construction** as the private shell `Stores` nav item. Source of truth: requirement [`FR-07-28`](../frd-07-user-settings/frd-07-user-settings.md#functional-requirements) in **FRD-07**, with implementation detail in [**FRD-07 · BP-01**](../frd-07-user-settings/bp-01-user-settings-identity-and-preferences/bp-01-user-settings-identity-and-preferences.md) and [**FRD-07 · WO-06** _store-entry-defaults-from-user-preferences_](../frd-07-user-settings/bp-01-user-settings-identity-and-preferences/work-orders/wo-06-store-entry-defaults-from-user-preferences.md). Implementations should call the **shared helper** introduced for shell navigation rather than hardcoding a bare `/stores` path, so collectors see consistent defaults everywhere.

## Linked Blueprints

- `docs/product/prd-01-collector-mvp/frd-06-dashboard-reminders/bp-01-dashboard-attention-system/bp-01-dashboard-attention-system.md`

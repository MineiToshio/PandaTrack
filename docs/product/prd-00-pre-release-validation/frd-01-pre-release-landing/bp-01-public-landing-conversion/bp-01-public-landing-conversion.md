---
id: BP-01
type: BLUEPRINT
slug: public-landing-conversion
title: Public Landing Conversion
status: ACTIVE
parent: FRD-01
children:
  - WO-01
  - WO-02
last_updated: 2026-03-16
implementation_status: IMPLEMENTED
---

# BP-01 Public Landing Conversion

## Purpose

Describe how PandaTrack's pre-release public landing converts visitors into waitlist submissions through a localized narrative page, a server-backed waitlist form, and a success/share state.

## Runtime Components

- Landing route composition in `src/app/[locale]/(landing)/page.tsx`
- Marketing sections under `src/app/[locale]/(landing)/_components/*`
- Waitlist client UI in `Waitlist.tsx`, `WaitlistForm.tsx`, and `WaitlistShare.tsx`
- Server action in `submitWaitlist.ts`
- Validation schema in `waitlistSchema.ts`
- Locale copy in `src/i18n/locales/{es,en}/landing.json`

## Contracts

- Input contract:
  - `email` required
  - `name` optional
  - `comment` optional
  - `locale` best-effort hidden context
- Output contract:
  - success
  - field-level validation error
  - generic submit error

## Architecture Notes

- Rendering is server-first for the page shell and content.
- The form owns the interactive state transitions for loading, error, success, and share behavior.
- Submission logic is isolated in the server action so external integrations stay out of the visual components.

## Risks

- Waitlist integrations must not leak secrets or provider details to the client.
- Validation and UX messaging must stay aligned across locales.

## Linked Work Orders

- `docs/product/prd-00-pre-release-validation/frd-01-pre-release-landing/bp-01-public-landing-conversion/work-orders/wo-01-public-landing-narrative.md`
- `docs/product/prd-00-pre-release-validation/frd-01-pre-release-landing/bp-01-public-landing-conversion/work-orders/wo-02-waitlist-capture-and-share-state.md`

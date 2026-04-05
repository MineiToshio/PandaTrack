---

## id: WO-01
type: WORK_ORDER
slug: user-settings-data-foundation
title: User Settings Data Foundation
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0013
last_updated: 2026-04-04
implementation_status: PLANNED

# WO-01 User Settings Data Foundation

## Summary

Create the persistence, validation, and shared domain contracts required for usernames, account preferences, budget defaults, and later user-settings slices.

This slice is the implementation foundation for `WO-02` through `WO-06`. It must leave the settings domain implementation-ready without introducing the final settings UI.

## In Scope

- username field and uniqueness strategy
- reserved-username and blocked-token contract
- normalized username generation rules for new accounts
- user preference persistence for country, base currency, preferred product types, and budget defaults
- single-budget MVP model stored on `User`
- shared query/action boundaries for downstream settings slices
- provider-aware settings capability model inputs derived from auth accounts at runtime
- effective-avatar persistence rules for provider images and later user-managed uploads
- observability and validation coverage for the shared settings domain

## Out of Scope

- shell UI
- settings page presentation
- avatar upload UI
- actual email-change UI or password forms
- store navigation URL wiring

## Requirements

- `FR-07-03` through `FR-07-07`
- `FR-07-20` through `FR-07-26`
- `FR-07-32`
- `FR-07-33`
- `FR-07-34`
- `BR-07-03` through `BR-07-05`
- `BR-07-18`

## Blueprints

- `BP-01` architecture decisions for username identity, budget extensibility, and URL-canonical preference consumption

## Assumptions

- User settings remain optional until the collector explicitly saves them in the settings page.
- The app must not infer or prefill country, currency, product-type preferences, or budget values from locale, geolocation, or onboarding in MVP.
- Existing accounts without the new required fields may be removed before rollout rather than backfilled by this slice.
- The Google profile image may remain the initial avatar URL stored in `User.image` until the collector uploads a replacement.

## Technical Notes

- The persistence model for MVP keeps username, collector preferences, and the single active budget on the `User` record.
- Persist a timestamp (or equivalent) used to enforce **username** change rate limiting (`BR-07-18`, `FR-07-33`) with the same seven-day window semantics as email-change limiting.
- Persist preferred product types as a **many-to-many** relation between `User` and `StoreProductType` (junction table), not as duplicated free-text catalog entries.
- Budget amount is a **positive integer** in **whole units** of the user's base currency (no fractional subunits), with a high upper bound enforced in validation.
- Budget reset uses a **nullable day-of-month** field (`1` through `31`): `null` means reset on the **last calendar day** of each month; when the chosen day does not exist in a month, reset on that month's last day (`FR-07-26`).
- Budget period and reset evaluation should use the user's stored timezone when present; fallback to `UTC` when timezone is missing (`FR-07-34`).
- Expose a **curated currency code list** derived from the seeded `Country` catalog (one primary currency per seeded country code); expanding `COUNTRY_CODES` in `prisma/seed.ts` implies revisiting the currency list.
- The implementation must still keep naming, validation, and query boundaries coherent enough that a future migration to a dedicated budget table remains straightforward.
- Username generation must happen in the server-side account-creation flow so every newly created account leaves signup with a persisted valid username.
- The generated username strategy must:
  - normalize the email local part into the allowed character set
  - append a short random suffix
  - retry on collisions
  - use a safe fallback when normalization alone cannot produce a valid candidate
- Username uniqueness must be enforced using a normalized case-insensitive value, even if the stored display value preserves the user's chosen casing.
- Reserved names and blocked tokens must be maintained in code/config for MVP rather than in a database-managed moderation surface.
- The provider-aware account capability model for later settings slices must be derived at runtime from the authenticated user's `Account` records and Better Auth posture, not persisted as duplicated boolean flags on `User`.
- `User.image` is the effective avatar URL in MVP:
  - for Google-created accounts, it may initially point to the provider-hosted image URL
  - after a manual avatar replacement, it must point to the Cloudflare R2 asset URL instead
- This slice should define shared query and validation modules that later settings work orders can consume instead of re-implementing auth/account posture checks or collector-preference parsing in UI code.

## Security Notes

- Username validation must reject invalid format, leading/trailing hyphens, consecutive hyphens, and unsupported characters before persistence.
- Reserved names such as platform/system identities must never be claimable.
- Blocked-token filtering must operate on normalized explicit tokens and avoid broad substring false positives.
- Username uniqueness checks must remain race-safe at persistence time and not rely only on client-side availability feedback.
- Only authenticated user context may read or mutate user-settings persistence for this domain.

## Observability Notes

- Capture unexpected failures in username generation, collision exhaustion, and settings persistence with Sentry.
- Log or instrument meaningful domain events only at the slices that perform user-facing saves; this foundation slice should define the technical seams needed for later analytics rather than emit placeholder events without user actions.

## Dependencies

- Better Auth signup and account-linking flow in `src/lib/auth/auth.ts`
- existing authenticated-session access in `src/lib/auth/auth-server.ts`
- seeded `Country` catalog
- seeded `StoreProductType` catalog
- shared image-processing/storage pattern already used for store logos, which later avatar-upload slices should reuse conceptually

## Testing Notes

- Add unit or integration coverage for username normalization and candidate generation.
- Prove that reserved names, blocked tokens, malformed usernames, and case-only collisions are rejected.
- Prove that successful account creation persists a valid username.
- Prove that optional settings fields can remain empty initially without breaking the settings domain contract.
- Prove that country, base currency, preferred product types, budget amount as a **positive integer in whole currency units only**, and budget reset rule persist and re-read correctly.
- Prove that a reset day beyond the number of days in a month resolves to the last day of that month.
- Prove that provider-aware account capabilities can be derived correctly from runtime auth/account state for later settings slices.

## E2E Acceptance Tests

- New account creation results in a valid unique username.
- Invalid or reserved usernames cannot be persisted.
- A username collision that differs only by case is rejected.
- Country, currency, preferred product types, budget amount, and budget reset rule can be persisted and re-read correctly.
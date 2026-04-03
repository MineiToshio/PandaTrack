---
id: FRD-07
type: FRD
slug: user-settings
title: User Settings and Account Preferences
status: ACTIVE
parent: PRD-01
children:
  - BP-01
last_updated: 2026-04-03
source_features:
  - FEAT-0013
implementation_status: PLANNED
---

# FRD-07 User Settings and Account Preferences

## Overview

This FRD defines the self-service settings layer for the PandaTrack collector workspace.

It covers:

- identity visibility inside the private shell
- profile basics such as username, name, and image
- account entry controls such as password setup/change and email-change rules
- collector preferences such as country, base currency, product types, and budget defaults
- the preference contract that can later drive store discovery defaults and other personalization

## Domain Goal

Give every authenticated collector one clear place to manage their account identity and the minimum preferences needed for a personalized MVP workflow.

## Current State

### Implemented

- private collector shell with `Settings` navigation entry
- app-shell header and drawer sign-out controls
- Better Auth account foundation with email/password and Google
- current user model fields for `name`, `email`, `emailVerified`, and `image`
- current verification banner and seven-day blocking lifecycle
- seeded country and store product-type catalogs that can be reused by settings

### Planned

- app-shell identity surface showing avatar plus username
- dedicated settings page with `Profile` and `Preferences` sections
- unique username generation and editing
- profile image management backed by Cloudflare R2
- account email/password management rules by provider type
- user country, currency, preferred product types, and budget settings
- store-entry defaults derived from saved user preferences

## User Stories

### US-07-01 Recognize myself in the app

As a collector, I want to see my avatar and username in the private shell so I always know which account I am using.

### US-07-02 Manage my identity safely

As a collector, I want to update my username, name, photo, password, and in some cases my email so I can keep my account current without support.

### US-07-03 Set preferences once and reuse them

As a collector, I want to save my country, preferred currency, collected product types, and budget defaults so the app can align to how I buy.

### US-07-04 Keep auth-method rules consistent

As a product owner, I want settings behavior to respect whether a user signed up with credentials, Google, or both so identity handling stays predictable.

## Functional Requirements

- `FR-07-01`: The private collector shell must show the authenticated user's avatar and username instead of a plain sign-out label in both desktop and mobile navigation surfaces.
- `FR-07-02`: The user menu opened from the shell identity surface must expose exactly `Settings` and `Sign out` in MVP.
- `FR-07-03`: Every user account must have a stored username.
- `FR-07-04`: Usernames must be unique across the platform using case-insensitive comparison.
- `FR-07-05`: Usernames must allow only letters, numbers, and single hyphen separators, must reject spaces, must reject leading and trailing hyphens, and must reject consecutive hyphens.
- `FR-07-06`: Usernames must be between 3 and 30 characters inclusive.
- `FR-07-07`: The system must auto-generate a valid default username for newly created accounts using the email local part plus a random suffix, with a safe fallback when normalization cannot satisfy the format rules.
- `FR-07-08`: The settings page must let the user edit username through a dedicated save flow with inline format validation, availability feedback, and uniqueness enforcement before persistence.
- `FR-07-09`: The settings page must let the user edit their display name as a single free-form field.
- `FR-07-10`: The settings page must let the user upload, replace, and remove a profile image using the same crop-and-confirm interaction pattern already used for store logos.
- `FR-07-11`: Profile images uploaded by the user must be stored in Cloudflare R2 under the `user-images` namespace and keyed to the user identity so later uploads replace the current asset.
- `FR-07-12`: When a user has no profile image, avatar fallbacks must use the username initial.
- `FR-07-13`: Accounts created with email/password must be able to change their email address through a dedicated flow that includes a confirmation modal.
- `FR-07-14`: After a successful email change for an email/password account, the new email becomes the credential-login identifier.
- `FR-07-15`: Changing the email for an email/password account must restart the current verification lifecycle, including the existing verification banner, resend action, and seven-day block.
- `FR-07-16`: Accounts created with Google must not be allowed to change email inside PandaTrack in MVP.
- `FR-07-17`: Accounts created with Google must be able to set a password while keeping the same email.
- `FR-07-18`: Accounts that have both Google and credential access must follow the Google email rule in MVP and therefore must not be allowed to change email inside PandaTrack.
- `FR-07-19`: The settings page must let each user define one base currency.
- `FR-07-20`: The settings page must let each user define one preferred country.
- `FR-07-21`: The settings page must let each user define multiple preferred product types using the seeded store product-type catalog.
- `FR-07-22`: The user-facing copy for preferred product types must ask `What types of products do you collect?`
- `FR-07-23`: The settings page must let each user define one active budget amount in the same currency as the base currency.
- `FR-07-24`: The settings page must let each user choose whether the budget resets at month end or on one specific day of the month.
- `FR-07-25`: When the configured reset day does not exist in a given month, the system must use the last day of that month.
- `FR-07-26`: The persistence and architecture for budget settings must be prepared to support multiple budgets later even though MVP exposes only one active budget.
- `FR-07-27`: Entering the `Stores` listing from the private app navigation must prefill the listing URL with the user's saved country and preferred product-type filters.
- `FR-07-28`: Direct navigation to `/{locale}/stores` without query params, or with user-supplied query params, must continue to honor the URL as the canonical listing input.

## Business Rules

- `BR-07-01`: The settings route remains one page in MVP and must expose `Profile` and `Preferences` as sections on the same page rather than separate routes or tabs.
- `BR-07-02`: The shell identity surface uses username as the primary human-facing account identifier rather than email.
- `BR-07-03`: Username uniqueness is case-insensitive even though the stored display form preserves the user's chosen casing.
- `BR-07-04`: Reserved usernames such as `admin`, `support`, `pandatrack`, `team`, `help`, `root`, and `system` must never be claimable.
- `BR-07-05`: Offensive-term filtering for usernames must avoid substring false positives and should only reject explicit blocked tokens according to the configured normalization rules.
- `BR-07-06`: The account email-change flow is intentionally stricter than normal field editing and must never be bundled into a generic profile-form save action.
- `BR-07-07`: Google-provider trust continues to count as verified identity for email-verification purposes.
- `BR-07-08`: MVP does not expose a settings toggle for email delivery preferences; PandaTrack may continue to send product emails by default while provider-side unsubscribe handles opt-out.
- `BR-07-09`: Preferred product types in user settings are collector-interest inputs, not a replacement for the store product-type catalog or store moderation rules.

## Acceptance Criteria

### `AC-07-01`

- Given an authenticated user opens the private app shell
- When the shell header or mobile drawer renders
- Then the shell shows avatar plus username
- And the opened user menu shows `Settings` and `Sign out`

### `AC-07-02`

- Given a new user account is created through email/password or Google
- When account creation completes
- Then the user already has a valid unique username

### `AC-07-03`

- Given the user edits their username in settings
- When the candidate format is invalid or already taken
- Then the UI shows inline feedback and the username is not saved

### `AC-07-04`

- Given an email/password user changes their email
- When they confirm the modal and the new email is accepted
- Then the login email changes to the new value
- And the current verification banner lifecycle restarts

### `AC-07-05`

- Given a Google-only user opens settings
- When they review account controls
- Then they may set a password
- But they may not change their email in MVP

### `AC-07-06`

- Given a user saves country and preferred product types in settings
- When they open `Stores` from the private navigation
- Then the listing route opens with matching query-string filters derived from those preferences

## Implementation Notes

- Private shell entry: `src/app/[locale]/(app)/layout.tsx`
- Shell UI: `src/app/[locale]/(app)/_components/AppLayout/*`
- Auth server/client: `src/lib/auth/auth.ts`, `src/lib/auth/auth-server.ts`, `src/lib/auth/auth-client.ts`
- Current user model: `prisma/schema.prisma` `User`
- Store product-type and country catalogs already exist and should be reused rather than duplicated
- The image-upload UX should reuse the store-logo crop and optimization pattern instead of introducing a second bespoke image pipeline
- Username checks should combine fast client-side format validation with server-enforced uniqueness on save

## Confirmed

- FRD-07 extends the existing user-settings scope rather than creating a new FRD
- MVP uses one blueprint for this domain
- `/settings` stays one page with `Profile` and `Preferences` sections
- No onboarding is required immediately after sign-up in MVP
- Budget currency equals base currency in MVP
- Username is the primary shell identity surface and a future profile handle foundation

## Open Questions

- whether a dedicated profanity library should replace a local blocked-token list once the profile domain expands
- whether future social/profile visibility should expose usernames publicly without a separate privacy setting
- whether later post-MVP account-provider management should support unlinking Google or adding more providers

## Out of Scope

- public user profile pages
- follower/friend/social graph features
- multi-email account support
- multiple active budgets in MVP
- provider unlink flows in MVP
- in-product email notification opt-out controls in MVP

## Linked Blueprints

- `docs/product/prd-01-collector-mvp/frd-07-user-settings/bp-01-user-settings-identity-and-preferences/bp-01-user-settings-identity-and-preferences.md`

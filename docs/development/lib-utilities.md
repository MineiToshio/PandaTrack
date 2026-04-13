# `src/lib` Utilities Index

This file is the source of truth for shared app-level utilities in `src/lib/`.

## Purpose

- Help developers quickly find the right utility file.
- Keep responsibilities clear (what belongs in each file).
- Reduce duplicated helper logic.

## Organization rules

- Use domain folders inside `src/lib/` when there are at least two files that belong to the same concern.
- Current grouped concerns are `src/lib/auth/`, `src/lib/analytics/`, `src/lib/catalog/`, `src/lib/integrations/`, `src/lib/store/`, and `src/lib/user-settings/`.
- Keep a file in the `src/lib/` root only when it is cross-domain or does not have a close sibling category yet.

## Inventory

| File                                                      | Purpose                                                                                                                                                                                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/a11y/focusable.ts`                               | Focusable-element query selector and focus options shared by modal overlays (skip `aria-hidden` and `tabindex="-1"` nodes).                                                                                                                |
| `src/lib/a11y/useFocusScope.ts`                           | Client hook: Escape to close, Tab focus trap, and focus restoration for dialogs and drawers.                                                                                                                                               |
| `src/lib/analytics/posthog-server.ts`                     | Server-side PostHog client helpers.                                                                                                                                                                                                        |
| `src/lib/analytics/posthogDataAttributes.ts`              | Declarative PostHog data-attribute helpers for clickable UI.                                                                                                                                                                               |
| `src/lib/app-url.ts`                                      | Resolve app base URL by environment (local vs Vercel).                                                                                                                                                                                     |
| `src/lib/auth/auth-client.ts`                             | Better Auth browser client helpers.                                                                                                                                                                                                        |
| `src/lib/auth/auth-server.ts`                             | Server-side session retrieval helper.                                                                                                                                                                                                      |
| `src/lib/auth/auth.ts`                                    | Better Auth server configuration (providers, verification hooks).                                                                                                                                                                          |
| `src/lib/auth/authPasswordRecovery.ts`                    | Password recovery request/throttle helpers.                                                                                                                                                                                                |
| `src/lib/auth/authRedirect.ts`                            | Safe auth callback/return URL resolution and auth links.                                                                                                                                                                                   |
| `src/lib/auth/authVerification.ts`                        | Verification lifecycle state helpers (grace/block/reminder).                                                                                                                                                                               |
| `src/lib/auth/authVerificationEmail.ts`                   | Auth verification email business logic (locale resolution, i18n content selection, template composition inputs).                                                                                                                           |
| `src/lib/auth/accountCapabilities.ts`                     | Derives settings account capabilities (email change, password change, set password) from linked Better Auth provider ids.                                                                                                                  |
| `src/lib/auth/usernameChangeCooldown.ts`                  | Seven-day cooldown helpers for successful username changes (`User.usernameChangedAt`).                                                                                                                                                     |
| `src/lib/auth/emailChangeRateLimit.ts`                    | Server-side cooldown for successful email-change requests (7-day window, persisted via `verification` rows).                                                                                                                               |
| `src/lib/auth/authEmailChangeSecurityEmail.ts`            | Localized transactional email sent to the previous address after Better Auth accepts an email change (informational only).                                                                                                                 |
| `src/lib/catalog/collectorCountries.ts`                   | Seeded collector-market `COUNTRY_CODES`, `COUNTRY_FLAG_EMOJI_BY_CODE` / `getCollectorCountryFlagEmoji`, primary ISO 4217 currency per country, and allowlist helpers for settings validation.                                              |
| `src/lib/catalog/storeProductTypes.ts`                    | Shared seeded `STORE_PRODUCT_TYPE_KEYS` catalog and allowlist helper for store/product-type validation across seed and user settings.                                                                                                      |
| `src/lib/constants.ts`                                    | Shared app constants (routes, analytics events, contact info, Cloudflare asset routes, collector shell layout classnames `APP_SHELL_*`).                                                                                                   |
| `src/lib/fonts.ts`                                        | Font loading and font config helpers.                                                                                                                                                                                                      |
| `src/lib/integrations/GoogleAppsScript.ts`                | Google Apps Script integration for waitlist persistence.                                                                                                                                                                                   |
| `src/lib/integrations/kit.ts`                             | Kit.com API integration (subscriber/tag operations). Syncs authenticated users with `app_user` tag (non-blocking).                                                                                                                         |
| `src/lib/integrations/resend.ts`                          | Generic Resend email utility (provider sending plus reusable transactional email HTML template). Supports optional `bodyHtml` for styled inline links; `buildTransactionalMailtoLink` uses the same accent as verification fallback links. |
| `src/lib/og.ts`                                           | OG image helpers and localized OG text helpers.                                                                                                                                                                                            |
| `src/lib/prisma.ts`                                       | Prisma client singleton and adapter setup.                                                                                                                                                                                                 |
| `src/lib/seo.ts`                                          | SEO metadata and canonical URL helpers.                                                                                                                                                                                                    |
| `src/lib/store/duplicateMatch.ts`                         | Store name normalization and similarity scoring for duplicate-matching (used by store creation flow). See [Store duplicate detection](store-duplicate-detection.md) for the full blur and submit flow.                                     |
| `src/lib/store/logo.ts`                                   | Store-logo validation, crop-area parsing, output sizing, and WebP processing helpers shared by the create and edit flows.                                                                                                                  |
| `src/lib/store/logoShared.ts`                             | Client-safe store-logo constants (max source size in bytes and MB for UI), schemas, and crop types shared across forms and server actions.                                                                                                 |
| `src/lib/store/logoStorage.ts`                            | S3-compatible object storage helper for uploading and deleting processed store logos.                                                                                                                                                      |
| `src/lib/store/slug.ts`                                   | Store slug generation: slugify name + 6-char shortId for stable, collision-resistant slugs.                                                                                                                                                |
| `src/lib/strings/foldSearchText.ts`                       | Case- and diacritic-insensitive fold for search inputs (e.g. autocomplete substring and Enter resolution).                                                                                                                                 |
| `src/lib/styles.ts`                                       | Shared class merging (`cn`), gradient bundles (`TINTED_SURFACE_GRADIENT_STOPS`, `TINTED_SURFACE_GRADIENT_TOP_WASH`), and collector shell surfaces (`COLLECTOR_PRIMARY_SECTION_CLASSNAME`, `COLLECTOR_MUTED_INSET_CLASSNAME`).              |
| `src/lib/user-settings/budgetCalendar.ts`                 | Budget reset calendar-day resolution (last day of month, clamping).                                                                                                                                                                        |
| `src/lib/user-settings/collectorPreferencesValidation.ts` | Zod parsing for optional collector preference patches (country, currency, budget, timezone, product type keys).                                                                                                                            |
| `src/lib/user-settings/usernameConstants.ts`              | Shared username and budget numeric limits for validation and generation.                                                                                                                                                                   |
| `src/lib/user-settings/usernameGeneration.ts`             | Signup username generation with collision retries against the canonical lowercase `username` field.                                                                                                                                        |
| `src/lib/user-settings/usernameRules.ts`                  | Username format, reserved names, blocked segment rules, and canonical lowercase normalization.                                                                                                                                             |

## Related query modules

These live under `src/queries/` but pair directly with `src/lib/user-settings` contracts:

| File                          | Purpose                                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/queries/userSettings.ts` | Loads collector preference snapshots and applies validated patches (scalar `User` fields plus `user_preferred_product_type` links). |

## Test fixtures

| File                             | Purpose                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `src/test/createTestUserData.ts` | Builds `User` create payloads with valid unique usernames for integration tests. |

## Maintenance rule

Update this file whenever a file in `src/lib/` is added, removed, renamed, or its responsibility changes.

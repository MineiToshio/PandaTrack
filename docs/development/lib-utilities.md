# `src/lib` Utilities Index

This file is the source of truth for shared app-level utilities in `src/lib/`.

## Purpose

- Help developers quickly find the right utility file.
- Keep responsibilities clear (what belongs in each file).
- Reduce duplicated helper logic.

## Inventory

| File                               | Purpose                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/lib/GoogleAppsScript.ts`      | Google Apps Script integration for waitlist persistence.                                                           |
| `src/lib/app-url.ts`               | Resolve app base URL by environment (local vs Vercel).                                                             |
| `src/lib/auth-client.ts`           | Better Auth browser client helpers.                                                                                |
| `src/lib/auth-server.ts`           | Server-side session retrieval helper.                                                                              |
| `src/lib/auth.ts`                  | Better Auth server configuration (providers, verification hooks).                                                  |
| `src/lib/authRedirect.ts`          | Safe auth callback/return URL resolution and auth links.                                                           |
| `src/lib/authVerification.ts`      | Verification lifecycle state helpers (grace/block/reminder).                                                       |
| `src/lib/authVerificationEmail.ts` | Auth verification email business logic (locale resolution, i18n content selection, template composition inputs).   |
| `src/lib/constants.ts`             | Shared app constants (routes, analytics events, contact info).                                                     |
| `src/lib/fonts.ts`                 | Font loading and font config helpers.                                                                              |
| `src/lib/kit.ts`                   | Kit.com API integration (subscriber/tag operations). Syncs authenticated users with `app_user` tag (non-blocking). |
| `src/lib/og.ts`                    | OG image helpers and localized OG text helpers.                                                                    |
| `src/lib/posthog-server.ts`        | Server-side PostHog client helpers.                                                                                |
| `src/lib/posthogDataAttributes.ts` | Declarative PostHog data-attribute helpers for clickable UI.                                                       |
| `src/lib/prisma.ts`                | Prisma client singleton and adapter setup.                                                                         |
| `src/lib/resend.ts`                | Generic Resend email utility (provider sending plus reusable transactional email HTML template).                   |
| `src/lib/seo.ts`                   | SEO metadata and canonical URL helpers.                                                                            |
| `src/lib/styles.ts`                | Shared class merging utilities (`cn`) and style helpers.                                                           |

## Maintenance rule

Update this file whenever a file in `src/lib/` is added, removed, renamed, or its responsibility changes.

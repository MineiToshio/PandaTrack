# `src/lib` Utilities Index

This file is the source of truth for shared app-level utilities in `src/lib/`.

## Purpose

- Help developers quickly find the right utility file.
- Keep responsibilities clear (what belongs in each file).
- Reduce duplicated helper logic.

## Organization rules

- Use domain folders inside `src/lib/` when there are at least two files that belong to the same concern.
- Current grouped concerns are `src/lib/auth/`, `src/lib/analytics/`, and `src/lib/integrations/`.
- Keep a file in the `src/lib/` root only when it is cross-domain or does not have a close sibling category yet.

## Inventory

| File                                         | Purpose                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/lib/analytics/posthog-server.ts`        | Server-side PostHog client helpers.                                                                                |
| `src/lib/analytics/posthogDataAttributes.ts` | Declarative PostHog data-attribute helpers for clickable UI.                                                       |
| `src/lib/app-url.ts`                         | Resolve app base URL by environment (local vs Vercel).                                                             |
| `src/lib/auth/auth-client.ts`                | Better Auth browser client helpers.                                                                                |
| `src/lib/auth/auth-server.ts`                | Server-side session retrieval helper.                                                                              |
| `src/lib/auth/auth.ts`                       | Better Auth server configuration (providers, verification hooks).                                                  |
| `src/lib/auth/authPasswordRecovery.ts`       | Password recovery request/throttle helpers.                                                                        |
| `src/lib/auth/authRedirect.ts`               | Safe auth callback/return URL resolution and auth links.                                                           |
| `src/lib/auth/authVerification.ts`           | Verification lifecycle state helpers (grace/block/reminder).                                                       |
| `src/lib/auth/authVerificationEmail.ts`      | Auth verification email business logic (locale resolution, i18n content selection, template composition inputs).   |
| `src/lib/constants.ts`                       | Shared app constants (routes, analytics events, contact info).                                                     |
| `src/lib/fonts.ts`                           | Font loading and font config helpers.                                                                              |
| `src/lib/integrations/GoogleAppsScript.ts`   | Google Apps Script integration for waitlist persistence.                                                           |
| `src/lib/integrations/kit.ts`                | Kit.com API integration (subscriber/tag operations). Syncs authenticated users with `app_user` tag (non-blocking). |
| `src/lib/integrations/resend.ts`             | Generic Resend email utility (provider sending plus reusable transactional email HTML template).                   |
| `src/lib/og.ts`                              | OG image helpers and localized OG text helpers.                                                                    |
| `src/lib/prisma.ts`                          | Prisma client singleton and adapter setup.                                                                         |
| `src/lib/seo.ts`                             | SEO metadata and canonical URL helpers.                                                                            |
| `src/lib/styles.ts`                          | Shared class merging utilities (`cn`) and style helpers.                                                           |

## Maintenance rule

Update this file whenever a file in `src/lib/` is added, removed, renamed, or its responsibility changes.

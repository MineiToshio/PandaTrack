# Authentication (Better Auth) – FEAT-0008

## Overview

PandaTrack uses [Better Auth](https://better-auth.com/) (self-hosted) with Prisma and Neon Postgres. This doc covers the foundation setup for the first auth implementation increment: config, session, and signout.

## Environment variables

Set these for local and production:

| Variable                           | Required           | Description                                                                                                    |
| ---------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`               | Yes                | Secret used to sign cookies and tokens. Generate with `npx auth@latest secret`. Must be 32+ chars.             |
| `DATABASE_URL`                     | Yes                | PostgreSQL connection string (Neon). Already used by Prisma.                                                   |
| `BETTER_AUTH_GOOGLE_CLIENT_ID`     | For Google sign-in | Google OAuth 2.0 client ID from Google Cloud Console.                                                          |
| `BETTER_AUTH_GOOGLE_CLIENT_SECRET` | For Google sign-in | Google OAuth 2.0 client secret.                                                                                |
| `RESEND_API_KEY`                   | For auth emails    | Resend API key used to send verification and password reset emails.                                            |
| `RESEND_FROM_EMAIL`                | For auth emails    | Verified sender address in Resend (for example `hello@your-domain.com`). Sender name is fixed to `PandaTrack`. |

## Google OAuth: redirect URIs per environment

The Google `redirect_uri` is always `<base>/api/auth/callback/google`, where `<base>` is Better Auth's `baseURL` = `getPublicSiteUrl()` (`src/lib/app-url.ts`). Resolution order: `NEXT_PUBLIC_SITE_URL` if set, otherwise `getAppBaseUrl()` (`NEXT_PUBLIC_APP_URL` → `https://${VERCEL_URL}` → `http://localhost:3000`). So the emitted redirect URI is driven by `NEXT_PUBLIC_SITE_URL` in each environment.

| Environment              | `NEXT_PUBLIC_SITE_URL`                 | Redirect URI to register in Google Cloud                  |
| ------------------------ | -------------------------------------- | --------------------------------------------------------- |
| Production               | `https://pandatrack.app`               | `https://pandatrack.app/api/auth/callback/google`         |
| Staging (Vercel Preview) | `https://staging.pandatrack.app`       | `https://staging.pandatrack.app/api/auth/callback/google` |
| Local dev (port 7100)    | `http://localhost:7100` (`.env.local`) | `http://localhost:7100/api/auth/callback/google`          |

All of these are registered on the `PandaTrack Web` OAuth client (Google Cloud project `pandatrack-489522`). Add the matching **Authorized JavaScript origin** (the base, without the callback path) for each one as well.

> Do not switch Better Auth's `baseURL` to `getAppBaseUrl()`. On Vercel that resolves to `${VERCEL_URL}` (a `*.vercel.app` host), so production would emit a `*.vercel.app` redirect URI instead of `pandatrack.app`. `getPublicSiteUrl()` keeps prod/staging on their custom domains.

### Local dev gotcha

`.env` sets `NEXT_PUBLIC_SITE_URL=https://pandatrack.app`. Because `getPublicSiteUrl()` checks `NEXT_PUBLIC_SITE_URL` **before** `NEXT_PUBLIC_APP_URL`, running the dev server on `http://localhost:7100` still emits a `redirect_uri` pointing at the production domain — so "Sign in with Google" locally redirects back to production instead of your local session. Fix: set `NEXT_PUBLIC_SITE_URL=http://localhost:7100` in `.env.local` (gitignored). Next.js hot-reloads `.env.local` in dev, so no restart is needed.

### Consent screen and verification

The OAuth consent screen is **published (In production)**, User type **External**, and requests only the non-sensitive scopes `openid email profile`. With no custom logo, ≤10 authorized domains, and no sensitive/restricted scopes, Google does **not** require app verification: any Google user can sign in, there is no "unverified app" screen, and the 100-user cap does not apply. Uploading a logo or adding sensitive/restricted scopes later would trigger Google's verification review.

## Server-side session

- **Get current session**: use `getSession()` from `@/lib/auth/auth-server` in Server Components, Server Actions, or Route Handlers. It reads the session from request cookies.
- **Sign out**: signout is handled by the Better Auth API. The client calls the sign-out endpoint (e.g. via the auth client in a later slice). Invoking the API invalidates the session and clears the cookie.

## Key files

- `src/lib/auth/auth.ts` – Better Auth config (database adapter, plugins, email/password, account linking, Google profile mapping).
- `src/lib/auth/authPasswordRecovery.ts` – password reset delivery handling, locale resolution, analytics, and provider failure mapping.
- `src/lib/auth/authPasswordResetEmail.ts` – localized password reset email copy and HTML generation.
- `src/app/[locale]/(auth)/reset-password/page.tsx` – localized reset-password route that handles valid-token, invalid-token, and success states.
- `src/lib/app-url.ts` – `getAppBaseUrl()` for auth base URL (local vs Vercel).
- `src/lib/auth/auth-server.ts` – Server-only helpers (e.g. `getSession()`).
- `src/app/api/auth/[...all]/route.ts` – Catch-all route for Better Auth (sign-in, sign-up, sign-out, get-session, etc.).

## Password reset delivery

- Better Auth issues password reset tokens through `requestPasswordReset` and PandaTrack sets `emailAndPassword.resetPasswordTokenExpiresIn` to `3600` seconds (60 minutes).
- The forgot-password form sends a localized `redirectTo` path so the email link can return the user to the app reset route after Better Auth validates the token.
- The reset-password route consumes the `token`/`error` query params from Better Auth and keeps recovery UI localized for valid, invalid, and already-used links.
- Transactional reset emails are sent through Resend with localized copy from `src/i18n/locales/{locale}/auth.json`.
- Resend delivery failures are surfaced back to the forgot-password UI as a retry-later message and captured for Sentry/PostHog without leaking whether the email exists.

## Account linking and profile hydration

When a user signs in with Google using an email that already has an email/password account, Better Auth links the Google account to the same user (no duplicate account). Configuration in `src/lib/auth/auth.ts`:

- **Account linking**: `account.accountLinking.enabled: true` with `trustedProviders: ["google"]`. When the provider confirms the email, sign-in with Google attaches the new account to the existing user.
- **Update on link**: `updateUserInfoOnLink: true` so that when an account is linked, name and image from the provider can update the user record.
- **Profile from Google**: `socialProviders.google.mapProfileToUser` maps `name` (from `profile.name`, `given_name`/`family_name`, or email prefix) and `image` (from `profile.picture`) so that new Google sign-ups and linked accounts get profile data stored.

Result: a single user identity can sign in with both email/password and Google; no duplicate user is created for the same email.

## Database

Auth tables (`user`, `session`, `account`, `verification`) are defined in `prisma/schema.prisma`. Apply with:

```bash
npx prisma db push
# or
npx prisma migrate dev --name add-auth-tables
```

Then run `npx prisma generate` if the client is not yet generated.

## Schema generation (optional)

To regenerate the Prisma auth models from the Better Auth CLI (overwrites existing auth models in `schema.prisma`):

```bash
npx auth@latest generate
```

Confirm overwrite when prompted. Keep the existing `generator` and `datasource` blocks; the CLI updates the model definitions.

# Authentication (Better Auth) – FEAT-0008

## Overview

PandaTrack uses [Better Auth](https://better-auth.com/) (self-hosted) with Prisma and Neon Postgres. This doc covers the foundation setup from Slice 1: config, session, and signout.

## Environment variables

Set these for local and production:

| Variable                           | Required               | Description                                                                                                    |
| ---------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`               | Yes                    | Secret used to sign cookies and tokens. Generate with `npx auth@latest secret`. Must be 32+ chars.             |
| `DATABASE_URL`                     | Yes                    | PostgreSQL connection string (Neon). Already used by Prisma.                                                   |
| `BETTER_AUTH_GOOGLE_CLIENT_ID`     | For Google sign-in     | Google OAuth 2.0 client ID from Google Cloud Console.                                                          |
| `BETTER_AUTH_GOOGLE_CLIENT_SECRET` | For Google sign-in     | Google OAuth 2.0 client secret.                                                                                |
| `RESEND_API_KEY`                   | For email verification | Resend API key used to send verification emails.                                                               |
| `RESEND_FROM_EMAIL`                | For email verification | Verified sender address in Resend (for example `hello@your-domain.com`). Sender name is fixed to `PandaTrack`. |

For Google OAuth, configure the authorized redirect URI in Google Cloud Console:

- Local: `http://localhost:3000/api/auth/callback/google`
- Production: `https://<your-domain>/api/auth/callback/google`

The auth base URL is not configured via env: it is inferred by `getAppBaseUrl()` in `src/lib/app-url.ts` (local: `http://localhost:3000`, Vercel: `https://${VERCEL_URL}`).

## Server-side session

- **Get current session**: use `getSession()` from `@/lib/auth-server` in Server Components, Server Actions, or Route Handlers. It reads the session from request cookies.
- **Sign out**: signout is handled by the Better Auth API. The client calls the sign-out endpoint (e.g. via the auth client in a later slice). Invoking the API invalidates the session and clears the cookie.

## Key files

- `src/lib/auth.ts` – Better Auth config (database adapter, plugins, email/password, account linking, Google profile mapping).
- `src/lib/app-url.ts` – `getAppBaseUrl()` for auth base URL (local vs Vercel).
- `src/lib/auth-server.ts` – Server-only helpers (e.g. `getSession()`).
- `src/app/api/auth/[...all]/route.ts` – Catch-all route for Better Auth (sign-in, sign-up, sign-out, get-session, etc.).

## Account linking and profile hydration

When a user signs in with Google using an email that already has an email/password account, Better Auth links the Google account to the same user (no duplicate account). Configuration in `src/lib/auth.ts`:

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

# Authentication (Better Auth) – FEAT-0008

## Overview

PandaTrack uses [Better Auth](https://better-auth.com/) (self-hosted) with Prisma and Neon Postgres. This doc covers the foundation setup from Slice 1: config, session, and signout.

## Environment variables

Set these for local and production:

| Variable                           | Required           | Description                                                                                        |
| ---------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`               | Yes                | Secret used to sign cookies and tokens. Generate with `npx auth@latest secret`. Must be 32+ chars. |
| `DATABASE_URL`                     | Yes                | PostgreSQL connection string (Neon). Already used by Prisma.                                       |
| `BETTER_AUTH_GOOGLE_CLIENT_ID`     | For Google sign-in | Google OAuth 2.0 client ID from Google Cloud Console.                                              |
| `BETTER_AUTH_GOOGLE_CLIENT_SECRET` | For Google sign-in | Google OAuth 2.0 client secret.                                                                    |

For Google OAuth, configure the authorized redirect URI in Google Cloud Console:

- Local: `http://localhost:3000/api/auth/callback/google`
- Production: `https://<your-domain>/api/auth/callback/google`

The auth base URL is not configured via env: it is inferred by `getAppBaseUrl()` in `src/lib/app-url.ts` (local: `http://localhost:3000`, Vercel: `https://${VERCEL_URL}`).

## Server-side session

- **Get current session**: use `getSession()` from `@/lib/auth-server` in Server Components, Server Actions, or Route Handlers. It reads the session from request cookies.
- **Sign out**: signout is handled by the Better Auth API. The client calls the sign-out endpoint (e.g. via the auth client in a later slice). Invoking the API invalidates the session and clears the cookie.

## Key files

- `src/lib/auth.ts` – Better Auth config (database adapter, plugins, email/password).
- `src/lib/app-url.ts` – `getAppBaseUrl()` for auth base URL (local vs Vercel).
- `src/lib/auth-server.ts` – Server-only helpers (e.g. `getSession()`).
- `src/app/api/auth/[...all]/route.ts` – Catch-all route for Better Auth (sign-in, sign-up, sign-out, get-session, etc.).

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

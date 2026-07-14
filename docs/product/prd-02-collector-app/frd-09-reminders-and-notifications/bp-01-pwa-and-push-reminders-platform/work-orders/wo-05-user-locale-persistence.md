---
id: WO-05
type: WORK_ORDER
slug: user-locale-persistence
title: User Locale Persistence
status: ACTIVE
parent: BP-01
source_issue: 121
source_features: []
implementation_status: IMPLEMENTED
last_updated: 2026-07-14
---

# WO-05 User Locale Persistence

## Summary

Persist the locale each collector actually browses PandaTrack with, and feed it to the reminder dispatcher. [`WO-04`](wo-04-scheduled-reminders.md) shipped the dispatcher with a nullable `locale` extension point on every reminder candidate, hardcoded to `null` because `User` had no locale column: every reminder therefore fell back to the default locale (`es`), including for collectors reading the app in English. This slice closes that gap by adding `User.locale`, capturing it on sign-in, keeping it in sync when the collector switches language, and selecting it in the candidate queries so `FR-09-17` (copy localized to the collector's own locale) is finally true at run time.

## Prerequisites

- [`WO-04`](wo-04-scheduled-reminders.md): the candidate queries, the dispatcher, and `resolveReminderLocale`, which already validates a candidate locale and falls back to the default. The dispatcher itself needs no change.

## In Scope

- `User.locale` (`String?`) on the `User` model plus its migration. Nullable, because a collector who has not signed in since this slice shipped has none yet.
- Capture of the browsing locale in the Better Auth `hooks.after` middleware: on every successful sign-in (email/password, Google, and account-linking sign-ins), store the locale the collector is browsing with when `User.locale` is still empty. Never overwrite a locale that is already stored.
- Persistence of later language changes: `updateLanguageAction` keeps setting the `NEXT_LOCALE` cookie and additionally writes `User.locale` when the caller is authenticated.
- The two authenticated-app language toggles (`src/components/core/LangToggle.tsx`, `src/app/[locale]/(landing)/_components/Menu/LanguageToggle.tsx`) call `updateLanguageAction` on switch, best-effort, so the stored locale tracks what the collector actually reads. The existing PostHog event and the navigation behavior are unchanged.
- Data-layer writers for the two shapes of write (`updateUserLocale`, `captureUserLocaleIfUnset`) in `src/lib/data/auth/userMutations.ts`, singleton Prisma access per [ADR 0015](../../../../../design/decisions/0015-data-access-layer-shape.md).
- Dispatcher wiring: `src/lib/data/notifications/reminderCandidateQueries.ts` selects `user.locale` in the three candidate queries and maps it into every `ReminderCandidate` instead of `null` (`FR-09-17`).
- Unit tests for the locale-derivation helper, the language action (authenticated, unauthenticated, invalid locale, persistence failure), and the candidate mapping.

## Out of Scope

- Capturing `User.timezone`. It is a separate, already-known gap with its own tracking; reminder windows keep their `UTC` fallback (`FR-09-15`, `BR-09-03`).
- Any change to the reminder payload copy, the `notifications` namespace, or `resolveReminderLocale` in the dispatch route. The dispatcher already resolves and falls back correctly and must stay untouched.
- A language selector on public surfaces beyond the two toggles named above (`PublicLanguageToggle` keeps its cookie-only behavior).
- Backfilling `User.locale` for collectors who never sign in again. The capture on the next sign-in is the backfill.

## Requirements

- `FR-09-17`: reminder copy localized to the collector's own locale, resolved server-side at dispatch time. This slice supplies the value that requirement depends on.
- `FR-09-22`: the collector's browsing locale is persisted on `User.locale`, captured at first sign-in and updated whenever the collector switches language, and it is the locale the dispatcher composes reminders in.
- `AC-09-10`: a collector browsing in `en` who signs in has `en` stored, and a reminder dispatched for them is composed in `en`.
- The send contract from [`BP-01`](../bp-01-pwa-and-push-reminders-platform.md#contracts) is unchanged: the candidate payload still carries no money, note text, or subscriber keys.

## Blueprints

- [`BP-01`](../bp-01-pwa-and-push-reminders-platform.md): this slice closes the blueprint's own dependency on "`User.locale` context" and delivers the locale half of its localization decision ("notification copy is resolved server-side with `getTranslations` against the collector's stored locale").

## Assumptions

- **What is stored is what the collector reads, not what their browser advertises.** The product decision is explicit: persist the `es` / `en` the collector is actively browsing the app with, never the raw `Accept-Language` header. A browser advertising `en-US` while the collector reads the app in Spanish must store `es`.
- **The collector's explicit choice wins.** The sign-in capture only fills an empty `User.locale`. Once a value exists it belongs to the collector's own language choice and is only changed by the collector switching language.
- **The callback URL is the reliable server-side signal.** All three sign-in surfaces (`SignUpForm`, `SignInForm`, `GoogleSignInButton`) build their callback through `resolveAuthCallbackURL(locale, returnTo)` in `src/lib/auth/authRedirect.ts`, which always returns a locale-prefixed path. The locale prefix of that callback is therefore a trustworthy statement of the locale the collector was browsing when they signed in.
- **Capture must never cost a sign-in.** The capture is best-effort: wrapped in try/catch with a single Sentry capture, exactly like the Kit newsletter sync that already lives in the same middleware. A failed capture leaves `User.locale` null and the collector simply gets the default locale until their next sign-in or language switch.
- **Existing collectors are backfilled by the hook, not by a script.** `hooks.after` runs on every sign-in, not only on user creation, so an existing collector's locale is captured the next time they sign in. No data migration is needed.
- **Nothing else consumes `User.locale` yet.** The reminder dispatcher is the only reader. Server-rendered UI keeps deriving its locale from the URL segment and the `NEXT_LOCALE` cookie, which is unchanged.

## Technical Notes

- **Schema.** `locale String?` on `User`, next to `timezone`. Migration `prisma/migrations/20260714162014_add_user_locale/` (`ALTER TABLE "user" ADD COLUMN "locale" TEXT;`).
- **Capture point.** `hooks.after` in `src/lib/auth/auth.ts` (the existing `createAuthMiddleware`). It is the only hook that fires for every authenticated arrival: `databaseHooks.user.create.before` receives no request context and never fires on an account-linking sign-in, so it cannot see the browsing locale and cannot backfill an existing collector.
- **Better Auth `ctx` shape (v1.6).** The `after` middleware receives a `MiddlewareContext`. The fields this slice reads:
  - `ctx.context.newSession` — the freshly created session (`{ user, session }`) or `null`. Present on every successful sign-in path, including the OAuth callback.
  - `ctx.body` — the parsed request body. Email sign-in and sign-up carry `callbackURL` here.
  - `ctx.query` — the parsed query string (`Record<string, any> | undefined`). Verification-style endpoints carry `callbackURL` here.
  - `ctx.context.responseHeaders` — the accumulated response headers. The OAuth callback endpoint (`/callback/:id`) has neither a body nor a query `callbackURL`: it finishes with `throw c.redirect(callbackURL)`, and the dispatcher still runs the `after` hooks with the redirect's headers merged in, so `responseHeaders.get("location")` is that same locale-prefixed callback URL. This is what makes the Google flow work.
  - `ctx.headers` — the request headers (`Headers | undefined`), used to read the `NEXT_LOCALE` cookie.
- **Locale derivation.** `resolveBrowsingLocale` in `src/lib/auth/authLocaleCapture.ts` is a pure function over those signals, in order: body `callbackURL`, query `callbackURL`, redirect `location`, `NEXT_LOCALE` cookie, `routing.defaultLocale`. Each path-like candidate is parsed to a pathname and matched against the locale prefix with the existing `getLocaleSegment`, then validated with `isLocale`. It is unit-tested without Better Auth.
- **Data-layer shape (deviation from the blueprint's first sketch, justified).** The two writes are narrow single-field writers in `src/lib/data/auth/userMutations.ts`, not an extension of `buildUserScalarUpdate` / the collector-preferences Zod schemas:
  - the sign-in capture is a conditional write ("set only if still null"), expressed atomically as `user.updateMany({ where: { id, locale: null } })`. The preferences patch pipeline cannot express a conditional write, and a read-then-write would race two concurrent sign-ins.
  - `updateLanguageAction` writes exactly one field. Routing it through `parseAndApplyCollectorPreferencesPatch` would open a transaction and re-validate the whole preferences state for a single column, and would force `locale` into `collectorPreferencesStateSchema`, which every existing caller of `validateCollectorPreferencesState` would then have to supply. Language is a UI setting stored in a cookie, not part of the collector-preferences snapshot the settings form owns.
- **Language action.** `updateLanguageAction` validates with `isLocale`, persists to `User.locale` when `getSession()` returns a session, then sets the `NEXT_LOCALE` cookie and returns ok. Without a session it stays cookie-only and still returns ok, so public surfaces keep working. The database write runs before the cookie so a failed write does not leave the UI switched with nothing persisted; it returns the file's `generic` error code after a single Sentry capture.
- **Toggles.** Both toggles fire `updateLanguageAction` without awaiting it and swallow its rejection, so the language switch navigation is never delayed or broken by the write. The PostHog `APP_SHELL.LOCALE_CHANGED` event stays declarative on the link.
- **Dispatcher.** The three candidate query builders now select `user: { select: { timezone: true, locale: true } }` and map `locale: row.user.locale`. `resolveReminderLocale` in `src/app/api/notifications/dispatch/route.ts` already validates the value and falls back to `routing.defaultLocale` for a collector whose locale is still null, so it is untouched.

## Security Notes

- No new user-supplied surface: the captured locale is derived from an internally-built callback URL or from the app's own cookie, and every path is validated with `isLocale` before it reaches the database. An unsupported or crafted value cannot be stored; it degrades to the default locale.
- `updateLanguageAction` writes only against the session user's id (`getSession()`), never against an id supplied by the caller.
- The capture cannot become a denial-of-sign-in vector: it is wrapped in try/catch and its failure is invisible to the auth flow.
- The reminder payload contract is untouched. The locale is a two-letter language code and carries no personal data, money, or note text.

## Analytics

- No new event. The language switch is already tracked by `POSTHOG_EVENTS.APP_SHELL.LOCALE_CHANGED` on both toggles and that event is preserved. The sign-in capture is a silent server-side side effect of an interaction (sign-in) that is not a new user-visible action, so it introduces no event per [`posthog-events`](../../../../../../.agents/rules/posthog-events.mdc).

## Testing and E2E Exemption

Automated coverage is unit only, and this is a deliberate exemption in the same spirit as [`WO-01`](wo-01-push-platform-foundation.md) and [`WO-04`](wo-04-scheduled-reminders.md). This slice ships no new screen, no new route, and no new user-visible flow: it is persistence and wiring behind surfaces that already exist and are already covered end-to-end (`e2e/auth.spec.ts` drives sign-in and sign-up; the settings and app-shell surfaces already exercise the language switch). The one thing a Playwright spec could add on top of the unit matrix is an assertion about a database column, which is not what an E2E spec is for, and the consumer of that column (the dispatcher) has no browser surface at all. The behavior is covered by:

- locale derivation from a body callback, a query callback, an OAuth redirect location, the `NEXT_LOCALE` cookie, an unsupported value, and no signal at all: `authLocaleCapture` unit tests.
- capture-never-breaks-sign-in (a persistence failure resolves and is captured once): `authLocaleCapture` unit tests.
- `updateLanguageAction` authenticated (cookie plus collector write), unauthenticated (cookie only, still ok), invalid locale (validation error, no writes), and an unexpected persistence failure (Sentry plus `generic`): `preferencesActions` unit tests.
- a real stored locale flowing into `ReminderCandidate.locale` instead of `null`, and the `select` that carries it: `reminderCandidateQueries` unit tests.

## E2E Acceptance Tests

Expressed as the scenarios this slice must satisfy; verified through the unit matrix above per the exemption.

- A collector browsing the app in `en` signs in with email and password: `User.locale` is `en`.
- A collector browsing the app in `en` signs in with Google (including a sign-in that links Google to an existing email account): `User.locale` is `en`.
- A collector who already has a stored locale signs in: the stored value is left untouched.
- A collector switches the language from the app header or from Settings: `User.locale` follows the language they switched to, and the switch itself is not delayed or broken by the write.
- A collector with `locale = en` and an outstanding payment inside the payment window receives a reminder composed in `en`; a collector whose locale is still null receives it in the default locale.
- A failure to persist the locale during sign-in never prevents the collector from signing in.

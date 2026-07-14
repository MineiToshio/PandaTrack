---
id: WO-06
type: WORK_ORDER
slug: user-timezone-capture
title: User Timezone Capture
status: ACTIVE
parent: BP-01
source_issue: 122
source_features: []
implementation_status: IMPLEMENTED
last_updated: 2026-07-14
---

# WO-06 User Timezone Capture

## Summary

Feed `User.timezone`. The column has existed since the settings domain shipped and is read by two consumers already ([`WO-04`](wo-04-scheduled-reminders.md)'s reminder windows through `resolveTodayStart`, and the dashboard periods through `resolveTimeZone`), but no user-facing code path has ever written it: the only writer in the repository is the development seed script. Every collector therefore holds `timezone = null` in production, every reminder window and every dashboard period silently falls back to `UTC`, and a reminder can land up to a day off at the boundaries. This slice captures the collector's IANA timezone from the authenticated app shell, validates it server-side, and keeps it in sync, closing the `UTC`-fallback risk [`BP-01`](../bp-01-pwa-and-push-reminders-platform.md#risks) names in its own Risks section.

The plumbing already exists end to end. It was simply never fed.

## Prerequisites

- [`WO-04`](wo-04-scheduled-reminders.md): the timezone-aware windowing (`src/lib/notifications/reminderWindows.ts`) that consumes the value. It needs no change.
- [`WO-05`](wo-05-user-locale-persistence.md): the precedent for a narrow single-column writer on the collector, mirrored here.

## In Scope

- A silent, best-effort capture of the browser's IANA timezone from the authenticated app shell: `TimezoneCapture` in `src/app/[locale]/(app)/_components/AppLayout/`, mounted next to `ServiceWorkerRegistration` inside `AppLayout`.
- The stored timezone handed down from the server: `src/app/[locale]/(app)/layout.tsx` already loads `getCollectorPreferencesSnapshot`, which already selects `timezone`, so the value reaches the client as a `storedTimezone` prop with no new query.
- A narrow shell-owned server action `syncUserTimezoneAction` in `src/app/[locale]/(app)/_actions/syncUserTimezone.ts`: session guard, Zod validation, discriminated result, one Sentry capture on unexpected failure, never throws.
- Server-side validation of the client-supplied zone in `src/app/[locale]/(app)/_schemas/userTimezoneSchema.ts`: shape and length guard plus a real resolution check against the runtime's own zone database.
- A narrow data-layer writer `updateUserTimezone(userId, timezone)` in `src/lib/data/auth/userMutations.ts`, singleton Prisma access per [ADR 0015](../../../../../design/decisions/0015-data-access-layer-shape.md).
- Unit tests for the validation schema, the server action, and the client capture component.

## Out of Scope

- Any settings UI to display or manually override the timezone. There is no manual timezone control in the product today and this slice does not add one; see the write-semantics assumption below for what has to change if one ever ships.
- Any change to how the reminder dispatcher or the dashboard consume `User.timezone`. Both already read it correctly and fall back to `UTC`; they simply start receiving a real value. `resolveTodayStart`, `reminderWindows`, `dashboardPeriods`, and `dashboardAggregation` are untouched.
- Any change to the locale capture from [`WO-05`](wo-05-user-locale-persistence.md).
- Any migration. `User.timezone String?` already exists in `prisma/schema.prisma`; this slice adds no column and no migration.
- Backfilling collectors who never open the app again. The shell capture is the backfill: it fires on the next authenticated load.

## Requirements

- `FR-09-15`: reminder windowing is timezone-aware from `User.timezone` with a `UTC` fallback. This slice supplies the value that requirement depends on, so the fallback stops being the default case.
- `FR-09-23`: the collector's IANA timezone is captured silently from the authenticated app shell, validated server-side against the runtime's zone database, and stored on `User.timezone`. It is written when no value is stored yet and rewritten whenever the browser reports a different zone, so the stored value tracks where the collector actually is. It stays nullable and an absent value keeps the `UTC` fallback. No prompt, no settings control, and no notification permission is involved.
- `AC-09-11`: a collector in `America/Lima` whose stored timezone is empty has `America/Lima` stored after their next authenticated load, and their reminder window is computed in that zone rather than in `UTC`.
- `BR-09-03`: windowing boundaries are computed in the collector's timezone with a `UTC` fallback. Unchanged; this slice makes the first branch reachable.

## Blueprints

- [`BP-01`](../bp-01-pwa-and-push-reminders-platform.md): this slice closes the blueprint's `User.timezone` dependency and the Risk it records ("because `User.timezone` has no settings UI today, most collectors fall back to `UTC`"). It also delivers the extension point the blueprint lists for a timezone-capture path feeding `User.timezone`, choosing a silent shell capture over the "prompt" the extension point sketched.
- The private app shell from [`FRD-03`](../../../frd-03-collector-app-shell/frd-03-collector-app-shell.md) is the host, exactly as it already hosts the service-worker registration.

## Assumptions

- **The timezone is only knowable in the browser.** Unlike the locale, which [`WO-05`](wo-05-user-locale-persistence.md) derives server-side from the sign-in callback URL, the IANA zone has no reliable server-side signal: it comes from `Intl.DateTimeFormat().resolvedOptions().timeZone`. That is why this capture is a client effect and not an extension of the Better Auth sign-in hook, and not an extra field on the auth forms (which would ask the collector for something their browser already knows).
- **A shell effect backfills; a sign-in capture would not.** Mounting the capture in the authenticated shell means every existing collector is covered on their next load. A capture at sign-in time would only ever cover collectors who sign in again after this slice ships.
- **Write semantics: keep the stored value in sync with the browser, deliberately unlike the locale.** [`WO-05`](wo-05-user-locale-persistence.md) writes the locale only when it is unset, because an existing locale is the collector's own explicit language choice and must be protected. There is no explicit timezone choice to protect: the product exposes no manual timezone control, so the stored value is nothing but a stale reading of the same signal. A collector who travels or relocates should get their reminders in their actual local time, so the capture writes whenever the browser's zone differs from the stored one. **If a manual timezone control ever ships, this rule must change:** the collector's explicit choice would then need a flag that stops the shell from overwriting it, exactly as the locale rule already does.
- **The steady state must cost nothing.** The server component rendering the shell already knows the stored timezone, so it is passed down and compared on the client. When the browser's zone matches the stored value there is no action call and no request, on any page load. The comparison is also guarded per page session, so a remount of the shell cannot re-issue the same write.
- **The client string is never trusted.** The zone is validated server-side before it reaches the database. A crafted or unknown value is rejected as a validation error and nothing is written; it does not degrade the stored value.
- **Capture must never cost a page.** It is fire-and-forget in an effect. It renders nothing, blocks nothing, and shows nothing: no toast, no banner, no feedback. A failure is captured once and swallowed, exactly like the service-worker registration that already lives in the same shell.

## Technical Notes

- **Schema.** None. `timezone String?` already exists on `User`. No migration ships in this slice.
- **Shell seam.** `src/app/[locale]/(app)/layout.tsx` already awaits `getCollectorPreferencesSnapshot(session.user.id)` (for the stores nav href), and that snapshot already selects `timezone`. The stored value is read from it (`collectorPrefs?.timezone ?? null`) and threaded through `AppLayout` as `storedTimezone` into `TimezoneCapture`. No new query, no new round trip, and the snapshot is `cache()`-wrapped so the dashboard's own read of it is still deduped.
- **Client capture.** `TimezoneCapture` reads `Intl.DateTimeFormat().resolvedOptions().timeZone` inside a try/catch, returns `null` when the runtime cannot resolve one, and calls the action only when the resolved zone is truthy, differs from `storedTimezone`, and has not already been written in this page session (a module-level guard mirroring `registerServiceWorker`). The call is not awaited and its rejection is swallowed after one Sentry capture. The component renders `null`.
- **Server action.** `syncUserTimezoneAction(timezone)` follows the repository action contract: `getSession()` first (`{ ok: false, error: "unauthorized" }` without a session), then `userTimezoneSchema.safeParse` (`{ ok: false, error: "validation" }` on failure, no write), then the write, with a single `Sentry.captureException` and `{ ok: false, error: "generic" }` on an unexpected failure. It never throws. It writes only against the session user's id, never against an id supplied by the caller. It revalidates nothing: no rendered surface depends on the value within the request.
- **Validation.** `userTimezoneSchema` trims, requires a non-empty value, caps the length well above the longest real zone identifier, restricts the character set to the tz-database alphabet, and then resolves the value with `new Intl.DateTimeFormat("en-US", { timeZone: value })` inside a try/catch. That last check is the authoritative one: it is the same zone database every consumer of the stored value formats against, so a value that passes can never break a reminder window or a dashboard period. It mirrors the guard `resolveTimeZone` in `src/lib/data/dashboard/dashboardPeriods.ts` already applies at read time.
- **Data layer (deliberately not the preferences pipeline).** The write is a narrow single-column writer, `updateUserTimezone`, next to `updateUserLocale`. It is deliberately not routed through `parseAndApplyCollectorPreferencesPatch`: that path validates and rewrites the entire collector-preferences state (country, base currency, budget, product types), which the app shell has no business supplying, and it would force `timezone` into `collectorPreferencesStateSchema` for every existing caller. Same reasoning as [`WO-05`](wo-05-user-locale-persistence.md).
- **Consumers.** `resolveTodayStart` (`src/lib/notifications/reminderWindows.ts`, used by `reminderDispatch`) and `resolveTimeZone` / `getTodayStart` (`src/lib/data/dashboard/dashboardPeriods.ts`, used by `dashboardAggregation` and the dashboard page) already read `User.timezone` and already fall back to `UTC`. They are untouched and simply stop seeing `null`.

## Security Notes

- The zone is a client-supplied string and is treated as untrusted input: shape, length, and character set are guarded, and the value must resolve against the runtime's zone database before any write. An unknown or crafted value is rejected and nothing is persisted.
- The action writes only against `getSession().user.id`. No user id crosses the client boundary, so the capture cannot be pointed at another collector.
- The action is session-guarded before any parsing or persistence, so an unauthenticated caller cannot use it as a probe.
- The stored value carries no personal data beyond a coarse zone identifier, which the collector's browser already exposes to every site they visit. It is never included in a reminder payload or a log.
- The capture cannot degrade the app: it is fire-and-forget, its failure is invisible, and it can never block the shell from rendering.

## Analytics

- No new PostHog event, and this is an explicit decision rather than an omission. [`posthog-events`](../../../../../../.agents/rules/posthog-events.mdc) scopes events to meaningful user interactions. This capture is not an interaction at all: the collector does not click anything, see anything, or choose anything. Emitting an event on every shell mount where the zone changed would add analytics noise with no product question behind it.

## Testing and E2E Exemption

Automated coverage is unit only, and this is a deliberate exemption in the same spirit as [`WO-01`](wo-01-push-platform-foundation.md), [`WO-04`](wo-04-scheduled-reminders.md), and [`WO-05`](wo-05-user-locale-persistence.md). This slice ships no screen, no route, and no user-visible flow: it is invisible plumbing behind an app shell that Playwright already drives on every authenticated spec. The only thing an E2E spec could add over the unit matrix is an assertion about a database column, which is not what an E2E spec is for, and the consumers of that column (the dispatcher, the dashboard aggregation) already have their own coverage and are unchanged here. There is also nothing cheap and high-value to assert in the browser: a passing capture is defined by the absence of any visible effect. The behavior is covered by:

- valid IANA zones, a well-shaped but unknown zone, an empty value, an over-long value, crafted / injection-shaped payloads, and non-string input: `userTimezoneSchema` unit tests.
- unauthorized (no session, no write), a valid zone persisted against the session user, an invalid zone returning `validation` with no write, and an unexpected persistence failure captured exactly once and returning `generic`: `syncUserTimezone` action unit tests.
- the action called when nothing is stored, called when the browser zone differs from the stored one, **not** called when they match (the steady state), not called when the browser resolves no zone, written at most once per page session, and never throwing when the action rejects (one Sentry capture, swallowed): `TimezoneCapture` unit tests.

## E2E Acceptance Tests

Expressed as the scenarios this slice must satisfy; verified through the unit matrix above per the exemption.

- A collector in `America/Lima` with no stored timezone opens any authenticated page: `America/Lima` is stored on their `User.timezone`.
- The same collector opens another authenticated page afterwards: no action call and no request is issued, because the stored value already matches their browser.
- A collector who relocates and now browses from `Europe/Madrid`: the stored timezone follows them to `Europe/Madrid` on their next authenticated load.
- A crafted zone that is not a real IANA identifier reaches the action: it is rejected as a validation error and `User.timezone` is left untouched.
- An unauthenticated caller invokes the action: it is rejected before any parsing or persistence.
- The persistence fails: the collector never sees an error, the shell renders normally, and the failure is captured once.
- A collector with a stored timezone has their reminder window and their dashboard period computed in that zone instead of `UTC`.

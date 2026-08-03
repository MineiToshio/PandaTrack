---
id: WO-07
type: WORK_ORDER
slug: photo-quota-and-spend-communication
title: Photo Quota and Spend Communication
status: ACTIVE
parent: BP-01
source_features: []
implementation_status: IMPLEMENTED
last_updated: 2026-07-29
---

# WO-07 Photo Quota and Spend Communication

## Summary

Ship the user-facing side of consumption: a monthly bag of 20 photos, a permanent passive counter, exactly one interruption, an honest exhausted state that routes to the always-free manual method, and a per-user override an administrator can grant.

The global spend cut-off already shipped in WO-01. This slice is the product decision, not the liability control.

## In Scope

- Prisma aggregate `ImageIntakePeriod` (unique on `userId` plus `periodKey`) with `usedPhotos` and cost, so the quota check is a single indexed read, plus the migration.
- Optional `User.aiMonthlyPhotoLimit` as the per-user override.
- **Reservation**: reserve the photos for the whole submission inside a transaction **before** the provider call. Either every photo fits or none is processed; half a submission is never processed. Release the reservation on provider failure or timeout so a failed submission consumes nothing.
- Quota rules: 20 photos per calendar month resetting on day 1 in the user's timezone (consistent with `budgetResetDayOfMonth`), a daily cap of 10 photos, no per-submission photo cap beyond the technical ceiling and the remaining balance, pasted text consuming nothing, and the manual form always unlimited.
- Reset is implicit through the period key. **No scheduled job may be created.**
- **Administrators**: no photo or submission cap, but consumption is still recorded and the global cut-off still applies. Admin identity resolved through `getIsAdmin` / `requireAdmin`, never by reading `ADMIN_EMAILS` directly.
- **Override console control** in the moderation console for setting `aiMonthlyPhotoLimit`, audited through the existing admin audit log.
- **Communication surfaces**, replacing any pre-confirmation dialog:
  - permanent passive counter: "Te quedan 17 fotos este mes",
  - first-time explainer, shown once: "Cada foto que subes gasta una de tu bolsa mensual.",
  - helper text beside the attach control: "Sube las fotos que necesites. Cada foto gasta una de tu cuota mensual.",
  - low-balance notice: "Te quedan 6 fotos este mes.",
  - the single interruption, when the batch does not fit: "Vas a subir 5 fotos y te quedan 3. Quita 2 o guarda el resto para el mes que viene.",
  - exhausted state: "Ya usaste tus 20 fotos con IA de este mes. Se renuevan el 1 de agosto. Puedes seguir registrando pedidos a mano, sin límite y con todas las funciones." with a "Registrar a mano" action,
  - the selector's image card renders disabled with a zero counter when the bag is exhausted, and the manual card is never blocked.
- Terminology guard: the interface says **foto** everywhere. Never "extracción", "crédito", or "token".
- Analytics: `image_intake_quota_overflow_shown`, `image_intake_quota_blocked`, and `photos_remaining_before` on `image_intake_submitted`.
- A short note in the FRD or the 60-day review checklist for what to measure: adoption rate, median and p90/p99 photos per user, average photos per submission, the share of users who exhaust the bag, and how often the overflow interruption fires.

## Out of Scope

- The global spend cut-off, the rate limit, the timeout policy, the per-request ceilings, and the ledger table (all shipped in WO-01).
- Paid tiers, upgrades, or any monetisation surface.
- Surfacing the remaining balance in user settings alongside the budget (`OQ-11-09`, not blocking).

## Requirements

- `FR-11-69` through `FR-11-80`.
- `FR-11-88` (the quota events).
- Business rules `BR-11-10`, `BR-11-11`, `BR-11-12`, `BR-11-15`.
- Acceptance criteria `AC-11-25`, `AC-11-26`, `AC-11-27`, `AC-11-28`, `AC-11-29`.
- Cross-FRD: `budgetResetDayOfMonth` and the user's timezone are owned by **FRD-07** ([`frd-07-user-settings.md`](../../../frd-07-user-settings/frd-07-user-settings.md)); the admin role and the audit log are owned by **PRD-03 · FRD-01** ([`frd-01-admin-identity-and-access.md`](../../../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md)).

## Blueprints

- [BP-01](../bp-01-order-image-intake.md): Persistence, Architecture Decision 5, Contracts (quota boundary).

## E2E Acceptance Tests

- The upload surface shows the remaining-photo counter permanently, and no pre-confirmation dialog appears at any point.
- The first-time explainer appears once and never again.
- Attaching 5 photos with 3 remaining shows the overflow message, processes nothing, and the counter is unchanged; removing 2 photos lets the submission proceed.
- With 0 photos left, the image method shows the exhausted message with the renewal date, the image card is disabled, and the manual method still creates an order without restriction.
- A provider timeout leaves the counter unchanged.
- Two concurrent submissions cannot together exceed the remaining balance.
- An administrator has no cap, and their submissions still write ledger rows.
- An administrator can set a per-user override from the moderation console, the affected user's counter reflects the new limit, and the change appears in the audit log.
- Crossing into a new calendar month resets the balance with no job having run.

## Implementation Notes

- **The photo reservation lives inside the spend reservation.** `reserveImageIntakeUsage` (`src/lib/data/imageIntake/imageIntakeMutations.ts`) already held a Postgres advisory lock on `periodKey` for the global cut-off and the rate limit; the bag check joined that same transaction rather than getting one of its own. One lock decides the rate limit, the global ceiling, the monthly bag, and the daily cap, and writes both the `ImageIntakeUsage` reservation and the `ImageIntakePeriod` increment, so a batch either fits entirely or leaves nothing behind (`BR-11-11`, `FR-11-77`). Two concurrent submissions by the same collector serialise behind that lock and cannot overdraw the bag (`AC-11-29`).
- **Two ceilings, two sources.** The monthly balance is one indexed read of the `ImageIntakePeriod` roll-up; the daily cap is summed from the ledger's own rows for `[userId, dayKey]` (new index), excluding `FAILED`, because the period aggregate is monthly by definition. The daily cap is a calendar day in UTC, matching how `dayKey` was already written in WO-01.
- **A failure gives the photos back, not the money.** Settlement decrements `usedPhotos` on `FAILED` and keeps it on `SUCCEEDED`, while the real cost is written to both the ledger row and the roll-up either way (`BR-11-12`, `FR-11-76`, `AC-11-28`). Settlement upserts the roll-up rather than updating it, so a reservation written before this aggregate existed still settles.
- **Administrators**: `isAdmin` is resolved from the session through `getIsAdmin` at the action boundary and passed into the guard; the data layer never reads an allowlist. An administrator has no monthly and no daily cap, still writes a ledger row and a roll-up increment, and is still subject to the global cut-off (`FR-11-74`).
- **Reset is implicit**: a period with no roll-up row simply has nothing spent. No job exists (`FR-11-80`).
- **Where the counter is read**: `getImageIntakeQuotaSnapshotCached` (`src/lib/data/imageIntake/imageIntakeQuotaQueries.ts`) is a `cache()`d, request-scoped read. The app shell reads it once and passes it to the floating button's selector; the orders page passes it to the list toolbar's selector; the empty state and the intake page read it through the same memo, so a page that renders several selectors still performs one query. `photoCounterContract.ts` is now a narrowed view of the real snapshot instead of a stub.
- **Copy surfaces** (`imageIntake.quota` in both locales, verbatim from FDD §6.2, asserted sentence by sentence in `quotaCopy.test.ts`): a passive counter chip in the upload block header, the one-time explainer (device-local marker read through `useSyncExternalStore`, so no state is set in an effect), the helper beside the CTA, the overflow `AlertBanner` (`role="status"`, so it announces without stealing focus) with the primary action disabled until it is resolved, and the exhausted state that replaces the attach surface entirely with the real renewal date and a "Registrar a mano" action. The selector's image card renders inert with a zero counter when the bag is empty; the manual card is never blocked.
- **Typed refusals**: `SPEND_GUARD_BLOCK_CODES` gained `quota-exceeded` and `daily-cap-exceeded`, both carrying the remaining balance through `SpendGuardBlockedError` and the engine's outcome to the extract action's contract, so a refusal that reaches the server (the balance moved under an open screen) still states both numbers.
- **Analytics**: `image_intake_submitted` carries `photos_remaining_before`; `image_intake_quota_overflow_shown` and `image_intake_quota_exhausted_shown` fire from the intake screen; `image_intake_admin_quota_override_set` fires from the override action with identifiers and figures only, never the reason. A server-side quota refusal (the balance moved under an open screen) fires both the existing `image_intake_failed` event with `failure_code` and its own `image_intake_quota_blocked` event (`POSTHOG_EVENTS.IMAGE_INTAKE.QUOTA_BLOCKED`, `src/app/[locale]/(app)/orders/_actions/imageIntakeExtractAction.ts`), so a quota-caused failure is countable without filtering `image_intake_failed` by `failure_code`.
- **Override console**: `admin/image-intake` (search by username or email through `?q=`, usage per account, set or clear the limit) with `setImageIntakeQuotaOverrideAction` gated by `requireAdmin`. The audit row (`imageIntake.quotaOverride` on target type `user`, both new entries in the shared vocabulary) is written in the same transaction as the change, and the reason is mandatory.
- **Migration**: `20260729051345_add_image_intake_period_and_photo_limit` (adds `image_intake_period`, `user.aiMonthlyPhotoLimit`, and the `[userId, dayKey]` ledger index).
- **E2E**: `e2e/order-image-intake.spec.ts` asserts the quota is communicated passively (no dialog, action enabled, counter informational) and handles the exhausted branch. Spending a photo cannot be exercised end to end without calling the paid provider, so the reservation, refund, concurrency, override, and overflow behaviours are covered at unit level instead.

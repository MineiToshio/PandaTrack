---
id: WO-06
type: WORK_ORDER
slug: celebration-hide-setting-and-backfill
title: Celebration, Hide Setting, and Backfill
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0021
source_issue: 145
implementation_status: IN_PROGRESS
last_updated: 2026-08-23
---

# WO-06 Celebration, Hide Setting, and Backfill

## Summary

Ship the global unlock toast, the rank-up celebration modal (and its full-screen medal variant for the two highest rarity tiers, `FR-12-47`), the settings toggle that hides the whole layer, the self-service purge action, `prefers-reduced-motion` handling, and the one-off Notion backfill script with its aggregated, silent welcome celebration. This is the slice that closes the loop between [`WO-02`](wo-02-accrual-in-existing-flows.md)/[`WO-05`](wo-05-medal-album.md)'s crediting and the collector actually seeing it happen.

## In Scope

- unlock toast: a global, queued surface (one at a time, short separation, `FR-12-29`) consuming any host Server Action's `progression.medalsUnlocked` (from `WO-02`/`WO-05`), raised optimistically over the host flow, never waiting for a navigation or a deferred hook (`FR-12-13`); imports `useToast`/`ToastProvider` from `src/components/core/Toast` (the barrel that re-exports the actual implementation in `src/contexts/ToastContext.tsx`)
- rank celebration: a dismissible modal following the canonical modal pattern (`.agents/rules/modal-canonical-pattern.mdc`, `Modal` from `src/components/modules/Modal`), fired once per rank per user (`FR-12-19`), gated by comparing the resolved `highestRankIndex` against `ProgressionSettings.lastCelebratedRankIndex` and writing the new value once shown, so a later recompute that re-derives the same rank never replays it
- **full-screen medal celebration (`FR-12-47`)**: the same canonical-modal component as the rank-up celebration, a medal variant, fired only when a newly unlocked medal's `rarity` is `Holográfica` or `Firmada`; every other rarity (`Tirada normal`, `Primera edición`, `Edición limitada`) is announced by the unlock toast alone and never escalates. In phase 1 this fires concretely for `patience-200` (`Holográfica`, the only phase-1 medal at either of the two qualifying tiers, per `WO-05`'s catalogue); `midnight-order`'s `Primera edición` stays toast-only. When a single Server Action response's `medalsUnlocked` contains both a qualifying and a non-qualifying medal, the toast queue still raises the non-qualifying one(s) per `FR-12-29`, and the full-screen celebration for the qualifying one is queued after the rank celebration (if any) rather than stacking simultaneously with it, since both are canonical-modal surfaces and only one dialog may own focus at a time
- `prefers-reduced-motion` handling for both the toast and the celebration (rank-up and medal variants), per `ADR 0036 §3` (strong motion, including any shimmer/rotation on a medal's rarity ring, stays off the toast entirely and is muted on the celebration under reduced motion)
- settings toggle `"Ocultar mi progresión"` in the `Preferences` section (`src/app/[locale]/(app)/settings/`), optimistic per the repository's default client-mutation pattern: the layer disappears in the same tick, reverts on a server failure (`FR-12-38`); `toggleProgressionVisibilityAction` writes `ProgressionSettings.hideProgression`
- self-service purge: `purgeProgressionLedgerAction`, confirmed in a modal stating permanence before it runs, awaited (not optimistic, since it is irreversible), deletes `PointLedgerEntry`, `MedalUnlock`, and `UserProgress` rows for the user (`FR-12-46`); post-purge the section reads as first-run empty (`WO-04`'s empty state)
- the Notion backfill script (`scripts/` or an equivalent one-off runner, following the repository's existing script conventions): writes one synthetic `order-created`/`order-registered`/`order-first-payment`/`delivery-received` entry per migrated order per the FRD's "one synthetic entry per order" rule (`FR-12-42`), all marked `source = BACKFILL`, all medal unlocks pre-marked `seenAt` (`FR-12-43`)
- the aggregated welcome celebration: a distinct, one-time modal variant naming the rank reached and the medal count, shown once after the backfill instead of a replay of individual toasts (`FR-12-43`, `AC-12-11`)
- `BACKFILL_ALREADY_APPLIED` idempotency (re-running the script is a no-op, verified against the ledger's existing unique constraint) and `BACKFILL_SOURCE_INCOMPLETE` (aborts before writing anything if the migrated payment source data is missing required fields)
- PostHog events: `medal_toast_shown`, `medal_burst_toast_shown` (added by the 2026-08-23 review's burst collapse), `medal_celebrated`, `celebration_dismissed`, `rank_up_celebrated` (server, carries the new rank index), `progression_hidden`, `progression_shown`, `progression_ledger_purged`. `medal_toast_shown` replaces the originally listed `medal_toast_dismissed`: the toast auto-dismisses on a fixed timer, so a dismissal event would report the timer rather than the reader, and reporting it would have required a dismissal callback the shared toast system does not expose. `medal_celebrated` and `celebration_dismissed` were added so the full-screen surface is measurable at all
- unit and integration tests for the toggle's optimistic revert, the purge's cascade, the celebration's once-per-rank guard, and the backfill script's idempotency

## Out of Scope

- the medal catalogue and evaluator content (`WO-05`, already shipped by the time this slice runs)
- the rank threshold table (`WO-03`, already shipped)
- any change to how the migrated data itself was imported (that migration already happened; this slice only credits progression against its existing rows)
- a second, later replay of the backfill against production before `admin_audit_log` and the rest of the cutover are ready; this slice ships the script and rehearses it against a full dev-data copy, it does not run it against prod

## Requirements

- `FR-12-19` (once-per-rank celebration, UI half)
- `FR-12-29` (toast queueing)
- `FR-12-36`, `FR-12-37` (global surfaces, canonical modal pattern)
- `FR-12-38` (hide toggle, write half; `WO-04` already shipped the read half)
- `FR-12-42`, `FR-12-43` (backfill script, silent unlocks, aggregated welcome celebration)
- `FR-12-46` (self-service purge)
- `FR-12-47` (full-screen celebration for `Holográfica`/`Firmada` medal unlocks, same canonical-modal pattern and dismissal as the rank-up variant)
- `BR-12-10` (`year-streak` only ever rewards, never penalizes; relevant here only in that the celebration/toast copy never frames a quiet month as a loss, restated for completeness even though `year-streak` itself ships in phase 2)
- `BR-12-11` (the layer can be switched off and purged; no part of progression is mandatory or non-dismissible)
- `BR-12-12` (`BACKFILL` points count toward rank, excluded from any future comparison, which the source column already guarantees)

## Blueprints

- [`BP-01`](../bp-01-collector-progression.md) — Risks: the backfill as a one-shot, hard-to-rehearse write; the "rehearse against a full dev-data copy first" requirement
- `.agents/rules/modal-canonical-pattern.mdc` — the celebration modal must follow the Semantic Depth pattern (`ADR 0008`), never a legacy modal shape
- `.agents/rules/optimistic-client-updates.mdc` — the hide toggle is optimistic by default; the purge is the documented exception (irreversible, so awaited)

## Backfill Notes

- **DECISION 2026-08-23: the backfill has NOT been run, and by the owner's decision it will not be.** The script is complete, tested and available (`npx tsx scripts/backfill-collector-progression.ts`), and nothing about it is deprecated: `FR-12-42` and `FR-12-43` stand as written and running it later is still a supported one-off. What changed is that the owner chose to start their own account at zero, for parity with the collectors who join afterwards and would otherwise face a permanently unreachable total on any future comparison surface. Do not treat the empty ledger on the owner's account as a bug or a missing step, and do not run the script to "fix" it without asking. Note that this decision is about POINTS only: medals are derived from current state rather than from ledger rows, so the owner's real history still unlocks the album on the first recompute, which is intended.
- **The relaxation of `BR-12-07` on the same date is what makes that possible.** While the gate still disqualified a store its own collector had registered, the Notion import's attribution of all 140 stores to the owner meant a backfill run would have credited nothing anyway; the choice not to run it is now a real choice rather than a forced outcome.
- Reuses `WO-01`'s `awardPoints` helper directly, so the idempotency guarantee (`(userId, ruleKey, entityId)` unique constraint) is inherited rather than re-implemented in the script.
- Reads the migrated `StorePayment` rows, filtering by `migratedFromOrderId IS NOT NULL` (per the existing dev-data note that migrated payments are backfill artifacts, not organic writes) to decide which orders get the synthetic entry set, rather than re-deriving "was this migrated" from a date heuristic.
- Runs once against a full copy of dev data before it is ever considered for prod, given `admin_audit_log`'s exclusion from the cutover and the general one-shot risk noted in `BP-01`.
- The aggregated welcome celebration is a distinct modal component (or a variant prop of the rank-celebration modal) so its copy ("naming the rank reached and the medal count") is not forced through the single-rank celebration's copy shape.
- **The pending welcome needs no column, and no migration.** As implemented it is DERIVED from two facts that already exist: the collector holds at least one `source = BACKFILL` ledger entry, and `ProgressionSettings.lastCelebratedRankIndex` is still `0`. Showing it claims that watermark through the same `claimRankCelebration` the rank-up uses, which is what makes it unrepeatable AND makes it replace every rank celebration the migrated history would otherwise have fired on its way up. The backfill script therefore must never touch `progression_settings`, and a test asserts it does not.
- Script location and invocation follow the repository's existing one-off script convention (`scripts/backfill-store-visibility.ts`, `scripts/backfill-inferred-contact-channel-privacy.ts`): a standalone `scripts/backfill-collector-progression.ts` using `PrismaPg` + `pg.Pool` + `dotenv/config` (not the app's shared `src/lib/prisma.ts` singleton, since scripts run outside the Next.js runtime), a JSDoc header stating purpose, idempotency, and usage (`npx tsx scripts/backfill-collector-progression.ts`), and a `main().then().catch()` exit-code contract. It calls `WO-01`'s `awardPoints` and this slice's own medal-seen/aggregated-celebration writes directly against the data layer, not through a Server Action (no session to authenticate against for an operator-run script).
- `BACKFILL_SOURCE_INCOMPLETE`'s "required fields" are the ones `awardPoints` and the synthetic-entry mapping need to proceed: `StorePayment.paymentDate`, `StorePayment.storeId`, and the payment's resolvable `orderId` through its `PaymentAllocation` rows. A migrated payment missing any of these aborts the whole run before any write, per the Error Contract's `FRD-12` definition, rather than partially crediting some users and not others.

## Toast Queueing and Celebration Surface Notes

- `ToastContainer` (`src/components/core/Toast/ToastContainer.tsx`) currently renders every active `ToastItem` from `ToastContext` stacked in one flex column simultaneously; there is no built-in single-slot queue anywhere in the existing toast system. `FR-12-29`'s "queued one at a time, short separation, never overlapping" therefore cannot be satisfied by calling `addToast` once per unlocked medal in a loop. This slice adds a small sequencing wrapper (a `useMedalUnlockToastQueue` hook or equivalent local module in the progression feature) that drains a `medalsUnlocked` array into successive `addToast` calls spaced by a short fixed delay, only calling `addToast` for the next medal once the previous one's `duration` has elapsed (or immediately if the queue was empty). It is additive to `ToastContext`, not a fork of it.
- `ToastVariant` (`success` | `error` | `info` | `warning` | `neutral`) has no "achievement" tone today. This slice extends the type (in `src/contexts/ToastContext.tsx`) with an `"achievement"` variant carrying the elevation-3 + warm-halo treatment `docs/design/visual-foundations.md` already documents ("Achievement toast", `--elevation-3` plus an ad-hoc warm ring/glow composition over `--accent-warm`), rather than reusing `"success"`, which is visually the confirmed-payment/completed-delivery treatment and would blur the distinction the design doc already draws.
- The rank-up celebration and the `FR-12-47` medal celebration are both instances of the same canonical `Modal` component (`tone="default"` or a new non-destructive celebratory tone if `Modal` does not yet expose one; extend `Modal` itself per `.agents/rules/modal-canonical-pattern.mdc` rule 1, never fork it). Only one such modal may be visibly open at a time; if both a rank-up and a qualifying medal unlock happen in the same response, the coordinating component queues the second dismissal-to-open transition rather than mounting two `Modal` instances at once.
- Reduced-motion mapping, per `docs/design/motion.md` §4's table: toast enter/exit under `prefers-reduced-motion` appears/disappears without the slide (the auto-dismiss timer still runs, the countdown bar is hidden); the rank/medal celebration modal falls back to the documented Modal/Sheet reduced-motion treatment, a ~200ms cross-fade instead of the `scale 0.96 → 1` spring; any shimmer/rotation on a medal's rarity ring inside the celebration is muted entirely under reduced motion (`ADR 0036 §3`), not merely slowed.

## Security Notes

- `purgeProgressionLedgerAction` and `toggleProgressionVisibilityAction` both resolve the acting `userId` from `getSession()` server-side and operate only on that user's own rows (`ProgressionSettings.userId`, `PointLedgerEntry.userId`, `MedalUnlock.userId`, `UserProgress.userId`); neither action accepts a target-user parameter from the client, so there is no cross-user purge or toggle surface to guard against, mirroring the pattern in `src/app/[locale]/(app)/settings/_actions/preferencesActions.ts`.
- The purge is destructive and irreversible (`FR-12-46`): per `.agents/rules/optimistic-client-updates.mdc`'s permitted-exception list, it is awaited behind the canonical Modal's confirmation, never optimistic, and the confirmation copy states permanence in plain language rather than a generic "are you sure".
- The backfill script is an operator-run one-off (`npx tsx`, not a route or Server Action), so it inherits whatever database credentials the running environment already grants; it carries no additional authentication surface of its own. It must never be wired to an HTTP-reachable endpoint. Because `admin_audit_log` is excluded from the production cutover today (`BP-01` Risks, `FRD-12` `FR-12-44`'s operational note), the backfill script itself does not write an audit entry; running it against prod later is explicitly deferred (`## Out of Scope`) until that table exists there.
- The aggregated welcome celebration and the per-medal `seenAt` pre-marking (`FR-12-43`) must not leak any monetary figure or store name in their copy, consistent with `BR-12-01`/`BR-12-02`'s domain-wide money- and cross-user-silence rules; the celebration names only the rank and a medal count.

## Assumptions

- The settings toggle lives in the existing `Preferences` pane (`src/app/[locale]/(app)/settings/_components/SettingsPrefsPane.tsx`) as a new row using the existing `SettingsRow`/toggle primitives already used there, not a new settings pane.
- `progress.json`'s namespace (created by `WO-03`/`WO-05`) is extended by this slice with the toast, celebration, and purge-confirmation copy keys; no new i18n namespace is created.
- `POSTHOG_EVENTS.PROGRESSION` (namespace added by `WO-02`) is extended with this slice's five events (`medal_toast_dismissed`, `rank_up_celebrated`, `progression_hidden`, `progression_shown`, `progression_ledger_purged`); `medal_unlocked`'s own firing (carrying `medal_key`, `rarity`, `series`, `source`) belongs to whichever call site actually unlocks it (`WO-02`/`WO-05`), not to this slice's toast/celebration rendering.
- The full-screen medal celebration (`FR-12-47`) reuses the rank-celebration's dismissal model (dismissible, no auto-timeout) rather than the toast's auto-dismiss timer, since `FR-12-37` ties both variants to "dismissed the same way".

## E2E Acceptance Tests

- Given a collector's action unlocks two medals in the same Server Action response
- When the response resolves
- Then both toasts render, one at a time, with a short separation, never overlapping

- Given a collector crosses a rank threshold
- When the crediting Server Action resolves
- Then the rank celebration modal appears once, dismissibly; triggering a recompute afterward that re-derives the same rank does not replay it

- Given a collector's action unlocks `patience-200` (`Holográfica`, `WO-05`'s catalogue)
- When the response resolves
- Then the full-screen medal celebration appears, dismissibly, following the same canonical modal pattern as the rank-up variant (`FR-12-47`)

- Given a collector's action unlocks `midnight-order` (`Primera edición`)
- When the response resolves
- Then only the unlock toast renders; no full-screen celebration appears, since `Primera edición` is below the two qualifying tiers (`FR-12-47`)

- Given a collector enables `"Ocultar mi progresión"`
- When the toggle is switched
- Then the nav entry, dashboard widget, toasts, and celebrations disappear in the same tick (optimistic), and a simulated server failure reverts the toggle with a toast explaining the failure (`AC-12-13`)

- Given a collector purges their points history
- When they confirm the permanent-action modal
- Then the ledger, unlocks, and cache are deleted, the section renders its first-run empty state on next visit, and re-enabling the app's normal accrual afterward starts from zero rather than resurrecting the purged history

- Given the Notion backfill runs against a full dev-data copy
- When the collector next opens the app
- Then every entry it wrote carries `source = BACKFILL`, every medal it unlocked is already `seenAt`-marked with no individual toast firing, a single aggregated welcome celebration names the rank and medal count, and re-running the script a second time writes nothing further (`AC-12-11`, `BACKFILL_ALREADY_APPLIED`)

## Unit Test Matrix

### toast queue

| Scenario                                   | Expected                                                        |
| ------------------------------------------ | --------------------------------------------------------------- |
| `medalsUnlocked` with two entries          | Two `addToast` calls, second fires only after the first's delay |
| `medalsUnlocked` with three entries        | Three `addToast` calls, still one at a time                    |
| `medalsUnlocked` with four or more entries | ONE `addToast` call, the collapsed burst toast (see below)     |
| `medalsUnlocked` empty                     | No `addToast` call                                              |
| Toast queue under `prefers-reduced-motion` | No slide transition; auto-dismiss timer still runs              |

### burst collapse (amendment, 2026-08-23 review)

Past three medals in one credited action the per-medal sequence is replaced by a single toast
naming the count, and the batch's qualifying-rarity unlocks do not escalate to the full-screen
celebration either. Measured rather than assumed: a collector whose history was migrated unlocks
ten phase-1 medals on their first credited action, which the queue would drain as roughly forty
seconds of stacked toasts plus a dialog behind them. `FR-12-29` promises a sequence rather than a
pile; past a readable batch size one honest count is how that promise is kept, and the album is
where the ten are actually read. Same reasoning `FR-12-43` already applies to the migrated
history's single aggregated welcome. See `fdd-12` §2.7 for the toast's anatomy and copy.

| Scenario                                            | Expected                                                       |
| --------------------------------------------------- | -------------------------------------------------------------- |
| Four or more medals in one response                 | One toast, `celebration.burst.*` copy, count named             |
| A `Holográfica` medal inside a collapsed burst      | No full-screen celebration; it is covered by the burst toast   |
| Burst toast rarity ring                             | The rarest grade in the batch                                  |
| Rank-up arriving together with a collapsed burst    | Rank celebration still shown; it is server-claimed and rare    |
| PostHog                                             | `medal_burst_toast_shown` with `medal_count`, not N `medal_toast_shown` |

### rank celebration

| Scenario                                                                     | Expected                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| `highestRankIndex` greater than `lastCelebratedRankIndex`                    | Modal opens, `lastCelebratedRankIndex` updated on show |
| `highestRankIndex` equal to `lastCelebratedRankIndex`                        | Modal does not open                                    |
| Recompute re-derives the same `highestRankIndex` after the celebration shown | Modal does not replay                                  |

### medal celebration (`FR-12-47`)

| Scenario                                                                   | Expected                                                     |
| -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Unlocked medal rarity `Holográfica`                                        | Full-screen celebration fires                                |
| Unlocked medal rarity `Firmada`                                            | Full-screen celebration fires                                |
| Unlocked medal rarity `Tirada normal`/`Primera edición`/`Edición limitada` | Toast only, no full-screen celebration                       |
| Rank-up and a qualifying medal unlock in one response                      | Both surfaces shown, sequenced, never simultaneously mounted |
| Qualifying medal inside a batch past the burst threshold                   | No full-screen celebration; the collapsed burst toast covers it |

### settings toggle and purge

| Scenario                                                  | Expected                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `toggleProgressionVisibilityAction` success               | Optimistic UI update confirmed, no revert                                        |
| `toggleProgressionVisibilityAction` server failure        | UI reverts to prior state, error toast shown                                     |
| `purgeProgressionLedgerAction` without prior confirmation | Not callable from the UI (confirmation modal gates the call)                     |
| `purgeProgressionLedgerAction` success                    | `PointLedgerEntry`, `MedalUnlock`, `UserProgress` rows deleted for the user only |

### backfill script

| Scenario                                                                 | Expected                                                                      |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Migrated `StorePayment` rows (`migratedFromOrderId IS NOT NULL`) present | One synthetic entry set per order, `source = BACKFILL`                        |
| Script run a second time                                                 | No new entries, no new `MedalUnlock` rows (`BACKFILL_ALREADY_APPLIED`)        |
| A migrated payment missing a required field                              | Whole run aborts before any write (`BACKFILL_SOURCE_INCOMPLETE`)              |
| Medal conditions satisfied by the backfilled entries                     | `MedalUnlock` rows created with `seenAt` already set, `source = BACKFILL`     |
| After the backfill                                                       | Exactly one aggregated welcome celebration recorded, no per-medal toast fires |

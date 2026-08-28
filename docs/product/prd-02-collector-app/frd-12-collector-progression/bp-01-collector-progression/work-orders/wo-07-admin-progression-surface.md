---
id: WO-07
type: WORK_ORDER
slug: admin-progression-surface
title: Admin Progression Surface
status: ACTIVE
parent: BP-01
source_features:
  - FEAT-0021
source_issue: 146
implementation_status: IN_PROGRESS
last_updated: 2026-08-23
---

# WO-07 Admin Progression Surface

## Summary

Give the two data-layer functions [`WO-01`](wo-01-progression-engine-foundation.md) shipped a place to actually be used: a `Progresión` section inside the existing admin console that reads one collector's point ledger (`FR-12-45`) and voids their points behind a confirmation with a mandatory reason (`FR-12-44`). `WO-01` deliberately shipped `voidUserProgressionPoints` and `listUserPointLedger` with no route, because `admin_audit_log` was still excluded from the production cutover; that table now exists in the schema (migration `20260723200006`) and the deploy pipeline runs `prisma migrate deploy`, so the deferral recorded in [`BP-01`](../bp-01-collector-progression.md) Risks is closed and this slice wires the route.

This is the last slice `FRD-12` was waiting on. Nothing in it invents progression behaviour: the void semantics, the recompute, the audit write and their refusal codes are already built and tested. What is new is one route, one Server Action wrapping the existing mutation behind `requireAdmin()`, and the read side that makes a total explainable before anyone reverses it.

## In Scope

- route `src/app/[locale]/(app)/admin/progression/page.tsx`, a Server Component under the existing `/admin` layout whose `requireAdmin()` gate is the real authorization boundary; `robots: { index: false, follow: false }` like every other admin route
- account lookup by username or email through a plain `?q=` server round-trip, mirroring the photo-quota console (`admin/image-intake`) so a link to a search stays shareable between administrators and no result set is held in client state
- selected collector resolved from `?user=<id>`, their ledger paginated with `?page=N` (offset pagination, page replacement, server round-trip) exactly as the audit viewer does
- read-only ledger table: civil day (`occurredOn`), rule key, entity (type plus id), points, source (`LIVE` / `BACKFILL`), and the void state with its reason. Raw `ruleKey` / `entityType` render in mono with a translated `title`, the same forensic treatment `AuditLogTable` gives `action` / `targetType`: an administrator reading a ledger needs the stored value, not a paraphrase of it
- summary block above the table: matured points, current rank name and index, highest rank reached, unlocked medal count, live entry count and voided entry count. Points only, never a monetary figure (`BR-12-01` in spirit: the admin surface inherits the same money separation the rules have)
- `Anular puntos` action opening the canonical `<Modal>` (`ADR 0008`, `tone="destructive"`, `role="alertdialog"`) with a mandatory free-text reason. It states plainly that the void covers **every live entry** the collector has, because that is what the shipped mutation does
- the void is **awaited, not optimistic**: pending state on the primary action, success or error toast through the existing `useModerationAction` coordinator, then `router.refresh()` so the recomputed summary and the newly-voided rows re-render from the server. This matches `FRD-12`'s own Lifecycle Interaction Model row for the administrative void and the treatment moderation already uses
- admin nav entry `Progresión` inside the existing `Administración` group, presentation gated by `isAdmin` like its siblings
- admin-facing reads in a new `src/lib/data/progression/adminProgressionQueries.ts`: account search, one paginated ledger page, and the overview the summary block renders. `listUserPointLedger` and `voidUserProgressionPoints` are consumed unchanged
- i18n under the existing `admin` namespace (`admin.progression.*`, `admin.nav.progression`) in `es` and `en`
- PostHog in the `ADMIN` group: `admin_progression_ledger_viewed`, `admin_progression_points_voided`

## Out of Scope

- **widening the void's scope.** The shipped mutation voids every live entry for one collector and takes no entry-id list and no date range. Adding one would change its `where` clause, its audit payload, its result shape and its five existing tests, which is a data-layer change this slice has no requirement for: `FR-12-44` asks for a void of "a user's points", not of a subset. The modal therefore asks for a reason, not a scope, and says so
- any path that grants, edits, reorders or un-voids an entry. `FR-12-45` is explicit that none exists, and the read side ships with no sibling writer
- an admin view of medals, rank overrides, or the phase-3 time-limited events
- surfacing the void inside the collector's own `Progreso` section; the collector sees the recomputed total, and the explanation lives in the audit trail
- E2E coverage. The existing progression specs cover the collector surfaces; this route is admin-only, gated behind a role the E2E fixture user does not hold, and is verified manually against dev data instead (see `## Manual Verification`)

## Requirements

- `FR-12-44` (administrative void: signed reversal, recomputes derived total **and** highest rank index, writes `admin_audit_log` in the same transaction). The data half shipped in `WO-01`; this slice ships the surface and the `requireAdmin()` boundary in front of it
- `FR-12-45` (read-only ledger view for an administrator, with no granting or editing path)
- `FR-12-11` (the recompute runs after any administrative action; inherited, the mutation recomputes inside its own transaction)
- `AC-12-16` (reversal, recomputed total, recomputed highest rank index and the audit entry all commit together). Already covered at the data layer by `voidUserProgressionPoints.test.ts`; this slice adds the action-level half: an administrator is required, and a blank reason never reaches the mutation
- `BR-12-01` (no money in the progression layer, applied here to the rendered surface)

## Blueprints

- [`BP-01`](../bp-01-collector-progression.md) — Architecture Decisions, "Admin void and the read-only ledger view are data-layer only in this blueprint", and the matching Risk. This slice is the follow-up both entries name; both are amended in the same change to record that it landed
- `.agents/rules/modal-canonical-pattern.mdc` — the confirmation uses `<Modal>` from `src/components/modules/Modal`, never a hand-rolled dialog
- `.agents/rules/optimistic-client-updates.mdc` — the documented exception: the void is awaited rather than optimistic, for the same reason the self-service purge is (irreversible, and the figure it produces is derived server-side)
- `.agents/rules/ui-visual-consistency.mdc` — the table, the pager, the search form and the empty states reuse the shapes the audit viewer and the photo-quota console already established, so the section is indistinguishable from its siblings

## Route and State Notes

- `/admin/progression` with no params is the idle state: the search form plus an empty state explaining what the section is for. It never lists every account, because an unbounded user listing is not something an audit surface should hand out by default
- `?q=<term>` searches `username` and `email`, case-insensitive, bounded by a `take` limit, ordered by username
- `?user=<id>` selects one collector; `?q=` is preserved alongside it so going back to the result list costs no re-typing
- `?page=N` pages the ledger, 1-based, non-numeric falls back to 1, and the query clamps a page past the end to the last real page, exactly like `listAuditEntries`
- pagination is plain links; no client list state exists to fall out of sync with the URL

## Technical Notes

- `AuditPager` is promoted from `admin/audit/_components/` to `admin/_components/share/AdminPager.tsx` per `project-structure.mdc`'s promotion rule, since a second admin page now needs the same control. Its props were already generic (`currentPage`, `totalPages`, three labels); only the import path and the name change, and the audit route is updated in the same change
- the paginated ledger read is a separate function rather than a `slice()` over `listUserPointLedger`. `listUserPointLedger` returns every entry a collector has and is `FR-12-45`'s named contract; loading all of them to render twenty-five is the kind of read that stays fine until the ledger is big and then is not. The select is shared between the two so they cannot drift
- the overview composes the existing `getUserProgressCache`, `RANK_LADDER` and a `MedalUnlock` count rather than calling `getProgressSummary`. The collector summary carries the merit lock, monthly groups, staleness and celebration state, none of which an administrator is asking about, and it is shaped around the collector's own visibility preferences
- `admin.progression.rules.*` / `admin.progression.entityTypes.*` are reached through a pure `_utils` module returning translation **keys**, mirroring `auditRowView.ts`. Building the key in a `_utils` rather than inline keeps the mapping unit-testable without i18n and keeps the dynamic-key surface in one reviewable place
- the ledger renders `voidedReason` verbatim. It is administrator-authored text about another user, so it stays inside the admin boundary and is never echoed to the collector or into PostHog

## As Built

- route `src/app/[locale]/(app)/admin/progression/page.tsx`, with the selected-collector branch extracted into a `SelectedCollector` Server Component in the same file so the chosen-account view reads as one unit
- `src/app/[locale]/(app)/admin/progression/_components/`: `PointLedgerTable.tsx` (server), `VoidPointsControl.tsx` (client), `ProgressionLedgerViewedCapture.tsx` (client analytics island)
- `src/app/[locale]/(app)/admin/progression/_utils/ledgerRowView.ts`: the pure key mapping for rules, entity types and sources. Rule keys are hyphenated in the catalogue and next-intl reads a dot as nesting, so `order-first-payment` is flattened to `order_first_payment`, the same shape `auditRowView.ts` uses for dotted action keys
- `src/app/[locale]/(app)/admin/_actions/voidProgressionPoints.ts` and `_schemas/voidProgressionPointsSchema.ts`
- `src/lib/data/progression/adminProgressionQueries.ts`, registered in `docs/development/lib-utilities.md`
- `AuditPager` promoted to `src/app/[locale]/(app)/admin/_components/share/AdminPager.tsx`. It gained one prop in the move: `buildHref`. The original emitted a bare `?page=N`, which is correct only when `page` is the sole query param, and a relative `?…` href REPLACES the whole query string; on this route it would have silently dropped `?user=` and bounced the administrator back to the search. The audit viewer keeps the default
- admin nav entry uses `TrendingUp`, not the `Trophy` the collector's own `Progreso` entry uses: an administrator sees both in the same drawer, and two identical glyphs would read as one destination
- new components are route-local, so `docs/design/components.md` needs no entry (the inventory guard catalogs `src/components/{core,modules}` only). Everything reused is already cataloged: `Modal`, `Card`, `Chip`, `Input`, `Label`, `Textarea`, `Button`, `EmptyState`

## Security Notes

- `requireAdmin()` runs in the `/admin` layout (route gate) **and** again inside the Server Action, because the action is independently reachable. The nav entry is presentation only, never a boundary (`BR-02-05`)
- `voidUserProgressionPoints` takes `actorId` on trust by its own documented contract; the Server Action is the component that establishes it, and it takes it from the verified session, never from the request payload
- the audit entry is written inside the void's transaction by the existing mutation. `AUDIT_WRITE_FAILED` rolls the whole void back, so no reversal can commit unrecorded; the action maps that code to an error toast rather than a success
- PostHog carries identifiers and counts only. The free-text reason goes to `admin_audit_log` and nowhere else, matching the rule the moderation and quota actions already follow
- no monetary field is read or rendered anywhere in the slice

## Assumptions

- `admin_audit_log` exists in every environment this route can run in. The table is in `prisma/schema.prisma` under migration `20260723200006` and the deploy pipeline runs `prisma migrate deploy`, which is what closes `BP-01`'s deferral
- an administrator looking up a collector already knows their username or email; there is no browse-all listing and this slice does not add one
- the ledger of a single collector stays within the range offset pagination handles comfortably, consistent with the recompute's own re-measure-at-twenty-thousand note

## Analytics

| Event                             | Where                                        | Properties                                               |
| --------------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| `admin_progression_ledger_viewed` | client, on mount of a selected collector     | none (identifiers stay out of a view event)              |
| `admin_progression_points_voided` | server, in the action after a committed void | `target_user_id`, `voided_entry_count`, `matured_points` |

## Manual Verification

Run against dev data with the owner's administrator account:

1. `/es/admin/progression` renders the idle state with the search form and no account listing.
2. Searching the administrator's own username finds the account; opening it shows the honest empty state (that account has no ledger entries).
3. Against a collector with entries: the summary reports matured points, rank and counts, and the table lists entries newest first with a working pager.
4. `Anular puntos` with a blank reason is refused inline and never calls the server.
5. `Anular puntos` with a reason commits, toasts, refreshes, and leaves every row marked voided with that reason, matured points at zero, highest rank index unchanged, and one new `progression.void` row in `/es/admin/audit`.
6. Any data created for step 3 to 5 is removed afterwards, leaving the dev database census identical.

Run on 2026-08-23 against dev data, all six steps observed. Step 3 to 5 ran against three ledger entries seeded on the verifying administrator's own account: the void marked all three with the reason and the actor, recomputed `maturedPoints` 15 to 0, left `highestRankIndex` at 1, and wrote one `progression.void` row visible in the audit viewer with actor, target and reason. Both locales and both themes were checked. Census before and after was identical (ledger 0, unlocks 0, cache 0, settings 0, `admin_audit_log` 3), so the seeded entries, the ten medal unlocks the recompute created, the cache row and the verification's own audit row were all removed.

## Unit Test Matrix

### `voidProgressionPoints.test.ts` (Server Action)

- refuses a caller who is not an administrator, and never reaches the mutation
- refuses a blank or whitespace-only reason at the schema boundary, and never reaches the mutation
- passes the **session** user id as `actorId`, not anything from the payload
- returns the recomputed figures on success and captures the analytics event with identifiers and counts only, never the reason
- maps `VOID_REASON_REQUIRED`, `USER_NOT_FOUND` and `AUDIT_WRITE_FAILED` to their refusal codes rather than to a success
- reports an unexpected failure through Sentry and a generic error, without leaking the payload

### `adminProgressionQueries.test.ts`

- account search matches username and email case-insensitively, returns nothing for a blank term, and is bounded by the search limit
- the paginated ledger orders newest first, clamps a page past the end to the last real page, and reports total count and total pages
- the overview resolves the rank key from the cached rank index, counts live and voided entries separately, and returns a first-run shape for a collector with no cache

### `PointLedgerTable.test.tsx`

- renders one row per entry with its civil day, points, source and raw rule key
- a voided entry is marked as voided and shows its reason; a live entry shows neither
- the table exposes an accessible caption and column headers

### `VoidPointsControl.test.tsx`

- the modal does not open until the action is pressed
- submitting with an empty reason shows the inline error and calls no action
- submitting with a reason calls the action once with the trimmed reason and the target user id, and disables the primary action while it runs

### Navigation gate (`navigationConfig.test.ts`)

- the `Progresión` entry is part of the admin group and points at `/{locale}/admin/progression`
- `/es/admin/progression` resolves to the `progression` admin nav id, and the audit and photo-quota routes still resolve to their own

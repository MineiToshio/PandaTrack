---
id: WO-13
type: WORK_ORDER
slug: derived-report-notice-and-flag-removal
title: Derived Report Notice and Flag Removal
status: DRAFT
parent: BP-01
source_features: []
source_issue: 137
implementation_status: IN_PROGRESS
last_updated: 2026-07-27
---

# WO-13 Derived Report Notice and Flag Removal

## Summary

Turn the public "this store has reports" warning into an automatic signal derived from the store's
open reports, and delete the manual administrator flag/unflag control entirely. `FLAGGED` is removed
from the `StoreStatus` enum, so moderation status carries lifecycle only (`PENDING` / `APPROVED` /
`REJECTED`), and the notice is computed at read time from the open-report count. The durable
principle is recorded in [ADR 0019](../../../../../design/decisions/0019-derived-trust-signals-moderation-status-lifecycle-only.md).

The product framing that drives this slice, and that the copy must carry: a report is not a judgment
about whether a store is good or bad, that is what reviews and ratings are for. A report says the
**published information** may not be trustworthy. The product's job is only to inform the buyer that
a report exists and let the buyer decide whether to trust the store. That is why one open report is
enough to show the notice: the report may well be important and only one user noticed it.

This work order spans both surfaces the flag touched: the collector store detail (owned by this FRD)
and the moderation console files (owned by [PRD-03 (FRD-02)](../../../../prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md)).
It is deliberately one slice rather than two, because the enum value cannot be dropped in one
repository state and still be referenced by the console in another.

## In Scope

### Schema and migration

- Remove `FLAGGED` from the Prisma enum `StoreStatus`, leaving `PENDING | APPROVED | REJECTED`.
- The migration is **two steps in one file**, in this order: first `UPDATE "store" SET "status" = ...`
  for every row still carrying `FLAGGED`, then the enum rewrite. Postgres cannot drop an enum value in
  place, so the enum is recreated (create the new type, `ALTER TABLE ... ALTER COLUMN ... TYPE ... USING`,
  drop the old type) and the column default is re-established. Prisma cannot auto-generate an enum
  value removal safely, so this uses the hand-written-SQL fallback of `prisma-migration-workflow.mdc`,
  followed by `prisma generate` and a green `type-check`.
- Existing `FLAGGED` rows are pre-updated to their lifecycle value using the same derivation the
  removed unflag path used: `APPROVED` when `approvedAt` (or `approvedByUserId`) is set, otherwise
  `PENDING`. See Decision D3 for the current row count.
- No new column, no counter, no `flaggedAt`. Nothing about reports is written onto `Store`
  ([ADR 0019](../../../../../design/decisions/0019-derived-trust-signals-moderation-status-lifecycle-only.md), Alternative B).

### Data layer

- Read the open-report count from `getStoreGovernanceSummary`, which the store-detail page already
  loads in the same `Promise.all` as `getStoreBySlug` and which already exposes `openReports` over
  `StoreReport` rows with `status: "OPEN"`. **Amended during implementation** (2026-07-27): the
  original wording added an `openReportCount` to `getStoreBySlug`, which would have duplicated a count
  the page already has and, worse, charged that count to `generateMetadata`, which calls
  `getStoreBySlug` and must deliberately not read reports. The notice therefore costs zero extra
  queries and the read model stays as it was.
- Derive the notice through one shared predicate rather than an inline comparison, keyed on the named
  constant `STORE_REPORT_NOTICE_THRESHOLD` (Decision D1). Both predicates live together in
  `src/lib/store/reportNotice.ts`: `hasDerivedReportNotice()` for the public notice and
  `isReportCluster()` for the queue collapse, each reading its own constant, so no call site writes a
  bare `count >= n` comparison and the two thresholds stay independent (Decision D7).
- Update `PUBLIC_VISIBLE_STORE_STATUSES` to `["PENDING", "APPROVED"]`. The constant stays: it is still
  the single point that excludes `REJECTED` from the listing where-builder, `getStoreBySlug`, and
  `getOrderableStores`.
- Remove the prior-state derivation helper used by unflag; it has no remaining caller.

### Actions and mutations

- Delete `flagStore` / `unflagStore` from `src/lib/data/stores/storeModerationMutations.ts` and the
  matching thin Server Actions under `stores/[slug]/_actions/`, plus their boundary schema entries and
  their tests.
- No new mutation is introduced. The notice has no writer.
- `resolveStoreReport` / `dismissStoreReport` are unchanged in behavior, but their action results now
  carry the store's remaining open-report count so the caller can update the notice optimistically
  (Decision D5).

### UI, collector store detail

- Remove the "Marcar con aviso de reportes" / "Quitar aviso de reportes" controls from the admin
  moderation cluster in the `DetailSidebar` **Gestion** slot. The cluster keeps `Aprobar tienda` (on a
  `PENDING` store), `Ver reportes`, and `Retirar tienda`.
- Render the derived notice banner above the detail layout for **any** viewer when
  `openReportCount >= STORE_REPORT_NOTICE_THRESHOLD`, using the rewritten copy below. It is
  independent of moderation status: a `PENDING` store with open reports shows both the pending
  disclaimer and the report notice.
- The detail hero keeps a derived `chip warning` "Con reportes" (`alert-circle`) alongside the
  lifecycle status chip. It is now a derived trust signal, not a moderation status chip.
- No "has reports" chip is added to the public listing card (Decision D6); the notice lives on the
  detail.

### UI, moderation console

- Rename the derived queue row from "flag candidate / suggested removal" to a **report cluster**
  framing. The row still appears when a store reaches `STORE_REPORT_CLUSTER_THRESHOLD` (2) open
  reports and still collapses that store's individual report rows into one.
- The report-cluster review's actions become **per-report resolve/dismiss** (reusing the existing
  `resolveStoreReportAction` / `dismissStoreReportAction`) plus `Retirar` through the shared removal
  modal and `Ver tienda`. There is no flag/unflag control.
- Rename the internal item type `flag` / `flag_candidate` to `report_cluster` in the selection search
  param (`?item=report_cluster:<storeId>`) and in the `admin_inbox_item_opened` `item_type` property
  (Decision D4).
- Rename the threshold constant `STORE_FLAG_REPORT_THRESHOLD` to `STORE_REPORT_CLUSTER_THRESHOLD`, and
  add the separate `STORE_REPORT_NOTICE_THRESHOLD`, both in `src/lib/constants.ts`.

### i18n

- Replace the `flaggedDisclaimerTitle` / `flaggedDisclaimerMessage` and `detail.flaggedDisclaimer`
  keys in `stores.json` with `reportNoticeTitle` / `reportNoticeMessage` and `detail.reportNotice`, in
  both locales, carrying the rewritten copy in the Copy section below. The old copy ("acumula reportes
  con credibilidad") is deleted, not softened: it asserts that somebody validated the reports, and
  nobody did.
- Remove the moderation action labels for flag and unflag from `stores.json`.
- Rename the console's flag-candidate strings in `admin.json` to the report-cluster framing.
- **Keep** `audit.action.store.flag` and `audit.action.store.unflag` in both locales (Decision D2).

### Analytics

- Remove `STORE.FLAGGED` (`store_flagged`) and `STORE.UNFLAGGED` (`store_unflagged`) from
  `POSTHOG_EVENTS` in `src/lib/constants.ts`.
- Add an `open_reports_remaining` property to `store_report_resolved` and `store_report_dismissed`, so
  the analytics record shows when a resolution actually cleared a store's public notice (the value
  reaching `0`). It is a count, never report text or reporter identity.

### Tests

- Unit: the notice predicate at `0`, `1`, and `2` open reports; the report-cluster derivation and row
  collapse at `2`; that the two thresholds are read from their own constants and are independently
  changeable.
- Unit: `getStoreBySlug` returns `openReportCount`, and the public governance read model is still not
  widened with reporter identity or free text.
- Unit: resolving the last open report drives the derived notice off; no store row is written.
- Migration: verified by applying it, since the enum value no longer exists afterwards and no fixture
  can hold it. `migrate dev` reported the database in sync with the schema and `migrate status` reads
  clean.
- E2E: a store with one open report shows the notice to an administrator; resolving the last open
  report clears it optimistically and it is still gone on reload; the store stays reachable
  throughout. The flag/unflag spec in `e2e/store-moderation.spec.ts` is replaced by this one.
  **Amended during implementation** (2026-07-27): the anonymous-visitor half is not covered by an E2E,
  because the store detail lives under the authenticated `(app)` segment and no anonymous route
  reaches it; the "for every viewer" behavior is instead covered by the notice being rendered from the
  same server payload for all viewers with no viewer-role condition. The `noindex` assertion is left to
  the unit level for the same reason. The console spec carried no flag assertions to remove.

### Prototypes

- `docs/product/prd-02-collector-app/frd-04-store-domain/prototype/store-domain.html`: the
  admin-on-`FLAGGED` screen is gone; the anchor is reused for the derived report-notice detail
  (`#s6-store-detail-report-notice`), and the "Marcar con reportes" button is removed from the
  admin-on-`PENDING` screen.
- `docs/product/prd-03-admin-and-moderation/frd-02-moderation-console/prototype/moderation-console.html`:
  `#review-flag` becomes `#review-cluster` with the report-cluster framing and per-report actions.

## Out of Scope

- **A bulk "resolve all reports on this store" action.** The report-cluster review uses per-report
  resolve/dismiss, reusing the existing actions. A bulk path is a later enhancement; deciding several
  independent reports with one click is exactly the shortcut worth not offering in the first cut.
- **A "has reports" chip or filter in the public store listing.** The notice is a store-detail
  surface. Adding a listing-level signal would need a denormalized counter, which
  [ADR 0019](../../../../../design/decisions/0019-derived-trust-signals-moderation-status-lifecycle-only.md)
  declines until a read actually requires it.
- **Any report-driven change to indexing.** `noindex` stays scoped to `PENDING` and is not extended,
  weakened, or made conditional on reports.
- **Reinstating a `REJECTED` store.** Unchanged from `WO-09`: removal stays terminal in this scope.
- **The report submission flow, the one-open-report-per-user invariant (`BR-04-14`), and the
  re-report-after-resolution path (`AC-04-12`).** All already shipped and untouched.
- **The audit viewer surface.** It keeps rendering historical `store.flag` / `store.unflag` rows with
  no change (owned by PRD-03, FRD-02 · `WO-03`).

## Requirements

- `FR-04-43` (amended): the public report notice is derived from the open-report count, threshold 1;
  there is no manual flag control and no `FLAGGED` status.
- `FR-04-44` (amended): resolving or dismissing an open report is what clears the notice when it was
  the store's last open report.
- `FR-04-51` (amended): the moderation mutation set no longer includes flag/unflag; `store.flag` and
  `store.unflag` remain in the audit vocabulary as retired-from-writing keys.
- `FR-02-05` (amended, PRD-03 FRD-02): the derived queue row is a report cluster at 2 or more open
  reports.
- `FR-02-16` (amended, PRD-03 FRD-02): the report-cluster review offers per-report resolve/dismiss
  plus removal, not flag/unflag.
- `FR-02-21` (amended, PRD-03 FRD-02): removal from the report-cluster review still uses the shared
  FRD-04 reason-selection modal.

Relevant business rules:

- `BR-04-24` (amended): the report notice is derived from open reports, never persisted on the store,
  never hides a store, and never affects indexing. Only removal (`REJECTED`) hides a store.
- `BR-04-04`: `noindex` applies to `PENDING` stores. Unchanged, and now the only `noindex` rule.
- `BR-04-14`: one open report per (user, store). Unchanged; it is also what bounds notice abuse.
- `BR-04-29`: every moderation mutation is gated by `requireAdmin()` and audited. Unchanged for the
  remaining mutations.
- `BR-01-05` (amended, PRD-03 FRD-01): the action key vocabulary stays stable; keys may become retired
  from writing but are never deleted.

Relevant acceptance criteria:

- `AC-04-23` (amended): the derived report notice appears and clears.
- `AC-04-24`: resolve or dismiss a report inline. Unchanged, plus the notice side effect.
- `AC-02-02` / `AC-02-09` (amended, PRD-03 FRD-02): the report-cluster row and its review.

## Blueprints

- [BP-01](../bp-01-store-public-trust-system.md) extension points:
  - data model layer: `StoreStatus` loses `FLAGGED`; no field is added.
  - query layer: `openReportCount` on the store-detail read model; `PUBLIC_VISIBLE_STORE_STATUSES`
    reduced to `["PENDING", "APPROVED"]`.
  - server action layer: the flag/unflag actions and mutations are deleted; the report resolution
    actions return the remaining open-report count.
  - UI flow layer: the derived notice banner and derived chip on store detail; the admin moderation
    cluster loses its flag controls.
- PRD-03 (FRD-02) · [BP-01](../../../../prd-03-admin-and-moderation/frd-02-moderation-console/bp-01-moderation-console/bp-01-moderation-console.md):
  the aggregate read contract's derived row becomes a report cluster; the invoke-in-place contract
  drops two of its ten action keys from the callable set.

## Confirmed Decisions

These are owner decisions, binding for implementation.

- **D1 · Public-notice threshold is 1 open report.** The constant is
  `STORE_REPORT_NOTICE_THRESHOLD = 1` in `src/lib/constants.ts`. One report is enough because the
  notice makes no accusation: it states that a report exists and has not been reviewed. Waiting for a
  second stranger to independently notice the same problem hides exactly the case worth surfacing.
- **D2 · `FLAGGED` is removed from the enum, not repurposed.** Option (b) of the mechanic choice. The
  alternative (keep the value and set it automatically from the count) was rejected because it keeps
  lifecycle and governance fused on one column and reintroduces a cache to invalidate. The audit keys
  `store.flag` / `store.unflag` are **kept** in the vocabulary and in the `audit.action.*` i18n keys,
  marked retired from writing: `auditActionTitleKey` resolves with no fallback, so deleting them would
  break the audit viewer for historical rows.
- **D3 · Migration pre-update, verified against the live data.** The migration updates existing
  `FLAGGED` rows before the enum rewrite. As of 2026-07-27 the development database holds **141
  stores, all `APPROVED`, and zero `FLAGGED` rows**, so the pre-update is expected to affect nothing
  there. It is still written and still required: the feature never shipped, but the statement must be
  correct for any environment that did carry a flagged row, and a migration that assumes an empty set
  is a migration that fails once.
- **D4 · Internal item type renamed to `report_cluster`.** The URL selection param becomes
  `?item=report_cluster:<storeId>` and the `admin_inbox_item_opened` `item_type` value becomes
  `report_cluster`. The old `flag` / `flag_candidate` values are removed rather than aliased: the
  console is not yet released, so no stored link or dashboard depends on them.
- **D5 · The report-cluster review keeps per-report actions.** Resolve/dismiss operate on one report
  at a time, reusing `resolveStoreReportAction` / `dismissStoreReportAction` unchanged. The review is
  an escalation _view_ over the same records, not a new mutation surface. `Retirar` is available as
  the decision for a store that should not stay up at all.
- **D6 · No listing chip.** The notice is a store-detail signal only. A listing chip would need a
  denormalized count on every card, which this slice explicitly does not add.
- **D7 · Two thresholds, two names.** `STORE_REPORT_NOTICE_THRESHOLD` (1, public information) and
  `STORE_REPORT_CLUSTER_THRESHOLD` (2, moderation escalation) are separate constants. They answer
  different questions and must be independently movable; a single shared constant would silently
  couple the buyer-facing notice to a queue-ergonomics tuning decision.
- **D8 · Copy is rewritten, not edited.** The shipped string "acumula reportes con credibilidad" is
  deleted. It asserts a validation that never happened. The replacement names the **information** as
  what is questioned, states that the reports are pending review, keeps the store visible, and hands
  the judgment to the reader. It never implies fraud and never characterizes the seller.
- **D9 · One slice across both FRDs.** The console files are in scope here rather than in a follow-up,
  because dropping the enum value while the console still references `FLAGGED` would not compile. The
  console's own work order ([FRD-02 · WO-02](../../../../prd-03-admin-and-moderation/frd-02-moderation-console/bp-01-moderation-console/work-orders/wo-02-moderation-inbox.md))
  is amended in place to describe the final behavior; this slice delivers the change.

## Assumptions

- The admin platform (`requireAdmin()`, `writeAuditEntry()`, `AUDIT_ACTIONS`, the durable `User.role`)
  is consumed unchanged. Removing two writers from the vocabulary does not change the vocabulary.
- `StoreReport` already carries `status` with `OPEN` / `REVIEWED` / `DISMISSED` and needs no change;
  the derived notice reads it, it does not extend it.
- `StoreDetailContent` is a Server Component and the notice banner is server-rendered from the same
  payload as the rest of the detail, so it needs no client boundary of its own.
- The `?item=` selection param is not yet in any released URL, so renaming its type token breaks
  nothing external.

## Technical Notes

- **Derivation, not caching.** The notice is computed on the store-detail read. There is exactly one
  store per detail render, so the count is one indexed aggregate and no denormalized column is
  justified ([ADR 0019](../../../../../design/decisions/0019-derived-trust-signals-moderation-status-lifecycle-only.md),
  Alternative B).
- **One predicate, two call sites.** The store detail and the moderation aggregate must not each write
  their own `count >= n` comparison. The notice predicate lives beside the constant and is imported by
  both, so the public surface and the console cannot disagree about whether a store is "reported".
- **Enum removal order matters.** The data `UPDATE` must precede the type rewrite in the same
  migration file. Reversing them fails on rows that still hold the value being dropped.
- **`noindex` is narrowed, not moved.** `generateMetadata` reverts to `status === "PENDING"` as its
  only `noindex` condition. The report count is deliberately not read there.
- **Optimistic clearing.** When an administrator resolves the last open report from the store detail,
  the notice banner and the derived chip disappear locally in the same optimistic update that removes
  the report row, per `.agents/rules/optimistic-client-updates.mdc`; the returned
  `openReportsRemaining` is the value the rollback restores from.

## UX Notes

- The notice is not a moderation status. On a `PENDING` store with open reports, the calm "en revision"
  disclaimer and the report notice both render, in that order: the lifecycle statement first, then the
  report information.
- The banner is `role="alert"` so it is announced when it appears, and it pairs its warning tint with
  an icon and a text title, never color alone.
- The admin moderation cluster now reads as two decisions instead of three: publish it (`Aprobar`) or
  take it down (`Retirar`), with `Ver reportes` as the way to act on the reports themselves. Removing
  the middle "mark it" option is the point, not a simplification: the product informs about reports
  and takes stores down; it does not publish its own verdict on a seller in between.
- Nothing in the notice or the chip characterizes the seller. The subject of every sentence is the
  information and the reports, never the store's honesty.

## Copy

The rewritten notice, in both locales. `es` is the default; the `en` equivalent is normative, not a
gloss.

| Key                   | `es`                                                                                                                                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reportNoticeTitle`   | `"Esta tienda tiene reportes por revisar"`                                                                                                                                                                                                                                 |
| `reportNoticeMessage` | `"Personas de la comunidad reportaron que la información publicada aquí podría no estar correcta, y el equipo todavía no la revisa. Un reporte no califica a la tienda: para eso están las reseñas. Sigue visible; revisa sus datos con atención y decide por tu cuenta."` |

| Key                   | `en`                                                                                                                                                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reportNoticeTitle`   | `"This store has reports pending review"`                                                                                                                                                                                                                  |
| `reportNoticeMessage` | `"People in the community reported that the information published here may not be right, and the team has not reviewed it yet. A report is not a rating of the store: reviews are for that. It stays visible; check its details and decide for yourself."` |

Derived chip (unchanged label, reclassified): `"Con reportes"` / `"Reported"`, `chip warning`,
`alert-circle`.

Console report cluster (`admin.json`): queue category `"Reportes acumulados"` /
`"Accumulated reports"`; review header tag `"{n} reportes abiertos"` / `"{n} open reports"`; actions
`"Resolver"`, `"Descartar"`, `"Retirar tienda"`, `"Ver tienda"`.

## Security Notes

- Nothing in this slice widens a read model. The notice is a **count**, and a count is already public
  through the existing community reports summary (`BR-04-12`); reporter identity and raw free text stay
  admin-only through the server-only admin data-access layer (`BR-04-13`, `BR-04-25`).
- Removing two mutations removes two authorization surfaces. Every remaining moderation mutation keeps
  its `requireAdmin()` gate and its in-transaction audit write.
- The notice is user-triggerable by design, which is an abuse surface worth naming: any authenticated
  user can raise it on any store with one report. It is bounded by the one-open-report-per-user
  invariant (`BR-04-14`), by the copy making no accusation, and above all by reports never affecting
  indexing, so the worst case is a visible notice an administrator clears in one action.

## Observability Notes

- `store_flagged` and `store_unflagged` are removed from `POSTHOG_EVENTS`; no event replaces them,
  because no user action replaces them.
- `store_report_resolved` and `store_report_dismissed` gain `open_reports_remaining`. A resolution
  where that value is `0` is the analytics signal that a public notice was cleared, which is the
  measurable outcome this slice creates.
- Unexpected migration or mutation failures are captured with Sentry through the existing wrappers;
  expected authorization and validation rejections are not.

## Dependencies

- PRD-02, FRD-04 · [WO-09](wo-09-store-approval-and-removal.md) (store approval and removal) and
  [WO-10](wo-10-report-resolution.md) (report resolution): this slice edits what they deliver. The
  flag/unflag bullets in `WO-09` are marked superseded by this work order.
- PRD-03, FRD-02 · [WO-02](../../../../prd-03-admin-and-moderation/frd-02-moderation-console/bp-01-moderation-console/work-orders/wo-02-moderation-inbox.md)
  (moderation inbox): its derived row, its item type, and its threshold constant are renamed here.
  WO-02 is amended in place to describe the final behavior.
- No new dependency on the admin platform beyond what is already consumed.

## Testing

Unit and integration (`vitest`):

- The notice predicate returns `false` at `0` open reports and `true` at `1` and `2`, reading
  `STORE_REPORT_NOTICE_THRESHOLD`.
- The report-cluster derivation emits one row and drops the store's individual report rows at
  `STORE_REPORT_CLUSTER_THRESHOLD`, and emits individual rows below it.
- Changing one threshold constant in a test does not move the other behavior, proving they are not
  the same value by accident.
- `getStoreGovernanceSummary` reports the store's open-report count and still exposes neither
  reporter identity nor free text.
- `resolveStoreReport` on a store's last open report leaves the store row untouched and reports
  `openReportsRemaining: 0`.
- `PUBLIC_VISIBLE_STORE_STATUSES` excludes `REJECTED` and contains exactly the two lifecycle values.

E2E (`playwright`, admin flows reuse `signInAsAdmin` / `shouldSkipAdminE2E`):

- An anonymous visitor opening a store with one open report sees the notice with the rewritten copy;
  the store is still listed and still reachable.
- An administrator resolves the store's last open report from the governance panel; on reload the
  notice and the derived chip are gone and the store's status is unchanged.
- An `APPROVED` store with open reports is **not** `noindex`; a `PENDING` store is, with or without
  reports.
- The moderation inbox shows one report-cluster row for a store with 2 open reports, its review offers
  per-report resolve/dismiss plus `Retirar`, and no flag control exists anywhere in the console.

## Validation

Behavioral / high-risk change (Prisma enum removal with a data migration, data-layer read model,
server actions deleted, two UI surfaces, analytics, i18n): run `npm run test`, `npm run type-check`,
`npm run lint`, and `npm run validate-build`, plus the store and admin E2E specs on a Better-Auth
trusted port (`docs/development/testing.md`).

## Notes

- GitHub tracking: slice issue `#137`, created under Epic `#68` (FEAT-0012), sequenced after
  `#131` (`WO-09`) through `#134` (`WO-12`) per `github-tracking-sync.mdc`. Because the slice also
  changes console files, cross-link it from the FRD-02 inbox slice `#129`.
- The schema change follows `prisma-migration-workflow.mdc` using the hand-written-SQL fallback, and
  is not complete until the SQL is written, applied, `prisma generate` has run, and `type-check`
  passes.
- `docs/development/database-schema.md` describes the shipped schema and was updated when this
  migration was applied (`20260727012229_drop_flagged_store_status`).
- Optimistic clearing is keyed on the resolved report's **id** rather than on a decremented counter:
  the notice count is recomputed from the server's open-report list minus the ids still in flight, so
  it stays correct when the revalidated payload lands and a failed resolution restores the notice by
  restoring its id. The action's `openReportsRemaining` remains the server-side authority and the
  analytics signal; it is the value the derived count converges on.

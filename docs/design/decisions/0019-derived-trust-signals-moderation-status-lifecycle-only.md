---
title: ADR 0019 · Moderation status is lifecycle only; trust signals are derived at read time
date: 2026-07-27
status: accepted
session: Store report notice becomes automatic and derived (2026-07-27)
owner: Sergio Minei
trigger: removing the manual admin flag/unflag control required deciding whether "this store has reports" is a persisted moderation state or a read-time derivation, a cross-feature decision consumed by PRD-02 FRD-04 and PRD-03 FRD-02
updates: docs/product/prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md, docs/product/prd-02-collector-app/frd-04-store-domain/bp-01-store-public-trust-system/bp-01-store-public-trust-system.md, docs/product/prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md
---

# ADR 0019 · Moderation status is lifecycle only; trust signals are derived at read time

## Context

The store domain persisted a `FLAGGED` value on `StoreStatus` alongside `PENDING`, `APPROVED`, and
`REJECTED`. `FLAGGED` was set and cleared by a manual administrator control (`store.flag` /
`store.unflag`), and it drove two public effects: a warning banner on the store detail, and a
`noindex` on that store's metadata.

Three problems surfaced before that control ever shipped.

1. **The state mixed two different axes.** `PENDING` / `APPROVED` / `REJECTED` describe where a store
   sits in its own lifecycle: submitted, published, taken down. `FLAGGED` describes something about a
   store's _reports_, not about the store's lifecycle position. Encoding both on one enum forced
   contradictions: a flagged store is still either pending or approved underneath, so the unflag path
   had to reconstruct the "prior" lifecycle state from `approvedAt`, and any lifecycle transition had
   to remember whether it was allowed to clobber the flag.
2. **The manual control could not keep up with the signal.** The data that justifies the notice
   (open reports) already exists and already changes on its own, through user submissions and through
   admin resolution. A manual flag is a second, hand-maintained copy of that same fact, guaranteed to
   drift: reports arrive with nobody flagging, or a flag survives after every report is resolved.
3. **The product framing was wrong.** The shipped copy said the store "acumula reportes con
   credibilidad", which asserts that somebody validated the reports. Nobody had. The owner's framing
   is the opposite and is the durable rule: _a report is not a judgment about whether the store is
   good or bad, that is what reviews and ratings are for. A report says the published information may
   not be trustworthy. The product's job is only to inform the buyer that a report exists, and let the
   buyer decide whether to trust the store._ Under that framing the notice is not a verdict an
   administrator issues, so it should not be an administrator's toggle.

## Decision

**Moderation status carries lifecycle only. Trust signals are derived at read time from the records
that already hold the facts.**

Concretely:

1. **`StoreStatus` is `PENDING | APPROVED | REJECTED`.** `FLAGGED` is removed from the enum. Nothing
   about reports is ever written onto the store row.
2. **The public "this store has reports" notice is derived**, at read time, from the store's open
   report count. Its threshold is 1 or more open reports: one report is enough to inform, because a
   single reader may be the only one who noticed something real, and the notice makes no claim beyond
   "a report exists and has not been reviewed yet".
3. **The manual flag and unflag controls are removed** from every surface. Nothing sets or clears the
   notice by hand. It appears when the first open report arrives and disappears the moment the last
   open report is resolved or dismissed, which is the action an administrator already takes.
4. **Reports never affect indexing.** `noindex` applies to `PENDING` stores only.
5. **Two named thresholds, not one.** The public-notice threshold (1) and the moderation escalation
   threshold (2, which collapses a store's individual report rows into one report-cluster row in the
   moderation inbox) are separate constants with separate names. They answer different questions and
   are free to move independently.
6. **Retired-from-writing audit keys.** The `store.flag` and `store.unflag` action keys stay in the
   shared audit vocabulary and in the `audit.action.*` i18n keys, marked retired from writing: no code
   path emits them anymore, but historical `AdminAuditLog` rows still carry them and the audit viewer
   resolves its localized action title with no fallback.

### Why `noindex` is not part of the derived signal

Removing `noindex` from the report signal is the least obvious half of this decision, so it is
recorded explicitly to stop it being re-added.

- **Deindexing is asymmetric harm.** The banner is instant in both directions: it appears when a
  report is filed and it is gone on the next render once the report is resolved. Re-indexing is not
  symmetric. Once a page is deindexed, restoring it takes days or weeks of crawl and re-evaluation
  that nobody controls. A single false or malicious report would therefore keep damaging a store's
  discoverability long after an administrator dismissed it, which is a punishment the product never
  decided to impose and cannot undo on demand.
- **`noindex` on `PENDING` is a different rule.** Not promoting content nobody has reviewed yet is
  prudence about what PandaTrack vouches for, not a sanction against the store. It also resolves
  through a normal, expected action (approval), rather than being triggered by any stranger.
- **The strong lever already exists.** For a store that is genuinely harmful, the answer is `Retirar`
  (transition to `REJECTED`), which removes it from every public surface at once. Because the product
  has a real takedown, it does not need an intermediate, slow-to-reverse SEO punishment in between.

## Alternatives considered

### A. Keep `FLAGGED` on the enum, but set it automatically from the report count

- Pros: the smallest change; every existing query, chip mapping, and i18n key keeps working.
- Cons: keeps the two axes fused on one column, so a lifecycle transition (approve, remove) and a
  governance event (a report arriving) both write the same field and can overwrite each other. It also
  needs a write on every report create and every report resolution just to keep a cached boolean in
  sync with a count that is one query away, and any missed write leaves the public surface lying.
- Why not chosen: it preserves exactly the coupling that caused the problem, and pays a
  cache-invalidation cost for a value that is trivially derivable.

### B. A separate persisted boolean or timestamp on `Store` (`hasOpenReports`, `flaggedAt`)

- Pros: removes the enum contradiction; a denormalized counter would make listing-level filtering
  cheap.
- Cons: still a cache of a count, with the same drift surface as A, and it invites a second source of
  truth for "is this store reported" that can disagree with `StoreReport`. The product has no surface
  that needs it: the notice renders on the store detail only (there is deliberately no chip in the
  public listing), so exactly one row is being read at a time.
- Why not chosen: denormalization without a read that needs it. If a listing-wide signal is ever
  added, that is the moment to reconsider, with a real query cost to point at.

### C. Keep the manual control alongside the derived notice

- Pros: lets an administrator raise a louder warning for a store they judge to be bad, independent of
  report volume.
- Cons: directly contradicts the framing above. A hand-set warning is a verdict, and the product does
  not issue verdicts about sellers; reviews and ratings are where quality is judged. It also gives two
  mechanisms for one banner, so a reader cannot tell whether the notice means "someone reported this"
  or "we decided this".
- Why not chosen: the product deliberately informs rather than judges, and a store an administrator
  has actually judged as harmful is removed, not decorated.

### D. Raise the public-notice threshold to 2 or more open reports

- Pros: fewer notices; a single report cannot put a banner on a store.
- Cons: suppresses exactly the case worth surfacing. It is entirely possible that the report is
  important and only one user noticed. Since the notice makes no accusation and explicitly says the
  reports are pending review, the cost of showing it early is low, while the cost of hiding a real
  problem until a second stranger independently notices is high.
- Why not chosen: it optimizes for the product's comfort instead of the buyer's information. The
  threshold of 2 is kept, but for the moderation queue's own escalation view, where the question
  ("does this store need a decision now") really is about volume.

## Consequences

### Positive

- One axis per field. `StoreStatus` answers only "where is this store in its lifecycle", so lifecycle
  transitions and governance events stop competing for the same column, and the unflag
  prior-state reconstruction disappears entirely.
- The notice cannot drift from reality. It is computed from `StoreReport` rows on every read, so it
  is correct by construction the moment a report is filed and the moment the last one is resolved.
- Resolving reports becomes the single moderation gesture that clears the notice, which is work an
  administrator was already going to do. There is no separate housekeeping step to forget.
- No store can be quietly deindexed by a stranger. The only action that removes a store from search
  is a deliberate, auditable takedown.
- The copy can be honest, because the product no longer has to describe reports as validated. It
  reports the fact ("there are reports, pending review") and hands the decision to the buyer.

### Negative / tradeoffs

- Removing an enum value is a schema migration with a data step: existing `FLAGGED` rows must be moved
  to a lifecycle value before the value is dropped. It is a one-way change, and re-adding a flag state
  later would be a second migration.
- The notice becomes cheap to trigger. Any authenticated user can put a banner on any store by filing
  one report, until an administrator resolves it. This is accepted deliberately: the one-open-report-
  per-user invariant caps abuse per account, the notice is explicitly non-accusatory and states the
  reports are unreviewed, and it never affects indexing, so the worst case is a visible, quickly
  clearable notice rather than durable harm.
- The derivation costs a count on the store-detail read. That is bounded to one store per render and
  is the trade taken over a denormalized counter (Alternative B).
- An administrator loses the ability to escalate a warning without removing the store. That is the
  intended narrowing: the product informs about reports and takes stores down, and it does not publish
  its own opinion of a seller in between.

## References

- `docs/product/prd-02-collector-app/frd-04-store-domain/frd-04-store-domain.md` (`FR-04-43`, `FR-04-44`, `BR-04-24`, `AC-04-23`)
- `docs/product/prd-02-collector-app/frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-13-derived-report-notice-and-flag-removal.md`
- `docs/product/prd-02-collector-app/frd-04-store-domain/fdd-04-store-domain.md` (§2.4, §5.3, §6.1)
- `docs/product/prd-03-admin-and-moderation/frd-02-moderation-console/frd-02-moderation-console.md` (`FR-02-05`, `FR-02-16`)
- `docs/product/prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md` (`BR-01-05`, retired-from-writing action keys)
- [ADR 0017](0017-admin-identity-and-access-platform.md) (the admin platform this decision narrows the action surface of)

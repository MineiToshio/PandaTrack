---
title: ADR 0023 - Split and merge live only on the image-intake review screen
date: 2026-08-02
status: accepted
session: order image intake scope correction (2026-08-02)
owner: Sergio Minei
trigger: owner decision that "Separar en productos" / "Unir productos" belong to correcting machine output, not to manual order entry, which contradicts the three-entry-point clause shipped under ADR 0021
updates: docs/product/prd-02-collector-app/frd-11-order-image-intake/frd-11-order-image-intake.md, docs/product/prd-02-collector-app/frd-11-order-image-intake/fdd-11-order-image-intake.md, docs/product/prd-02-collector-app/frd-11-order-image-intake/bp-01-order-image-intake/bp-01-order-image-intake.md, docs/product/prd-02-collector-app/frd-11-order-image-intake/bp-01-order-image-intake/work-orders/wo-03-product-split-and-merge.md
supersedes: docs/design/decisions/0021-no-autosave-and-product-breakdown-rule.md (Part 2, the "Split and merge are a prerequisite, not an enhancement" bullet, entry-point clause only)
---

# ADR 0023 - Split and merge live only on the image-intake review screen

## Context

[ADR 0021](0021-no-autosave-and-product-breakdown-rule.md) Part 2 closes with:

> Split and merge are a prerequisite, not an enhancement. […] They are bidirectional, general to
> any product, reachable from the review screen, the order detail, and order edit, all through one
> modal and one mutation, and blocked with a visible reason when the product is already inside a
> live delivery.

That shipped as written: `WO-03` wired the same `ProductSplitMergeModal` to three surfaces — the
image-intake review screen (in-memory draft), a saved order's detail (per-row shortcut behind a
pack-name heuristic), and order edit (every row, no heuristic) — with a `splitOrderItem` /
`mergeOrderItems` pair of persisted mutations behind the two saved-order surfaces.

Using it revealed that two of those three placements answer a question nobody asks there. In a
form the collector types the rows themselves. If they want two products, they type two rows;
adding and removing rows already exists and always has. Split and merge only earn their place
where the rows were written by something other than the person looking at them, which is exactly
and only the review screen: the screen whose entire purpose is correcting what the model inferred.

Carrying the operation into manual create and edit also carried a cost that manual entry never
needed: a live-delivery lookup per item on two page loads, a selection mode competing with the
grid's own keyboard model, and two persisted mutations whose transactions could reshape an order's
item set behind a `router.refresh()`.

## Decision

**"Separar en productos" and "Unir productos" exist only on the image-intake review screen**
(`IntakeReviewScreen` / `IntakeGroupCard`), operating on the in-memory draft.

- The three-entry-point clause of ADR 0021 Part 2 is **withdrawn**. Everything else in ADR 0021,
  both parts, remains in force unchanged: the no-auto-save rule, the two breakdown gates, quantity
  always 1, closed ranges only, the deterministic price split, the 200-product ceiling, and the
  asymmetry that makes the rule lean toward splitting.
- The operation is no longer a persisted mutation at all. With the draft as its only surface, it is
  a pure local transform of state the user has not saved yet, so the server action, the
  `splitOrderItem` / `mergeOrderItems` mutations, their Zod schemas, and the
  `findLiveDeliveryForOrderItem` lookup that existed only to render their blocked reason are all
  deleted rather than left unreachable. Unreachable persistence is the kind of thing someone
  re-wires by accident later.
- **The live-delivery block disappears with them, and that is not a weakening.** A draft holds no
  deliveries, so the condition the guard tested can never be true on the only surface that remains.
- Manual create and edit keep the capability they always had: adding and removing rows freely. That
  is what "separate products" means in a form.

## Alternatives considered

1. **Keep all three entry points as ADR 0021 wrote them**

- Pros: no doc churn; the correction path stays available after saving.
- Cons: two of the three surfaces offer a tool for a problem that cannot occur there — a form's
  rows are authored by the person reading them.
- Why not chosen: the owner's call. A feature that is never the right answer on a surface is
  clutter on that surface, not optionality.

2. **Keep the entry point on order detail only, drop it from create and edit**

- Pros: preserves the post-save correction path, which is where the accepted cost below lands.
- Cons: keeps the whole persisted stack (mutation, schemas, transaction, delivery guard, blocked
  copy) alive for one surface, and keeps the pack-name heuristic deciding when a control appears —
  a rule the user cannot see and does not know.
- Why not chosen: the cost it avoids is real but rare and the machinery it preserves is not small.

3. **Keep the shared modal in "persisted mode" but with no caller, for a future surface**

- Pros: cheap to re-enable.
- Cons: dead code with a live-looking database write behind it.
- Why not chosen: `.agents/rules/quality-docs-cleanup.mdc`. Git history is the archive.

## Consequences

### Positive

- One surface owns the operation, and it is the one where the rows were not written by the user.
- The order detail is read-only again over its item list, and renders fully on the server: no
  client boundary, no selection mode, no per-item live-delivery lookup on the detail or the edit
  page load.
- A whole persisted mutation path (server action, two transactional mutations, two Zod schemas, one
  read helper, the blocked-state copy in both locales) stops existing, along with the risk that a
  refusal decided mid-transaction commits what it already wrote.

### Negative / tradeoffs

- **The accepted cost, stated plainly.** ADR 0021's own asymmetry table says merging too much
  "cannot register a partial arrival, the case the product exists for", and is not reversible once
  the product is inside a delivery. That failure mode is typically discovered late: the collector
  finds out the model merged too much when a partial delivery arrives and there is no separate
  product to mark. Until now, order detail and order edit offered a split at that moment, with the
  price redistributed automatically. They no longer do. **Fixing it now means editing the order and
  rewriting the rows by hand, losing the automatic price split.** The owner knows this cost and
  accepted it: the right moment to catch a bad merge is on the review screen, before saving, and
  that is where the tool stays.
- The split-to-merge calibration signal now comes only from the review screen's
  `image_intake_group_split` / `image_intake_group_merged`. That is where the useful signal always
  lived, but the post-save events are gone, so a badly calibrated rule is measured on one surface.
- `e2e/order-split-merge.spec.ts` covered only the order-detail entry point and was deleted with
  it. The surviving draft-mode behaviour is covered at the unit level (`IntakeGroupCard`,
  `ProductSplitMergeModal`, `deduceRangeParts`, `previewEqualSplit`).

## Rollout notes

- No migration and no data change: nothing about how products are stored changed, only which
  surfaces can reshape them after the fact.
- Retired PostHog event keys `order_product_split` / `order_products_merged` are removed from
  `POSTHOG_EVENTS`. `order_split_merge_modal_opened` stays: the review screen still fires it.
- Existing orders that were split or merged through the old surfaces are unaffected.

## References

- [ADR 0021 - Never auto-save extracted data, and the product breakdown rule](0021-no-autosave-and-product-breakdown-rule.md)
- [FRD-11 Order Image Intake](../../product/prd-02-collector-app/frd-11-order-image-intake/frd-11-order-image-intake.md)
- [WO-03 Product Split and Merge](../../product/prd-02-collector-app/frd-11-order-image-intake/bp-01-order-image-intake/work-orders/wo-03-product-split-and-merge.md)

---
id: WO-03
type: WORK_ORDER
slug: product-split-and-merge
title: Product Split and Merge
status: ACTIVE
parent: BP-01
source_features: []
implementation_status: IMPLEMENTED
last_updated: 2026-08-02
---

# WO-03 Product Split and Merge

## Summary

Ship the bidirectional split and merge operation on the image-intake draft, with one modal reachable from one place: inline on the review screen's group chip, before anything is saved.

This is not an enhancement. The breakdown rule dares to split on doubt only because merging costs one tap (`BR-11-06`), so the feature must not be announced to users until this slice lands.

> **Scope corrected 2026-08-02 by [ADR 0023](../../../../../design/decisions/0023-split-merge-only-on-the-intake-review-screen.md).** As originally written and shipped, this work order also placed the operation on a saved order's detail and on order edit, backed by persisted `splitOrderItem` / `mergeOrderItems` mutations and a live-delivery guard. All of that is removed: in a form the collector writes the rows, so adding and removing rows is already the answer there, and split and merge exist to correct what a model inferred. The sections below describe the surviving scope. The accepted cost, a bad merge discovered after saving must now be fixed by rewriting the rows by hand and loses the automatic price split, is recorded in ADR 0023.

## In Scope

- One modal (canonical `Modal` per ADR 0008) opened from the review screen's group chip and nowhere else.
- Split flow: propose names deduced from a detected range ("Pack One Piece 1 al 3" proposes One Piece 1, One Piece 2, One Piece 3; "Tokyo Revengers 1-2" proposes both volumes). With no detectable range, ask how many to split into with a selector starting at 2. Proposed names and prices are editable before confirming.
- Merge flow: sum the prices of the selected products into one, with the confirmation copy stating both consequences ("Se suman sus precios en S/ 90.00 y a partir de ahora se entregan juntos, no por separado").
- Price handling on split reuses the deterministic distribution from WO-01, previewed client-side, and never alters the order total.
- The operation is a local transform of the draft held in the review screen's state. No server action, no mutation, no `orderId`, no database write.
- Wire the reverting buttons on the review screen's group chips ("Unir en uno", "Separar en N productos") to this modal.
- Copy: the control label is "Separar en productos", never "en tomos".
- Analytics: `image_intake_group_split` and `image_intake_group_merged`, each with the product count and whether the group was marked doubtful. These are the events that measure whether the breakdown rule is calibrated: if users merge far more than they split, the rule is too aggressive.

## Out of Scope

- Changing the breakdown rule itself (WO-01 owns the arithmetic and the gates).
- Any change to delivery state or to how a product enters a delivery (owned by **FRD-08**).
- Bulk split or merge across several groups at once.
- Any split or merge control on the manual create form, on order edit, or on a saved order's detail (**ADR 0023**), and therefore any persisted split/merge mutation or live-delivery guard.

## Requirements

- `FR-11-45`, `FR-11-46`, `FR-11-46a`, `FR-11-47`, `FR-11-49`. (`FR-11-48` was withdrawn by **ADR 0023**.)
- `FR-11-42`, `FR-11-44` (price behaviour reused, total untouched).
- `FR-11-88` (the two group events).
- Business rules `BR-11-05`, `BR-11-06`.
- Acceptance criterion `AC-11-17`. (`AC-11-18` was withdrawn with `FR-11-48`.)
- Cross-FRD: none remain. The live-delivery dependency on **FRD-08** and the mutation collocated with **FRD-05**'s order mutations both disappeared with the saved-order entry points.

## Blueprints

- [BP-01](../bp-01-order-image-intake.md): Architecture Decision 11, Contracts (split/merge boundary).

## E2E Acceptance Tests

- From the review screen, splitting a two-product group into three produces three editable rows and, after saving, three order products with quantity 1 each and the order total unchanged.
- Merging a split group restores one product whose price is the sum of the merged prices.
- A saved order's detail, order edit, and the manual create form show no split or merge control on any row.

Driving the review screen end-to-end requires the real extraction provider or a network-layer mock, which is disproportionate for this slice, so the two draft-mode criteria above are covered at the unit level (`IntakeGroupCard`, `ProductSplitMergeModal`, `deduceRangeParts`, `previewEqualSplit`). `e2e/order-split-merge.spec.ts` covered only the retired order-detail entry point and was deleted with it.

## Implementation Notes

- **Nothing here persists.** The modal hands the group's new shape back through `onApply`, the review screen updates its draft, and the products reach the database only when the collector presses "Crear pedido" through the ordinary order-creation path. The persisted `splitOrderItem` / `mergeOrderItems` mutations, their Zod schemas, the server action, and the `findLiveDeliveryForOrderItem` lookup were deleted rather than left unreachable when **ADR 0023** removed their last caller: an unreachable database write is what someone re-wires by accident later.
- **Split price handling is mutually exclusive, not blended.** Either every part takes the equal share previewed from the source price, or the collector's explicit per-part prices are taken exactly as typed. The order's own `totalCost` is never touched.
- **Merge price handling mirrors the same "never invent a number" rule.** The proposed merged price is the sum of the merged products' prices when all of them have one, and blank when any of them doesn't, since there would be nothing truthful to sum. The collector can override it before confirming.
- **Merge is stated as the irreversible direction** in the confirmation copy: a merged product that later needs a partial arrival cannot be un-merged automatically, only re-split, which invents a new price split rather than restoring the original one. After saving there is no re-split either (**ADR 0023**), which raises the stakes on reviewing before confirming.
- **The modal and its helpers** live at `src/app/[locale]/(app)/orders/_components/share/ProductSplitMergeModal/`, split into the modal itself, `priceSplitPreview.ts` (client-side preview of WO-01's distribution rule, so the modal shows the resulting prices before confirming), and `productBreakdownHeuristics.ts` (`deduceRangeParts`, the range detection behind the proposed names). The `looksLikePack` heuristic that used to gate the detail-page shortcut's per-row visibility went away with that shortcut.

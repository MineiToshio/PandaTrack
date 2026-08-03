---
title: ADR 0021 - Never auto-save extracted data, and the product breakdown rule
date: 2026-07-28
status: accepted
session: order image intake product definition (2026-07-28)
owner: Sergio Minei
trigger: owner-approved feature "Crear desde imagen" writes orders from model output, so the project needs one durable rule for when machine-produced data may reach the database and one durable rule for how many products a phrase yields
updates: docs/product/prd-02-collector-app/frd-11-order-image-intake/frd-11-order-image-intake.md, docs/product/prd-02-collector-app/frd-11-order-image-intake/bp-01-order-image-intake/bp-01-order-image-intake.md, docs/product/glossary.md
---

# ADR 0021 - Never auto-save extracted data, and the product breakdown rule

## Context

Two decisions in [FRD-11](../../product/prd-02-collector-app/frd-11-order-image-intake/frd-11-order-image-intake.md) are not feature details. They constrain the order domain permanently and will constrain any future machine-assisted input (a Telegram inbox, an email parser, a voice note transcriber), so they belong in a decision record rather than in one FRD.

**1. What may be written without a human seeing it.** Vision models do not report that they cannot read a number: they invent a plausible one. There are documented cases of a model fabricating an entire invoice number to satisfy a schema, and of reading `3129` where the document said `3130`. Models are far more reliable with words than with isolated numbers, because they guess from context, and a price has no context to guess from. A wrong price that the user never sees contaminates every total, budget figure, and dashboard signal, and nobody goes looking for it.

**2. How many products come out of one phrase.** This is the most consequential decision in the whole design. It determines whether a collector can register that half of what they bought arrived, which is the exact case PandaTrack exists to cover. Everything else in the feature is ergonomics; this is data correctness.

The domain constraint underneath it: `DeliveryOrderItem`, the table linking products to deliveries, has **no quantity column**. An order product is atomic for fulfilment, either fully inside a delivery or not in it at all (already stated in [`docs/product/glossary.md`](../../product/glossary.md) and in `FR-05-08a`). A quantity above 1 therefore could never be split across two deliveries.

## Decision

### Part 1: extracted data is never auto-saved

- The **"Revisa y confirma"** screen is shown on every extraction, at any confidence level, including when the model reports certainty about everything. There is no confidence threshold that skips it.
- The model **never fills a field silently**. Illegible or absent means `null`, and the contract carries per-field provenance (`read` from the source versus `assumed` by default) so the interface can mark assumed values instead of presenting them as facts. Currency in particular is never guessed: absent an explicit currency, the user's base currency is used and marked as assumed, never inferred from the store's country or from an ambiguous `$`.
- The review screen reads as a document, not a form: read values are plain text, and only assumed or missing values are focusable.
- The unit of review is the **group** (the products from one source phrase), not the row, because a fifty-row screen is scrolled and accepted rather than reviewed. Groups of 2 to 5 arrive expanded, 6 or more arrive collapsed with a summary, and a doubt on any individual row forces its group open.

### Part 2: the product breakdown rule

**A product is a thing that can arrive on a different day.** The count is decided by two ordered gates, never by the seller's vocabulary, the price, or the word "pack":

- **Gate 1, the door: can each unit be named from the source?** If not, the phrase yields exactly one product. Splitting without being able to name is inventing, and nobody wants to see "Producto 3 de 5" in their order.
- **Gate 2, only if gate 1 passed: separate pieces or a sealed object?** Pieces the seller holds separately are split; a sealed object sold indivisibly stays as one product. On genuine doubt here, **split and mark the group doubtful**.

Supporting rules:

- **Quantity is always 1.** Two copies of the same volume are two identical products of quantity 1, never one product of quantity 2.
- **Only ranges closed at both ends expand.** "Del 42 al 46" expands to five; "del 42 en adelante" yields one doubtful product.
- **Product knowledge may judge packaging, never enumerate units.** The model may use what it knows to decide whether an edition ships sealed; it may not use what it knows to decide how many volumes a collection has. The asymmetry is deliberate: a packaging error is visible and reversible in one tap, while an invented volume is undetectable because the user has no way to know it was not in their purchase.
- **No expansion cap** below the system ceiling of 200 products per order. Above the ceiling the system stops and hands the decision back; it never truncates silently.
- **Price distribution is deterministic**: an explicit unit price applies as-is; a lot total is divided by integer division with the remainder to the first products so the sum always closes exactly; with no price, all unit prices are null. In zero-decimal currencies (`CLP`, `JPY`, `KRW`) the split is computed on the major unit before multiplying by 100. The order total is never modified by the split.
- **Split and merge are a prerequisite, not an enhancement.** The rule dares to split on doubt only because merging costs one tap. They are bidirectional, general to any product, reachable from the review screen, the order detail, and order edit, all through one modal and one mutation, and blocked with a visible reason when the product is already inside a live delivery.

  > **Entry points superseded (2026-08-02) by [ADR 0023](0023-split-merge-only-on-the-intake-review-screen.md).**
  > Split and merge now exist **only on the image-intake review screen**, on the in-memory draft.
  > The order detail and order edit entry points, the persisted `splitOrderItem` /
  > `mergeOrderItems` mutations, and the live-delivery block were removed: in a form the collector
  > writes the rows themselves, so adding and removing rows is already the answer there. The
  > accepted cost is stated in ADR 0023 and follows directly from the asymmetry table below: a
  > merge the model got wrong, discovered later when a partial delivery arrives, must now be fixed
  > by editing the order and rewriting the rows by hand, losing the automatic price split.
  > Everything else in this record, including the rest of Part 2, remains in force.

The rule is deliberately **not neutral** between its two failure modes:

| Error           | Cost to the user                                                   | Reversible                                |
| --------------- | ------------------------------------------------------------------ | ----------------------------------------- |
| Split too much  | One extra checkbox when marking arrival, plus one tap to merge     | Yes, in one tap                           |
| Merged too much | Cannot register a partial arrival, the case the product exists for | No, once the product is inside a delivery |

Both "one tap" figures above describe the review screen, which since [ADR 0023](0023-split-merge-only-on-the-intake-review-screen.md) is the only surface offering either direction. After the order is saved, correcting the breakdown means editing the order and rewriting the rows by hand.

## Alternatives considered

1. **Auto-save when the model reports high confidence, review only when it is unsure**

- Pros: three taps instead of four on the clean path.
- Cons: an auto-saved order with an invented price is undetectable, and self-reported confidence is exactly what a hallucinating model gets wrong.
- Why not chosen: the difference between four taps and three is not worth one undetectable false datum. Reviewing is the feature, not a tax on it.

2. **Field-by-field confirmation of everything the model read**

- Pros: maximum caution.
- Cons: turns a four-tap flow into a form the user would abandon, and trains people to click through.
- Why not chosen: what is read once is reviewed once, on one screen. Only what was assumed or is missing earns a control.

3. **Decide the split by the seller's vocabulary (treat "pack" as one product)**

- Pros: trivially simple.
- Cons: "el pack chase de Gojo" and "Pack Tokyo Revengers 1 y 2 sellado" both say "pack" and must produce different answers (2 and 1). The word carries no information.
- Why not chosen: the real signal is whether the object is one sealed physical unit, which is what gate 2 asks.

4. **Let the model emit quantity greater than 1**

- Pros: closer to how people speak.
- Cons: `DeliveryOrderItem` has no quantity column, so such a product could never be split across two deliveries.
- Why not chosen: it is a data-model constraint, not a preference.

5. **Have the model propose an unequal price split inside a chase pack** (the rare piece is genuinely worth more)

- Pros: economically more truthful.
- Cons: it invents a number wearing the face of a datum, which is exactly what this feature must not do.
- Why not chosen: the split stays equal, marked in amber, with copy that admits the imprecision instead of hiding it: "Repartimos S/ 180.00 en partes iguales. Ajusta si una pieza vale más que la otra".

6. **Cap expansion at some safe number (for example 20 products)**

- Pros: bounds the review screen and the request size.
- Cons: breaks exactly the large orders that need the breakdown most.
- Why not chosen: replaced by the system ceiling of 200 with an explicit stop, plus collapsed groups so a large expansion is still reviewable.

## Consequences

### Positive

- No machine-produced value can reach the database without a human having had the chance to see it, and assumed values are visually distinguishable from read ones everywhere.
- Partial arrivals stay possible for the purchases that most need them, because the rule leans toward splitting.
- Money arithmetic is deterministic server code with unit tests. No number the user reads as money is produced by the model beyond what it literally read.
- The rules generalise: any future machine-assisted input path inherits both parts of this ADR without renegotiation.

### Negative / tradeoffs

- The flow is four taps, not three. Accepted explicitly.
- Splitting too eagerly produces occasional extra rows the user has to merge. That is the cheap side of the asymmetry, and `image_intake_group_split` / `image_intake_group_merged` measure it: if users merge far more than they split, the rule is too aggressive and must be recalibrated.
- The equal price split inside a mixed-value pack is knowingly imprecise.
- Split and merge must ship before the feature is announced, which couples two work orders that would otherwise be independent.

## Rollout notes

- The gates live in the extraction prompt; the arithmetic, the quantity normalisation, and the 200-product ceiling live in deterministic server code with unit tests ([WO-01](../../product/prd-02-collector-app/frd-11-order-image-intake/bp-01-order-image-intake/work-orders/wo-01-extraction-engine-and-intake-foundation.md)).
- The review screen is [WO-02](../../product/prd-02-collector-app/frd-11-order-image-intake/bp-01-order-image-intake/work-orders/wo-02-image-upload-and-review-confirm.md); split and merge is [WO-03](../../product/prd-02-collector-app/frd-11-order-image-intake/bp-01-order-image-intake/work-orders/wo-03-product-split-and-merge.md).
- Monitoring: the split-to-merge ratio is the calibration signal; `image_intake_result_confirmed` with the number of edited fields is the extraction-quality signal.

## References

- [FRD-11 Order Image Intake](../../product/prd-02-collector-app/frd-11-order-image-intake/frd-11-order-image-intake.md)
- [`docs/product/glossary.md`](../../product/glossary.md), "Producto / product is an atomic shippable unit"
- [ADR 0020 - AI extraction provider, single-pass policy, and privacy posture](0020-ai-extraction-provider-and-privacy-posture.md)

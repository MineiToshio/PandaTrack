---
id: FDD-11
type: FDD
slug: order-image-intake
title: Order Image Intake - Feature Design Document
status: ACTIVE
parent: FRD-11
last_updated: 2026-07-30
prototype: ./prototype/order-image-intake.html
design_system: ../../../design/README.md
demo_anchors:
  - "#intake-entry-share"
  - "#intake-fab"
  - "#intake-selector"
  - "#intake-empty"
  - "#intake-desktop"
  - "#intake-upload"
  - "#intake-quota-overflow"
  - "#intake-processing"
  - "#intake-review"
  - "#intake-group-collapsed"
  - "#intake-split-modal"
  - "#intake-store-new"
  - "#intake-store-ambiguous"
  - "#intake-saved"
  - "#intake-quota-exhausted"
implementation_status: IMPLEMENTED
---

# FDD-11 · Order Image Intake - Feature Design Document

> **What this document is.** The FDD is "the prototype in words": the durable, text form of
> the visual and interaction design for FRD-11. It pairs with the self-contained prototype at
> [`./prototype/order-image-intake.html`](./prototype/order-image-intake.html) (the pixel
> intent) and is governed by the design system in [`docs/design/`](../../../design/README.md)
> (the system rules).
>
> **Three-source rule.** This document **references** the design system for system-wide rules
> (tokens, components, motion, states, copy voice), **describes** what is specific to image
> intake, and **cites the prototype** for the exact pixel. Where this FDD and the design
> system disagree on a system-wide rule, `docs/design/` wins. Where this FDD and the
> prototype disagree on a feature-specific visual, this FDD wins and the prototype is a
> non-authoritative aid.
>
> **Language.** Prose is English (repository docs convention); user-facing copy is quoted
> verbatim in Spanish (`es` is the default locale). The `en` equivalents live in
> `src/i18n/locales/en/`.

---

## 1. Overview and screens covered

Image intake is the only PandaTrack surface where **the app speaks first**. Every other
screen either shows what the user entered or asks them to enter something. Here the app
proposes a whole order and asks the user to judge it. That single inversion drives every
design decision below.

Three constraints make this feature diverge from the rest of the collector workspace:

1. **The review screen is a document, not a form.** Values that were read from the image
   render as plain, non-focusable text. Only assumed values and missing values become
   controls. A screen full of inputs invites scrolling and accepting, which would defeat the
   only safeguard the feature has (`BR-11-01`).
2. **The unit of review is the group, not the row.** One phrase in a chat can legitimately
   produce fifty products. Fifty rows do not get reviewed; a group summary does.
3. **The confidence signal must never be colour alone.** Good, amber, and doubtful states
   each carry a dot, an icon, and a label, per
   [ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md).

A fourth constraint is entry symmetry: the two creation methods must read as **one flow with
two methods**, never as two rival features. The verb is said once, in the selector title, and
both paths end on the same literal CTA.

### Screens in this FDD

| #   | Screen                              | Route                                   | Prototype anchor          |
| --- | ----------------------------------- | --------------------------------------- | ------------------------- |
| 1   | Share arrival (OS share sheet)      | outside the app, into the PWA           | `#intake-entry-share`     |
| 2   | Floating button on a populated list | `/{locale}/orders`                      | `#intake-fab`             |
| 3   | Creation selector (sheet)           | overlay on Dashboard or Orders          | `#intake-selector`        |
| 4   | Empty state with inline cards       | `/{locale}/orders`                      | `#intake-empty`           |
| 5   | Desktop entry (no floating button)  | `/{locale}/orders`                      | `#intake-desktop`         |
| 6   | Upload with the passive counter     | `/{locale}/orders/new/image`            | `#intake-upload`          |
| 7   | Quota overflow (the one stop)       | `/{locale}/orders/new/image`            | `#intake-quota-overflow`  |
| 8   | Processing                          | `/{locale}/orders/new/image`            | `#intake-processing`      |
| 9   | "Revisa y confirma"                 | `/{locale}/orders/new/image`            | `#intake-review`          |
| 10  | Collapsed group, long expansion     | (review fragment)                       | `#intake-group-collapsed` |
| 11  | Split and merge modal               | (review overlay)                        | `#intake-split-modal`     |
| 12  | Inline store creation               | (review block)                          | `#intake-store-new`       |
| 13  | Ambiguous store disambiguator       | (review block)                          | `#intake-store-ambiguous` |
| 14  | Saved order (deliberately ordinary) | `/{locale}/orders/[id]`                 | `#intake-saved`           |
| 15  | Quota exhausted                     | `/{locale}/orders/new/image` + selector | `#intake-quota-exhausted` |

Routes are the proposed shape (BP-01 Runtime Components); the owning route contract is fixed
during WO-02. Requirements traced throughout: `FR-11-01 … FR-11-101`, `BR-11-01 … BR-11-22`,
`AC-11-01 … AC-11-43` (see [`frd-11-order-image-intake.md`](./frd-11-order-image-intake.md)).

---

## 2. Layout and structure per screen

All in-app screens live inside the collector **App Shell** (PUSH `Sidebar`, `Header` topbar,
content column). See
[interface-patterns.md](../../../design/interface-patterns.md). The shell is referenced, not
redefined. This FRD changes the shell in exactly two ways, both additive: a floating action
button on two routes below `1024px`, and a raised toast inset on those same routes.

The whole intake route sits in the shared reading rail (`APP_SHELL_FORM_RAIL_CLASSNAME`), which is
what keeps every screen below at a comfortable measure on a wide monitor without any of them
needing a width rule of its own.

### 2.1 Creation entry (`#intake-fab`, `#intake-selector`, `#intake-empty`, `#intake-desktop`)

**Floating action button.** Bottom-right, above the content, inside the safe area. It is a
labelled pill (plus icon plus "Nuevo pedido"), not a bare circle, because a bare circle
repeats the discovery failure the product already paid for once. It performs one action and
never fans out (`FR-11-04`, permanently rejected alternative in the FRD's Out of Scope).

Visibility matrix:

| Surface                       | Below 1024px                                                    | 1024px and above                   |
| ----------------------------- | --------------------------------------------------------------- | ---------------------------------- |
| Dashboard                     | Floating button                                                 | Primary button in the page header  |
| Orders list                   | Floating button                                                 | Primary button in the list toolbar |
| Stores, Deliveries            | None (their primary is other)                                   | Their existing toolbar button      |
| Order detail, delivery detail | None (a fixed bottom bar already exists; the two never coexist) | None                               |
| Any creation wizard           | None (already inside a flow)                                    | None                               |

**Toast clearance.** On surfaces with a visible floating button, `Toast` raises its bottom
inset by the button height plus its margin, and the list reserves matching bottom padding.
Without this, "Pedido creado" and its undo control land underneath the button, which would
break the neutral-undo contract in
[interface-patterns.md](../../../design/interface-patterns.md).

**Selector.** One component, two presentations:

- **Inline** when the surface is empty: the two cards render in the `EmptyState` body, which
  is what makes a brand-new account reach an order in three taps.
- **Overlay** when the surface has content: `Modal` on desktop, `Sheet` on mobile, per the
  canonical modal pattern ([ADR 0008](../../../design/decisions/0008-modal-enhancement.md)).
  On mobile the sheet rises next to the thumb, which is why the deliberate extra tap on the
  cold path costs so little effort.

Card anatomy: title, optional badge, description, and up to two support lines. The image card
carries the "Más rápido" badge, the "No necesitas crear la tienda antes." line, and the live
remaining-photo line. The manual card carries no badge and the "Sin límite de uso." line, so
the two cards trade a speed claim against a certainty claim rather than competing on the same
axis.

### 2.2 Upload (`#intake-upload`, `#intake-quota-overflow`)

Single content column: a pre-upload guidance block, an attach control (dropzone on desktop, a
large button on mobile), a thumbnail grid of attached photos with a remove and two reorder
controls on each, the helper line, the passive counter, and the primary "Extraer datos" action.
Each thumbnail is itself a button that opens the photo full-size in the canonical `<Modal>`
(`presentation="centered"`, same treatment as `StoreLogoZoom`): a chat screenshot is dense text at
grid scale, so this is how the collector actually reads what they attached before extracting.

The **passive counter** is a persistent chip in the header area of the block, never a dialog
and never a modal. It is information, not a gate (`BR-11-10`).

Overflow is the **only** interruption in the whole quota system: an `AlertBanner` in warning
tone stating both numbers and both remedies, with the primary action disabled until resolved.
It is an inline banner rather than a modal because the fix (remove some photos) happens on the
same screen.

**Pre-upload guidance** (`FR-11-12d`), a `<section>` labelled "Antes de subir" above the attach
control, built as two levels rather than as one list of equal-looking bullets, because the three
things it says are not equally frequent:

| Level              | Treatment                                                                                                                                                       | Content                                                                                                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 (always visible) | One `AlertBanner` `tone="info"`, `role="note"`, `Package` icon 16 px, two body lines at `--text-body`, each with its own rule in `<strong>` at `--text-primary` | (a) One order per submission: several products in it is fine, several purchases is not (`FR-11-28c`). (b) The images are read in order: the chat first, product pages last (`FR-11-12a`, `FR-11-98a`) |
| 2 (disclosure)     | Ghost `Button` `size="sm"` with a rotating `ChevronDown`, `aria-expanded` + `aria-controls`, body at `--text-caption` in `--text-muted`                         | The product page advice (`FR-11-99`): when the chat only sends a link, attach a screenshot of its product page                                                                                        |

**Why two levels and not three bullets.** The screen's job is to get photos attached; ~90 words of
instruction before the dropzone gets skipped, and a skipped instruction is the same as an absent
one. Progressive disclosure puts what every collector needs on every submission at level one and
what a minority needs at level two, with an obviously clickable trigger between them.

**Why the order rule is on level one and not one line lower.** It was briefly dropped from this
block on the reasoning that `reorderHint` beside the thumbnail grid already said it. It did not:
that hint says how to move a photo ("Arrastra las fotos para cambiar el orden..."), never that the
position is what the extraction reads, and it appears only once a second photo is attached, which
is after the collector has already chosen and arranged them. The prompt meanwhile tells the model
the images arrive in an order the collector was asked for (`FR-11-98a`), so with the line removed
the extraction was relying on an instruction the screen no longer gave. It is one sentence on
level one, not behind the trigger, because the whole batch is read wrong when it is missed and the
cost of finding out late is the batch again (§6.3's re-read arithmetic).

The banner is `info`, never `warning`: how a submission is assembled is a rule of use, not a risk
that has materialised (`ux-copy.md` §6). Its icon carries the meaning alongside the label, so the
tone colour is never the only signal (ADR 0006). The two rules share one banner and one icon
rather than stacking two banners, because they are one thought (how this batch will be read) and
two info banners in a row read as an alert wall. This is the canonical treatment for a permanent
informational note inside a flow: see `docs/design/interface-patterns.md` §6.

**Word budget.** The instructional block (heading, purpose line, both level-one rules, disclosure
trigger) is capped at **40 words per locale**, pinned by a test over the locale files; it measures
39 in Spanish and 38 in English. That is a budget for the block, not for the screen. `ux-copy.md`
§1's ~30 words is a per-screen measurement, and this screen at rest reads about 87 words in
Spanish once the passive counter, the dropzone labels, the drag/paste hint, the two helper lines
and the CTA are counted, so it does not meet that rule and never has (`FR-11-12e`). The honest
statement is that the guidance block is bounded and the screen is not. Bringing the whole screen
under ~30 words is a real recommendation for a later pass, and it would have to come out of the
duplicated quota copy (the counter, the explainer and `quota.helper` all say the same arithmetic)
and the two overlapping helper lines below the CTA, not out of the instructions.

The product-page advice previously stood alone at helper weight beside the format line, then
became the third bullet of this block. It now sits at level two, for the arithmetic in
`FR-11-99`'s shipped-deviation note and `BR-11-21`: the read is one pass over the whole batch, so
that screenshot costs one photo when it goes up with the batch and the batch all over again when
it goes up afterwards. Keeping it reachable here is what buys the collector that difference; the
review screen (§6.3) asks again, pointing at the concrete product, for the collectors who skipped
it.

**Thumbnail anatomy** (`FR-11-12b`, `FR-11-12c`). Each attached photo is a square tile carrying
a numbered position badge (top-left, with a drag-handle icon) stating where it sits in the
reading order, a remove control (top-right), and, once more than one photo is attached, a
move-earlier / move-later button pair anchored to the tile's bottom edge, each labelled with the
photo's own position and disabled at the ends of the list. Dragging a tile reorders it too, as
the pointer shortcut for the same move the buttons perform; the reorder hint line ("Arrastra las
fotos para cambiar el orden, o usa las flechas de cada foto.") only renders once a second photo
makes reordering meaningful. Every move, by either gesture, updates a visually hidden live
region announcing the photo's new position out of the total, since the grid itself rearranges
with no other spoken evidence.

**Auto-order on add** (`FR-11-12c`). When a new batch of photos is picked, dropped, or pasted,
only that batch is sorted oldest-first by file capture time before being appended after what is
already attached; photos already on screen keep whatever order the collector last set, manual or
otherwise. Sorting the whole list on every addition is rejected: it would silently undo a manual
order the collector already made, and a capture-time sort is only a first guess, since a
screenshot taken while scrolling a conversation from the bottom up produces timestamps that run
backwards.

The sort stays role-blind on purpose (`FR-11-12c`, `FR-11-98b`). A product-page screenshot taken
before the conversation and picked in the same batch lands first, which is the opposite of the
arrangement the level-one rule asks for, and no client-side heuristic can fix that: what makes an
image a product sheet is only visible in its pixels. Teaching the sort to guess would trade a rare
misordering for a frequent one. Three cheaper mechanisms absorb the case instead: the rule is
stated before the photos are picked (§2.2), the numbered tiles make the wrong position visible and
one click from fixed, and the prompt reads role from content rather than from position.

### 2.3 Processing (`#intake-processing`)

A centred block naming the three real steps ("Optimizando imágenes...", "Subiendo...",
"Leyendo la conversación...") with completed steps checked and the active one animated. Three
to eight seconds is normal, so an indeterminate spinner would read as a hang. Motion follows
[motion.md](../../../design/motion.md) and degrades to a static state under
`prefers-reduced-motion`.

When arriving from the share sheet the app lands **directly here**, with upload and extraction
already running (`FR-11-65`). There is no confirmation screen in front of it.

### 2.4 "Revisa y confirma" (`#intake-review`, `#intake-group-collapsed`)

Single reading column, ordered by what the user is most likely to need to fix:

1. **Header summary.** One sentence with the outcome and the remaining work.
2. **Store block.** Collapses to an attribute row on an exact phone match; expands to a
   disambiguator or an inline creation card otherwise (§2.5).
3. **Attribute rows** (date, currency, total). Read values are plain text. Assumed values
   carry the assumed marker and are focusable.
4. **Product groups.** One card per source phrase, preceded by the naming offer when one applies
   (below).
5. **Payments.**
6. **Totals card**: paid up front, order total, and, when the chat stated one, the shipping cost
   with a caption saying it is stored when the delivery is registered (`FR-11-52a`). The figure is
   shown rather than dropped, because a number the user saw in their own chat disappearing without
   a word is indistinguishable from a bug.
7. **Actions**, rendered once per viewport shape and never both at the same width, following the
   dual action pattern in
   [`docs/design/interface-patterns.md`](../../../design/interface-patterns.md) §1:
   - **Below `768px`**: sticky bottom bar with the primary "Crear pedido" full width and the
     secondary text link "Completar a mano" under it.
   - **`768px` and up**: an inline footer closing the document, with a top border, right-aligned,
     "Completar a mano" before "Crear pedido". A bar pinned to the viewport bottom on a wide
     monitor spans the whole window and reads as detached from the column it belongs to, which is
     the one place this screen still read as a phone layout on a desktop.

   Both copies call the same save, so the exchange-rate refusal and the saving state are identical
   whichever one the collector presses. The strip of bottom padding that clears the sticky bar is
   gated to the same breakpoint, so the desktop layout does not end in dead space.

**Group card anatomy** (`FR-11-57`), always the same four parts in the same order:

| Part               | Example                                                         |
| ------------------ | --------------------------------------------------------------- |
| What we did        | "Lo separamos en 2 productos."                                  |
| What the chat said | `Del chat: "el pack chase de Gojo"`                             |
| Why                | "Los vendieron juntos, pero pueden llegarte en días distintos." |
| The way back       | `[Unir en uno]`                                                 |

Quoting the original phrase is what lets the user judge without reopening WhatsApp. It is not
decoration; it is the evidence.

**Product page naming offer** (`FR-11-100`, `BR-11-21`), rendered above the group cards when a
product carries a link and is still weakly named. `AlertBanner` in `info` tone with an `ImagePlus`
icon, following the costed re-do offer pattern in
[`docs/design/interface-patterns.md`](../../../design/interface-patterns.md) §6:

| Part            | Content                                                                              |
| --------------- | ------------------------------------------------------------------------------------ |
| Title           | Names how many products it is about                                                  |
| Which and why   | One line per product: the name it got, and why that name is weak                     |
| What would help | A screenshot of its product page, with prices staying on the chat's side             |
| What it costs   | The photos the read already spent plus the new one, and the balance left when capped |
| The action      | Return to the attach surface, in the banner's `action` slot                          |
| The way out     | Save as is and rename later, at caption weight                                       |

It points at the row rather than at the screen, and it never gates the save: a generic notice the
collector cannot act on is noise, and a suggestion that blocks the primary path is a toll. With a
balance too small for another read the banner stays and the action is withdrawn, so the offer never
leads to a submission the quota would refuse. The offer is derived from the draft on screen, so
renaming the product through split or merge removes it without a dismiss control.

**Group density rules** (`FR-11-53` … `FR-11-56`):

| Group size                       | Arrives   | Shows                                                                                       |
| -------------------------------- | --------- | ------------------------------------------------------------------------------------------- |
| 2 to 5 products                  | Expanded  | Every row with its name and price                                                           |
| 6 or more                        | Collapsed | `One Piece 1 a 50 · 50 productos · S/ 12.00 c/u · S/ 600.00` `[Ver los 50]` `[Unir en uno]` |
| Any size, with a row-level doubt | Expanded  | The doubt is never hidden behind a summary                                                  |

Warnings aggregate upward: the amber price-split warning lives on the group chip, not repeated
fifty times. Actions on a collapsed group operate on the whole group.

**Product row anatomy.** An expanded row carries the name and the price on the first line, and
underneath them, only when there is something to show, two caption-sized affordances:

| Affordance     | Shape                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------- |
| Category       | Bordered pill: catalog icon, category name (or "Sin categoría"), chevron. Opens the picker. |
| Reference link | Accent-coloured anchor: external-link icon plus the link's host, never the whole address.   |

The category pill carries the amber `sugerida` chip whenever the value is the model's answer rather
than the collector's, because a category is inferred every time and must never read as something the
chat stated (`FR-11-90`, `FR-11-93`). Once the collector picks one, the chip goes away: it is their
answer now. A collapsed group shows the pill once, for the whole group, with the caption "Se aplica a
los N productos" (`FR-11-94`); a group whose rows disagree reads "Categorías distintas" instead of
promoting one of them.

The pill is the trigger of `<ItemTypePicker>` (`orders/_components/share/ItemTypePicker.tsx`), the
same component the manual product form's item grid uses, in its `chip` appearance and `adaptive`
presentation. Adaptive means it resolves the surface the way `<Modal>` does: the searchable popover is right for a
pointer and wrong for a thumb, and the bottom sheet is the reverse, so the component picks by
viewport rather than each caller guessing. This is what `FR-11-93`'s "the same picker" has to mean in practice — the screen previously
mounted `MobilePicker` unconditionally and served a phone drawer to desktop collectors. One picker is
open per card at a time, pointed at whichever row asked for it, so a fifty-row group never mounts
fifty option lists.

**The screen is the order form, all open** (`FR-11-51c`, `FR-11-51d`). It is built from the same
section cards as `OrderEditForm` (`orderSectionChrome.ts`): a bordered elevated card per section,
a circular Lucide bullet, a mono eyebrow, a subtitle heading, and a body indented to clear the
bullet. Three sections, nothing behind a step: **Datos del pedido**, **Productos y costos** (the tables plus
the order total), **Pagos**. The first section keeps the manual form's own field order, row for row:
store beside currency, then order date beside the expected window, with the exchange rate taking a
full-width row underneath when the order is in a foreign currency. Anything the collector already
knows from creating an order by hand is where they last saw it.

The total lives with the products, not with the dates, for the same reason the manual form puts it
there: it is the figure the rows are supposed to add up to, and two sections away from them nothing
could be compared without scrolling. The sections are **not numbered** and their icon sits inline
with the title rather than in a reserved left rail. The order forms number theirs because the
collector is walking a sequence; this screen is one order that already exists, so "PASO 1" invented
an order that is not there and the rail spent 3.75rem of every row holding a 28px circle.

This replaced a document that rendered read values as inert text and opened them through a
screen-level "Corregir" control. Both halves failed in the same way: with the values inert, nothing
said they were correctable, and the control that opened them was one more thing to discover. The
form has no such problem, because a field looks like a field.

What is lost is the claim that only the guessed values are touchable. What is kept, and is what the
header's count was always really about, is that only the guessed values are **marked**: an assumed
or missing value carries `asumido` / `falta` beside its label through `<ProvenanceValue>`, and a
read value carries nothing.

The marker alone was not enough. Everything on this screen came out of a photo, so "asumido" read as
a synonym for the whole feature rather than as a distinction, and the group chips named a verdict
("Verificar") without ever naming its cause. Both now explain themselves where they appear: a marked
field carries a hint under it saying the chat did not state the value and we filled it in, and the
group chips name the reason instead of the verdict, `Del chat` / `Precio repartido` / `No estamos
seguros`. A hint under the field rather than a tooltip, because the tooltip would be unreachable on
the surface where most of these drafts are reviewed.

**Products are the manual form's own table** (`FR-11-51d`). `OrderItemsGrid` on a pointer,
`OrderItemsMobileList` below 768px, exactly as the manual order form composes them, with
`showQuantity={false}`. The prices align into a column, every cell is visibly editable, the category
is the grid's own `Tipo` cell, and rows can be reordered, added and deleted with the shortcuts the
collector already knows.

The group evidence survives as a **slim header above each group's table** rather than as a card
around stacked rows: the tone chip, the headline, the quoted source phrase and the reason, then the
table, then the split/merge control. A card per group nested inside the section card is what made
the screen read as cramped. Groups are separated by a hairline, not by another card.

A collapsed group (`FR-11-53`) still collapses: its summary line replaces the table until "Ver los
N" is pressed, and a blank name inside it forces it open so the screen never reports a problem
about a row it is not showing.

`ProductSplitMergeModal` is untouched and stays where it is. Its job is cardinality, and correcting
text is not that. That separation is also why an inline correction does not reset `doubtful`,
`priceSplit`, or a category the collector already owns, while a split or a merge does
(`FR-11-51a`).

**Totals reconciliation** (`FR-11-58a`). Inside the totals card, an amber `AlertBanner` appears when
the products' prices do not add up to the stated total, naming both figures. It never blocks the
save, and it is deliberately not part of the header's doubt count: it is derived from the draft
rather than read from the chat, and the count has to keep matching what looks interactive. A stated
shipping cost is added before the comparison, and a draft with any unpriced row raises nothing.

**Payments** (`FR-11-51c`). Each payment renders as an amount and a date field through the same
`<ProvenanceValue>` as every other attribute, so an amount the model filled in by convention carries
its marker instead of looking exactly like one it read.

The reference link exists for the case where the buyer never typed a name, only a URL. It is shown so
the collector can see what they are naming; the host alone is shown because a marketplace URL is
often longer than the row. It opens in a new tab, isolated (`rel="noopener noreferrer"`), and it is
deliberately a plain anchor rather than a router link so nothing is ever requested from that host
before the collector asks for it (`FR-11-96`).

### 2.5 Store resolution (`#intake-store-new`, `#intake-store-ambiguous`)

Three shapes for one block, chosen by certainty:

- **Certain** (one phone match): the store picker with the match already selected. No step, no
  confirmation, nothing to click through. It used to be a read-only row with a "Cambiar" link,
  which read well as a document and costs a pointless click in a form: both shapes end at the same
  picker.
- **Ambiguous** (several candidates): a vertical single-select list with **nothing
  preselected**, plus "Ninguna, crear una nueva". The absence of a preselection is a design
  requirement, not an oversight: preselecting invites blind acceptance (`FR-11-60`).
- **Unknown** (no match): an inline creation card prefilled with the extracted name and phone,
  with a note that it will be created as pending. Nothing navigates away, because leaving the
  review screen would lose the draft.

### 2.6 Split modal (`#intake-split-modal`)

The canonical `Modal` with a list of editable name and price rows, the split note, and
Cancel / Separar. The merge variant states both consequences ("Se suman sus precios en
S/ 90.00 y a partir de ahora se entregan juntos, no por separado") because merging is the
irreversible direction once a delivery exists.

**This modal opens from the review screen and nowhere else** (**ADR 0023**). It reshapes the
group in the in-memory draft and never writes to the database, so it has no loading state, no
disabled-while-submitting state, and no blocked state: a draft has no deliveries, so the
live-delivery condition the control used to explain cannot occur here. The manual create form,
order edit, and a saved order's detail carry no split or merge control at all, because in a form
the collector writes the rows and adding or removing one is already the answer.

### 2.7 Saved order (`#intake-saved`)

Deliberately the ordinary order detail owned by
**FRD-05** ([`frd-05-order-payment-shipment.md`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md)).
No badge, no marker, no different identifier space. This screen is in the FDD precisely to
document that **nothing changes here** (`BR-11-16`).

---

## 3. Visual treatment

The feature introduces no new tokens. It applies existing ones from
[visual-foundations.md](../../../design/visual-foundations.md) and
[tokens-css.md](../../../design/tokens-css.md).

### 3.1 Colour roles

| Role                                            | Token              | Where                                                                             |
| ----------------------------------------------- | ------------------ | --------------------------------------------------------------------------------- |
| Read value                                      | `--text-primary`   | Plain-text attribute values on the review screen                                  |
| Supporting label and source quote               | `--text-secondary` | Attribute labels, the `Del chat: "..."` line                                      |
| Confident group                                 | `--text-secondary` | Group chip when the split is clean, in the neutral chip variant                   |
| Assumed value, price-split warning, low balance | `--warning`        | The assumed chip, the equal-split note, "Te quedan 6 fotos este mes."             |
| Doubtful group, quota overflow                  | `--warning`        | Doubtful group chip, the overflow banner                                          |
| Blocked or failed                               | `--destructive`    | Provider failure, the 200-product ceiling stop, no order found, validation errors |
| Neutral information                             | `--info`           | The first-time quota explainer                                                    |

**Amber is the busiest colour on this screen and that is intentional**: it is the colour of
"we guessed, look at this". It must never be the only signal
([ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md)); every
amber element carries an icon and a word.

The clean group chip is **neutral, not green**, and that is the counterpart of the same decision.
Amber only reads as "look here" if the chips that mean "nothing to do" stay quiet; a saturated
success colour on every well-read group competes with the few amber ones for exactly the attention
the header's count is directing. The chips carry neutral, amber, and destructive tints only, never
the brand accent: the accent belongs to the primary CTA and the focus rings, and a chip wearing it
would read as the thing to press.

### 3.2 Typography

Body scale from `Typography`, headings from `Heading`. Two feature-specific applications:

- The **quoted source phrase** renders in `--text-secondary` at body-small, wrapped in real
  quotation marks. It is quoted user content, not code, so it does **not** use `MonoCode`.
- **Money in group summaries** keeps tabular alignment so a fifty-product summary can be
  scanned against the order total.

### 3.3 Shape, radius, elevation

Cards and the selector follow the standard surface and radius scale. The floating action
button uses the elevated shadow level so it reads as floating above the list rather than
pinned into it. The bottom sheet and the modal follow
[ADR 0008](../../../design/decisions/0008-modal-enhancement.md) unchanged.

---

## 4. Components consumed

All from [components.md](../../../design/components.md) unless marked new.

| Component                                 | Use here                                                                                                                                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Modal` / `Sheet`                         | Selector overlay, split and merge modal                                                                                                                                                                                                     |
| `Card` / `SectionCard`                    | Selector cards, group cards, store block                                                                                                                                                                                                    |
| `Chip` / `Pill`                           | Assumed marker, passive photo counter, group state chip                                                                                                                                                                                     |
| `StatusChip`                              | The saved order's status, unchanged                                                                                                                                                                                                         |
| `AlertBanner`                             | Quota overflow, the 200-product ceiling stop, no order found, provider failure, the product-page naming offer, the totals mismatch notice                                                                                                   |
| `EmptyState`                              | Hosts the inline selector cards                                                                                                                                                                                                             |
| `Skeleton`                                | Not used: the processing screen names real steps instead                                                                                                                                                                                    |
| `Toast`                                   | Not used by this feature today: the save navigates to the created order, and split and merge are local draft transforms with a visible inverse control rather than an undo window                                                           |
| `Button` / `IconButton`                   | Primary CTA, group actions, remove-photo control                                                                                                                                                                                            |
| `Input` / `Select` / `Combobox`           | Every attribute of the draft, plus the split modal. Provenance is a marker on the label, not a difference in editability                                                                                                                    |
| `Radio` / `ReportReasonPicker` pattern    | The store disambiguator's vertical single-select shape                                                                                                                                                                                      |
| `StoreCombobox`                           | The "Cambiar" path on the store block                                                                                                                                                                                                       |
| `OrderItemsGrid` / `OrderItemsMobileList` | The products themselves, shared verbatim with the manual order form (`showQuantity={false}`)                                                                                                                                                |
| `ItemTypePicker`                          | The per-product (and per-collapsed-group) category picker, in `chip` appearance and `adaptive` presentation: literally the manual item grid's own component, so `FR-11-93` holds at every width. It delegates to `MobilePicker` below 768px |
| `ImageCropper`                            | Not used: intake never crops, it compresses                                                                                                                                                                                                 |
| `Tooltip`                                 | Not used on mobile-critical affordances                                                                                                                                                                                                     |

**Genuinely new reusable components** flagged for a `docs/design/` entry once they exist in
`src/components/` (the component inventory guard keeps
[components.md](../../../design/components.md) in lockstep with the code, so they are named
here and added there in the change that creates them):

1. **`FloatingActionButton`** (`modules/`): single-action labelled pill, breakpoint and route
   gated, with the toast-offset contract attached to it.
2. **`OrderCreateMethodSelector`** (orders subtree `_components/share/`): one component with
   an `inline` and an `overlay` presentation. Scoped to the orders subtree until a second
   domain needs a method selector.
3. **`ProvenanceValue`** (`core/`): renders a `Field<T>` as plain text when read and as a
   marked control when assumed or missing. It is the component that makes `BR-11-02`
   structurally true instead of a convention. Its `layout="row"` keeps an attribute's geometry
   identical either way, and its `editing` prop is the single hook correction mode pulls
   (`FR-11-51`) — screen-wide, never per field.

`ItemTypePicker` is not new to the codebase, but it is newly shared: it was defined inside
`OrderItemsGrid.tsx` and not exported, which is why the review screen had grown a second, phone-only
picker instead of consuming it. It now lives at
`src/app/[locale]/(app)/orders/_components/share/ItemTypePicker.tsx`. It stays in the orders subtree
rather than moving to `src/components/`: both consumers are order-shaped, and the catalog it reads is
the order item's product type.

---

## 5. Interactions and states

### 5.1 Cross-cutting states

Per [states.md](../../../design/states.md) and
[ADR 0013](../../../design/decisions/0013-cross-cutting-state-system.md).

| State   | Treatment here                                                                                        |
| ------- | ----------------------------------------------------------------------------------------------------- |
| Empty   | Orders empty state hosts the inline selector; no separate intake empty state exists                   |
| Loading | The named three-step processing block, not a skeleton, because the wait is a process and not a fetch  |
| Error   | Inline `AlertBanner` with the specific cause and the specific remedy; the attachments are never lost  |
| Blocked | Quota exhausted states the reason and offers the available path (split-blocked retired, **ADR 0023**) |

The mascot never appears in any error, confirmation, or quota state
([states.md](../../../design/states.md)).

### 5.2 The confidence traffic light

Three states, each carrying icon plus label in a `Chip`. There is no dot: `Chip` renders none in any
variant, and the icon plus the word already satisfy ADR 0006's "never colour alone". The clean state
uses the **neutral** variant rather than `success` (see §3.1).

| State    | Meaning                                       | Reverting action              |
| -------- | --------------------------------------------- | ----------------------------- |
| Clean    | Split or kept whole with confidence           | `[Unir en uno]` / `[Separar]` |
| Warning  | Something was assumed (price split, currency) | Edit in place                 |
| Doubtful | Gate 2 was genuinely ambiguous                | `[Unir en uno]`               |

These reverting actions exist only here. After "Crear pedido" the breakdown is corrected by
editing the order and rewriting the rows by hand, which loses the automatic price split. That
cost is recorded and accepted in **ADR 0023**.

### 5.2b Motion

Three moments, composed from the `docs/design/motion.md` §2 token vocabulary and no others. The
keyframe animations touch only `transform`, `opacity`, and `clip-path`; the CSS lives in
`globals.css` §14. State changes on the controls (a border revealing on hover or focus) transition
`border-color`, a paint-only property and the treatment the rest of the app already uses. Every
animation uses `animation-fill-mode: backwards` rather than `both`, because `both` retains the
reveal's final `clip-path` permanently and that clip cuts the focus ring off any field sitting on
the container's edge.

| Moment                        | Treatment                                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Group cards arrive            | Rise 6px plus fade, `--motion-base` / `--ease-out-expressive`, staggered 50ms for the first six and instant after |
| A group is opened             | `clip-path` reveal plus fade, same duration and curve                                                             |
| The order total is recomputed | Opacity cross-fade at `--motion-fast`, keyed on the figure and suppressed while correction mode is open           |

Three deliberate choices inside that:

- **The stagger is capped, and it blocks nothing.** Past the sixth card the delay is dropped rather
  than extended, because a fifty-group stagger would put four seconds between the first card and the
  last, and every card is interactive from the frame it exists.
- **Opening a group animates; closing does not.** The rows are mounted only while the group is open,
  so a collapsed group has nothing tabbable hidden under a zero-height container. The price of that
  choice is that there is no node left to animate on the way out, and a focus trap in a collapsed
  group is the worse defect.
- **The total cross-fades on the outcome of a correction, never on the keystrokes.** `motion.md`
  §6.4 asks for the count-roll on figures that change through an optimistic update, and this figure
  is not that: it changes while a person types into it, many times per correction, and animating the
  most frequent action on a screen is the anti-pattern the same document closes with. The fade is
  keyed on the formatted figure and switched off while correction mode is open, so it plays exactly
  once, when the collector closes the mode having changed the total. Keying it on the product count
  was tried first and was simply wrong: `FR-11-44` forbids the split from moving the total, so a
  split or a merge is the one event that cannot change this number.

Reduced motion is written explicitly rather than left to the global floor, per `motion.md` §4:
travel and stagger go, the opacity cross-fade stays at 150ms, so an arriving card and a changed
figure still read as events.

### 5.3 Optimistic behaviour

Per `optimistic-client-updates.mdc`. Split and merge need no optimistic handling at all: since
**ADR 0023** they only ever reshape the in-memory draft, so confirming the modal is a synchronous
local state update with nothing to revert. Saving the order uses Optimistic Confirmation: the
review screen dismisses on submit and the parent coordinator owns rollback and the error toast.

Nothing on the review screen is optimistic before "Crear pedido", because nothing is persisted
before it.

### 5.4 Quota interaction model

"Inform always, interrupt only on overflow." Exactly one interruption exists in the entire
quota system, and it is a decision the user genuinely has to make. The removed pre-confirmation
dialog is documented here so it does not get reintroduced by habit: a user who just shared five
screenshots has already decided.

### 5.5 Entry interaction

Tapping the floating button opens the selector; picking a card commits to a method. There is no
intermediate confirmation. From the manual form, the hint line is a text link, not a button,
so it never competes with the form's own primary action.

---

## 6. Copy and voice

Voice rules from [ux-copy.md](../../../design/ux-copy.md); terminology from
[`docs/product/glossary.md`](../../glossary.md). Copy is quoted verbatim in `es`.

**No em dash appears in any user-facing string**, per AGENTS.md. The `·` separator is used in
group summaries.

### 6.1 Selector (namespace `orders.createEntry`)

| Key                       | es                                                                                                                  | en                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `fabLabel`                | Nuevo pedido                                                                                                        | New order                                                                                                      |
| `title`                   | Nuevo pedido                                                                                                        | New order                                                                                                      |
| `subtitle`                | Elige cómo quieres registrarlo.                                                                                     | Choose how you want to add it.                                                                                 |
| `fromImage.title`         | Desde una imagen                                                                                                    | From an image                                                                                                  |
| `fromImage.titleLong`     | Crear desde imagen                                                                                                  | Create from image                                                                                              |
| `fromImage.description`   | Sube la captura del chat, el correo de la tienda o la foto del recibo. Nosotros llenamos el pedido y tú lo revisas. | Upload the chat screenshot, the store email or a photo of the receipt. We fill the order in and you review it. |
| `fromImage.badge`         | Más rápido                                                                                                          | Fastest                                                                                                        |
| `fromImage.noStoreNeeded` | No necesitas crear la tienda antes.                                                                                 | No need to create the store first.                                                                             |
| `manual.title`            | A mano                                                                                                              | By hand                                                                                                        |
| `manual.description`      | El formulario de siempre, en tres pasos. Sin límite de uso.                                                         | The usual three-step form. No usage limit.                                                                     |
| `wizardHint`              | ¿Tienes una captura? Créalo desde una imagen                                                                        | Got a screenshot? Create it from an image                                                                      |
| `backToManual`            | Completar a mano                                                                                                    | Fill it in by hand                                                                                             |

Two existing keys are touched: the now-unused mobile bar label is removed in the same change
(see `OQ-11-07` for which key that actually is), and `orders.create.submit` ("Crear pedido") is
reused literally as the review screen's final CTA. That reuse is what makes both paths end on
the same word.

### 6.2 Quota

| Surface                                             | es                                                                                                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passive counter                                     | Te quedan 17 fotos este mes                                                                                                                                               |
| First-time explainer                                | Cada foto que subes gasta una de tu bolsa mensual.                                                                                                                        |
| Helper beside the CTA                               | Sube las fotos que necesites. Cada foto gasta una de tu cuota mensual.                                                                                                    |
| Low balance                                         | Te quedan 6 fotos este mes.                                                                                                                                               |
| Overflow (the one stop)                             | Vas a subir 5 fotos y te quedan 3. Quita 2 o guarda el resto para el mes que viene.                                                                                       |
| Exhausted                                           | Ya usaste tus 20 fotos con IA de este mes. Se renuevan el 1 de agosto. Puedes seguir registrando pedidos a mano, sin límite y con todas las funciones. [Registrar a mano] |
| Screen purpose (`FR-11-12d`)                        | Leemos tus fotos y llenamos el pedido.                                                                                                                                    |
| One order per submission (`FR-11-12d`, `FR-11-28c`) | Sube **un pedido a la vez**: todo se junta en uno.                                                                                                                        |
| Reading order (`FR-11-12d`, `FR-11-12a`)            | Leemos **en orden**: primero el chat, las fichas de producto al final.                                                                                                    |
| Product page advice, trigger (`FR-11-99`)           | ¿Solo tienes el enlace del producto?                                                                                                                                      |
| Product page advice, body (`FR-11-99`)              | Adjunta una captura de su ficha en la tienda: de ahí sacamos el nombre. Si la añades después, hay que volver a leer todas las fotos.                                      |

The heading ("Sube la captura"), the screen-purpose line, the two level-one rules and the
disclosure trigger are the whole instructional block above the attach control: **39 words in
Spanish, 38 in English**, against the 40-word ceiling for that block (`FR-11-12e`). It is a
block budget, not the ~30-word screen budget of `ux-copy.md` §1, which this screen does not meet:
see §2.2. (The passive counter and the first-time explainer sit in the same column but are quota
copy, conditional on a cap applying, and are budgeted with the rows above.) Each bold segment is a
`t.rich` `strong` tag in the locale files, not a second string. The advice body is the disclosure's
content (§2.2, `FR-11-12d`) and is not counted, because it costs nothing until it is asked for.

The two level-one lines and the disclosure body divide the subject without repeating it: the
reading-order line says **where** the product page goes (last), the trigger asks **who** it is for
(a chat with only a link), and the body says **why** it is worth attaching now (the name comes from
it, and adding it later means reading every photo again). The body no longer repeats "al final",
which the level-one line now owns.

The word is always **foto**. Never "extracción", "crédito", or "token".

### 6.3 Review screen

| Surface                      | es                                                                                                                                                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header, with doubts          | Encontramos 6 productos por S/ 480.00. Revisa 2 datos y guarda.                                                                                                                                                                        |
| Header, clean                | Todo salió limpio del chat. Revísalo y guarda.                                                                                                                                                                                         |
| Split group                  | Lo separamos en 2 productos. Del chat: "el pack chase de Gojo". Los vendieron juntos, pero pueden llegarte en días distintos. [Unir en uno]                                                                                            |
| Sealed pack                  | Lo dejamos como un solo producto. El chat dice "Pack Tokyo Revengers 1 y 2 sellado". Viene sellado de editorial, así que llega completo o no llega. [Separar en 2 productos]                                                           |
| Split with doubt             | Lo separamos, pero no estamos seguros. Del chat: "pack de Kenshin". Si viene sellado de editorial, únelo en uno. [Unir en uno]                                                                                                         |
| Not nameable                 | No supimos qué trae. El chat dice "pack de 5 chibis sorpresa" sin decir cuáles. Lo guardamos como un producto. [Separar]                                                                                                               |
| Categories are suggestions   | Las categorías son sugerencias nuestras. Cámbialas si no encajan.                                                                                                                                                                      |
| Category, absent             | Sin categoría                                                                                                                                                                                                                          |
| Category, collapsed          | Manga · Se aplica a los 50 productos (or "Categorías distintas" when the rows disagree)                                                                                                                                                |
| Reference link               | mercadolibre.com.pe (aria: Abrir el enlace del producto en mercadolibre.com.pe, en una pestaña nueva)                                                                                                                                  |
| Naming offer, title          | Podemos nombrar mejor este producto                                                                                                                                                                                                    |
| Naming offer, host-only name | Del enlace solo sacamos el dominio: "mercadolibre.com.pe". El chat no dice qué producto es.                                                                                                                                            |
| Naming offer, doubtful       | Leímos "Figura Gojo?" del enlace de mercadolibre.com.pe, pero no estamos seguros de qué es.                                                                                                                                            |
| Naming offer, what helps     | Adjunta una captura de su ficha en la tienda y lo nombramos de ahí. El precio y el total siguen saliendo del chat, nunca de la ficha.                                                                                                  |
| Naming offer, cost           | Volver a leer gasta otra vez las 3 fotos que ya subiste, más la que añadas: la lectura es una sola pasada sobre todas las fotos. Te quedan 7 este mes.                                                                                 |
| Naming offer, no balance     | Volver a leer costaría 4 fotos (las que ya subiste más la nueva) y te quedan 2 este mes.                                                                                                                                               |
| Naming offer, action         | [Añadir la captura de la ficha]                                                                                                                                                                                                        |
| Naming offer, way out        | No es obligatorio: puedes guardar así y cambiarle el nombre después.                                                                                                                                                                   |
| Equal price split            | Repartimos S/ 180.00 en partes iguales. Ajusta si una pieza vale más que la otra                                                                                                                                                       |
| Blank product name           | El producto 3 se quedó sin nombre. Escríbele uno para poder guardar el pedido.                                                                                                                                                         |
| Totals mismatch              | Los productos no suman el total · Los productos suman S/ 480.00 y el total del pedido dice S/ 110.00. Guardamos el total tal como está: revisa cuál de los dos es el correcto.                                                         |
| Shipping cost                | Costo de envío · Lo leímos del chat, pero se guarda recién cuando registres la entrega.                                                                                                                                                |
| Product ceiling              | Son demasiados productos para un pedido. El chat pide 240 y un pedido admite 200. Únelos en un solo producto o divide la compra en dos pedidos.                                                                                        |
| No order found               | No encontramos ningún pedido en esas fotos. Suele pasar cuando la foto es solo del producto: necesitamos ver la conversación o el recibo, donde salgan los productos y los montos. Quita la foto que no corresponde y prueba con otra. |
| Multiple orders              | Esas fotos parecen de varias compras distintas. Cada pedido se sube por separado, aunque tenga varios productos. Quita las fotos que sobran y deja solo las de una compra.                                                             |

Both "No order found" and "Multiple orders" fire from the upload phase (`FR-11-28b`,
`FR-11-28c`): the review screen never renders for either, so both appear here only because they
are the terminal, most-informative copy for an otherwise successful read, the same reason the
other terminal-failure rows above sit in this table.

### 6.4 Split and merge

| Surface       | es                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| Split modal   | ¿Separar en 3 productos? Cada uno se podrá entregar por su cuenta.                                                  |
| Merge modal   | ¿Unir 3 productos en uno? Se suman sus precios en S/ 90.00 y a partir de ahora se entregan juntos, no por separado. |
| Control label | Separar en productos                                                                                                |

The blocked-control copy ("No puedes separar este producto. Ya está en la entrega DLV-...") was
retired with the saved-order entry points in **ADR 0023**: there is no surface left where a
product being inside a live delivery can block the operation.

### 6.5 Upload errors

| Cause              | es                                                             |
| ------------------ | -------------------------------------------------------------- |
| Too many images    | Son muchas fotos para una sola subida. Envía hasta 20 por vez. |
| File too large     | Una de las fotos es demasiado grande. El máximo es 2 MB.       |
| Unsupported format | Solo se aceptan imágenes PNG, JPEG y WebP.                     |
| Unreadable file    | No se pudo leer la foto. Prueba con otro archivo.              |

### 6.5b Reading failures

Two provider failures, two different promises. The line between them is whether a retry can work,
and the copy is never allowed to offer one that cannot.

| Cause                               | es                                                                                                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider unavailable (5xx, timeout) | No pudimos leer las fotos en este momento. Inténtalo de nuevo en un minuto.                                                                                    |
| Provider rejected the request (4xx) | Hubo un problema al leer las fotos. No se soluciona reintentando: ya estamos avisados y lo vamos a arreglar. Mientras tanto puedes registrar el pedido a mano. |

The second one owns the failure ("hubo un problema", not "tus fotos"), states plainly that
retrying is not the remedy, says someone already knows, and leaves the collector a way forward that
always works. It never explains the cause: a schema keyword the API refused is our problem, not a
sentence anyone should have to read.

A third failure reads differently and is worth separating. When the provider answers but the answer
does not satisfy the draft contract, the copy is "No entendimos lo que había en las fotos. Prueba
con una captura más clara" (`invalidModelResponse`), which asks the collector for a better photo.
That is only honest when the photo really is the problem, and it is not always: the same message
appears when the model breaks the contract on a perfectly legible screenshot, for instance by
answering "S/" where the contract requires `PEN`. The copy stays as it is, because a collector has
no use for the real reason, but the failure is now reported to error monitoring with its sanitized
field paths (`FR-11-24c`), so the owner sees the contract break instead of only hearing that a photo
was not understood.

### 6.6 Voice notes

Two rules carry the whole tone of the feature:

1. **Admit the guess instead of hiding it.** The equal price split says outright that a piece
   may be worth more. Copy that pretends to certainty it does not have is worse than a
   slightly awkward sentence.
2. **Quote the user's own words back.** "Del chat: ..." is what turns a claim into evidence
   and lets the user judge in one glance.

---

## 7. Responsive

Only the feature-specific behaviour is recorded here; the shell breakpoints are in
[responsive-design.mdc](../../../../.agents/rules/responsive-design.mdc) and
[interface-patterns.md](../../../design/interface-patterns.md).

| Breakpoint      | Behaviour                                                                                                                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Below `1024px`  | Floating button on Dashboard and Orders; selector as a bottom `Sheet`; the mobile bar "Nuevo" button is absent                                                                                                                                       |
| `1024px` and up | No floating button; selector as a `Modal`; entry is a primary toolbar or header button                                                                                                                                                               |
| Below `640px`   | Group rows stack name over price; the group summary keeps its numbers right-aligned so the column survives                                                                                                                                           |
| Below `768px`   | The review actions are a fixed bottom bar, with the content reserving a strip of padding to clear it, and every focusable descendant carrying an equal `scroll-margin-bottom` so a field scrolled into view stops above the bar rather than under it |
| Below `768px`   | Every tap target on the review screen is at least 44px: the category pill, the reference link, and each inline correction field relax to the denser desktop geometry only from `md` up                                                               |
| Below `640px`   | An expanded row's correction fields stack, name over price; from `sm` up they share one line with the price right-aligned                                                                                                                            |
| `768px` and up  | The review actions become an inline right-aligned footer at the end of the content; the reserved strip is gone                                                                                                                                       |
| Any             | The review screen is a single column at every width; it never becomes a two-column form                                                                                                                                                              |

The upload thumbnail grid reflows from four columns to two. The processing block is centred and
identical at every width. Nothing in this feature scrolls horizontally.

---

## 8. Accessibility (FRD-11 specifics)

Beyond the system baseline in [ADR 0006](../../../design/decisions/0006-color-blindness-icon-label-contract.md)
and the accessibility rule:

- **Read versus assumed must not rely on colour.** An assumed value carries a visible word
  ("asumido") and an icon, not only an amber tint. A screen reader must announce the assumed
  state as part of the field, not as decorative text.
- **The confidence traffic light** carries dot, icon, and label together in all three states.
- **The floating action button** is a labelled control with a visible text label, is reachable
  in the tab order after the main content, and has a touch target of at least 44px. It must
  not trap focus or overlay the last actionable row (hence the reserved bottom padding).
- **Group collapse** uses a real disclosure pattern with `aria-expanded`; "Ver los 50" states
  the count so the control is meaningful out of context.
- **The disambiguator** is a radiogroup with no preselection, with an accessible group label
  carrying the question, and targets of at least 44px per option.
- **The processing screen** announces step transitions politely, so a screen-reader user knows
  the wait is progressing rather than hung.
- **The quota counter** is informational text, not an alert, and must not interrupt focus when
  it changes.
- **The category control names the row it belongs to.** Its accessible name states which product
  (or that it covers the whole group) and the current category, so a fifty-row group does not
  present fifty identically named buttons. The `sugerida` marker is a word, never a tint alone.
- **The reference link says where it goes and that it leaves.** Its accessible name carries the
  host and the fact that it opens in a new tab, since the visible text is only a host name.
- **Attachment reorder is keyboard- and touch-reachable, and speaks its own result.** The
  move-earlier / move-later buttons on every thumbnail are labelled with that photo's own
  current position, are disabled rather than hidden at the ends of the list, and perform the
  identical move a pointer drag does, since native HTML drag events never fire on a touch
  screen. Every reorder, from either gesture, updates a visually hidden live region announcing
  the new position out of the total, because the grid itself rearranges with no other spoken
  evidence (`FR-11-12b`).

---

## 9. Sources and provenance

- **Pixel intent**: [`./prototype/order-image-intake.html`](./prototype/order-image-intake.html)
  (self-contained, opens standalone, light and dark, default palette Velvet). Non-authoritative
  where it disagrees with this document.
- **System rules**: [`docs/design/`](../../../design/README.md), specifically
  visual-foundations, tokens-css, interface-patterns, components, motion, states, ux-copy, and
  ADRs 0006, 0008, 0011, 0013, 0014.
- **Feature decisions**:
  [ADR 0020](../../../design/decisions/0020-ai-extraction-provider-and-privacy-posture.md) and
  [ADR 0021](../../../design/decisions/0021-no-autosave-and-product-breakdown-rule.md).
- **Functional contract**: [`frd-11-order-image-intake.md`](./frd-11-order-image-intake.md) and
  [`bp-01-order-image-intake`](./bp-01-order-image-intake/bp-01-order-image-intake.md) with its
  work orders.
- **Terminology**: [`docs/product/glossary.md`](../../glossary.md).

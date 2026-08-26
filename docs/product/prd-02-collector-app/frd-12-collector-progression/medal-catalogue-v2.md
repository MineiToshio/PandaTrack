# Medal catalogue v2, and the art relanguage (FRD-12)

**Status: approved by the owner, implemented and shipped, art included (2026-08-26).** The
catalogue shipped first: `medalCatalogue.ts` and `medalEvaluation.ts` carry all 28 rows with their
resolvers, the six new condition keys are implemented, the merit-lock denominator counts 28, and
`progress.json` carries the names, hints and lore in both locales. The ART shipped later the same
day: the remaining twelve pieces were rendered, all 28 masters passed QC, `public/medals/` now holds
the 28 published files, every catalogue row carries its `imageKey`, and the retired
`store-mapped-1.png` was deleted (sections 9 and 10). The owning product docs were updated in the same change, so this file is the
rationale record rather than the specification of record: the catalogue lives in
[`frd-12-collector-progression.md`](./frd-12-collector-progression.md) `FR-12-20`, the merit lock in
`FR-12-17`, the album's visual treatment in
[`fdd-12-collector-progression.md`](./fdd-12-collector-progression.md) §2.5 and §3.1, and the
ordering-versus-capability correction as a dated amendment on
[ADR 0040](../../../design/decisions/0040-medals-grant-no-points-and-are-never-revoked.md).

Every path below that starts with `art-drafts/` is relative to this file's own folder, beside the
rank rounds `v3` to `v6`. The single review sheet the owner decided from is
`art-drafts/medals-v2/medals-v2-board.png`.

**Section by section, what landed.**

| Section                          | Status                                                                                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Summary of what changes       | Landed in full, and is the shipped shape of the album                                                                                                     |
| 2. The ranks' language           | Approved; binding on the artwork, which is now rendered, QC'd and published                                                                               |
| 3. The rarity system             | Approved as the ART language. The app's rarity ring, seal and chip (`ADR 0036`, `FR-12-21`) are unchanged and were never part of this proposal            |
| 3b. The measured ladder          | Recorded as the QC baseline, and the measure the full batch was accepted against (section 8)                                                              |
| 3a. The series channel           | Approved; art-side only, the plate shapes of `medal-art-guide.md` §0 are kept                                                                             |
| 4. "Próximamente" ends           | Landed. Every condition has a resolver, nothing is catalogued as a later phase, and no album surface renders the upcoming state                           |
| 4a. The `first-store` correction | Landed (`STORES_ORDERED_2`)                                                                                                                               |
| 4b. The merit lock               | Landed. The denominator is 28 with nothing excluded, so ranks 9 and 10 ask for 13 and 17 medals (`FR-12-17`)                                              |
| 5. Series sizes                  | Landed: 8, 4, 4, 4, 4, 4                                                                                                                                  |
| 6. The catalogue, all 28         | Landed, including the `store-mapped-1` replacement and the four new rows. One draft name changed on the way in: `first-preorder` ships as `"Pre-reserva anotada"`, not `"Preventa anotada"`, because `pre-reserva` is the registered Spanish term in `docs/product/glossary.md` (`BR-12-19`) |
| 7. Motif uniqueness              | Art record, unchanged                                                                                                                                     |
| 8. QC and what is blocking       | Art record. The three tests were run over all 28 and the batch passed                                                                                    |
| 9. Where the draft art lives     | Rewritten below: 28 of 28 rendered and published to `public/medals/`                                                                                     |
| 10. What is still open           | Rewritten below, because most of what it listed as undecided now is decided and built                                                                     |

This document answers four requests the owner made in one sitting:

1. _"Los diseños de las medallas no me gustan mucho. Podríamos tomar el mismo estilo de los rangos,
   el estilo gráfico visual, para que esté alineado."_ Section 2 and 3.
2. _"Hay medallas que salen PRÓXIMAMENTE. ¿Por qué no implementamos desde ahora esas medallas? No le
   veo sentido dejarlas en próximamente."_ Section 4.
3. _"Podemos hacer que todas tengan por lo menos CUATRO para que se complete toda la fila."_
   Section 5.
4. _"Hazme UNA SOLA IMAGEN con la propuesta de la plancha."_ `medals-v2-board.png`.

It also solves the design problem those requests create and that nobody asked about, which is
section 3: today the album communicates RARITY by changing the DRAWING STYLE, so a "primera edición"
medal is literally a black and white manga drawing. Move all 28 pieces into the ranks' one painted
style and that channel disappears. Rarity needs a new code, and it has to survive greyscale and
32 px.

## 1. Summary of what changes

| Axis                | Today                                         | Proposed                                                    |
| ------------------- | --------------------------------------------- | ----------------------------------------------------------- |
| Style               | Five different drawing styles, one per rarity | One painted RPG style for all 28, the ranks' language       |
| Rarity is read from | The drawing style                             | Frame METAL plus piece COUNT plus LIGHT level (section 3)   |
| Series is read from | Plate shape                                   | Plate shape (unchanged) plus enamel FIELD colour (new)      |
| Catalogue size      | 24, of which 12 shipped and 12 "próximamente" | 28, all 28 shipped and evaluable today                      |
| Shortest series     | 3 medals (explorer, chronicler, secrets)      | 4, and `first-steps` grows 7 to 8 so both its rows are full |
| Non-controllable    | 1 (`store-mapped-1` waits on a stranger)      | 0, that row is replaced                                     |
| Merit lock          | 45 percent / 60 percent of 12 shipped         | Same fractions, of 28. Ranks 9 and 10 need 13 and 17 medals |

Four medals are new, one is replaced, one has its condition corrected, twelve move from phase 2 to
phase 1, and every one of the 28 gets new artwork. No medal is deleted, no `medalKey` already
written to `MedalUnlock` disappears except `store-mapped-1`, which no collector can hold today
because it was never shipped.

## 2. Why the medals move to the ranks' language, and how they stay a different family

The ten ranks are painted, semi-realistic RPG artefacts: real materials, bevels, one dramatic light,
no drawn outline (`rank-art-guide.md` section 1b). The 24 medals are flat cel illustrations with a
heavy black keyline over a comic sunburst. Side by side on the same `Progreso` page they read as two
products. That is the complaint, and it is correct.

So the medals adopt the ranks' STYLE spine verbatim: the same `STYLE` paragraph, the same
`COMPOSITION` discipline, the same ban list, the same "no drawn outline, separation comes from value
and bevel" rule. What they must NOT adopt is the ranks' identity, or the two families collapse into
one. Four rules keep them apart, and all four are checkable rather than felt:

1. **A medal is ONE solid plate. A rank is an assembly.** The medal silhouette is a single closed
   line with no gap, no slot and no daylight anywhere inside it, and nothing sticks out of the
   geometric plate: no wings, no laurel, no crown, no spires, no foot, no ribbon, no chain. This is
   measurable with `art-drafts/medals-v2/qc.py`: measured on the sample, the medals sit between 0.00
   and 0.12 `gaps/row`, against 0.55 to 1.94 for ranks 5 to 10. The metric proves a medal never grows
   rank hardware. It does NOT separate a medal from ranks 1 to 4, which are plates too (they measure
   0.04 to 0.22); that separation is carried by metal, field, milled edge and motif register instead,
   and it is checked by eye against the real PNGs.
2. **A medal's silhouette never changes within its series, and a rank's changes at every rung.** The
   shape ladder is the whole point of the rank set; the shape constancy is the whole point of the
   album page.
3. **Different subject register.** The ranks are one mythology: a crystal's life, a blade, a
   grimoire, an orb, a helm, keys, a creature. The medals are the collector's own world cast as
   treasure: a crate, a coin pouch, an anchor, a lighthouse, a shelf, a satchel, a map, a bell. Put
   plainly: **the ranks are the legend, the medals are the hoard.** A rank says what you are; a medal
   says what happened.
4. **No creature, ever, on a medal.** Rank 10 is the only living thing in the whole product, and that
   is what makes it feel unreachable. That costs `midnight-order` its owl, which is why its motif
   changes (section 6).

Two collisions were found and fixed by this pass, both invisible until the medals became painted
objects:

| Collision                                                                                           | Fix                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rank 1 `kohai` is a bronze DISC. `first-steps` medals are DISCS.                                    | No medal grade uses bronze, and every medal carries a milled (reeded) coin edge no rank has. Rank 1's field is matte grey stone; `first-steps` is glassy amber enamel. |
| Rank 6 `limited-run-curator` is an HOURGLASS. Three of the four `the-wait` medals were hourglasses. | `the-wait` is rebuilt around a sea crossing (anchor, moon over waves, lighthouse). The hourglass now belongs to the ranks alone.                                       |

## 3. The rarity system, which is the real design problem

Rarity used to be the drawing style. In one painted style it becomes what it is on the ranks: what
the thing is MADE of, how many pieces are on it, and how much light it has. Three channels, so it
degrades gracefully: at 32 px only the first survives, at 64 px the second appears, at full size the
third does the emotional work.

| Rarity        | Frame metal                                 | Rim structure                                                 | Light                                         | Reads at 32 px greyscale as                         |
| ------------- | ------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------- |
| `normal`      | Blackened iron, warm grey, matte, sooty     | ONE plain band, milled outer edge                             | None                                          | The DARKEST rim                                     |
| `first-print` | Polished brass and red copper               | ONE band plus EXACTLY FOUR domed rivets                       | None                                          | A mid rim with four bumps                           |
| `limited`     | Satin silver steel, brushed                 | TWO concentric bands with a dark seam between them            | ONE contained spark on the motif              | A LIGHT DOUBLE rim                                  |
| `holo`        | Pale silver under a prismatic crystal glaze | ONE band cut into EXACTLY EIGHT flat facets                   | A clear glow, contained                       | A faceted rim and a LIT centre                      |
| `signed`      | Warm antique gold, polished                 | TWO bands plus ONE amber topaz cabochon set into the top edge | Full aura, one thin line on the outer contour | A bump on the top edge and a traced lit outline     |

Four things make this system worth adopting rather than merely workable:

- **The metal ladder is the rarity ring's own ladder.** `--rarity-normal` is neutral grey,
  `--rarity-first-print` is amber (hue 92), `--rarity-limited` is slate blue (hue 230),
  `--rarity-holo` is indigo violet (hue 265), `--rarity-signed` is antique gold (hue 48). Iron,
  brass, silver steel, prismatic crystal and antique gold land on exactly those five casts, so the
  ring the app paints and the frame in the artwork stop being two unrelated signals.
- **It is built as a value ladder, because greyscale has to carry it.** `MedalStage` renders a LOCKED
  medal of any grade as that same art desaturated, so a grade that only exists in colour disappears
  the moment the collector has not earned the piece yet. Iron to brass to silver steel to crystal is
  monotone ascending; warm gold is where the ladder bends back, which section 3b measures rather than
  waves at.
- **The count channel is bounded.** Four rivets, two bands, eight facets, one cabochon. The rank
  round's rule 5 exists because unbounded ornament ("a wreath", "filigree") turns into a smear at
  thumbnail size. Every ornament here carries a number.
- **Only the top grade changes the silhouette.** The cabochon on `signed` is the one piece that
  breaks the plate's outline, and it stays inside the plate's own bounding circle so the app's
  circular crop cannot clip it. One grade, one break: the same logic that makes rank 10 a creature.

The light ladder is rationed exactly like the ranks': nothing on `normal` and `first-print`, one
spark on `limited`, a clear glow on `holo`, a full aura on `signed`, and at every level **the light
may light the medal's own surfaces and it may never leave the outer contour**. No bloom, no haze, no
rays, no halo outside the plate.

### 3b. The ladder, measured at 32 px in greyscale, including where it is still weak

Not argued, measured. Each grade's sample was shrunk to 32 px, desaturated, and split into its rim
ring and its plate centre; the numbers are mean luminance out of 255.

| Grade         | Sample            | Rim  | Plate centre | Gap to the grade below |
| ------------- | ----------------- | ---- | ------------ | ---------------------- |
| `normal`      | `clean-record-1`  | 80   | 139          | baseline               |
| `first-print` | `store-charted-1` | 109  | 90           | 28                     |
| `limited`     | `reviews-5`       | 139  | 78           | 31                     |
| `holo`        | `clean-record-10` | 147  | 117          | 8                      |
| `signed`      | `year-streak`     | 86   | 108          | 61                     |

Two things this exposes, and neither is visible by eye on the board:

1. **`holo` and `limited` have almost the same rim** (147 against 139). They are still told apart, but
   by the OTHER channel: the holo plate centre is lit (117 against 78), a 39 point difference, plus the
   eight facets. So the rim alone does not carry that step, and any future holo medal whose motif is
   not visibly lit will collapse into `limited`. The "clear glow" is load bearing, not decoration.
2. **`signed`'s rim is dark in greyscale** (86, against `normal`'s 80). Warm antique gold desaturates
   to a midtone, which is the one place the metal ladder is not monotone. Today it survives because
   `signed` is the only star plate and carries the cabochon and the aura, but that is luck rather than
   system. The fix, if the direction is approved: keep the warm gold hue for the ring alignment and
   push the metal to a POLISHED bright gold with a much stronger specular on the rim, and make the aura
   outline a genuinely bright unbroken line rather than the faint one the current render produced.
   That is one prompt edit and one regeneration.

### 3a. The series channel, which the field colour now carries too

Series used to be encoded by the plate shape alone. **The shape mapping is kept exactly as it is**
(`medal-art-guide.md` section 0): the owner never objected to it, `MedalStage`'s circular crop
already constrains it, and changing it would churn 28 pieces for no complaint. What is added is one
enamel field colour per series, so a page of the album has a colour identity and two medals of the
same grade from different series never look like the same object.

| Series             | Shape (kept)             | Enamel field            | Chroma key for generation |
| ------------------ | ------------------------ | ----------------------- | ------------------------- |
| `first-steps`      | Circle                   | Warm honey amber        | Magenta                   |
| `the-wait`         | Diamond                  | Deep royal indigo       | Green                     |
| `the-display-case` | Pentagon                 | Deep wine burgundy      | Green                     |
| `explorer`         | Short, wide shield       | Deep jade green         | Magenta                   |
| `chronicler`       | Hexagon                  | Warm sepia bronze brown | Magenta                   |
| `secrets`          | Star, thick blunt points | Polished black obsidian | Magenta                   |

Violet is not used by any series, because it is reserved for rank 10 and that reservation is the one
finding that has survived every round of the rank art.

## 4. "Próximamente" ends: every phase 2 condition is evaluable today

The owner is right, and the finding is stronger than the question: **none of the twelve phase 2
medals was blocked by the data model.** Every one of them is answerable with the schema exactly as it
stands. Phase 2 was a shipping decision taken on evaluation COST (`ADR 0040` chose `midnight-order`
as the first secret because it is a single row check, where `same-day-settle` needs a cross entity
join), not a capability gap. There is one genuine exception and it is not about evaluability:
`store-mapped-1` waits on a stranger, which is why it is replaced rather than promoted.

| Condition key                  | Resolvable today with                                                                                                                                                                                                                                                                                                                                 | Cost                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `PRODUCTS_DELIVERED_10/50/150` | `orderItem.count` where `userId`, `deliveryState: DELIVERED`, order creditable. Counts product LINES, not units, which is what "Diez piezas" means to a collector.                                                                                                                                                                                    | 1 query, shared by all three                 |
| `ARRIVALS_25`                  | `delivery.count` where `userId`, `status: DELIVERED`, store creditable                                                                                                                                                                                                                                                                                | 1 query                                      |
| `PRODUCT_TYPES_3/6`            | `orderItem.findMany` `distinct: ["productTypeKey"]` over delivered items, `productTypeKey: { not: null }`                                                                                                                                                                                                                                             | 1 query, shared                              |
| `STORES_WITH_ARRIVAL_10`       | `delivery.findMany` `distinct: ["storeId"]` over delivered deliveries                                                                                                                                                                                                                                                                                 | 1 query                                      |
| `COMPLETE_RECORD_1/10`         | `order.count` where `items: { some: {}, none: { OR: [{ unitPrice: null }, { productTypeKey: null }] } }`. `name` and `quantity` are non-null in the schema, so those two nullable fields ARE the definition of "todos los datos".                                                                                                                     | 1 query, shared                              |
| `SAME_DAY_SETTLE`              | The existing `loadArrivalShape` join already knows each fully arrived order and its last `receivedDate`. Add: allocations on those orders whose `payment.paymentDate` equals that day, intersected with `resolveSettledOrderIds`. `receivedDate` and `paymentDate` are both civil days pinned to UTC midnight, so the comparison is a plain equality. | 2 queries on top of a join that already runs |
| `YEAR_STREAK`                  | `order.findMany` selecting `orderDate` only, grouped into `YYYY-MM`, longest consecutive run of 12. `orderDate` is a civil day, so no timezone resolution is needed.                                                                                                                                                                                  | 1 query                                      |
| `STORE_ADOPTED`                | Evaluable (`store` where `createdByUserId` is the collector and some order belongs to another user), but NOT controllable. Replaced, see section 6.                                                                                                                                                                                                   | n/a                                          |

Six new condition keys are needed for the new and corrected rows, and all six are single query:

| New key                    | Behind                          | Resolver                                                                                                                               |
| -------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `STORES_ORDERED_2`         | `first-store` (corrected)       | `order.findMany` `distinct: ["storeId"]`, `take: 2`, length >= 2                                                                       |
| `PREORDER_WINDOW_RECORDED` | `first-preorder` (new)          | `order.findFirst` where `expectedDeliveryFrom` or `expectedDeliveryTo` is not null                                                     |
| `COUNTRIES_3`              | `countries-3` (new)             | `store.findMany` `distinct: ["countryCode"]` where the store is creditable and has a delivered delivery for this collector             |
| `REVIEWS_5`                | `reviews-5` (new)               | The `REVIEW_AFTER_ARRIVAL` query as a `count`, >= 5. `StoreReview` is unique per `(storeId, userId)`, so five reviews are five stores. |
| `STORE_APPROVED_1`         | `store-charted-1` (replacement) | `store.findFirst` where `createdByUserId` is the collector and `status: APPROVED`                                                      |
| `SWIFT_ARRIVAL_7`          | `swift-arrival` (new)           | `loadArrivalShape` gains `shortestFullWaitDays`. Zero extra queries: it is the same join `patience-*` already loads.                   |

### 4a. The correction hiding in `first-store`

`first-store` ("Puerta nueva") currently resolves `ANY_ORDER`, the same condition as `first-order`,
with a comment explaining that a collector's first order is by definition at a store new to them.
That is true and it is still wrong as a medal: the two pieces unlock in the same instant, from the
same click, so the album hands out two rewards for one act and the second one feels like padding.
Proposed: `STORES_ORDERED_2`, an order at a SECOND distinct store. The name "Puerta nueva" then
describes something that actually happened, and the copy needs one word changed.

### 4b. Consequence for the merit lock, stated on purpose

`getMeritLockDenominator` counts the shipped, controllable, non-expired catalogue. Today that is 12. Under this proposal it is 28, with nothing excluded, so ranks 9 and 10 go from needing 45 and 60
percent of 12 (6 and 8 medals) to 45 and 60 percent of 28 (13 and 17). That is the intended effect of
shipping the album, not a side effect: the gate was written as a fraction precisely so the catalogue
could grow under it. It is called out here so the change is a decision rather than a surprise.

## 5. Series sizes: every page fills its rows

The album grid is two columns on mobile and `auto-fill minmax(216px, 1fr)` from `sm` up, which is
four columns at a typical desktop width. A series of three leaves a hole on every layout; a series of
seven leaves a hole on both.

| Series             | Today | Proposed | Change                                                          |
| ------------------ | ----- | -------- | --------------------------------------------------------------- |
| `first-steps`      | 7     | **8**    | plus `first-preorder`, so both rows are full on 2 and 4 columns |
| `the-wait`         | 4     | 4        | motifs rebuilt, sizes unchanged                                 |
| `the-display-case` | 4     | 4        | motifs rebuilt, sizes unchanged                                 |
| `explorer`         | 3     | **4**    | plus `countries-3`                                              |
| `chronicler`       | 3     | **4**    | `store-mapped-1` replaced, plus `reviews-5`                     |
| `secrets`          | 3     | **4**    | plus `swift-arrival`                                            |
| **Total**          | 24    | **28**   | 4 new, 1 replaced                                               |

Growing `first-steps` to 8 rather than leaving it at 7 is the only part of this that goes beyond the
"at least four" the owner asked for. It costs one medal and it is the difference between two clean
rows and a ragged one on the first page anybody sees.

Rarity spread across the 28 reads like a real print run, descending: **10 normal, 7 primera edición,
5 limitada, 5 holográfica, 1 firmada**. `first-steps` stays almost entirely `normal` on purpose: page
one is where a collector learns what the baseline looks like, so every later grade reads as an
upgrade rather than as noise.

## 6. The catalogue, all 28

`Nueva` = new row. `Reemplaza` = replaces an existing row. `Fase 2 -> 1` = catalogued today but not
awardable; under this proposal it is awardable. `Existente` = same row, new artwork.

### Primeros pasos, circle, honey amber

| #   | `medalKey`           | Nombre (es)          | Name (en)            | Condición evaluable                      | Rareza          | Motivo                                                             | Estado                         |
| --- | -------------------- | -------------------- | -------------------- | ---------------------------------------- | --------------- | ------------------------------------------------------------------ | ------------------------------ |
| 1   | `first-order`        | Primer pedido        | First order          | `ANY_ORDER`                              | normal          | Wooden shipping crate, lid tipped open, one iron band              | Existente, motivo nuevo        |
| 2   | `first-payment`      | Primer pago          | First payment        | `ANY_PAYMENT`                            | normal          | Drawstring coin pouch, one struck coin at its base                 | Existente, motivo nuevo        |
| 3   | `first-arrival`      | Primera llegada      | First arrival        | `ANY_ARRIVAL`                            | normal          | Corded parcel with the cord cut, wrapping peeled back              | Existente, motivo nuevo        |
| 4   | `first-order-closed` | Círculo cerrado      | Closed circle        | `ORDER_FULLY_CLOSED`                     | **first-print** | Round wax seal, freshly struck and still domed                     | Existente, sube de rareza      |
| 5   | `first-review`       | Primera reseña       | First review         | `REVIEW_AFTER_ARRIVAL`                   | normal          | Squat inkpot with a quill standing in it, one star on its shoulder | Existente, motivo nuevo        |
| 6   | `first-photo-order`  | Del papel a la ficha | From paper to record | `ORDER_FROM_IMAGE`                       | normal          | Folding plate camera, one plate sliding out turning into a card    | Existente, motivo nuevo        |
| 7   | `first-store`        | Puerta nueva         | A new door           | **`STORES_ORDERED_2`** (era `ANY_ORDER`) | normal          | Arched shop doorway, double doors open, one worn step              | Existente, condición corregida |
| 8   | `first-preorder`     | Preventa anotada     | Pre-order logged     | **`PREORDER_WINDOW_RECORDED`**           | normal          | Flat brass claim tag on a short hook, punched hole, no writing     | **Nueva**                      |

### La espera, diamond, deep indigo

| #   | `medalKey`      | Nombre (es)         | Name (en)           | Condición evaluable | Rareza      | Motivo                                                    | Estado                  |
| --- | --------------- | ------------------- | ------------------- | ------------------- | ----------- | --------------------------------------------------------- | ----------------------- |
| 9   | `patience-60`   | Dos meses de espera | Two months waiting  | `WAIT_60_DAYS`      | first-print | Ship's anchor upright on a coil of rope                   | Existente, motivo nuevo |
| 10  | `patience-120`  | La espera larga     | The long wait       | `WAIT_120_DAYS`     | limited     | Waning crescent moon over three carved wave crests        | Existente, motivo nuevo |
| 11  | `patience-200`  | La espera imposible | The impossible wait | `WAIT_200_DAYS`     | holo        | Lighthouse tower, lamp room lit                           | Existente, motivo nuevo |
| 12  | `split-arrival` | Llega por partes    | Arrives in parts    | `SPLIT_ARRIVAL`     | first-print | One parcel cleft in two halves, three chain links between | Existente, motivo nuevo |

The series is rebuilt as a sea crossing (anchored, mid ocean, landfall) because the ranks took the
hourglass, and because "importar se mide en meses, no en días" is a voyage, not a kitchen timer.

### La vitrina, pentagon, wine burgundy

| #   | `medalKey`       | Nombre (es)     | Name (en)         | Condición evaluable      | Rareza      | Motivo                                                        | Estado      |
| --- | ---------------- | --------------- | ----------------- | ------------------------ | ----------- | ------------------------------------------------------------- | ----------- |
| 13  | `collection-10`  | Diez piezas     | Ten pieces        | `PRODUCTS_DELIVERED_10`  | normal      | One stone shelf slab with three small carved figurines        | Fase 2 -> 1 |
| 14  | `collection-50`  | Media centena   | Fifty             | `PRODUCTS_DELIVERED_50`  | first-print | Two tier cabinet, glass doors open, both tiers packed         | Fase 2 -> 1 |
| 15  | `collection-150` | Vitrina llena   | Full display case | `PRODUCTS_DELIVERED_150` | holo        | Three tier stepped plinth, one larger figure crowning the top | Fase 2 -> 1 |
| 16  | `arrivals-25`    | Puerto conocido | Known port        | `ARRIVALS_25`            | limited     | Courier's satchel, flap open, one struck postmark disc on it  | Fase 2 -> 1 |

### Explorador, short wide shield, jade

| #   | `medalKey`    | Nombre (es)     | Name (en)        | Condición evaluable      | Rareza      | Motivo                                                                   | Estado      |
| --- | ------------- | --------------- | ---------------- | ------------------------ | ----------- | ------------------------------------------------------------------------ | ----------- |
| 17  | `variety-3`   | Gustos amplios  | Broad tastes     | `PRODUCT_TYPES_3`        | normal      | Three different artefacts on one stone step: card case, charm, die       | Fase 2 -> 1 |
| 18  | `countries-3` | Tres fronteras  | Three borders    | **`COUNTRIES_3`**        | first-print | Stone sphere inside three brass armillary rings                          | **Nueva**   |
| 19  | `variety-6`   | Colección mixta | Mixed collection | `PRODUCT_TYPES_6`        | limited     | Six sided standing lantern, each pane etched with a different silhouette | Fase 2 -> 1 |
| 20  | `stores-10`   | Mapa propio     | Your own map     | `STORES_WITH_ARRIVAL_10` | holo        | Folded paper map with exactly five pin markers                           | Fase 2 -> 1 |

`variety-3` and `variety-6` used to be the same idea at two counts (three things, six things), which
is the mistake the hourglasses made. `variety-6` becomes a different OBJECT, a six paned lantern, so
the two are told apart by silhouette and not by counting.

### Cronista, hexagon, sepia

| #   | `medalKey`        | Nombre (es)          | Name (en)       | Condición evaluable    | Rareza      | Motivo                                                         | Estado                         |
| --- | ----------------- | -------------------- | --------------- | ---------------------- | ----------- | -------------------------------------------------------------- | ------------------------------ |
| 21  | `clean-record-1`  | Ficha impecable      | Spotless record | `COMPLETE_RECORD_1`    | normal      | Stone tally tablet with four incised rows, bronze stylus       | Fase 2 -> 1                    |
| 22  | `store-charted-1` | Tienda cartografiada | Store charted   | **`STORE_APPROVED_1`** | first-print | Stone waymarker obelisk with a plain brass plate set into it   | **Reemplaza `store-mapped-1`** |
| 23  | `reviews-5`       | Voz de confianza     | Voice of trust  | **`REVIEWS_5`**        | limited     | Bronze hand bell with exactly five stars struck around its rim | **Nueva**                      |
| 24  | `clean-record-10` | Archivo limpio       | Clean archive   | `COMPLETE_RECORD_10`   | **holo**    | Bronze rack holding five capped scroll cases                   | Fase 2 -> 1, sube de rareza    |

**Why `store-mapped-1` is replaced rather than promoted.** Its condition ("una tienda que creaste fue
aprobada y otra persona compró en ella") is perfectly evaluable today. It is the only row in the
catalogue with `controllable: false`, and that flag exists so a rank gate is never hostage to a
stranger's behaviour. On a product whose user base is currently one person it is not a promise, it is
a locked door with no handle. `store-charted-1` keeps the spirit (you put a place on the shared map)
and moves the finish line to the part the collector controls: submitting a real store that survives
moderation. If the owner prefers to keep the original wording, the honest alternative is to keep it
as a phase 3 row and leave the series at four without it.

### Secretas, star, obsidian

| #   | `medalKey`        | Nombre (es)        | Name (en)        | Condición evaluable   | Rareza      | Motivo                                                         | Estado                  |
| --- | ----------------- | ------------------ | ---------------- | --------------------- | ----------- | -------------------------------------------------------------- | ----------------------- |
| 25  | `midnight-order`  | Turno de madrugada | Night shift      | `MIDNIGHT_ORDER`      | first-print | Waning crescent moon cradling a candle burnt to a stub         | Existente, motivo nuevo |
| 26  | `swift-arrival`   | Llegó volando      | It flew here     | **`SWIFT_ARRIVAL_7`** | limited     | One solid struck lightning bolt, point down, plain collar band | **Nueva**               |
| 27  | `same-day-settle` | Cuentas al día     | Settled same day | `SAME_DAY_SETTLE`     | holo        | Balance scale, beam straight, both pans level and empty        | Fase 2 -> 1             |
| 28  | `year-streak`     | Un año contigo     | A year with you  | `YEAR_STREAK`         | signed      | Young tree with one solid canopy growing from a cracked plinth | Fase 2 -> 1             |

`midnight-order` loses its owl to rule 4 of section 2 (no creature on a medal, ever). The candle
burnt to a stub says "three in the morning" at least as fast and costs the set nothing.
`year-streak` loses its twelve leaf ring for two reasons: a ring drawn inside the plate reads as a
second frame at thumbnail size, and an unbounded count of leaves is exactly the ornament the rank
round banned. A tree is one solid silhouette and still means a year.

## 7. Motif uniqueness, checked

No object repeats across the 28 medals, and none of the 28 repeats an object from the 10 ranks. The
adjacencies worth naming:

| Medal                          | Nearest rank                                | How they stay apart                                                                                      |
| ------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `first-order` crate            | Rank 1 `kohai`, a stone slab in a disc      | A wooden crate with an open lid against a raw grey stone field. Different object, different colour mass. |
| `collection-50` cabinet        | Rank 7 `club-sensei`, a crystal on obsidian | A cabinet is furniture with shelves. The prompt bans a single free standing crystal from it.             |
| `clean-record-10` scroll cases | Rank 3 `volume-keeper`, a chained tome      | Capped cylinders in a rack, never a book, never a chain, never a lock.                                   |
| `patience-120` waves           | Rank 10 `guild-legend`, a winged creature   | Three carved solid wave crests, no wing shape, no plumage, no creature.                                  |
| `reviews-5` bell               | Rank 6 `limited-run-curator`, laurel        | A bell is one solid closed form with no leaves and no branch.                                            |

The two motifs that would have collided hardest, the hourglass and the owl, are gone with the
objects themselves.

## 8. QC, and what is blocking

Everything from `rank-art-guide.md` section 6 applies unchanged, plus three tests this round adds:

1. **The family test, measured.** `qc.py` must report `gaps/row <= 0.15` on every medal, where the
   only permitted source of a gap is the milled coin edge. Anything higher means the plate has grown
   daylight inside its outline, which is rank hardware.
2. **The rarity strip test. Blocking.** Put the five grades side by side ON THE SAME motif, desaturate
   and shrink to 32 px. If two adjacent grades are not distinguishable, the metal ladder failed and
   the batch is a reject. This is the strip on the review sheet, and it is the reason `chronicler`
   carries four of the five grades on one shape.
3. **The locked test.** `MedalStage` renders a locked medal as the same art desaturated under a
   padlock. Every grade has to stay itself under that filter, which is precisely what the value
   ladder of section 3 buys.

## 9. Where the art lives, and how the batch finished

**28 of 28 rendered and published.** The first pass rendered 16 and then hit the image quota
(`ERROR: You've hit your usage limit`, three hour lockout), exactly as the rank round did. The
remaining 12 were rendered on 2026-08-26 in three batches of four, one take each, with no reject and
no regeneration: `first-store`, `first-preorder`, `first-review`, `first-photo-order`;
`first-order-closed`, `collection-10`, `collection-50`, `collection-150`; `variety-6`,
`midnight-order`, `swift-arrival`, `same-day-settle`. `medals-v2-board.png` now draws the whole
album with no empty slots, and its footer note about the quota is gone with the gap it described.

**Four of four in a batch is the working size.** Six in parallel had already tripped the short rate
limit on the rank round; four never did, across three consecutive batches.

**Published to `public/medals/` the same day.** `publish.py` resizes each 1024 px master to 512 and
palette-quantizes it to 256 colours with `FASTOCTREE`, the same two operations the ranks shipped
through. The 28 masters (26.9 MB) land as 1.6 MB, the largest file is 82 KB against a 150 KB budget,
and every output keeps a real alpha channel. The script also reports any file in `public/medals/`
that no catalogue key claims, which is how the retired `store-mapped-1.png` was found and deleted.

**Section 3's rarity comparison stays honest after publication.** Band 2 of the board reads its
"antes" column from `art-drafts/medals-v2/before/`, a three-file snapshot of the art that shipped
before this round, because `public/medals/` now holds the "después" side of that same comparison.

Two findings from the batch worth keeping, both now automated in `normalize.py`:

- **The key fringe is inside the contour, not on it.** The generator reports the outer pixels as fully
  opaque and still lays a hard magenta rim two or three pixels in. Despilling only where alpha is soft
  leaves a visible halo. The fix is a despill band widened into the artwork plus a global "the key hue
  dominates here, so this is spill" mask, which is safe because rule 20 guarantees no palette goes
  near the key.
- **A take can come back as a ghost.** `patience-120` returned with roughly a third of the plate
  sitting at alpha 40 to 200. It looks perfect on a dark review sheet and is a translucent smear on a
  light theme, which is exactly the kind of defect that ships unnoticed. `normalize.py` now reports
  `ghost=<n>` and forces every pixel the border flood cannot reach to full opacity, keeping only a two
  pixel antialiased rim.

| Artifact                          | Path                                            |
| --------------------------------- | ----------------------------------------------- |
| Single review sheet for the owner | `art-drafts/medals-v2/medals-v2-board.png`      |
| Normalized masters                | `art-drafts/medals-v2/final/*.png`              |
| Prompt generator, all 28          | `art-drafts/medals-v2/build_prompts.py`         |
| Generated prompts                 | `art-drafts/medals-v2/prompts/*.txt`            |
| One generation                    | `art-drafts/medals-v2/gen.sh <medalKey> [take]` |
| Every attempt, kept               | `art-drafts/medals-v2/raw/<medalKey>-take<N>/`  |
| Normalizer                        | `art-drafts/medals-v2/normalize.py`             |
| Board builder                     | `art-drafts/medals-v2/board.py`                 |
| QC and the family metric          | `art-drafts/medals-v2/qc.py`                    |
| Publisher (512 px + quantize)     | `art-drafts/medals-v2/publish.py`               |
| Pre-round art, for the board only | `art-drafts/medals-v2/before/*.png`             |
| Live verification captures        | `art-drafts/medals-v2/screens/*.png`            |
| Python deps for the three scripts | `art-drafts/medals-v2/requirements.txt`         |

## 10. What is still open, after implementation

Corrected on 2026-08-26. Four of the five items this section originally listed are now closed, and
listing them as open would misread the state of the feature.

**Closed:**

- **The catalogue, the resolvers and the merit lock are implemented.** `medalCatalogue.ts` carries
  all 28 rows, `medalEvaluation.ts` carries one resolver per condition key including the six new
  ones, and `getMeritLockDenominator` counts 28 with nothing excluded.
- **Copy is written.** The Spanish and English names, hints and lore for the four new rows and the
  two corrected ones live in `src/i18n/locales/{es,en}/progress.json`.
- **`ADR 0040` is amended.** The note saying the cost argument was about ordering, not about
  capability, is dated 2026-08-26 on the ADR itself.
- **The product docs are aligned.** `FR-12-17`, `FR-12-20`, `FR-12-25`, `FR-12-26`, `FR-12-40`, the
  blueprint, `WO-05` and the FDD were updated in the same change.

- **The full art batch is rendered and published.** All 28 pieces exist as normalized 1024 px
  masters in `art-drafts/medals-v2/final/`, all 28 are published to `public/medals/`, and every
  catalogue row carries its `imageKey`. Verified live against the owner's dev data at
  `/progress/medals`, a medal detail page and the dashboard's `"Últimas medallas"` strip, in light
  and dark theme, at desktop and mobile widths; captures are in `art-drafts/medals-v2/screens/`.

**Still open:**

- **The `signed` rim weakness** measured in section 3b. `year-streak` is the only `signed` piece and
  it was not re-rendered this round, so the defect that section names is still in the shipped file.
- **The per-grade seal glyph** `FDD-12` §3.1 defers. Unchanged by this round.

**What the album actually renders today (2026-08-26, after publication).** One art language and no
placeholders: all 28 rows carry an `imageKey`, all 28 files in `public/medals/` are v2 pieces, and
`MedalStage`'s placeholder medallion is now unreachable from the catalogue. The five rows that had
no piece at all (`first-preorder`, `countries-3`, `reviews-5`, `store-charted-1`, `swift-arrival`)
were filled in the same change, and the guard in `medalCatalogue.test.ts` that fails when an
`imageKey` has no file passes over the whole album.

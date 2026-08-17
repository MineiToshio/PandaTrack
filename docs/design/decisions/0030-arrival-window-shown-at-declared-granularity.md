---
title: "ADR 0030 - The arrival window is shown with the granularity it was declared with"
date: 2026-08-16
status: accepted
session: store-level payments v5 (arrival date in the "Por tienda" view, spec v4 after four red-team passes)
owner: Sergio Minei
trigger: the collector asked for the "Por tienda" row to show when a product is expected instead of when its order was placed; the row is in a list of products that have NOT arrived, sorted by arrival by default, and it was printing the order date. Amended 2026-08-17 after the collector read the shipped version: the delay chip became one line of coloured text that REPLACES the estimate (§8). Amended again 2026-08-17 after the collector asked why a product already at the store showed "Esperada 12 jun" and no delay: `resolved` now states the EVENT instead of the estimate it closed (§3.1), and the same rule reaches the order chip, the order detail banner and the "Entrega atrasada" filter (§3.2)
updates: src/lib/arrivalWindow.ts, src/app/[locale]/(app)/orders/_components/share/ArrivalMeta.tsx, src/app/[locale]/(app)/orders/_components/share/OrderItemStateChip.tsx, src/app/[locale]/(app)/orders/_components/share/useOrderItemArrivedToggle.ts, src/app/[locale]/(app)/orders/_components/share/orderListStatusChip.tsx, src/app/[locale]/(app)/orders/_components/share/orderItemDeliveryChip.tsx, src/app/[locale]/(app)/orders/_components/OrdersTable.tsx, src/app/[locale]/(app)/orders/_components/OrderCard.tsx, src/test/design-token-guard.test.ts, src/app/[locale]/(app)/orders/_components/StorePendingProductRow.tsx, src/app/[locale]/(app)/orders/_components/StorePendingProductCard.tsx, src/app/[locale]/(app)/orders/_components/StoreGroupedView.tsx, src/app/[locale]/(app)/orders/page.tsx, src/lib/data/orders/orderQueries.ts, src/app/[locale]/(app)/orders/[id]/_components/OrderDetailContent.tsx, src/app/[locale]/(app)/deliveries/page.tsx, src/lib/data/deliveries/deliveryQueries.ts, src/app/[locale]/(app)/deliveries/[id]/_components/DeliveryDetailHero.tsx, src/test/arrival-line-copy-guard.test.ts, src/lib/orders/orderDerivedState.ts, src/test/overdue-formula-single-source-guard.test.ts
extends: ADR 0002 (status chips), ADR 0006 (never colour alone)
---

# ADR 0030 - The arrival window is shown with the granularity it was declared with

## Context

The orders list "Por tienda" view (`FR-05-44`) lists pending products grouped by store, ordered by
soonest expected arrival by default. Each row's second line printed **the day the collector placed
the order** — a fact nobody in that list is looking for, and the only element on the row that linked
into the order.

The data decides most of what follows. Measured on the collector's real database (73 pending
products, 62 with a date):

| shape                                                           | rows         |
| --------------------------------------------------------------- | ------------ |
| range spanning whole month(s) (`from` = day 1, `to` = last day) | **48** (77%) |
| single stated day (`from = to`)                                 | 3            |
| genuinely irregular window                                      | 11           |
| no date at all                                                  | 11           |

No pending row declares only ONE endpoint today, but one order in the collection carries only
`expectedDeliveryTo` (it contributes no pending product right now). The day it does, it takes the
single-day branch and reads "esperada 12 jun", stating an upper bound as the promised day. Accepted
rather than fixed: it is exactly what `formatArrivalWindow` already does on the other two lists, and
inventing a "hasta" phrasing for one row would make this list say something the others do not.

Distribution against today: **26 overdue**, 0 due within 7 days, 1 within 8–30, 35 beyond 30. The
overdue ages are bimodal: `16 ×9 · 24 · 40 · 47 ×3 · 65 · 77 · 108 · 138 · 169 ×5 · 197 ×2 · 228`.
Delivery state: 66 `open`, **7 `arrived_at_store`**, 0 `in_transit` (and 0 `IN_TRANSIT` deliveries in
the whole database, against 531 `DELIVERED`).

## Decision

### 1. A whole-month range renders as that month

`formatExpectedArrival(from, to, locale, referenceYear)` collapses `2026-09-01 → 2026-09-30` to
"sept" (or "sept 2027"), instead of the "1–30 sept" the existing `formatArrivalWindow` would print.

This is not a shortening, it is the removal of a precision nobody entered. `OrderDeliveryRangeField`
offers "este mes" / "el próximo mes" presets that write `startOfMonth(today)` → `endOfMonth(today)`,
so that range **is** the encoding of "septiembre" the product itself offered. It matches how the
pre-order sector states the same thing (HobbyLink Japan "[Month] Release", Kickstarter "estimated
delivery: month year") and GOV.UK's guidance to ask for months rather than quarters. The unit of
collapse is the month and never the quarter.

The end-of-month predicate is computed, never compared against a constant:
`new Date(Date.UTC(y, m + 1, 0)).getUTCDate()` is the last day of `d`'s month by construction. A
hardcoded 30 mis-reads 23 of the real rows (5 in February, 18 in 31-day months).

The other three shapes keep theirs: a single stated day ("12 jun"), a range of whole months
("abr – sept 2027"), an irregular window ("20 sept – 31 oct"). The year is printed only when it is not
the reader's own, and a window crossing the year prints **both** ("20 dic 2026 – 16 ene 2027"), which
is why the irregular branch does not delegate to `formatArrivalWindow` — that function never prints a
year at all. `formatArrivalWindow` itself is untouched; its four consumers are unaffected.

**Known consequence, accepted.** The collapse can also be triggered by the `next30Days` preset, since
`addDays(day 1, 30)` lands on day 31, which _is_ the last day in a 31-day month. Rendering "ago" then
asserts nothing false: the collector asked for "the next 30 days from 1 August", and that interval is
August.

### 2. Linear's three-level proximity scheme is rejected, with numbers

Linear colours a due date red when it is today or past, orange within a week, grey otherwise. Applied
to this data: **26 red, 0 orange, 36 grey** — a binary dressed as three levels, with 26
indistinguishable alarms and no way to prioritise among them.

The cause is structural, not a threshold to tune. Linear designs for deadlines the user controls.
Here the collector controls nothing, and the datum carries ±15 days of slack declared by its own
granularity, so "5 days left" is not actionable over a month-wide window.

What IS actionable is the **age of the delay**: 16 days late on a pre-order is ordinary slippage,
228 days late is a date that has lost all credibility. So the gradation lives **in the label**
("Atrasado 47d" under 60 days, "Atrasado 7 meses" from there) and never in a second tone. A
`destructive` variant was evaluated and rejected: it would exist only in this view, and the same order
would read amber in "Por pedido", in its detail and in deliveries, and red here — exactly the
incoherence `resolveOrderArrivalDueDate` was created to kill.

The "soon" horizon is **30 days**, and the argument is geometric rather than a guess at useful notice:
because 48 of 62 windows close on a month's last day, 30 days makes the state mean precisely _"you are
already inside the month the store declared"_. Any shorter threshold cuts a month in half and claims a
precision the window does not have. `REMINDER_ARRIVAL_LEAD_DAYS` (3) is deliberately not reused: it
governs a push notification, which interrupts and must be narrow; a list is scanned.

> **Retired 2026-08-17 — there is no `soon` state any more.** The horizon existed to decide who got
> a "Pronto" chip; §8 removes the chip, and with it the only thing that could carry the distinction.
> The reasoning above survives as the record of why the threshold was 30 rather than 7 if the state
> is ever brought back. What replaced it is not a shorter horizon but the observation that the
> window already states proximity at a finer resolution than a badge does.

### 3. An observed event resolves the prediction — state `resolved`

`arrived_at_store` **or** `in_transit` short-circuits the resolver before anything relative to today
is computed, and the row shows its window in the past tense with **no chip and no future tense**,
whichever side of today the window falls on.

Four real rows made this blocking rather than cosmetic. Two are past their window and would have
rendered a delay counter growing over a product sitting on a shelf. The other two have a window in the
**future** and would have announced "llega sept 2026" about a product that has already arrived — not an
incoherence but a false statement. Showing an ETA after the plane has landed is the same error.

`in_transit` is in the same branch on purpose, and it costs one token. There are zero such rows today,
but `isItemEligibleForDelivery` lists them, and if "already at the store" answers the prediction then
"already shipped" answers it with more force.

**It holds for the state the row is SHOWING, not only for the one the server sent (amended
2026-08-16).** The state chip on the same line is a control with an optimistic state of its own, so
"Marcar como listo en tienda" answers the prediction a whole revalidation before
`product.deliveryState` agrees. Until it did, the row held both readings at once: a delay counter
growing next to a chip that already read "Listo en tienda" — the blocking case above, produced by
the row's own primary control, on the rows most likely to be pressed. `OrderItemStateChip` therefore
reports every transition of that state through `onStateChange`, the ROLLBACK included, and the row
hands it down. A refused mark restores the delay together with the state, which is why the
notification is emitted by the hook that owns the optimistic value and not inferred from the
caller's own click.

_(The row originally passed this as a boolean `suppressed` that hid a chip. Since §8 there is no
chip to hide, so it passes the optimistic `deliveryState` itself and the line changes WORDING, from
"Atrasado 17 días" to "Esperada 12 jun". The mechanism and its rollback are unchanged; what moved is
what the row does with the answer.)_

**The name matters and was chosen against its neighbours, not in the abstract.** An earlier draft
called this `settled`, which collides head-on with the PAYMENT vocabulary of this very row:
`storeView.settled` = "Saldado" renders about forty lines away in both components, and the literal
`"settled"` is already a payment state in four state machines, with ADR 0026 behind it. `resolved` is
free in this domain and names the principle. `atStore` was also evaluated — it would have reused the
existing glossary entry — and rejected because the state deliberately covers two delivery states, and
naming it after one would make the `in_transit` branch look like an oversight to the next reader.

#### 3.1 `resolved` states the EVENT, not the estimate it closed (amended 2026-08-17)

**The suppression above is right and is not reversed. What was wrong is that the row never said
why.** The collector opened the shipped version on `ORD-20260509-02` (Palmito Store, "One Piece Card
Game Starter Deck EX ST-30"), read "Esperada 12 jun" in August, and asked: _"¿por qué me sale
esperada doce de junio y no me sale atrasado, considerando que ya pasó la fecha?"_ The line stated a
prediction and said nothing about the event that answered it, so the reader was left to join two
facts the surface keeps apart:

- on the desktop row the chip that accounts for it is the third column of
  `minmax(0,1fr)_120px_150px_140px`, roughly 270px away, past the price;
- on the mobile card it is one line up, which is closer but still a second fact to assemble;
- and the row's own sort makes the juxtaposition worse rather than better. `arrival-asc` ranks by the
  window, so the resolved row (12 jun) sits at the TOP of its store group, directly above six rows
  reading "Atrasado 17 días" against a LATER window (31 jul). A row dated earlier saying "Esperada"
  above rows dated later saying "Atrasado" reads as a defect from three feet away.

Two of the four resolved rows made it worse still: their window is in the future, so "Esperada oct"
about a product on the shelf reads as a live promise.

**So the slot stops reporting the estimate and reports what closed it**, split by state because the
two are not the same news: `arrived_at_store` → **"Ya llegó a la tienda"**, `in_transit` → **"Ya está
en camino"**. Neither repeats its chip verbatim ("Listo en tienda" / "En camino"): the chip names the
STATE and is a control, the line answers the question the slot exists for ("when does it get here?")
in the past tense. `storeView.arrival.expected` has no caller left in this list and was deleted;
`scheduled` is future by construction, so "Llega" is the only window verb the row still needs.

**The window is dropped, not shortened, and that is the arguable part.** It is the ORDER's window and
not the product's; it stops being actionable the moment the product is at the store; and keeping it
would need a verb to disown it — "Ya llegó a la tienda, se esperaba 20 sep – 31 oct" is 50 characters
in a slot the mobile card pins with `whitespace-nowrap`. The order's detail still holds it. **What is
lost, stated plainly:** from this list you can no longer see what a store had promised for something
it eventually delivered, so the row's position under `arrival-asc` is now driven by a date it does
not print. That is accepted rather than hidden: the sort's own control names its criterion on screen,
and "arrived earliest, therefore first" is a coherent reading of "Llegada más próxima".

**`resolved` no longer requires a window.** While the state printed one, a product with nothing to
print fell to `noDate`, which put three of the collector's seven at-the-store rows on "Sin fecha
estimada" beside four that said something else, for a reason nothing on screen accounts for. Now that
the sentence does not name a date, it is exactly as true without a window as with one.

**Alternatives rejected.** (a) Show the REAL arrival date instead of the expected one: there is no
such column. `OrderItem` has no `arrivedAtStoreAt` — only `updatedAt`, which any edit bumps — and
`Delivery.receivedDate` belongs to a delivery, whose items are `delivered` and therefore not in this
list at all (531 of 531 deliveries in the collector's data are `DELIVERED` with a `receivedDate`).
Inventing the date was never on the table. (b) Keep the copy and move the state chip next to the
arrival line: it does not fix the future-window rows, and it buys the explanation with a structural
change to a shared grid whose header strip depends on those tracks. (c) Past-tense the estimate
("Se esperaba 12 jun"): shorter diff, keeps the date, and still does not answer the question the
collector actually asked, which was _why_.

### 3.2 The same rule at ORDER level (added 2026-08-17)

The store view had refused to score a resolved arrival since this ADR shipped. The two surfaces one
click away had not. `ORD-20260509-02` — the very row above — read **"Atrasado 2 meses"** in amber on
the per-order list, and its detail opened with a `role="alert"` banner counting the same delay
directly above that product's own "Listo en tienda" pill. Two of the collector's orders were in that
state (`ORD-20260509-02`, `ORD-20260716-03`).

`isOrderArrivalObserved(items)` in `src/lib/orders/orderDerivedState.ts` is the order-level
counterpart, and `isOrderOverdue` now takes `items` as a REQUIRED argument so no surface can
reintroduce the reading by omission. `Order.expectedDelivery*` is the window for the products to
reach the STORE (the shipment to the collector carries its own, `Delivery.expectedArrival*`), which
is why `in_transit` counts as observed here too: an item is only in transit because it left the store
it had already reached.

- **`every`, not `some`.** An order with one product already observed and others still awaited is
  late, and about those still-awaited ones it is late for a real reason.
  **Corrected 2026-08-17, after a red-team pass, verified against the live data by `EXISTS`-deriving
  each order's item states the way `deriveItemDeliveryState` does.** This bullet originally said
  "three orders mix one product on the shelf with others still awaited," conflating two different
  events. The collector has exactly **one** order mixing `open` with a product merely
  `arrived_at_store` on the shelf — `ORD-20260805-07`, window September 2026, in the future, never at
  risk. The **three** orders this rule actually keeps flagging today (`ORD-20260120-01`,
  `ORD-20250909-01`, `ORD-20250909-02`) mix `open` with a product already `delivered`, a state
  further along than "on the shelf." The conclusion — they stay overdue, and correctly so — holds;
  the shelf image illustrating it did not.
- **The line needed a third reading, not just a suppressed chip.** "llega" was merely the `else` of
  "overdue", so clearing the flag alone made the row say "llega 12 jun" in August — a future tense
  over a past date, worse than what it replaced. `orderListing.table.arrivalResolved` ("ya llegó a la
  tienda", lowercase because that line is embedded after a `·`) is the third branch.

  **Known debt, not closed here (named 2026-08-17).** That one sentence stands for every way an order
  can become `isOrderArrivalObserved`: all items `in_transit`, all `delivered`, or (a `PARTIALLY_
DELIVERED` order) a genuine mix of `arrived_at_store` and `delivered` with nothing left `open`. All
  three currently read "ya llegó a la tienda" alike, and 0 live orders distinguish them today — the
  three `delivered`-mixed orders this correction verified above are each uniform once their waiting
  items are set aside. **Documented trigger:** the day an order needs its own reading for "some of
  its products shipped, the rest were received directly" (as opposed to "all products took the same
  path"), `table.arrivalResolved` needs to become more than one string, the way the store-view line
  already splits `resolvedAtStore` from `resolvedInTransit`.

- **The "Entrega atrasada" filter moved with the chip.** Filter and chips sit on the same page; a row
  that matches the filter with no chip on it is the same pairing failure `civil-day-guard` exists to
  prevent in the timezone dimension. The SQL narrow spells "still waiting" the way
  `deriveItemDeliveryState` derives it (`deliveryState: NONE` **and** no non-cancelled delivery link),
  because the item's own column is not rewritten when a delivery takes it.

  **Closed 2026-08-17, two gaps in that promise, both latent (0 live rows).** (a) `items: { some: {
...waiting } }` cannot match an order with zero items, so an itemless order past its window kept
  the amber "Atrasado" chip (`isOrderArrivalObserved([]) === false` says it is not observed) while
  silently dropping out of these results — the exact case `isOrderArrivalObserved`'s own JSDoc reasons
  about, resolved oppositely by the chip and by the filter. `deliveryWhere` now also accepts `items:
{ none: {} }`. (b) the `notIn: [COMPLETED, CANCELLED]` narrow only ran when the caller left
  `statuses` unset; an explicit selection (ticking "Cancelado" alongside "Atrasados") skipped it, so a
  cancelled order with a waiting product could reappear here with no chip on it — the same pairing
  failure, reopened through the one branch this section had not covered. `deliveryWhere.status` now
  always intersects `notIn: [COMPLETED, CANCELLED]`, so combining those two toggles returns nothing
  rather than a chip-less row.

- **The order detail stopped deciding for itself**, which also closed an unrelated gap: it compared
  `order.expectedDeliveryTo` directly, so an order whose window is open at its start ("a partir del
  15", `to` null) was flagged by the list, by the dashboard and by the filter and raised no banner
  there. It was the fourth place `resolveOrderArrivalDueDate` had been written to unify, still not
  asking.

**Not changed, and deliberately: the dashboard, and the arrival reminders with it (named 2026-08-17).**
`hasOrderArrived` (`dashboardRollup.ts`) uses `some`, so it already excludes both orders above — it
has the opposite defect, hiding orders that are genuinely late about the products still coming. The
arrival-reminder candidate query, `getArrivalOverdueCandidates` (`reminderCandidateQueries.ts`),
carries the identical divergence: its `items: { none: { deliveryState: { not: NONE } } }` narrow is
the same `some`-shaped question read through De Morgan's law (an order qualifies only while NOT ONE of
its items has been observed arriving yet), so it drops out of the reminder candidates the moment a
single item is observed — exactly what `hasOrderArrived` does. No regression: the mixed orders this
correction names above (`ORD-20260805-07` and the three `delivered`-mixed orders) already had an
observed item each, so both this query and `hasOrderArrived` already excluded them from their
respective candidate sets before this pass, unchanged; the divergence was real and simply
undocumented. Aligning either would change collector-facing behaviour (dashboard figures, reminder
delivery) nobody asked about, so both stay recorded here as a known divergence rather than folded into
this legibility fix.

### 4. No join to `Delivery`

0 pending products are `in_transit`; 0 deliveries in the entire database are `IN_TRANSIT`. The
collector records an arrival in one step ("Ya me llegó"), so their real workflow never produces a
pending product in transit. The join would add a relation to an unpaginated query for zero rows.

**Documented trigger:** the day a pending `in_transit` product exists, the delivery's own window is the
more specific datum and must win:
`delivery.expectedArrivalTo ?? delivery.expectedArrivalFrom ?? order.expectedDeliveryTo ?? order.expectedDeliveryFrom`.

### 5. Two declared deviations from the secondary-chip rule

> **Superseded 2026-08-17 by §8, and kept in full deliberately.** Both deviations below existed only
> because the arrival state was a PILL competing for line 1. It is now text on line 2, so line 1 is
> back to the name plus at most the ineligible flag, and neither deviation has an object any more.
>
> The section stays because it is the record of what the measurement cost and of what it bought: two
> red-team rounds went into an arithmetic that a change in the state's SHAPE dissolved in one move.
> That is the lesson worth keeping — a width problem defended with better numbers is sometimes a
> width problem that should not have existed. It is also the arithmetic anyone must redo before
> putting a second pill on that line again.

`docs/design/interface-patterns.md` §8 says a derived state renders **beside** the primary chip, and
that "Atrasado" comes first when several apply. Both halves are deviated from here, and both
deviations are forced by arithmetic that was measured, not estimated.

**(a) On desktop the arrival chip sits beside the product NAME, not beside the state chip.** The
Estado column is 150px; "Atrasado 7 meses" alone is ≈146px, and `OrderItemStateChip` with its label is
≈131px. They do not fit.

**(b) `isFlaggedIneligible` SUPPRESSES the arrival chip instead of ordering itself against it.** Line 1
can absorb one extra pill because the product name truncates — but the `truncate` lives on the name's
`<span>` and the `<p>` has no `overflow-hidden`, so with two non-shrinkable pills the name reaches zero
width and **the pills leave the box**: ≈333px in Spanish and ≈354px in English, against 311px available
at 375px and 256px at 320px. Putting `overflow-hidden` on the `<p>` was evaluated and rejected — it
converts an overflow into a chip cropped in half, which is a different defect and not a better one.
Suppressing avoids the state; cropping only disguises it. The justification for choosing which one
goes is the same one that would have ordered them: transient feedback about the action the collector
just attempted outranks a chronic delay.

**The assumption underneath, and the hole it had (amended 2026-08-16).** The arithmetic above assumes
the state chip is its icon-only self, which happens only when `isQuietLabel`
(`labelDisplay === "exceptional" && state === "open" && canToggle`) and even then only below `md`. So
`arrived_at_store` rows keep their wide label — and they are exactly the rows `resolved` takes the
arrival chip away from, which is what keeps the two wide widths apart.

That held only for the state the SERVER sent. Pressing the chip restored its wide label immediately,
while the arrival chip was still resolving on `product.deliveryState`, so the ~131px label and the
~146px delay pill DID share line 1 for as long as the revalidation took, on a line whose `truncate`
cannot protect it. Suppressing on the optimistic state (§3) closes that window, which is what turns
the separation from luck into something the code enforces. Changing `isQuietLabel` or the definition
of `resolved` still requires redoing this arithmetic.

### 6. "Today" is the collector's civil day, on every lateness surface

`orders/page.tsx` computed `const today = new Date()` — a wall-clock instant compared against calendar
days stored at UTC midnight. In Lima (UTC−5) that is wrong in both directions: at 10:00 an order due
today already reads late, at 21:00 an order due tomorrow does too. A NEW lateness signal cannot ship on
a "today" that is known to be wrong.

Both sections now use `getTodayStart(new Date(), preferences?.timezone)`, the helper the dashboard and
the reminders already use, from the `cache()`d preferences snapshot both sections already load (zero
new queries). It is computed on the SERVER and travels as a prop; deriving it on the client would also
desynchronise hydration.

**The SQL filter is fixed in the same change**, and that is not scope creep. `orderQueries.ts`'s
`deliveryLateOnly` carries a comment saying it is "the same rule as `resolveOrderArrivalDueDate`,
expressed in SQL"; leaving it on the wall clock would put an order in the "Atrasados" filter with no
chip on it, **on the same screen**. `OrdersListPageFilters` gains `timeZone?: string | null` beside the
`baseCurrencyCode` it already carries from the same snapshot, and `getOrdersList` has a single caller.

**Former declared limit, now closed (amended 2026-08-16).** `resolveTimeZone(null)` falls back to
`DEFAULT_TIME_ZONE = "UTC"`, so with `User.timezone` unset the civil day is UTC's and the fix is
partial — wrong in one direction instead of two. The original entry tracked that alongside the four
surfaces still on a wall clock. Both halves of that debt are now paid:

- **The column is populated.** `TimezoneCapture` in the app shell reads
  `Intl.DateTimeFormat().resolvedOptions().timeZone` and writes it through `syncUserTimezoneAction`,
  which validates the value against the runtime's zone database before storing it against the session
  user's own id. The zone is only knowable in the browser, so it cannot be derived server-side the way
  the locale is; mounting the capture in the shell therefore also backfills every collector who signed
  up before it existed. The stored value is handed down from the server, so the steady state costs
  nothing — the action fires only on a first load or a relocation. The UTC fallback survives as the
  behaviour for the first render of a brand-new collector, which is the same thing the dashboard and
  the reminders do.
- **The four remaining surfaces resolve the civil day.** The order detail
  (`OrderDetailContent`, which takes `timeZone` as a prop from its page), the deliveries list
  (`deliveries/page.tsx`), the deliveries list query (`deliveryQueries.ts`, whose
  `DeliveriesListPageFilters` gains `timeZone?: string | null` exactly as `OrdersListPageFilters` did),
  and the delivery detail hero (a Client Component, so its page resolves the day and threads it down
  as a `today` prop — deriving it in the browser would desynchronise hydration).

The chip/filter pairing argument above applies unchanged to the deliveries list: its `overdueOnly`
toggle and its row chips are now bound to one value, for the same reason. `src/test/civil-day-guard.test.ts`
(generalised from the orders-only scan this change first shipped) asserts the shape of all six call
sites, including that each list page hands its timezone into its own query.

The order detail's `today` and its **overdue-days floor had to be fixed in one pass**: it carried a
third copy of the formula wrapped in `Math.max(1, …)`, so correcting the instant while keeping the
floor would still have printed "Atrasado 1 día" on an order due today. It now calls `getOverdueDays`,
which retires its entry from `overdue-formula-single-source-guard.test.ts`'s expected-hits map — the
expiry that guard was built to force.

### 7. The order link moves onto the product name

The order date was the row's only route into its order, and 11 rows have no date, so removing it
without moving the link would have left those rows unnavigable. The name is the primary identifier and
the natural destination, and on touch it is a far larger target. The checkbox is untouched: the
`<label>` of `PendingProductSelectToggle` contains only the `sr-only` input and three `aria-hidden`
painting spans, so the name was never inside it.

**Consequence, declared:** the `recent` / `oldest` sorts now order by a value the row no longer prints.
Accepted — the sort control names its own criterion on screen, and the view's default was already
arrival, which is the very incoherence this change closes.

### 8. The chip becomes a line, and the delay REPLACES the estimate (2026-08-17)

The collector read the shipped version and said the amber pill was too loud and in the wrong place.
The instruction that followed is the design: _one slot, same size in every state, and when the row is
late show "Atrasado 17 días" **instead of** the estimate, not beside it. Only the colour changes._

The request is better than a quieter pill, and the reason is worth writing down. On a row that is
late, the estimate is the least interesting thing on screen: "Esperada 26 jul" asks the reader to
subtract, and "Atrasado 17 días" is the answer they were subtracting to get. The old layout printed
the question and the answer side by side and spent a pill doing it.

**The row's arrival state is now exactly one `<span>` of `--text-caption` on line 2:**

| state       | line 2 (es)                                         | colour                |
| ----------- | --------------------------------------------------- | --------------------- |
| `scheduled` | "Llega sept 2026"                                   | `--text-muted`        |
| `overdue`   | "Atrasado 17 días" / "Atrasado 7 meses"             | `--warning-chip-text` |
| `resolved`  | "Ya llegó a la tienda" / "Ya está en camino" (§3.1) | `--text-muted`        |
| `noDate`    | "Sin fecha estimada"                                | `--text-muted`        |

**This is MORE conformant with WCAG 1.4.1, not less.** The words differ — "Atrasado" against
"Llega" / "Esperada" — so a reader who cannot see the amber loses nothing, and the colour does the
one job the criterion allows it: reinforcing a distinction already carried by text. The chip was
never the point; the point was that colour must not be alone, and now it is not.

**`soon` is gone, merged into `scheduled`.** It is the state that had no vehicle left. It renders the
same sentence as `scheduled` ("Llega {ventana}"), so with the chip removed the only possible
difference was colour — precisely the 1.4.1 violation the chip had been introduced to fix, which
means keeping it would have re-created the problem in the act of solving the owner's. Two ways out
were available and only one is honest: give `soon` its own sentence, or merge it. Merging wins
because the window ALREADY states proximity, at a finer resolution than a badge: "Llega sept" read in
September is the fact "Pronto" was standing in for, and the default `arrival-asc` sort puts those
rows first anyway. **What is lost, stated plainly:** a categorical "this one is close" that could be
scanned without reading the month. It cost 1 row of 73 at the time of the change, and it can be
brought back only with a sentence of its own — never with a colour.

**The delay replaces the window rather than joining it, and that loses the date.** A late row no
longer says which estimate slipped. Accepted: the order detail holds it, the row already links there
through the product name, and the alternative is the two-part line the collector rejected.

**`--warning-chip-text`, never `--warning`.** Measured against `--surface`: the raw status token is
**2.46:1** in light (it is calibrated as a chip FILL, not as text) and the alias is **8.42:1** light /
**11.30:1** dark; on `--surface-elevated` 8.06:1, and on a `state-selected` row 6.77:1 / 9.87:1. This
is the same trap the `soon` chip hit from the other side with `--info` (3.83:1 raw). The
`-chip-text` in the name records its first consumer, not its only legitimate one.

**And it is now the one line of this change with a mechanism (2026-08-17).** Flipping it back to
`--warning` left the entire suite green — every other decision here has a guard, an absence test or
an inverted test, and the single line separating 8.42:1 from 2.46:1 had prose. `design-token-guard`
gained a third scan for `[color:var(--{warning,info,success,destructive})]` over `src/**/*.{ts,tsx}`,
with a zero budget against an explicit per-file map of the pre-existing debt; the map is exact and
self-verifying, so it can only shrink. The scan also caught what the prose had not: **the same delay
read 8.42:1 on this line and 2.23:1 on the order-list chip a toggle away**, because
`orderListStatusChip` and `orderItemDeliveryChip` put the raw token on their LABELS, over a 12% wash
of the same hue that lifts nothing. Both were moved to the aliases in the same change (light:
warning 2.23 → 7.62, info 3.33 → 7.00, success 3.14 → 6.13; dark unaffected, since `globals.css`
collapses each alias to its base token there). What the guard still cannot do is compute a ratio: it
knows which token is the text one, never whether a new pairing is readable.

**A note on the month abbreviation, because every example above is written "sept" and it looks like
a typo.** `Intl.DateTimeFormat('es', { month: 'short' })` returns `"sept"` for September in the
runtimes this app targets (Node 24, current Chrome) — it is the only Spanish short month that is not
three letters. The examples in this ADR, in `glossary.md` and in the FDD said "sep", which no build
of the app has ever rendered. Corrected rather than defended: a doc example that disagrees with the
formatter is how a width estimate goes stale (§8's slot arithmetic below is stated on the real
four-character string).

**Sentence case, in both locales, in every state.** These strings start a line rather than sitting
inside one, so "Llega", "Esperada", "Atrasado", "Sin fecha estimada" — and "Arrives", "Expected",
"Overdue", "No estimated date". The first version shipped lowercase because the keys were copied from
`orderListing.table.arrivalArrives`, where the phrase IS embedded in a sentence and lowercase is
right. `src/test/arrival-line-copy-guard.test.ts` holds the rule, because nothing else could: locale
parity compares the two catalogues' shapes and stays green on a pair that is lowercase in both.

**The delay is spelled out here and stays abbreviated in the chips.** `describeOverdueLabel` (chip,
`orderListing.card.*`, "Atrasado 47d") and `describeArrivalOverdueLabel` (line,
`orderListing.storeView.arrival.*`, "Atrasado 47 días") share one private bucket function, so the
arithmetic and the 60-day switch to months cannot drift between surfaces; only the wording differs,
because a pill pays for every pixel and a sentence does not. The order detail's own overdue banner
already spelled it out.

**What this simplified, recorded because it is the load-bearing part.** Removing the pill removed the
whole second-pill problem: §5's two deviations, the `isFlaggedIneligible` suppression rule and its
test, and the fragile `isQuietLabel` width assumption all lose their object at once. A flagged row now
shows its ineligible chip on line 1 **and** its delay on line 2, and that test was inverted rather
than deleted — it is also the components' only coverage that the flag renders at all. Line 2 got
cheaper too: an overdue row prints "Atrasado 17 días" (~100px) where it used to print
"Esperada sept 2026" (~115px), so the widest string that slot can hold is a future irregular window,
unchanged by this.

**A row flagged ineligible keeps its delay, and that is a trade rather than an oversight.**
`isFlaggedIneligible` turns on when the server refuses a batch and names the product
(`storeArrivalAction` → `PRODUCT_NOT_ELIGIBLE`), which means its persisted state is `IN_TRANSIT` or
`DELIVERED`: another session already moved it, so by §3 its prediction is answered and the line
"should" read "Esperada {ventana}". While the state was a pill, §5(b) suppressed it here for a WIDTH
reason, and that reason is gone — so a flagged row now prints "Atrasado 17 días" beside
"Ya no disponible", a delay counter running over a prediction the server has just answered. That
reading is real and it is the one §3 exists to prevent.

**Passing `deliveryState="in_transit"` on those rows was evaluated and rejected**, for two reasons
that point the same way. First, it states something the client does not know: the item may be
`delivered`, which `resolveArrivalState` does not even treat as resolved, so there is no honest value
in that union for "answered, but I cannot say by what". Second and decisively, the flag does not
refine the arrival line — **it invalidates the whole row.** The same stale payload is still driving
the state chip ("Pendiente en tienda"), the selection toggle
(`selectable={isItemEligibleForDelivery(product.deliveryState)}`, so the tile is still tickable) and
the price. Correcting line 2 on its own would leave line 1 saying "Ya no disponible", the state chip
saying "Pendiente en tienda" and line 2 saying "Esperada 12 jun": three stories where there are
currently two, and the arrival line would be the only field on the row telling the truth by accident.

So the delay stays and the ineligible chip carries the correction: one signal, on line 1, saying this
row is out of date — which is true of every field on it, not only of this one. `T7b` fixes the
behaviour. **Documented trigger:** the day this deserves a real fix, it is a ROW-level staleness
treatment (chip, state chip and selection toggle moving together, most likely by re-reading the
named products rather than by patching one prop), never a delivery state forced into `ArrivalMeta` —
which would buy one honest line by making the row's own primary control lie.

## Consequences

- One shared presentational module (`ArrivalMeta`) keeps the desktop row and the mobile card from
  diverging. It lives in `_components/share/` because it knows this list's own translation namespace.
  It exported two pieces while the state lived on two lines (`ArrivalChip` / `ArrivalWindow`); since
  §8 it is a single component, and it takes the optimistic `deliveryState` as its own prop so the
  caller has to choose which state it is describing instead of inheriting the server's.
- The overdue-days formula existed **three** times, one of which had drifted to `Math.max(1, …)`.
  All three are now `getOverdueDays` (the third followed in the same-day amendment recorded in §6,
  because fixing its `today` without removing that floor would still print "Atrasado 1 día" on an
  order due today). `src/test/overdue-formula-single-source-guard.test.ts` holds the count at a map of
  expected hits with a zero budget elsewhere, and self-verifies that its pattern still matches each
  exempt file; the third copy's entry expired out of that map exactly as designed.
- 24 of 73 rows read amber. That is uncomfortable and it is true (42% of dated products are past
  their window). It was originally mitigated by keeping the date rather than the chip as the primary
  element, by `size="sm"`, and by the default `arrival-asc` sort grouping the overdue rows at the top
  of each store instead of scattering them. Since §8 the mitigation is stronger and simpler: amber is
  a text colour on a caption-sized line rather than a filled pill, which is what the collector was
  reacting to when they called it "muy llamativo".

## Methodological trap, recorded because it costs an afternoon

Reproducing the census with `COALESCE((SELECT CASE WHEN bool_or(...) ...), fallback)` returns
**`resolved` = 0** with a correct total of 73, because an aggregate subquery always returns a row. The
resulting distribution is plausible and _identical to the first draft's_, which is precisely what stops
anyone from suspecting it. Derive the delivery state with `EXISTS`, the way `deriveItemDeliveryState`
does.

## Alternatives rejected

| option                                                       | why not                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use `formatArrivalWindow` as it is                           | Prints "1–30 sept" on 46 of 62 rows: a day-level precision the collector never declared, on a datum their own form made them capture as a month.                                                                                                                                                                            |
| Linear's red / orange / grey                                 | 26 / 0 / 36 on this data (§2).                                                                                                                                                                                                                                                                                              |
| A `destructive` tone for old delays                          | Creates a state that exists only in this view; the same order would read amber everywhere else.                                                                                                                                                                                                                             |
| `soon` as a coloured line with no chip                       | Same sentence as `scheduled`, so colour becomes the only differentiator (WCAG 1.4.1); and raw `--info` does not reach AA as text in light theme, which is why `--info-chip-text` exists. **Still true after §8** — which is why `soon` was merged away rather than demoted to a coloured line.                              |
| Keeping `soon` with a sentence of its own ("Llega este mes") | It would have been the only state whose wording was derived rather than declared, and it says less than the window it would replace: "Llega sept" read in September already IS "this month". Rejected as a state that pays for itself only in a list nobody sorts by arrival, and this one is sorted by arrival by default. |
| A quieter arrival chip (smaller, outline, no icon)           | The complaint was not the pill's weight, it was that a late row printed the question and the answer side by side. Restyling keeps both.                                                                                                                                                                                     |
| `--warning` as the delay's text colour                       | 2.46:1 on `--surface` in light. It is a chip FILL token; `--warning-chip-text` is the calibrated status-TEXT one (8.42:1 / 11.30:1).                                                                                                                                                                                        |
| Spelling the delay out in the chips too, for one wording     | Widens two other lists' pills for a change nobody asked for, on surfaces where the abbreviation is right. The bucket arithmetic is shared instead of the string (§8).                                                                                                                                                       |
| Join `Delivery` for completeness                             | 0 pending products in transit, 0 deliveries in transit (§4).                                                                                                                                                                                                                                                                |
| `overflow-hidden` on the line-1 `<p>`                        | Turns an overflow into a chip cropped in half (§5b).                                                                                                                                                                                                                                                                        |
| Keep the order date beside the window                        | Line 2 has no element that truncates; window + date + chip overflow it by 45–93px at 375px, and the component already carries a comment recording that this exact failure once wrapped 63 of 67 rows.                                                                                                                       |

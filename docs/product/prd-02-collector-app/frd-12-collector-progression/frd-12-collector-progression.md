---
id: FRD-12
type: FRD
slug: collector-progression
title: Collector Progression
status: ACTIVE
parent: PRD-02
children:
  - BP-01
last_updated: 2026-08-26
source_features:
  - FEAT-0021
implementation_status: IN_PROGRESS
---

# FRD-12 Collector Progression

## Overview

Define the personal progression layer that sits on top of what the collector already does in PandaTrack: registering orders, logging payments, receiving deliveries, discovering stores and keeping product records complete. Every server-verifiable fact appends an entry to a points ledger; the balance is **derived** from those entries; the accumulated total drives a **permanent private rank**; and, in parallel, the collector fills a **medal album** of 28 collectible pieces that grant status and never grant points.

This FRD covers **phase 1 and phase 2** of the approved direction: the points engine, the ten-rank ladder, the full 28-piece medal album with its rarity model, and the four surfaces that expose them (the `Progreso` section with its three tabs, the medal detail subview, the dashboard widget, and the global unlock feedback). The data model is also prepared for **time-limited events** (phase 3), but no administration UI for them is in scope here. Comparison between collectors (a leaderboard, a public profile, a shareable card that names other people) is **out of scope** and is deferred to a future FRD gated on hard preconditions.

## Domain Goal

Give the collector a visible, honest reward for recordkeeping discipline during the roughly twenty-five days of an import cycle in which nothing else happens on screen, without ever rewarding spending, without comparing them to anyone, and without letting the reward layer touch or distort the money domain.

## Current State

### Implemented

Phase 1 is built. `BP-01`'s seven slices shipped the whole vertical: the four Prisma models and their migration, the dependency-light rule catalogue and its money-predicate adapter, the derived recompute, the credit call sites in the anchor mutations, the ten-rank ladder, the medal album (twelve awardable pieces at first, all twenty-eight since the catalogue v2 pass of 2026-08-26), the `Progreso` section with its three tabs, the dashboard widget, the unlock toast and the rank and high-rarity celebrations, the hide setting and the self-service purge, the Notion backfill script, and, in `WO-07`, the administrative surface: a read-only view of a collector's ledger and the point void with its mandatory reason (`FR-12-44`, `FR-12-45`). `WO-07` was the last slice this FRD was waiting on, and it is why this document leaves `DRAFT`.

Two things named in this FRD are deliberately still ahead: phase 2 (the grades inside a rank band and the eight phase-2 point rules) and the phase-3 event administration UI, which was never in scope here. The twelve medals phase 2 once held are **not** among them: the catalogue v2 pass of 2026-08-26 shipped them, replaced `store-mapped-1` and added four new pieces, so the album is complete at 28 and no medal reads `"Próximamente"` (`FR-12-20`).

The domain sits entirely on facts that already existed and were already server-verified before any of it was built:

- order creation, cancellation and deletion ([`FRD-05 · FR-05-25`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements), [`FR-05-24`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements)) and the derived, never hand-edited `OrderStatus` ([`FRD-05 · FR-05-32`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements), [`FR-05-34`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements))
- store-level payments and their declared `PaymentAllocation` rows ([`FRD-05 · FR-05-17`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements), [`FR-05-42`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements), [ADR 0025](../../../design/decisions/0025-store-level-payments-declared-allocations.md)) and the canonical `openBalanceMinor` ([`FRD-05 · BR-05-32`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#business-rules))
- the delivery lifecycle, including quick arrival and reopen ([`FRD-08 · FR-08-36`](../frd-08-delivery-management/frd-08-delivery-management.md#functional-requirements), [`FR-08-22`](../frd-08-delivery-management/frd-08-delivery-management.md#functional-requirements), [`FR-08-23`](../frd-08-delivery-management/frd-08-delivery-management.md#functional-requirements), [`FR-08-25`](../frd-08-delivery-management/frd-08-delivery-management.md#functional-requirements))
- the per-item pre-delivery readiness marker ([`FRD-05 · FR-05-39`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements))
- store approval state, private person stores and store reviews ([`FRD-04 · FR-04-07`](../frd-04-store-domain/frd-04-store-domain.md#functional-requirements), [`FR-04-33`](../frd-04-store-domain/frd-04-store-domain.md#functional-requirements), [`FR-04-34`](../frd-04-store-domain/frd-04-store-domain.md#functional-requirements), [`FR-04-24`](../frd-04-store-domain/frd-04-store-domain.md#functional-requirements), [`FR-04-40`](../frd-04-store-domain/frd-04-store-domain.md#functional-requirements))
- assisted order intake from an image ([`FRD-11`](../frd-11-order-image-intake/frd-11-order-image-intake.md))
- the seeded product-type catalog the collector already picks preferences from ([`FRD-07 · FR-07-22`](../frd-07-user-settings/frd-07-user-settings.md#functional-requirements))
- the settings surface and its three sections, where the opt-out lives ([`FRD-07 · FR-07-30`](../frd-07-user-settings/frd-07-user-settings.md#functional-requirements))
- the privileged-action audit foundation of [`PRD-03 · FRD-01`](../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md), which the administration requirements below depend on

### Planned

- ~~**Phase 1.**~~ Shipped, see `### Implemented` above.
- **Phase 2.** The grades `I` / `II` / `III` inside a rank band, and the eight phase-2 point rules. The twelve medals this phase used to hold shipped ahead of it on 2026-08-26 (`FR-12-20`), so no medal is deferred any more.
- **Phase 3 (data model only in this FRD).** Time-limited event medals: the columns exist from phase 1, the administration UI that creates and schedules an event is deliberately excluded.

## User Stories

### US-12-01 See that recordkeeping is going somewhere

As a collector, I want registering a payment or an arrival to visibly move something forward, so the roughly twenty-five days in which my order is only travelling do not feel like empty bookkeeping.

### US-12-02 Fill an album, not a scoreboard

As a collector, I want the things I unlock to live in an album of pages with pieces of different print runs, because that is the object I already understand from collecting, and I want to see the empty slots so I know what is still out there.

### US-12-03 Know where I stand, privately

As a collector, I want a named rank that tells me how far along the road I am, visible only to me, that never takes a title back once I have earned it.

### US-12-04 Be told the moment something unlocks

As a collector, I want the medal to appear over the action that unlocked it, immediately, not on some later page load.

### US-12-05 Have my migrated history count

As a collector who moved years of records in from Notion, I want that history to count toward my rank instead of starting me at zero, without the app pretending I did all of it today.

### US-12-06 Turn it off

As a collector who does not want any of this, I want one switch in settings that removes the whole layer, navigation entry included, and I want to be able to purge my points history.

### US-12-07 Trust that this is not about spending

As a collector, I want to be certain that no amount of money I enter, anywhere, changes my points, because a system that rewarded spending would quietly push me to buy.

## Functional Requirements

### The points engine

- `FR-12-01`: The system must record progression as entries in an **append-only points ledger**. An entry carries the user, a `ruleKey`, an `entityType` and `entityId`, a strictly positive point value, the civil day it occurred on, and its source (`LIVE` or `BACKFILL`). An entry is never edited, never deleted by the credit path, and never negative.
- `FR-12-02`: Crediting must be **idempotent** on the triple `(userId, ruleKey, entityId)`, enforced by a database unique constraint, so that a repeated call, a retried Server Action, or a re-run of the backfill script produces exactly one entry.
- `FR-12-03`: The point balance shown to the collector must be **derived by recompute** over the ledger, never read as a running total. The recompute reads the user's entries in a deterministic order, resolves in batch whether each referenced entity still exists and is still eligible, discards what is not, applies the monthly caps of `FR-12-06` over the surviving set, and writes the result into a rebuildable cache. Deleting an order, cancelling it, reopening or deleting a delivery, or deleting a review therefore removes its points without a compensating negative entry ever being written.
- `FR-12-04`: The system must credit points through the following rule catalogue and no other. `imm.` means credited immediately at the mutation; `def.` means credited when the order first receives an assigned payment or its first arrival; `der.` means the rule's ELIGIBILITY is evaluated by the recompute against current state; its entry is still appended by the one call site where that state is derived and persisted, because the recompute walks the ledger rather than the world and an entry nobody writes is worth nothing forever ([ADR 0037](../../../design/decisions/0037-progression-deferred-credit-no-pending-state.md)). Caps are per user, per **civil month**, and each declares its unit.

  | `ruleKey`                         | Points                                                                               | Cap (unit stated)                                                  | Anchor                                                                                                                                   | Phase |
  | --------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----- |
  | `order-created` (imm.)            | 5                                                                                    | 10 **events**/month (50 pts/month)                                 | `createOrder`                                                                                                                            | 1     |
  | `order-registered` (def.)         | 20 / 15 / 10 / 5 / 5 by the order's position within the same store in the same month | 120 **pts**/month                                                  | `createOrder`, credited at the first assigned payment or first arrival                                                                   | 1     |
  | `order-first-payment`             | 8                                                                                    | 80 **pts**/month                                                   | `createStorePayment`, once per order                                                                                                     | 1     |
  | `delivery-received`               | 25                                                                                   | 200 **pts**/month                                                  | `createDelivery` / `markDeliveryDelivered`                                                                                               | 1     |
  | `order-completed` (der.)          | 30                                                                                   | 240 **pts**/month                                                  | `persistDerivedOrderStatuses`, where the `COMPLETED` status is written; eligibility re-derived by the recompute                          | 1     |
  | `order-settled` (der.)            | 12                                                                                   | 120 **pts**/month                                                  | the `PaymentAllocation` producers, gated by the adapter predicate `isFullyAllocated`; eligibility re-derived by the recompute            | 1     |
  | `store-first-order`               | 20                                                                                   | 80 **pts**/month                                                   | `createOrder`, first order ever to that store                                                                                            | 1     |
  | `product-type-discovered`         | 12                                                                                   | once per product type, **lifetime**, bounded by the seeded catalog | the delivery mutation that moves the first `OrderItem` of that type to `DELIVERED`; eligibility re-derived by the recompute              | 1     |
  | `order-item-registered` (def.)    | 3                                                                                    | 30 **pts**/month                                                   | item creation / replacement                                                                                                              | 2     |
  | `order-data-complete` (der.)      | 8                                                                                    | 40 **pts**/month                                                   | recompute, adapter predicate `hasFullItemData`                                                                                           | 2     |
  | `order-created-from-image` (def.) | 5                                                                                    | 25 **pts**/month                                                   | assisted intake ([`FRD-11`](../frd-11-order-image-intake/frd-11-order-image-intake.md))                                                  | 2     |
  | `order-payment-detailed`          | 5                                                                                    | 25 **pts**/month                                                   | a `PaymentAllocation` naming a product, once per order                                                                                   | 2     |
  | `item-paid-declared`              | 1                                                                                    | 15 **pts**/month                                                   | the per-product paid marker                                                                                                              | 2     |
  | `item-arrived-at-store`           | 2                                                                                    | 20 **pts**/month                                                   | the readiness toggle of [`FRD-05 · FR-05-39`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements) | 2     |
  | `store-created-adopted`           | 40                                                                                   | 80 **pts**/month                                                   | recompute: a store this user created is `APPROVED` **and** another user has ordered from it                                              | 2     |
  | `store-reviewed`                  | 20                                                                                   | 60 **pts**/month                                                   | `upsertStoreReview`, `entityId` is the **store**, on an approved public store where the user already received a product                  | 2     |

  The eight phase-1 rules yield **210 points per month** for the base profile (two orders a month, average recordkeeping hygiene), which is the figure the rank thresholds of `FR-12-14` are calibrated against.

- `FR-12-05`: `order-created` must credit **5 points immediately** so the app answers at the exact moment it asks for discipline, and the surface must state in plain copy what is still to come rather than hiding it behind a pending state: `"Sumaste 5 puntos. Se suman 20 más cuando registres el primer pago o la primera llegada."` There is **no** pending, quarantined or provisional points state anywhere in the interface: points not yet credited have simply not been earned yet.
- `FR-12-06`: Every cap must be declared with an **explicit unit**, either points per period or events per period, and enforced by the recompute over the eligible set in a deterministic order, never by the mutation. `order-created` is capped in **events** (10 per month) precisely so its irrevocability under cancellation (`BR-12-16`) cannot be farmed.
- `FR-12-07`: `order-registered` must be **sublinear within the same store and the same civil month**: the first order of the month at a store yields 20, the second 15, the third 10, and the fourth and every subsequent one yield 5. The floor is 5, not 0, so a collector legitimately placing five pre-orders at the same store is not told the fifth one is worth nothing.
- `FR-12-08`: The following must credit nothing, ever: opening or navigating the app, filtering or sorting, viewing the dashboard, changing any setting, editing an order that was already credited, attaching more images, receiving a notification, **any amount of any kind**, any fact involving a store the user created, a private store, or a store that is not `APPROVED`, reviewing a store from which the user never received a product, reconciling a store account, logging a payment that is neither the order's first nor the one that settles it, and toggling any marker back and forth.
- `FR-12-09`: No point rule may read a monetary field. Rules that need to know something about money (for example "is this order fully allocated") must obtain it as a **boolean from a predicate adapter** that lives outside the rule module and is the only place allowed to touch money columns.
- `FR-12-10`: A ledger entry's `occurredOn` must be the **civil day resolved on the server from the user's timezone** at the moment of crediting, not the domain date of the referenced entity and not a wall-clock instant. This mirrors [`FRD-08 · BR-08-13`](../frd-08-delivery-management/frd-08-delivery-management.md#business-rules). Because `User.timezone` currently has no settings UI and falls back to `UTC` in practice ([`FRD-07 · FR-07-34`](../frd-07-user-settings/frd-07-user-settings.md#functional-requirements)), the resolver must go through the same helper the budget cycle uses, so both move together when a timezone control ships.
- `FR-12-11`: The full recompute must run **on demand**, when the collector opens the `Progreso` section and the cache is older than six hours, and after any administrative action of `FR-12-44`. There must be **no cron job and no materialized view**: the single daily cron slot is already occupied by the notification dispatcher.
- `FR-12-12`: The ledger write must happen **inside** the business mutation's own transaction and **after its last refusal**, so a mutation that returns a refusal never leaves a credit behind. The progress **cache** must never be written inside a money transaction, because a single row per user would be a new write-write conflict surface for the serializable payment path. This is the placement rule of [ADR 0022](../../../design/decisions/0022-transaction-refusal-rollback-contract.md) applied to a new writer.
- `FR-12-13`: The Server Action that wraps a credited mutation must return the progression delta in its own success payload (`pointsDelta`, `rankUp`, the list of medals unlocked) so the client can raise the toast **optimistically**, as the repository's default client-mutation pattern requires. The toast must not wait for the next navigation and must not be produced by a deferred post-response hook.

### The rank ladder

- `FR-12-14`: The system must expose **ten ranks**, whose thresholds come from the superlinear curve `pointsForRank(n) = round(200 * (n - 1) ^ 1.75 / 10) * 10`, calibrated against the base profile of 210 points per month so that reaching rank 10 takes roughly forty-five months of steady recordkeeping. The names follow the rank ARTWORK, not the other way round: each rung is designed first as a fantasy artefact of a single mythology (the life of one crystal, from the shard asleep in the rock to the creature that carries it burning) and then named after what the emblem shows. They keep the guild flavour of the club (Kōhai, Senpai) and stay generic to the medium, free of any brand or title. The art record is `rank-art-guide.md`:

  | #   | es                        | en                    | Threshold | Lore (es)                                                       | Typical month |
  | --- | ------------------------- | --------------------- | --------- | --------------------------------------------------------------- | ------------- |
  | 1   | Kōhai                     | Kohai                 | 0         | `"Tu primera pieza, todavía dormida en la roca."`               | 0             |
  | 2   | Buscador de reliquias     | Relic Seeker          | 200       | `"Rescatas lo que otros dieron por perdido."`                   | 1             |
  | 3   | Escriba del grimorio      | Grimoire Scribe       | 670       | `"Tu colección ya tiene su propio libro."`                      | 4             |
  | 4   | Senpai del gremio         | Guild Senpai          | 1.370     | `"Otros empiezan a seguir tu luz."`                             | 7             |
  | 5   | Portador del filo         | Bladebearer           | 2.260     | `"El acero roto vuelve entero, y esta vez es tuyo."`            | 11            |
  | 6   | Guardián de las horas     | Warden of Hours       | 3.340     | `"Sabes esperar, y esperar bien es medio oficio."`              | 16            |
  | 7   | Invocador del cristal     | Crystal Summoner      | 4.600     | `"La esquirla que hallaste al principio ya arde en tus manos."` | 22            |
  | 8   | Centinela de esmeralda    | Emerald Sentinel      | 6.020     | `"Custodias lo que ya no se reimprime."`                        | 29            |
  | 9   | Gran maestro de la bóveda | Vault Grandmaster     | 7.610     | `"Nada entra ni sale de la bóveda sin tu llave."`               | 37            |
  | 10  | Leyenda viva, Rango S     | Living Legend, Rank S | 9.350     | `"El cristal ya no necesita vitrina: tiene alas."`              | 45            |

- `FR-12-15`: Every surface that names a rank must print **`"Rango N de 10"`** next to the name. A themed ladder has no intuitive order on its own, and the position is the part that actually answers "how far along am I".
- `FR-12-16`: The **highest rank reached is permanent**. The stored highest index never decreases, even when the derived point total falls because an entity was deleted or became ineligible. What moves backwards is the progress bar inside the current band, never the title.
- `FR-12-17`: Ranks 9 and 10 must additionally require a **merit lock** expressed as a percentage of the **shipped** medal catalogue: **45 %** for rank 9 and **60 %** for rank 10. The denominator excludes medals the collector cannot control (a medal that depends on another user's action, and any event medal whose window has closed). Since the catalogue v2 pass of 2026-08-26 **no catalogued medal falls under either exclusion**: `store-mapped-1`, the only row that waited on a stranger, was replaced by `store-charted-1`, and no event medal exists yet. The denominator is therefore the whole shipped album, **28**, and the two ranks need **13** and **17** medals (`ceil(0.45 × 28)` and `ceil(0.60 × 28)`). Expressing the lock as a percentage rather than a count is what kept it reachable while the catalogue grew from twelve awardable pieces to twenty-eight without the rule itself changing. The exclusions stay in the accessor because a future event medal will need them. The lock must be **visible from rank 6 onward**, with the count stated in plain copy (`"Leyenda viva pide el 60 % del álbum. Llevas 9 de 28."`), never revealed only at the moment the collector hits it.
- `FR-12-18`: A collector's rank, points and medals are **visible only to that collector**. No surface in this FRD shows another user's progression in any form, aggregated or otherwise.
- `FR-12-19`: Reaching a new rank must raise a **one-time, dismissible celebration** distinct from the medal toast. It fires once per rank per user and is never replayed, including after a recompute that re-derives the same rank.

### The medal album

- `FR-12-20`: The system must ship a catalogue of **28 medals across 6 series**, every one of them shipped and evaluable. Series are the album's pages and are the only grouping the album offers.

  | id                              | Name (es)            | Condition                                                                 | Rarity           | `publicSafe` |
  | ------------------------------- | -------------------- | ------------------------------------------------------------------------- | ---------------- | ------------ |
  | **Primeros pasos (8)**          |                      |                                                                           |                  |              |
  | `first-order`                   | Primer pedido        | first order registered                                                    | Tirada normal    | yes          |
  | `first-payment`                 | Primer pago          | first payment logged                                                      | Tirada normal    | yes          |
  | `first-arrival`                 | Primera llegada      | first delivery received                                                   | Tirada normal    | yes          |
  | `first-order-closed`            | Círculo cerrado      | one order fully paid and fully arrived                                    | Primera edición  | yes          |
  | `first-review`                  | Primera reseña       | reviewed a store the collector already received from                      | Tirada normal    | yes          |
  | `first-photo-order`             | Del papel a la ficha | created an order from an image                                            | Tirada normal    | yes          |
  | `first-store`                   | Puerta nueva         | an order at a second distinct store                                       | Tirada normal    | yes          |
  | `first-preorder`                | Pre-reserva anotada  | an order carries an expected arrival window                               | Tirada normal    | yes          |
  | **La espera (4)**               |                      |                                                                           |                  |              |
  | `patience-60`                   | Dos meses de espera  | an order delivered 60 or more days after it was placed                    | Primera edición  | yes          |
  | `patience-120`                  | La espera larga      | 120 or more days                                                          | Edición limitada | yes          |
  | `patience-200`                  | La espera imposible  | 200 or more days, and it arrived                                          | Holográfica      | yes          |
  | `split-arrival`                 | Llega por partes     | one order that arrived across more than one delivery                      | Primera edición  | yes          |
  | **La vitrina (4)**              |                      |                                                                           |                  |              |
  | `collection-10`                 | Diez piezas          | 10 products delivered                                                     | Tirada normal    | no           |
  | `collection-50`                 | Media centena        | 50 products delivered                                                     | Primera edición  | no           |
  | `collection-150`                | Vitrina llena        | 150 products delivered                                                    | Holográfica      | no           |
  | `arrivals-25`                   | Puerto conocido      | 25 deliveries received                                                    | Edición limitada | no           |
  | **Explorador (4)**              |                      |                                                                           |                  |              |
  | `variety-3`                     | Gustos amplios       | 3 distinct product types delivered                                        | Tirada normal    | no           |
  | `countries-3`                   | Tres fronteras       | delivered products from stores in 3 distinct countries                    | Primera edición  | no           |
  | `variety-6`                     | Colección mixta      | 6 distinct product types delivered                                        | Edición limitada | no           |
  | `stores-10`                     | Mapa propio          | 10 distinct stores with a delivery                                        | Holográfica      | no           |
  | **Cronista (4)**                |                      |                                                                           |                  |              |
  | `clean-record-1`                | Ficha impecable      | one order with every product field complete                               | Tirada normal    | yes          |
  | `store-charted-1`               | Tienda cartografiada | a store the collector registered was approved (and is public, `BR-12-07`) | Primera edición  | yes          |
  | `reviews-5`                     | Voz de confianza     | five reviews of stores the collector received from                        | Edición limitada | yes          |
  | `clean-record-10`               | Archivo limpio       | 10 orders with complete records                                           | Holográfica      | yes          |
  | **Secretas (4, no hint shown)** |                      |                                                                           |                  |              |
  | `midnight-order`                | Turno de madrugada   | an order registered between 00:00 and 04:00 civil time                    | Primera edición  | yes          |
  | `swift-arrival`                 | Llegó volando        | an order fully arrived in 7 days or less                                  | Edición limitada | yes          |
  | `same-day-settle`               | Cuentas al día       | an order paid off and closed on the day it arrived                        | Holográfica      | yes          |
  | `year-streak`                   | Un año contigo       | 12 consecutive months with at least one order                             | Firmada          | yes          |

  **All 28 ship and are evaluable, and no medal renders as `"Próximamente"`.** Phase 1 opened with twelve awardable pieces (the seven `Primeros pasos` rows as the page then stood, the four of `La espera`, and one secret medal chosen by the blueprint) while the other twelve stayed visible as silhouettes. The catalogue v2 pass approved on 2026-08-26 closed that gap: every deferred condition was already resolvable against the schema exactly as it stood, so the deferral was an ordering decision and not a capability gap. The pass promoted the twelve, corrected `first-store` (it used to resolve the same condition as `first-order`, so two pieces unlocked from one click), raised `first-order-closed` and `clean-record-10` one rarity level each, replaced `store-mapped-1` with `store-charted-1`, and added `first-preorder`, `countries-3`, `reviews-5` and `swift-arrival` so no series is left short of four and `Primeros pasos` fills both of its rows.

  `store-mapped-1` ("a store the collector created was approved **and another user ordered from it**") was the only row in the catalogue flagged as outside the collector's control, and that flag existed so a rank gate is never hostage to a stranger's behaviour. `store-charted-1` keeps the intent, putting a real place on the shared map, and moves the finish line to the part the collector controls: registering a store that survives moderation. Its resolver applies the same creditable-store gate as every other medal query (`APPROVED`, public, not private, `BR-12-07`), which is stricter than approval alone on purpose, because a private store is not on the shared map at all. No collector can hold `store-mapped-1`, since it was catalogued but never awardable.

  Rarity across the 28 descends like a real print run: **10 `Tirada normal`, 7 `Primera edición`, 5 `Edición limitada`, 5 `Holográfica`, 1 `Firmada`**. `Primeros pasos` stays almost entirely `Tirada normal` so the first page a collector sees is where they learn what the baseline looks like.

- `FR-12-21`: Rarity must be communicated through a single metaphor, the **print run**, with five levels and a distinct visual treatment each: `"Tirada normal"` (matte, no shine), `"Primera edición"` (gold corner seal), `"Edición limitada"` (numbered border), `"Holográfica"` (animated iridescent ring), `"Firmada"` (a signature drawn over the piece). Rarity must never be carried by colour alone: it also carries a monospaced eyebrow label naming the level.
- `FR-12-22`: Medals must grant **no points**. They are status only. A medal must never appear in the ledger as a `ruleKey` and must never change a rank threshold.
- `FR-12-23`: A medal, once unlocked, is **never revoked**. Medals whose condition is a **state** rather than an event are marked `stateful` in the catalogue and additionally display `"vigente"` or `"ya no vigente"` without ever losing the unlock: the album records that the collector reached it, not that they still hold it.
- `FR-12-24`: Every medal must carry a **`publicSafe`** flag stating whether it could ever be shown on a public surface. Medals that would leak collection volume, product categories or store choices are `publicSafe: false`. Nothing in this FRD renders a public surface; the flag exists so a future one cannot be built without the classification already being made.
- `FR-12-25`: A locked medal must render as a **silhouette with its hint visible**, so the album shows what is still out there. The four secret medals are the exception: they render as a silhouette with **no hint** and a neutral label, and reveal their name and condition only once unlocked.
- `FR-12-26`: The album must show progress at two levels: a global counter (`"12 de 28"`) and a per-series counter on each page (`"2 de 4"`).
- `FR-12-27`: A medal must have a **detail view** showing how it was obtained, the date it was unlocked, its rarity and its series. The `"% de coleccionistas que la tienen"` line is specified but must **not** render while the platform has too few users for the figure to be meaningful; it is not a phase-1 or phase-2 deliverable.
- `FR-12-28`: The medal catalogue's persistence must carry, from phase 1, the fields that time-limited events need: `series`, `availableFrom`, `availableTo` and `numbered`. A numbered medal stamps its ordinal at unlock time and displays it (`"#042 de 200"`). Outside its window a medal can never be unlocked, retroactively or otherwise. **The administration surface that creates and schedules an event is explicitly a future phase** and is not specified here; phase 1 and phase 2 ship no way to author an event, only the shape that will hold one.
- `FR-12-29`: Unlock toasts must be **queued one at a time** with a short separation between them, so an action that unlocks several medals at once does not stack overlapping surfaces. Past **three** medals in one action the sequence stops being readable (ten unlocks would hold the screen for roughly forty seconds), so the batch collapses into a **single toast naming the count** and its qualifying-rarity unlocks do not escalate to the full-screen celebration either; the album is where a batch that size is read. Same principle as `FR-12-43`. Added by the 2026-08-23 review, see `fdd-12` §2.7.

### Surfaces

- `FR-12-30`: The app must expose a **`Progreso`** section with exactly **three tabs**: `"Resumen"`, `"Medallas"` and `"Rangos"`. The active tab persists in the URL and is omitted from the URL when it is the default (`"Resumen"`), following the same filter and sort persistence pattern the orders, stores and deliveries lists already use.
- `FR-12-31`: The `"Resumen"` tab must show the current rank emblem and name, `"Rango N de 10"`, a progress bar with the points still missing to the next rank, the merit-lock counter once rank 6 is reached (`FR-12-17`), this month's point breakdown by rule group, and the honesty line of `FR-12-41`.
- `FR-12-32`: The `"Medallas"` tab must show the album: one page per series, the global counter of `FR-12-26`, unlocked medals in colour and locked ones as silhouettes per `FR-12-25`, and each series' own progress.
- `FR-12-33`: The `"Rangos"` tab must show the full ten-rank ladder with the current rank marked, past ranks legible, and future ranks in silhouette with their threshold and lore visible. Thresholds are not hidden: a ladder whose next step is unknown cannot be planned against.
- `FR-12-34`: The medal detail of `FR-12-27` is a **subview of the `"Medallas"` tab**, not a fourth tab and not a separate top-level route. Leaving it returns to the album page the collector came from, with that page's scroll position preserved.
- `FR-12-35`: The dashboard must carry a **`"Tu rango"` widget**: a compact strip with the emblem, the rank name, `"Rango N de 10"`, the progress bar, the points still missing, and a short row of the most recently unlocked medals. The widget links into the `Progreso` section and performs no mutation, consistent with the dashboard being read-only ([`FRD-06 · FR-06-15`](../frd-06-dashboard/frd-06-dashboard.md#functional-requirements)).
- `FR-12-36`: The unlock toast and the rank celebration are **global surfaces**: they can appear over any flow that credited them (order creation, payment, arrival, review), not only inside the `Progreso` section.
- `FR-12-37`: The rank celebration must be a light, dismissible modal following the repository's canonical modal pattern, shown once per rank per `FR-12-19`.
- `FR-12-38`: Settings must expose a single switch, `"Ocultar mi progresión"`, in the `Preferences` section ([`FRD-07 · FR-07-30`](../frd-07-user-settings/frd-07-user-settings.md#functional-requirements)). When it is on, the navigation entry, the dashboard widget, the toasts and the celebrations all disappear together. Points keep accruing in the ledger unless the collector also purges it (`FR-12-46`), so turning the layer back on does not start them from zero.
- `FR-12-39`: The `Progreso` section must show a **visible but disabled** placeholder for comparison between collectors: `"Próximamente: compara con otros coleccionistas."` It must not link anywhere, must not accept an opt-in, and must not collect any preference, because the feature it names is out of scope (see `## Out of Scope`).
- `FR-12-40`: The section must have honest empty states. Before any points exist AND the collector has never reached a rank above the first rung or held a medal: `"Todavía no tienes puntos. Registra tu primer pedido y empieza."` An album with nothing unlocked shows all silhouettes and its counter at `"0 de 28"` rather than an empty container. A collector whose live total was voided down to zero (`FR-12-44`) but who reached a higher rank or holds a medal beforehand is a **different** honest state, not the first-run one: the rank ladder underneath already shows that history, so greeting them with "start your record" would contradict what the same screen says a moment lower. That collector instead sees the normal rank hero at `0` points, with no separate zero-points line: the hero card already prints the figure, so a standalone sentence restating it read as redundant next to the rank ladder and album that carry the actual history.
- `FR-12-41`: The `"Resumen"` tab must carry a permanent honesty line: `"Los puntos miden tu registro, no tu gasto."` It is not a tooltip and not a dismissible hint.

### Backfill and administration

- `FR-12-42`: The migrated Notion history must be **credited**, with every resulting entry marked `source = BACKFILL`. Because 96 % of the migrated store payments are a one-to-one backfill that fused the advance and the balance into a single record, the script must write **one synthetic entry per order** for those payments rather than attempting to reconstruct two payment events that were never separately recorded. Backfill points count toward the private rank and are structurally excluded from any future comparison between users.
- `FR-12-43`: The backfill must be **silent**. Every medal it unlocks is written already marked as seen, so opening the app after the migration does not fire dozens of toasts, and medals whose condition is a "first time" are stamped with the backfill date rather than a fabricated original date. The collector sees **one aggregated welcome celebration** naming the rank and the medal count, not a replay of their history.
- `FR-12-44`: An administrator must be able to **void** a user's points. The void is a signed reversal that recomputes the affected user's derived total **and their highest rank index**, not a flag that hides them from a listing, and it writes to `admin_audit_log` **in the same transaction** through the existing audit writer of [`PRD-03 · FRD-01`](../../prd-03-admin-and-moderation/frd-01-admin-identity-and-access/frd-01-admin-identity-and-access.md). Implemented: the mutation in `WO-01` and the admin surface in [`WO-07`](bp-01-collector-progression/work-orders/wo-07-admin-progression-surface.md), which gates it behind `requireAdmin()` on both the route and the Server Action and asks for the reason in the canonical confirmation modal. The void covers every live entry the collector holds; it takes no entry selection and no date range. The operational note that once blocked this (`admin_audit_log` excluded from the production cutover) is resolved: the table ships through migration `20260723200006` and the deploy pipeline runs `prisma migrate deploy`.
- `FR-12-45`: An administrator must have a **read-only** view of a user's ledger. There is no administrative path that grants, edits or reorders entries. Implemented in [`WO-07`](bp-01-collector-progression/work-orders/wo-07-admin-progression-surface.md) as the `Progresión` section of the admin console: account lookup, a paginated ledger showing every entry (voided rows included, with the reason each was voided for) and a summary of points, rank and medal counts. No monetary figure is read or rendered.
- `FR-12-46`: A collector must be able to **purge their own points history** from settings. The purge deletes the ledger, the unlocks and the progress cache for that user, is stated as permanent, and is confirmed in a modal before it runs.

### Full-screen celebration for high-rarity medals

- `FR-12-47`: The full-screen celebration of `FR-12-36`/`FR-12-37` fires for exactly two triggers, and no other: a rank-up (`FR-12-37`), and a medal unlock whose rarity is **Holográfica** or **Firmada**, the two highest tiers of the print-run ramp (`FR-12-21`). A medal unlock at the other three tiers (Tirada normal, Primera edición, Edición limitada) is announced only by the unlock toast (`FR-12-36`); it never escalates to the full-screen surface. The medal variant follows the same canonical modal pattern as the rank-up variant, not a separate overlay system, and is dismissed the same way (`FR-12-37`).

## Business Rules

- `BR-12-01`: **No point rule reads money.** The rule module must not import, mention or dereference `amount`, `amountMinor`, `allocatedAmountMinor`, `totalCost`, `unitPrice`, `cost`, `openBalanceMinor`, `currencyCode`, `exchangeRate` or any identifier ending in `Minor`. Money-derived conditions arrive as booleans from the adapter of `FR-12-09`. This is enforced by a **static guard test** over the rule module with an allowlist of imports **and an inline fixture containing a forbidden token that the scanner must actually flag**, so the guard proves it sees the real shape of the file rather than passing over an empty one.
- `BR-12-02`: One collector's data is never shown to another: no amounts, no averages, no counts of orders, stores or products, no categories, no purchase dates, no store or order names. This holds even though no cross-user surface exists yet, because it is the rule any future one inherits.
- `BR-12-03`: There are no points for empty activity. Navigation, reading, filtering and re-editing an already-credited record are worth nothing by design (`FR-12-08`).
- `BR-12-04`: All crediting is server-side and against real state. Purely declarative facts are deliberately worth little and always carry a hard monthly cap.
- `BR-12-05`: **The ledger is append-only and admits no negative entries.** The balance is derived by the recompute of `FR-12-03`, which validates that the referenced entity still exists and is still eligible. An entry is never edited and never deleted to correct a balance. This single rule is what closes the delete-and-recreate, cancel-and-reactivate, and reopen-a-delivery loops without any compensating write.
- `BR-12-06`: **The rank reached is permanent.** The highest rank index never decreases (`FR-12-16`). Only the bar inside the band moves backwards.
- `BR-12-07`: **A store credits only while it is `APPROVED` and public**: a private store and a store that is `PENDING` or `REJECTED` credit nothing, not the order, not the arrival, not the review, not the discovery. **Who registered the store is not part of the gate**, so a store the collector registered themselves credits normally once a moderator approves it. Rationale (amended 2026-08-23, relaxed from the original rule that also disqualified a self-created store): in PandaTrack the ordinary flow is that the collector registers the shop they buy from, so authorship is a property of almost every honest store, not a signal of abuse. Approval is the real anti-abuse lock because it is the one step the collector cannot take alone: an invented store sits `PENDING` and credits zero until a moderator approves it, and a store kept private has no counterparty anyone else can ever see. The original rule was also empirically unworkable, because the Notion import attributed all 140 stores to the owner and therefore zeroed the entire ledger. ([`FRD-04 · FR-04-33`](../frd-04-store-domain/frd-04-store-domain.md#functional-requirements), [`FR-04-40`](../frd-04-store-domain/frd-04-store-domain.md#functional-requirements)).
- `BR-12-08`: **Medals grant no points and are never revoked** (`FR-12-22`, `FR-12-23`). A `stateful` medal shows whether its condition still holds without withdrawing the unlock.
- `BR-12-09`: Nothing in this domain touches real money: no prizes, no raffles, no discounts, no chance. The reward is status.
- `BR-12-10`: There are no daily streaks, no league demotion and no annual goal that shows the collector behind. The hobby is episodic by nature and a progression layer that punishes a quiet month would be lying about it. The one exception is `year-streak`, which counts **months with at least one order** and only ever rewards, never penalises.
- `BR-12-11`: The collector can switch the entire layer off (`FR-12-38`) and can purge their ledger (`FR-12-46`). No part of the progression may be made mandatory or non-dismissible.
- `BR-12-12`: `BACKFILL` points count toward the private rank and are excluded from any comparison between users, which is why the source is stored on the entry rather than inferred from its date.
- `BR-12-13`: **Without an assigned payment there are no order points.** `order-registered`, `delivery-received` and `order-completed` credit only once the order carries at least one `PaymentAllocation` ([`FRD-05 · FR-05-42`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements)). Otherwise the self-declared path (create an order at any approved public store, then use quick arrival, [`FRD-08 · FR-08-36`](../frd-08-delivery-management/frd-08-delivery-management.md#functional-requirements)) would yield roughly one hundred points without a single unit of currency having moved. The rule reads only the **existence** of an allocation, never its amount, so it does not violate `BR-12-01`.
- `BR-12-14`: **Splitting a purchase must never be the dominant strategy.** `order-registered` is sublinear per store and month with a **floor of 5** (`FR-12-07`): eight orders at one store yield 70 (20 + 15 + 10 and then five at the floor) where eight orders at eight stores yield 120 after the cap, and both are below eight times twenty. The floor exists because the previous zero-yield fifth order punished the legitimate buyer who really does have five pre-orders open at the same store.
- `BR-12-15`: **Every cap declares its unit.** A cap stated as a bare number is ambiguous between points and events and has already produced one wrong reading; the catalogue of `FR-12-04` states `pts/month` or `events/month` on every row.
- `BR-12-16`: **`order-created` is irrevocable against cancellation but not against deletion.** Cancelling an order keeps its 5 points, because cancelling is a real outcome the collector should not be punished for recording. Physically deleting the order removes the entity, so the entry stops counting at the next recompute, exactly like every other rule. The 10-events-per-month cap is what makes the create-and-cancel loop bounded rather than free.
- `BR-12-17`: **`occurredOn` is a civil day resolved on the server** (`FR-12-10`), never a wall-clock instant and never the entity's own domain date. A recompute run in a different month must not re-bucket an old entry.
- `BR-12-18`: **`entityId` carries no foreign key.** It is a plain string so that a ledger entry survives the physical deletion of the row it refers to. The entry surviving is what lets the recompute observe "this no longer exists" and drop it, instead of the deletion cascading and erasing the evidence.
- `BR-12-19`: In user-facing copy the unlockable object is `"medalla"` / `"medal"`. The word `"badge"` stays reserved for the design system's status chip and must never label a medal. `"rango"` / `"rank"`, `"rareza"` / `"rarity"`, `"punto"` / `"point"` and `"álbum"` / `"album"` are registered in `docs/product/glossary.md` in the same change that implements this FRD.
- `BR-12-20`: **An event window is absolute.** A medal with an `availableTo` in the past can never be unlocked again, by recompute, by backfill, or by administrative action. That irreversibility is the entire value of a numbered event piece; making it recoverable would make it worthless.
- `BR-12-21`: **No comparison between collectors ships under this FRD.** The placeholder of `FR-12-39` is disabled and collects nothing, including any opt-in preference, because collecting a consent before the legal preconditions are met would be the wrong order.

## Acceptance Criteria

### `AC-12-01`

- Given a collector who creates and cancels an order twenty times within one civil month
- When the progression is recomputed
- Then `order-created` contributes exactly 50 points (the 10-events-per-month cap of `FR-12-06`), not 100
- And no `order-registered`, `delivery-received` or `order-completed` points exist for any of them, because none received a `PaymentAllocation` (`BR-12-13`)

### `AC-12-02`

- Given a collector who creates an order, logs a payment against it, and then deletes the order, repeated three times
- When the progression is recomputed after each cycle
- Then the derived balance returns to exactly its starting value each time
- And no negative ledger entry was ever written (`BR-12-05`)

### `AC-12-03`

- Given a delivery that is marked delivered, then reopened, then deleted, and then recreated for the same products
- When the progression is recomputed
- Then `delivery-received` is credited exactly once for that set of products
- And the total after the cycle equals the total before the reopen

### `AC-12-04`

- Given an order that is cancelled, reactivated, cancelled and reactivated again
- When the progression is recomputed after each transition
- Then the balance is exact at every step, with `order-created` surviving each cancellation per `BR-12-16`
- And any per-product marker cleared by the cancellation stops contributing its points at the same step

### `AC-12-05`

- Given a store review that is deleted and then written again for the same store
- When the progression is recomputed
- Then `store-reviewed` is credited exactly once, because its `entityId` is the store and not the review (`FR-12-04`)

### `AC-12-06`

- Given the static money guard of `BR-12-01` and an inline fixture containing the token `totalCost`
- When the guard runs against that fixture
- Then it fails
- And when it runs against the real rule module it passes, proving the guard sees the real shape of the file rather than an empty one

### `AC-12-07`

- Given orders, arrivals, reviews and product-type discoveries carried out entirely against a private store, a store that is `PENDING` and a store that is `REJECTED`
- When the progression is recomputed
- Then all of them credit zero points (`BR-12-07`)
- And no medal in any series is unlocked by them
- And the same activity against an `APPROVED`, public store the collector registered themselves credits in full, because authorship is not part of the gate (`BR-12-07`)

### `AC-12-08`

- Given an order at an approved public store with no `PaymentAllocation` at all, whose products are marked arrived through quick arrival
- When the progression is recomputed
- Then only the 5 points of `order-created` exist for it
- And `order-registered`, `delivery-received` and `order-completed` credit nothing until the order receives its first allocation (`BR-12-13`)

### `AC-12-09`

- Given eight orders placed in one civil month, once all at the same store and once across eight different stores
- When the progression is recomputed for each scenario
- Then the same-store scenario yields strictly fewer `order-registered` points than the eight-store scenario
- And both yield strictly fewer than eight times the first-order value
- And the fifth and later same-store orders each yield the floor of 5, never 0 (`BR-12-14`)

### `AC-12-10`

- Given the ten thresholds of `FR-12-14`
- When they are computed from the formula
- Then they are strictly increasing
- And a collector whose derived total falls below their current threshold keeps their rank name and index, with only the progress bar moving backwards (`BR-12-06`)

### `AC-12-11`

- Given the Notion history is backfilled
- When the collector next opens the app
- Then every entry created by the backfill carries `source = BACKFILL`
- And every medal it unlocked is already marked as seen, so no unlock toast fires
- And a single aggregated welcome celebration is shown, naming the rank reached and the medal count
- And medals whose condition is a "first time" carry the backfill date rather than a fabricated original date (`FR-12-43`)

### `AC-12-12`

- Given a `stateful` medal whose condition stops holding (for example the collection falls back below its threshold after deletions)
- When the album is opened
- Then the medal is still unlocked and still in colour
- And it additionally reads `"ya no vigente"` (`BR-12-08`)

### `AC-12-13`

- Given a collector who enables `"Ocultar mi progresión"`
- When they navigate the app and perform an action that would have credited points
- Then the navigation entry, the dashboard widget, the toast and the rank celebration are all absent
- And the ledger entry is still written, so disabling the switch again restores the accumulated progression rather than starting from zero (`FR-12-38`)

### `AC-12-14`

- Given any ledger state
- When `recomputeUserProgress` runs twice in a row with no intervening mutation
- Then both runs produce identical derived totals, rank, and unlock set (`FR-12-03`)

### `AC-12-15`

- Given an `OrderItem` of a product type the collector has never received, still in a non-delivered state
- When the progression is recomputed
- Then `product-type-discovered` credits nothing
- And it credits exactly 12 points, once and for that type only, after the product reaches `DELIVERED`

### `AC-12-16`

- Given an administrator voids a user's points
- When the void commits
- Then the reversal, the recomputed derived total and the recomputed **highest rank index** are all persisted
- And an `admin_audit_log` entry naming actor, action, target and reason was written in the same transaction (`FR-12-44`)

## Implementation Notes

- The domain lives in a new data-layer module, `src/lib/data/progression/`, split into `*Queries.ts` and `*Mutations.ts` per [ADR 0015](../../../design/decisions/0015-data-access-layer-shape.md) and the project-structure rule. The rule catalogue itself is a separate, dependency-light module so the static guard of `BR-12-01` has a small, stable surface to scan.
- Four models are expected: the append-only ledger entry, a rebuildable per-user progress cache (never a source of truth), a medal unlock record carrying `unlockedAt`, `seenAt` and `source`, and a per-user progression settings row. `userId` is duplicated onto every child row per `data-layer-user-id-duplication.mdc`. The ledger's `entityId` is a plain string with no foreign key (`BR-12-18`).
- The credit call must be placed after the last refusal of the host mutation and inside its transaction (`FR-12-12`). This adds a new case to the existing static transaction-refusal scan (`src/test/transaction-refusal-guard.test.ts`) rather than a new guard file.
- The recompute reads the user's own entries and resolves eligibility in **batch** per `entityType`. This is correct and cheap up to roughly twenty thousand entries per user; the ceiling is re-measured at that point rather than pre-optimised now.
- Rank thresholds live in a constant, not in a migration, precisely because the curve is calibrated against three simulated profiles and one real user and will be recalibrated after six months of real data.
- The grades `I` / `II` / `III` of phase 2 subdivide the band **inside** a rank and move **no** rank threshold, so introducing them can never demote anyone.
- New i18n namespace `src/i18n/locales/{es,en}/progress.json`, keyed by `ranks.<rankKey>`, `medals.<key>.name`, `medals.<key>.hint` and `rarity.<level>`. Grades are composed, never translated.
- Six ADRs are expected, numbered from `0035` (the next free number after [`0034`](../../../design/decisions/0034-store-account-reconciliation-adjustment.md)). Two are accepted: [`0035`](../../../design/decisions/0035-collector-progression-point-ledger.md) (the append-only ledger with a derived balance, which also absorbed the money-guard decision) and [`0036`](../../../design/decisions/0036-medal-rarity-visual-system.md) (the medal rarity visual system). Four remain to be written as their owning work order lands: `0037` in `WO-02` (deferred credit with no pending state in the UI), `0038` in `WO-03` (the permanent rank and its merit lock), `0039` in `WO-04` (the phased social surface and its hard legal preconditions), and `0040` in `WO-05` (medals carry no point bonus and are never revoked).
- The visual specification, including the album page layout, the five rarity treatments, the toast and the celebration, is owned by the FDD (`fdd-12-collector-progression.md`) and its self-contained prototype at `docs/product/prd-02-collector-app/frd-12-collector-progression/prototype/collector-progression.html`.
- `prd-02-collector-app.md` already lists `FRD-12` in its children and names it in the scope narrative (`ADR 0035`, `ADR 0036`); that PRD update landed ahead of this FRD leaving `DRAFT`, so no further PRD edit is owed when this FRD's status changes.

## Lifecycle Interaction Model

Progression never owns a confirmation of its own: it rides on the host mutation's confirmation and reports afterwards. This section fixes the functional behavior; the visual treatment belongs to the FDD.

| Action                               | Confirmation                             | Apply / feedback model                                                                                          | Post-action target                   |
| ------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Credit points on a business mutation | none (implicit in the host action)       | written inside the host transaction after its last refusal; the delta returns in the same Server Action payload | stays on the host surface            |
| Medal unlocked                       | none                                     | optimistic toast raised over the host flow, queued one at a time (`FR-12-29`)                                   | stays on the host surface            |
| Rank reached                         | none                                     | dismissible celebration modal, once per rank (`FR-12-19`)                                                       | stays on the host surface            |
| Open `Progreso`                      | none                                     | recompute runs on demand when the cache is older than six hours, otherwise the cached values render immediately | stays on the section                 |
| Toggle `"Ocultar mi progresión"`     | none (a preference)                      | optimistic; the layer disappears in the same tick and reverts on server failure                                 | stays in settings                    |
| Purge points history                 | confirmation modal (stated as permanent) | awaited, not optimistic, because it is irreversible                                                             | stays in settings, section now empty |
| Administrative void                  | confirmation with a required reason      | awaited; recompute and audit entry commit together                                                              | stays on the admin surface           |

## Error Contract

Progression is a **secondary effect** and must never turn a successful business action into a failure. The contract is asymmetric on purpose:

- **Credit failures are swallowed by the host action.** A failure to append a ledger entry never converts an `ok: true` order, payment or delivery into a refusal. It is captured once with progression-safe context and the collector simply sees no toast; the next recompute picks the fact up from real state for every `der.` rule, and the idempotency key of `FR-12-02` makes a later retry safe for the rest.
- **Recompute** returns typed, expected codes rather than exceptions: `PROGRESS_RECOMPUTE_BUSY` (a recompute for this user is already running; the cached values render and the surface says they may be a few minutes old) and `PROGRESS_CACHE_MISSING` (first run; the section shows its loading state rather than an error).
- **Settings**: `PROGRESSION_ALREADY_HIDDEN` and `PROGRESSION_PURGE_NOT_CONFIRMED` are validation-layer refusals, not exceptions.
- **Administration**: `USER_NOT_FOUND`, `VOID_REASON_REQUIRED`, and `AUDIT_WRITE_FAILED`, the last of which rolls the whole void back rather than voiding without an audit trail (`FR-12-44`).
- **Backfill script**: `BACKFILL_ALREADY_APPLIED` (idempotency observed rather than an error) and `BACKFILL_SOURCE_INCOMPLETE`, which aborts before writing anything.
- The validation layer rejects malformed input before any of these run: an unknown `ruleKey`, a non-positive point value, a negative or future `occurredOn`, and an unknown medal key.

## Analytics

Progression events are namespaced under a new `POSTHOG_EVENTS.PROGRESSION` group in `src/lib/constants.ts`:

- section: `progress_viewed` (carries the active tab), `progress_tab_changed`, `progress_rank_ladder_viewed`
- album: `medal_album_viewed`, `medal_series_page_viewed` (carries `series`), `medal_detail_viewed` (carries `medal_key`, `rarity`, `unlocked`)
- unlocks: `medal_unlocked` (server, carries `medal_key`, `rarity`, `series`, `source`), `medal_toast_dismissed`, `rank_up_celebrated` (server, carries the new rank index)
- dashboard: `progress_widget_clicked`
- settings: `progression_hidden`, `progression_shown`, `progression_ledger_purged`

Events carry rule keys, medal keys, rarities and counts. They **never** carry a point total tied to a monetary figure, an order identifier, a store name, or any amount.

## Screens and Data Contract

All routes live under `/{locale}/(app)/progress`, are authenticated, and are scoped to the session user. A progression surface belonging to another user is not addressable at all: there is no user parameter anywhere in this contract. Visual layout is owned by the FDD; this section fixes purpose, data loaded, actions and states.

### Section, three tabs — `/{locale}/progress`

- **Purpose:** the collector's own progression workspace, opened on `"Resumen"`.
- **Data loaded:** `getProgressSummary(userId)` (current rank index and key, derived total, next threshold and the points missing, this month's breakdown by rule group, merit-lock counts once rank 6 is reached, cache age); `getMedalAlbum(userId)` for the `"Medallas"` tab (the catalogue joined with this user's unlocks, grouped by series, with per-series and global counters); the static ten-rank ladder for the `"Rangos"` tab. A recompute is triggered first when the cache is older than six hours (`FR-12-11`).
- **Actions:** navigation only, plus tab selection persisted in the URL (`FR-12-30`). No mutations.
- **States:** loading skeleton; first-run empty state (`FR-12-40`); recompute-in-progress notice rendered over cached values rather than blocking; the disabled comparison placeholder of `FR-12-39`; the whole section is unreachable, including its navigation entry, while `"Ocultar mi progresión"` is on.

### Medal detail — `/{locale}/progress/medals/[medalKey]`

- **Purpose:** inspect one medal. It is a **subview of the `"Medallas"` tab** (`FR-12-34`), not a peer of the three tabs.
- **Data loaded:** `getMedalDetail(medalKey, userId)` → name, series, rarity, condition text, hint, `publicSafe`, unlock date and ordinal when numbered, `stateful` currency when it applies, and the event window when the medal carries one.
- **Actions:** back to the album page it came from, preserving that page's scroll position. No mutations.
- **States:** unlocked; locked with hint; locked and secret (neutral label, no hint, per `FR-12-25`); event medal outside its window (shown as permanently unobtainable, never as merely locked); an unknown key resolves to 404.

### Dashboard widget — inside `/{locale}/dashboard`

- **Purpose:** keep the progression visible where the collector already starts their session.
- **Data loaded:** the same `getProgressSummary(userId)` projection, trimmed to emblem, rank name, `"Rango N de 10"`, bar, points missing, and the last few unlocked medals.
- **Actions:** one link into `/{locale}/progress`. No mutations, per [`FRD-06 · FR-06-15`](../frd-06-dashboard/frd-06-dashboard.md#functional-requirements).
- **States:** hidden entirely when `"Ocultar mi progresión"` is on; first-run variant inviting the collector to register their first order.

### Settings controls — inside `/{locale}/settings`

- **Purpose:** the opt-out and the purge.
- **Data loaded:** the progression settings row for this user.
- **Actions:** `toggleProgressionVisibilityAction`, `purgeProgressionLedgerAction` (confirmed, awaited).
- **States:** the purge confirmation modal stating permanence; a post-purge empty section.

## State Model

### Ledger entry

An entry is immutable once written. Its only dimensions are `source` (`LIVE` or `BACKFILL`) and whether the recompute currently considers it **eligible**. Eligibility is not stored: it is re-derived on every recompute from the referenced entity's current state (does it still exist, is the order not cancelled, is the delivery neither reopened nor cancelled, is the store still approved and not private, does the order carry at least one `PaymentAllocation`). An entry therefore moves silently between counting and not counting over its lifetime, with no write of its own.

### Medal

| State                  | Meaning                                                                                             | Reachable from                      |
| ---------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `locked`               | condition not met; silhouette plus hint                                                             | initial                             |
| `locked-secret`        | condition not met; silhouette, no hint, neutral label                                               | initial, for the four secret medals |
| `unlocked`             | condition met at least once; permanent (`BR-12-08`)                                                 | `locked`, `locked-secret`           |
| `unlocked-not-current` | `stateful` medal whose condition no longer holds; still unlocked, labelled `"ya no vigente"`        | `unlocked`                          |
| `expired`              | event medal whose `availableTo` has passed without an unlock; permanently unobtainable (`BR-12-20`) | `locked`                            |

There is no transition out of `unlocked`. `unlocked-not-current` and `unlocked` move back and forth freely as the underlying state changes; neither is a revocation.

### Rank

Two values are tracked: the **current** rank index derived from the current point total, and the **highest** rank index, which is the running maximum and never decreases (`BR-12-06`). Copy always names the highest. The progress bar always measures the current total against the next threshold above the highest. For ranks 9 and 10 the derived index additionally requires the merit lock of `FR-12-17` to be satisfied; a collector who has the points but not the album sits at the previous rank with the lock counter shown, never at a half state.

## Confirmed

- points are earned by collector actions, never by amounts of money, and no rule may read a monetary field
- the ledger is append-only with no negative entries; the balance is derived by recompute
- the rank is permanent, private to its owner, and always displayed as `"Rango N de 10"`
- the ten-rank ladder of `FR-12-14` is approved as written, names and lore included
- rarity uses the print-run metaphor, five levels, approved as written
- the album is twenty-eight medals across six series, all of them shipped and evaluable (catalogue v2, approved 2026-08-26; it opened at twenty-four catalogued rows of which twelve were awardable)
- medals grant no points and are never revoked
- the `Progreso` section has exactly three tabs, and the medal detail is a subview of `"Medallas"`, not a fourth tab
- the dashboard carries a `"Tu rango"` widget with a compact strip of recent medals
- the toast and the rank celebration are global surfaces
- the store gate is approval plus visibility, never authorship: an `APPROVED`, public store the collector registered themselves credits normally (amended 2026-08-23, `BR-12-07`)
- the Notion history is backfilled, credited, marked `BACKFILL`, and silenced **in design only**: the owner declined to run the backfill on their own account (decided 2026-08-23), so the account starts at zero for parity with future collectors on the eventual comparison surface. `FR-12-42` and `FR-12-43` stay in scope and the script stays available and tested; it simply has not been executed, and running it later is still a supported one-off
- there is no leaderboard and no comparison between collectors in this FRD
- time-limited events are prepared in the data model now and administered later

## Open Questions

- ~~which of the three secret medals ships in phase 1 alongside `Primeros pasos` and `La espera`~~ Answered by [ADR 0040](../../../design/decisions/0040-medals-grant-no-points-and-are-never-revoked.md) (`midnight-order`, the cheapest to evaluate) and then made moot on 2026-08-26, when the whole `Secretas` page shipped
- whether the phase-2 grades `I` / `II` / `III` are rendered as separate ladder steps in the `"Rangos"` tab or only as a subdivision of the current band's progress bar
- whether the shareable progress card (an exportable image carrying rank and medal counts, and nothing about another collector) belongs to this FRD's phase 2 or waits for the comparison FRD; it is the one growth surface that works with a single user, but it is also the first surface that leaves the app
- whether `"% de coleccionistas que la tienen"` (`FR-12-27`) has a privacy-safe form at low user counts, or whether it must simply wait for the same threshold the comparison FRD waits for
- whether the phase-2 point rule `store-created-adopted` (`FR-12-04`, 40 points, capped at 80 pts/month) should keep waiting on a stranger. Its anchor is "a store this user created is `APPROVED` **and** another user has ordered from it", which is the same non-controllability that got `store-mapped-1` replaced by `store-charted-1` on 2026-08-26. The two are not the same object, and that may be the whole answer: a capped point rule is an upside a collector may never collect, where a medal sits in a rank gate and reads as a locked door with no handle. But on a product whose user base is currently one person the rule can never fire at all, so the question for the owner is whether to leave it as written, narrow it to the part the collector controls (the store being approved, mirroring `store-charted-1`), or drop it and redistribute its points. Nothing depends on the answer until phase 2's point rules ship
- whether the phase-2 gate stands: at least two of the three recordkeeping-hygiene metrics (share of orders with complete product records, median lag between an arrival and its registration, share of payments logged within three days) improving by 20 % or more within sixty days of phase 1, measured against the pre-launch baseline computable today

## Out of Scope

- **Comparison between collectors: any leaderboard, ranking table, public profile, or surface that shows one collector something about another.** This is deferred to a future FRD, and that FRD may only be written once **all** of the following hold: at least **50 users with an active opt-in** (a table of twenty people reports that nobody is there, which is arithmetic and not an implementation gap, and the backfilled owner would sit permanently and unreachably on top from day one), plus the legal preconditions: an **age gate**, **informed consent under Ley 29733**, **real account deletion**, and a **formally constituted operator**. `FR-12-39` ships a disabled placeholder that collects nothing, so no consent is gathered before it can be gathered properly.
- the administration UI that creates and schedules a time-limited event; only the columns that will hold one are in scope (`FR-12-28`)
- anonymous community aggregates, a founder badge, and any public alias
- any change to how orders, payments, deliveries or stores themselves behave: this FRD reads their outcomes and writes nothing back into them
- monetary rewards, discounts, raffles or anything with a cash value (`BR-12-09`)
- streaks, leagues, seasons and annual goals (`BR-12-10`)
- identity verification and multi-account prevention, accepted as a residual risk because there is no material reward to farm

## Linked Blueprints

- `docs/product/prd-02-collector-app/frd-12-collector-progression/bp-01-collector-progression/bp-01-collector-progression.md`

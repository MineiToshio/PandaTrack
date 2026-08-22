---
id: FRD-08
type: FRD
slug: delivery-management
title: Delivery Management
status: ACTIVE
parent: PRD-02
children:
  - BP-01
last_updated: 2026-08-20
source_features:
  - FEAT-0015
implementation_status: PARTIALLY_IMPLEMENTED
---

# FRD-08 Delivery Management

## Overview

Define the store-scoped delivery workflow that groups eligible order products into one delivery, tracks the delivery lifecycle, and resolves delivered product state back into the order domain.

## Domain Goal

Give collectors a reliable way to consolidate products from one store into deliveries, track what is already at the store, and mark what has finally reached them.

## Current State

### Implemented

- the full delivery vertical ships under `/{locale}/deliveries`: list (filters, removable URL chips, oldest-first sort, pagination, loading/empty/empty-filtered states), detail (per-status hero, source-order-grouped products, summary, private note), create (from-order and standalone entry points, eligibility empty state), and edit
- delivery lifecycle actions: mark delivered (with required received date), reopen, cancel, delete, plus inline private-note save — each re-derives affected `OrderStatus` in the same transaction
- quick arrival ("ya me llegó", `FR-08-36`): one-step capture of an already-received delivery, launched from the order detail (desktop + mobile action cards) and from the dashboard arrival rows (`FR-06-10a`), sharing the `createDelivery` transaction through an optional `receivedDate` rather than a parallel mutation
- delivery persistence, eligibility queries, and `arrived at store` / `in transit` / `delivered to user` progression (data foundation from BP-01 WO-01/WO-02, lifecycle UI from the S9 redesign)
- `Delivery.receivedDate` column added (migration `20260612224123_add-delivery-received-date`) to back FR-08-22 and FR-08-31
- human-readable delivery id format `DLV-YYYYMMDD-NN`
- [`FRD-05`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md) defines the order-product structure that delivery eligibility depends on
- Settlement on arrival (`FR-08-39` through `FR-08-45`, `BR-08-14` through `BR-08-18`, approved by the owner 2026-08-20, implemented the same day (uncommitted, staging), [`ADR 0032`](../../../design/decisions/0032-delivery-triggered-settlement.md); the settlement amount itself is bounded by [`ADR 0034`](../../../design/decisions/0034-store-account-reconciliation-adjustment.md)'s canonical `openBalanceMinor`): an arrival now offers the "I already paid the rest" checkbox, computes the settlement amount server-side, writes it in its own transaction after the delivery commits, and reverses it on reopen.
- Order-close consumption of unassigned store money (`FR-08-46`, approved by the owner 2026-08-20, implemented the same day (uncommitted, staging), [`ADR 0033`](../../../design/decisions/0033-store-debt-scoped-to-open-orders.md)): the mutation that closes an order now consumes any unassigned money sitting in that order's store and currency before computing the settlement above, so a delivered order no longer leaves debt understated in the store's own unassigned pool.

### Known issues

- shipping/received dates can display one day early in negative timezones (domain dates persisted at UTC midnight formatted without `timeZone: "UTC"`); systemic across orders and deliveries — tracked for a dedicated fix
- mobile list action row overflows the viewport by a few pixels at 390px (shared pattern with the order list)

## User Stories

### US-08-01 Group products into one delivery

As a collector, I want to create one delivery that includes products from multiple orders of the same store so I can track the real delivery I am waiting on.

### US-08-02 Know what is already at the store

As a collector, I want to mark products as already arrived at the store before I create a delivery so I can remember what is ready to ship.

### US-08-03 Correct delivery mistakes

As a collector, I want to reopen, cancel, or edit a delivery when the store changes what is being sent so PandaTrack stays aligned with reality.

## Functional Requirements

- `FR-08-01`: A delivery must belong to exactly one store.
- `FR-08-02`: A delivery may contain products from multiple orders of the same store.
- `FR-08-03`: Products from different stores must never appear in the same delivery.
- `FR-08-04`: A delivery must contain at least one product when it is created or saved through edit.
- `FR-08-04a`: Each order product is treated as an **atomic shippable unit** and is either fully included in this `entrega` or not included at all. The create and edit flows must not expose a per-product quantity selector; the selection control is a single boolean per order product. Collectors who expect units of the same SKU to arrive separately must split them at order creation time per [`FR-05-08a`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md). The canonical rule and the upgrade path for future partial fulfillment live in `docs/product/glossary.md`.
- `FR-08-05`: A delivery must require a shipping date and prefill it with the current date on create.
- `FR-08-06`: Shipping date selection must allow only past or current dates.
- `FR-08-07`: A delivery must support a required delivery cost, including `0`.
- `FR-08-08`: A delivery must support a delivery currency selected by the user.
- `FR-08-09`: Delivery currency must default to the user's base currency when present.
- `FR-08-10`: When delivery currency differs from the user's base currency, the delivery flow must require one exchange-rate value for reporting.
- `FR-08-10a`: A delivery whose stored exchange rate cannot convert its cost into the collector's **current** base currency must read as pending FX reconciliation. This state is **derived**, never stored (mirroring the order-level rule): `Delivery.exchangeRateBaseCode` records the base currency the stored `exchangeRate` converts into, and the delivery is pending whenever that rate is missing or was recorded against a different base ([ADR 0024](../../../design/decisions/0024-fx-reconciliation-derived-from-rate-base.md)). Changing the base currency therefore writes nothing to any delivery; it only moves the value the derivation compares against, so returning to a previously used base makes the affected deliveries convertible again on its own. While a delivery is pending, surfaces that convert its cost to the base currency (detail hero, summary card) must suppress the stale conversion and show a pending indicator instead of a value computed from an unusable rate. Editing the delivery and saving reaffirms its currency and rate and stamps the current base, which resolves the pending state — per-delivery edit is the reconciliation path (there is no bulk delivery FX-reconciliation modal for MVP). A delivery whose currency equals the base currency is never pending.
- `FR-08-11`: A delivery must support an expected arrival date range.
- `FR-08-13`: Delivery state must be derived from lifecycle actions rather than edited directly through a free status field.
- `FR-08-14`: Delivery states for MVP must include `IN_TRANSIT`, `DELIVERED`, and `CANCELLED`.
- `FR-08-15`: The create-delivery flow must support starting from an order with store and eligible products preselected.
- `FR-08-15a`: Every entry point into that flow (the order detail's aside actions card, its mobile sticky bar, the link under its products list, and the orders-list row actions of `FR-08-15b`) must disappear when the order has no product left that a delivery could take, that is when every product is already `IN_TRANSIT` or `DELIVERED`, or the order is cancelled. The wizard could otherwise only reach its own empty state, and on a completed order it reads as if the delivery had not been recorded. The quick-arrival action of `FR-08-36` shares the same condition, so the two appear and disappear together. When that leaves the mobile sticky bar with no action at all, the bar and the scroll space reserved for it are both dropped rather than rendered empty.
- `FR-08-15b`: The orders list must offer both delivery actions on a row without opening the order: quick arrival (`FR-08-36`) and the create-delivery wizard. They live inside the row's **expanded** drawer, on both breakpoints, next to the existing "Abrir detalle" link, and follow the same gate as every other entry point (`FR-08-15a`).
  - Not a column of their own. Measured at the `lg` breakpoint where the table starts (1024px): the grid `40px 1.6fr 0.9fr 1.2fr 0.9fr 1.1fr 24px` leaves the five data tracks about 96px each, and the status chip already needs ~120px in its ~100px track, so the row is at its limit before anything is added. A control column would take roughly a fifth of the remaining width and start truncating the store name, which is one of only two strings that identify a row.
  - Both affordances are **text weight**, and only the primary one carries the accent. The row sits on a tinted band, where the design system asks for neutral weight over brand colour, and a filled or tonal control there outranks the card it belongs to. Hierarchy is carried by colour alone, not by colour plus fill plus height; the 44px touch target comes from padding, so the row reads as a footer seam (one hairline, no second tinted box) rather than a pasted-on control.
  - On the mobile card the detail link is omitted: the whole card, expanded band included, is already the link to the order, so repeating it would be a third affordance past the two-affordance limit. The desktop table drawer has no such overlay and keeps it.
  - Acting on a row does not patch the list. Membership is server-derived through filters, sort and pagination, so the page refreshes; with the default "Solo activas" chip a fully received order therefore leaves the list, and the success toast (with its link to the delivery) is the confirmation that it worked.
- `FR-08-16`: The standalone create-delivery flow must first choose a store and then show eligible products for that store only.
- `FR-08-17`: Delivery store options must include only stores that still have eligible products.
- `FR-08-18`: Delivery product selection must show eligible products grouped by their source order.
- `FR-08-19`: Products already delivered or already attached to another active delivery must not appear in delivery selection results.
- `FR-08-20`: When a product is added to a delivery through the create wizard or through edit, it must automatically become `IN_TRANSIT` regardless of its prior state (`NONE` or `ARRIVED_AT_STORE`). The single exception is the quick-arrival flow of `FR-08-36`, where the delivery is created already received and its products go straight to `DELIVERED`, because the box is in the collector's hands before any record exists and `IN_TRANSIT` would assert a milestone that never happened.
- `FR-08-21`: A product may belong to only one delivery at a time.
- `FR-08-22` **(revised 2026-08-20, `ADR 0032` pending extension):** Marking a delivery as delivered must require the collector to select the received date, then mark every associated product as delivered to the user. This is the formal-flow counterpart of the quick-arrival "mark delivered" moment: whether it also gains the balance-settlement checkbox of `FR-08-39` is the decision left open in `## Open Questions`, so today this action still records no payment.
- `FR-08-23`: Reopening a delivered or cancelled delivery must recalculate delivery-related product states so they are editable again, restoring the detail view to an editable lifecycle state. Reopen returns the delivery to `IN_TRANSIT`, returns its products to `IN_TRANSIT`, and clears the stored received date. Reopen is only valid from `DELIVERED` or `CANCELLED`; reopening an `IN_TRANSIT` delivery is rejected. When reopening a `CANCELLED` delivery, any product that was re-attached to another active (non-cancelled) delivery while this one was cancelled blocks the reopen (the one-delivery-per-product rule in `BR-08-08`); the collector must resolve that conflict first.
- `FR-08-24`: Removing a product from a delivery during edit must recalculate that product's delivery-related state. The delivery's store is immutable in edit mode (its products depend on the store); changing stores requires deleting the delivery and creating a new one. Edit is only permitted while the delivery is `IN_TRANSIT`; a `DELIVERED` or `CANCELLED` delivery must be reopened first (the edit route redirects to detail otherwise).
- `FR-08-25`: Cancelling or deleting a delivery must return all of its still-unfulfilled products to `arrived at store`. Physical delete is allowed only while the delivery is `IN_TRANSIT` or `CANCELLED`; a `DELIVERED` delivery must be reopened first.
- `FR-08-26`: Delivery detail must expose one inline-editable private note field that can be saved without entering full edit mode, including saving an empty value to clear the note.
- `FR-08-27`: Delivery detail actions must follow the same action hierarchy as orders: one primary action, one secondary action, and destructive actions inside `More`.
- `FR-08-28`: The deliveries list must support filters for store, product-name text, and date range.
- `FR-08-29`: Deliveries list filters must persist in the URL and render removable chips in the same interaction pattern used by `Stores`.
- `FR-08-30`: The deliveries list must sort from oldest date to newest by default and paginate with the same collector-workspace pattern used by the order and store lists.
- `FR-08-31`: Each delivery card in the list must show store, shipping date, expected arrival range, and status. Delivered cards must also show the received date.
- `FR-08-32`: Each delivery card must expand to show the products included in that delivery as one flat list, without source-order grouping.
- `FR-08-33`: The deliveries list must expose a visible primary action to create a new delivery, following the collector-workspace listing pattern used by orders and stores.
- `FR-08-34`: The delivery product selector must expose an in-section product-name search input that filters the already-loaded eligible products in place. Matching must be case-insensitive and accent-insensitive. Source-order groups with no matching products must be hidden, and when no products match the current query the section must show an empty-state message instead of the product list. Filtering must be entirely client-side and must not refetch eligible products.
- `FR-08-35`: The deliveries list must expose a user-selectable sort control inside the filter surface with four options: `oldest` (shipping date ascending — the default per `FR-08-30`), `recent` (shipping date descending), `eta-asc` (expected-arrival start ascending, deliveries without an expected arrival sorted last), and `store-asc` (store name ascending). The active sort persists in the URL via a `sort` param, which is omitted from the URL when it equals the default (`oldest`).

- `FR-08-36` **(revised 2026-08-20, `ADR 0032`):** The app must expose a **quick-arrival** action ("ya me llegó") that records, in one step, a delivery that already reached the collector. It is the primary action of the order actions card (desktop and mobile) whenever the order is not cancelled and still has at least one eligible product, with the create wizard demoted to the secondary action; it is also the trailing control on each dashboard arrival row per [`FR-06-10a`](../frd-06-dashboard/frd-06-dashboard.md), which is where it closes the loop the arrival reminders open. Every launcher shares one modal and one coordinator, so a new entry point never means a second flow. The flow opens the canonical modal and asks for the minimum that is knowable after the fact:
  - **products**: every eligible product of that order starts selected. When the order has more than one eligible product the full list renders as checkboxes so the collector can uncheck what has not arrived, plus a select-all / clear-all control; a single-product order renders no picker at all, only the product name.
  - **arrival date**: required, prefilled with today, past or current dates only. It is written to `Delivery.receivedDate`.
  - **balance settlement**: an "I already paid the rest" checkbox, pre-checked by default (`FR-08-39`). The mechanism that computes and writes the settlement is specified in `FR-08-39` through `FR-08-44` (`ADR 0032`); this launcher is one of the surfaces it applies to per `FR-08-45`.
  - **shipping cost, currency and dispatch date**: collapsed and optional. While collapsed, the surface must state in plain copy what will be written (no cost recorded, dispatch date equal to the arrival date) instead of applying those defaults silently.

  The resulting delivery is a normal, first-class `entrega`: it is created directly with status `DELIVERED`, its `receivedDate` set, its products moved to `DELIVERED`, and the source order status re-derived in the same transaction exactly as the wizard plus mark-delivered would. It can be opened, edited, reopened and deleted like any other delivery, which is also how a missing shipping cost is filled in later. The flow never runs on a cancelled order.

- `FR-08-38` **(revised 2026-08-20, `ADR 0032`):** The quick-arrival act of `FR-08-36` must also be available **scoped to a store** rather than to a single order, from the orders list "Por tienda" view (see [`FR-05-48`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md)). The collector picks pending products of one store, which may belong to several of that store's orders, and confirms once. The flow reuses the same modal, the same defaults and the same write path as `FR-08-36`, including the balance-settlement checkbox of `FR-08-39`; only the scope key changes (store instead of order), and two things are added to the confirmation because the selection can now cross orders:
  - the products are **grouped under their source order code** in the picker, so the provenance of every line is visible before confirming;
  - the modal states in plain copy that **a single delivery will be created** with all of them (`BR-08-12`), because a delivery spanning several orders is a shape the collector has almost never seen.

  The confirmation stays at "count plus list": it declares the quantity in the primary action and shows every product, and it deliberately does not ask the collector to type a confirmation word. That contract holds at **every** size, one product included: the per-order entry points preselect the whole order themselves, so with a single product they name it in a sentence instead of listing it, but a store-scoped selection was picked row by row and the dialog must echo it back whatever its size (26 of the collector's 36 standing orders contribute exactly one pending product, so this is the common case). A recorded arrival is recoverable (deleting the delivery returns its products to `ARRIVED_AT_STORE` per `FR-08-25`); what is lost is one bit, whether a product had been marked `ARRIVED_AT_STORE` beforehand, which is the known cost already stated in `BR-08-11`. The selected products are never trusted as sent: the write re-reads each one and refuses the whole selection when any product is not the caller's, is not from that store, is no longer eligible, or belongs to a cancelled order. Because the selection can span multiple orders, the settlement of `FR-08-40` is planned per order, not per delivery: each order in the batch that becomes complete or partially settleable gets its own `StorePayment`, per `BR-08-17`.

- `FR-08-38a` **(revised 2026-08-20, `ADR 0032`, no behavior change):** A delivery must never be created from a product whose order is cancelled, whatever the entry point. A cancelled order is outside the delivery lifecycle (its status is never re-derived by a delivery mutation), so such a delivery would move the product's state and leave the order frozen, with no surface able to explain the mismatch. The refusal is decided in the write path itself, before anything is written, rather than in one caller: the store-scoped selection of `FR-08-38` spans several orders, and the create wizard's product picker does not filter cancelled orders either. Previously only the per-order quick arrival enforced this, so the wizard could reach the invalid state. This refusal runs before the delivery transaction of `FR-08-42` even opens, so a cancelled-order product can never reach the settlement step either; nothing about settlement on arrival changes this guard.

- `FR-08-37`: When the quick-arrival flow records no dispatch date, `Delivery.deliveryDate` must be set to the arrival date rather than to the current date or to an invented earlier date. `Delivery.deliveryDate` is `NOT NULL` and is the value the dashboard reads as dated arrival evidence, so standing it in with the only date the collector actually stated keeps punctuality and monthly bucketing honest.

### Settlement on arrival (added 2026-08-20, `ADR 0032`)

In the collector's market a store never releases goods before it has been paid in full (`BR-08-14`), so an arrival already proves the balance was settled; these requirements let the collector record that payment in the same motion as the arrival instead of re-entering it from the order afterward. `FR-08-39` through `FR-08-45` (the checkbox, its computed amount, the two-transaction write, and the reopen reversal) apply to the five "already arrived" launchers named in `FR-08-45`; whether that checkbox UI extends to the formal delivery flow is tracked as an open question, not decided here. **`FR-08-46` is the one exception (revised 2026-08-20, round-4 arbitration):** the order-close consumption of unassigned store money is a general invariant of any order closing to `COMPLETED`, not something scoped to the five checkbox launchers, so it also runs behind the formal flow's "mark delivered" action even while that action's own settlement UI stays undecided.

- `FR-08-39` **(revised 2026-08-20, `ADR 0034`):** The arrival window (the quick-arrival modal shared by `FR-08-36` and `FR-08-38`) must expose a checkbox, **"I already paid the rest"**, positioned directly below the "when did it arrive" date field and above the collapsed "add cost and dispatch date" disclosure, so the date the settlement will use and the control that triggers it read together. The checkbox is **pre-checked** by default because a fully paid delivery is the normal case (`BR-08-14`), unless the guard of `FR-08-44` applies. **When the order's `openBalanceMinor` (`FRD-05 · BR-05-32`) is already `0`, for example because an earlier store reconciliation wrote off the whole remaining balance, the checkbox does not render at all**: there is nothing left to settle, so offering it would invite re-paying a debt the collector no longer owes. Unchecking the box when it does render records the arrival exactly as it does today: no `StorePayment` is created and no order balance is touched.
- `FR-08-40` **(revised 2026-08-20, `ADR 0034`):** When the checkbox of `FR-08-39` is checked, the settlement amount must be computed on the server, never accepted from the client, along two branches:
  - **Complete branch.** When the delivery leaves every product of the order delivered, the amount is always the order's `openBalanceMinor` (`FRD-05 · BR-05-32`: `Order.totalCost` minus its `PaymentAllocation`s minus its `StoreAccountAdjustmentLine`s), re-read after the order-close consumption of `FR-08-46` has applied. This branch never needs per-product prices or a prior breakdown and covers close to all cases.
  - **Partial branch.** When the delivery leaves the order partially delivered, the amount is calculable only when **both** hold: every delivered product carries a non-null `unitPrice`, and the order carries no allocation with `orderItemId IS NULL` (money left undetailed). The second condition is the one that fails most often: undetailed money on the order gives the app no way to know how much of it belongs to the arriving products, so a computed remaining-per-product figure would read inflated. When both hold, the amount is the sum, over each delivered product, of its base (`quantity x unitPrice`, or the order's `totalCost` when the order has a single product) minus what is already allocated to that product, **capped at `min(that sum, openBalanceMinor(order))` (revised 2026-08-20, round-4 arbitration)**: the per-product formula only ever sees product-level `PaymentAllocation`s, and a `StoreAccountAdjustmentLine` is written per order, invisible to it, so an order carrying a reconciliation write-off could otherwise have its per-product sum add up to more than the order's real remaining balance. When the cap actually reduces the sum, the write is recorded as one **undetailed** allocation for the capped amount rather than a per-product breakdown scaled down to fit: scaling the per-product lines to fit the cap would itself be the proportional estimate `BR-08-16` forbids. When either of the two auto-compute conditions fails, the amount field is left **blank** for the collector to fill in, capped at the order's `openBalanceMinor`, and the surface shows what it does know as a **reference only**, never as the answer, stating plainly why it could not compute the figure. Proportional splitting to estimate this amount is forbidden in every case (`BR-08-16`).
- `FR-08-41`: The settlement date must default to the delivery's arrival date and remain editable by the collector; the measured gap between paying the balance and the delivery is a median of one day, with an outlier as wide as fourteen.
- `FR-08-42`: The arrival and the settlement must run as **two separate transactions**, the delivery first and the settlement second, never as one combined transaction with commit-time retry: a serialization failure only surfaces at commit, which is the late refusal `ADR 0022` forbids, and the arrival itself must never be blocked by a payment failure. If the settlement transaction fails after its retries, the arrival stays recorded and the surface offers **Retry**; every retry recomputes the plan on the server per `FR-08-40` rather than resubmitting a stale amount. **Retry is preconditioned on the delivery still reading `DELIVERED`**, re-checked at the moment `Retry` runs, not trusted from whatever state rendered the button: if the collector reopened the delivery in the gap between the failure and the retry, `Retry` must refuse rather than write a settlement `StorePayment` whose `settledByDeliveryId` points at a delivery that is no longer `DELIVERED`, which nothing then deletes and which the `onDelete: Restrict` FK of `FR-08-43` would then block from ever being cleaned up by deleting that delivery.
- `FR-08-43` **(revised 2026-08-20, `ADR 0033`):** Only one `StorePayment` is created per settled order, never one per (store, currency); reopening a delivery that settled a balance (`FR-08-23`) must delete every `StorePayment` whose `settledByDeliveryId` points at that delivery, recalculate the affected caches, and report the reverted amount to the collector. The `Delivery` carries the `settledByDeliveryId` back-reference on the `StorePayment` it created, with `onDelete: Restrict` rather than `SetNull`, so a settlement payment can never survive its own delivery being deleted as a silently detached, irreversible record. **This reversal never reaches the order-close consumption of `FR-08-46`.** When that consumption also ran on close, it wrote its `PaymentAllocation` onto a different, pre-existing `StorePayment` that carries no `settledByDeliveryId` for this delivery; that money was paid to the store before this delivery existed and stays correctly applied to the reopened order, which still owes the rest. The reopen-reversion copy must therefore name **both** amounts when both apply: the settlement amount reverted, and, separately, any consumed amount that stays applied, so the collector is never told a smaller number went back than what the checkbox actually recorded.
- `FR-08-44` **(revised 2026-08-20, round-4 arbitration; two branches by whether this arrival closes the order):** When the store and currency of the arriving order already hold unassigned, undeclared money (see [`FRD-05` · `FR-05-60`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements)), the guard's behavior depends on whether this arrival closes the order (the full-order branch of `FR-08-40`):
  - **This arrival closes the order.** The order-close consumption of `FR-08-46` runs automatically, before the settlement amount is even computed, so the unassigned money is already folded into `openBalanceMinor` by the time `FR-08-40` reads it: there is no double-count left to guard against. The checkbox pre-checks exactly as it would with no unassigned money at all, and the surface's copy becomes **informative**: it names that some or all of the settlement comes from money already paid earlier, rather than warning the collector to assign it first.
  - **This arrival does not close the order** (a partial delivery). No consumption runs for an order that stays open, so this guard still applies as originally written: the checkbox must **not** be pre-checked, and the surface must offer to assign that money to the order first. This guards against counting the same money twice: the store's debt ceiling protects only the aggregate, not one order being paid through two different paths at once, and a pre-checked box would default to the side that manufactures money.
- `FR-08-45`: Settlement on arrival (`FR-08-39` through `FR-08-44`) applies to the five existing "already arrived" launchers of `FR-08-36` (order detail desktop and mobile, orders list, dashboard) and `FR-08-38` (store-scoped batch). Whether it also extends to the formal delivery flow (the create-delivery wizard's dispatch and the "mark delivered" action of `FR-08-22`) is left as an open, undecided question (see `## Open Questions`): the gap between paying and marking tends to be larger there, which argues against pre-checking the same box by default.
- `FR-08-46` **(added 2026-08-20, `ADR 0033`):** The moment an order's derived `OrderStatus` becomes `COMPLETED`, the app must consume any unassigned money already sitting in that order's store and currency, up to the order's own remaining balance, per [`FRD-05` · `FR-05-62`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements) and [`FRD-05` · `BR-05-28`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#business-rules) (`min(order's remaining balance, unassigned store money)`, oldest order first in a batch). **This consumption is not part of the delivery transaction that flips the status.** It runs inside the second, independent transaction `FR-08-42` already defines (the money transaction), attempted only after the delivery transaction has committed, and it is decided before that same transaction computes the delivery-triggered settlement amount of `FR-08-40`, because consuming first is what keeps that amount from overstating what the order still owes. It runs whenever an order closes with unassigned money to consume, whether or not the collector left "Ya pagué el resto" checked: unchecking the box only skips the settlement write, never this consumption. This delivery domain is the call site: whichever of the two order-closing mutations actually re-derived an order to `COMPLETED` (`createDelivery`, born `DELIVERED` when `receivedDate` is set, covering the five "already arrived" launchers of `FR-08-45`; or `markDeliveryDelivered`, the formal flow's "mark delivered" action) has its own money transaction invoke the consumption, for every order it just closed **(revised 2026-08-20, round-4 arbitration):** the requirement originally named only `markDeliveryDelivered` as the call site, but the five approved launchers verifiably call `createDelivery` instead (`src/lib/data/deliveries/deliveryMutations.ts:83`, via `quickArrivalAction.ts` / `storeArrivalAction.ts`), so the hookup is on the shared **transition** (`persistDerivedOrderStatuses` reporting a flip to `COMPLETED`), not on one mutation's name. This is also why the formal flow's "mark delivered" action gains this consumption call even though it does not gain the settlement checkbox of `FR-08-39`: the two are different questions, and only the checkbox stays open (`FR-08-45`). `editDelivery` is not a third call site: it is restricted to `IN_TRANSIT` deliveries (`FR-08-24`, `BR-08-07`) and its own transitions never write `DELIVERED` on any item, so it can never itself close an order. Without the consumption call site running on whichever mutation actually closed the order, a delivered order takes its own debt out of the store's total but leaves behind any payment that was never assigned to it, silently understating what the store's remaining open orders still owe (spec scenario reproduced in `AC-08-13`).

## Business Rules

- `BR-08-01`: Delivery is a separate domain from orders because it can group products from multiple orders within one store.
- `BR-08-02`: `arrived at store`, `in transit`, and `delivered to user` are separate product milestones.
- `BR-08-03`: Products that are already delivered or already attached to another active delivery are not eligible for new delivery selection and should not appear as disabled options.
- `BR-08-04`: When a delivery is reopened, the collector may edit products, cost, and dates again.
- `BR-08-05`: Delivery detail should not expose a separate automatic history timeline in MVP.
- `BR-08-06`: Delivery note follows the same single-textarea private-note pattern as orders and stores, including the ability to clear the note by saving an empty value.
- `BR-08-07`: Cancel and delete remain separate:
  - cancel preserves the delivery record with `CANCELLED`
  - delete removes it physically when delete rules allow it
  - delete must stay visible in the detail action menu so the collector can discover the rule, but a `DELIVERED` delivery cannot be deleted until it is reopened
- `BR-08-08`: A product belongs to at most one active (non-cancelled) delivery at a time (`FR-08-21`). Because cancelling a delivery returns its products to `arrived at store`, those products can be selected into a new delivery while the original stays `CANCELLED`. Reopening the original cancelled delivery is therefore blocked when any of its products now belongs to another active delivery, so reopen can never resurrect a duplicate delivery membership. The blocked reopen is surfaced as an expected, non-destructive error, not a silent failure.

- `BR-08-09`: A delivery can never be received before it was dispatched. Whenever both dates are present, `receivedDate` must be greater than or equal to `deliveryDate`; the pair is rejected at the validation boundary. The rule is stated here because the quick-arrival modal is the first surface that puts both pickers side by side, but it holds for every delivery.
- `BR-08-10`: A quick arrival records **no** shipping cost rather than a zero one that the collector never stated. `Delivery.cost` remains a required column, so an unstated cost is persisted as `0`; because that value feeds the dashboard's monthly shipping figure, the modal must say so on screen before saving and must keep the cost field one tap away. Making the column nullable so "not recorded" and "free shipping" become distinguishable is the known follow-up, deliberately out of scope of the quick-arrival change.
- `BR-08-12`: A store-scoped arrival (`FR-08-38`) writes **exactly one** `Delivery` for the whole selection, never one per source order, even when the products come from several orders of that store. `FR-08-02` already allows a delivery to span orders of one store; this applies it rather than changing it. The reason is that the fact being recorded is a physical box: one row per order would mint N `DLV-*` identifiers for one arrival, inflate the monthly delivery count, and force the shipping cost to be asked N times or split across orders, which is precisely what `BR-08-10` avoids by not asking for it at all. The cost belongs to the box, not to the orders.

  A consequence that has to be stated because this is the first flow where it can happen: `Delivery.currencyCode` is the currency of the **shipping cost**, not of the products. A store-scoped selection can legitimately mix orders denominated in different currencies, and that is not a conflict to resolve. With the default unstated cost of `0` the code is only a unit label on the delivery row; when a cost is declared it is declared once, in one currency, for the one box. Per-order currency stays where it belongs, on the order.

- `BR-08-11` **(revised 2026-08-20, settlement reopen path, `ADR 0032`; revised again 2026-08-20, `ADR 0033`, consumption survives reopen):** The quick-arrival flow offers no undo affordance of its own. Reversing it would require restoring each product's prior state, and `NONE` cannot be told apart from `ARRIVED_AT_STORE` once the delivery exists (delete returns products to `ARRIVED_AT_STORE` per `FR-08-25`), so an undo would assert a fact the collector never stated. The success toast links to the created delivery instead, where reopen, edit and delete already live. This does not conflict with `FR-08-43`: reopen is the delivery's general, already-existing lifecycle action, not a toast-level undo of the quick-arrival flow, and it now also deletes the `StorePayment` the arrival settled (`FR-08-23`), reported to the collector as the amount going back to the order's outstanding balance. **What reopen does not do is revert the order-close consumption of `FR-08-46`.** That consumption applies money the store already held, paid before this delivery ever existed, to this order's balance; reopening returns the order to `IN_TRANSIT`, but the order still genuinely owes less than its raw `totalCost` because that money is still, correctly, applied to it. Reverting it on reopen would manufacture debt the collector does not have. When both a settlement and a consumption applied on close, the reported amount names both, distinguished from each other.
- `BR-08-13` **(added 2026-08-16, `ADR 0030` §6):** **"Today" on every delivery surface is the collector's CIVIL day, resolved from `User.timezone`, never a wall-clock instant.** This is `BR-05-25` applied to deliveries, and for the same reason: lateness is decided against `expectedArrival*`, which is a calendar day stored at UTC midnight, so comparing an instant against it is wrong in both directions in a negative-offset zone (in Lima, UTC−5, a delivery due today reads late from 10:00, and one due tomorrow reads late from 21:00). Both consumers on the list are bound to one value — the row chips AND the "Atrasados" SQL toggle — because fixing one and not the other puts a delivery in the filter with no chip on it, on the same screen. The delivery detail hero is a Client Component, so its page resolves the day on the SERVER and passes it down as a prop; deriving it in the browser would desynchronise hydration. Its two forward-counting captions ("llega en N días" / "la ventana cierra en N días") are deliberately NOT the overdue formula and stay local — they count toward an arrival that has not happened, so there is nothing to unify them with.

- `BR-08-14` **(added 2026-08-20, `ADR 0032`):** **A delivery proves the balance was paid, not merely suggests it.** In the collector's market a store quotes, takes a partial advance, imports the goods, and only releases them once the remaining balance is paid in full; the store never ships on credit. The "goods received not invoiced" pattern common to general-purpose ERPs does not apply here because it exists for B2B trade where goods are received on credit and paid later, which is the opposite of this market's order. Measured on the collector's own history: 0 of 565 orders were ever delivered with an unpaid balance, and 524 of 525 orders show their last payment on or before the delivery date, with a median one-day gap. An order delivered with a balance still owed is not a debt under this axiom, it is a recording error.
- `BR-08-15` **(added 2026-08-20, `ADR 0032`):** **Only what the app itself computed gets broken down by product.** When the settlement amount is server-computed (`FR-08-40`'s complete branch, or its partial branch when both conditions hold), the resulting `StorePayment` may declare a `PaymentAllocation` per delivered product. When the collector types or corrects the amount because the app could not compute it, the allocation is recorded **without** a product breakdown (`orderItemId: null`): inventing a per-product split over a number the collector typed, rather than the app derived, would be a fabrication the app cannot stand behind. Any surplus inside a typed amount that belongs to no product (freight, a fee folded into the total) also stays undetailed, consistent with the existing rule that undetailed money belongs to no product (`FRD-05` order-level money is named, never split, [`FR-05-51`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md#functional-requirements)). Delivered products covered by a settlement are also marked paid through `declarePaidItemIds`, the parameter `createStorePayment` already accepts, so the store-grouped view reads "settled" instead of a misleading partial percentage.
- `BR-08-16` **(added 2026-08-20, `ADR 0032`):** **Proportional splitting is forbidden as an estimation method for the settlement amount, in every branch, with no exception.** This restates `ADR 0025` in the settlement context: measured error on the collector's own data ranges from -47% to +72%, which is why an uncalculable partial (`FR-08-40`) asks the collector rather than guessing.
- `BR-08-17` **(added 2026-08-20, `ADR 0032`):** **One `StorePayment` is created per settled order, never one per (store, currency).** Payments cannot be edited today, only deleted and re-created (`FRD-05 · BR-05-10`), so a payment that grouped several orders would turn any correction on one of them into destroying and rebuilding the others. A per-order `StorePayment` also inherits that order's own `exchangeRate` without ambiguity, which a payment spanning orders in different states would not.
- `BR-08-18` **(added 2026-08-20, `ADR 0032`):** **Settlement on arrival is forward-only; there is no retroactive migration.** Applied to the collector's existing history it would be a no-op (zero delivered orders carry an unpaid balance today), and it would falsify the payment date on 522 already-closed orders, replacing a real, previously recorded payment date with a derived one.

## Acceptance Criteria

### `AC-08-00`

- Given an open order with more than one product still to receive
- When the collector uses the quick-arrival action and confirms with today's date
- Then every product of that order is selected by default and visible as a checkbox list
- And one delivery is created already `DELIVERED` with that arrival date
- And the selected products become `delivered to user`
- And the order status is re-derived to `COMPLETED`, or to `PARTIALLY_DELIVERED` when the collector unchecked part of the list
- And the surface states, before saving, that no shipping cost is recorded and that the dispatch date equals the arrival date

### `AC-08-01`

- Given the collector creates a delivery from an order
- When the create-delivery view opens
- Then the store is prefilled
- And eligible products from that source order are already selected

### `AC-08-02`

- Given a collector opens the standalone delivery create flow
- When they choose a store
- Then only eligible products from that store appear
- And those products are grouped by source order

### `AC-08-03`

- Given a collector adds a product to a delivery
- When that product was in state `NONE` or `ARRIVED_AT_STORE`
- Then it becomes `IN_TRANSIT` automatically

### `AC-08-04`

- Given a collector marks a delivery as delivered
- When the operation succeeds
- Then all products linked to that delivery become delivered
- And the selected received date is saved on the delivery

### `AC-08-05`

- Given a collector cancels, deletes, or reopens a delivery
- When the action completes
- Then all affected products recalculate to the correct post-action state

### `AC-08-06`

- Given a cancelled delivery whose products were re-added to another active delivery
- When the collector tries to reopen the original cancelled delivery
- Then the reopen is blocked with an expected error
- And the original delivery stays `CANCELLED`

### `AC-08-07`

- Given the collector opens the deliveries list
- When they change the sort control to `recent`, `eta-asc`, or `store-asc`
- Then the list re-orders accordingly
- And the selected sort persists in the URL (and is omitted when it is the default `oldest`)

### `AC-08-08`

**Implemented 2026-08-20 (uncommitted, staging) (`FR-08-39` through `FR-08-46`, `ADR 0032`).**

- Given an order with one product left to receive and an outstanding balance, and no unassigned money sits in that store and currency
- When the collector uses the quick-arrival action, leaves "I already paid the rest" checked, and confirms
- Then the delivery is created `DELIVERED` and the order is re-derived to `COMPLETED`
- And a `StorePayment` is created for the order's `openBalanceMinor` (`FRD-05 · BR-05-32`), dated on the arrival date, with `settledByDeliveryId` pointing at the new delivery
- And the delivered product is marked paid via `declarePaidItemIds`

### `AC-08-09`

**Implemented 2026-08-20 (uncommitted, staging) (`FR-08-40`, `ADR 0032`).**

- Given a multi-product order where the delivered products all carry a `unitPrice` and the order has no allocation with `orderItemId IS NULL`
- When the collector confirms a partial quick arrival with "I already paid the rest" checked
- Then the settlement amount is computed as the sum, per delivered product, of its base minus what is already allocated to it
- And the resulting `StorePayment` declares one `PaymentAllocation` per delivered product

### `AC-08-10`

**Implemented 2026-08-20 (uncommitted, staging) (`FR-08-40`, `BR-08-16`, `ADR 0032`).**

- Given a multi-product order where at least one delivered product has no `unitPrice`, or the order carries money with `orderItemId IS NULL`
- When the collector confirms a partial quick arrival with "I already paid the rest" checked
- Then the amount field is blank and capped at the order's outstanding balance, and the collector must type it
- And the surface shows what it does know as a reference only, and states why it could not compute the figure
- And the resulting `StorePayment` allocation carries no product breakdown (`orderItemId: null`)

### `AC-08-11`

**Implemented 2026-08-20 (uncommitted, staging) (`FR-08-39`, `ADR 0032`).**

- Given an order with an outstanding balance
- When the collector unchecks "I already paid the rest" before confirming the arrival
- Then the delivery is recorded exactly as it is without the checkbox today
- And no `StorePayment` is created and the order's outstanding balance is unchanged

### `AC-08-12`

**Implemented 2026-08-20 (uncommitted, staging) (`FR-08-43`, `ADR 0033`).**

- Given a delivery that settled a balance on arrival
- When the collector reopens that delivery
- Then every `StorePayment` whose `settledByDeliveryId` points at it is deleted
- And the order's outstanding balance is restored by the reverted amount, which is reported to the collector
- And the delivery and its products return to `IN_TRANSIT` per the existing reopen behavior (`FR-08-23`)

### `AC-08-13`

**Implemented 2026-08-20 (uncommitted, staging) (`FR-08-46`, `ADR 0033`).**

- Given a store with two open orders, A and B, each with `totalCost` 50, and one unassigned payment of 30 recorded against that store and currency, with no allocation naming either order
- When the collector marks order A's delivery as delivered, completing order A
- Then the delivery transaction commits first and unconditionally, closing A, and the second, independent money transaction that follows consumes `min(A's remaining balance, unassigned store money)` = `min(50, 30)` = 30 from the unassigned pool into order A (`FR-08-46`)
- And A's own remaining balance after the consumption is 20, tracked at the order level exactly as any other outstanding balance
- And the store's "Pendiente en pedidos abiertos" figure now reflects only order B's own 50, never a figure understated by the 30 that was never assigned to B

### `AC-08-14`

**Implemented 2026-08-20 (uncommitted, staging) (`FR-08-39`, `FR-08-40`, `ADR 0034`).**

- Given an order of `totalCost` 180 whose entire remaining balance was written off by an earlier store reconciliation adjustment (`FRD-05 · FR-05-64`), so its `openBalanceMinor` is `0`
- When the collector later marks that order's delivery as delivered through quick arrival
- Then the arrival records normally and the order is re-derived to `COMPLETED`
- And the "I already paid the rest" checkbox does not render at all for this order
- And no `StorePayment` is created

### `AC-08-15`

**Implemented 2026-08-20 (uncommitted, staging) (`FR-08-42`, `ADR 0032`).**

- Given a delivery whose money transaction failed after the delivery itself committed, leaving a pending `Retry`
- And the collector reopens that delivery before invoking `Retry`
- When `Retry` is then invoked
- Then the money transaction is not attempted
- And no `StorePayment` is created with `settledByDeliveryId` pointing at the now-`IN_TRANSIT` delivery
- And the pending-settlement affordance is no longer shown for it

### `AC-08-16`

**Implemented 2026-08-20 (uncommitted, staging) (`FR-08-43`, `FR-08-46`, `ADR 0033`).**

- Given a delivery whose close-time consumption (`FR-08-46`) applied 30 of pre-existing unassigned money to its order, and which also wrote its own 20 settlement `StorePayment` on the same close
- When the collector reopens that delivery
- Then only the 20 settlement `StorePayment` is deleted
- And the 30 consumption allocation, recorded on a different, earlier `StorePayment`, is untouched and stays applied to the reopened order
- And the reopen confirmation names both the 20 reverted and the 30 that stays applied, as two distinct amounts

## Implementation Notes

- This FRD depends on [`FRD-05`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md) for order items, delivery eligibility, and order completion derivation.
- When a delivery mutation changes the status of any delivery (create, mark delivered, cancel, delete, reopen), this FRD's implementation is responsible for calling the pure `deriveOrderStatus` function defined in [`FRD-05 · BP-01 · WO-02`](../frd-05-order-payment-shipment/bp-01-order-domain-foundation/work-orders/wo-02-order-item-model-totals-fx-and-derived-order-state-rules.md) for each affected order, and persisting the resulting `OrderStatus` within the same transaction.
- Delivery list and detail should also prefer expandable cards over rigid tables for parity with the order workspace and better mobile behavior.
- The deliveries list should expose a visible primary create action and reuse the same pagination pattern already established by the collector workspace order and store listings.
- Deliveries-list expansion should optimize for scannability in this MVP slice: products render as a flat list without source-order grouping or source-order secondary metadata.
- In delivery detail, that source-order grouping is traceability context rather than the primary content hierarchy: the collector is still reading one delivery first, then the origin of its products.
- Delivery routes in the collector app use `/{locale}/deliveries`. Deleting a delivery from detail returns the collector to the deliveries list.
- In UI copy, `Delivery.deliveryDate` is presented as shipping date. It is the date the shipment is created/sent, not the date the collector receives it.
- The received date is captured only by the mark-delivered flow, is required for that action, and must allow only past or current dates.

## Lifecycle Interaction Model

Each detail action has a distinct confirmation and feedback contract. The visual treatment of toasts, the undo affordance, and the mobile sticky-bar / actions-sheet chrome are owned by the [delivery FDD](fdd-08-delivery-management.md); this section fixes only the functional behavior.

| Action            | Confirmation                                | Apply / feedback model                                                                                                                      | Post-action target               |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Save private note | none (inline)                               | inline save; a toast is shown only when the stored value actually changed                                                                   | stays on detail                  |
| Mark delivered    | modal (captures the required received date) | optimistic confirmation: the modal closes on submit and the new state shows immediately; on server failure it rolls back and shows an error | stays on detail                  |
| Cancel            | confirmation modal                          | optimistic confirmation; rolls back on failure                                                                                              | stays on detail                  |
| Reopen            | none (not destructive)                      | executes directly with a neutral undo affordance; undo runs the inverse mutation within a short window                                      | stays on detail                  |
| Delete            | confirmation modal (stated as permanent)    | awaited (not optimistic, because it is irreversible): the modal stays until the server confirms                                             | redirects to the deliveries list |

## Error Contract

Delivery mutations return typed, expected error codes (not exceptions) so flows can recover without noisy monitoring. Unexpected failures are captured once with delivery-safe context. Expected codes:

- create / edit: `STORE_NOT_FOUND`, `NO_PRODUCTS_SELECTED`, `PRODUCTS_FROM_DIFFERENT_STORE`, `PRODUCT_NOT_ELIGIBLE` (carries the offending product ids so the selector can refresh), `EXCHANGE_RATE_REQUIRED` (currency differs from base and no rate was supplied), and — edit only — `INVALID_STATUS` (the delivery is no longer `IN_TRANSIT`). A concurrent product-state change is reconciled into `PRODUCT_NOT_ELIGIBLE`.
- quick arrival: `ORDER_NOT_FOUND` (the order is not the caller's), `ORDER_CANCELLED`, `EXCHANGE_RATE_REQUIRED`, plus every create code above, since it runs through the same mutation. Its validation layer additionally rejects `RECEIVED_DATE_IN_FUTURE` and `RECEIVED_BEFORE_SHIPPED` (`BR-08-09`).
- store-scoped arrival (`FR-08-38`): the same codes as quick arrival minus `ORDER_NOT_FOUND` (no order is named), plus `INVALID_STORE_ID` and `TOO_MANY_PRODUCTS` from its validation layer. Ownership and store scope surface as `PRODUCTS_FROM_DIFFERENT_STORE`, and a selection that went stale as `PRODUCT_NOT_ELIGIBLE` carrying the offending ids, so the client can flag exactly those rows instead of retrying silently with the eligible subset.
- `ORDER_CANCELLED` is now returned by the create mutation itself rather than by one caller (`FR-08-38a`), so the create wizard returns it too.
- mark delivered / cancel / delete / reopen / note: `DELIVERY_NOT_FOUND`; lifecycle guards return `INVALID_STATUS` (mark delivered and cancel require `IN_TRANSIT`; delete rejects `DELIVERED`; reopen rejects `IN_TRANSIT`); reopen additionally returns `PRODUCTS_IN_OTHER_DELIVERY` per `BR-08-08`.
- The validation layer rejects malformed input before these run (future shipping/received dates, `expectedArrivalTo` before `expectedArrivalFrom`, negative or over-cap cost, unsupported currency, out-of-range exchange rate, empty product set).

## Analytics

Delivery events are namespaced under `POSTHOG_EVENTS.DELIVERY` in `src/lib/constants.ts`:

- create/edit flow: `delivery_create_flow_opened`, `delivery_created`, `delivery_edit_flow_opened`, `delivery_edited`
- lifecycle: `delivery_marked_delivered`, `delivery_reopened`, `delivery_cancelled`, `delivery_deleted`, `delivery_note_saved`, `delivery_note_deleted`
- list: `deliveries_list_filtered`, `deliveries_list_filter_chip_removed`, `deliveries_list_filters_reset`, `deliveries_list_card_expanded`, `deliveries_list_card_collapsed`, `deliveries_list_expanded_all`, `deliveries_list_collapsed_all`
- mobile detail chrome: `delivery_detail_sticky_primary_clicked`, `delivery_detail_actions_sheet_opened`
- quick arrival: `delivery_quick_arrival_opened` (client, carries the launcher `source`), `delivery_quick_arrival_logged` (server)
- store-scoped arrival (`FR-08-38`): `delivery_store_arrival_logged` (server, carries `store_id`, `product_count`, `order_count`, `had_shipped_date`, `backdated`) and `delivery_store_selection_started` (client). The modal open reuses `delivery_quick_arrival_opened` with `source: "orders_store_view"`, so the entry points stay comparable in one funnel.

Mutation events carry counts (product / affected-order / added / removed) but never the free-text note value.

## Screens and Data Contract

Each delivery route under `/{locale}/(app)/deliveries`. All routes are authenticated and scoped to the session user; a delivery that does not belong to the user resolves to 404 (not 403) to avoid enumeration. Visual layout is owned by the [FDD](fdd-08-delivery-management.md); this section fixes purpose, data loaded, actions, and states.

### List — `/{locale}/deliveries`

- **Purpose:** the deliveries workspace, opened focused on active follow-up work.
- **Data loaded:** `getDeliveriesList(userId, filters)` (paginated cards with aggregated product count, 25/page by default — `DELIVERY_LIST_PAGE_SIZE` = `DEFAULT_PAGE_SIZE`, user-selectable among 10/25/50/100 via `?perPage=`; **updated 2026-07-23, owner-approved**, replaces the earlier fixed `30`/page, see [ADR 0018](../../../design/decisions/0018-list-pagination-page-size-and-desktop-summary.md)); `getDeliveryStoreOptions(userId)` (distinct stores that appear in the user's deliveries, for the filter picker); heading counts for `IN_TRANSIT` and `DELIVERED`.
- **Actions:** navigation only — `New delivery` → `/new`; each card → detail carrying the current list URL via `?returnTo=`. No mutations.
- **States:** loading skeleton; empty (`noDeliveries`, with create / browse-orders CTAs); empty-filtered (`noResults`, keeps chips, offers reset). Default URL canonicalizes to `?status=IN_TRANSIT` (see filter contract).

### Detail — `/{locale}/deliveries/[id]`

- **Purpose:** inspect one delivery and run its lifecycle actions.
- **Data loaded:** `getDeliveryDetail(deliveryId, userId)` → summary, products grouped by source order (sorted by order date then item position), aggregated product count, current lifecycle state, action-availability flags, `receivedDate` when delivered, the FX-pending state (exposed as the derived `needsExchangeRateUpdate` boolean, computed from the delivery's `exchangeRate` + `exchangeRateBaseCode` against the base currency rather than read from a column, see [ADR 0024](../../../design/decisions/0024-fx-reconciliation-derived-from-rate-base.md)), and the private note; plus the user's base currency for FX display.
- **Actions:** `saveDeliveryNoteAction`, `markDeliveredAction`, `reopenDeliveryAction`, `cancelDeliveryAction`, `deleteDeliveryAction` (behavior per Lifecycle Interaction Model); `Edit` → `/[id]/edit`. **(revised 2026-08-20, round-4 arbitration, implemented the same day):** `markDeliveredAction` also opens the money transaction's consumption half for every order it just closed, per `FR-08-46`; it gains no settlement checkbox or new field, since the settlement UI question stays open (`FR-08-45`).
- **States:** per-status hero (IN_TRANSIT = expected-arrival window + overdue signal; DELIVERED = received + shipped + cost; CANCELLED = shipped + products-returned note); FX-pending badge on the hero + suppressed conversion in hero and summary card while the delivery reads as FX-pending (`FR-08-10a`); 404 when not owned.

### Create — `/{locale}/deliveries/new` (optional `?sourceOrderId=`)

- **Purpose:** create one store-scoped delivery from eligible products, via two entry points (`FR-08-15`/`FR-08-16`).
- **Data loaded:** `getStoresWithEligibleProducts(userId)` (stores with ≥1 product in `NONE`/`ARRIVED_AT_STORE`); from-order entry additionally validates and loads `getDeliverySourceOrder(orderId, userId)`; once a store is known, `getEligibleProductsForStore(storeId, userId)` (grouped by source order, ineligible excluded entirely per `BR-08-03`).
- **Actions:** `createDeliveryAction`.
- **States:** eligibility empty state when no store has eligible products and no `sourceOrderId` (`FR-08-17`); in-section client-side product search (`FR-08-34`); field validation errors; concurrent-ineligible recovery (`PRODUCT_NOT_ELIGIBLE` carries product ids so the selector can refresh).

### Edit — `/{locale}/deliveries/[id]/edit`

- **Purpose:** adjust an existing delivery's product membership and metadata.
- **Guard:** editable only while `IN_TRANSIT`; a `DELIVERED`/`CANCELLED` delivery redirects to detail with a reopen-first message (`FR-08-24`).
- **Data loaded:** `getDeliveryDetail` for current values; `getEligibleProductsForStore(storeId, userId, excludeDeliveryId)` so the delivery's own products stay selectable alongside other eligible products of the same store. The store itself is immutable (read-only display, never re-selected).
- **Actions:** `editDeliveryAction`.
- **States:** unsaved-changes navigation guard; field validation; atomic stale-edit failure (membership/metadata revalidated inside the transaction — no partial save); FX-outdated warning on the exchange-rate field while the delivery reads as pending FX reconciliation (`FR-08-10a`), resolved on save.

## State Model

### Delivery lifecycle (`DeliveryStatus`)

A delivery is created `IN_TRANSIT`, or directly `DELIVERED` through the quick-arrival flow (`FR-08-36`), and never has its status edited through a free field (`FR-08-13`); status moves only through lifecycle actions:

| From                       | Action            | To           | Product effect                                       | Order re-derivation         |
| -------------------------- | ----------------- | ------------ | ---------------------------------------------------- | --------------------------- |
| —                          | create            | `IN_TRANSIT` | selected products → `IN_TRANSIT`                     | yes                         |
| —                          | quick arrival     | `DELIVERED`  | selected products → `DELIVERED`; sets `receivedDate` | yes                         |
| `IN_TRANSIT`               | mark delivered    | `DELIVERED`  | all products → `DELIVERED`; sets `receivedDate`      | yes                         |
| `IN_TRANSIT`               | cancel            | `CANCELLED`  | products → `ARRIVED_AT_STORE`                        | yes                         |
| `IN_TRANSIT`               | edit (add/remove) | `IN_TRANSIT` | added → `IN_TRANSIT`; removed → `ARRIVED_AT_STORE`   | yes                         |
| `DELIVERED`                | reopen            | `IN_TRANSIT` | products → `IN_TRANSIT`; clears `receivedDate`       | yes                         |
| `CANCELLED`                | reopen            | `IN_TRANSIT` | products → `IN_TRANSIT`; clears `receivedDate`       | yes (blocked by `BR-08-08`) |
| `IN_TRANSIT` / `CANCELLED` | delete            | (removed)    | still-unfulfilled products → `ARRIVED_AT_STORE`      | yes                         |

`DELIVERED` cannot be deleted directly and cannot be edited directly — reopen first (`BR-08-07`, `FR-08-24`).

### Product delivery state (`OrderItemDeliveryState`)

Persisted on `OrderItem.deliveryState`. Four values: `NONE`, `ARRIVED_AT_STORE`, `IN_TRANSIT`, `DELIVERED`. Eligibility for a new/edited delivery = `NONE` or `ARRIVED_AT_STORE` only. Once a product has been in a delivery it never returns to `NONE`; its resting state after cancel/delete/edit-remove is `ARRIVED_AT_STORE`. Quick arrival is the only transition that moves a product from `NONE`/`ARRIVED_AT_STORE` straight to `DELIVERED` without passing through `IN_TRANSIT` (`FR-08-36`); this asymmetry is why the flow has no undo (`BR-08-11`).

### Order-status re-derivation

Every delivery mutation that changes product-to-delivery associations re-derives, within the same transaction, the `OrderStatus` of each affected order by mapping product states (`NONE`/`ARRIVED_AT_STORE` → `open`, `IN_TRANSIT` → `in_transit`, `DELIVERED` → `delivered`) into the pure `deriveOrderStatus` from [`FRD-05`](../frd-05-order-payment-shipment/frd-05-order-payment-shipment.md). Orders already `CANCELLED` are skipped (the order lifecycle owns that status), and a write happens only when the derived status differs from the stored one.

## Confirmed

- delivery is one separate FRD from orders and payments
- a delivery always belongs to one store only
- one product may belong to only one delivery
- multiple active deliveries per store are allowed
- ineligible products should disappear from selection rather than showing as disabled rows
- delivery detail uses one private note and no automatic history timeline in MVP
- delivery detail uses these visible lifecycle actions by status:
  - `IN_TRANSIT`: primary `Mark delivered`, visible secondary `Edit`, overflow `Cancel` and `Delete`
  - `DELIVERED`: primary `Reopen`, with additional actions in secondary / overflow chrome
  - `CANCELLED`: primary `Reopen`, overflow `Delete`
- `Delivery.cost` feeds the dashboard's disbursed-spend figures, merged with order payments rather than charted as its own series — see [`FRD-06 · BR-06-04`, `BR-06-09`](../frd-06-dashboard/frd-06-dashboard.md#business-rules)

## Open Questions

- whether post-MVP delivery workflows should reintroduce carrier and tracking-number capture if integrated with deep-link tracking, courier-reliability analytics, or arrival alerts
- whether post-MVP delivery workflows should support attachments such as screenshots or labels
- **(added 2026-08-20, `ADR 0032`, pending, not resolved):** whether settlement on arrival (`FR-08-39` through `FR-08-44`) should also apply to the **formal delivery flow**, that is the create-delivery wizard's dispatch and the "mark delivered" action of `FR-08-22`, rather than only to the five "already arrived" launchers named in `FR-08-45`. The nuance is that more time tends to pass between paying the balance and marking the delivery in the formal flow than in a quick arrival, so if it is added there the checkbox should probably not come pre-checked, and the settlement date should probably be asked for rather than proposed. This is documented as an open requirement, deliberately not decided.

## Out of Scope

- order payment capture
- dashboard implementation details
- carrier integrations or automatic tracking sync
- cross-store delivery grouping

## Linked Blueprints

- `docs/product/prd-02-collector-app/frd-08-delivery-management/bp-01-delivery-management/bp-01-delivery-management.md`

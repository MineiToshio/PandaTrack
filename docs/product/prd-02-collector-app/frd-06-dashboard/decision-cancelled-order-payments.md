# Decision — Payments on cancelled orders

**Status:** **Approved** (Option A). Owner signed off on both forks in §5 (make cancelled money visible via the dedicated figure, and the opt-in payment-removal branch on cancel). Implemented in the dashboard aggregation + surface and the cancel flow.

**Owner constraint recorded at sign-off:** the "Perdido en cancelados" / "Lost on cancelled" figure is a ~1-in-500 corner case, so it must render **conditionally — only when its value is greater than 0**. When there is no lost money the surface renders nothing at all: it must not occupy dashboard space, reserve a slot, or show an empty/zero state.
**Scope:** How a `pedido` (order) moved to `CANCELLED` should treat its retained `pago` (payment) ledger, and whether that money becomes visible on the dashboard.
**Owner:** `frd-06-dashboard`, cross-references `frd-05-order-payment-shipment`.
**Glossary:** pedido/order, entrega/delivery, tienda/store, pago/payment, moneda base/base currency.

---

## 1) Ground truth (verified against code)

| Fact                                                                                                                                                                                             | Source                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `cancelOrder` **already preserves** the payment ledger on cancel. This is deliberate — an earlier `deleteMany` was reverted because it contradicted the modal copy and broke `Reactivar pedido`. | `src/lib/data/orders/orderMutations.ts:205-213`                                 |
| Full cancel flow already exists (canonical `Modal`, `tone="warning"`, `role="alertdialog"`), plus `reactivateOrder` and `deleteOrder`. Not greenfield.                                           | `OrderCancelModal.tsx`, `orderLifecycleActions.ts`, `orderMutations.ts:226-249` |
| `reactivateOrder` relies on preserved payments so the collector sees what they paid before pausing.                                                                                              | `orderMutations.ts:226-249`                                                     |
| Dashboard excludes `CANCELLED` orders from **all** rollups via `isCancelled`, applied at the aggregation entry point. Governing rule is **BR-06-07** (not BR-06-04).                             | `dashboardRollup.ts:107-110`, `dashboardAggregation.ts:630`                     |
| Docs already state payments on a later-cancelled order are excluded from every rollup, and "Refund-vs-sunk accounting is out of MVP scope."                                                      | `frd-06-dashboard.md:205`                                                       |
| No refund/kept/sunk flag exists. `OrderStatus` has 6 values; `Order`/`OrderPayment` carry no such field.                                                                                         | `schema.prisma:16-23, 453-493, 519-533`                                         |
| Modal copy currently asserts payments are always preserved ("Los pagos y el historial se conservan").                                                                                            | `es/orders.json:381`, `en/orders.json`                                          |

**The two real owner cases this must serve**

| Case                                | What happened                                     | Correct money truth                              | Mechanic                                              |
| ----------------------------------- | ------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| **(a) Baúl Jare** `ORD-20230130-01` | Store cancelled, never refunded the S/160 advance | Money **lost / sunk** — should stay documented   | **Keep** payments (current default) + surface as lost |
| **(b) Kenshin / Mushoku**           | Advance moved as **credit** to another order      | Money **not lost** — it lives on the other order | **Remove** payments here (else double-counted)        |

The two cases have opposite truths, so a single fixed behavior cannot serve both. Keep-payments already covers (a). The only genuinely new behavior needed is a **conditional remove branch** for (b), plus a way to make (a)'s money honest on the dashboard.

---

## 2) Options compared

Scores are 1–5, higher is better. "Dashboard impact" and "Effort" and "UX-confusion" are scored so that **higher = less disruptive / less effort / less risky**.

| Criterion                    | A — keep/remove branch + derived "lost" metric | B — new status (`no cumplido`/`perdido`) | Hybrid — A + persisted boolean flag |
| ---------------------------- | :--------------------------------------------: | :--------------------------------------: | :---------------------------------: |
| Real-world fidelity          |                       5                        |                    3                     |                  5                  |
| Data-model simplicity        |                       5                        |                    2                     |                  3                  |
| Dashboard / reporting impact |                       4                        |                    2                     |                  4                  |
| Reversibility                |                       4                        |                    2                     |                  3                  |
| Effort                       |                       3                        |                    2                     |                  2                  |
| UX-confusion risk            |                       3                        |                    2                     |                  3                  |
| **Total**                    |                     **24**                     |                  **13**                  |               **20**                |

**Why B loses:** a new `OrderStatus` value ripples through every status switch, filter, index, status-distribution chart, i18n, and chip — a large, sticky, hard-to-reverse surface — and it still does **not** solve case (b) (a "lost" status would keep the credit-moved money on the cancelled order, double-counting it). It conflates a lifecycle state with a money outcome.

**Why Hybrid is second, not first:** the persisted flag adds a Prisma migration + backfill for information the payment ledger already encodes (see §3). It is a reasonable future upgrade if the owner later wants an explicit, queryable "non-refunded" marker (e.g. real refund tracking), but it is not needed for MVP.

**Why A wins:** it is the smallest change that serves both cases honestly, needs **no migration**, and adds exactly one isolated, clearly-labeled dashboard figure instead of rewriting existing series.

---

## 3) Recommendation — Option A

> On cancel, when the order has payments, the modal asks the collector what to do with them. **Default = keep** (safe, = today's behavior). The dashboard gains **one dedicated awareness metric** — "Perdido en cancelados" / "Lost on cancelled" — computed from cancelled orders that **still carry payments**. No new schema field. No existing rollup changes value retroactively.

### 3.1 The key insight: the ledger already encodes the distinction

Because the modal **forces the choice at cancel time**, the presence of payments on a cancelled order is itself the signal:

| Order state                     | Meaning                                                     | Dashboard                             |
| ------------------------------- | ----------------------------------------------------------- | ------------------------------------- |
| `CANCELLED` + `Σ payments > 0`  | Kept deliberately → money **sunk/lost** (case a)            | Counts toward "Perdido en cancelados" |
| `CANCELLED` + `Σ payments == 0` | Removed (refunded / credit moved, case b) **or** never paid | **Fully excluded** — unchanged, clean |

So "cancelled + sunk" vs "cancelled + clean" is **derivable** from the ledger. No boolean column is required. A cancelled order with no payments stays fully excluded exactly as today.

### 3.2 Modal behavior and copy

- The payments-choice block renders **only when the order has payments**. Orders with no payments cancel exactly as today (no new friction).
- **Default selection = Keep** (safe default; matches the reverted-`deleteMany` lesson).
- **Confirmation semantics:** Keep → current transaction (status → `CANCELLED`, ledger untouched). Remove → same transaction additionally `deleteMany`s this order's `OrderPayment` rows. Remove is **irreversible for this order**: a later `Reactivar pedido` will not resurrect removed payments (correct — that money now lives on the other order).

**Spanish (`detail.cancelModal`)**

| Key                         | Copy                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `descriptionBase` (revised) | `Podrás reactivarlo más adelante desde el detalle del pedido. El historial se conserva.` |
| `paymentsQuestion` (new)    | `Este pedido tiene pagos registrados ({amount}). ¿Qué quieres hacer con ellos?`          |
| `paymentsKeepLabel` (new)   | `Conservarlos (dinero perdido)`                                                          |
| `paymentsKeepHint` (new)    | `Úsalo si pagaste y no te devolvieron el dinero. Se registrará como perdido.`            |
| `paymentsRemoveLabel` (new) | `Quitarlos`                                                                              |
| `paymentsRemoveHint` (new)  | `Úsalo si te devolvieron el dinero o lo moviste como crédito a otro pedido.`             |

**English (`detail.cancelModal`)**

| Key                         | Copy                                                                             |
| --------------------------- | -------------------------------------------------------------------------------- |
| `descriptionBase` (revised) | `You can reactivate it later from the order detail. The history is preserved.`   |
| `paymentsQuestion` (new)    | `This order has recorded payments ({amount}). What do you want to do with them?` |
| `paymentsKeepLabel` (new)   | `Keep them (money lost)`                                                         |
| `paymentsKeepHint` (new)    | `Use this if you paid and were not refunded. It will be recorded as lost.`       |
| `paymentsRemoveLabel` (new) | `Remove them`                                                                    |
| `paymentsRemoveHint` (new)  | `Use this if you were refunded or moved the money as credit to another order.`   |

`descriptionBase` is revised because it currently asserts payments are _always_ preserved, which is no longer unconditional. The payment wording moves into the conditional choice block.

### 3.3 Where lost money appears

**(1) Order detail UI** — for a cancelled order that kept payments:

- The existing cancellation callout stays.
- The payments section still lists the kept payments.
- Add a labeled line/chip marking the retained amount as **not recovered** — es `Perdido` / en `Lost` — so the ledger reads as sunk, not as an active balance.
- A cancelled order with **no** payments shows no lost marker (clean).

**(2) Dashboard** — add one new figure only:

- **"Perdido en cancelados" / "Lost on cancelled"** = Σ `OrderPayment.amount` over `CANCELLED` orders that retain payments, in base currency, respecting the same FX-exclusion rule as every other total (`FR-06-13`).
- It is a **separate, distinctly labeled awareness figure** (consistent with `BR-06-05`'s "distinct concepts get distinct labels").
- **Existing rollups do not change value retroactively.** Spend/budget/obligation/committed/collection/activity series stay exactly as they are. Historical figures do **not** move. Obligation and committed rollups keep excluding cancelled orders (that money is neither owed nor committed anymore).

**Why a dedicated metric, not folding into historical spend:** folding sunk cash into the disbursed-spend series would retroactively change every historical spend/budget chart the collector has already seen, and would blur "money I chose to spend" with "money a store took and never delivered." Even though the lost cash _was_ disbursed (so folding is philosophically defensible under `BR-06-04`), an isolated, honestly-named figure is the least disruptive, most reversible, and most truthful presentation for the existing numbers.

### 3.4 Prisma migration and reactivate

- **Migration required? No.** The recommendation derives "sunk" from the retained ledger. `OrderStatus`, `Order`, and `OrderPayment` are unchanged.
- **`reactivateOrder` interaction:** unchanged code. Kept payments remain and reappear naturally on reactivate (case a). Removed payments stay gone (case b — correct, the money lives on the other order). The reverted-`deleteMany` lesson is respected because removal is now **explicit, opt-in, and reconciled with reactivate semantics**, not the silent default.

---

## 4) Business-rule changes

| Rule                               | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BR-06-07` (revise)                | Keep the exclusion, add the single exception. Proposed wording: _"Orders in `CANCELLED` status are excluded from obligation, committed-value, collection-state, spend, budget, and activity rollups. The one exception is the dedicated 'lost on cancelled' figure (`BR-06-10`), which recognizes payments deliberately retained on a cancelled order."_                                                                                                                          |
| `BR-06-10` (new)                   | _"Payments retained on a `CANCELLED` order are treated as sunk (lost) money and surfaced only in the dedicated 'Perdido en cancelados / Lost on cancelled' figure, in base currency, subject to `FR-06-13`. A cancelled order whose payments were removed at cancel time, or which never had payments, is fully excluded and contributes nothing to this figure. This figure does not enter the disbursed-spend series and does not change any historical rollup retroactively."_ |
| `frd-06-dashboard.md:205` (revise) | The line that says payments on a cancelled order are excluded from "every rollup" and that "refund-vs-sunk accounting is out of MVP scope" must be updated to reflect the new single-figure exception — this is precisely the documented decision being reversed (see §5).                                                                                                                                                                                                        |

The "Perdido en cancelados" surface is captured as **`FR-06-23`** in [`frd-06-dashboard.md`](frd-06-dashboard.md), with its conditional-rendering (render-only-when-`> 0`) constraint. `BR-06-07` was revised and `BR-06-10` added as specified above.

---

## 5) Decisions requiring owner sign-off

These two forks reverse deliberate prior decisions. They were **recommended** and are now **both approved by the owner** (see Status). The dashboard figure ships with the conditional-rendering constraint recorded at sign-off (render only when the value is greater than 0).

| #     | Fork                                                                      | What it reverses                                                                                                                                                                                                  | Recommendation                                                                                                                                                                                                                                                                                                          |
| ----- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | Making cancelled money **visible** via the "Perdido en cancelados" figure | `frd-06-dashboard.md:205` documents this as **out of MVP scope** ("Refund-vs-sunk accounting is out of MVP scope"; payments on cancelled excluded from every rollup). Adding the figure reverses that scope call. | **Approve.** Case (a) is a real, recurring collector need (documenting money a store took and never delivered). The isolated figure is the minimal, non-retroactive way to honor it.                                                                                                                                    |
| **2** | The **payment-removal branch** on cancel                                  | Re-introduces `deleteMany`-on-cancel, which was **deliberately removed** because it contradicted the modal copy and broke `Reactivar pedido`.                                                                     | **Approve, with guardrails.** Unlike the reverted version, removal is now (i) explicit/opt-in with a safe keep default, (ii) copy-aligned (the modal tells the truth about what each choice does), and (iii) reconciled with reactivate (removed = intentionally gone). Case (b) cannot be modeled honestly without it. |

If the owner declines fork 1, keep the current full exclusion and the order-detail "Lost" marker only (no dashboard figure). If the owner declines fork 2, case (b) has no honest home and the credit-moved money will double-count once it also appears on the destination order — not recommended.

---

## 6) Net new work (if approved)

1. Cancel modal: conditional payments-choice block + 6 new i18n keys (es/en) + revised `descriptionBase`.
2. `cancelOrderAction` + `cancelOrder`: carry the keep/remove choice; on remove, `deleteMany` this order's payments inside the existing transaction.
3. Order detail: "Lost / Perdido" marker for cancelled-with-payments.
4. Dashboard aggregation: one new "Perdido en cancelados" figure (cancelled orders retaining payments, base currency, FX-excluded), plus its surface + i18n.
5. Docs: revise `BR-06-07`, add `BR-06-10`, revise `frd-06-dashboard.md:205`, add the new `FR`.

**Not needed:** Prisma migration, `OrderStatus` change, `reactivateOrder` change.

---

## 7) Follow-up (2026-08-03, owner-approved): the figure moves into the cash zone

The sign-off constraint in the header ("a ~1-in-500 corner case, so render only when greater than
0, and occupy no dashboard space otherwise") was implemented as a conditional full-width zone. In
use the owner found that the conditional guard solves only the empty case: once there **is** lost
money, the card claims a full row permanently, and its relevance decays while its visual weight does
not. Their own figure is S/ 169.00, of which S/ 160.00 comes from a January 2023 cancellation — 0.09%
of committed value, three and a half years old, still rendered as loudly as the day it happened.

**Decision:** keep the figure and its `> 0` guard, drop the dedicated zone. It now renders as a
quiet line inside the cash zone, directly under paid-versus-pending, alongside the existing
"no estimated arrival date" note, with a link to the cancelled orders (`BR-06-12`, `FR-06-23`).

Why not simply delete it: paid and committed are computed from non-cancelled orders only, so this is
exactly the money missing from them. Removing it would let the dashboard quietly overstate what the
collector's money bought. The note belongs next to the figure it corrects.

Why not time-bound it (show only for recent cancellations): rejected on evidence. The
`ORDER_CANCELLED` history rows for both of the owner's cancelled-with-payments orders are stamped
`2026-07-20`, the Notion migration date, not the real cancellation date — so a recency rule would
misfire on precisely the migrated orders that motivated the change. A surface that appears and
disappears on its own also invites a "why did it go" question, and the moment of loss is already
surfaced where it happens by the keep/remove choice the cancel modal forces.

## 8) Update (2026-08-08): re-expressed under store-level payments

Store-level payments ([ADR 0025](../../../design/decisions/0025-store-level-payments-declared-allocations.md))
moved money off the order (`OrderPayment`) and onto the store (`StorePayment` + a `PaymentAllocation`
declaration per order/item). The **decision this document records is unchanged**: a cancelled order
that keeps its declared money is sunk/lost; a cancelled order whose declared money is freed is not.
Only the mechanics of "keep" vs "remove" changed, because there is no longer a payment row that
belongs to the order to delete — the payment belongs to the store and may be declared against other
orders too.

**The two branches, re-expressed:**

| §3.2/§4 name (2026-07-20) | Current name (`cancelOrder` `paymentsChoice`) | What actually happens now                                                                                                                                                                                                                                                                                                   |
| ------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Keep** (was default)    | **`lost`**                                    | This order's `PaymentAllocation` rows are left exactly as they are, still pointing at the now-`CANCELLED` order. The underlying `StorePayment` is untouched (it was never deleted under either model). Reads as sunk/lost, same as before.                                                                                  |
| **Remove**                | **`credit`** (now the default)                | This order's `PaymentAllocation` rows are deleted (`tx.paymentAllocation.deleteMany`) and `Order.allocatedAmountMinor` resets to `0`. The `StorePayment` itself **survives**, now with less (or no) declared coverage — exactly what a store credit is: money the store still holds, no longer pinned to a cancelled order. |

The default flipped from "keep/safe" to **`credit`/default** (`OrderCancelModal.tsx`,
`DEFAULT_PAYMENTS_CHOICE`) because most real cancellations are not a lost cause: they free the money
to cover another order at the same store, which is now directly visible as that store's debt going
back up (or its "a favor" shrinking) the moment the order cancels. This is a safe default under the
new model in a way it was not under the old one: nothing is deleted, no row disappears, and
reactivating the order cannot resurrect a payment because no payment was ever removed, only its
declaration.

`reactivateOrder` is unaffected either way: `lost` leaves the allocation in place, so it is already
there after reactivation; `credit` leaves the `StorePayment` undeclared, exactly as if the collector
had never declared it against this order, and the collector can re-declare it from the order detail
or the store payment sheet after reactivating.

`BR-05-15` / `BR-05-16` / `BR-05-17` in `frd-05-order-payment-shipment.md` and `BR-06-10` /
`FR-06-23` in this FRD were rewritten in the same change to describe `lost` / `credit` directly; the
§3.2/§4/§6 text above is left as written for provenance (it is what the owner actually signed off
on) rather than rewritten to match the new names.

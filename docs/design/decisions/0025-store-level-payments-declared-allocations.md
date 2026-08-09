---
title: "ADR 0025 - Store-level payments with declared allocations"
date: 2026-08-08
status: accepted
session: store-level payments v5 (2026-08-07 design, implemented 2026-08-08)
owner: Sergio Minei
trigger: real collector data (the Notion migration) kept surfacing transfers that covered several pedidos at once, or a pedido paid partly from money left over on a previous one, that the per-order payment model could not represent honestly
updates: prisma/schema.prisma, src/lib/data/orders/storePaymentMutations.ts, src/lib/data/orders/storePaymentQueries.ts, src/lib/data/orders/orderPaymentMutations.ts, docs/product/prd-02-collector-app/frd-05-order-payment-shipment/frd-05-order-payment-shipment.md, docs/product/prd-02-collector-app/frd-06-dashboard/frd-06-dashboard.md, docs/product/glossary.md
supersedes: none (extends the payment model frd-05-order-payment-shipment.md defined; see the FRD for the superseded FR/BR wording)
---

# ADR 0025 - Store-level payments with declared allocations

## Context

The MVP payment model recorded every `OrderPayment` against exactly one `Order`: a transfer was
always "this pedido's payment," `paidAmountMinor` / `paymentPercent` were maintained per order, and
the collector could not represent money any other way.

Real collector data (the Notion migration and the owner's own purchase history) does not work that
way. Two recurring cases could not be modeled honestly:

1. **One transfer, several pedidos.** A collector often pays a store once and that payment covers
   two or three standing pedidos at once (or covers part of one and leaves the rest for later). The
   per-order model forced the collector to either split one real transfer into several fabricated
   "payments," or attribute the whole transfer to a single pedido and leave the others looking unpaid.
2. **Money that outruns a known price.** A collector can pay a store before every pedido at that
   store has a firm total (a store that only confirms individual item prices later, or a partial
   advance against a pedido whose total is still being negotiated). The per-order model required a
   `totalCost` to exist before a payment could be validated against it, so this could not be
   recorded until the price was known.

The owner considered and **rejected every derived-split option**: no automatic proportional split,
no "oldest pedido first" allocation, no per-order percentage inferred from the store's aggregate
payments. A derived split is a guess presented as a fact, and the collector's own historical data
(payments made months apart, across pedidos of very different sizes) has no rule that reconstructs
it correctly after the fact. The only model that does not lie is one where the collector states,
pedido by pedido, what a payment was for, and is allowed to leave that undeclared when they do not
know or do not care.

## Decision

**A payment belongs to the store it was paid to. What it covers is a separate, optional
declaration.**

1. **`StorePayment`** replaces `OrderPayment` as the write path for new payments. It carries
   `storeId`, `userId`, `amount`, `currencyCode`, and its own FX shape (`exchangeRate` /
   `exchangeRateBaseCode`, mirroring `Order`). It has no required order.
2. **`PaymentAllocation`** is the collector's declaration of what a `StorePayment` was for: it
   always names an `orderId` and may optionally narrow to one `orderItemId` of that order. A
   `settlesTarget` boolean lets the collector declare a pedido or producto "saldado" without naming
   an exact amount, so an order or item with no known price can still be marked covered. Declaring
   is opt-in end to end: a payment can be created with zero allocations (money the store is holding,
   undeclared), and a pedido can carry zero allocated money while its collector-recorded total cost
   is still unknown or still being negotiated.
3. **The amount actually paid is capped at the store's debt, never at an order's balance.** A
   payment larger than `Σ committed (non-cancelled orders) − Σ already paid` for that store/currency
   pair is refused (`STORE_DEBT_EXCEEDED`), computed inside the same transaction that writes the
   payment (`getStoreDebtMinor`, checked before the first write per ADR 0022). What the payment
   _declares_ against a specific order or item is checked separately and can never exceed that
   order's/item's own remaining balance (`EXCEEDS_BALANCE` / `EXCEEDS_ITEM_BASE`), nor exceed the
   payment's own amount (`ALLOCATION_SUM_EXCEEDS_PAYMENT`). Overpaying a store is refused outright
   rather than silently absorbed as credit, because in practice it means the collector picked the
   wrong store or the wrong amount, and a silent credit is far harder to notice than a refusal.
4. **Debt is per store, per currency, and can go negative.** `getStoreDebtByCurrency` /
   `getStoreDebtMinor` compute `committedMinor (non-cancelled orders) − paidMinor`, deliberately
   **not** clamped at zero: a negative value is real money the store is holding on the collector's
   behalf (an overpayment, or a cancelled pedido whose payment was kept as "a favor" instead of
   "perdido" on cancel — see the cancelled-orders decision doc) and clamping would erase the only
   signal that credit exists. The store view and the store payment sheet surface this as "a favor"
   (green), never as a second, unrelated "crédito" concept (that word stays reserved for the photo
   quota; see `docs/product/glossary.md`).
5. **Per-order payment percentage is retired from the UI.** `paymentPercentage` still exists as a
   value derived from `calculatePaymentSummary`, but it is fed by `allocatedAmountMinor`
   (declared money), not by a full-price certainty, and the orders list dropped the paid/partial/
   unpaid filter, the `payment-asc` sort, the per-row progress bar, and the "Impago" pill that
   implied every pedido's payment state was fully known. A pedido with no allocation and an unknown
   total is not "unpaid" in any meaningful sense; it is undeclared.
6. **`Order.paidAmountMinor` / `Order.paymentPercent` are frozen, not migrated away.** They keep
   their columns and their `@default(0)`, are marked `DEPRECATED` in the schema, and nothing reads
   or writes them anymore (`Order.allocatedAmountMinor` is the new denormalized cache, kept in sync
   the same way the old cache was). They are **not dropped**, purely for reversibility of the trial:
   store-level payments is a real product-behavior change on top of real collector data (the Notion
   migration), and keeping the old cache physically present costs nothing while the new model proves
   itself, versus a schema rollback if it does not.
7. **`addOrderPayment` / `deleteOrderPayment` keep their exact names and signatures.** They become
   thin order-scoped doors into the store-level engine (`createStorePayment` /
   `deleteStorePayment` under the hood) instead of being deleted, because every existing caller
   (the order detail screen, the image-intake save action, the Notion importer) already speaks in
   "a payment on this order," and a payment declared entirely against one order is a legitimate,
   common case, not a special one. Adding a payment through this door raises a store payment with a
   single allocation covering the whole amount (narrowed to the order's own item when it has
   exactly one); deleting removes that allocation, and the underlying `StorePayment` only when
   nothing else claims it (a shared payment survives with the other orders' declarations intact).
8. **No payment history entries.** Payment mutations do not write `OrderHistory` rows, matching the
   pre-existing product decision that payments are not part of the automatic history feed (unchanged
   by this ADR; noted here because it is easy to assume a new money model implies new audit rows).

## Alternatives considered

1. **Derived proportional or chronological split** (auto-attribute each store payment across its
   standing orders by size or age).
   - Pros: no new UI, no collector effort.
   - Cons: actively wrong on the owner's own historical data (payments do not follow either
     pattern); presents a guess as a fact with no way for the collector to correct it without lying
     about the underlying transfer.
   - Why not chosen: rejected outright by the owner (see Context); a derived number a collector
     cannot trust is worse than an explicit "undeclared" state.

2. **Keep per-order payments, add a separate "store credit" ledger only for overpayment/refund
   cases.**
   - Pros: smaller schema change, no `PaymentAllocation` join model.
   - Cons: does not solve the "one transfer, several pedidos" case at all, the actual majority of
     the real data driving this change; the collector would still have to fabricate one row per
     order to represent a single transfer.
   - Why not chosen: solves the minority case and leaves the majority case unaddressed.

3. **Require a firm order total before any payment can be recorded against it.**
   - Pros: simpler validation (no `settlesTarget`, no "unknown base" branch in the item ceiling).
   - Cons: blocks the real, recurring "paid before the price was final" case; forces the collector
     to invent a placeholder total just to record real money that left their hands.
   - Why not chosen: money the collector actually paid should always be recordable; `settlesTarget`
     and the nullable item-allocation-base handle "covered, amount/price unknown" honestly instead.

## Consequences

### Positive

- One transfer can be recorded once and declared against as many pedidos/productos as it actually
  covered, matching how collectors actually pay stores.
- Debt is now a first-class, per-currency figure per store ("Por tienda" view, store detail aside,
  the payment sheet), not something the collector had to add up from individual order balances.
- "A favor" (store credit) is a natural consequence of the debt formula rather than a bolted-on
  flag; it falls out of the same `committed − paid` computation with no extra state.
- The `addOrderPayment` / `deleteOrderPayment` wrapper kept every existing caller (image intake,
  the Notion importer, the order detail screen) working unchanged, so the write-path cutover
  (commit `e477309`) shipped with no call-site rewrite outside the payments module itself.

### Negative / tradeoffs

- Two payment tables now exist in the schema (`order_payment` frozen, `store_payment` +
  `payment_allocation` live); a reader of the schema must know which one is authoritative, which
  the `DEPRECATED` doc-comments and this ADR exist to prevent from becoming a trap.
- A pedido can now be "money-complete" (fully allocated) without the collector ever having declared
  a matching `totalCost`, or vice versa (a firm total with nothing allocated yet); the UI has to
  present "Asignado X de Y" and the store-debt link as two different states rather than one
  "% paid" number, which is a strictly more complex hero than before.
- Edit guards multiplied: an order or item that carries an allocation now blocks a store change, a
  currency change, item removal, and lowering the price below what is already declared
  (`STORE_CHANGE_BLOCKED`, `CURRENCY_CHANGE_BLOCKED`, `ITEM_HAS_ALLOCATION`,
  `ITEM_PRICE_BELOW_ALLOCATED`), each a new refusal path a caller has to handle.
- The store-grouped "Por tienda" view (a consequence of thinking about payments per store) is not
  paginated (see the pagination exception below), which is a deliberate, reviewable simplification
  rather than the unified pattern every other list in the app follows.

### Pagination exception (ADR 0018)

[ADR 0018](0018-list-pagination-page-size-and-desktop-summary.md) established one shared
pagination contract for every list in the app. The Orders "Por tienda" view
(`getPendingProductsByStore`) is a deliberate, scoped exception: it loads and sorts the collector's
**entire** pending-product set in memory, with no `?page=` / `?perPage=`. At today's real data (the
busiest tracked store carries ~29 pending products, ~74 total across every store) a full in-memory
group-and-sort costs nothing, and the two-level sort (products within a store, stores by an
aggregate of their own products) does not translate cleanly to a single flat page anyway. The
threshold to revisit is **when a collector's total pending-product count grows roughly an order of
magnitude past today's real numbers (~700+)**; past that point this view should either paginate at
the store-group level or move the sort into SQL.

## Rollout notes

- Migration `277ea0e` (`add store_payment and payment_allocation foundation with 1:1 backfill`)
  added the two new tables and backfilled one `StorePayment` + one `PaymentAllocation` per existing
  `OrderPayment` row, so historical payments read correctly under the new model with no data loss.
- The write-path cutover (`e477309`) moved every payment-creating caller onto
  `createStorePayment` behind the `addOrderPayment` wrapper; `order_payment` stopped being written
  from that commit onward.
- No further migration is planned for `order_payment` / `paidAmountMinor` / `paymentPercent`; see
  Decision point 6.

## References

- `docs/product/prd-02-collector-app/frd-05-order-payment-shipment/frd-05-order-payment-shipment.md`
  (`FR-05-17`…`FR-05-20`, `FR-05-31`, `FR-05-41`…, `BR-05-10`, `BR-05-15`…`BR-05-17`, `BR-05-19`…)
- `docs/product/prd-02-collector-app/frd-06-dashboard/frd-06-dashboard.md` (`BR-06-04`, `BR-06-08`,
  `BR-06-10`, `FR-06-23`)
- `docs/product/prd-02-collector-app/frd-06-dashboard/decision-cancelled-order-payments.md` (§8,
  the store-level payments update)
- `.agents/rules/data-layer-user-id-duplication.mdc` (why `PaymentAllocation.userId` is duplicated)
- `.agents/rules/prisma-data-layer.mdc` / ADR 0022 (the refusal-before-first-write contract every
  `createStorePayment` check follows)

/**
 * How a single product's payment situation is stated on screen, and how an order's coverage marks
 * are reconciled against its balance.
 *
 * Two axes meet here and only one of them is money:
 *
 *   - MONEY: `PaymentAllocation.amountMinor`, summed into `Order.allocatedAmountMinor`. Exact,
 *     closes the books, and nothing in this file writes it.
 *   - COVERAGE: the collector's own "this product is paid" mark, with no amount attached.
 *
 * The resolution order below is one principle applied three times: a fact PROVEN by arithmetic
 * beats a claim, and a claim beats a percentage we already know is incomplete. Nothing here
 * estimates, prorates or splits money between products, which is the one thing this whole feature
 * exists to refuse.
 */

export type ProductPaymentState =
  /** Arithmetic proves nothing is owed, whether or not the collector ever marked it. */
  | "proven"
  /** The collector says it is paid. No amount is implied and none is displayed. */
  | "declared"
  /** Money is declared against this product but its own price base is not covered yet. */
  | "partial"
  /**
   * Money is declared against this priced product, but its ORDER also holds money that names no
   * product. The product's own share is then a FLOOR, not its real payment, so a ratio against its
   * price would read systematically low: the same order can be 90% paid while two of its products
   * both read 8%. Rendered like `"unpriced-partial"` — the amount, no percentage, no bar. Same
   * rule as there ("No denominator, no bar"), different reason: the denominator is unknown for
   * lack of attribution rather than for lack of a price.
   */
  | "partial-undetailed"
  /** No price on record, but money IS declared against it: the amount is stated on its own. */
  | "unpriced-partial"
  /** No price on record, so no percentage can be honest. Offers the mark. */
  | "unpriced"
  /** Priced, nothing declared against it. */
  | "none";

export type ProductPaymentStateInput = {
  /** Unit price x quantity, or the order total for a single-product order. `null` when unknown. */
  basePagableMinor: number | null;
  /** Money declared against THIS product. Order-level money is never counted here. */
  allocatedMinor: number;
  /** `OrderItem.paidDeclaredAt !== null`. */
  paidDeclared: boolean;
  orderTotalCost: number;
  orderAllocatedAmountMinor: number;
  /**
   * The order holds money that names no product (`undetailedPaidMinor > 0`).
   *
   * Required, not optional, and deliberately so: every caller has to answer it, because defaulting
   * it to `false` is exactly the wrong answer for the population where it matters. It is NOT
   * derivable from the other fields here (`orderAllocatedAmountMinor` includes the item lines) nor
   * from a list of visible products, so it is computed by the query that builds the DTO.
   */
  orderHasUndetailedMoney: boolean;
};

/**
 * Resolves what a product's "Pagado" cell says.
 *
 * Case 0 is the one worth defending: `Order.totalCost` is mandatory, so `allocated >= totalCost`
 * PROVES the order owes nothing, and by implication that no product of it owes anything. That is an
 * entailment of the order's own total, not a guess about how the money split, and it is the same
 * class of argument as case 1 one level up. Without it the app would ask the collector to declare
 * by hand what it already knows, and two products of the same fully paid order would look different
 * depending on whether a button had been pressed.
 *
 * A mark that is outranked by case 0 or case 1 is not erased: it still exists in the database, and
 * the order detail keeps showing it so it stays reversible.
 */
export function resolveProductPaymentState(input: ProductPaymentStateInput): ProductPaymentState {
  if (input.orderTotalCost - input.orderAllocatedAmountMinor <= 0) return "proven";
  if (input.basePagableMinor !== null && input.basePagableMinor - input.allocatedMinor <= 0) return "proven";
  if (input.paidDeclared) return "declared";
  // Case 3 splits in two on ONE term. A ratio is only honest when every centavo the order received
  // is attributed to some product; the moment the order also holds unattributed money, this
  // product's own share is a floor and the percentage built on it understates it, on every screen
  // that draws one.
  if (input.basePagableMinor !== null && input.allocatedMinor > 0 && !input.orderHasUndetailedMoney) return "partial";
  if (input.basePagableMinor !== null && input.allocatedMinor > 0) return "partial-undetailed";
  // Case 4a, ahead of the bare unpriced case and never ahead of cases 0-3: money declared against a
  // product with no price base is a figure, and a figure is stated as itself. No percentage and no
  // bar, because there is no denominator to divide by ("No denominator, no bar",
  // `docs/design/interface-patterns.md` §15).
  if (input.basePagableMinor === null && input.allocatedMinor > 0) return "unpriced-partial";
  if (input.basePagableMinor === null) return "unpriced";
  return "none";
}

/**
 * What the two availability predicates below need to know. Deliberately the RAW INPUT of a product,
 * never its resolved {@link ProductPaymentState}: `resolveProductPaymentState` answers `"declared"`
 * for any marked product, priced or not (case 2 precedes cases 4 and 5), so a predicate written over
 * the resolved state would hide the control on an unpriced product that already carries a mark and
 * leave that mark impossible to take back.
 */
export type MarkAvailabilityInput = {
  /** Unit price x quantity, or the order total for a single-product order. `null` = no number. */
  basePagableMinor: number | null;
  /** Money declared against THIS product. */
  allocatedMinor: number;
  /** `OrderItem.paidDeclaredAt !== null`. */
  paidDeclared: boolean;
  /** The order is cancelled: read-only everywhere. */
  locked: boolean;
};

/**
 * Can a mark be ADDED here? Only where there is no number to use instead.
 *
 * Where the exact figure is known, using the figure is strictly more informative than a claim, and
 * offering both would produce two sources of truth about the same product. That argument does not
 * depend on which screen the product is drawn on, which is why the order detail now applies the
 * same rule the payment sheet already did (ADR 0026, amended).
 */
export function offersPaidMark(input: MarkAvailabilityInput): boolean {
  return !input.locked && input.basePagableMinor === null && input.allocatedMinor === 0 && !input.paidDeclared;
}

/**
 * Should the control be RENDERED at all? Every existing mark is shown and can be taken back, always:
 * priced or not, with money against it or not, on a cancelled order or not (inert there, as before).
 * `paidDeclared` implies this predicate, which is the invariant that keeps a mark from being trapped.
 */
export function rendersPaidMark(input: MarkAvailabilityInput): boolean {
  return input.paidDeclared || offersPaidMark(input);
}

/**
 * The amount an item is "responsible" for out of its order's total: unit price × quantity when
 * known, or the whole order total when this is the order's only item (a single-item order's price
 * is unambiguous even without a captured per-item `unitPrice`). `null` when neither can be derived.
 *
 * Shared by every query module that builds a {@link ProductPaymentStateInput.basePagableMinor}:
 * `pendingProductsByStoreQueries.ts` (the "Por tienda" list), `orderQueries.ts` (the order detail),
 * and `storePaymentAssignableOrdersQueries.ts` (the store payment sheet). This file has no imports
 * of its own, so pulling the helper in here keeps it reachable from all three without opening a
 * cross-module cycle between them.
 */
export function resolveBasePagableMinor(
  unitPrice: number | null,
  quantity: number,
  orderTotalCost: number,
  orderItemCount: number,
): number | null {
  if (unitPrice !== null) return unitPrice * quantity;
  if (orderItemCount === 1) return orderTotalCost;
  return null;
}

/**
 * Why the two axes need a word from the app, or `null` when they do not.
 *
 * A union rather than a boolean because the notice is about to grow a second reason (the order whose
 * products are all covered BY MONEY and which still owes for shipping or fees). That one is left out
 * here on purpose: it can only fire once product-level allocations exist on multi-product orders, of
 * which there are none in the whole history, so it would be a branch no data can reach.
 */
export type OrderMarkReason = "allMarked" | null;

export type OrderMarkReconciliation = {
  /** Products of the order carrying the mark. Counted over EVERY item, delivered ones included. */
  markedCount: number;
  /** Every item of the order. */
  totalCount: number;
  /** `"allMarked"` when the collector marked them all and the order still owes money. */
  reason: OrderMarkReason;
};

/**
 * Reconciles the coverage axis against the money axis for one order.
 *
 * `markedCount` and `reason` are computed over the SAME set, every item of the order,
 * and that is the whole point. Over "undelivered items only" the predicate is vacuously true as
 * soon as an order is fully delivered, so the warning would fire without a single mark; and on a
 * partly delivered order it would announce "you marked every product" beside a counter reading
 * "1 of 6" in the same card. `totalCount > 0` keeps an order with no items out of it.
 *
 * The notice names the residual and offers to record it. It does not block, does not correct, and
 * never invents money: the amount it offers is the one the books already say is missing.
 */
export function resolveOrderMarkReconciliation(input: {
  items: Array<{ paidDeclared: boolean }>;
  totalCost: number;
  allocatedAmountMinor: number;
}): OrderMarkReconciliation {
  const totalCount = input.items.length;
  const markedCount = input.items.filter((item) => item.paidDeclared).length;
  const owesMoney = input.totalCost - input.allocatedAmountMinor > 0;

  return {
    markedCount,
    totalCount,
    reason: totalCount > 0 && markedCount === totalCount && owesMoney ? "allMarked" : null,
  };
}

import { describe, expect, it } from "vitest";
import {
  offersPaidMark,
  rendersPaidMark,
  resolveBasePagableMinor,
  resolveOrderMarkReconciliation,
  resolveProductPaymentState,
} from "../productPaymentState";

/** A product of an order that still owes money, so no case-0 shortcut fires unless asked for. */
function product(overrides: Partial<Parameters<typeof resolveProductPaymentState>[0]> = {}) {
  return {
    basePagableMinor: 5000,
    allocatedMinor: 0,
    paidDeclared: false,
    orderTotalCost: 10000,
    orderAllocatedAmountMinor: 0,
    orderHasUndetailedMoney: false,
    ...overrides,
  };
}

describe("resolveProductPaymentState", () => {
  it("proves a product settled when its ORDER owes nothing, with no mark involved (case 0)", () => {
    expect(resolveProductPaymentState(product({ orderTotalCost: 10000, orderAllocatedAmountMinor: 10000 }))).toBe(
      "proven",
    );
    // Over-allocated is still proven, not a fifth state.
    expect(resolveProductPaymentState(product({ orderTotalCost: 10000, orderAllocatedAmountMinor: 12000 }))).toBe(
      "proven",
    );
  });

  it("proves a product settled when its own base is covered (case 1)", () => {
    expect(resolveProductPaymentState(product({ basePagableMinor: 5000, allocatedMinor: 5000 }))).toBe("proven");
  });

  it("lets the ORDER's arithmetic outrank the collector's own mark", () => {
    // The mark still exists in the database; it just is not what the cell announces. If this
    // inverted, the app would tell the collector their claim is why a product is settled when its
    // order's own total already proved it.
    expect(
      resolveProductPaymentState(
        product({ paidDeclared: true, orderTotalCost: 10000, orderAllocatedAmountMinor: 10000 }),
      ),
    ).toBe("proven");
  });

  it("lets the PRODUCT's arithmetic outrank the collector's own mark", () => {
    expect(
      resolveProductPaymentState(product({ paidDeclared: true, basePagableMinor: 4000, allocatedMinor: 4000 })),
    ).toBe("proven");
  });

  it("lets the mark outrank a percentage we already know is incomplete", () => {
    // This is the ordering that carries the whole feature: 40% of a base is a FACT about the money
    // that named this product, and the collector's claim is a fact about the product. When they
    // disagree, the claim wins the label because the percentage is knowingly partial.
    expect(
      resolveProductPaymentState(product({ paidDeclared: true, basePagableMinor: 5000, allocatedMinor: 2000 })),
    ).toBe("declared");
  });

  it("reports a partial only when money named this product and its base is known", () => {
    expect(resolveProductPaymentState(product({ basePagableMinor: 5000, allocatedMinor: 2000 }))).toBe("partial");
  });

  /**
   * D7a — a ratio needs every centavo of the order to be attributed, and with money sitting on the
   * order itself it is not.
   *
   * Real shape, ORD-20260305-01: a 244.90 order carrying 199.90 that names no product. A 20.00
   * payment split by price puts 4.89 on this 59.90 product, and the surfaces that draw a bar would
   * then read "8%" beside an order hero reading "90% paid". Both figures are arithmetically right
   * and one of them is a lie about the product, because 4.89 is a floor and not its real payment.
   */
  it("refuses the ratio when the ORDER also holds money that names no product", () => {
    const withPozo = {
      basePagableMinor: 5990,
      allocatedMinor: 489,
      orderTotalCost: 24490,
      orderAllocatedAmountMinor: 21990,
    };

    expect(resolveProductPaymentState(product({ ...withPozo, orderHasUndetailedMoney: true }))).toBe(
      "partial-undetailed",
    );
    // Same money, same product: the ONLY thing that decides is whether the order's own money is
    // fully attributed.
    expect(resolveProductPaymentState(product({ ...withPozo, orderHasUndetailedMoney: false }))).toBe("partial");
  });

  it("keeps case 0 and the mark ahead of the new state, exactly as they were ahead of `partial`", () => {
    // The split happens at case 3, so nothing above it may change behaviour: a settled order still
    // proves its products settled, and a mark still outranks any percentage.
    expect(
      resolveProductPaymentState(
        product({
          basePagableMinor: 5990,
          allocatedMinor: 489,
          orderTotalCost: 24490,
          orderAllocatedAmountMinor: 24490,
          orderHasUndetailedMoney: true,
        }),
      ),
    ).toBe("proven");
    expect(
      resolveProductPaymentState(
        product({ basePagableMinor: 5990, allocatedMinor: 489, paidDeclared: true, orderHasUndetailedMoney: true }),
      ),
    ).toBe("declared");
  });

  it("leaves the unpriced case where it was: no price still beats no attribution", () => {
    // An unpriced product with money on it has no denominator either way, so it keeps reading
    // `unpriced-partial` rather than moving to the new state.
    expect(
      resolveProductPaymentState(
        product({ basePagableMinor: null, allocatedMinor: 800, orderHasUndetailedMoney: true }),
      ),
    ).toBe("unpriced-partial");
  });

  it("offers the mark on an unpriced product and on a priced one with nothing declared", () => {
    expect(resolveProductPaymentState(product({ basePagableMinor: null }))).toBe("unpriced");
    expect(resolveProductPaymentState(product({ basePagableMinor: 5000, allocatedMinor: 0 }))).toBe("none");
  });

  // #5
  it("states the amount, not a ratio, for money declared against a product with no price (case 4a)", () => {
    // Reachable today from the store payment sheet, which accepts an amount on a line with no
    // price. Before case 4a existed this fell through to "unpriced" and the money vanished from the
    // screen: the row asked "¿marcar pagado?" about a product that already had money on it.
    expect(resolveProductPaymentState(product({ basePagableMinor: null, allocatedMinor: 800 }))).toBe(
      "unpriced-partial",
    );
    expect(resolveProductPaymentState(product({ basePagableMinor: null, allocatedMinor: 0 }))).toBe("unpriced");
  });

  // #6 — regression: case 4a must sit AFTER cases 0-3, never before them.
  it("keeps case 4a behind the proven and declared cases", () => {
    const unpricedWithMoney = { basePagableMinor: null, allocatedMinor: 800 };
    // Case 0: the order owes nothing, so the product is proven whatever money named it.
    expect(
      resolveProductPaymentState(
        product({ ...unpricedWithMoney, orderTotalCost: 10000, orderAllocatedAmountMinor: 10000 }),
      ),
    ).toBe("proven");
    // Case 2: a claim outranks a figure that is knowingly partial.
    expect(resolveProductPaymentState(product({ ...unpricedWithMoney, paidDeclared: true }))).toBe("declared");
  });
});

describe("paid mark availability", () => {
  /** An unpriced, unmarked, money-free product of a live order: the one shape that offers the mark. */
  function markable(overrides: Partial<Parameters<typeof offersPaidMark>[0]> = {}) {
    return { basePagableMinor: null, allocatedMinor: 0, paidDeclared: false, locked: false, ...overrides };
  }

  // #1
  it("offers the mark ONLY where there is no number to use instead", () => {
    expect(offersPaidMark(markable())).toBe(true);
    // A price is a number, and the number is strictly more informative than the claim.
    expect(offersPaidMark(markable({ basePagableMinor: 5000 }))).toBe(false);
    // Money declared against it is also a number.
    expect(offersPaidMark(markable({ allocatedMinor: 800 }))).toBe(false);
    // Already marked: there is nothing left to add.
    expect(offersPaidMark(markable({ paidDeclared: true }))).toBe(false);
    // Cancelled order: read-only.
    expect(offersPaidMark(markable({ locked: true }))).toBe(false);
  });

  // #2 — the invariant: `paidDeclared` implies `rendersPaidMark`, with no exception.
  it("renders every existing mark, priced or not, locked or not, so none is ever trapped", () => {
    for (const variant of [
      markable({ paidDeclared: true }),
      markable({ paidDeclared: true, basePagableMinor: 5000 }),
      markable({ paidDeclared: true, basePagableMinor: 5000, allocatedMinor: 2000 }),
      markable({ paidDeclared: true, locked: true }),
      markable({ paidDeclared: true, basePagableMinor: 5000, locked: true }),
    ]) {
      expect(rendersPaidMark(variant)).toBe(true);
    }
    // And it renders nothing where there is neither a mark to show nor one to offer.
    expect(rendersPaidMark(markable({ basePagableMinor: 5000 }))).toBe(false);
  });

  // #3
  it("keeps an unpriced product that is BOTH marked and funded reversible", () => {
    const both = markable({ paidDeclared: true, allocatedMinor: 800 });
    expect(rendersPaidMark(both)).toBe(true);
    expect(offersPaidMark(both)).toBe(false);
  });

  // #4
  it("never offers the mark on a single-product order, whose product IS the order", () => {
    // `resolveBasePagableMinor` falls back to the order total when the order has exactly one item,
    // so the balance is always known there. 16 of the collector's 24 orders with an open balance
    // have exactly one product, and that is the shortest path to the contradiction notice.
    const base = resolveBasePagableMinor(null, 1, 29300, 1);
    expect(base).toBe(29300);
    expect(offersPaidMark(markable({ basePagableMinor: base }))).toBe(false);
    // Two products and no price: nothing is known, so the mark is the only thing to offer.
    expect(resolveBasePagableMinor(null, 1, 29300, 2)).toBeNull();
    expect(offersPaidMark(markable({ basePagableMinor: resolveBasePagableMinor(null, 1, 29300, 2) }))).toBe(true);
  });
});

describe("resolveOrderMarkReconciliation", () => {
  const marked = { paidDeclared: true };
  const unmarked = { paidDeclared: false };

  it("counts marks over EVERY item of the order, delivered ones included", () => {
    const result = resolveOrderMarkReconciliation({
      items: [marked, unmarked, unmarked],
      totalCost: 10000,
      allocatedAmountMinor: 0,
    });
    expect(result).toEqual({ markedCount: 1, totalCount: 3, reason: null });
  });

  it("warns only when every product is marked AND the order still owes money", () => {
    expect(
      resolveOrderMarkReconciliation({ items: [marked, marked], totalCost: 10000, allocatedAmountMinor: 4000 }).reason,
    ).toBe("allMarked");
    // Fully paid: the two axes agree, so there is nothing to say.
    expect(
      resolveOrderMarkReconciliation({ items: [marked, marked], totalCost: 10000, allocatedAmountMinor: 10000 }).reason,
    ).toBeNull();
  });

  it("does not fire without a single mark, however delivered the order is", () => {
    // The vacuous-truth trap: over "undelivered items only" this predicate is TRUE for any fully
    // delivered order, and 1.410 of the collector's 1.485 items are delivered. The warning would
    // greet them on orders they never touched, next to a counter reading "0 de 3".
    const result = resolveOrderMarkReconciliation({
      items: [unmarked, unmarked, unmarked],
      totalCost: 10000,
      allocatedAmountMinor: 0,
    });
    expect(result.markedCount).toBe(0);
    expect(result.reason).toBeNull();
  });

  it("does not fire on an order with no items at all", () => {
    // `markedCount === totalCount` is trivially true at zero. An order with no items exists in the
    // product (the detail has its own empty-items warning), so this is a live shape, not a nicety.
    expect(resolveOrderMarkReconciliation({ items: [], totalCost: 10000, allocatedAmountMinor: 0 }).reason).toBeNull();
  });

  it("does not fire on a partly marked order, which is what one tap from the store view produces", () => {
    // `ORD-20260120-01` in the collector's own data: 6 items, 5 delivered, S/ 150,00 outstanding.
    // Only its single pending product is reachable from "Por tienda", so with the wrong item set
    // one tap made the card say "you marked every product" beside "marked: 1 of 6".
    const items = [marked, unmarked, unmarked, unmarked, unmarked, unmarked];
    const result = resolveOrderMarkReconciliation({ items, totalCost: 15000, allocatedAmountMinor: 0 });
    expect(result.markedCount).toBe(1);
    expect(result.totalCount).toBe(6);
    expect(result.reason).toBeNull();
  });
});

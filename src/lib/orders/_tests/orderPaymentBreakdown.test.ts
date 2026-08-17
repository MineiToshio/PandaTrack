import { describe, expect, it } from "vitest";
import {
  applySplit,
  buildBreakdownAllocations,
  buildBreakdownLines,
  hasEligibleLines,
  offersSplitModeChoice,
  resolveBreakdownFoot,
  resolveBreakdownLineState,
  resolveDefaultSplitMode,
  type BreakdownDraftLine,
  type BreakdownItem,
} from "../orderPaymentBreakdown";

/**
 * Fixtures are the collector's own orders, because the states this module resolves only exist in
 * them: ORD-20260305-01 (two priced products, S/ 45.00 still owed and S/ 199.90 already paid
 * against no product at all) and ORD-20260509-03 (six products, not one of them priced).
 */
const PRICED_ITEMS: BreakdownItem[] = [
  { itemId: "item-a", name: "Kingdom 23", basePagableMinor: 5990, allocatedMinor: 0 },
  { itemId: "item-b", name: "Kingdom 24", basePagableMinor: 18500, allocatedMinor: 0 },
];

const UNPRICED_ITEMS: BreakdownItem[] = Array.from({ length: 6 }, (_, index) => ({
  itemId: `item-${index}`,
  name: `Producto ${index}`,
  basePagableMinor: null,
  allocatedMinor: 0,
}));

function draftOf(items: BreakdownItem[], overrides: Record<string, Partial<BreakdownDraftLine>> = {}) {
  return items.map((item) => ({
    itemId: item.itemId,
    selected: false,
    pinned: false,
    amountMinor: 0,
    ...overrides[item.itemId],
  }));
}

describe("buildBreakdownLines", () => {
  // T7
  it("does not offer a product whose price is already covered", () => {
    const lines = buildBreakdownLines([
      { itemId: "item-a", name: "Kingdom 23", basePagableMinor: 4050, allocatedMinor: 4050 },
      { itemId: "item-b", name: "Kingdom 24", basePagableMinor: 4050, allocatedMinor: 0 },
    ]);

    expect(lines[0]).toMatchObject({ remainingBaseMinor: 0, eligible: false });
    expect(lines[1]).toMatchObject({ remainingBaseMinor: 4050, eligible: true });

    // And it stays out of the split even with its box somehow ticked, so it can never produce the
    // zero-amount line the server refuses.
    const result = applySplit({
      mode: "equal",
      lines,
      draft: draftOf(lines, { "item-a": { selected: true }, "item-b": { selected: true } }),
      paymentAmountMinor: 4050,
      orderTotalCostMinor: 8100,
      step: 1,
    });

    expect(result.draft[0]).toMatchObject({ selected: false, amountMinor: 0 });
    expect(result.draft[1]).toMatchObject({ selected: true, amountMinor: 4050 });
    expect(buildBreakdownAllocations(result.draft)).toEqual([{ orderItemId: "item-b", amountMinor: 4050 }]);
  });

  it("treats an unpriced product as eligible with no ceiling of its own", () => {
    const lines = buildBreakdownLines(UNPRICED_ITEMS);

    expect(lines.every((line) => line.remainingBaseMinor === null && line.eligible)).toBe(true);
    expect(hasEligibleLines(lines)).toBe(true);
  });
});

// T17 — the mode is a property of the order, not a preference the app carries around.
describe("resolveDefaultSplitMode", () => {
  it("opens by price when any product has one, and offers both options", () => {
    const lines = buildBreakdownLines(PRICED_ITEMS);

    expect(resolveDefaultSplitMode(lines)).toBe("byPrice");
    expect(offersSplitModeChoice(lines)).toBe(true);
  });

  it("falls back to equal parts and hides the switch when no product has a price", () => {
    const lines = buildBreakdownLines(UNPRICED_ITEMS);

    expect(resolveDefaultSplitMode(lines)).toBe("equal");
    expect(offersSplitModeChoice(lines)).toBe(false);
  });

  it("ignores the price of a product that is not on offer", () => {
    // The only priced product is already covered, so "by price" has nothing to weigh.
    const lines = buildBreakdownLines([
      { itemId: "item-a", name: "Kingdom 23", basePagableMinor: 4050, allocatedMinor: 4050 },
      { itemId: "item-b", name: "Kingdom 24", basePagableMinor: null, allocatedMinor: 0 },
    ]);

    expect(resolveDefaultSplitMode(lines)).toBe("equal");
    expect(offersSplitModeChoice(lines)).toBe(false);
  });
});

describe("applySplit", () => {
  // T9's arithmetic half: what is emitted is what is on screen, and it closes against the payment.
  it("emits exactly the visible amounts, and they close against the payment", () => {
    const lines = buildBreakdownLines(PRICED_ITEMS);
    const { draft } = applySplit({
      mode: "equal",
      lines,
      draft: draftOf(PRICED_ITEMS, { "item-a": { selected: true }, "item-b": { selected: true } }),
      paymentAmountMinor: 4500,
      orderTotalCostMinor: 24490,
      step: 1,
    });

    expect(draft.map((entry) => entry.amountMinor)).toEqual([2250, 2250]);

    const allocations = buildBreakdownAllocations(draft);
    const foot = resolveBreakdownFoot({
      paymentAmountMinor: 4500,
      orderRemainingBalanceMinor: 4500,
      lines,
      draft,
    });

    expect(allocations).toEqual([
      { orderItemId: "item-a", amountMinor: 2250 },
      { orderItemId: "item-b", amountMinor: 2250 },
    ]);
    expect(foot.assignedMinor + foot.residualMinor).toBe(4500);
    expect(foot.residualMinor).toBe(0);

    // And again with the figures the by-price split actually produces, which are NOT round: a
    // payload that rounded or rescaled anything on its way out would survive the equal-parts
    // fixture untouched and quietly change these.
    const byPrice = applySplit({
      mode: "byPrice",
      lines,
      draft: draftOf(PRICED_ITEMS, { "item-a": { selected: true }, "item-b": { selected: true } }),
      paymentAmountMinor: 4500,
      orderTotalCostMinor: 24490,
      step: 1,
    });
    const byPriceFoot = resolveBreakdownFoot({
      paymentAmountMinor: 4500,
      orderRemainingBalanceMinor: 4500,
      lines,
      draft: byPrice.draft,
    });

    expect(buildBreakdownAllocations(byPrice.draft)).toEqual([
      { orderItemId: "item-a", amountMinor: 1101 },
      { orderItemId: "item-b", amountMinor: 3399 },
    ]);
    expect(byPriceFoot.assignedMinor + byPriceFoot.residualMinor).toBe(4500);
  });

  // I-2: a typed line is a decision, and no recalculation may overwrite it.
  it("never rewrites a line the collector typed into", () => {
    const items: BreakdownItem[] = [
      { itemId: "item-a", name: "A", basePagableMinor: null, allocatedMinor: 0 },
      { itemId: "item-b", name: "B", basePagableMinor: null, allocatedMinor: 0 },
      { itemId: "item-c", name: "C", basePagableMinor: null, allocatedMinor: 0 },
    ];
    const lines = buildBreakdownLines(items);

    const { draft } = applySplit({
      mode: "equal",
      lines,
      draft: draftOf(items, {
        "item-a": { selected: true, pinned: true, amountMinor: 3000 },
        "item-b": { selected: true },
        "item-c": { selected: true },
      }),
      paymentAmountMinor: 10000,
      orderTotalCostMinor: 20000,
      step: 1,
    });

    expect(draft.map((entry) => entry.amountMinor)).toEqual([3000, 3500, 3500]);
  });

  it("splits by price over the ticked products only", () => {
    const lines = buildBreakdownLines(PRICED_ITEMS);
    const { draft, clampedItemIds } = applySplit({
      mode: "byPrice",
      lines,
      draft: draftOf(PRICED_ITEMS, { "item-a": { selected: true }, "item-b": { selected: true } }),
      paymentAmountMinor: 4500,
      orderTotalCostMinor: 24490,
      step: 1,
    });

    expect(draft.map((entry) => entry.amountMinor)).toEqual([1101, 3399]);
    expect(clampedItemIds).toEqual([]);
  });

  it("reports the products the by-price split had to cut short at their own ceiling", () => {
    const items: BreakdownItem[] = [
      { itemId: "item-a", name: "A", basePagableMinor: 5000, allocatedMinor: 4000 },
      { itemId: "item-b", name: "B", basePagableMinor: null, allocatedMinor: 0 },
    ];
    const lines = buildBreakdownLines(items);
    const result = applySplit({
      mode: "byPrice",
      lines,
      draft: draftOf(items, { "item-a": { selected: true }, "item-b": { selected: true } }),
      paymentAmountMinor: 10000,
      orderTotalCostMinor: 20000,
      step: 1,
    });

    // A's quota is 50% of 5000, but only 1000 of its price is left, so 1500 leaves the split
    // instead of moving to B, and B gets nothing at all for want of a price.
    expect(result.draft.map((entry) => entry.amountMinor)).toEqual([1000, 0]);
    expect(result.clampedItemIds).toEqual(["item-a"]);
  });

  it("aligns a ceiling down to the currency's own smallest amount", () => {
    const items: BreakdownItem[] = [
      { itemId: "item-a", name: "A", basePagableMinor: 5000, allocatedMinor: 4950 },
      { itemId: "item-b", name: "B", basePagableMinor: 5000, allocatedMinor: 0 },
    ];
    const lines = buildBreakdownLines(items);
    const { draft } = applySplit({
      mode: "equal",
      lines,
      draft: draftOf(items, { "item-a": { selected: true }, "item-b": { selected: true } }),
      paymentAmountMinor: 5000,
      orderTotalCostMinor: 10000,
      step: 100,
    });

    // A has 50 minor units of room, which is not a legal amount in a zero-decimal currency, so it
    // is offered nothing rather than an amount the server would refuse.
    expect(draft.map((entry) => entry.amountMinor)).toEqual([0, 5000]);
  });
});

describe("resolveBreakdownLineState", () => {
  // T12's arithmetic half: the ticked line the payment has no room for.
  it("says a ticked line has no room instead of silently dropping it", () => {
    const lines = buildBreakdownLines(PRICED_ITEMS);
    const { draft } = applySplit({
      mode: "equal",
      lines,
      draft: draftOf(PRICED_ITEMS, {
        "item-a": { selected: true, pinned: true, amountMinor: 4500 },
        "item-b": { selected: true },
      }),
      paymentAmountMinor: 4500,
      orderTotalCostMinor: 24490,
      step: 1,
    });

    expect(draft[1]).toMatchObject({ selected: true, amountMinor: 0 });
    expect(resolveBreakdownLineState({ line: lines[1], draft: draft[1], mode: "equal" })).toBe("noRoom");

    const foot = resolveBreakdownFoot({
      paymentAmountMinor: 4500,
      orderRemainingBalanceMinor: 4500,
      lines,
      draft,
    });

    // One line is written, not two, and the summary counts what is written rather than what is
    // ticked: counting the empty one would claim a declaration that never happened.
    expect(buildBreakdownAllocations(draft)).toEqual([{ orderItemId: "item-a", amountMinor: 4500 }]);
    expect(foot.emittedLineCount).toBe(1);
  });

  it("tells 'no price' apart from 'no room', because they ask for different things", () => {
    const items: BreakdownItem[] = [
      { itemId: "item-a", name: "A", basePagableMinor: 5000, allocatedMinor: 0 },
      { itemId: "item-b", name: "B", basePagableMinor: null, allocatedMinor: 0 },
    ];
    const lines = buildBreakdownLines(items);
    const draft = draftOf(items, { "item-a": { selected: true, amountMinor: 2500 }, "item-b": { selected: true } });

    expect(resolveBreakdownLineState({ line: lines[1], draft: draft[1], mode: "byPrice" })).toBe("needsPrice");
    expect(resolveBreakdownLineState({ line: lines[1], draft: draft[1], mode: "equal" })).toBe("noRoom");
  });

  it("flags a line typed above its own remaining price", () => {
    const lines = buildBreakdownLines(PRICED_ITEMS);
    const draft = draftOf(PRICED_ITEMS, { "item-a": { selected: true, pinned: true, amountMinor: 6000 } });

    expect(resolveBreakdownLineState({ line: lines[0], draft: draft[0], mode: "byPrice" })).toBe("overBase");
  });

  it("shows a covered product as settled", () => {
    const lines = buildBreakdownLines([{ itemId: "item-a", name: "A", basePagableMinor: 4050, allocatedMinor: 4050 }]);
    const draft = draftOf([{ itemId: "item-a", name: "A", basePagableMinor: 4050, allocatedMinor: 4050 }]);

    expect(resolveBreakdownLineState({ line: lines[0], draft: draft[0], mode: "byPrice" })).toBe("settled");
  });
});

describe("resolveBreakdownFoot", () => {
  it("names what the ticked products cannot absorb", () => {
    const items: BreakdownItem[] = [
      { itemId: "item-a", name: "A", basePagableMinor: 1000, allocatedMinor: 0 },
      { itemId: "item-b", name: "B", basePagableMinor: 1000, allocatedMinor: 0 },
    ];
    const lines = buildBreakdownLines(items);
    const { draft } = applySplit({
      mode: "equal",
      lines,
      draft: draftOf(items, { "item-a": { selected: true }, "item-b": { selected: true } }),
      paymentAmountMinor: 10000,
      orderTotalCostMinor: 20000,
      step: 1,
    });
    const foot = resolveBreakdownFoot({
      paymentAmountMinor: 10000,
      orderRemainingBalanceMinor: 20000,
      lines,
      draft,
    });

    expect(foot).toMatchObject({
      assignedMinor: 2000,
      residualMinor: 8000,
      capped: true,
      isOverPayment: false,
      emittedLineCount: 2,
    });
  });

  it("reports the over-allocation instead of a negative residual", () => {
    const lines = buildBreakdownLines(PRICED_ITEMS);
    const draft = draftOf(PRICED_ITEMS, {
      "item-a": { selected: true, pinned: true, amountMinor: 4000 },
      "item-b": { selected: true, pinned: true, amountMinor: 4000 },
    });
    const foot = resolveBreakdownFoot({
      paymentAmountMinor: 4500,
      orderRemainingBalanceMinor: 4500,
      lines,
      draft,
    });

    expect(foot).toMatchObject({ assignedMinor: 8000, residualMinor: 0, overMinor: 3500, isOverPayment: true });
  });

  it("states what the order owes afterwards from the payment alone", () => {
    const lines = buildBreakdownLines(PRICED_ITEMS);
    const settled = resolveBreakdownFoot({
      paymentAmountMinor: 4500,
      orderRemainingBalanceMinor: 4500,
      lines,
      draft: draftOf(PRICED_ITEMS),
    });
    const partial = resolveBreakdownFoot({
      paymentAmountMinor: 2000,
      orderRemainingBalanceMinor: 4500,
      lines,
      draft: draftOf(PRICED_ITEMS),
    });

    expect(settled).toMatchObject({ orderRemainingAfterMinor: 0, isOrderSettledAfter: true });
    expect(partial).toMatchObject({ orderRemainingAfterMinor: 2500, isOrderSettledAfter: false });
  });
});

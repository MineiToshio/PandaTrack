import { describe, expect, it } from "vitest";
import { normalizePositions } from "@/lib/data/orders/orderItemMutations";
import {
  createBreakdownState,
  deriveBreakdown,
  recomputeBreakdown,
  type BreakdownItem,
  type BreakdownPanelState,
} from "@/lib/orders/orderPaymentBreakdown";
import type { ImageIntakeDraft } from "../draftSchema";
import {
  buildIntakeBreakdownPayload,
  flattenDraftToBreakdownItems,
  resolveIntakeBreakdownContext,
  resolveIntakeBreakdownSaveBlock,
  type IntakePaymentRow,
} from "../intakeBreakdown";
import { intakeBreakdownSchema } from "../intakeBreakdownContract";
import { mapDraftToOrderCreateInput } from "../mapDraftToOrderCreate";

const CURRENCY = "PEN";

function field<T>(value: T | null) {
  return { value, source: value === null ? null : ("read" as const) };
}

/** A draft in the shape `parseImageIntakeDraft` produces, with one group per price list given. */
function buildDraft(groups: (number | null)[][], totalCostMinor: number | null): ImageIntakeDraft {
  return {
    store: { matchedStoreId: "store-1", name: field("Pop Dealer"), phone: field(null), candidates: [] },
    currency: field(CURRENCY),
    orderDate: field("2026-08-01"),
    totalCost: field(totalCostMinor),
    groups: groups.map((prices, groupIndex) => ({
      sourcePhrase: `grupo ${groupIndex + 1}`,
      reason: "split" as const,
      doubtful: false,
      priceSplit: "explicit-unit" as const,
      products: prices.map((unitPrice, productIndex) => ({
        name: `G${groupIndex + 1}P${productIndex + 1}`,
        unitPrice,
        suggestedProductTypeKey: null,
        referenceUrl: null,
      })),
    })),
    payments: [],
    delivery: null,
    warnings: [],
  };
}

/** A settled panel state with the given lines typed in by hand (which is what pins them). */
function typedState(items: BreakdownItem[], amountByItemId: Record<string, number>): BreakdownPanelState {
  const base = createBreakdownState(items);
  return {
    ...base,
    draft: base.draft.map((entry) =>
      entry.itemId in amountByItemId
        ? { ...entry, selected: true, pinned: true, amountMinor: amountByItemId[entry.itemId] }
        : entry,
    ),
  };
}

/** A panel state with boxes ticked and nothing typed: the split decides the amounts. */
function tickedState(items: BreakdownItem[], ticked: string[]): BreakdownPanelState {
  const base = createBreakdownState(items);
  return {
    ...base,
    draft: base.draft.map((entry) => ({ ...entry, selected: ticked.includes(entry.itemId) })),
  };
}

describe("resolveIntakeBreakdownContext · the two different sums (T1)", () => {
  const draft = buildDraft([[5000, 10000]], 15000);
  const items = flattenDraftToBreakdownItems(draft);
  // Row 0 pays 8000 and declares only 5000 of it: the 3000 residual is what makes the two sums
  // differ. With a breakdown that covered the whole payment, both formulas agree and this test
  // could not fail under its own revert.
  const rows: IntakePaymentRow[] = [
    { amountMinor: 8000, breakdown: typedState(items, { "1": 2000, "2": 3000 }) },
    { amountMinor: 4000, breakdown: null },
  ];
  const ctx = resolveIntakeBreakdownContext({
    items,
    rows,
    paymentIndex: 1,
    totalCostMinor: 15000,
    currencyCode: CURRENCY,
  });

  it("lowers the order's balance by the WHOLE amount of the earlier row, split or not", () => {
    expect(ctx.orderRemainingBalanceMinor).toBe(7000);
  });

  it("lowers each product's ceiling by what was declared against IT, and by nothing else", () => {
    expect(ctx.lines.map((line) => line.remainingBaseMinor)).toEqual([3000, 7000]);
  });
});

describe("flattenDraftToBreakdownItems · position is global across groups (T2)", () => {
  const draft = buildDraft(
    [
      [1000, 2000, 3000],
      [4000, 5000],
    ],
    15000,
  );

  it("numbers the second product of the second group 5, not 2", () => {
    const items = flattenDraftToBreakdownItems(draft);
    expect(items.map((item) => item.itemId)).toEqual(["1", "2", "3", "4", "5"]);
    expect(items[4].name).toBe("G2P2");
  });

  it("emits that same 5 on the wire", () => {
    const items = flattenDraftToBreakdownItems(draft);
    const payload = buildIntakeBreakdownPayload([{ amountMinor: 5000, breakdown: typedState(items, { "5": 5000 }) }]);
    expect(payload).toEqual([{ paymentIndex: 0, lines: [{ position: 5, amountMinor: 5000 }] }]);
  });
});

describe("intakeBreakdownSchema · what never reaches validateAllocations (T4)", () => {
  it("refuses a zero-amount line", () => {
    const result = intakeBreakdownSchema.safeParse([{ paymentIndex: 0, lines: [{ position: 1, amountMinor: 0 }] }]);
    expect(result.success).toBe(false);
  });

  it("refuses an entry with no lines at all", () => {
    const result = intakeBreakdownSchema.safeParse([{ paymentIndex: 0, lines: [] }]);
    expect(result.success).toBe(false);
  });

  it("refuses two entries for the same payment row, and two lines for the same product", () => {
    expect(
      intakeBreakdownSchema.safeParse([
        { paymentIndex: 0, lines: [{ position: 1, amountMinor: 10 }] },
        { paymentIndex: 0, lines: [{ position: 2, amountMinor: 10 }] },
      ]).success,
    ).toBe(false);
    expect(
      intakeBreakdownSchema.safeParse([
        {
          paymentIndex: 0,
          lines: [
            { position: 1, amountMinor: 10 },
            { position: 1, amountMinor: 20 },
          ],
        },
      ]).success,
    ).toBe(false);
  });

  it("accepts the ordinary payload", () => {
    expect(
      intakeBreakdownSchema.safeParse([
        {
          paymentIndex: 1,
          lines: [
            { position: 1, amountMinor: 2000 },
            { position: 3, amountMinor: 3000 },
          ],
        },
      ]).success,
    ).toBe(true);
  });
});

describe("buildIntakeBreakdownPayload · the ordinary path stays empty (T14, client half)", () => {
  it("emits nothing at all for payment rows that declare nothing", () => {
    const items = flattenDraftToBreakdownItems(buildDraft([[5000, 10000]], 15000));
    expect(
      buildIntakeBreakdownPayload([
        { amountMinor: 8000, breakdown: null },
        { amountMinor: 7000, breakdown: createBreakdownState(items) },
      ]),
    ).toBeUndefined();
  });
});

/**
 * The denominator of row k, run through the path the screen runs: build the context, settle the
 * split, derive what the panel prints. Returns both so the applied figure and the printed one can be
 * held against each other, which is the whole invariant.
 */
function runRow(input: {
  prices: (number | null)[];
  totalCostMinor: number;
  rows: { amountMinor: number; ticked?: string[]; typed?: Record<string, number> }[];
  paymentIndex: number;
}) {
  const draft = buildDraft([input.prices], input.totalCostMinor);
  const items = flattenDraftToBreakdownItems(draft);
  const rows: IntakePaymentRow[] = [];

  for (const [index, row] of input.rows.entries()) {
    const ctx = resolveIntakeBreakdownContext({
      items,
      rows: [...rows, { amountMinor: row.amountMinor, breakdown: null }],
      paymentIndex: index,
      totalCostMinor: input.totalCostMinor,
      currencyCode: CURRENCY,
    });
    const state =
      row.typed !== undefined
        ? typedState(items, row.typed)
        : row.ticked !== undefined
          ? tickedState(items, row.ticked)
          : null;
    const settled = state === null ? null : recomputeBreakdown(state, ctx);
    rows.push({ amountMinor: row.amountMinor, breakdown: settled });

    if (index === input.paymentIndex) {
      const derived = deriveBreakdown(settled ?? createBreakdownState(items), ctx, CURRENCY);
      return {
        ctx,
        derived,
        amounts: derived.entries.map((entry) => entry.draft.amountMinor),
        prices: derived.entries.map((entry) => entry.line.basePagableMinor),
      };
    }
  }
  throw new Error("paymentIndex out of range");
}

/**
 * The invariant that makes the guard worth having: the denominator the split APPLIED and the one the
 * panel PRINTS are the same number. Read off the result rather than recomputed, so it measures
 * production and not a copy of it: the printed percentage, applied to a line's own price, has to
 * reproduce the amount that was actually written into it.
 */
function expectAppliedPercentToMatchPrinted(run: ReturnType<typeof runRow>, itemIndex: number) {
  const price = run.prices[itemIndex];
  expect(price).not.toBeNull();
  expect(run.amounts[itemIndex]).toBe(Math.round((run.derived.percent * (price ?? 0)) / 100));
}

describe("resolveIntakeBreakdownContext · the denominator of row k (T15)", () => {
  it("gives the last product its exact price once an earlier row covered the other one", () => {
    const run = runRow({
      prices: [5000, 10000],
      totalCostMinor: 15000,
      rows: [
        { amountMinor: 5000, typed: { "1": 5000 } },
        { amountMinor: 10000, ticked: ["2"] },
      ],
      paymentIndex: 1,
    });

    expect(run.ctx.orderRemainingBalanceMinor).toBe(10000);
    expect(run.ctx.orderTotalCostMinor).toBe(10000);
    expect(run.amounts).toEqual([0, 10000]);
    expect(run.derived.foot.residualMinor).toBe(0);
    expect(run.derived.percent).toBe(100);
    expectAppliedPercentToMatchPrinted(run, 1);
  });

  it("raises the denominator back when the ticked products are all still eligible, so (a) is a no-op", () => {
    const run = runRow({
      prices: [5000, 10000],
      totalCostMinor: 15000,
      rows: [
        { amountMinor: 5000, ticked: ["1", "2"] },
        { amountMinor: 10000, ticked: ["1", "2"] },
      ],
      paymentIndex: 1,
    });

    // The two figures the guard separates: the balance is the bare subtraction, the denominator is
    // that subtraction raised to the sum of the eligible prices.
    expect(run.ctx.orderRemainingBalanceMinor).toBe(10000);
    expect(run.ctx.orderTotalCostMinor).toBe(15000);
    expect(run.amounts).toEqual([3333, 6667]);
    expect(run.derived.foot.residualMinor).toBe(0);
    expectAppliedPercentToMatchPrinted(run, 1);
  });

  it("does NOT drop the denominator to the balance when the earlier row declared nothing", () => {
    const run = runRow({
      prices: [5000, 10000],
      totalCostMinor: 15000,
      rows: [{ amountMinor: 5000 }, { amountMinor: 10000, ticked: ["2"] }],
      paymentIndex: 1,
    });

    expect(run.ctx.orderRemainingBalanceMinor).toBe(10000);
    expect(run.ctx.orderTotalCostMinor).toBe(15000);
    expect(run.amounts).toEqual([0, 6667]);
    expect(run.derived.percent).toBeCloseTo(66.667, 2);
    // Without the guard the split applies 100% of B's price while the panel prints 66.7%.
    expectAppliedPercentToMatchPrinted(run, 1);
  });
});

describe("flattenDraftToBreakdownItems ≡ what the server persists (T17)", () => {
  it("gives each PRODUCT the position the write path persists it at, element by element", () => {
    const draft = buildDraft([[1000, 2000], [3000], [4000, 5000, 6000]], 21000);

    // Paired with the product's own name, never the bare sequence of numbers: `normalizePositions`
    // always renumbers to 1..N, so comparing positions alone stays green even when it hands them
    // out in the wrong order, which is precisely the failure that sends money to the wrong product.
    expect(flattenDraftToBreakdownItems(draft).map((item) => `${item.name}@${item.itemId}`)).toEqual(
      normalizePositions(mapDraftToOrderCreateInput(draft).items).map((item) => `${item.name}@${item.position}`),
    );
  });
});

describe("resolveIntakeBreakdownSaveBlock · the narrow gate (§8.2)", () => {
  const TODAY = "2026-08-15";
  const ORDER_DATE = "2026-08-01";

  function gate(
    rows: { amountMinor: number; paidAtIso: string | null; hasBreakdown: boolean }[],
    totalCostMinor = 15000,
  ) {
    return resolveIntakeBreakdownSaveBlock({ rows, totalCostMinor, orderDateIso: ORDER_DATE, todayIso: TODAY });
  }

  it("blocks a row with a breakdown and no date, naming that row", () => {
    expect(gate([{ amountMinor: 5000, paidAtIso: null, hasBreakdown: true }])).toEqual({
      paymentIndex: 0,
      reason: "needsDate",
    });
  });

  it("lets an incomplete row WITHOUT a breakdown through, as FR-11-52b requires", () => {
    expect(gate([{ amountMinor: 5000, paidAtIso: null, hasBreakdown: false }])).toBeNull();
  });

  it("blocks a breakdown row dated in the future, and one dated before the order", () => {
    expect(gate([{ amountMinor: 5000, paidAtIso: "2026-08-16", hasBreakdown: true }])).toEqual({
      paymentIndex: 0,
      reason: "dateInFuture",
    });
    expect(gate([{ amountMinor: 5000, paidAtIso: "2026-07-31", hasBreakdown: true }])).toEqual({
      paymentIndex: 0,
      reason: "dateTooEarly",
    });
  });

  it("does not count a row the server would drop, so the row after it still fits", () => {
    // 14000 + 10000 is over the total, but the first row has no date: it never reaches the write,
    // so it consumes nothing and the row that carries the breakdown is written.
    expect(
      gate([
        { amountMinor: 14000, paidAtIso: null, hasBreakdown: false },
        { amountMinor: 10000, paidAtIso: "2026-08-10", hasBreakdown: true },
      ]),
    ).toBeNull();
  });

  it("does not block over a refused row that carries no breakdown", () => {
    // 14000 + 800 fit; 900 does not. The server writes the first two and drops the third, which has
    // nothing typed in it, so blocking the whole save here would be a false positive.
    expect(
      gate([
        { amountMinor: 14000, paidAtIso: "2026-08-05", hasBreakdown: false },
        { amountMinor: 800, paidAtIso: "2026-08-06", hasBreakdown: true },
        { amountMinor: 900, paidAtIso: "2026-08-07", hasBreakdown: false },
      ]),
    ).toBeNull();
  });

  it("blocks when the row the balance refuses is the one carrying the breakdown", () => {
    expect(
      gate([
        { amountMinor: 14000, paidAtIso: "2026-08-05", hasBreakdown: false },
        { amountMinor: 2000, paidAtIso: "2026-08-06", hasBreakdown: true },
      ]),
    ).toEqual({ paymentIndex: 1, reason: "exceedsBalance" });
  });

  it("stays quiet while the order has no total: another gate owns that", () => {
    expect(
      resolveIntakeBreakdownSaveBlock({
        rows: [{ amountMinor: 99000, paidAtIso: "2026-08-05", hasBreakdown: true }],
        totalCostMinor: null,
        orderDateIso: ORDER_DATE,
        todayIso: TODAY,
      }),
    ).toBeNull();
  });

  it("does not count a future-dated row without a breakdown: it dies in safeParse before the write", () => {
    // 14000 + 10000 is over the total, but row 0 is dated tomorrow: `PAYMENT_DATE_IN_FUTURE` refuses
    // it server-side, so it never reaches the write and consumes no balance. Row 1, which carries
    // the breakdown, still fits and the save must not be blocked.
    // Mutant this catches: `wouldReachTheWrite` without its `row.paidAtIso <= todayIso` clause would
    // count row 0 anyway and report `{ paymentIndex: 1, reason: "exceedsBalance" }` here.
    expect(
      gate([
        { amountMinor: 14000, paidAtIso: "2026-08-16", hasBreakdown: false },
        { amountMinor: 10000, paidAtIso: TODAY, hasBreakdown: true },
      ]),
    ).toBeNull();
  });

  it("does not count a row dated before the order: DATE_BEFORE_ORDER refuses it too", () => {
    // Same shape, different refusal: row 0 is dated before the order itself, which
    // `orderPaymentCreateSchema` refuses server-side with `DATE_BEFORE_ORDER`. A refused row writes
    // nothing, so it must not lower row 1's balance either.
    // Mutant this catches: dropping the `continue` that skips a `DATE_BEFORE_ORDER` row inside the
    // balance simulation would fold row 0's 14000 into `declaredSoFar` and report
    // `{ paymentIndex: 1, reason: "exceedsBalance" }` here.
    expect(
      gate([
        { amountMinor: 14000, paidAtIso: "2026-07-31", hasBreakdown: false },
        { amountMinor: 10000, paidAtIso: TODAY, hasBreakdown: true },
      ]),
    ).toBeNull();
  });
});

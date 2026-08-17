import { describe, expect, it } from "vitest";
import {
  resolveSplitPercent,
  resolveSplitStep,
  splitByPrice,
  splitByPriceLines,
  splitPaymentAmount,
  type PriceSplitLine,
  type SplitLine,
} from "../splitPaymentAmount";

/**
 * The split is money arithmetic, so the figures ARE the contract: every expected tuple below was
 * derived from the rule, not from the implementation, and several of them come from the
 * collector's own orders.
 */

function equalLines(caps: Array<number | null>): SplitLine[] {
  return caps.map((capMinor, index) => ({ key: `line-${index}`, capMinor }));
}

/** By-price lines whose ceiling is their price, i.e. nothing declared against them yet. */
function pricedLines(prices: Array<number | null>, caps?: Array<number | null>): PriceSplitLine[] {
  return prices.map((baseMinor, index) => ({
    key: `line-${index}`,
    baseMinor,
    capMinor: caps ? caps[index] : baseMinor,
  }));
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

describe("resolveSplitStep", () => {
  it("is the cent for a two-decimal currency and the whole major unit for a zero-decimal one", () => {
    expect(resolveSplitStep("PEN")).toBe(1);
    expect(resolveSplitStep("USD")).toBe(1);
    expect(resolveSplitStep("JPY")).toBe(100);
    expect(resolveSplitStep("CLP")).toBe(100);
  });
});

describe("splitPaymentAmount (equal parts)", () => {
  // T1
  it("gives the odd step to the FIRST lines by position", () => {
    expect(splitPaymentAmount({ amountMinor: 10000, lines: equalLines([null, null, null]), step: 1 })).toEqual([
      3334, 3333, 3333,
    ]);
  });

  // T2 — the refund, over the collector's own six-product order.
  it("shares a capped line's leftover back out, over as many rounds as it takes", () => {
    const amounts = splitPaymentAmount({
      amountMinor: 41000,
      lines: equalLines([8990, 490, 12990, 8990, 8990, 6990]),
      step: 1,
    });

    expect(amounts).toEqual([8380, 490, 8380, 8380, 8380, 6990]);
    expect(sum(amounts)).toBe(41000);
  });

  // T3 — the closing invariant, in its exact form.
  it("leaves a sub-step gap rather than emitting an amount the currency cannot represent", () => {
    const lines = equalLines([150, 9000, 9000]);
    const amounts = splitPaymentAmount({ amountMinor: 10000, lines, step: 100 });

    expect(sum(amounts)).toBe(9950);
    expect(10000 - sum(amounts)).toBeLessThan(100);
    // Two lines are still BELOW their ceiling, so this is not the "everything capped" branch.
    expect(amounts[1]).toBeLessThan(9000);
    expect(amounts[2]).toBeLessThan(9000);
    for (const amount of amounts.slice(1)) expect(amount % 100).toBe(0);
  });

  // T4
  it("stops at the ceilings when every line is capped, leaving the rest to the residual", () => {
    const amounts = splitPaymentAmount({ amountMinor: 10000, lines: equalLines([1000, 1000]), step: 1 });

    expect(amounts).toEqual([1000, 1000]);
    expect(10000 - sum(amounts)).toBe(8000);
  });

  it("matches the real orders it is offered on", () => {
    // ORD-20260814-02 paying 16.00 across 2, and ORD-20260120-01 paying 150.00 across 6.
    expect(splitPaymentAmount({ amountMinor: 1600, lines: equalLines([null, null]), step: 1 })).toEqual([800, 800]);
    expect(
      splitPaymentAmount({ amountMinor: 15000, lines: equalLines([null, null, null, null, null, null]), step: 1 }),
    ).toEqual([2500, 2500, 2500, 2500, 2500, 2500]);
  });
});

describe("splitByPrice (proportional to price)", () => {
  // T15 — the collector's own rule, and the pair it is built for.
  it("gives every product the same percentage of its price", () => {
    const downPayment = splitByPrice({
      amountMinor: 8000,
      totalCostMinor: 15000,
      lines: pricedLines([5000, 10000]),
      step: 1,
    });

    expect(downPayment).toEqual([2667, 5333]);
    expect(sum(downPayment)).toBe(8000);
  });

  // T15, second half: the down payment plus the final payment land each product exactly on its price.
  it("closes each product exactly on its price across the down payment and the final one", () => {
    const finalPayment = splitByPrice({
      amountMinor: 7000,
      totalCostMinor: 15000,
      lines: pricedLines([5000, 10000], [2333, 4667]),
      step: 1,
    });

    expect(finalPayment).toEqual([2333, 4667]);
    expect(2667 + finalPayment[0]).toBe(5000);
    expect(5333 + finalPayment[1]).toBe(10000);
  });

  it("reproduces the real orders the panel is offered on", () => {
    // ORD-20260305-01, paying 45.00 of a 244.90 order.
    expect(
      splitByPrice({ amountMinor: 4500, totalCostMinor: 24490, lines: pricedLines([5990, 18500]), step: 1 }),
    ).toEqual([1101, 3399]);
    // ORD-20260814-02, paying 65.00 of an 81.00 order.
    expect(
      splitByPrice({ amountMinor: 6500, totalCostMinor: 8100, lines: pricedLines([4050, 4050]), step: 1 }),
    ).toEqual([3250, 3250]);
  });

  // T18 — the rounding rule, on the two orders where the literal formula does not add up.
  it("adds up exactly on the orders where round(pct x price) does not", () => {
    const first = splitByPrice({
      amountMinor: 15000,
      totalCostMinor: 54470,
      lines: pricedLines([19990, 12490, 5500, 5500, 5500, 5490]),
      step: 1,
    });
    expect(first).toEqual([5505, 3439, 1515, 1515, 1514, 1512]);
    expect(sum(first)).toBe(15000);

    const second = splitByPrice({
      amountMinor: 41000,
      totalCostMinor: 53940,
      lines: pricedLines([8990, 6990, 12990, 8990, 8990, 6990]),
      step: 1,
    });
    expect(second).toEqual([6834, 5313, 9874, 6833, 6833, 5313]);
    expect(sum(second)).toBe(41000);
  });

  /**
   * T18's other half, and the one that makes the rounding rule legitimate rather than merely
   * closing: handing the odd step out is only "not redistributing" because it is BOUNDED. A step 4
   * that gave two steps to the same line would still add up, and would still be wrong.
   */
  it("never pushes a line above the ceiling of its own quota", () => {
    const cases = [
      { amountMinor: 15000, totalCostMinor: 54470, prices: [19990, 12490, 5500, 5500, 5500, 5490] },
      { amountMinor: 41000, totalCostMinor: 53940, prices: [8990, 6990, 12990, 8990, 8990, 6990] },
    ];

    for (const { amountMinor, totalCostMinor, prices } of cases) {
      const amounts = splitByPrice({ amountMinor, totalCostMinor, lines: pricedLines(prices), step: 1 });
      const denom = Math.max(
        totalCostMinor,
        prices.reduce((total, price) => total + price, 0),
      );
      amounts.forEach((amount, index) => {
        const quota = (prices[index] * amountMinor) / denom;
        expect(amount).toBeLessThanOrEqual(Math.ceil(quota));
        expect(amount).toBeLessThanOrEqual(Math.floor(quota) + 1);
      });
    }
  });

  // T19 — the ceiling in step 3 is part of the algorithm, not a safety net.
  it("keeps two-decimal money closing exactly when rounding drift meets the ceiling", () => {
    const first = splitByPrice({
      amountMinor: 5000,
      totalCostMinor: 10000,
      lines: pricedLines([3333, 3333, 3334]),
      step: 1,
    });
    expect(first).toEqual([1667, 1666, 1667]);

    const second = splitByPrice({
      amountMinor: 5000,
      totalCostMinor: 10000,
      lines: pricedLines([3333, 3333, 3334], [3333 - 1667, 3333 - 1666, 3334 - 1667]),
      step: 1,
    });
    expect(second).toEqual([1666, 1667, 1667]);
    // Without the ceiling the first line would land on 3334 against a price of 3333 and the server
    // would refuse the whole payment with EXCEEDS_ITEM_BASE.
    expect([0, 1, 2].map((index) => first[index] + second[index])).toEqual([3333, 3333, 3334]);
  });

  it("keeps a zero-decimal currency closing exactly under the same drift", () => {
    const first = splitByPrice({
      amountMinor: 5000,
      totalCostMinor: 10000,
      lines: pricedLines([3300, 6700]),
      step: 100,
    });
    expect(first).toEqual([1700, 3300]);

    const second = splitByPrice({
      amountMinor: 5000,
      totalCostMinor: 10000,
      lines: pricedLines([3300, 6700], [1600, 3400]),
      step: 100,
    });
    expect(second).toEqual([1600, 3400]);
    expect([0, 1].map((index) => first[index] + second[index])).toEqual([3300, 6700]);
  });

  // T16 (a) — shipping: the part of the payment that belongs to no product stays out of the split.
  it("leaves the shipping share undetailed instead of spreading it across the products", () => {
    const amounts = splitByPrice({
      amountMinor: 7500,
      totalCostMinor: 15000,
      lines: pricedLines([4000, 6000]),
      step: 1,
    });

    expect(amounts).toEqual([2000, 3000]);
    // I-7: residual = pct x (denom - sum of prices) = 50% x 5000.
    expect(7500 - sum(amounts)).toBe(2500);
  });

  // T16 (b) — the mixed order, with no rule of its own.
  it("gives an unpriced product nothing and sends its share of the total to the residual", () => {
    const amounts = splitByPrice({
      amountMinor: 14000,
      totalCostMinor: 29970,
      lines: pricedLines([11990, null, null]),
      step: 1,
    });

    expect(amounts).toEqual([5601, 0, 0]);
    expect(14000 - sum(amounts)).toBe(8399);
  });

  /**
   * T16 (c) — the discount, the one known counterexample to I-7, and the case an invariant test is
   * most tempted to skip. With the denominator left at the order total the panel would apply 81.8%
   * while printing 100%, and I-7 would predict a residual of -20.00.
   */
  it("raises the denominator to the sum of the prices under an order-level discount", () => {
    const input = { amountMinor: 9000, totalCostMinor: 9000, lines: pricedLines([5000, 6000]), step: 1 };

    expect(splitByPrice(input)).toEqual([4091, 4909]);
    expect(sum(splitByPrice(input))).toBe(9000);
    expect(resolveSplitPercent(input)).toBeCloseTo(81.82, 2);
  });

  it("caps the printed percentage at 100 by construction", () => {
    // A payment can never exceed the balance, which can never exceed the total, which can never
    // exceed the denominator.
    expect(
      resolveSplitPercent({ amountMinor: 4500, totalCostMinor: 24490, lines: pricedLines([5990, 18500]), step: 1 }),
    ).toBeCloseTo(18.37, 2);
    expect(
      resolveSplitPercent({ amountMinor: 6500, totalCostMinor: 8100, lines: pricedLines([4050, 4050]), step: 1 }),
    ).toBeCloseTo(80.25, 2);
  });

  /**
   * The decision that separates the two leftovers. With the ceiling leftover refunded to the other
   * products, line 2 would take its price IN FULL out of a payment worth half the order, under a
   * caption saying some products get less.
   */
  it("sends a real ceiling leftover to the residual, never to the other products", () => {
    const lines = splitByPriceLines({
      amountMinor: 10000,
      totalCostMinor: 20000,
      lines: pricedLines([5000, 5000], [1000, 5000]),
      step: 1,
    });

    expect(lines.map((line) => line.amountMinor)).toEqual([1000, 2500]);
    expect(lines.map((line) => line.clamped)).toEqual([true, false]);
    // I-7 in its two-term form: 50% x (20000 - 10000) + 1500 of ceiling leftover.
    expect(10000 - sum(lines.map((line) => line.amountMinor))).toBe(6500);
  });

  it("lets accumulated drift leave a product a step short, and names the step", () => {
    // PEN, total 3.00, three products of 1.00, paid in three instalments of 1.00.
    const prices = [100, 100, 100];
    const paid = [0, 0, 0];
    const rounds: number[][] = [];
    for (let round = 0; round < 3; round += 1) {
      const amounts = splitByPrice({
        amountMinor: 100,
        totalCostMinor: 300,
        lines: pricedLines(prices, [prices[0] - paid[0], prices[1] - paid[1], prices[2] - paid[2]]),
        step: 1,
      });
      amounts.forEach((amount, index) => {
        paid[index] += amount;
      });
      rounds.push(amounts);
    }

    expect(rounds).toEqual([
      [34, 33, 33],
      [34, 33, 33],
      [32, 34, 33],
    ]);
    expect(paid).toEqual([100, 100, 99]);
    // The centavo the third product could not take is not lost: it is the residual of that payment.
    expect(100 - sum(rounds[2])).toBe(1);
  });

  it("sends the whole payment to the residual when no ticked product has a price", () => {
    const amounts = splitByPrice({
      amountMinor: 14000,
      totalCostMinor: 29970,
      lines: pricedLines([null, null, null]),
      step: 1,
    });

    expect(amounts).toEqual([0, 0, 0]);
    expect(14000 - sum(amounts)).toBe(14000);
  });
});

/**
 * Property sweep over the shapes the two modes actually meet: both currencies' `step`, shipping,
 * discounts, hard ceilings, unpriced lines, one to six products. Deterministic seed, so a failure
 * is reproducible rather than a story about a run nobody kept.
 */
describe("splitByPrice properties", () => {
  function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it("never overspends, never breaks a ceiling and never exceeds a line's own rounded-up quota", () => {
    const random = makeRandom(20260814);
    const pick = (max: number) => 1 + Math.floor(random() * max);

    for (let iteration = 0; iteration < 5000; iteration += 1) {
      const step = random() < 0.3 ? 100 : 1;
      const lineCount = pick(6);
      const prices: Array<number | null> = [];
      for (let index = 0; index < lineCount; index += 1) {
        prices.push(random() < 0.2 ? null : pick(500) * step);
      }
      const sumPrices = prices.reduce<number>((total, price) => total + (price ?? 0), 0);
      // Shipping (total above the prices), a discount (total below them), or neither.
      const shape = random();
      const totalCostMinor =
        shape < 0.4
          ? sumPrices + pick(200) * step
          : shape < 0.6
            ? Math.max(step, sumPrices - pick(50) * step)
            : sumPrices;
      const denom = Math.max(totalCostMinor, sumPrices);
      if (denom <= 0) continue;
      const amountMinor = Math.max(step, Math.min(denom, pick(Math.max(1, Math.floor(denom / step))) * step));
      const lines: PriceSplitLine[] = prices.map((baseMinor, index) => ({
        key: `line-${index}`,
        baseMinor,
        // A hard ceiling on some lines, the full price on the rest, none at all on unpriced ones.
        capMinor: baseMinor === null ? null : random() < 0.35 ? Math.floor(random() * baseMinor) : baseMinor,
      }));

      const amounts = splitByPrice({ amountMinor, totalCostMinor, lines, step });
      const assigned = sum(amounts);

      expect(assigned).toBeLessThanOrEqual(amountMinor);
      expect(amountMinor - assigned).toBeGreaterThanOrEqual(0);
      amounts.forEach((amount, index) => {
        const line = lines[index];
        expect(amount % step).toBe(0);
        if (line.capMinor !== null) expect(amount).toBeLessThanOrEqual(Math.floor(line.capMinor / step) * step);
        const quotaUnits = ((line.baseMinor ?? 0) * amountMinor) / (denom * step);
        expect(amount / step).toBeLessThanOrEqual(Math.ceil(quotaUnits));
      });
    }
  });
});

import { isZeroDecimalCurrency, MINOR_UNITS_PER_MAJOR } from "@/lib/currency";

/**
 * How one payment is split across the products of a single order.
 *
 * Two modes, and the difference between them is not cosmetic:
 *
 *   - {@link splitByPrice} is the default whenever any product carries a price. Every product gets
 *     the SAME percentage of its own price, which is how the collector actually pays (a percentage
 *     down payment, then the rest). It has a per-product quota, so money one product cannot take is
 *     never handed to another one: it falls out of the split and is named as undetailed.
 *   - {@link splitPaymentAmount} is equal parts, the default only when NO product has a price. Its
 *     sentence ("split between the ticked products") promises no per-product quota, so a product
 *     that hits its ceiling DOES give its share back to the others.
 *
 * Neither function decides how much of the payment lands on the order: all of it does, always. What
 * they decide is how much of that total names a product. Whatever they do not place is the caller's
 * residual, written as one order-level line of the same payment, so the books close either way.
 *
 * Money is minor units (cents) throughout, and `step` is the smallest amount the currency can
 * actually represent (see {@link resolveSplitStep}). Results are positional: same length, same order
 * as the input lines.
 */

/** One product in the equal-parts split. `capMinor: null` means no ceiling of its own. */
export type SplitLine = { key: string; capMinor: number | null };

export type SplitInput = {
  /** The budget being split. */
  amountMinor: number;
  lines: SplitLine[];
  step: number;
};

/** One product in the by-price split. `baseMinor` is its weight, `capMinor` what it may still take. */
export type PriceSplitLine = { key: string; baseMinor: number | null; capMinor: number | null };

export type PriceSplitInput = {
  amountMinor: number;
  /** The order's own total. The denominator of the percentage, except under a discount. */
  totalCostMinor: number;
  lines: PriceSplitLine[];
  step: number;
};

export type PriceSplitLineResult = {
  amountMinor: number;
  /**
   * The line's ceiling cut its share short, so the difference left the split entirely. Drives the
   * caption that warns some products get less, and the foot line that names the leftover: without
   * it the collector reads "each product gets the same percentage of its price" beside a row that
   * plainly did not.
   */
  clamped: boolean;
};

/**
 * The smallest amount the currency can represent, in minor units: the cent for a two-decimal
 * currency, the whole major unit for a zero-decimal one (money is stored x100 for every currency,
 * so a yen is 100 minor units).
 *
 * Shared with the payment form's percentage quick-picks so a split and a quick-pick can never
 * propose amounts of different granularity in the same currency.
 */
export function resolveSplitStep(currencyCode: string): number {
  return isZeroDecimalCurrency(currencyCode) ? MINOR_UNITS_PER_MAJOR : 1;
}

/**
 * The denominator of the by-price percentage: normally the order's total, because the collector's
 * rule is "what percentage of the ORDER is this payment".
 *
 * It rises to the sum of the prices in the one case where that sum is bigger, an order-level
 * discount. Otherwise the shares would add up to more than the payment. Exported because the panel
 * PRINTS this percentage, and printing it from a second denominator is how a panel ends up applying
 * 81.8% while announcing 100%.
 */
export function resolveSplitDenominator(input: { totalCostMinor: number; lines: PriceSplitLine[] }): number {
  const sumPrices = input.lines.reduce((sum, line) => sum + Math.max(0, line.baseMinor ?? 0), 0);
  return Math.max(input.totalCostMinor, sumPrices);
}

/** The percentage the by-price split applies, unrounded. The panel rounds it for display only. */
export function resolveSplitPercent(input: PriceSplitInput): number {
  const denom = resolveSplitDenominator(input);
  if (denom <= 0) return 0;
  return (input.amountMinor * 100) / denom;
}

/**
 * Equal parts between the given lines, in whole `step`s, with the remainder going to the first
 * lines by position.
 *
 * Ceilings are handled by REFUND: a line whose share would break its ceiling is fixed at it, frozen,
 * and what it could not take is shared out again between the lines that are still free. Every round
 * freezes at least one line, so this runs at most `lines.length` times. That refund is legitimate
 * here and only here: "equal parts between the ticked products" promises no quota per product, so a
 * product receiving more because another one filled up is still inside the sentence on screen.
 *
 * Closing invariant: `0 <= amountMinor - sum`, and either the gap is smaller than one `step` or
 * every line sits at its ceiling. It is NOT "the sum always equals the amount unless everything is
 * capped": with `step = 100` and ceilings `[150, 9000, 9000]`, a payment of 10000 lands on
 * `[150, 4900, 4900]`, a gap of 50 with two lines still below their ceiling. The gap is the caller's
 * residual, which is why the slack is harmless.
 *
 * This function does NOT align a ceiling to the `step`; the caller does. A ceiling of 150 in a
 * zero-decimal currency is not a legal allocation amount, so the server would refuse it: aligning
 * is currency policy, not arithmetic.
 */
export function splitPaymentAmount({ amountMinor, lines, step }: SplitInput): number[] {
  const amounts = new Array<number>(lines.length).fill(0);
  if (lines.length === 0 || step <= 0) return amounts;

  const frozen = new Array<boolean>(lines.length).fill(false);
  let remaining = Math.max(0, amountMinor);

  for (let round = 0; round <= lines.length; round += 1) {
    const free = lines.map((line, index) => ({ line, index })).filter(({ index }) => !frozen[index]);
    if (free.length === 0) break;

    // Whole `step`s only. The sub-step tail is what the closing invariant allows to fall through to
    // the residual; handing it out would emit amounts the currency cannot represent.
    const units = Math.floor(remaining / step);
    const share = Math.floor(units / free.length);
    const extraShares = units % free.length;

    let frozeALine = false;
    for (const [position, { line, index }] of free.entries()) {
      const proposal = (share + (position < extraShares ? 1 : 0)) * step;
      if (line.capMinor !== null && proposal > line.capMinor) {
        amounts[index] = Math.max(0, line.capMinor);
        frozen[index] = true;
        remaining -= amounts[index];
        frozeALine = true;
      } else {
        amounts[index] = proposal;
      }
    }

    if (!frozeALine) break;
  }

  return amounts;
}

/**
 * Proportional to price: every line gets the same percentage of its own price, in whole `step`s.
 *
 * ONE pass and ONE ratio, computed once and never recomputed. A second pass over "what is left"
 * would put the part of the payment that belongs to shipping (or to products with no price
 * captured) back into play between the products, which is the prorating this whole feature exists
 * to refuse.
 *
 * The rounding rule is not an implementation detail; taken literally as `round(pct x price)` the
 * shares do not add up (S/ 150.02 against a payment of S/ 150.00 on real data). So:
 *
 *   1. `ratio = amount / denom`, once.
 *   2. per line, `quota = price x ratio / step` and `ceilingUnits = floor(cap / step)`.
 *   3. each line takes `min(floor(quota), ceilingUnits)`.
 *   4. the rounding remainder is handed out one `step` at a time, ONLY to lines still below their
 *      ceiling, by largest fractional part with position breaking ties.
 *
 * Step 4 separates two leftovers that look like one, and the difference is the whole decision:
 *
 *   - a REAL ceiling leftover (quota 25.00, ceiling 10.00, so 15.00 has nowhere to go) is money that
 *     product cannot take. It leaves the split and is named as undetailed. Handing it to another
 *     product would be a split the collector never declared.
 *   - a SUB-STEP rounding leftover (a quota of 16.5 units when only whole ones exist) is the
 *     tie-break of a rounding that was already arbitrary. Giving it to a line still below its own
 *     rounded-up quota moves nobody above `ceil(their own quota)`.
 *
 * That bound is the reason step 4 is legitimate, so it is stated as a bound and tested as one: no
 * line gets more than one `step` above `floor(its own quota)`, and no line ever ends above
 * `ceil(its own quota)`.
 *
 * The ceiling in step 3 is NOT a safety net either, and optimising it away "because it never fires
 * in practice" breaks exact closure in plain two-decimal money: prices 33.33 / 33.33 / 33.34 on a
 * total of 100.00 paid in two halves propose 16.67 for a line whose ceiling is already 16.66.
 */
export function splitByPriceLines({
  amountMinor,
  totalCostMinor,
  lines,
  step,
}: PriceSplitInput): PriceSplitLineResult[] {
  const results: PriceSplitLineResult[] = lines.map(() => ({ amountMinor: 0, clamped: false }));
  if (lines.length === 0 || step <= 0 || amountMinor <= 0) return results;

  const denom = resolveSplitDenominator({ totalCostMinor, lines });
  if (denom <= 0) return results;

  /**
   * The quotas are kept as exact rationals over a SHARED denominator rather than as floats. Two
   * reasons, both load-bearing: `price x amount` overruns the safe integer range at the amount
   * ceiling, and every figure this panel prints is decided by the FLOOR and the REMAINDER of that
   * division, so a quota landing on 16.49999999 instead of 16.5 changes which product gets the odd
   * cent. Sharing the denominator also makes the tie-break exact: comparing remainders is comparing
   * fractional parts.
   */
  const quotaDenominator = BigInt(denom) * BigInt(step);
  const quotas = lines.map((line, index) => {
    const priceMinor = Math.max(0, line.baseMinor ?? 0);
    const numerator = BigInt(priceMinor) * BigInt(amountMinor);
    const wholeUnits = Number(numerator / quotaDenominator);
    const ceilingUnits =
      line.capMinor === null ? Number.POSITIVE_INFINITY : Math.floor(Math.max(0, line.capMinor) / step);
    return {
      index,
      numerator,
      remainder: numerator % quotaDenominator,
      wholeUnits,
      ceilingUnits,
      units: Math.min(wholeUnits, ceilingUnits),
    };
  });

  const paymentUnits = Math.floor(amountMinor / step);
  const placedUnits = quotas.reduce((sum, quota) => sum + quota.units, 0);

  // Only lines that can still take one more `step`. A capped line's quota enters NEITHER side of
  // the pool: counting it would send the money it could not take to the other products, which is
  // exactly the redistribution this rule refuses.
  const poolLines = quotas.filter((quota) => quota.wholeUnits < quota.ceilingUnits);
  const poolNumerator = poolLines.reduce((sum, quota) => sum + quota.numerator, BigInt(0));
  const poolPlacedUnits = poolLines.reduce((sum, quota) => sum + quota.units, 0);
  // Half-up rounding of `poolNumerator / quotaDenominator`, done on the exact rational.
  const poolRoundedUnits = Number((poolNumerator * BigInt(2) + quotaDenominator) / (quotaDenominator * BigInt(2)));

  let pool = Math.max(0, Math.min(poolRoundedUnits - poolPlacedUnits, paymentUnits - placedUnits));

  const byLargestFraction = [...poolLines].sort((a, b) => {
    if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
    return a.index - b.index;
  });
  for (const quota of byLargestFraction) {
    if (pool <= 0) break;
    quota.units += 1;
    pool -= 1;
  }

  for (const quota of quotas) {
    results[quota.index] = {
      amountMinor: quota.units * step,
      clamped: quota.wholeUnits > quota.ceilingUnits,
    };
  }

  return results;
}

/** {@link splitByPriceLines} reduced to the amounts, for callers that only place the money. */
export function splitByPrice(input: PriceSplitInput): number[] {
  return splitByPriceLines(input).map((line) => line.amountMinor);
}

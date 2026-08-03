import type { ExtractedGroup, ExtractedProduct, ImageIntakeDraft, IntakeWarning } from "@/lib/imageIntake/draftSchema";
import { MAX_PRODUCTS_PER_ORDER } from "@/lib/imageIntake/constants";
import { isZeroDecimalCurrency, MINOR_UNITS_PER_MAJOR } from "@/lib/currency";

export interface ApplyBreakdownOptions {
  /**
   * Overridable product ceiling. Defaults to the system-wide limit; exists only so a test can
   * exercise the ceiling branch without constructing hundreds of fixture products.
   */
  maxProducts?: number;
}

/**
 * Discriminated outcome instead of a truncated list: when the draft implies more products than the
 * ceiling allows, the caller gets a count to hand back to the user, never a silently shortened
 * `groups` array. Returning a partial draft here would look like a correct result to any code that
 * forgot to check `outcome` first.
 */
export type ApplyBreakdownResult =
  { outcome: "ok"; draft: ImageIntakeDraft } | { outcome: "product-ceiling-exceeded"; productCount: number };

function countProducts(draft: ImageIntakeDraft): number {
  return draft.groups.reduce((sum, group) => sum + group.products.length, 0);
}

function distributeInteger(total: number, count: number): { shares: number[]; uneven: boolean } {
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  // The remainder goes to the first products in source order, the only order that is stable: it is
  // the order the products appeared in the phrase, not a sort key the engine invents.
  const shares = Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
  return { shares, uneven: remainder !== 0 };
}

function distributeLotTotal(
  lotTotal: number,
  count: number,
  zeroDecimal: boolean,
): { shares: number[]; uneven: boolean } {
  if (!zeroDecimal) {
    return distributeInteger(lotTotal, count);
  }
  // Zero-decimal currencies have no subunit, so dividing the ×100 minor-units amount directly could
  // land a product on a fractional major amount that currency cannot represent (e.g. "37.50 JPY").
  // Splitting on the major unit first and re-scaling after keeps every share a whole major amount.
  const majorTotal = lotTotal / MINOR_UNITS_PER_MAJOR;
  const majorSplit = distributeInteger(majorTotal, count);
  return { shares: majorSplit.shares.map((share) => share * MINOR_UNITS_PER_MAJOR), uneven: majorSplit.uneven };
}

/**
 * `extractedProductSchema` has no separate "lot total" field: a product only ever carries its own
 * `unitPrice`. For a "divided-lot" group the extraction engine has one amount to place across several
 * products, so by convention it writes that amount on the first product in source order and leaves
 * the rest `null`. Reading the first non-null value (rather than assuming index 0 specifically)
 * also tolerates a model that repeats the same total on every product instead of just the first.
 */
function findLotTotal(products: ExtractedProduct[]): number | null {
  const withPrice = products.find((product) => product.unitPrice !== null);
  return withPrice ? withPrice.unitPrice : null;
}

function splitDividedLot(
  group: ExtractedGroup,
  zeroDecimal: boolean,
): { products: ExtractedProduct[]; uneven: boolean } {
  const lotTotal = findLotTotal(group.products);
  if (lotTotal === null || group.products.length === 0) {
    // Nothing was read for this lot: leave every product's price null rather than invent a number,
    // the same rule "none" follows.
    return { products: group.products.map((product) => ({ ...product, unitPrice: null })), uneven: false };
  }
  const { shares, uneven } = distributeLotTotal(lotTotal, group.products.length, zeroDecimal);
  const products = group.products.map((product, index) => ({ ...product, unitPrice: shares[index] }));
  return { products, uneven };
}

function splitGroupPrices(
  group: ExtractedGroup,
  zeroDecimal: boolean,
): { products: ExtractedProduct[]; uneven: boolean } {
  switch (group.priceSplit) {
    case "explicit-unit":
      // Already the per-product truth as read; nothing to compute.
      return { products: group.products, uneven: false };
    case "none":
      return { products: group.products.map((product) => ({ ...product, unitPrice: null })), uneven: false };
    case "divided-lot":
      return splitDividedLot(group, zeroDecimal);
  }
}

/**
 * Post-processes an already-parsed draft: applies the deterministic price split to every group and
 * stops with a product count instead of a draft when the total exceeds the ceiling.
 *
 * Pure and synchronous, no I/O, no system clock. Quantity normalisation needs no separate step here:
 * the contract already has no quantity field, so "two copies" only ever exists in this engine as two
 * distinct products in a group, and counting `products.length` is the whole invariant.
 *
 * `totalCost` is never read from or written to by this function; only `unitPrice` on individual
 * products changes.
 */
export function applyBreakdown(draft: ImageIntakeDraft, options: ApplyBreakdownOptions = {}): ApplyBreakdownResult {
  const maxProducts = options.maxProducts ?? MAX_PRODUCTS_PER_ORDER;
  const productCount = countProducts(draft);
  if (productCount > maxProducts) {
    return { outcome: "product-ceiling-exceeded", productCount };
  }

  const zeroDecimal = draft.currency.value !== null && isZeroDecimalCurrency(draft.currency.value);
  const unevenWarnings: IntakeWarning[] = [];

  const groups = draft.groups.map((group) => {
    const { products, uneven } = splitGroupPrices(group, zeroDecimal);
    if (uneven) {
      // A split that cannot come out equal is a fact about this specific lot, so the warning quotes
      // the source phrase back, matching how the review screen traces every chip to its source text.
      unevenWarnings.push({ code: "price-split-uneven", detail: group.sourcePhrase });
    }
    return { ...group, products };
  });

  return {
    outcome: "ok",
    draft: { ...draft, groups, warnings: [...draft.warnings, ...unevenWarnings] },
  };
}

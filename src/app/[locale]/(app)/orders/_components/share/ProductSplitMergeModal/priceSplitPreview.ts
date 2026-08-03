import { isZeroDecimalCurrency, MINOR_UNITS_PER_MAJOR } from "@/lib/currency";

/**
 * Client-side preview of the deterministic equal-price split (ADR 0021 Part 2): integer
 * division of `total` (minor units) into `count` shares, remainder to the first shares in order, on
 * the major unit for zero-decimal currencies so no share lands on an unrepresentable subunit.
 *
 * This is the same algorithm as `distributeAmountIntoShares` in
 * `src/lib/data/orders/orderItemMutations.ts`, the authoritative implementation the "persisted"
 * entry points (order detail) actually write. It is duplicated here, not imported, because a
 * component-scoped util under `src/app/` importing a server data-layer module would run the wrong
 * way for this codebase's layering; the draft entry point (the review screen, before anything is
 * saved) never calls a server action at all, so this copy is that mode's only implementation, not
 * merely a preview. Both are covered by unit tests asserting identical output for identical input.
 */
export function previewEqualSplit(total: number, count: number, currencyCode: string): number[] {
  const zeroDecimal = isZeroDecimalCurrency(currencyCode);
  if (!zeroDecimal) return distributeIntegerShares(total, count);
  const majorTotal = total / MINOR_UNITS_PER_MAJOR;
  return distributeIntegerShares(majorTotal, count).map((share) => share * MINOR_UNITS_PER_MAJOR);
}

function distributeIntegerShares(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

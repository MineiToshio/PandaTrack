/**
 * Pure math utilities for order item totals.
 * Safe to import in both server and client code — no Prisma dependency.
 */

export function deriveItemizedTotal(items: Array<{ quantity: number; unitPrice: number | null }>): number | null {
  const priced = items.filter((i): i is { quantity: number; unitPrice: number } => i.unitPrice != null);
  if (priced.length === 0) return null;
  return priced.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

export function shouldShowDiscrepancyModal(
  items: Array<{ quantity: number; unitPrice: number | null }>,
  totalCost: number,
): boolean {
  if (items.length === 0) return false;
  const allPriced = items.every((i) => i.unitPrice != null);
  if (!allPriced) return false;
  const itemizedTotal = deriveItemizedTotal(items);
  return itemizedTotal !== null && itemizedTotal !== totalCost;
}

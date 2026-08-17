import type { AssignableOrder } from "@/lib/data/orders/storePaymentAssignableOrdersQueries";
import {
  itemLineKey,
  resolveLineState,
  restLineKey,
  type AllocationLineState,
} from "@/lib/orders/storePaymentSheetValidation";

/** One rendered row of the allocation panel: a product of an order, or that order's leftover. */
export type AllocationLine = {
  /** Stable identity, shared with the validation module's `blockingLines` keys. */
  key: string;
  orderId: string;
  humanReadableId: string;
  /** `null` on a "Resto del pedido" row, which names no product. */
  itemId: string | null;
  /** Product name, or `null` on a rest row (the panel supplies the localized label). */
  name: string | null;
  isRest: boolean;
  /** This line's own ceiling. `null` when it has none (a product with no price on record). */
  lineCeilingMinor: number | null;
  state: AllocationLineState;
  /**
   * Whether this product ALREADY carries a paid mark, before this sheet's own draft. Read-only
   * here: the sheet shows it as a consultable state, and only offers to SET one on a line with no
   * price base (where declaring is the best available answer). It never changes what the line's
   * amount field accepts.
   */
  paidDeclared: boolean;
};

/**
 * Flattens the loaded orders into the panel's single list of payable lines: every product of an
 * order in `position` order, then that order's "Resto del pedido" row when its products cannot
 * absorb its whole balance (`restCeilingMinor > 0`, computed server-side).
 *
 * The orders arrive newest first from `getAssignableOrdersByStore` and that order is preserved, so
 * the flat list reads top-to-bottom as most recent first with each order's lines contiguous.
 */
export function buildAllocationLines(orders: AssignableOrder[]): AllocationLine[] {
  const lines: AllocationLine[] = [];

  for (const order of orders) {
    for (const item of order.items) {
      const remainingBaseMinor = item.basePagableMinor != null ? item.basePagableMinor - item.allocatedMinor : null;
      lines.push({
        key: itemLineKey(order.orderId, item.itemId),
        orderId: order.orderId,
        humanReadableId: order.humanReadableId,
        itemId: item.itemId,
        name: item.name,
        isRest: false,
        lineCeilingMinor: remainingBaseMinor,
        state: resolveLineState({
          remainingBaseMinor,
          settledByDeclaration: item.settledByDeclaration,
          paidDeclared: item.paidDeclared,
        }),
        paidDeclared: item.paidDeclared,
      });
    }

    if (order.restCeilingMinor > 0) {
      lines.push({
        key: restLineKey(order.orderId),
        orderId: order.orderId,
        humanReadableId: order.humanReadableId,
        itemId: null,
        name: null,
        isRest: true,
        lineCeilingMinor: order.restCeilingMinor,
        state: "assignable",
        paidDeclared: false,
      });
    }
  }

  return lines;
}

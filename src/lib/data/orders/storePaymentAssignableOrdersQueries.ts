import { prisma } from "@/lib/prisma";
import { OrderStatus } from "../../../../generated/prisma/client";
import { resolveBasePagableMinor } from "@/lib/orders/productPaymentState";
import { isActiveOrderStatus } from "./storePaymentQueries";

/** One product on an order still eligible to receive a declared allocation. */
export type AssignableOrderItem = {
  itemId: string;
  name: string;
  /** Unit price × quantity, or the order total when this is its only item. `null` when neither is known. */
  basePagableMinor: number | null;
  /** Sum of this item's own `PaymentAllocation.amountMinor` rows, already written. */
  allocatedMinor: number;
  /**
   * True when a historical allocation declared this product covered without naming an amount
   * (`settlesTarget`). The sheet no longer writes those, so this only ever honors legacy rows.
   */
  settledByDeclaration: boolean;
  /**
   * The collector's own paid mark on this product (`OrderItem.paidDeclaredAt`). The sheet shows it
   * and, on a line with no price base, lets the collector set it; it never changes what the line's
   * amount field will accept, because editability is decided by arithmetic alone.
   */
  paidDeclared: boolean;
};

/** One standing order of the store that still has money left to declare against it. */
export type AssignableOrder = {
  orderId: string;
  humanReadableId: string;
  orderDate: Date;
  currencyCode: string;
  totalCost: number;
  /**
   * True while the order is still in one of the four non-terminal statuses. A COMPLETED order with
   * money left on it is assignable too (paying off something already delivered is exactly what the
   * sheet has to allow), so this cannot be assumed. The store detail reads it to know whether a
   * freshly declared line moves the active-orders progress bar or only the store's debt.
   */
  isActive: boolean;
  /** `totalCost - assignableMinor` money already declared against this order, across every payment. */
  allocatedAmountMinor: number;
  /** `totalCost - allocatedAmountMinor`, always > 0 for a row returned by this query. */
  assignableMinor: number;
  /**
   * How much of `assignableMinor` this order's own products cannot absorb, so the sheet can offer a
   * "Resto del pedido" line and never strand money outside every reachable ceiling. See
   * {@link computeRestCeilingMinor}.
   */
  restCeilingMinor: number;
  items: AssignableOrderItem[];
};

type RestCeilingInput = {
  assignableMinor: number;
  items: { basePagableMinor: number | null; allocatedMinor: number }[];
};

/**
 * How much of an order's assignable balance its products cannot absorb between them.
 *
 * A product with a known price absorbs at most what is left of that price
 * (`basePagableMinor - allocatedMinor`); a product with no known price has no ceiling of its own,
 * so it can absorb the whole order. Anything left over after that capacity is only reachable
 * through an order-level line, which is exactly what "Resto del pedido" is.
 *
 * Deliberately NOT keyed off the product count: `resolveBasePagableMinor` reads `unitPrice` before
 * it falls back to the order total, so a single-product order with a price plus shipping already
 * has a base smaller than its total and needs the rest line just as much as a multi-product one.
 */
export function computeRestCeilingMinor(order: RestCeilingInput): number {
  const itemsCapacityMinor = order.items.reduce(
    (sum, item) =>
      sum +
      (item.basePagableMinor == null
        ? order.assignableMinor
        : Math.max(item.basePagableMinor - item.allocatedMinor, 0)),
    0,
  );
  return Math.max(0, order.assignableMinor - itemsCapacityMinor);
}

/**
 * Every standing order of one store that still has an assignable balance, for the "¿A qué va este
 * pago?" declaration list of the store payment sheet. Spans every currency the store has open
 * orders in (the sheet groups by currency client-side once the collector picks one), because a
 * multi-currency store's collector needs to see the whole picture before choosing.
 *
 * Unlike `getPendingProductsByStore`, eligibility here is a MONEY question (assignable balance > 0),
 * not a delivery-state one: a fully delivered order that still owes money must still appear, and an
 * order with every product delivered but nothing paid is exactly the common case this sheet exists
 * for.
 *
 * Ordered newest first: the payment being recorded almost always belongs to a recent transaction,
 * so the line the collector is looking for is at the top. Each row carries its `humanReadableId`,
 * which makes that order self-evident on screen rather than an assumption.
 */
export async function getAssignableOrdersByStore(userId: string, storeId: string): Promise<AssignableOrder[]> {
  const orders = await prisma.order.findMany({
    where: { userId, storeId, status: { not: OrderStatus.CANCELLED } },
    select: {
      id: true,
      humanReadableId: true,
      orderDate: true,
      currencyCode: true,
      status: true,
      totalCost: true,
      allocatedAmountMinor: true,
      items: {
        select: { id: true, name: true, unitPrice: true, quantity: true, paidDeclaredAt: true },
        orderBy: { position: "asc" },
      },
    },
    orderBy: [{ orderDate: "desc" }, { id: "desc" }],
  });

  const eligibleOrders = orders.filter((order) => order.totalCost - order.allocatedAmountMinor > 0);
  if (eligibleOrders.length === 0) return [];

  const itemIds = eligibleOrders.flatMap((order) => order.items.map((item) => item.id));
  const allocatedByItemId = new Map<string, number>();
  const settledByItemId = new Set<string>();
  if (itemIds.length > 0) {
    // Read the rows rather than `groupBy`: the sum and the `bool_or` of `settlesTarget` are needed
    // together, and Prisma's `groupBy` cannot aggregate a boolean. Same fold as
    // `getPendingProductsByStore`.
    const allocations = await prisma.paymentAllocation.findMany({
      where: { userId, orderItemId: { in: itemIds } },
      select: { orderItemId: true, amountMinor: true, settlesTarget: true },
    });
    for (const allocation of allocations) {
      if (!allocation.orderItemId) continue;
      allocatedByItemId.set(
        allocation.orderItemId,
        (allocatedByItemId.get(allocation.orderItemId) ?? 0) + allocation.amountMinor,
      );
      if (allocation.settlesTarget) settledByItemId.add(allocation.orderItemId);
    }
  }

  return eligibleOrders.map((order) => {
    const orderItemCount = order.items.length;
    const assignableMinor = order.totalCost - order.allocatedAmountMinor;
    const items = order.items.map((item) => ({
      itemId: item.id,
      name: item.name,
      basePagableMinor: resolveBasePagableMinor(item.unitPrice, item.quantity, order.totalCost, orderItemCount),
      allocatedMinor: allocatedByItemId.get(item.id) ?? 0,
      settledByDeclaration: settledByItemId.has(item.id),
      paidDeclared: item.paidDeclaredAt !== null,
    }));

    return {
      orderId: order.id,
      humanReadableId: order.humanReadableId,
      orderDate: order.orderDate,
      currencyCode: order.currencyCode,
      totalCost: order.totalCost,
      isActive: isActiveOrderStatus(order.status),
      allocatedAmountMinor: order.allocatedAmountMinor,
      assignableMinor,
      restCeilingMinor: computeRestCeilingMinor({ assignableMinor, items }),
      items,
    };
  });
}

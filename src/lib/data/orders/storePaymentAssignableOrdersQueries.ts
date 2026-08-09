import { prisma } from "@/lib/prisma";
import { OrderStatus } from "../../../../generated/prisma/client";
import { resolveBasePagableMinor } from "./pendingProductsByStoreQueries";

/** One product on an order still eligible to receive a declared allocation. */
export type AssignableOrderItem = {
  itemId: string;
  name: string;
  /** Unit price × quantity, or the order total when this is its only item. `null` when neither is known. */
  basePagableMinor: number | null;
  /** Sum of this item's own `PaymentAllocation.amountMinor` rows, already written. */
  allocatedMinor: number;
};

/** One standing order of the store that still has money left to declare against it. */
export type AssignableOrder = {
  orderId: string;
  orderDate: Date;
  expectedDeliveryFrom: Date | null;
  expectedDeliveryTo: Date | null;
  currencyCode: string;
  totalCost: number;
  /** `totalCost - assignableMinor` money already declared against this order, across every payment. */
  allocatedAmountMinor: number;
  /** `totalCost - allocatedAmountMinor`, always > 0 for a row returned by this query. */
  assignableMinor: number;
  items: AssignableOrderItem[];
};

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
 */
export async function getAssignableOrdersByStore(userId: string, storeId: string): Promise<AssignableOrder[]> {
  const orders = await prisma.order.findMany({
    where: { userId, storeId, status: { not: OrderStatus.CANCELLED } },
    select: {
      id: true,
      orderDate: true,
      expectedDeliveryFrom: true,
      expectedDeliveryTo: true,
      currencyCode: true,
      totalCost: true,
      allocatedAmountMinor: true,
      items: {
        select: { id: true, name: true, unitPrice: true, quantity: true },
        orderBy: { position: "asc" },
      },
    },
    orderBy: [{ orderDate: "asc" }, { id: "asc" }],
  });

  const eligibleOrders = orders.filter((order) => order.totalCost - order.allocatedAmountMinor > 0);
  if (eligibleOrders.length === 0) return [];

  const itemIds = eligibleOrders.flatMap((order) => order.items.map((item) => item.id));
  const allocatedByItemId = new Map<string, number>();
  if (itemIds.length > 0) {
    const itemGroups = await prisma.paymentAllocation.groupBy({
      by: ["orderItemId"],
      where: { userId, orderItemId: { in: itemIds } },
      _sum: { amountMinor: true },
    });
    for (const group of itemGroups) {
      if (group.orderItemId) allocatedByItemId.set(group.orderItemId, group._sum.amountMinor ?? 0);
    }
  }

  return eligibleOrders.map((order) => {
    const orderItemCount = order.items.length;
    return {
      orderId: order.id,
      orderDate: order.orderDate,
      expectedDeliveryFrom: order.expectedDeliveryFrom,
      expectedDeliveryTo: order.expectedDeliveryTo,
      currencyCode: order.currencyCode,
      totalCost: order.totalCost,
      allocatedAmountMinor: order.allocatedAmountMinor,
      assignableMinor: order.totalCost - order.allocatedAmountMinor,
      items: order.items.map((item) => ({
        itemId: item.id,
        name: item.name,
        basePagableMinor: resolveBasePagableMinor(item.unitPrice, item.quantity, order.totalCost, orderItemCount),
        allocatedMinor: allocatedByItemId.get(item.id) ?? 0,
      })),
    };
  });
}

import { prisma } from "@/lib/prisma";
import { DeliveryStatus, type SellerType, type StoreStatus } from "../../../../generated/prisma/client";
import type { ItemDeliveryState } from "@/lib/orders/orderState";
import { deriveItemDeliveryState } from "./orderQueries";
import { getStoreDebtByCurrency, type StoreDebtRow } from "./storePaymentQueries";

export type PendingProductRow = {
  itemId: string;
  name: string;
  quantity: number;
  deliveryState: ItemDeliveryState;
  unitPrice: number | null;
  /** Sum of this item's own `PaymentAllocation.amountMinor` rows (allocations against the order as
   *  a whole, with no `orderItemId`, are not counted here). */
  allocatedMinor: number;
  /** True when at least one of this item's own allocations declared `settlesTarget`. */
  settled: boolean;
  orderId: string;
  orderDate: Date;
  expectedDeliveryFrom: Date | null;
  expectedDeliveryTo: Date | null;
  orderTotalCost: number;
  orderItemCount: number;
  currencyCode: string;
  /**
   * The amount this product is "responsible" for out of the order total: unit price x quantity when
   * known, or the whole order total when this is the order's only product (a single-item order's
   * price is unambiguous even when the per-item `unitPrice` was never captured). `null` when neither
   * can be derived, which the UI renders as a placeholder plus an "add price" link.
   */
  basePagableMinor: number | null;
};

export type StoreDebtEntry = { currencyCode: string; debtMinor: number };

export type PendingProductsByStoreGroup = {
  store: {
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    sellerType: SellerType;
    status: StoreStatus;
  };
  /** Count of distinct standing orders that contributed at least one pending product. */
  openOrdersCount: number;
  pendingProducts: PendingProductRow[];
  debts: StoreDebtEntry[];
};

function resolveBasePagableMinor(
  unitPrice: number | null,
  quantity: number,
  orderTotalCost: number,
  orderItemCount: number,
): number | null {
  if (unitPrice != null) return unitPrice * quantity;
  if (orderItemCount === 1) return orderTotalCost;
  return null;
}

/**
 * Every pending product across every store the collector has a standing order with, grouped by
 * store, for the Orders list "Por tienda" view. A product is pending when its order is still
 * standing (`status` not `CANCELLED`/`COMPLETED`) and the product itself has not been delivered.
 *
 * Not paginated: at today's real data (the busiest store has ~29 pending products, ~74 total across
 * every store) a full in-memory group-and-sort costs nothing worth a second pagination scheme
 * alongside the per-order list's. Revisit if a collector's pending-product count grows an order of
 * magnitude past that.
 */
export async function getPendingProductsByStore(userId: string): Promise<PendingProductsByStoreGroup[]> {
  const orders = await prisma.order.findMany({
    where: { userId, status: { notIn: ["CANCELLED", "COMPLETED"] } },
    select: {
      id: true,
      orderDate: true,
      expectedDeliveryFrom: true,
      expectedDeliveryTo: true,
      currencyCode: true,
      totalCost: true,
      store: {
        select: { id: true, slug: true, name: true, logoUrl: true, sellerType: true, status: true },
      },
      items: {
        select: {
          id: true,
          name: true,
          quantity: true,
          unitPrice: true,
          deliveryState: true,
          deliveryItems: {
            select: { delivery: { select: { status: true } } },
            where: { delivery: { status: { not: DeliveryStatus.CANCELLED } } },
          },
        },
        orderBy: { position: "asc" },
      },
    },
    orderBy: [{ orderDate: "asc" }, { id: "asc" }],
  });

  const groupsByStore = new Map<string, PendingProductsByStoreGroup>();
  const draftsByItemId = new Map<string, PendingProductRow>();
  const pendingItemIds: string[] = [];

  for (const order of orders) {
    const orderItemCount = order.items.length;
    const pendingItemsForOrder = order.items.filter(
      (item) => deriveItemDeliveryState(item.deliveryItems, item.deliveryState) !== "delivered",
    );
    if (pendingItemsForOrder.length === 0) continue;

    let group = groupsByStore.get(order.store.id);
    if (!group) {
      group = { store: order.store, openOrdersCount: 0, pendingProducts: [], debts: [] };
      groupsByStore.set(order.store.id, group);
    }
    group.openOrdersCount += 1;

    for (const item of pendingItemsForOrder) {
      const draft: PendingProductRow = {
        itemId: item.id,
        name: item.name,
        quantity: item.quantity,
        deliveryState: deriveItemDeliveryState(item.deliveryItems, item.deliveryState),
        unitPrice: item.unitPrice,
        allocatedMinor: 0,
        settled: false,
        orderId: order.id,
        orderDate: order.orderDate,
        expectedDeliveryFrom: order.expectedDeliveryFrom,
        expectedDeliveryTo: order.expectedDeliveryTo,
        orderTotalCost: order.totalCost,
        orderItemCount,
        currencyCode: order.currencyCode,
        basePagableMinor: resolveBasePagableMinor(item.unitPrice, item.quantity, order.totalCost, orderItemCount),
      };
      group.pendingProducts.push(draft);
      draftsByItemId.set(item.id, draft);
      pendingItemIds.push(item.id);
    }
  }

  const groups = [...groupsByStore.values()];
  if (groups.length === 0) return [];

  if (pendingItemIds.length > 0) {
    const allocations = await prisma.paymentAllocation.findMany({
      where: { userId, orderItemId: { in: pendingItemIds } },
      select: { orderItemId: true, amountMinor: true, settlesTarget: true },
    });
    for (const allocation of allocations) {
      if (!allocation.orderItemId) continue;
      const draft = draftsByItemId.get(allocation.orderItemId);
      if (!draft) continue;
      draft.allocatedMinor += allocation.amountMinor;
      if (allocation.settlesTarget) draft.settled = true;
    }
  }

  const storeIds = new Set(groups.map((group) => group.store.id));
  const debts = await getStoreDebtByCurrency(userId);
  const debtsByStore = new Map<string, StoreDebtRow[]>();
  for (const debt of debts) {
    if (!storeIds.has(debt.storeId)) continue;
    const list = debtsByStore.get(debt.storeId) ?? [];
    list.push(debt);
    debtsByStore.set(debt.storeId, list);
  }
  for (const group of groups) {
    group.debts = (debtsByStore.get(group.store.id) ?? []).map((debt) => ({
      currencyCode: debt.currencyCode,
      debtMinor: debt.debtMinor,
    }));
  }

  return groups;
}

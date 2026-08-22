import { prisma } from "@/lib/prisma";
import { DeliveryStatus, type SellerType, type StoreStatus } from "../../../../generated/prisma/client";
import type { ItemDeliveryState } from "@/lib/orders/orderState";
import { resolveBasePagableMinor } from "@/lib/orders/productPaymentState";
import { openBalanceMinorByOrderId } from "./orderOpenBalance";
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
  /** The collector's own "this product is paid" mark (`OrderItem.paidDeclaredAt`). Carries no amount. */
  paidDeclared: boolean;
  orderId: string;
  /** `PED-*` code of the source order, so a store-scoped selection can group its products by it. */
  orderHumanReadableId: string;
  orderDate: Date;
  expectedDeliveryFrom: Date | null;
  expectedDeliveryTo: Date | null;
  orderTotalCost: number;
  /**
   * Money already declared against the SOURCE ORDER as a whole, item lines included. Carried so the
   * row can be resolved as settled when its order owes nothing: an order at zero balance proves
   * every product of it is covered, which is an implication of the order's own arithmetic, not an
   * estimate of how the money split.
   */
  orderAllocatedAmountMinor: number;
  /**
   * The SOURCE ORDER holds money that names no product. Not derivable from this row, and not
   * derivable from the rows either: `allocatedMinor` is this line's own money and
   * `orderAllocatedAmountMinor` is the order's total, but the sum of the order's ITEM-level lines
   * appears nowhere. Summing the visible rows would be worse than useless: this view lists only
   * PENDING products, so an order with a delivered product would report undetailed money it does
   * not have. Hence a field, computed here, rather than a derivation in the component.
   */
  orderHasUndetailedMoney: boolean;
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

export type StoreDebtEntry = {
  currencyCode: string;
  debtMinor: number;
  /**
   * `StoreDebtRow.openOrderDebtMinor` (`BR-05-26` / `FR-05-61`, `ADR 0033`): "Pendiente en pedidos
   * abiertos" alongside the unchanged lifetime `debtMinor`. Required: always filled in by this
   * module, straight off the now-required `StoreDebtRow.openOrderDebtMinor`.
   */
  openOrderDebtMinor: number;
};

/**
 * One order of this group that received money without naming a product, and still owes something.
 *
 * It exists to NAME that money where it actually sits instead of spreading it across the group's
 * products, which is the one thing this whole surface refuses to do. Orders already at zero balance
 * are left out: their products already read as settled from the order's own arithmetic, so the line
 * would answer a question nobody is asking, and today it would be the louder figure of the two.
 */
export type UndetailedOrderPayment = {
  orderId: string;
  humanReadableId: string;
  amountMinor: number;
  currencyCode: string;
};

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
  /** See {@link UndetailedOrderPayment}. Empty when every contributing order is fully itemized. */
  undetailedByOrder: UndetailedOrderPayment[];
};

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
      humanReadableId: true,
      orderDate: true,
      expectedDeliveryFrom: true,
      expectedDeliveryTo: true,
      currencyCode: true,
      totalCost: true,
      allocatedAmountMinor: true,
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
          paidDeclaredAt: true,
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

  // The net open balance (BR-05-32, ADR 0034 §3.1), never the gross `totalCost - allocatedAmountMinor`:
  // the undetailed-money block below must agree with the `openOrderDebtMinor` chip rendered right
  // above it on the same screen, which is already net of any `StoreAccountAdjustmentLine` (F6,
  // 2026-08-20 review). One batched read for the whole set of contributing orders.
  const openBalanceByOrderId = await openBalanceMinorByOrderId(prisma, userId, orders);

  const groupsByStore = new Map<string, PendingProductsByStoreGroup>();
  const draftsByItemId = new Map<string, PendingProductRow>();
  /** Every order that contributed at least one pending row, so `orderHasUndetailedMoney` can be
   *  answered for all of them and not only for the indebted ones the block below renders. */
  const draftsByOrderId = new Map<string, PendingProductRow[]>();
  const pendingItemIds: string[] = [];
  /** Orders that contributed a pending product AND still owe money: the undetailed block's scope. */
  const indebtedOrdersByStore = new Map<string, Map<string, { humanReadableId: string; currencyCode: string }>>();

  for (const order of orders) {
    const orderItemCount = order.items.length;
    const pendingItemsForOrder = order.items.filter(
      (item) => deriveItemDeliveryState(item.deliveryItems, item.deliveryState) !== "delivered",
    );
    if (pendingItemsForOrder.length === 0) continue;

    let group = groupsByStore.get(order.store.id);
    if (!group) {
      group = { store: order.store, openOrdersCount: 0, pendingProducts: [], debts: [], undetailedByOrder: [] };
      groupsByStore.set(order.store.id, group);
    }
    group.openOrdersCount += 1;

    // The batch form guarantees an entry per input order (see `openBalanceMinorByOrderId`'s doc); a
    // miss here is a programming error, not a figure to silently degrade to the gross remainder.
    const openBalance = openBalanceByOrderId.get(order.id);
    if (openBalance === undefined) {
      throw new Error(`openBalanceMinorByOrderId missing entry for order ${order.id}`);
    }
    if (openBalance > 0) {
      const indebted = indebtedOrdersByStore.get(order.store.id) ?? new Map();
      indebted.set(order.id, { humanReadableId: order.humanReadableId, currencyCode: order.currencyCode });
      indebtedOrdersByStore.set(order.store.id, indebted);
    }

    for (const item of pendingItemsForOrder) {
      const draft: PendingProductRow = {
        itemId: item.id,
        name: item.name,
        quantity: item.quantity,
        deliveryState: deriveItemDeliveryState(item.deliveryItems, item.deliveryState),
        unitPrice: item.unitPrice,
        allocatedMinor: 0,
        paidDeclared: item.paidDeclaredAt !== null,
        orderId: order.id,
        orderHumanReadableId: order.humanReadableId,
        orderDate: order.orderDate,
        expectedDeliveryFrom: order.expectedDeliveryFrom,
        expectedDeliveryTo: order.expectedDeliveryTo,
        orderTotalCost: order.totalCost,
        orderAllocatedAmountMinor: order.allocatedAmountMinor,
        // Filled in below, once the order-level money has been read.
        orderHasUndetailedMoney: false,
        orderItemCount,
        currencyCode: order.currencyCode,
        basePagableMinor: resolveBasePagableMinor(item.unitPrice, item.quantity, order.totalCost, orderItemCount),
      };
      group.pendingProducts.push(draft);
      draftsByItemId.set(item.id, draft);
      const draftsForOrder = draftsByOrderId.get(order.id) ?? [];
      draftsForOrder.push(draft);
      draftsByOrderId.set(order.id, draftsForOrder);
      pendingItemIds.push(item.id);
    }
  }

  const groups = [...groupsByStore.values()];
  if (groups.length === 0) return [];

  // Per-product money, and ONLY per-product money. An allocation with no `orderItemId` names the
  // order, not a product of it, and nothing here may turn it into one: the split it would imply is
  // unknowable, and inventing it is the single thing this surface exists to refuse. The narrow is
  // therefore part of the contract, not an optimization.
  if (pendingItemIds.length > 0) {
    const allocations = await prisma.paymentAllocation.findMany({
      where: { userId, orderItemId: { in: pendingItemIds } },
      select: { orderItemId: true, amountMinor: true },
    });
    for (const allocation of allocations) {
      if (!allocation.orderItemId) continue;
      const draft = draftsByItemId.get(allocation.orderItemId);
      if (!draft) continue;
      draft.allocatedMinor += allocation.amountMinor;
    }
  }

  // The order-level money, kept apart on purpose: it is displayed as its own block, per order, and
  // never folded into any product's `allocatedMinor`. Read for EVERY contributing order, not only
  // the indebted ones the block renders, because it also decides whether a product of that order
  // can honestly show a ratio (`orderHasUndetailedMoney`), and that question has an answer on a
  // settled order too.
  const contributingOrderIds = [...draftsByOrderId.keys()];
  if (contributingOrderIds.length > 0) {
    const undetailed = await prisma.paymentAllocation.groupBy({
      by: ["orderId"],
      where: { userId, orderId: { in: contributingOrderIds }, orderItemId: null },
      _sum: { amountMinor: true },
    });
    const undetailedByOrderId = new Map(undetailed.map((row) => [row.orderId, row._sum.amountMinor ?? 0]));

    for (const [orderId, drafts] of draftsByOrderId) {
      const hasUndetailed = (undetailedByOrderId.get(orderId) ?? 0) > 0;
      if (!hasUndetailed) continue;
      for (const draft of drafts) draft.orderHasUndetailedMoney = true;
    }

    for (const group of groupsByStore.values()) {
      const indebted = indebtedOrdersByStore.get(group.store.id);
      if (!indebted) continue;
      for (const [orderId, meta] of indebted) {
        const amountMinor = undetailedByOrderId.get(orderId) ?? 0;
        if (amountMinor <= 0) continue;
        group.undetailedByOrder.push({
          orderId,
          humanReadableId: meta.humanReadableId,
          amountMinor,
          currencyCode: meta.currencyCode,
        });
      }
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
      openOrderDebtMinor: debt.openOrderDebtMinor,
    }));
  }

  return groups;
}

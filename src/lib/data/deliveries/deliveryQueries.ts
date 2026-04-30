import { prisma } from "@/lib/prisma";
import { OrderItemDeliveryState } from "../../../../generated/prisma/client";

export type EligibleStore = {
  storeId: string;
  storeName: string;
};

export type EligibleProduct = {
  orderItemId: string;
  orderItemName: string;
  quantity: number;
  productTypeKey: string | null;
  orderId: string;
  orderHumanReadableId: string;
  orderDate: Date;
};

export type EligibleProductsGroup = {
  orderId: string;
  orderHumanReadableId: string;
  orderDate: Date;
  products: EligibleProduct[];
};

export type EligibleProductsResult = {
  byOrder: EligibleProductsGroup[];
};

export type DeliverySourceOrder = {
  orderId: string;
  orderHumanReadableId: string;
  storeId: string;
  storeName: string;
};

export type DeliveryStub = {
  id: string;
  humanReadableId: string;
  deliveryDate: Date;
};

export async function getStoresWithEligibleProducts(userId: string): Promise<EligibleStore[]> {
  const rows = await prisma.orderItem.findMany({
    where: {
      userId,
      deliveryState: {
        in: [OrderItemDeliveryState.NONE, OrderItemDeliveryState.ARRIVED_AT_STORE],
      },
    },
    select: {
      order: {
        select: {
          store: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: [{ order: { store: { name: "asc" } } }],
  });

  const storesById = new Map<string, EligibleStore>();
  for (const row of rows) {
    storesById.set(row.order.store.id, {
      storeId: row.order.store.id,
      storeName: row.order.store.name,
    });
  }

  return Array.from(storesById.values()).sort((a, b) => a.storeName.localeCompare(b.storeName));
}

export async function getDeliverySourceOrder(orderId: string, userId: string): Promise<DeliverySourceOrder | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      humanReadableId: true,
      storeId: true,
      store: { select: { name: true } },
    },
  });

  if (!order) return null;

  return {
    orderId: order.id,
    orderHumanReadableId: order.humanReadableId,
    storeId: order.storeId,
    storeName: order.store.name,
  };
}

export async function getDeliveryStubById(deliveryId: string, userId: string): Promise<DeliveryStub | null> {
  return prisma.delivery.findFirst({
    where: { id: deliveryId, userId },
    select: {
      id: true,
      humanReadableId: true,
      deliveryDate: true,
    },
  });
}

/**
 * Returns eligible order-item products for a given store, grouped by source
 * order. Eligible items have deliveryState NONE or ARRIVED_AT_STORE.
 * Items with IN_TRANSIT or DELIVERED state are excluded entirely — they are
 * not shown as disabled options (BR-08-03).
 *
 * When excludeDeliveryId is provided (edit mode), items currently belonging to
 * that delivery are re-included so the collector can adjust the selection.
 */
export async function getEligibleProductsForStore(
  storeId: string,
  userId: string,
  excludeDeliveryId?: string,
): Promise<EligibleProductsResult> {
  const eligibleStates: OrderItemDeliveryState[] = [
    OrderItemDeliveryState.NONE,
    OrderItemDeliveryState.ARRIVED_AT_STORE,
  ];

  const items = await prisma.orderItem.findMany({
    where: {
      userId,
      order: { storeId, userId },
      OR: [
        { deliveryState: { in: eligibleStates } },
        ...(excludeDeliveryId ? [{ deliveryItems: { some: { deliveryId: excludeDeliveryId } } }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      quantity: true,
      productTypeKey: true,
      order: {
        select: {
          id: true,
          humanReadableId: true,
          orderDate: true,
        },
      },
    },
    orderBy: [{ order: { orderDate: "asc" } }, { position: "asc" }],
  });

  const groupMap = new Map<string, EligibleProductsGroup>();

  for (const item of items) {
    const { id: orderId, humanReadableId: orderHumanReadableId, orderDate } = item.order;

    if (!groupMap.has(orderId)) {
      groupMap.set(orderId, { orderId, orderHumanReadableId, orderDate, products: [] });
    }

    groupMap.get(orderId)!.products.push({
      orderItemId: item.id,
      orderItemName: item.name,
      quantity: item.quantity,
      productTypeKey: item.productTypeKey,
      orderId,
      orderHumanReadableId,
      orderDate,
    });
  }

  return { byOrder: Array.from(groupMap.values()) };
}

// ---------------------------------------------------------------------------
// Stubs — filled in by WO-03 (detail) and WO-06 (list)
// ---------------------------------------------------------------------------

// getDeliveryById — WO-03
// getDeliveryDetail — WO-03
// getDeliveriesList — WO-06

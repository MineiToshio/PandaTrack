import { prisma } from "@/lib/prisma";
import { OrderItemDeliveryState, type DeliveryStatus } from "../../../../generated/prisma/client";
import type { DeliveryListSort } from "@/lib/deliveries/deliveryListSort";

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
// List
// ---------------------------------------------------------------------------

export type DeliveriesListPageItem = {
  id: string;
  humanReadableId: string;
  deliveryDate: Date;
  expectedArrivalFrom: Date | null;
  expectedArrivalTo: Date | null;
  receivedDate: Date | null;
  status: DeliveryStatus;
  cost: number;
  currencyCode: string;
  store: { id: string; name: string; slug: string };
  /** Sum of quantities across linked order items ("N productos"). */
  productCount: number;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    productTypeKey: string | null;
  }>;
};

export type DeliveriesListPageFilters = {
  /** Matches `DLV-*` code or product name (case-insensitive contains). */
  nameQuery?: string;
  statuses?: DeliveryStatus[];
  storeId?: string;
  /** Drawer "Producto" filter — product name only. */
  productQuery?: string;
  /** IN_TRANSIT deliveries whose expected arrival window already passed. */
  overdueOnly?: boolean;
  /** Expected-arrival range overlap (any part of the window inside the range). */
  arrivalFrom?: Date;
  arrivalTo?: Date;
  /** Shipping date (deliveryDate) range. */
  shippedFrom?: Date;
  shippedTo?: Date;
  sort?: DeliveryListSort;
  page: number;
  pageSize: number;
};

export type DeliveriesListPageResult = {
  deliveries: DeliveriesListPageItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

function resolveDeliveryOrderBy(sort: DeliveryListSort) {
  switch (sort) {
    case "recent":
      return { deliveryDate: "desc" as const };
    case "eta-asc":
      return { expectedArrivalFrom: { sort: "asc" as const, nulls: "last" as const } };
    case "store-asc":
      return { store: { name: "asc" as const } };
    case "oldest":
    default:
      return { deliveryDate: "asc" as const };
  }
}

export async function getDeliveriesList(
  userId: string,
  filters: DeliveriesListPageFilters,
): Promise<DeliveriesListPageResult> {
  const {
    nameQuery,
    statuses,
    storeId,
    productQuery,
    overdueOnly,
    arrivalFrom,
    arrivalTo,
    shippedFrom,
    shippedTo,
    sort = "oldest",
    page,
    pageSize,
  } = filters;
  const now = new Date();

  const baseWhere: Record<string, unknown> = {
    userId,
    ...(storeId ? { storeId } : {}),
    ...(statuses && statuses.length > 0 ? { status: { in: statuses } } : {}),
    ...(shippedFrom || shippedTo
      ? {
          deliveryDate: {
            ...(shippedFrom ? { gte: shippedFrom } : {}),
            ...(shippedTo ? { lte: shippedTo } : {}),
          },
        }
      : {}),
  };

  if (overdueOnly) {
    // Overdue is only meaningful for active deliveries; do not override an explicit status filter.
    baseWhere.expectedArrivalTo = { lt: now };
    if (!statuses || statuses.length === 0) {
      baseWhere.status = "IN_TRANSIT" satisfies DeliveryStatus;
    }
  } else if (arrivalFrom || arrivalTo) {
    // Window overlap: delivery window touches [from, to]; null endpoints are open-ended.
    const conditions: Array<Record<string, unknown>> = [];
    if (arrivalTo) conditions.push({ expectedArrivalFrom: { lte: arrivalTo } });
    if (arrivalFrom) conditions.push({ expectedArrivalTo: { gte: arrivalFrom } });
    if (conditions.length > 0) Object.assign(baseWhere, { AND: conditions });
  }

  if (productQuery && productQuery.trim()) {
    baseWhere.orderItems = {
      some: { orderItem: { name: { contains: productQuery.trim(), mode: "insensitive" } } },
    };
  }

  const trimmedQuery = nameQuery?.trim();
  const where = trimmedQuery
    ? {
        ...baseWhere,
        OR: [
          { humanReadableId: { contains: trimmedQuery, mode: "insensitive" as const } },
          { orderItems: { some: { orderItem: { name: { contains: trimmedQuery, mode: "insensitive" as const } } } } },
        ],
      }
    : baseWhere;

  const [rows, totalCount] = await Promise.all([
    prisma.delivery.findMany({
      where,
      select: {
        id: true,
        humanReadableId: true,
        deliveryDate: true,
        expectedArrivalFrom: true,
        expectedArrivalTo: true,
        receivedDate: true,
        status: true,
        cost: true,
        currencyCode: true,
        store: { select: { id: true, name: true, slug: true } },
        orderItems: {
          select: {
            orderItem: { select: { id: true, name: true, quantity: true, productTypeKey: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: resolveDeliveryOrderBy(sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.delivery.count({ where }),
  ]);

  const deliveries: DeliveriesListPageItem[] = rows.map((row) => {
    const items = row.orderItems.map((link) => ({
      id: link.orderItem.id,
      name: link.orderItem.name,
      quantity: link.orderItem.quantity,
      productTypeKey: link.orderItem.productTypeKey,
    }));
    return {
      id: row.id,
      humanReadableId: row.humanReadableId,
      deliveryDate: row.deliveryDate,
      expectedArrivalFrom: row.expectedArrivalFrom,
      expectedArrivalTo: row.expectedArrivalTo,
      receivedDate: row.receivedDate,
      status: row.status,
      cost: row.cost,
      currencyCode: row.currencyCode,
      store: row.store,
      productCount: items.reduce((sum, item) => sum + item.quantity, 0),
      items,
    };
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return { deliveries, totalCount, totalPages, page, pageSize };
}

/** Distinct stores the user has deliveries with — feeds the list filter drawer. */
export async function getDeliveryStoreOptions(userId: string): Promise<EligibleStore[]> {
  const rows = await prisma.delivery.findMany({
    where: { userId },
    select: { store: { select: { id: true, name: true } } },
    distinct: ["storeId"],
    orderBy: { store: { name: "asc" } },
  });
  return rows.map((row) => ({ storeId: row.store.id, storeName: row.store.name }));
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export type DeliveryDetailItem = {
  id: string;
  name: string;
  quantity: number;
  productTypeKey: string | null;
};

export type DeliveryDetailSourceOrderGroup = {
  orderId: string;
  orderHumanReadableId: string;
  orderDate: Date;
  items: DeliveryDetailItem[];
};

export type DeliveryDetail = {
  id: string;
  humanReadableId: string;
  status: DeliveryStatus;
  deliveryDate: Date;
  expectedArrivalFrom: Date | null;
  expectedArrivalTo: Date | null;
  receivedDate: Date | null;
  cost: number;
  currencyCode: string;
  exchangeRate: number | null;
  note: string | null;
  updatedAt: Date;
  store: { id: string; name: string; slug: string };
  /** Sum of quantities across linked items ("N productos"). */
  productCount: number;
  /** Items grouped by source order, ordered by order date (FR-08-18). */
  sourceOrders: DeliveryDetailSourceOrderGroup[];
};

export async function getDeliveryDetail(deliveryId: string, userId: string): Promise<DeliveryDetail | null> {
  const delivery = await prisma.delivery.findFirst({
    where: { id: deliveryId, userId },
    select: {
      id: true,
      humanReadableId: true,
      status: true,
      deliveryDate: true,
      expectedArrivalFrom: true,
      expectedArrivalTo: true,
      receivedDate: true,
      cost: true,
      currencyCode: true,
      exchangeRate: true,
      note: true,
      updatedAt: true,
      store: { select: { id: true, name: true, slug: true } },
      orderItems: {
        select: {
          orderItem: {
            select: {
              id: true,
              name: true,
              quantity: true,
              productTypeKey: true,
              position: true,
              order: { select: { id: true, humanReadableId: true, orderDate: true } },
            },
          },
        },
      },
    },
  });

  if (!delivery) return null;

  const groupMap = new Map<string, DeliveryDetailSourceOrderGroup>();
  const sortedLinks = [...delivery.orderItems].sort((a, b) => {
    const orderDelta = a.orderItem.order.orderDate.getTime() - b.orderItem.order.orderDate.getTime();
    if (orderDelta !== 0) return orderDelta;
    return a.orderItem.position - b.orderItem.position;
  });

  for (const link of sortedLinks) {
    const { order } = link.orderItem;
    if (!groupMap.has(order.id)) {
      groupMap.set(order.id, {
        orderId: order.id,
        orderHumanReadableId: order.humanReadableId,
        orderDate: order.orderDate,
        items: [],
      });
    }
    groupMap.get(order.id)!.items.push({
      id: link.orderItem.id,
      name: link.orderItem.name,
      quantity: link.orderItem.quantity,
      productTypeKey: link.orderItem.productTypeKey,
    });
  }

  const sourceOrders = Array.from(groupMap.values());
  const productCount = sourceOrders.reduce(
    (sum, group) => sum + group.items.reduce((groupSum, item) => groupSum + item.quantity, 0),
    0,
  );

  return {
    id: delivery.id,
    humanReadableId: delivery.humanReadableId,
    status: delivery.status,
    deliveryDate: delivery.deliveryDate,
    expectedArrivalFrom: delivery.expectedArrivalFrom,
    expectedArrivalTo: delivery.expectedArrivalTo,
    receivedDate: delivery.receivedDate,
    cost: delivery.cost,
    currencyCode: delivery.currencyCode,
    exchangeRate: delivery.exchangeRate ? Number(delivery.exchangeRate) : null,
    note: delivery.note,
    updatedAt: delivery.updatedAt,
    store: delivery.store,
    productCount,
    sourceOrders,
  };
}

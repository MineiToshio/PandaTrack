import { prisma } from "@/lib/prisma";
import { needsFxReconciliation } from "@/lib/fx/reconciliation";
import { getCollectorPreferencesSnapshot } from "@/lib/data/user-settings/userSettingsQueries";
import { getTodayStart } from "@/lib/data/dashboard/dashboardPeriods";
import { OrderItemDeliveryState, type DeliveryStatus, type OrderStatus } from "../../../../generated/prisma/client";
import type { DeliveryListSort } from "@/lib/deliveries/deliveryListSort";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/constants";

export type EligibleStore = {
  storeId: string;
  storeName: string;
};

export type EligibleProduct = {
  orderItemId: string;
  orderItemName: string;
  quantity: number;
  productTypeKey: string | null;
  /** Current persisted state — drives the picker chip (Listo/Pendiente/En esta entrega). */
  deliveryState: OrderItemDeliveryState;
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
  /** Lets a caller refuse to attach a delivery to a cancelled order server-side. */
  status: OrderStatus;
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
      status: true,
      store: { select: { name: true } },
    },
  });

  if (!order) return null;

  return {
    orderId: order.id,
    orderHumanReadableId: order.humanReadableId,
    storeId: order.storeId,
    storeName: order.store.name,
    status: order.status,
  };
}

/**
 * Returns eligible order-item products for a given store, grouped by source
 * order. Eligible items have deliveryState NONE or ARRIVED_AT_STORE.
 * Items with IN_TRANSIT or DELIVERED state are excluded entirely — they are
 * not shown as disabled options.
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
      deliveryState: true,
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
      deliveryState: item.deliveryState,
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
  store: { id: string; name: string; slug: string; logoUrl: string | null };
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
  /** The collector's IANA timezone, so `overdueOnly` resolves the same civil day as the row chip. */
  timeZone?: string | null;
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

/** See `ID_TIEBREAKER` in `orderQueries.ts`: every key below is non-unique on its own. */
const DELIVERY_ID_TIEBREAKER = { id: "asc" as const };

function resolveDeliveryOrderBy(sort: DeliveryListSort) {
  switch (sort) {
    case "recent":
      return [{ deliveryDate: "desc" as const }, DELIVERY_ID_TIEBREAKER];
    case "eta-asc":
      return [{ expectedArrivalFrom: { sort: "asc" as const, nulls: "last" as const } }, DELIVERY_ID_TIEBREAKER];
    case "store-asc":
      return [{ store: { name: "asc" as const } }, DELIVERY_ID_TIEBREAKER];
    case "store-desc":
      return [{ store: { name: "desc" as const } }, DELIVERY_ID_TIEBREAKER];
    case "oldest":
    default:
      return [{ deliveryDate: "asc" as const }, DELIVERY_ID_TIEBREAKER];
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
    timeZone,
    sort = "oldest",
    page,
    pageSize: requestedPageSize,
  } = filters;
  // Hardened against arbitrary URL values: only the allow-listed options are honored.
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(requestedPageSize)
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE;
  // The collector's civil day at UTC midnight, never a wall-clock instant. `expectedArrivalTo` is a
  // calendar day stored at UTC midnight, so a raw `new Date()` made the "Atrasados" toggle pick up a
  // delivery due TOMORROW from 19:00 in Lima — and it would then disagree with the row chip on the
  // very same page, which resolves the same question from the same value.
  const now = getTodayStart(new Date(), timeZone);

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
        store: { select: { id: true, name: true, slug: true, logoUrl: true } },
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

export type DeliveryHeadingCounts = {
  inTransitCount: number;
  deliveredCount: number;
};

/** Global IN_TRANSIT/DELIVERED counts for the deliveries list heading meta. */
export async function getDeliveryHeadingCounts(userId: string): Promise<DeliveryHeadingCounts> {
  const [inTransitCount, deliveredCount] = await Promise.all([
    prisma.delivery.count({ where: { userId, status: "IN_TRANSIT" } }),
    prisma.delivery.count({ where: { userId, status: "DELIVERED" } }),
  ]);

  return { inTransitCount, deliveredCount };
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
  /** True when a base-currency change left this delivery's stored rate stale (FX reconciliation). */
  needsExchangeRateUpdate: boolean;
  note: string | null;
  updatedAt: Date;
  store: { id: string; name: string; slug: string; logoUrl: string | null };
  /** Sum of quantities across linked items ("N productos"). */
  productCount: number;
  /** Items grouped by source order, ordered by order date. */
  sourceOrders: DeliveryDetailSourceOrderGroup[];
};

export async function getDeliveryDetail(deliveryId: string, userId: string): Promise<DeliveryDetail | null> {
  const preferences = await getCollectorPreferencesSnapshot(userId);
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
      exchangeRateBaseCode: true,
      note: true,
      updatedAt: true,
      store: { select: { id: true, name: true, slug: true, logoUrl: true } },
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
    needsExchangeRateUpdate: needsFxReconciliation(
      {
        currencyCode: delivery.currencyCode,
        exchangeRate: delivery.exchangeRate ? Number(delivery.exchangeRate) : null,
        exchangeRateBaseCode: delivery.exchangeRateBaseCode,
      },
      preferences?.baseCurrencyCode ?? null,
    ),
    note: delivery.note,
    updatedAt: delivery.updatedAt,
    store: delivery.store,
    productCount,
    sourceOrders,
  };
}

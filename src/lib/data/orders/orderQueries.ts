import { prisma } from "@/lib/prisma";
import { deriveHasUnpaidBalance } from "@/lib/orders/orderState";
import { calculatePaymentSummary } from "@/lib/orders/paymentSummary";
import type { ItemDeliveryState } from "@/lib/orders/orderState";
import type { OrderListPaymentState, OrderListSort } from "@/lib/orders/orderListSort";
import {
  DeliveryStatus,
  type OrderItemDeliveryState as OrderItemDeliveryStatePrisma,
  type OrderStatus,
} from "../../../../generated/prisma/client";

export type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number | null;
  productTypeKey: string | null;
  position: number;
};

export type OrderListItem = {
  id: string;
  humanReadableId: string;
  storeId: string;
  storeName: string;
  orderDate: Date;
  expectedDeliveryFrom: Date | null;
  expectedDeliveryTo: Date | null;
  currencyCode: string;
  exchangeRate: number | null;
  totalCost: number;
  status: OrderStatus;
  createdAt: Date;
};

export type OrderPayment = {
  id: string;
  amount: number;
  paymentDate: Date;
};

export type OrderDetail = OrderListItem & {
  note: string | null;
  cancellationReason: string | null;
  /** True when this order's stored exchange rate is stale after a base-currency change. */
  needsExchangeRateUpdate: boolean;
  updatedAt: Date;
  hasUnpaidBalance: boolean;
  paidAmount: number;
  remainingAmount: number;
  paymentPercentage: number;
  items: OrderItem[];
  payments: OrderPayment[];
  history: Array<{
    id: string;
    eventType: string;
    metadata: unknown;
    createdAt: Date;
  }>;
};

export type OrderListFilters = {
  status?: OrderStatus;
  storeId?: string;
};

export type OrderItemWithDeliveryState = OrderItem & {
  deliveryState: ItemDeliveryState;
};

export type OrderEligibility = {
  canDelete: boolean;
  canCancel: boolean;
  blockReason?: "ITEMS_LINKED_TO_DELIVERY";
};

export type OrderFlags = {
  hasPayments: boolean;
  hasNonCancelledDeliveryLinks: boolean;
};

export type OrderDetailFull = Omit<OrderDetail, "items"> & {
  store: { id: string; name: string; slug: string };
  items: OrderItemWithDeliveryState[];
  eligibility: OrderEligibility;
  flags: OrderFlags;
};

/**
 * Minimal order lookup for the shell header (title / breadcrumb) on the detail-segment layout.
 * Selects only the human-readable id so it can run above the detail-route Suspense boundary
 * without duplicating the heavy detail query.
 */
export async function getOrderHeader(
  orderId: string,
  userId: string,
): Promise<{ id: string; humanReadableId: string } | null> {
  return prisma.order.findFirst({
    where: { id: orderId, userId },
    select: { id: true, humanReadableId: true },
  });
}

export async function getOrderById(orderId: string, userId: string): Promise<OrderDetail | null> {
  const row = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      humanReadableId: true,
      storeId: true,
      store: { select: { name: true } },
      orderDate: true,
      expectedDeliveryFrom: true,
      expectedDeliveryTo: true,
      currencyCode: true,
      exchangeRate: true,
      needsExchangeRateUpdate: true,
      totalCost: true,
      note: true,
      status: true,
      cancellationReason: true,
      createdAt: true,
      updatedAt: true,
      items: {
        select: {
          id: true,
          name: true,
          quantity: true,
          unitPrice: true,
          productTypeKey: true,
          position: true,
        },
        orderBy: { position: "asc" },
      },
      payments: {
        select: { id: true, amount: true, paymentDate: true },
        orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      },
      history: {
        select: { id: true, eventType: true, metadata: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!row) return null;

  const { paidAmount, remainingAmount, paymentPercentage } = calculatePaymentSummary(row.totalCost, row.payments);

  return {
    id: row.id,
    humanReadableId: row.humanReadableId,
    storeId: row.storeId,
    storeName: row.store.name,
    orderDate: row.orderDate,
    expectedDeliveryFrom: row.expectedDeliveryFrom,
    expectedDeliveryTo: row.expectedDeliveryTo,
    currencyCode: row.currencyCode,
    exchangeRate: row.exchangeRate ? Number(row.exchangeRate) : null,
    needsExchangeRateUpdate: row.needsExchangeRateUpdate,
    totalCost: row.totalCost,
    note: row.note,
    cancellationReason: row.cancellationReason,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    hasUnpaidBalance: deriveHasUnpaidBalance(row.totalCost, paidAmount),
    paidAmount,
    remainingAmount,
    paymentPercentage,
    items: row.items,
    payments: row.payments,
    history: row.history,
  };
}

function deriveItemDeliveryState(
  deliveryItems: Array<{ delivery: { status: DeliveryStatus } }>,
  ownDeliveryState: OrderItemDeliveryStatePrisma,
): ItemDeliveryState {
  if (deliveryItems.length > 0) {
    const hasDelivered = deliveryItems.some((d) => d.delivery.status === DeliveryStatus.DELIVERED);
    if (hasDelivered) return "delivered";
    return "in_transit";
  }
  if (ownDeliveryState === "ARRIVED_AT_STORE") return "arrived_at_store";
  return "open";
}

export async function getOrderDetail(orderId: string, userId: string): Promise<OrderDetailFull | null> {
  const row = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      humanReadableId: true,
      storeId: true,
      store: { select: { id: true, name: true, slug: true } },
      orderDate: true,
      expectedDeliveryFrom: true,
      expectedDeliveryTo: true,
      currencyCode: true,
      exchangeRate: true,
      needsExchangeRateUpdate: true,
      totalCost: true,
      note: true,
      status: true,
      cancellationReason: true,
      createdAt: true,
      updatedAt: true,
      items: {
        select: {
          id: true,
          name: true,
          quantity: true,
          unitPrice: true,
          productTypeKey: true,
          position: true,
          deliveryState: true,
          deliveryItems: {
            select: { delivery: { select: { status: true } } },
            where: { delivery: { status: { not: DeliveryStatus.CANCELLED } } },
          },
        },
        orderBy: { position: "asc" },
      },
      payments: {
        select: { id: true, amount: true, paymentDate: true },
        orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      },
      history: {
        select: { id: true, eventType: true, metadata: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!row) return null;

  const { paidAmount, remainingAmount, paymentPercentage } = calculatePaymentSummary(row.totalCost, row.payments);

  const itemsWithState: OrderItemWithDeliveryState[] = row.items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    productTypeKey: item.productTypeKey,
    position: item.position,
    deliveryState: deriveItemDeliveryState(item.deliveryItems, item.deliveryState),
  }));

  const hasNonCancelledDeliveryLinks = itemsWithState.some(
    (item) => item.deliveryState === "in_transit" || item.deliveryState === "delivered",
  );

  const eligibility: OrderEligibility = {
    canDelete: !hasNonCancelledDeliveryLinks,
    canCancel: !hasNonCancelledDeliveryLinks,
    blockReason: hasNonCancelledDeliveryLinks ? "ITEMS_LINKED_TO_DELIVERY" : undefined,
  };

  const flags: OrderFlags = {
    hasPayments: row.payments.length > 0,
    hasNonCancelledDeliveryLinks,
  };

  return {
    id: row.id,
    humanReadableId: row.humanReadableId,
    storeId: row.storeId,
    store: row.store,
    storeName: row.store.name,
    orderDate: row.orderDate,
    expectedDeliveryFrom: row.expectedDeliveryFrom,
    expectedDeliveryTo: row.expectedDeliveryTo,
    currencyCode: row.currencyCode,
    exchangeRate: row.exchangeRate ? Number(row.exchangeRate) : null,
    needsExchangeRateUpdate: row.needsExchangeRateUpdate,
    totalCost: row.totalCost,
    note: row.note,
    cancellationReason: row.cancellationReason,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    hasUnpaidBalance: deriveHasUnpaidBalance(row.totalCost, paidAmount),
    paidAmount,
    remainingAmount,
    paymentPercentage,
    items: itemsWithState,
    payments: row.payments,
    history: row.history,
    eligibility,
    flags,
  };
}

export type OrdersListPageItem = {
  id: string;
  humanReadableId: string;
  orderDate: Date;
  expectedDeliveryFrom: Date | null;
  expectedDeliveryTo: Date | null;
  currencyCode: string;
  exchangeRate: number | null;
  totalCost: number;
  status: OrderStatus;
  store: { id: string; name: string; slug: string };
  itemCount: number;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    productTypeKey: string | null;
    unitPrice: number | null;
    deliveryState: ItemDeliveryState;
  }>;
  paidAmount: number;
  paymentPercentage: number;
  hasUnpaidBalance: boolean;
};

export { ORDER_LIST_SORT_VALUES } from "@/lib/orders/orderListSort";
export type { OrderListPaymentState, OrderListSort } from "@/lib/orders/orderListSort";

export type OrdersListPageFilters = {
  nameQuery?: string;
  productTypeKeys?: string[];
  storeId?: string;
  statuses?: OrderStatus[];
  paymentStates?: OrderListPaymentState[];
  dateFrom?: Date;
  dateTo?: Date;
  /** Expected-delivery range overlap (any part of the order's window inside the range). */
  deliveryFrom?: Date;
  deliveryTo?: Date;
  /**
   * "Por recibir": orders whose expectedDeliveryFrom <= today and are still pending
   * (status NOT IN COMPLETED/CANCELLED). Includes orders past their window. Mutually
   * exclusive with `deliveryFrom`/`deliveryTo` (caller is expected to enforce that).
   */
  deliveryOverdueOnly?: boolean;
  /** When true, restrict to orders eligible for FX reconciliation (foreign currency, current-month). */
  fxPendingOnly?: boolean;
  /** User's base currency, required for `fxPendingOnly` and `pendingFxCount`. */
  baseCurrencyCode?: string | null;
  sort?: OrderListSort;
  page: number;
  pageSize: number;
};

export type OrdersListPageResult = {
  orders: OrdersListPageItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  pendingFxCount: number;
};

function buildFxPendingWhere(userId: string, baseCurrencyCode: string | null | undefined) {
  if (!baseCurrencyCode) return null;
  // An order is FX-pending when it was explicitly flagged on a base-currency change
  // (`needsExchangeRateUpdate`) and still holds a foreign currency. Cancelled orders are
  // excluded; reactivating one re-surfaces it because the flag is preserved.
  return {
    userId,
    needsExchangeRateUpdate: true,
    status: { not: "CANCELLED" as OrderStatus },
    currencyCode: { not: baseCurrencyCode },
  };
}

export async function getOrdersList(userId: string, filters: OrdersListPageFilters): Promise<OrdersListPageResult> {
  const {
    nameQuery,
    productTypeKeys,
    storeId,
    statuses,
    paymentStates,
    dateFrom,
    dateTo,
    deliveryFrom,
    deliveryTo,
    deliveryOverdueOnly,
    fxPendingOnly,
    baseCurrencyCode,
    sort = "recent",
    page,
    pageSize,
  } = filters;
  const now = new Date();

  const itemConditions: Array<Record<string, unknown>> = [];
  if (nameQuery && nameQuery.trim()) {
    const trimmed = nameQuery.trim();
    itemConditions.push({
      OR: [
        { name: { contains: trimmed, mode: "insensitive" } },
        { order: { is: { humanReadableId: { contains: trimmed, mode: "insensitive" } } } },
      ],
    });
  }
  if (productTypeKeys && productTypeKeys.length > 0) {
    itemConditions.push({ productTypeKey: { in: productTypeKeys } });
  }

  const trimmedQuery = nameQuery?.trim();
  const fxFilterBase = fxPendingOnly && baseCurrencyCode ? { currencyCode: { not: baseCurrencyCode } } : {};
  const fxFilterFlag = fxPendingOnly && baseCurrencyCode ? { needsExchangeRateUpdate: true } : {};

  // Delivery filter — "Por recibir" wins over an explicit range when both are present.
  // `deliveryOverdueOnly`: window already started (`expectedDeliveryFrom <= today`) and
  // order still pending. Range mode: overlap with [from, to].
  const deliveryWhere: Record<string, unknown> = {};
  // When the user already filters by status, intersect with the explicit set (no implicit
  // notIn). Otherwise apply the "still pending" constraint inherent to the toggle.
  const hasExplicitStatuses = statuses && statuses.length > 0;
  if (deliveryOverdueOnly) {
    deliveryWhere.expectedDeliveryFrom = { lte: now };
    if (!hasExplicitStatuses) {
      deliveryWhere.status = { notIn: ["COMPLETED", "CANCELLED"] as OrderStatus[] };
    }
  } else if (deliveryFrom || deliveryTo) {
    // Overlap: order window touches the requested range when
    //   order.expectedDeliveryFrom <= range.to AND order.expectedDeliveryTo >= range.from.
    // Null endpoints mean "open-ended" on that side.
    const conditions: Array<Record<string, unknown>> = [];
    if (deliveryTo) conditions.push({ expectedDeliveryFrom: { lte: deliveryTo } });
    if (deliveryFrom) conditions.push({ expectedDeliveryTo: { gte: deliveryFrom } });
    if (conditions.length > 0) Object.assign(deliveryWhere, { AND: conditions });
  }

  const baseFilters: Record<string, unknown> = {
    userId,
    ...(storeId ? { storeId } : {}),
    ...(statuses && statuses.length > 0 ? { status: { in: statuses } } : {}),
    ...(dateFrom || dateTo
      ? {
          orderDate: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }
      : {}),
    ...fxFilterBase,
    ...fxFilterFlag,
    ...deliveryWhere,
  };

  const matchAny: Array<Record<string, unknown>> = [];
  if (itemConditions.length > 0) {
    matchAny.push({ items: { some: { AND: itemConditions } } });
  }
  if (trimmedQuery) {
    matchAny.push({ humanReadableId: { contains: trimmedQuery, mode: "insensitive" } });
  }

  const where = matchAny.length > 0 ? { ...baseFilters, OR: matchAny } : baseFilters;

  const usePostQuerySort = sort === "payment-asc";
  const orderBy = resolveOrderBy(sort);

  const select = {
    id: true,
    humanReadableId: true,
    orderDate: true,
    expectedDeliveryFrom: true,
    expectedDeliveryTo: true,
    currencyCode: true,
    exchangeRate: true,
    totalCost: true,
    status: true,
    store: { select: { id: true, name: true, slug: true } },
    items: {
      select: {
        id: true,
        name: true,
        quantity: true,
        productTypeKey: true,
        unitPrice: true,
        position: true,
        deliveryState: true,
        deliveryItems: {
          select: { delivery: { select: { status: true } } },
          where: { delivery: { status: { not: DeliveryStatus.CANCELLED } } },
        },
      },
      orderBy: { position: "asc" } as const,
    },
    payments: { select: { amount: true } },
  } as const;

  const fxWhere = buildFxPendingWhere(userId, baseCurrencyCode ?? null);

  // The `payment-asc` sort requires the computed paymentPercentage. Prisma cannot orderBy a
  // derived ratio, so for that case we fetch the full filtered set (bounded by collector usage)
  // and sort + paginate in memory. Other sorts use native orderBy + skip/take.
  const [rows, totalCount, pendingFxCount] = await Promise.all([
    usePostQuerySort
      ? prisma.order.findMany({ where, select, orderBy: { orderDate: "desc" }, take: 1000 })
      : prisma.order.findMany({
          where,
          select,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
    prisma.order.count({ where }),
    fxWhere ? prisma.order.count({ where: fxWhere }) : Promise.resolve(0),
  ]);

  const allMapped: OrdersListPageItem[] = rows.map((row) => {
    const { paidAmount, paymentPercentage } = calculatePaymentSummary(row.totalCost, row.payments);
    return {
      id: row.id,
      humanReadableId: row.humanReadableId,
      orderDate: row.orderDate,
      expectedDeliveryFrom: row.expectedDeliveryFrom,
      expectedDeliveryTo: row.expectedDeliveryTo,
      currencyCode: row.currencyCode,
      exchangeRate: row.exchangeRate ? Number(row.exchangeRate) : null,
      totalCost: row.totalCost,
      status: row.status,
      store: row.store,
      itemCount: row.items.length,
      items: row.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        productTypeKey: item.productTypeKey,
        unitPrice: item.unitPrice,
        deliveryState: deriveItemDeliveryState(item.deliveryItems, item.deliveryState),
      })),
      paidAmount,
      paymentPercentage,
      hasUnpaidBalance: deriveHasUnpaidBalance(row.totalCost, paidAmount),
    };
  });

  const filteredByPayment =
    paymentStates && paymentStates.length > 0
      ? allMapped.filter((order) => paymentStates.some((state) => matchesPaymentState(order, state)))
      : allMapped;

  let orders = filteredByPayment;
  if (usePostQuerySort) {
    orders = [...filteredByPayment].sort((a, b) => a.paymentPercentage - b.paymentPercentage);
    const offset = (page - 1) * pageSize;
    orders = orders.slice(offset, offset + pageSize);
  }

  const effectiveTotal = paymentStates && paymentStates.length > 0 ? filteredByPayment.length : totalCount;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));

  return { orders, totalCount: effectiveTotal, totalPages, page, pageSize, pendingFxCount };
}

function resolveOrderBy(sort: OrderListSort) {
  switch (sort) {
    case "oldest":
      return { orderDate: "asc" as const };
    case "store-asc":
      return { store: { name: "asc" as const } };
    case "total-desc":
      return { totalCost: "desc" as const };
    case "payment-asc":
    case "recent":
    default:
      return { orderDate: "desc" as const };
  }
}

function matchesPaymentState(order: OrdersListPageItem, state: OrderListPaymentState): boolean {
  const isOverdue = order.expectedDeliveryTo
    ? order.expectedDeliveryTo.getTime() < Date.now() && order.status !== "COMPLETED" && order.status !== "CANCELLED"
    : false;
  switch (state) {
    case "paid":
      return order.paymentPercentage >= 100;
    case "partial":
      return order.paymentPercentage > 0 && order.paymentPercentage < 100;
    case "unpaid":
      return order.paymentPercentage === 0;
    case "overdue":
      return isOverdue;
    default:
      return false;
  }
}

export async function listOrders(userId: string, filters: OrderListFilters = {}): Promise<OrderListItem[]> {
  const rows = await prisma.order.findMany({
    where: {
      userId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.storeId ? { storeId: filters.storeId } : {}),
    },
    select: {
      id: true,
      humanReadableId: true,
      storeId: true,
      store: { select: { name: true } },
      orderDate: true,
      expectedDeliveryFrom: true,
      expectedDeliveryTo: true,
      currencyCode: true,
      exchangeRate: true,
      needsExchangeRateUpdate: true,
      totalCost: true,
      status: true,
      createdAt: true,
    },
    orderBy: { orderDate: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    humanReadableId: row.humanReadableId,
    storeId: row.storeId,
    storeName: row.store.name,
    orderDate: row.orderDate,
    expectedDeliveryFrom: row.expectedDeliveryFrom,
    expectedDeliveryTo: row.expectedDeliveryTo,
    currencyCode: row.currencyCode,
    exchangeRate: row.exchangeRate ? Number(row.exchangeRate) : null,
    totalCost: row.totalCost,
    status: row.status,
    createdAt: row.createdAt,
  }));
}

import { prisma } from "@/lib/prisma";
import { deriveHasUnpaidBalance } from "@/lib/orders/orderState";
import { calculatePaymentSummary } from "@/lib/orders/paymentSummary";
import type { ItemDeliveryState } from "@/lib/orders/orderState";
import { DeliveryStatus, type OrderStatus } from "../../../../generated/prisma/client";

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
      totalCost: true,
      note: true,
      status: true,
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
    totalCost: row.totalCost,
    note: row.note,
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

function deriveItemDeliveryState(deliveryItems: Array<{ delivery: { status: DeliveryStatus } }>): ItemDeliveryState {
  if (deliveryItems.length === 0) return "open";
  const hasDelivered = deliveryItems.some((d) => d.delivery.status === DeliveryStatus.DELIVERED);
  if (hasDelivered) return "delivered";
  return "in_transit";
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
      totalCost: true,
      note: true,
      status: true,
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
    deliveryState: deriveItemDeliveryState(item.deliveryItems),
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
    totalCost: row.totalCost,
    note: row.note,
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
  orderDate: Date;
  expectedDeliveryFrom: Date | null;
  expectedDeliveryTo: Date | null;
  currencyCode: string;
  totalCost: number;
  status: OrderStatus;
  store: { id: string; name: string; slug: string };
  itemCount: number;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    deliveryState: ItemDeliveryState;
  }>;
  paidAmount: number;
  paymentPercentage: number;
  hasUnpaidBalance: boolean;
};

export type OrdersListPageFilters = {
  nameQuery?: string;
  productTypeKeys?: string[];
  storeId?: string;
  statuses?: OrderStatus[];
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  pageSize: number;
};

export type OrdersListPageResult = {
  orders: OrdersListPageItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

export async function getOrdersList(userId: string, filters: OrdersListPageFilters): Promise<OrdersListPageResult> {
  const { nameQuery, productTypeKeys, storeId, statuses, dateFrom, dateTo, page, pageSize } = filters;

  const itemConditions: Array<Record<string, unknown>> = [];
  if (nameQuery && nameQuery.trim()) {
    itemConditions.push({ name: { contains: nameQuery.trim(), mode: "insensitive" } });
  }
  if (productTypeKeys && productTypeKeys.length > 0) {
    itemConditions.push({ productTypeKey: { in: productTypeKeys } });
  }

  const where = {
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
    ...(itemConditions.length > 0 ? { items: { some: { AND: itemConditions } } } : {}),
  };

  const [rows, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        orderDate: true,
        expectedDeliveryFrom: true,
        expectedDeliveryTo: true,
        currencyCode: true,
        totalCost: true,
        status: true,
        store: { select: { id: true, name: true, slug: true } },
        items: {
          select: {
            id: true,
            name: true,
            quantity: true,
            position: true,
            deliveryItems: {
              select: { delivery: { select: { status: true } } },
              where: { delivery: { status: { not: DeliveryStatus.CANCELLED } } },
            },
          },
          orderBy: { position: "asc" },
        },
        payments: { select: { amount: true } },
      },
      orderBy: { orderDate: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  const orders: OrdersListPageItem[] = rows.map((row) => {
    const { paidAmount, paymentPercentage } = calculatePaymentSummary(row.totalCost, row.payments);
    return {
      id: row.id,
      orderDate: row.orderDate,
      expectedDeliveryFrom: row.expectedDeliveryFrom,
      expectedDeliveryTo: row.expectedDeliveryTo,
      currencyCode: row.currencyCode,
      totalCost: row.totalCost,
      status: row.status,
      store: row.store,
      itemCount: row.items.length,
      items: row.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        deliveryState: deriveItemDeliveryState(item.deliveryItems),
      })),
      paidAmount,
      paymentPercentage,
      hasUnpaidBalance: deriveHasUnpaidBalance(row.totalCost, paidAmount),
    };
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return { orders, totalCount, totalPages, page, pageSize };
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

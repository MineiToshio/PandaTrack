import { prisma } from "@/lib/prisma";
import { deriveHasUnpaidBalance } from "@/lib/orders/orderState";
import type { OrderStatus } from "../../../../generated/prisma/client";

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

export type OrderDetail = OrderListItem & {
  note: string | null;
  hasUnpaidBalance: boolean;
  items: OrderItem[];
  payments: Array<{
    id: string;
    amount: number;
    paymentDate: Date;
  }>;
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
        orderBy: { paymentDate: "asc" },
      },
      history: {
        select: { id: true, eventType: true, metadata: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!row) return null;

  const paymentsSum = row.payments.reduce((sum, p) => sum + p.amount, 0);

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
    hasUnpaidBalance: deriveHasUnpaidBalance(row.totalCost, paymentsSum),
    items: row.items,
    payments: row.payments,
    history: row.history,
  };
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

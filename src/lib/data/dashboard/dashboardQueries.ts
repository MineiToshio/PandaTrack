import { prisma } from "@/lib/prisma";
import { getCollectorPreferencesSnapshot } from "@/queries/userSettings";
import { buildDashboardData } from "./dashboardAggregation";
import type { DashboardData, DashboardOrderInput, DashboardRange } from "./dashboardTypes";

/**
 * Loads every order the collector owns, with the items and payments the dashboard aggregates.
 * This is the single read pass shared by all zones, so no zone issues its own broad scan.
 */
async function fetchDashboardOrders(userId: string): Promise<DashboardOrderInput[]> {
  const rows = await prisma.order.findMany({
    where: { userId },
    select: {
      id: true,
      humanReadableId: true,
      orderDate: true,
      expectedDeliveryFrom: true,
      expectedDeliveryTo: true,
      currencyCode: true,
      exchangeRate: true,
      needsExchangeRateUpdate: true,
      totalCost: true,
      status: true,
      store: { select: { id: true, name: true } },
      items: {
        select: { quantity: true, productTypeKey: true, unitPrice: true, deliveryState: true },
      },
      payments: { select: { amount: true, paymentDate: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    humanReadableId: row.humanReadableId,
    orderDate: row.orderDate,
    expectedDeliveryFrom: row.expectedDeliveryFrom,
    expectedDeliveryTo: row.expectedDeliveryTo,
    currencyCode: row.currencyCode,
    exchangeRate: row.exchangeRate ? Number(row.exchangeRate) : null,
    needsExchangeRateUpdate: row.needsExchangeRateUpdate,
    totalCost: row.totalCost,
    status: row.status,
    store: { id: row.store.id, name: row.store.name },
    items: row.items.map((item) => ({
      quantity: item.quantity,
      productTypeKey: item.productTypeKey,
      unitPrice: item.unitPrice,
      deliveryState: item.deliveryState,
    })),
    payments: row.payments.map((payment) => ({ amount: payment.amount, paymentDate: payment.paymentDate })),
  }));
}

/**
 * Read-only dashboard entry point (FR-06-14). Resolves the collector's currency/budget/timezone
 * context and their orders, then computes the single base-currency, period-aware `DashboardData`
 * payload. `range` scopes only the trend series (FR-06-12); when omitted it defaults to the last
 * six months. Current-period metrics are always fixed to the active period, independent of `range`.
 */
export async function getDashboardData(userId: string, range?: DashboardRange): Promise<DashboardData> {
  const [preferences, orders] = await Promise.all([
    getCollectorPreferencesSnapshot(userId),
    fetchDashboardOrders(userId),
  ]);

  return buildDashboardData({
    orders,
    now: new Date(),
    timezone: preferences?.timezone ?? null,
    baseCurrencyCode: preferences?.baseCurrencyCode ?? null,
    budgetAmountMinor: preferences?.budgetAmount ?? null,
    budgetResetDayOfMonth: preferences?.budgetResetDayOfMonth ?? null,
    range,
  });
}

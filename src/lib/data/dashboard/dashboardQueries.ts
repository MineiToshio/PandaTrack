import { prisma } from "@/lib/prisma";
import { getCollectorPreferencesSnapshot } from "@/queries/userSettings";
import { DeliveryStatus } from "../../../../generated/prisma/client";
import { buildDashboardData } from "./dashboardAggregation";
import { resolveDashboardRange } from "./dashboardPeriods";
import type { DashboardData, DashboardOrderInput, DashboardRangeSelection } from "./dashboardTypes";

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
      store: { select: { id: true, name: true, slug: true } },
      items: {
        select: {
          quantity: true,
          productTypeKey: true,
          unitPrice: true,
          deliveryState: true,
          // A dispatched delivery is the only dated evidence that an item had reached the store,
          // so it anchors arrival punctuality and the arrived series (FR-06-17, FR-06-09).
          deliveryItems: {
            select: { delivery: { select: { deliveryDate: true } } },
            where: { delivery: { status: { not: DeliveryStatus.CANCELLED } } },
          },
        },
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
    store: { id: row.store.id, name: row.store.name, slug: row.store.slug },
    items: row.items.map((item) => ({
      quantity: item.quantity,
      productTypeKey: item.productTypeKey,
      unitPrice: item.unitPrice,
      deliveryState: item.deliveryState,
      deliveryDates: item.deliveryItems.map((link) => link.delivery.deliveryDate),
    })),
    payments: row.payments.map((payment) => ({ amount: payment.amount, paymentDate: payment.paymentDate })),
  }));
}

/** Earliest instant the collector has any recorded activity, used to bound the `all` range preset. */
function findEarliestActivity(orders: DashboardOrderInput[]): Date | null {
  let earliest: number | null = null;
  for (const order of orders) {
    const candidates = [order.orderDate, ...order.payments.map((payment) => payment.paymentDate)];
    for (const candidate of candidates) {
      const time = candidate.getTime();
      if (earliest === null || time < earliest) {
        earliest = time;
      }
    }
  }
  return earliest === null ? null : new Date(earliest);
}

/**
 * Read-only dashboard entry point (FR-06-14). Resolves the collector's currency/budget/timezone
 * context and their orders, then computes the single base-currency, period-aware `DashboardData`
 * payload. `selection` scopes only the trend series (FR-06-12); when omitted it defaults to the last
 * six months. Current-period metrics are always fixed to the active period, independent of it.
 *
 * The selection is resolved here rather than by the caller because presets depend on the collector's
 * timezone and the `all` preset depends on how far back their data goes.
 */
export async function getDashboardData(userId: string, selection?: DashboardRangeSelection): Promise<DashboardData> {
  const [preferences, orders] = await Promise.all([
    getCollectorPreferencesSnapshot(userId),
    fetchDashboardOrders(userId),
  ]);

  const now = new Date();
  const timezone = preferences?.timezone ?? null;
  const range = selection ? resolveDashboardRange(selection, now, timezone, findEarliestActivity(orders)) : undefined;

  return buildDashboardData({
    orders,
    now,
    timezone,
    baseCurrencyCode: preferences?.baseCurrencyCode ?? null,
    budgetAmountMinor: preferences?.budgetAmount ?? null,
    budgetResetDayOfMonth: preferences?.budgetResetDayOfMonth ?? null,
    range,
  });
}

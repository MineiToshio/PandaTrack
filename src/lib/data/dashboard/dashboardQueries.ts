import { prisma } from "@/lib/prisma";
import { getCollectorPreferencesSnapshot } from "@/lib/data/user-settings/userSettingsQueries";
import { openBalanceMinorByOrderId } from "@/lib/data/orders/orderOpenBalance";
import { DeliveryStatus } from "../../../../generated/prisma/client";
import { buildDashboardData } from "./dashboardAggregation";
import { resolveDashboardRange } from "./dashboardPeriods";
import type {
  DashboardData,
  DashboardDeliveryInput,
  DashboardOrderInput,
  DashboardRangeSelection,
} from "./dashboardTypes";

/**
 * Loads every order the collector owns, with the items and payments the dashboard aggregates.
 * This is the single read pass shared by all zones, so no zone issues its own broad scan.
 *
 * Also resolves each order's canonical `openBalanceMinor` (`BR-06-08`, `FRD-05 · BR-05-32`) through
 * the shared `openBalanceMinorByOrderId` batch helper (`FRD-05 · BP-01 · WO-10`), one extra
 * `groupBy` query regardless of how many orders the collector has, so this module never carries a
 * second balance derivation (`FR-06-27`, `ADR 0033`/`0034`). `storeAccountAdjustmentLines` is
 * fetched separately, with its write date, purely so the outstanding-debt trend (`FR-06-21`) can
 * bucket a write-off by the month it was written, exactly like a payment; every other figure reads
 * the already-summed `openBalanceMinor` instead of these raw lines.
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
      exchangeRateBaseCode: true,
      totalCost: true,
      allocatedAmountMinor: true,
      status: true,
      store: { select: { id: true, name: true, slug: true, logoUrl: true } },
      items: {
        select: {
          id: true,
          name: true,
          quantity: true,
          productTypeKey: true,
          unitPrice: true,
          deliveryState: true,
          // A dispatched delivery is the only dated evidence that an item had reached the store,
          // so it anchors arrival punctuality and the arrived series.
          deliveryItems: {
            select: { delivery: { select: { deliveryDate: true } } },
            where: { delivery: { status: { not: DeliveryStatus.CANCELLED } } },
          },
        },
      },
      // Money reaches the dashboard through this order's own allocations, so a payment shared with
      // other orders contributes only the slice declared here, never its full amount. The date
      // comes from the parent payment, which is where it lives.
      paymentAllocations: {
        select: { amountMinor: true, payment: { select: { paymentDate: true } } },
      },
      storeAccountAdjustmentLines: {
        select: { amountMinor: true, createdAt: true },
      },
    },
  });

  const openBalanceByOrderId = await openBalanceMinorByOrderId(
    prisma,
    userId,
    rows.map((row) => ({ id: row.id, totalCost: row.totalCost, allocatedAmountMinor: row.allocatedAmountMinor })),
  );

  return rows.map((row) => {
    const openBalanceMinor = openBalanceByOrderId.get(row.id);
    // The batch helper guarantees an entry per input order (see its own module doc). Falling back
    // to the gross `totalCost - allocatedAmountMinor` here would silently reintroduce the older,
    // adjustment-blind formula this work order retires, which is exactly the kind of quiet
    // degradation `BR-06-08` forbids, so a miss is a programming error, not a figure to soften.
    if (openBalanceMinor === undefined) {
      throw new Error(`openBalanceMinorByOrderId missing entry for order ${row.id}`);
    }
    return {
      id: row.id,
      humanReadableId: row.humanReadableId,
      orderDate: row.orderDate,
      expectedDeliveryFrom: row.expectedDeliveryFrom,
      expectedDeliveryTo: row.expectedDeliveryTo,
      currencyCode: row.currencyCode,
      exchangeRate: row.exchangeRate ? Number(row.exchangeRate) : null,
      exchangeRateBaseCode: row.exchangeRateBaseCode,
      totalCost: row.totalCost,
      status: row.status,
      store: { id: row.store.id, name: row.store.name, slug: row.store.slug, logoUrl: row.store.logoUrl },
      items: row.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        productTypeKey: item.productTypeKey,
        unitPrice: item.unitPrice,
        deliveryState: item.deliveryState,
        deliveryDates: item.deliveryItems.map((link) => link.delivery.deliveryDate),
      })),
      payments: row.paymentAllocations.map((allocation) => ({
        amount: allocation.amountMinor,
        paymentDate: allocation.payment.paymentDate,
      })),
      openBalanceMinor,
      adjustmentLines: row.storeAccountAdjustmentLines.map((line) => ({
        amountMinor: line.amountMinor,
        createdAt: line.createdAt,
      })),
    };
  });
}

/**
 * Loads every delivery the collector owns, with the fields the spend rollup needs (`FR-06-07`,
 * `FR-06-08`, `BR-06-04`). Cancelled deliveries are still fetched (dashboard-wide convention: filter
 * cancelled state in the aggregation layer, not the query) rather than excluded here.
 */
async function fetchDashboardDeliveries(userId: string): Promise<DashboardDeliveryInput[]> {
  const rows = await prisma.delivery.findMany({
    where: { userId },
    select: {
      id: true,
      cost: true,
      currencyCode: true,
      exchangeRate: true,
      exchangeRateBaseCode: true,
      deliveryDate: true,
      status: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    cost: row.cost,
    currencyCode: row.currencyCode,
    exchangeRate: row.exchangeRate ? Number(row.exchangeRate) : null,
    exchangeRateBaseCode: row.exchangeRateBaseCode,
    deliveryDate: row.deliveryDate,
    status: row.status,
  }));
}

/** Earliest instant the collector has any recorded activity, used to bound the `all` range preset. */
function findEarliestActivity(orders: DashboardOrderInput[], deliveries: DashboardDeliveryInput[]): Date | null {
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
  for (const delivery of deliveries) {
    const time = delivery.deliveryDate.getTime();
    if (earliest === null || time < earliest) {
      earliest = time;
    }
  }
  return earliest === null ? null : new Date(earliest);
}

/**
 * Read-only dashboard entry point. Resolves the collector's currency/budget/timezone
 * context and their orders, then computes the single base-currency, period-aware `DashboardData`
 * payload. `selection` scopes only the trend series; when omitted it defaults to the last
 * six months. Current-period metrics are always fixed to the active period, independent of it.
 *
 * The selection is resolved here rather than by the caller because presets depend on the collector's
 * timezone and the `all` preset depends on how far back their data goes.
 */
export async function getDashboardData(userId: string, selection?: DashboardRangeSelection): Promise<DashboardData> {
  const [preferences, orders, deliveries] = await Promise.all([
    getCollectorPreferencesSnapshot(userId),
    fetchDashboardOrders(userId),
    fetchDashboardDeliveries(userId),
  ]);

  const now = new Date();
  const timezone = preferences?.timezone ?? null;
  const range = selection
    ? resolveDashboardRange(selection, now, timezone, findEarliestActivity(orders, deliveries))
    : undefined;

  return buildDashboardData({
    orders,
    deliveries,
    now,
    timezone,
    baseCurrencyCode: preferences?.baseCurrencyCode ?? null,
    budgetAmountMinor: preferences?.budgetAmount ?? null,
    budgetResetDayOfMonth: preferences?.budgetResetDayOfMonth ?? null,
    range,
  });
}

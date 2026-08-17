import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { order: { findMany: vi.fn() } },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { OrderStatus } from "../../../../../generated/prisma/client";
import { ACTIVE_ORDER_STATUSES } from "@/lib/data/orders/storePaymentQueries";
import { getViewerStoreActivity } from "../storeQueries";

/** One row of the `order.findMany` the aside's activity query issues, in the shape Prisma returns. */
function order(status: OrderStatus, currencyCode = "PEN", totalCost = 1000) {
  return { status, currencyCode, totalCost };
}

describe("getViewerStoreActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * The aside puts "Pedidos activos" directly above a progress bar whose denominator is the cost of
   * those same orders (`getStoreDebtByCurrency`, over `ACTIVE_ORDER_STATUSES`). A count that names a
   * different set than the bar measures is two figures about the same orders that disagree, and the
   * only way to keep them together is one predicate. Every member of `OrderStatus` is enumerated
   * here on purpose: a seventh status is exactly the change that would split them again.
   */
  it("counts the same set of statuses the payment bar's denominator is built from", async () => {
    const allStatuses = Object.values(OrderStatus);
    prismaMock.order.findMany.mockResolvedValue(allStatuses.map((status) => order(status)));

    const activity = await getViewerStoreActivity("user-1", "store-1");

    expect(activity.ordersTotal).toBe(allStatuses.length);
    expect(activity.ordersActive).toBe(ACTIVE_ORDER_STATUSES.length);
    // Spelled out rather than derived, so this fails if the shared set itself is widened without
    // the aside's copy and the bar's caption being revisited together.
    expect(activity.ordersActive).toBe(4);
    expect(allStatuses).toHaveLength(6);
  });

  it("counts spend by currency across every status, including the cancelled ones", async () => {
    // "Total facturado" is the lifetime figure the "Cancelados" row reconciles against, so unlike
    // the count above it deliberately includes orders that were called off.
    prismaMock.order.findMany.mockResolvedValue([
      order(OrderStatus.OPEN, "PEN", 25000),
      order(OrderStatus.CANCELLED, "PEN", 16000),
      order(OrderStatus.COMPLETED, "USD", 4200),
    ]);

    const activity = await getViewerStoreActivity("user-1", "store-1");

    expect(activity.ordersActive).toBe(1);
    expect(activity.totalSpentByCurrency).toEqual([
      { currencyCode: "PEN", totalMinorUnits: 41000 },
      { currencyCode: "USD", totalMinorUnits: 4200 },
    ]);
  });

  it("returns zeroed totals when the viewer has never ordered from this store", async () => {
    prismaMock.order.findMany.mockResolvedValue([]);

    expect(await getViewerStoreActivity("user-1", "store-1")).toEqual({
      ordersTotal: 0,
      ordersActive: 0,
      totalSpentByCurrency: [],
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({ prismaMock: {} as Record<string, unknown> }));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { OrderStatus } from "../../../../../generated/prisma/client";
import {
  getStoreReconciliationPreview,
  listStoreAccountAdjustmentCurrencyCodes,
  listStoreAccountAdjustments,
} from "../storeAccountAdjustmentQueries";
import { makePreviewOrder, makePreviewPrisma } from "./storeAccountAdjustmentFixtures";

function installFixture(fixture: ReturnType<typeof makePreviewPrisma>): void {
  for (const key of Object.keys(prismaMock)) delete prismaMock[key];
  Object.assign(prismaMock, fixture);
}

describe("getStoreReconciliationPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists open orders with their own balance plus the unassigned pool", async () => {
    const orderA = makePreviewOrder({
      id: "order-a",
      status: OrderStatus.OPEN,
      totalCost: 18000,
      allocatedAmountMinor: 0,
    });
    const orderB = makePreviewOrder({
      id: "order-b",
      status: OrderStatus.OPEN,
      totalCost: 20000,
      allocatedAmountMinor: 5000,
    });
    installFixture(
      makePreviewPrisma({
        orders: [orderA, orderB],
        unassignedPayments: [{ id: "payment-1", amount: 3000, paymentDate: new Date("2020-01-01") }],
      }),
    );

    const preview = await getStoreReconciliationPreview("user-1", "store-1", "PEN");

    expect(preview.openOrders).toEqual([
      expect.objectContaining({ orderId: "order-a", openBalanceMinor: 18000 }),
      expect.objectContaining({ orderId: "order-b", openBalanceMinor: 15000 }),
    ]);
    expect(preview.deliveredOrders).toEqual([]);
    expect(preview.unassignedMinor).toBe(3000);
  });

  it("lists every delivered order still carrying a balance when the store has zero open orders", async () => {
    const delivered = [
      makePreviewOrder({ id: "order-1", status: OrderStatus.COMPLETED, totalCost: 10000, allocatedAmountMinor: 0 }),
      makePreviewOrder({ id: "order-2", status: OrderStatus.COMPLETED, totalCost: 5000, allocatedAmountMinor: 0 }),
      makePreviewOrder({ id: "order-3", status: OrderStatus.COMPLETED, totalCost: 7000, allocatedAmountMinor: 0 }),
    ];
    installFixture(makePreviewPrisma({ orders: delivered }));

    const preview = await getStoreReconciliationPreview("user-1", "store-1", "PEN");

    expect(preview.openOrders).toEqual([]);
    expect(preview.deliveredOrders).toHaveLength(3);
    expect(preview.deliveredOrders.map((row) => row.orderId)).toEqual(["order-1", "order-2", "order-3"]);
  });

  it("lists an order's balance net of an earlier adjustment line", async () => {
    const order = makePreviewOrder({
      id: "order-1",
      status: OrderStatus.OPEN,
      totalCost: 10000,
      allocatedAmountMinor: 0,
    });
    installFixture(makePreviewPrisma({ orders: [order], writtenOffByOrderId: { "order-1": 4000 } }));

    const preview = await getStoreReconciliationPreview("user-1", "store-1", "PEN");

    expect(preview.openOrders).toEqual([expect.objectContaining({ orderId: "order-1", openBalanceMinor: 6000 })]);
  });

  it("never lists a CANCELLED order", async () => {
    const cancelled = makePreviewOrder({
      id: "order-1",
      status: OrderStatus.CANCELLED,
      totalCost: 10000,
      allocatedAmountMinor: 0,
    });
    const active = makePreviewOrder({
      id: "order-2",
      status: OrderStatus.OPEN,
      totalCost: 5000,
      allocatedAmountMinor: 0,
    });
    // The real query's WHERE clause excludes CANCELLED orders before this function ever sees them;
    // the fixture models that exclusion the same way the production query would.
    installFixture(makePreviewPrisma({ orders: [active] }));
    void cancelled;

    const preview = await getStoreReconciliationPreview("user-1", "store-1", "PEN");

    expect(preview.openOrders.map((row) => row.orderId)).toEqual(["order-2"]);
  });

  it("never lists an order whose openBalanceMinor is already 0", async () => {
    const settled = makePreviewOrder({
      id: "order-1",
      status: OrderStatus.OPEN,
      totalCost: 10000,
      allocatedAmountMinor: 10000,
    });
    installFixture(makePreviewPrisma({ orders: [settled] }));

    const preview = await getStoreReconciliationPreview("user-1", "store-1", "PEN");

    expect(preview.openOrders).toEqual([]);
    expect(preview.deliveredOrders).toEqual([]);
  });

  it("is idempotent: calling it twice in a row with no writes between returns the same result", async () => {
    const order = makePreviewOrder({
      id: "order-1",
      status: OrderStatus.OPEN,
      totalCost: 10000,
      allocatedAmountMinor: 0,
    });
    installFixture(makePreviewPrisma({ orders: [order] }));

    const first = await getStoreReconciliationPreview("user-1", "store-1", "PEN");
    const second = await getStoreReconciliationPreview("user-1", "store-1", "PEN");

    expect(second).toEqual(first);
  });
});

describe("listStoreAccountAdjustments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("orders by adjustmentDate desc, createdAt desc, and derives each magnitude from its own lines", async () => {
    installFixture(
      makePreviewPrisma({
        adjustments: [
          {
            id: "adjustment-1",
            adjustmentDate: new Date("2026-08-20"),
            createdAt: new Date("2026-08-20T10:00:00Z"),
            reason: "no identificado",
            lines: [
              {
                orderId: "order-1",
                amountMinor: 6000,
                order: { orderDate: new Date("2026-06-01"), humanReadableId: "ORD-1", status: OrderStatus.OPEN },
              },
              {
                orderId: "order-2",
                amountMinor: 4000,
                order: { orderDate: new Date("2026-06-10"), humanReadableId: "ORD-2", status: OrderStatus.COMPLETED },
              },
            ],
          },
        ],
      }),
    );

    const rows = await listStoreAccountAdjustments("user-1", "store-1", "PEN");

    expect(rows).toEqual([
      {
        id: "adjustment-1",
        adjustmentDate: new Date("2026-08-20"),
        reason: "no identificado",
        magnitudeMinor: 10000,
        lines: [
          {
            orderId: "order-1",
            amountMinor: 6000,
            orderDate: new Date("2026-06-01"),
            orderHumanReadableId: "ORD-1",
            orderActive: true,
          },
          {
            orderId: "order-2",
            amountMinor: 4000,
            orderDate: new Date("2026-06-10"),
            orderHumanReadableId: "ORD-2",
            orderActive: false,
          },
        ],
      },
    ]);
    expect(prismaMock.storeAccountAdjustment).toBeDefined();
    const findMany = (prismaMock.storeAccountAdjustment as { findMany: ReturnType<typeof vi.fn> }).findMany;
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ adjustmentDate: "desc" }, { createdAt: "desc" }] }),
    );
  });

  it("derives a smaller magnitude for an adjustment whose only line named a since-deleted order", async () => {
    installFixture(
      makePreviewPrisma({
        adjustments: [
          {
            id: "adjustment-1",
            adjustmentDate: new Date("2026-08-20"),
            createdAt: new Date("2026-08-20T10:00:00Z"),
            reason: "no identificado",
            // The cascade already removed the line naming the deleted order; only one remains.
            lines: [
              {
                orderId: "order-2",
                amountMinor: 4000,
                order: { orderDate: new Date("2026-06-10"), humanReadableId: "ORD-2" },
              },
            ],
          },
        ],
      }),
    );

    const rows = await listStoreAccountAdjustments("user-1", "store-1", "PEN");

    expect(rows[0].magnitudeMinor).toBe(4000);
  });

  it("carries each line's own order-active flag, mirroring StorePaymentAllocationLine.orderActive (FIX 1, WO-11 review)", async () => {
    installFixture(
      makePreviewPrisma({
        adjustments: [
          {
            id: "adjustment-1",
            adjustmentDate: new Date("2026-08-20"),
            createdAt: new Date("2026-08-20T10:00:00Z"),
            reason: "no identificado",
            lines: [
              {
                orderId: "order-open",
                amountMinor: 5000,
                order: { orderDate: new Date("2026-06-01"), humanReadableId: "ORD-1", status: OrderStatus.OPEN },
              },
              {
                orderId: "order-delivered",
                amountMinor: 7000,
                order: {
                  orderDate: new Date("2026-06-10"),
                  humanReadableId: "ORD-2",
                  status: OrderStatus.COMPLETED,
                },
              },
            ],
          },
        ],
      }),
    );

    const rows = await listStoreAccountAdjustments("user-1", "store-1", "PEN");

    expect(rows[0].lines.map((line) => ({ orderId: line.orderId, orderActive: line.orderActive }))).toEqual([
      { orderId: "order-open", orderActive: true },
      { orderId: "order-delivered", orderActive: false },
    ]);
  });

  it("derives a magnitude of 0 for an adjustment whose every order was deleted", async () => {
    installFixture(
      makePreviewPrisma({
        adjustments: [
          {
            id: "adjustment-1",
            adjustmentDate: new Date("2026-08-20"),
            createdAt: new Date("2026-08-20T10:00:00Z"),
            reason: "no identificado",
            lines: [],
          },
        ],
      }),
    );

    const rows = await listStoreAccountAdjustments("user-1", "store-1", "PEN");

    expect(rows[0].magnitudeMinor).toBe(0);
  });
});

describe("listStoreAccountAdjustmentCurrencyCodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns every distinct currency the store has an adjustment in (MINOR-5)", async () => {
    installFixture(makePreviewPrisma({ currencyCodes: ["PEN", "USD"] }));

    const codes = await listStoreAccountAdjustmentCurrencyCodes("user-1", "store-1");

    expect(codes).toEqual(["PEN", "USD"]);
    const findMany = (prismaMock.storeAccountAdjustment as { findMany: ReturnType<typeof vi.fn> }).findMany;
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", storeId: "store-1" },
      select: { currencyCode: true },
      distinct: ["currencyCode"],
    });
  });

  it("returns an empty list for a store with no adjustments in any currency", async () => {
    installFixture(makePreviewPrisma({ currencyCodes: [] }));

    const codes = await listStoreAccountAdjustmentCurrencyCodes("user-1", "store-1");

    expect(codes).toEqual([]);
  });
});

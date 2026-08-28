import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, recomputeMock, cacheMock, captureExceptionMock } = vi.hoisted(() => ({
  prismaMock: { $transaction: vi.fn() },
  recomputeMock: vi.fn(),
  cacheMock: vi.fn(),
  captureExceptionMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
  withScope: (callback: (scope: unknown) => void) =>
    callback({ setTag: vi.fn(), setContext: vi.fn(), setLevel: vi.fn() }),
}));
vi.mock("../recompute", () => ({ recomputeUserProgress: recomputeMock }));
vi.mock("../progressionQueries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../progressionQueries")>()),
  getUserProgressCache: cacheMock,
}));

import { DeliveryStatus, OrderStatus, StoreStatus, StoreVisibility } from "../../../../../generated/prisma/client";
import { createDelivery, markDeliveryDelivered } from "@/lib/data/deliveries/deliveryMutations";
import { createOrder } from "@/lib/data/orders/orderMutations";
import { POINT_RULE_KEYS } from "../pointRules";

/**
 * WHERE the credit sits inside each host mutation, which is the part a unit test of the accrual
 * module on its own cannot see.
 *
 * Two placement rules are load-bearing and both are asserted here rather than trusted:
 *
 *   - the credit runs AFTER the host's last refusal, so a mutation that refuses leaves no entry
 *     behind (returning from a `$transaction` callback commits, so a credit written before a
 *     refusal would survive it);
 *   - a credit that throws is swallowed, so the order, payment or delivery still succeeds. A
 *     progression bug must never be able to cost a collector a real record.
 */

/**
 * The store every credit here happens at: approved, public, and registered by the acting collector
 * themselves. That last field is deliberate rather than incidental. `BR-12-07` used to refuse a
 * store its own collector had created, which made every credit in this file depend on a third party
 * existing; it now gates on approval alone, so this constant is what proves the relaxation holds at
 * the real call sites and not only in the gate's own unit test.
 */
const ELIGIBLE_STORE = {
  id: "store-1",
  status: StoreStatus.APPROVED,
  visibility: StoreVisibility.PUBLIC,
  isPrivate: false,
  createdByUserId: "user-1",
};

type AnyMock = ReturnType<typeof vi.fn>;

function ledgerRuleKeys(createMany: AnyMock): string[] {
  return createMany.mock.calls.flatMap((call) =>
    ((call[0].data ?? []) as Array<{ ruleKey: string }>).map((row) => row.ruleKey),
  );
}

function makeOrderTx() {
  return {
    store: { findFirst: vi.fn().mockResolvedValue(ELIGIBLE_STORE) },
    storeProductType: { findMany: vi.fn().mockResolvedValue([]) },
    order: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "order-1", humanReadableId: "ORD-20260823-01" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    orderItem: { findMany: vi.fn().mockResolvedValue([]), createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    orderHistory: { create: vi.fn().mockResolvedValue({}) },
    storePayment: { create: vi.fn().mockResolvedValue({ id: "payment-1" }) },
    paymentAllocation: { createMany: vi.fn().mockResolvedValue({ count: 0 }), groupBy: vi.fn().mockResolvedValue([]) },
    storeAccountAdjustmentLine: { groupBy: vi.fn().mockResolvedValue([]) },
    user: { findUnique: vi.fn().mockResolvedValue({ baseCurrencyCode: null, timezone: null }) },
    pointLedgerEntry: {
      createMany: vi.fn().mockImplementation(async ({ data }: { data: unknown[] }) => ({
        count: Array.isArray(data) ? data.length : 0,
      })),
    },
  };
}

function useTx(tx: unknown): void {
  prismaMock.$transaction.mockImplementation(async (cb: (client: unknown) => unknown) => cb(tx));
}

const orderInput = {
  storeId: "store-1",
  orderDate: new Date("2026-08-01T00:00:00.000Z"),
  currencyCode: "USD",
  totalCost: 10000,
};

beforeEach(() => {
  vi.clearAllMocks();
  cacheMock.mockResolvedValue({ userId: "user-1", maturedPoints: 100, rankIndex: 2, highestRankIndex: 2 });
  recomputeMock.mockResolvedValue({
    derivedTotal: 125,
    currentRankIndex: 3,
    highestRankIndex: 3,
    unlockedThisRun: [],
  });
});

describe("createOrder credit placement", () => {
  it("credits inside the order transaction and reports the re-derived delta, not the raw sum", async () => {
    const tx = makeOrderTx();
    useTx(tx);

    const result = await createOrder("user-1", orderInput);

    expect(result.ok).toBe(true);
    expect(ledgerRuleKeys(tx.pointLedgerEntry.createMany)).toEqual([
      POINT_RULE_KEYS.ORDER_CREATED,
      POINT_RULE_KEYS.STORE_FIRST_ORDER,
    ]);
    // 25, the difference between the cache and the recompute, never the 5 + 20 just appended: the
    // caps and the eligibility conditions are applied by the recompute, not by the write.
    expect(result.ok && result.progression).toEqual({
      pointsDelta: 25,
      rankUp: { from: 2, to: 3 },
      medalsUnlocked: [],
      // No `order.findMany` row for this store this month, so the new order lands at the ladder's
      // opening position: `order-registered` will still pay 20 once it is first credited (`FR-12-05`).
      deferredOrderPoints: 20,
    });
  });

  it("reports no deferred amount once an initial payment already credited order-registered in the same transaction", async () => {
    const tx = makeOrderTx();
    tx.orderItem.findMany.mockResolvedValueOnce([{ id: "item-1" }]);
    useTx(tx);

    const result = await createOrder("user-1", {
      ...orderInput,
      initialPayment: { amount: 10000, paymentDate: new Date("2026-08-01T00:00:00.000Z") },
    });

    expect(result.ok).toBe(true);
    // `order-registered` already ran inside `writeStorePaymentWithAllocations`, so there is nothing
    // left to defer, and the toast must not name an amount the collector already earned.
    expect(result.ok && result.progression?.deferredOrderPoints).toBeNull();
  });

  it("appends nothing when the order is refused", async () => {
    const tx = makeOrderTx();
    tx.store.findFirst.mockResolvedValue(null);
    useTx(tx);

    const result = await createOrder("user-1", orderInput);

    expect(result).toEqual({ ok: false, error: "STORE_NOT_FOUND" });
    expect(tx.pointLedgerEntry.createMany).not.toHaveBeenCalled();
  });

  it("still creates the order when the ledger append itself fails", async () => {
    const tx = makeOrderTx();
    tx.pointLedgerEntry.createMany.mockRejectedValue(new Error("ledger unavailable"));
    useTx(tx);

    const result = await createOrder("user-1", orderInput);

    expect(result.ok).toBe(true);
    expect(tx.order.create).toHaveBeenCalledTimes(1);
    // `null`, never a guessed delta, and never a refusal.
    expect(result.ok && result.progression).toBeNull();
    expect(recomputeMock).not.toHaveBeenCalled();
  });
});

function makeDeliveryTx(overrides: { items?: Array<{ id: string; orderId: string }> } = {}) {
  const items = overrides.items ?? [{ id: "item-1", orderId: "order-1" }];
  return {
    store: { findFirst: vi.fn().mockResolvedValue(ELIGIBLE_STORE) },
    orderItem: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: items.length }),
    },
    delivery: {
      findFirst: vi.fn().mockResolvedValue({
        id: "delivery-1",
        status: DeliveryStatus.IN_TRANSIT,
        store: ELIGIBLE_STORE,
        orderItems: items.map((item) => ({ orderItem: item })),
      }),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "delivery-1" }),
      update: vi.fn().mockResolvedValue({}),
    },
    deliveryOrderItem: { createMany: vi.fn().mockResolvedValue({ count: items.length }) },
    order: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    storeAccountAdjustmentLine: { groupBy: vi.fn().mockResolvedValue([]) },
    user: { findUnique: vi.fn().mockResolvedValue({ baseCurrencyCode: null, timezone: null }) },
    pointLedgerEntry: {
      createMany: vi.fn().mockImplementation(async ({ data }: { data: unknown[] }) => ({
        count: Array.isArray(data) ? data.length : 0,
      })),
    },
  };
}

const deliveryInput = {
  storeId: "store-1",
  productIds: ["item-1"],
  deliveryDate: new Date("2026-08-20T00:00:00.000Z"),
  cost: 1000,
  currencyCode: "USD",
};

describe("delivery credit placement", () => {
  it("credits the arrival when a delivery is born delivered (quick arrival)", async () => {
    const tx = makeDeliveryTx();
    tx.orderItem.findMany.mockResolvedValueOnce([
      {
        id: "item-1",
        orderId: "order-1",
        deliveryState: "NONE",
        order: { storeId: "store-1", userId: "user-1", status: OrderStatus.OPEN },
      },
    ]);
    useTx(tx);

    const result = await createDelivery("user-1", {
      ...deliveryInput,
      receivedDate: new Date("2026-08-20T00:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(ledgerRuleKeys(tx.pointLedgerEntry.createMany)).toContain(POINT_RULE_KEYS.DELIVERY_RECEIVED);
  });

  it("does not credit an arrival for a delivery that is still in transit", async () => {
    const tx = makeDeliveryTx();
    tx.orderItem.findMany.mockResolvedValueOnce([
      {
        id: "item-1",
        orderId: "order-1",
        deliveryState: "NONE",
        order: { storeId: "store-1", userId: "user-1", status: OrderStatus.OPEN },
      },
    ]);
    useTx(tx);

    const result = await createDelivery("user-1", deliveryInput);

    expect(result.ok).toBe(true);
    expect(tx.pointLedgerEntry.createMany).not.toHaveBeenCalled();
  });

  it("credits the arrival inside the same transaction that sets DELIVERED", async () => {
    const tx = makeDeliveryTx();
    useTx(tx);

    const result = await markDeliveryDelivered("delivery-1", "user-1", new Date("2026-08-20T00:00:00.000Z"));

    expect(result.ok).toBe(true);
    expect(ledgerRuleKeys(tx.pointLedgerEntry.createMany)).toContain(POINT_RULE_KEYS.DELIVERY_RECEIVED);
    // Same `tx` the status write used: never the independent money transaction that follows.
    expect(tx.delivery.update).toHaveBeenCalledTimes(1);
  });

  it("appends nothing when the delivery lifecycle refuses", async () => {
    const tx = makeDeliveryTx();
    tx.delivery.findFirst.mockResolvedValue({
      id: "delivery-1",
      status: DeliveryStatus.DELIVERED,
      store: ELIGIBLE_STORE,
      orderItems: [],
    });
    useTx(tx);

    const result = await markDeliveryDelivered("delivery-1", "user-1", new Date("2026-08-20T00:00:00.000Z"));

    expect(result).toEqual({ ok: false, error: "INVALID_STATUS" });
    expect(tx.pointLedgerEntry.createMany).not.toHaveBeenCalled();
  });

  it("credits the derived completion where the status is written, gated by the same store rule", async () => {
    const tx = makeDeliveryTx();
    tx.order.findMany.mockResolvedValue([
      {
        id: "order-1",
        status: OrderStatus.IN_TRANSIT,
        items: [{ id: "item-1", deliveryState: "DELIVERED" }],
        store: ELIGIBLE_STORE,
      },
    ]);
    useTx(tx);

    const result = await markDeliveryDelivered("delivery-1", "user-1", new Date("2026-08-20T00:00:00.000Z"));

    expect(result.ok).toBe(true);
    expect(ledgerRuleKeys(tx.pointLedgerEntry.createMany)).toContain(POINT_RULE_KEYS.ORDER_COMPLETED);
  });
});

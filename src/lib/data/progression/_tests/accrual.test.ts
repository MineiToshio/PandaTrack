import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, captureExceptionMock } = vi.hoisted(() => ({
  prismaMock: {},
  captureExceptionMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
  withScope: (callback: (scope: unknown) => void) =>
    callback({ setTag: vi.fn(), setContext: vi.fn(), setLevel: vi.fn() }),
}));

import { OrderItemDeliveryState, StoreStatus, StoreVisibility } from "../../../../../generated/prisma/client";
import {
  combineCredits,
  creditDeliveryReceived,
  creditOrderCreation,
  creditOrderPayment,
  creditOrdersCompleted,
  creditStoreReviewed,
} from "../accrual";
import { POINT_RULE_KEYS, PROGRESSION_ENTITY_TYPES } from "../pointRules";

/**
 * The credit call sites, tested at the seam where they decide WHAT to append.
 *
 * The three things worth protecting here are the three that would be invisible in production until
 * a collector complained: the store gate (an invented store must never credit), the anti-split
 * ladder (a wrong position silently changes what an order is worth), and the swallow (a broken
 * credit must never take a real order, payment or delivery down with it).
 *
 * The `tx` mocks carry only what each function actually calls, so a call site that starts reading
 * something new fails loudly here rather than quietly reading `undefined`.
 */

/** A store that credits: approved and public. Who registered it is not part of the gate. */
const ELIGIBLE_STORE = {
  status: StoreStatus.APPROVED,
  visibility: StoreVisibility.PUBLIC,
  isPrivate: false,
};

type LedgerRow = {
  userId: string;
  ruleKey: string;
  entityType: string;
  entityId: string;
  points: number;
  occurredOn: Date;
  source: string;
};

type FakeTx = {
  user: { findUnique: ReturnType<typeof vi.fn> };
  pointLedgerEntry: { createMany: ReturnType<typeof vi.fn> };
  order: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  orderItem: { findMany: ReturnType<typeof vi.fn> };
  storeAccountAdjustmentLine: { groupBy: ReturnType<typeof vi.fn> };
};

function makeTx(overrides: Partial<FakeTx> = {}): FakeTx {
  return {
    user: { findUnique: vi.fn().mockResolvedValue({ timezone: null }) },
    pointLedgerEntry: {
      createMany: vi.fn().mockImplementation(async ({ data }: { data: LedgerRow[] }) => ({ count: data.length })),
    },
    order: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    orderItem: { findMany: vi.fn().mockResolvedValue([]) },
    storeAccountAdjustmentLine: { groupBy: vi.fn().mockResolvedValue([]) },
    ...overrides,
  };
}

/** Every ledger row a call site offered, flattened out of the one `createMany` it issues. */
function appendedRows(tx: FakeTx): LedgerRow[] {
  return tx.pointLedgerEntry.createMany.mock.calls.flatMap((call) => call[0].data as LedgerRow[]);
}

function ruleKeys(tx: FakeTx): string[] {
  return appendedRows(tx).map((row) => row.ruleKey);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("creditOrderCreation", () => {
  it("credits order-created and store-first-order for the first order at an approved third-party store", async () => {
    const tx = makeTx();

    const credited = await creditOrderCreation(tx as never, {
      userId: "user-1",
      orderId: "order-1",
      storeId: "store-1",
      store: ELIGIBLE_STORE,
    });

    expect(credited).toBe(2);
    expect(appendedRows(tx)).toEqual([
      expect.objectContaining({
        ruleKey: POINT_RULE_KEYS.ORDER_CREATED,
        entityType: PROGRESSION_ENTITY_TYPES.ORDER,
        entityId: "order-1",
        points: 5,
        source: "LIVE",
      }),
      expect.objectContaining({
        ruleKey: POINT_RULE_KEYS.STORE_FIRST_ORDER,
        // Keyed by the STORE, not the order: that is what makes it once per store, for good.
        entityType: PROGRESSION_ENTITY_TYPES.STORE,
        entityId: "store-1",
        points: 20,
      }),
    ]);
  });

  it("credits only order-created when the collector already has an order at that store", async () => {
    const tx = makeTx({ order: { count: vi.fn().mockResolvedValue(3), findMany: vi.fn(), findFirst: vi.fn() } });

    await creditOrderCreation(tx as never, {
      userId: "user-1",
      orderId: "order-2",
      storeId: "store-1",
      store: ELIGIBLE_STORE,
    });

    expect(ruleKeys(tx)).toEqual([POINT_RULE_KEYS.ORDER_CREATED]);
  });

  it.each([
    ["it is private", { ...ELIGIBLE_STORE, isPrivate: true }],
    ["its visibility is PRIVATE", { ...ELIGIBLE_STORE, visibility: StoreVisibility.PRIVATE }],
    ["it is still pending approval", { ...ELIGIBLE_STORE, status: StoreStatus.PENDING }],
    ["it was rejected", { ...ELIGIBLE_STORE, status: StoreStatus.REJECTED }],
    ["there is no store row at all", null],
  ])("credits nothing when %s", async (_label, store) => {
    const tx = makeTx();

    const credited = await creditOrderCreation(tx as never, {
      userId: "user-1",
      orderId: "order-1",
      storeId: "store-1",
      store,
    });

    expect(credited).toBe(0);
    expect(tx.pointLedgerEntry.createMany).not.toHaveBeenCalled();
  });

  it("swallows a failed append and reports it, rather than letting the order fail", async () => {
    const tx = makeTx();
    tx.pointLedgerEntry.createMany.mockRejectedValue(new Error("ledger unavailable"));

    // `null`, not `0`: the caller must be able to tell "nothing was earned" from "we do not know".
    await expect(
      creditOrderCreation(tx as never, {
        userId: "user-1",
        orderId: "order-1",
        storeId: "store-1",
        store: ELIGIBLE_STORE,
      }),
    ).resolves.toBeNull();
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });
});

describe("creditOrderPayment", () => {
  /** A `tx` whose store/month window holds the given order ids, in that order. */
  function txWithMonthOrders(monthOrderIds: string[], settled = false): FakeTx {
    const tx = makeTx();
    tx.order.findMany.mockImplementation(async (args: { select: Record<string, boolean> }) =>
      // `resolveStoreMonthPositions` asks for ids; `resolveSettledOrderIds` asks for the money row.
      args.select.totalCost
        ? monthOrderIds.map((id) => ({ id, totalCost: 1000, allocatedAmountMinor: settled ? 1000 : 400 }))
        : monthOrderIds.map((id) => ({ id })),
    );
    return tx;
  }

  it("credits order-first-payment and order-registered for the order the payment touched", async () => {
    const tx = txWithMonthOrders(["order-1"]);

    await creditOrderPayment(tx as never, {
      userId: "user-1",
      storeId: "store-1",
      orderIds: ["order-1"],
      storeCreditEligible: true,
    });

    expect(appendedRows(tx)).toEqual([
      expect.objectContaining({ ruleKey: POINT_RULE_KEYS.ORDER_FIRST_PAYMENT, entityId: "order-1", points: 8 }),
      expect.objectContaining({ ruleKey: POINT_RULE_KEYS.ORDER_REGISTERED, entityId: "order-1", points: 20 }),
    ]);
  });

  it("prices order-registered down the anti-split ladder, with a floor of 5 that is never zero", async () => {
    const monthOrders = Array.from({ length: 8 }, (_unused, index) => `order-${index + 1}`);
    const awarded: number[] = [];

    for (const orderId of monthOrders) {
      const tx = txWithMonthOrders(monthOrders);
      await creditOrderPayment(tx as never, {
        userId: "user-1",
        storeId: "store-1",
        orderIds: [orderId],
        storeCreditEligible: true,
      });
      const registered = appendedRows(tx).find((row) => row.ruleKey === POINT_RULE_KEYS.ORDER_REGISTERED);
      awarded.push(registered?.points ?? 0);
    }

    // Eight orders at one store yield 70, where eight at eight stores would yield 160 before caps:
    // splitting a purchase is never the dominant strategy, and the honest fifth order is not zero.
    expect(awarded).toEqual([20, 15, 10, 5, 5, 5, 5, 5]);
    expect(awarded.reduce((sum, points) => sum + points, 0)).toBe(70);
  });

  it("puts an order from an earlier month at the BACK of this month's ladder, never at the front", async () => {
    // Three orders already registered at this store this month, and the payment lands on an order
    // created before any of them. Handing it the opening 20 would pay the top of the ladder once per
    // old order the collector still has open, which is precisely the split the ladder discourages.
    const tx = txWithMonthOrders(["order-a", "order-b", "order-c"]);

    await creditOrderPayment(tx as never, {
      userId: "user-1",
      storeId: "store-1",
      orderIds: ["order-from-march"],
      storeCreditEligible: true,
    });

    expect(appendedRows(tx)).toContainEqual(
      expect.objectContaining({ ruleKey: POINT_RULE_KEYS.ORDER_REGISTERED, entityId: "order-from-march", points: 5 }),
    );
  });

  it("adds order-settled once the order is fully covered, and not before", async () => {
    const unsettled = txWithMonthOrders(["order-1"], false);
    await creditOrderPayment(unsettled as never, {
      userId: "user-1",
      storeId: "store-1",
      orderIds: ["order-1"],
      storeCreditEligible: true,
    });
    expect(ruleKeys(unsettled)).not.toContain(POINT_RULE_KEYS.ORDER_SETTLED);

    const settled = txWithMonthOrders(["order-1"], true);
    await creditOrderPayment(settled as never, {
      userId: "user-1",
      storeId: "store-1",
      orderIds: ["order-1"],
      storeCreditEligible: true,
    });
    expect(appendedRows(settled)).toContainEqual(
      expect.objectContaining({ ruleKey: POINT_RULE_KEYS.ORDER_SETTLED, entityId: "order-1", points: 12 }),
    );
  });

  it("credits nothing at all when the store is not credit-eligible", async () => {
    const tx = txWithMonthOrders(["order-1"], true);

    const credited = await creditOrderPayment(tx as never, {
      userId: "user-1",
      storeId: "store-1",
      orderIds: ["order-1"],
      storeCreditEligible: false,
    });

    expect(credited).toBe(0);
    expect(tx.pointLedgerEntry.createMany).not.toHaveBeenCalled();
    // Not even the money question is asked for a store that cannot credit.
    expect(tx.order.findMany).not.toHaveBeenCalled();
  });

  it("offers the same rows for a repeated payment, leaving the duplicate to the unique key", async () => {
    // The idempotency key is `(user, rule, order)`, resolved by `ON CONFLICT DO NOTHING`, so a
    // second payment against the same order appends nothing even though it offers the same rows.
    const tx = txWithMonthOrders(["order-1"]);
    tx.pointLedgerEntry.createMany.mockResolvedValue({ count: 0 });

    const credited = await creditOrderPayment(tx as never, {
      userId: "user-1",
      storeId: "store-1",
      orderIds: ["order-1"],
      storeCreditEligible: true,
    });

    expect(credited).toBe(0);
    expect(tx.pointLedgerEntry.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
  });
});

describe("creditDeliveryReceived", () => {
  it("credits the arrival once per delivery, plus one discovery per product type", async () => {
    const tx = makeTx();
    tx.orderItem.findMany.mockResolvedValue([{ productTypeKey: "figure" }, { productTypeKey: "manga" }]);

    await creditDeliveryReceived(tx as never, {
      userId: "user-1",
      deliveryId: "delivery-1",
      store: ELIGIBLE_STORE,
      deliveredItemIds: ["item-1", "item-2", "item-3"],
    });

    expect(appendedRows(tx)).toEqual([
      expect.objectContaining({
        ruleKey: POINT_RULE_KEYS.DELIVERY_RECEIVED,
        entityType: PROGRESSION_ENTITY_TYPES.DELIVERY,
        entityId: "delivery-1",
        points: 25,
      }),
      expect.objectContaining({
        ruleKey: POINT_RULE_KEYS.PRODUCT_TYPE_DISCOVERED,
        entityType: PROGRESSION_ENTITY_TYPES.PRODUCT_TYPE,
        entityId: "figure",
        points: 12,
      }),
      expect.objectContaining({ ruleKey: POINT_RULE_KEYS.PRODUCT_TYPE_DISCOVERED, entityId: "manga" }),
    ]);
    // Only products that actually reached DELIVERED, on an order that is not cancelled.
    expect(tx.orderItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deliveryState: OrderItemDeliveryState.DELIVERED }),
      }),
    );
  });

  it("credits nothing at a private or unapproved store", async () => {
    const tx = makeTx();

    const credited = await creditDeliveryReceived(tx as never, {
      userId: "user-1",
      deliveryId: "delivery-1",
      store: { ...ELIGIBLE_STORE, status: StoreStatus.PENDING },
      deliveredItemIds: ["item-1"],
    });

    expect(credited).toBe(0);
    expect(tx.pointLedgerEntry.createMany).not.toHaveBeenCalled();
  });
});

describe("creditOrdersCompleted", () => {
  it("credits every order that just closed, and skips the ones whose store cannot credit", async () => {
    const tx = makeTx();

    await creditOrdersCompleted(tx as never, {
      userId: "user-1",
      orders: [
        { orderId: "order-1", store: ELIGIBLE_STORE },
        { orderId: "order-2", store: { ...ELIGIBLE_STORE, status: StoreStatus.PENDING } },
        { orderId: "order-3", store: null },
      ],
    });

    expect(appendedRows(tx)).toEqual([
      expect.objectContaining({ ruleKey: POINT_RULE_KEYS.ORDER_COMPLETED, entityId: "order-1", points: 30 }),
    ]);
  });

  it("writes nothing when no order closed", async () => {
    const tx = makeTx();

    await expect(creditOrdersCompleted(tx as never, { userId: "user-1", orders: [] })).resolves.toBe(0);
    expect(tx.pointLedgerEntry.createMany).not.toHaveBeenCalled();
  });
});

describe("creditStoreReviewed", () => {
  it("credits 20 points keyed by the STORE, not by the review row (FR-12-04, AC-12-05)", async () => {
    const tx = makeTx();
    tx.order.findFirst.mockResolvedValue({ id: "order-1" });

    const credited = await creditStoreReviewed(tx as never, {
      userId: "user-1",
      storeId: "store-1",
      store: ELIGIBLE_STORE,
    });

    expect(credited).toBe(1);
    // Keyed by the store: the idempotency triple is what makes deleting the review and writing it
    // again credit exactly once, with no "have I already credited this" lookup anywhere.
    expect(appendedRows(tx)).toEqual([
      expect.objectContaining({
        ruleKey: POINT_RULE_KEYS.STORE_REVIEWED,
        entityType: PROGRESSION_ENTITY_TYPES.STORE,
        entityId: "store-1",
        points: 20,
      }),
    ]);
  });

  it("credits nothing for a review of a store the collector never received from (BR-12-07)", async () => {
    const tx = makeTx();
    tx.order.findFirst.mockResolvedValue(null);

    const credited = await creditStoreReviewed(tx as never, {
      userId: "user-1",
      storeId: "store-1",
      store: ELIGIBLE_STORE,
    });

    expect(credited).toBe(0);
    expect(ruleKeys(tx)).toEqual([]);
  });

  it("credits nothing through a store that is not approved yet (BR-12-07)", async () => {
    const tx = makeTx();
    tx.order.findFirst.mockResolvedValue({ id: "order-1" });

    const credited = await creditStoreReviewed(tx as never, {
      userId: "user-1",
      storeId: "store-1",
      store: { ...ELIGIBLE_STORE, status: StoreStatus.PENDING },
    });

    expect(credited).toBe(0);
    // The gate runs before the arrival check, so an unapproved store costs no query at all.
    expect(tx.order.findFirst).not.toHaveBeenCalled();
    expect(ruleKeys(tx)).toEqual([]);
  });

  it("swallows its own failure rather than taking the review down with it", async () => {
    const tx = makeTx();
    tx.order.findFirst.mockRejectedValue(new Error("db down"));

    const credited = await creditStoreReviewed(tx as never, {
      userId: "user-1",
      storeId: "store-1",
      store: ELIGIBLE_STORE,
    });

    expect(credited).toBeNull();
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });
});

describe("combineCredits", () => {
  it("sums the steps that ran", () => {
    expect(combineCredits(2, 0, 3)).toBe(5);
  });

  it("poisons the whole answer when any step failed", () => {
    // A partial delta is worse than none: the collector would be shown a number that is wrong in a
    // direction nothing on screen can explain.
    expect(combineCredits(2, null)).toBeNull();
  });
});

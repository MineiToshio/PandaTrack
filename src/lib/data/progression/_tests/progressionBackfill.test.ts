import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, recomputeMock } = vi.hoisted(() => ({
  prismaMock: {},
  recomputeMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("../recompute", () => ({ recomputeUserProgress: recomputeMock }));

import {
  DeliveryStatus,
  OrderItemDeliveryState,
  OrderStatus,
  StoreStatus,
  StoreVisibility,
} from "../../../../../generated/prisma/client";
import { POINT_RULE_KEYS, PROGRESSION_ENTITY_TYPES } from "../pointRules";
import { ProgressionBackfillSourceIncompleteError, runProgressionBackfill } from "../progressionBackfill";

/**
 * The backfill, tested at the seam where it decides WHAT to replay and how to label it.
 *
 * Four things here would be invisible in production until the owner opened the app and saw either a
 * wrong history or a wall of notifications: the migrated-order rule (a fused payment record must
 * never produce two payment events), the source label (a reconstructed point must never look like a
 * live one), the silent unlock (`FR-12-43`), and the all-or-nothing refusal.
 *
 * The fake client dispatches on the shape of each call rather than on call order, so a query the
 * backfill starts issuing shows up as an explicit failure instead of quietly reading `undefined`.
 * `recomputeUserProgress` is the one collaborator stubbed out, and the stub still writes real
 * `MedalUnlock` rows into the fake world, because the assertion that matters is what the backfill
 * does to those rows AFTERWARDS.
 */

const USER_ID = "user-1";

/** An approved, public store: the only kind that credits anything. Authorship is not part of it. */
const ELIGIBLE_STORE = {
  status: StoreStatus.APPROVED,
  visibility: StoreVisibility.PUBLIC,
  isPrivate: false,
  // The collector registered it themselves, which the gate no longer holds against them.
  createdByUserId: USER_ID,
};

function civilDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

type WorldOrder = {
  id: string;
  storeId: string;
  status?: OrderStatus;
  orderDate: Date;
  /** Civil day of the order's first assigned payment, or absent for an order nobody has paid. */
  paymentDay?: Date;
  /** The payment behind it came in through the one-to-one Notion import. */
  migrated?: boolean;
  /** Fully covered, as the money predicate adapter would answer. */
  settled?: boolean;
};

type WorldDelivery = {
  id: string;
  storeId: string;
  receivedDate: Date;
  orderIds: string[];
  productTypeKeys?: string[];
};

type WorldPayment = {
  id: string;
  paymentDate?: Date | null;
  storeId?: string | null;
  orderIds?: string[];
};

type WorldUnlock = {
  medalKey: string;
  seenAt: Date | null;
  source: string;
};

type World = {
  orders?: WorldOrder[];
  deliveries?: WorldDelivery[];
  reviewedStoreIds?: string[];
  migratedPayments?: WorldPayment[];
  /** Ledger keys (`ruleKey|entityId`) already present, so a re-run inserts nothing. */
  existingLedgerKeys?: string[];
  unlocks?: WorldUnlock[];
  /** Medal keys the stubbed recompute will unlock on this run. */
  unlocksThisRun?: string[];
  progress?: { maturedPoints: number; rankIndex: number } | null;
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

type AnyArgs = {
  where?: Record<string, unknown>;
  select?: Record<string, unknown>;
  data?: unknown;
  distinct?: string[];
};

function makeWorld(world: World) {
  const orders = world.orders ?? [];
  const deliveries = world.deliveries ?? [];
  const migratedPayments = world.migratedPayments ?? [];
  const ledger: LedgerRow[] = [];
  const existingKeys = new Set(world.existingLedgerKeys ?? []);
  const unlocks: WorldUnlock[] = (world.unlocks ?? []).map((unlock) => ({ ...unlock }));
  const progressUpserts: Array<Record<string, unknown>> = [];
  const settingsCalls: string[] = [];

  const orderById = new Map(orders.map((order) => [order.id, order]));

  const db = {
    user: {
      findMany: vi.fn(async () => [{ id: USER_ID }]),
    },

    storePayment: {
      findMany: vi.fn(async () =>
        migratedPayments.map((payment) => ({
          id: payment.id,
          paymentDate: payment.paymentDate ?? null,
          storeId: payment.storeId ?? null,
          allocations: (payment.orderIds ?? []).slice(0, 1).map((orderId) => ({ orderId })),
        })),
      ),
    },

    order: {
      findMany: vi.fn(async (args: AnyArgs) => {
        // The money predicate adapter is the only reader that asks for the money columns.
        if (args.select?.totalCost) {
          const where = (args.where ?? {}) as { id?: { in?: string[] } };
          const wanted = where.id?.in ?? [];
          return orders
            .filter((order) => wanted.includes(order.id))
            .map((order) => ({
              id: order.id,
              totalCost: 1000,
              allocatedAmountMinor: order.settled ? 1000 : 250,
            }));
        }

        return orders
          .filter((order) => (order.status ?? OrderStatus.OPEN) !== OrderStatus.CANCELLED)
          .map((order) => ({
            id: order.id,
            storeId: order.storeId,
            status: order.status ?? OrderStatus.OPEN,
            orderDate: order.orderDate,
            store:
              order.storeId === "store-unapproved" ? { ...ELIGIBLE_STORE, status: StoreStatus.PENDING } : ELIGIBLE_STORE,
          }));
      }),
    },

    storeAccountAdjustmentLine: {
      groupBy: vi.fn(async () => []),
    },

    paymentAllocation: {
      findMany: vi.fn(async (args: AnyArgs) => {
        const where = (args.where ?? {}) as { orderId?: { in?: string[] }; payment?: unknown };
        const wanted = where.orderId?.in ?? [];

        // Provenance query (was this order's payment migrated?) versus the payment-day query.
        if (where.payment) {
          return orders
            .filter((order) => wanted.includes(order.id) && order.migrated)
            .map((order) => ({ orderId: order.id }));
        }

        return orders
          .filter((order) => wanted.includes(order.id) && order.paymentDay)
          .map((order) => ({ orderId: order.id, payment: { paymentDate: order.paymentDay } }));
      }),
    },

    delivery: {
      findMany: vi.fn(async () =>
        deliveries.map((delivery) => ({
          id: delivery.id,
          receivedDate: delivery.receivedDate,
          deliveryDate: delivery.receivedDate,
          store: ELIGIBLE_STORE,
          orderItems: delivery.orderIds.flatMap((orderId) =>
            (delivery.productTypeKeys ?? [null]).map((productTypeKey) => ({
              orderItem: { orderId, productTypeKey, deliveryState: OrderItemDeliveryState.DELIVERED },
            })),
          ),
        })),
      ),
    },

    storeReview: {
      findMany: vi.fn(async () =>
        (world.reviewedStoreIds ?? []).map((storeId) => ({ storeId, createdAt: civilDay(2026, 2, 1) })),
      ),
    },

    pointLedgerEntry: {
      createMany: vi.fn(async ({ data }: { data: LedgerRow[] }) => {
        const inserted = data.filter((row) => !existingKeys.has(`${row.ruleKey}|${row.entityId}`));
        for (const row of inserted) {
          existingKeys.add(`${row.ruleKey}|${row.entityId}`);
          ledger.push(row);
        }
        return { count: inserted.length };
      }),
    },

    userProgress: {
      findUnique: vi.fn(async () => world.progress ?? null),
      upsert: vi.fn(async (args: AnyArgs) => {
        progressUpserts.push(args as Record<string, unknown>);
        return {};
      }),
    },

    medalUnlock: {
      findMany: vi.fn(async () => unlocks.map((unlock) => ({ medalKey: unlock.medalKey }))),
      updateMany: vi.fn(async (args: AnyArgs) => {
        const where = (args.where ?? {}) as { medalKey?: { in?: string[] } };
        const wanted = where.medalKey?.in ?? [];
        const data = args.data as { seenAt: Date; source: string };
        let count = 0;
        for (const unlock of unlocks) {
          if (wanted.includes(unlock.medalKey)) {
            unlock.seenAt = data.seenAt;
            unlock.source = data.source;
            count += 1;
          }
        }
        return { count };
      }),
    },

    progressionSettings: {
      findUnique: vi.fn(async () => {
        settingsCalls.push("findUnique");
        return null;
      }),
      upsert: vi.fn(async () => {
        settingsCalls.push("upsert");
        return {};
      }),
      update: vi.fn(async () => {
        settingsCalls.push("update");
        return {};
      }),
    },
  };

  // The stub stands in for the real recompute, and writes the unlocks it "discovered" exactly the
  // way the real one does: unseen, and carrying the schema default source.
  recomputeMock.mockImplementation(async () => {
    const already = new Set(unlocks.map((unlock) => unlock.medalKey));
    const fresh = (world.unlocksThisRun ?? []).filter((medalKey) => !already.has(medalKey));
    for (const medalKey of fresh) {
      unlocks.push({ medalKey, seenAt: null, source: "LIVE" });
    }
    return { derivedTotal: 140, currentRankIndex: 3, highestRankIndex: 3, unlockedThisRun: fresh };
  });

  return { db, ledger, unlocks, settingsCalls, orderById };
}

/** Every entry the run offered and the ledger accepted, as `ruleKey|entityId`. */
function keysOf(ledger: LedgerRow[]): string[] {
  return ledger.map((row) => `${row.ruleKey}|${row.entityId}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runProgressionBackfill: migrated orders (FR-12-42)", () => {
  const migratedWorld: World = {
    orders: [
      {
        id: "order-1",
        storeId: "store-1",
        orderDate: civilDay(2024, 5, 10),
        paymentDay: civilDay(2024, 5, 12),
        migrated: true,
        settled: true,
        status: OrderStatus.COMPLETED,
      },
    ],
    deliveries: [{ id: "delivery-1", storeId: "store-1", receivedDate: civilDay(2024, 6, 20), orderIds: ["order-1"] }],
    migratedPayments: [
      { id: "payment-1", paymentDate: civilDay(2024, 5, 12), storeId: "store-1", orderIds: ["order-1"] },
    ],
  };

  it("writes exactly one synthetic entry set per migrated order, and never a second payment event", async () => {
    const { db, ledger } = makeWorld(migratedWorld);

    await runProgressionBackfill(db as never);

    // The import fused the advance and the balance into one record, so `order-settled` (and the
    // derived `order-completed`) cannot be evidenced separately and must not be invented.
    expect(keysOf(ledger)).toEqual(
      expect.arrayContaining([
        `${POINT_RULE_KEYS.ORDER_CREATED}|order-1`,
        `${POINT_RULE_KEYS.ORDER_REGISTERED}|order-1`,
        `${POINT_RULE_KEYS.ORDER_FIRST_PAYMENT}|order-1`,
        `${POINT_RULE_KEYS.DELIVERY_RECEIVED}|delivery-1`,
      ]),
    );
    expect(keysOf(ledger)).not.toContain(`${POINT_RULE_KEYS.ORDER_SETTLED}|order-1`);
    expect(keysOf(ledger)).not.toContain(`${POINT_RULE_KEYS.ORDER_COMPLETED}|order-1`);
  });

  it("stamps every entry BACKFILL and dates it on the real historical day, never today", async () => {
    const { db, ledger } = makeWorld(migratedWorld);

    await runProgressionBackfill(db as never);

    expect(ledger.length).toBeGreaterThan(0);
    expect(ledger.every((row) => row.source === "BACKFILL")).toBe(true);
    // The two dates the replay has to get right: the order's own day, and the arrival's.
    const created = ledger.find((row) => row.ruleKey === POINT_RULE_KEYS.ORDER_CREATED);
    const arrived = ledger.find((row) => row.ruleKey === POINT_RULE_KEYS.DELIVERY_RECEIVED);
    expect(created?.occurredOn).toEqual(civilDay(2024, 5, 10));
    expect(arrived?.occurredOn).toEqual(civilDay(2024, 6, 20));
    const paid = ledger.find((row) => row.ruleKey === POINT_RULE_KEYS.ORDER_FIRST_PAYMENT);
    expect(paid?.occurredOn).toEqual(civilDay(2024, 5, 12));
  });

  it("credits a non-migrated order for the settlement the migrated one cannot evidence", async () => {
    const { db, ledger } = makeWorld({
      ...migratedWorld,
      orders: [{ ...migratedWorld.orders![0], migrated: false }],
      migratedPayments: [],
    });

    await runProgressionBackfill(db as never);

    expect(keysOf(ledger)).toContain(`${POINT_RULE_KEYS.ORDER_SETTLED}|order-1`);
    expect(keysOf(ledger)).toContain(`${POINT_RULE_KEYS.ORDER_COMPLETED}|order-1`);
  });

  it("prices order-registered down the anti-split ladder within the store's civil month", async () => {
    const { db, ledger } = makeWorld({
      orders: ["a", "b", "c", "d"].map((suffix, index) => ({
        id: `order-${suffix}`,
        storeId: "store-1",
        orderDate: civilDay(2024, 5, 10 + index),
        paymentDay: civilDay(2024, 5, 12 + index),
      })),
    });

    await runProgressionBackfill(db as never);

    const registered = ledger
      .filter((row) => row.ruleKey === POINT_RULE_KEYS.ORDER_REGISTERED)
      .map((row) => row.points);
    // Same ladder the live path applies, with the floor of 5 that is never zero.
    expect(registered).toEqual([20, 15, 10, 5]);
  });

  it("credits nothing at all through a store that never got approved", async () => {
    const { db, ledger } = makeWorld({
      orders: [
        {
          id: "order-x",
          storeId: "store-unapproved",
          orderDate: civilDay(2024, 5, 10),
          paymentDay: civilDay(2024, 5, 11),
        },
      ],
    });

    const result = await runProgressionBackfill(db as never);

    expect(ledger).toEqual([]);
    expect(result.totalEntriesWritten).toBe(0);
    expect(db.pointLedgerEntry.createMany).not.toHaveBeenCalled();
  });
});

describe("runProgressionBackfill: idempotency (BACKFILL_ALREADY_APPLIED)", () => {
  it("writes nothing on a second run and reports it rather than throwing", async () => {
    const world: World = {
      orders: [
        {
          id: "order-1",
          storeId: "store-1",
          orderDate: civilDay(2024, 5, 10),
          paymentDay: civilDay(2024, 5, 12),
          migrated: true,
        },
      ],
      migratedPayments: [
        { id: "payment-1", paymentDate: civilDay(2024, 5, 12), storeId: "store-1", orderIds: ["order-1"] },
      ],
    };

    // One world, driven twice: the second pass sees the ledger the first one left behind, exactly
    // as re-running the script against the same database would.
    const { db, ledger } = makeWorld(world);

    const first = await runProgressionBackfill(db as never);
    const writtenAfterFirst = ledger.length;
    const second = await runProgressionBackfill(db as never);

    expect(first.totalEntriesWritten).toBeGreaterThan(0);
    expect(first.alreadyApplied).toBe(false);
    expect(second.totalEntriesWritten).toBe(0);
    expect(second.alreadyApplied).toBe(true);
    expect(second.users[0]?.alreadyApplied).toBe(true);
    expect(ledger.length).toBe(writtenAfterFirst);
  });
});

describe("runProgressionBackfill: BACKFILL_SOURCE_INCOMPLETE", () => {
  const brokenOrders: WorldOrder[] = [
    {
      id: "order-1",
      storeId: "store-1",
      orderDate: civilDay(2024, 5, 10),
      paymentDay: civilDay(2024, 5, 12),
      migrated: true,
    },
  ];

  it.each([
    ["no payment date", { id: "payment-1", paymentDate: null, storeId: "store-1", orderIds: ["order-1"] }],
    ["no store", { id: "payment-1", paymentDate: civilDay(2024, 5, 12), storeId: null, orderIds: ["order-1"] }],
    ["no resolvable order", { id: "payment-1", paymentDate: civilDay(2024, 5, 12), storeId: "store-1", orderIds: [] }],
  ])("aborts the whole run before any write when a migrated payment has %s", async (_label, payment) => {
    const { db, ledger } = makeWorld({ orders: brokenOrders, migratedPayments: [payment] });

    await expect(runProgressionBackfill(db as never)).rejects.toBeInstanceOf(ProgressionBackfillSourceIncompleteError);

    // Nothing at all, not even for the collectors the run would have reached first: a half applied
    // backfill cannot be re-run cleanly.
    expect(ledger).toEqual([]);
    expect(db.pointLedgerEntry.createMany).not.toHaveBeenCalled();
    expect(db.user.findMany).not.toHaveBeenCalled();
    expect(recomputeMock).not.toHaveBeenCalled();
  });

  it("names the offending payments so the operator can go and look at them", async () => {
    const { db } = makeWorld({
      orders: brokenOrders,
      migratedPayments: [{ id: "payment-broken", paymentDate: null, storeId: "store-1", orderIds: ["order-1"] }],
    });

    await expect(runProgressionBackfill(db as never)).rejects.toMatchObject({
      code: "BACKFILL_SOURCE_INCOMPLETE",
      incompletePaymentIds: ["payment-broken"],
    });
  });
});

describe("runProgressionBackfill: silent unlocks (FR-12-43)", () => {
  const unlockWorld: World = {
    orders: [
      { id: "order-1", storeId: "store-1", orderDate: civilDay(2024, 5, 10), paymentDay: civilDay(2024, 5, 12) },
    ],
    unlocks: [{ medalKey: "first-order", seenAt: null, source: "LIVE" }],
    unlocksThisRun: ["patience-200", "midnight-order"],
  };

  it("marks the unlocks it caused as already seen and relabels them BACKFILL", async () => {
    const { db, unlocks } = makeWorld(unlockWorld);

    const result = await runProgressionBackfill(db as never);

    const backfilled = unlocks.filter((unlock) => unlock.medalKey !== "first-order");
    expect(backfilled).toHaveLength(2);
    for (const unlock of backfilled) {
      expect(unlock.source).toBe("BACKFILL");
      expect(unlock.seenAt).toBeInstanceOf(Date);
    }
    expect(result.users[0]?.medalsUnlocked).toEqual(["patience-200", "midnight-order"]);
    expect(result.totalMedalsUnlocked).toBe(2);
  });

  it("never relabels a medal the collector had already unlocked before the run", async () => {
    const { db, unlocks } = makeWorld(unlockWorld);

    await runProgressionBackfill(db as never);

    const preexisting = unlocks.find((unlock) => unlock.medalKey === "first-order");
    // It was unlocked live and never celebrated; the backfill must leave both facts alone.
    expect(preexisting).toEqual({ medalKey: "first-order", seenAt: null, source: "LIVE" });
  });

  it("recomputes with the caller's own client, so the whole pass stays in one transaction", async () => {
    const { db } = makeWorld(unlockWorld);

    await runProgressionBackfill(db as never);

    expect(recomputeMock).toHaveBeenCalledWith(USER_ID, db);
  });

  it("issues no relabel at all when the run unlocked nothing", async () => {
    const { db } = makeWorld({ ...unlockWorld, unlocksThisRun: [] });

    await runProgressionBackfill(db as never);

    expect(db.medalUnlock.updateMany).not.toHaveBeenCalled();
  });
});

describe("runProgressionBackfill: progression settings", () => {
  it("never touches progression_settings, so the aggregated welcome survives the run", async () => {
    // The pending welcome is derived from "has BACKFILL entries and has never celebrated a rank".
    // Writing `lastCelebratedRankIndex` here would consume the celebration before it is ever shown.
    const { db, settingsCalls } = makeWorld({
      orders: [
        { id: "order-1", storeId: "store-1", orderDate: civilDay(2024, 5, 10), paymentDay: civilDay(2024, 5, 12) },
      ],
      unlocksThisRun: ["patience-200"],
    });

    await runProgressionBackfill(db as never);

    expect(settingsCalls).toEqual([]);
    expect(db.progressionSettings.upsert).not.toHaveBeenCalled();
    expect(db.progressionSettings.update).not.toHaveBeenCalled();
  });
});

describe("runProgressionBackfill: census", () => {
  it("reports the points and rank movement per collector, and no monetary figure", async () => {
    const { db } = makeWorld({
      orders: [
        { id: "order-1", storeId: "store-1", orderDate: civilDay(2024, 5, 10), paymentDay: civilDay(2024, 5, 12) },
      ],
      deliveries: [
        {
          id: "delivery-1",
          storeId: "store-1",
          receivedDate: civilDay(2024, 6, 1),
          orderIds: ["order-1"],
          productTypeKeys: ["figure"],
        },
      ],
      reviewedStoreIds: ["store-1"],
      progress: { maturedPoints: 0, rankIndex: 1 },
    });

    const result = await runProgressionBackfill(db as never);

    expect(result.usersProcessed).toBe(1);
    expect(result.users[0]).toEqual(
      expect.objectContaining({
        userId: USER_ID,
        pointsBefore: 0,
        pointsAfter: 140,
        rankIndexBefore: 1,
        rankIndexAfter: 3,
        alreadyApplied: false,
      }),
    );
    // The whole history a single order can produce, each fact keyed by the row it names.
    expect(Object.keys(result.users[0] ?? {})).not.toContain("amount");
  });

  it("credits the store, product type and review facts once each, keyed by their own entity", async () => {
    const { db, ledger } = makeWorld({
      orders: [
        { id: "order-1", storeId: "store-1", orderDate: civilDay(2024, 5, 10), paymentDay: civilDay(2024, 5, 12) },
        { id: "order-2", storeId: "store-1", orderDate: civilDay(2024, 7, 10), paymentDay: civilDay(2024, 7, 12) },
      ],
      deliveries: [
        {
          id: "delivery-1",
          storeId: "store-1",
          receivedDate: civilDay(2024, 6, 1),
          orderIds: ["order-1"],
          productTypeKeys: ["figure"],
        },
        {
          id: "delivery-2",
          storeId: "store-1",
          receivedDate: civilDay(2024, 8, 1),
          orderIds: ["order-2"],
          productTypeKeys: ["figure"],
        },
      ],
      reviewedStoreIds: ["store-1"],
    });

    await runProgressionBackfill(db as never);

    const keys = keysOf(ledger);
    expect(keys.filter((key) => key === `${POINT_RULE_KEYS.STORE_FIRST_ORDER}|store-1`)).toHaveLength(1);
    expect(keys.filter((key) => key === `${POINT_RULE_KEYS.STORE_REVIEWED}|store-1`)).toHaveLength(1);
    // Once per type, forever, and dated on the FIRST arrival rather than the latest one.
    const discovered = ledger.filter((row) => row.ruleKey === POINT_RULE_KEYS.PRODUCT_TYPE_DISCOVERED);
    expect(discovered).toHaveLength(1);
    expect(discovered[0]?.entityType).toBe(PROGRESSION_ENTITY_TYPES.PRODUCT_TYPE);
    expect(discovered[0]?.occurredOn).toEqual(civilDay(2024, 6, 1));
  });

  it("credits no review for a store the collector never received anything from", async () => {
    const { db, ledger } = makeWorld({
      orders: [
        { id: "order-1", storeId: "store-1", orderDate: civilDay(2024, 5, 10), paymentDay: civilDay(2024, 5, 12) },
      ],
      reviewedStoreIds: ["store-1"],
    });

    await runProgressionBackfill(db as never);

    expect(keysOf(ledger)).not.toContain(`${POINT_RULE_KEYS.STORE_REVIEWED}|store-1`);
  });

  it("credits no payment facts for an order nobody has ever paid", async () => {
    const { db, ledger } = makeWorld({
      orders: [{ id: "order-1", storeId: "store-1", orderDate: civilDay(2024, 5, 10) }],
    });

    const keys = () => keysOf(ledger);
    await runProgressionBackfill(db as never);

    expect(keys()).toContain(`${POINT_RULE_KEYS.ORDER_CREATED}|order-1`);
    expect(keys()).not.toContain(`${POINT_RULE_KEYS.ORDER_FIRST_PAYMENT}|order-1`);
    expect(keys()).not.toContain(`${POINT_RULE_KEYS.ORDER_REGISTERED}|order-1`);
  });
});

describe("runProgressionBackfill: delivery state", () => {
  it("ignores a delivery whose products belong to no creditable order", async () => {
    const { db, ledger } = makeWorld({
      orders: [
        {
          id: "order-1",
          storeId: "store-1",
          status: OrderStatus.CANCELLED,
          orderDate: civilDay(2024, 5, 10),
          paymentDay: civilDay(2024, 5, 12),
        },
      ],
      deliveries: [{ id: "delivery-1", storeId: "store-1", receivedDate: civilDay(2024, 6, 1), orderIds: ["order-1"] }],
    });

    await runProgressionBackfill(db as never);

    // A cancelled order is out of the replay entirely, and its arrival goes with it.
    expect(ledger).toEqual([]);
  });

  it("only ever asks the database for deliveries that actually arrived", async () => {
    const { db } = makeWorld({
      orders: [
        { id: "order-1", storeId: "store-1", orderDate: civilDay(2024, 5, 10), paymentDay: civilDay(2024, 5, 12) },
      ],
    });

    await runProgressionBackfill(db as never);

    expect(db.delivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: DeliveryStatus.DELIVERED }) }),
    );
  });
});

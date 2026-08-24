import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeliveryStatus, OrderItemDeliveryState, StoreStatus } from "../../../../../generated/prisma/client";
import {
  MEDAL_CATALOGUE,
  MEDAL_SERIES_ORDER,
  getMeritLockDenominator,
  getShippedMedalCount,
  listStatefulUnlockedMedals,
  resolveConditionsToEvaluate,
  selectUnlockedMedals,
  SHIPPED_MEDALS,
} from "../medalCatalogue";
import { evaluateUnlocks, getCivilHour, resolveStatefulMedalCurrency } from "../medalEvaluation";
import { civilDay, eligibleStore, makeFakeDb, OTHER_USER_ID, USER_ID, type FakeWorld } from "./progressionFixtures";

/**
 * The medal catalogue and the evaluator behind it.
 *
 * Every condition here is a claim about the collector's real rows, so the tests describe a WORLD
 * (these orders, at these stores, arriving on these days) and let the real query shapes run against
 * it. A test that stubbed "condition satisfied: true" would assert nothing at all: the entire risk
 * in this module is that a condition reads the wrong column, or reads the right one at the wrong
 * moment, and a stub is blind to both.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** A civil day N days after the given one, in the UTC-midnight shape domain dates are stored in. */
function daysAfter(start: Date, days: number): Date {
  return new Date(start.getTime() + days * DAY_MS);
}

const ORDER_DAY = civilDay(2026, 1, 10);

async function unlockedKeysFor(world: FakeWorld, alreadyUnlockedKeys: string[] = []): Promise<string[]> {
  const { db } = makeFakeDb(world);
  const candidates = await evaluateUnlocks({ userId: USER_ID, alreadyUnlockedKeys, db: db as never });
  return candidates.map((candidate) => candidate.medalKey);
}

/** A collector one order, one payment and one arrival into the app, all at a creditable store. */
function firstStepsWorld(): FakeWorld {
  return {
    stores: [eligibleStore("store-1")],
    orders: [{ id: "order-1", storeId: "store-1", orderDate: ORDER_DAY }],
    paidOrderIds: ["order-1"],
    deliveries: [
      {
        id: "delivery-1",
        storeId: "store-1",
        status: DeliveryStatus.DELIVERED,
        orderIds: ["order-1"],
        receivedDate: daysAfter(ORDER_DAY, 10),
      },
    ],
    items: [{ orderId: "order-1", productTypeKey: "figure", deliveryState: OrderItemDeliveryState.DELIVERED }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("catalogue shape", () => {
  it("ships twelve of twenty-four medals across six series", () => {
    expect(MEDAL_CATALOGUE).toHaveLength(24);
    expect(getShippedMedalCount()).toBe(12);
    expect(new Set(MEDAL_CATALOGUE.map((medal) => medal.series)).size).toBe(MEDAL_SERIES_ORDER.length);
  });

  it("keeps every medal key unique, because the key is the idempotency key", () => {
    const keys = MEDAL_CATALOGUE.map((medal) => medal.medalKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("carries the phase-3 event columns on every row, unset (FR-12-28)", () => {
    for (const medal of MEDAL_CATALOGUE) {
      expect(medal.availableFrom).toBeNull();
      expect(medal.availableTo).toBeNull();
      expect(medal.numbered).toBe(false);
    }
  });

  it("classifies publicSafe on every medal, including the ones that leak volume (FR-12-24)", () => {
    const byKey = new Map(MEDAL_CATALOGUE.map((medal) => [medal.medalKey, medal]));
    expect(byKey.get("first-order")?.publicSafe).toBe(true);
    expect(byKey.get("collection-50")?.publicSafe).toBe(false);
    expect(byKey.get("stores-10")?.publicSafe).toBe(false);
  });

  it("grants no points: no medal carries anything a ledger could read (FR-12-22, BR-12-08)", () => {
    // The ledger's own contract is `{ ruleKey, points }`. A medal that ever grew either field would
    // become creditable by accident, so the absence is asserted rather than assumed.
    for (const medal of MEDAL_CATALOGUE) {
      expect(medal).not.toHaveProperty("points");
      expect(medal).not.toHaveProperty("ruleKey");
    }
  });

  it("ships exactly one secret medal, and it is midnight-order", () => {
    const secrets = SHIPPED_MEDALS.filter((medal) => medal.secret);
    expect(secrets.map((medal) => medal.medalKey)).toEqual(["midnight-order"]);
  });
});

describe("getMeritLockDenominator", () => {
  it("counts every shipped medal while all of them are within reach", () => {
    expect(getMeritLockDenominator([])).toBe(getShippedMedalCount());
  });

  it("drops a medal that depends on another user's action, and any closed event window", () => {
    // No phase-1 medal is uncontrollable or windowed, so the rule is exercised over the catalogue
    // shape itself rather than over a fixture that could drift away from it.
    const uncontrollable = MEDAL_CATALOGUE.filter((medal) => !medal.controllable);
    expect(uncontrollable.map((medal) => medal.medalKey)).toEqual(["store-mapped-1"]);

    const shippedUncontrollable = SHIPPED_MEDALS.filter((medal) => !medal.controllable);
    expect(getMeritLockDenominator([])).toBe(getShippedMedalCount() - shippedUncontrollable.length);
  });

  it("keeps a medal the collector already holds in the denominator", () => {
    // Excluding an unreachable medal somebody actually earned would shrink the gate for exactly the
    // collectors who cleared the hardest part of it.
    const held = SHIPPED_MEDALS.map((medal) => medal.medalKey);
    expect(getMeritLockDenominator(held)).toBe(getShippedMedalCount());
  });
});

describe("selectUnlockedMedals", () => {
  it("returns nothing for a medal already held, whatever its condition says", () => {
    const candidates = selectUnlockedMedals({
      satisfiedConditions: new Set(["any-order"]),
      alreadyUnlockedKeys: ["first-order", "first-store"],
    });
    expect(candidates).toEqual([]);
  });

  it("returns candidates in catalogue order, so the celebration queue is deterministic", () => {
    const candidates = selectUnlockedMedals({
      satisfiedConditions: new Set(["any-arrival", "any-order"]),
      alreadyUnlockedKeys: [],
    });
    expect(candidates.map((candidate) => candidate.medalKey)).toEqual(["first-order", "first-arrival", "first-store"]);
  });

  it("never offers a phase-2 medal, whose condition this build cannot even resolve", () => {
    const candidates = selectUnlockedMedals({
      satisfiedConditions: new Set(["products-delivered-10"]),
      alreadyUnlockedKeys: [],
    });
    expect(candidates).toEqual([]);
  });
});

describe("resolveConditionsToEvaluate", () => {
  it("stops asking about a medal already held", () => {
    const conditions = resolveConditionsToEvaluate(SHIPPED_MEDALS.map((medal) => medal.medalKey));
    // Only the stateful ones, whose currency has to be re-derived every time.
    expect([...conditions].sort()).toEqual(["order-fully-closed", "review-after-arrival"]);
  });

  it("asks about everything for a collector with an empty album", () => {
    expect(resolveConditionsToEvaluate([]).size).toBeGreaterThan(0);
    expect(listStatefulUnlockedMedals([])).toEqual([]);
  });
});

describe("evaluateUnlocks", () => {
  it("unlocks the first-steps medals for a first order, first payment and first arrival", async () => {
    const keys = await unlockedKeysFor(firstStepsWorld());

    expect(keys).toEqual(expect.arrayContaining(["first-order", "first-payment", "first-arrival", "first-store"]));
  });

  it("offers nothing a second time for a medal already unlocked (idempotency)", async () => {
    const world = firstStepsWorld();
    const first = await unlockedKeysFor(world);
    const second = await unlockedKeysFor(world, first);

    expect(second).toEqual([]);
  });

  it("credits no points: the evaluator never touches the ledger", async () => {
    const { db } = makeFakeDb(firstStepsWorld());

    await evaluateUnlocks({ userId: USER_ID, alreadyUnlockedKeys: [], db: db as never });

    expect(db.pointLedgerEntry.findMany).not.toHaveBeenCalled();
    expect(db.pointLedgerEntry.updateMany).not.toHaveBeenCalled();
  });

  it("unlocks normally through an approved public store the collector registered (BR-12-07)", async () => {
    const world = firstStepsWorld();
    const keys = await unlockedKeysFor({
      ...world,
      stores: [{ ...eligibleStore("store-1"), createdByUserId: USER_ID }],
    });

    // Registering the store you buy from is the ordinary flow; approval is the anti-abuse lock.
    expect(keys).toEqual(await unlockedKeysFor(world));
    expect(keys.length).toBeGreaterThan(0);
  });

  it("unlocks nothing through a store that was rejected (BR-12-07)", async () => {
    const world = firstStepsWorld();
    const keys = await unlockedKeysFor({
      ...world,
      stores: [{ ...eligibleStore("store-1"), status: StoreStatus.REJECTED }],
    });

    expect(keys).toEqual([]);
  });

  it("unlocks nothing through a store that is not approved yet (BR-12-07)", async () => {
    const world = firstStepsWorld();
    const keys = await unlockedKeysFor({
      ...world,
      stores: [{ ...eligibleStore("store-1"), status: StoreStatus.PENDING }],
    });

    expect(keys).toEqual([]);
  });

  it("unlocks nothing through a private store (BR-12-07)", async () => {
    const world = firstStepsWorld();
    const keys = await unlockedKeysFor({ ...world, stores: [{ ...eligibleStore("store-1"), isPrivate: true }] });

    expect(keys).toEqual([]);
  });
});

describe("first-order-closed", () => {
  /** One order, fully arrived or not, fully covered or not. */
  function closedWorld(options: { allocated: number; everyItemDelivered: boolean }): FakeWorld {
    return {
      stores: [eligibleStore("store-1")],
      orders: [
        {
          id: "order-1",
          storeId: "store-1",
          orderDate: ORDER_DAY,
          totalCost: 10_000,
          allocatedAmountMinor: options.allocated,
        },
      ],
      items: [
        { orderId: "order-1", productTypeKey: "figure", deliveryState: OrderItemDeliveryState.DELIVERED },
        {
          orderId: "order-1",
          productTypeKey: "manga",
          deliveryState: options.everyItemDelivered
            ? OrderItemDeliveryState.DELIVERED
            : OrderItemDeliveryState.ARRIVED_AT_STORE,
        },
      ],
    };
  }

  it("does not unlock while the order still owes money", async () => {
    const keys = await unlockedKeysFor(closedWorld({ allocated: 4_000, everyItemDelivered: true }));
    expect(keys).not.toContain("first-order-closed");
  });

  it("does not unlock while one product has not arrived", async () => {
    const keys = await unlockedKeysFor(closedWorld({ allocated: 10_000, everyItemDelivered: false }));
    expect(keys).not.toContain("first-order-closed");
  });

  it("unlocks once the balance is zero and every product is delivered", async () => {
    const keys = await unlockedKeysFor(closedWorld({ allocated: 10_000, everyItemDelivered: true }));
    expect(keys).toContain("first-order-closed");
  });

  it("stays unlocked but stops being current when a product goes back in transit (AC-12-12)", async () => {
    const { db } = makeFakeDb(closedWorld({ allocated: 10_000, everyItemDelivered: false }));

    const currency = await resolveStatefulMedalCurrency(USER_ID, ["first-order-closed"], db as never);

    // The unlock itself is untouched: nothing here deletes or hides a row. Only the line changes.
    expect(currency.get("first-order-closed")).toBe(false);
  });

  it("reports a stateful medal as current while its state still holds", async () => {
    const { db } = makeFakeDb(closedWorld({ allocated: 10_000, everyItemDelivered: true }));

    const currency = await resolveStatefulMedalCurrency(USER_ID, ["first-order-closed"], db as never);

    expect(currency.get("first-order-closed")).toBe(true);
  });
});

describe("the wait", () => {
  /** One order fully arrived `days` after it was placed. */
  function waitWorld(days: number): FakeWorld {
    return {
      stores: [eligibleStore("store-1")],
      orders: [{ id: "order-1", storeId: "store-1", orderDate: ORDER_DAY }],
      deliveries: [
        {
          id: "delivery-1",
          storeId: "store-1",
          status: DeliveryStatus.DELIVERED,
          orderIds: ["order-1"],
          receivedDate: daysAfter(ORDER_DAY, days),
        },
      ],
      items: [{ orderId: "order-1", productTypeKey: "figure", deliveryState: OrderItemDeliveryState.DELIVERED }],
    };
  }

  it("does not unlock patience-60 at 59 days", async () => {
    expect(await unlockedKeysFor(waitWorld(59))).not.toContain("patience-60");
  });

  it("unlocks patience-60 at exactly 60 days", async () => {
    expect(await unlockedKeysFor(waitWorld(60))).toContain("patience-60");
  });

  it("does not unlock patience-120 at 65 days", async () => {
    const keys = await unlockedKeysFor(waitWorld(65));
    expect(keys).toContain("patience-60");
    expect(keys).not.toContain("patience-120");
  });

  it("ignores an order that has not fully arrived, however long it has been open", async () => {
    const world = waitWorld(300);
    const keys = await unlockedKeysFor({
      ...world,
      items: [
        { orderId: "order-1", productTypeKey: "figure", deliveryState: OrderItemDeliveryState.DELIVERED },
        { orderId: "order-1", productTypeKey: "manga", deliveryState: OrderItemDeliveryState.NONE },
      ],
    });

    expect(keys).not.toContain("patience-60");
  });
});

describe("split-arrival", () => {
  const twoItems = [
    { orderId: "order-1", productTypeKey: "figure", deliveryState: OrderItemDeliveryState.DELIVERED },
    { orderId: "order-1", productTypeKey: "manga", deliveryState: OrderItemDeliveryState.DELIVERED },
  ];

  it("does not unlock for an order covered by a single delivery", async () => {
    const keys = await unlockedKeysFor({
      stores: [eligibleStore("store-1")],
      orders: [{ id: "order-1", storeId: "store-1", orderDate: ORDER_DAY }],
      deliveries: [
        {
          id: "delivery-1",
          storeId: "store-1",
          status: DeliveryStatus.DELIVERED,
          orderIds: ["order-1"],
          receivedDate: daysAfter(ORDER_DAY, 5),
        },
      ],
      items: twoItems,
    });

    expect(keys).not.toContain("split-arrival");
  });

  it("unlocks for an order whose products arrived through two deliveries", async () => {
    const keys = await unlockedKeysFor({
      stores: [eligibleStore("store-1")],
      orders: [{ id: "order-1", storeId: "store-1", orderDate: ORDER_DAY }],
      deliveries: [
        {
          id: "delivery-1",
          storeId: "store-1",
          status: DeliveryStatus.DELIVERED,
          orderIds: ["order-1"],
          receivedDate: daysAfter(ORDER_DAY, 5),
        },
        {
          id: "delivery-2",
          storeId: "store-1",
          status: DeliveryStatus.DELIVERED,
          orderIds: ["order-1"],
          receivedDate: daysAfter(ORDER_DAY, 9),
        },
      ],
      items: [
        { ...twoItems[0], deliveryIds: ["delivery-1"] },
        { ...twoItems[1], deliveryIds: ["delivery-2"] },
      ],
    });

    expect(keys).toContain("split-arrival");
  });
});

describe("midnight-order", () => {
  /** Lima is UTC-5 all year, so 03:59 civil is 08:59 UTC and 04:01 civil is 09:01 UTC. */
  function midnightWorld(createdAtUtc: string): FakeWorld {
    return {
      stores: [eligibleStore("store-1")],
      orders: [{ id: "order-1", storeId: "store-1", orderDate: ORDER_DAY, createdAt: new Date(createdAtUtc) }],
      timezone: "America/Lima",
    };
  }

  it("resolves the civil hour in the collector's own timezone, never the raw UTC hour", () => {
    // The trap this test exists for: at 08:59Z the UTC hour is 8, and reading it would credit
    // nobody in Lima and everybody in Bangkok.
    expect(getCivilHour(new Date("2026-03-10T08:59:00Z"), "America/Lima")).toBe(3);
    expect(getCivilHour(new Date("2026-03-10T08:59:00Z"), "UTC")).toBe(8);
  });

  it("unlocks for an order created at 03:59 civil time", async () => {
    expect(await unlockedKeysFor(midnightWorld("2026-03-10T08:59:00Z"))).toContain("midnight-order");
  });

  it("does not unlock for an order created at 04:01 civil time", async () => {
    expect(await unlockedKeysFor(midnightWorld("2026-03-10T09:01:00Z"))).not.toContain("midnight-order");
  });
});

describe("first-photo-order", () => {
  const world: FakeWorld = {
    stores: [eligibleStore("store-1")],
    orders: [{ id: "order-1", storeId: "store-1", orderDate: ORDER_DAY }],
  };

  it("unlocks when the call site hands over the note it just wrote", async () => {
    const { db } = makeFakeDb(world);

    const candidates = await evaluateUnlocks({
      userId: USER_ID,
      alreadyUnlockedKeys: [],
      context: { createdOrderNote: "[image-intake:0123456789abcdef]" },
      db: db as never,
    });

    expect(candidates.map((candidate) => candidate.medalKey)).toContain("first-photo-order");
  });

  it("does not unlock for an order typed by hand", async () => {
    const { db } = makeFakeDb(world);

    const candidates = await evaluateUnlocks({
      userId: USER_ID,
      alreadyUnlockedKeys: [],
      context: { createdOrderNote: "Compré esto en la feria" },
      db: db as never,
    });

    expect(candidates.map((candidate) => candidate.medalKey)).not.toContain("first-photo-order");
  });

  it("is never re-derived from stored notes, so editing one later cannot take it away", async () => {
    // Without a call-time context there is nothing to read, and the medal simply is not offered.
    // That is the whole safety property: an already-written unlock row is immutable, and a later
    // recompute has no note-scanning path that could contradict it.
    const keys = await unlockedKeysFor(world);

    expect(keys).not.toContain("first-photo-order");
  });
});

describe("first-review", () => {
  const reviewedWorld: FakeWorld = {
    stores: [eligibleStore("store-1")],
    orders: [{ id: "order-1", storeId: "store-1", orderDate: ORDER_DAY }],
    items: [{ orderId: "order-1", productTypeKey: "figure", deliveryState: OrderItemDeliveryState.DELIVERED }],
    reviewedStoreIds: ["store-1"],
  };

  it("unlocks for a review of a store the collector received from", async () => {
    expect(await unlockedKeysFor(reviewedWorld)).toContain("first-review");
  });

  it("does not unlock for a review of a store nothing ever arrived from", async () => {
    const keys = await unlockedKeysFor({
      ...reviewedWorld,
      items: [{ orderId: "order-1", productTypeKey: "figure", deliveryState: OrderItemDeliveryState.NONE }],
    });

    expect(keys).not.toContain("first-review");
  });

  it("does not unlock for a store the collector never reviewed", async () => {
    expect(await unlockedKeysFor({ ...reviewedWorld, reviewedStoreIds: [] })).not.toContain("first-review");
  });
});

describe("query cost", () => {
  it("asks nothing at all of a collector who already holds every non-stateful medal", async () => {
    const { db } = makeFakeDb(firstStepsWorld());
    const nonStateful = SHIPPED_MEDALS.filter((medal) => !medal.stateful).map((medal) => medal.medalKey);

    await evaluateUnlocks({ userId: USER_ID, alreadyUnlockedKeys: nonStateful, db: db as never });

    // Only the two stateful conditions are resolved, so the album getting fuller makes the
    // evaluator cheaper rather than more expensive.
    expect(db.order.findMany.mock.calls.length + db.order.findFirst.mock.calls.length).toBeLessThanOrEqual(3);
    expect(db.delivery.findFirst).not.toHaveBeenCalled();
  });

  it("scopes every read to the session collector, never to another user's rows", async () => {
    const { db } = makeFakeDb(firstStepsWorld());

    await evaluateUnlocks({ userId: OTHER_USER_ID, alreadyUnlockedKeys: [], db: db as never });

    for (const call of db.order.findFirst.mock.calls) {
      expect((call[0] as { where: { userId: string } }).where.userId).toBe(OTHER_USER_ID);
    }
  });
});

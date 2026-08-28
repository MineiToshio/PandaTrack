import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeliveryStatus, OrderItemDeliveryState, StoreStatus } from "../../../../../generated/prisma/client";
import {
  MEDAL_CATALOGUE,
  MEDAL_RARITY_ORDER,
  MEDAL_SERIES_ORDER,
  getMeritLockDenominator,
  getShippedMedalCount,
  listMedalsBySeries,
  listStatefulUnlockedMedals,
  resolveConditionsToEvaluate,
  selectUnlockedMedals,
  SHIPPED_MEDALS,
} from "../medalCatalogue";
import { RANK_LADDER, isMeritLockSatisfied, type MeritLockedRankIndex } from "../rankLadder";
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
  it("ships all twenty-eight medals across six series", () => {
    expect(MEDAL_CATALOGUE).toHaveLength(28);
    expect(getShippedMedalCount()).toBe(28);
    expect(new Set(MEDAL_CATALOGUE.map((medal) => medal.series)).size).toBe(MEDAL_SERIES_ORDER.length);
  });

  it("leaves no medal unshipped, so the album renders no coming-soon tile", () => {
    // The album's "próximamente" treatment keys off exactly this: a row this build cannot award.
    // While none exists, the collector is never told to wait for content.
    expect(MEDAL_CATALOGUE.filter((medal) => medal.phase !== 1)).toEqual([]);
    expect(SHIPPED_MEDALS).toHaveLength(MEDAL_CATALOGUE.length);
  });

  it("fills every album page: eight on page one and four on each of the rest", () => {
    // A page of three leaves a hole on both the two-column and the four-column layout.
    const sizes = listMedalsBySeries().map((page) => page.medals.length);

    expect(sizes).toEqual([8, 4, 4, 4, 4, 4]);
  });

  it("spreads rarity like a print run: descending from normal to a single signed piece", () => {
    const counts = MEDAL_RARITY_ORDER.map(
      (rarity) => MEDAL_CATALOGUE.filter((medal) => medal.rarity === rarity).length,
    );

    expect(counts).toEqual([10, 7, 5, 5, 1]);
  });

  it("gives every medal a distinct condition, so no two pieces read the same fact", () => {
    // The `first-store` bug in reverse: two medals sharing a condition unlock in the same instant
    // from the same act, and the second one reads as padding.
    const conditions = MEDAL_CATALOGUE.map((medal) => medal.condition);

    expect(new Set(conditions).size).toBe(conditions.length);
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

  it("ships four secret medals, and they are the whole secrets page", () => {
    const secrets = SHIPPED_MEDALS.filter((medal) => medal.secret);

    expect(secrets.map((medal) => medal.medalKey)).toEqual([
      "midnight-order",
      "swift-arrival",
      "same-day-settle",
      "year-streak",
    ]);
  });

  it("no longer carries the retired store-mapped-1 row", () => {
    expect(MEDAL_CATALOGUE.map((medal) => medal.medalKey)).not.toContain("store-mapped-1");
    expect(MEDAL_CATALOGUE.map((medal) => medal.medalKey)).toContain("store-charted-1");
  });
});

describe("getMeritLockDenominator", () => {
  it("counts every shipped medal while all of them are within reach", () => {
    expect(getMeritLockDenominator([])).toBe(28);
    expect(getMeritLockDenominator([])).toBe(getShippedMedalCount());
  });

  it("leaves nothing outside the collector's own reach to drop", () => {
    // `store-mapped-1` waited on a stranger ordering from a store the collector registered, and it
    // was the only row the exclusion rule ever had anything to bite on. Its replacement moved the
    // finish line to the part the collector controls, so the gate is no longer hostage to anybody.
    expect(MEDAL_CATALOGUE.filter((medal) => !medal.controllable)).toEqual([]);
    expect(MEDAL_CATALOGUE.filter((medal) => medal.availableTo !== null)).toEqual([]);
  });

  it("keeps a medal the collector already holds in the denominator", () => {
    // Excluding an unreachable medal somebody actually earned would shrink the gate for exactly the
    // collectors who cleared the hardest part of it.
    const held = SHIPPED_MEDALS.map((medal) => medal.medalKey);
    expect(getMeritLockDenominator(held)).toBe(getShippedMedalCount());
  });
});

describe("the merit lock over the real catalogue", () => {
  /** Fewest medals that satisfy a locked rank's fraction of the current denominator. */
  function requiredMedals(rankIndex: MeritLockedRankIndex): number {
    const denominator = getMeritLockDenominator([]);
    for (let unlocked = 0; unlocked <= denominator; unlocked += 1) {
      if (isMeritLockSatisfied(rankIndex, unlocked, denominator)) return unlocked;
    }
    throw new Error(`no count satisfies the lock for rank ${rankIndex}`);
  }

  it("keeps the approved fractions while the catalogue grows under them", () => {
    // The gate was written as a fraction precisely so shipping the rest of the album would move the
    // count without anybody renegotiating the rule.
    const locked = RANK_LADDER.filter((entry) => entry.meritLockFraction !== undefined);

    expect(locked.map((entry) => entry.meritLockFraction)).toEqual([0.45, 0.6]);
  });

  it("asks 13 medals for rank 9 and 17 for rank 10, against a catalogue of 28", () => {
    expect(getMeritLockDenominator([])).toBe(28);
    expect(requiredMedals(9)).toBe(13);
    expect(requiredMedals(10)).toBe(17);
  });

  it("does not let 12 medals reach rank 9, nor 16 reach rank 10", () => {
    expect(isMeritLockSatisfied(9, 12, getMeritLockDenominator([]))).toBe(false);
    expect(isMeritLockSatisfied(10, 16, getMeritLockDenominator([]))).toBe(false);
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
    expect(candidates.map((candidate) => candidate.medalKey)).toEqual(["first-order", "first-arrival"]);
  });

  it("offers a promoted medal now that its condition resolves", () => {
    // The same call returned nothing while `the display case` was catalogued but not shipped.
    const candidates = selectUnlockedMedals({
      satisfiedConditions: new Set(["products-delivered-10"]),
      alreadyUnlockedKeys: [],
    });
    expect(candidates.map((candidate) => candidate.medalKey)).toEqual(["collection-10"]);
  });
});

describe("resolveConditionsToEvaluate", () => {
  it("stops asking about a medal already held", () => {
    const conditions = resolveConditionsToEvaluate(SHIPPED_MEDALS.map((medal) => medal.medalKey));
    // Only the stateful ones, whose currency has to be re-derived every time.
    expect([...conditions].sort()).toEqual([
      "arrivals-25",
      "complete-record-1",
      "complete-record-10",
      "countries-3",
      "order-fully-closed",
      "product-types-3",
      "product-types-6",
      "products-delivered-10",
      "products-delivered-150",
      "products-delivered-50",
      "review-after-arrival",
      "reviews-5",
      "stores-with-arrival-10",
    ]);
  });

  it("asks about everything for a collector with an empty album", () => {
    expect(resolveConditionsToEvaluate([]).size).toBeGreaterThan(0);
    expect(listStatefulUnlockedMedals([])).toEqual([]);
  });
});

describe("evaluateUnlocks", () => {
  it("unlocks the first-steps medals for a first order, first payment and first arrival", async () => {
    const keys = await unlockedKeysFor(firstStepsWorld());

    expect(keys).toEqual(expect.arrayContaining(["first-order", "first-payment", "first-arrival"]));
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

    // Registering the store you buy from is the ordinary flow; approval is the anti-abuse lock. The
    // one difference is `store-charted-1`, whose whole subject is having registered it.
    expect(keys.filter((key) => key !== "store-charted-1")).toEqual(await unlockedKeysFor(world));
    expect(keys).toContain("store-charted-1");
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

describe("first-store, an order at a SECOND store", () => {
  /** `count` orders, each at its own creditable store. */
  function storesWorld(count: number): FakeWorld {
    return {
      stores: Array.from({ length: count }, (_, index) => eligibleStore(`store-${index + 1}`)),
      orders: Array.from({ length: count }, (_, index) => ({
        id: `order-${index + 1}`,
        storeId: `store-${index + 1}`,
        orderDate: ORDER_DAY,
      })),
    };
  }

  it("does not hand out two medals for the collector's very first order", async () => {
    // The bug this replaces: `first-store` resolved `ANY_ORDER`, the same fact as `first-order`, so
    // one click unlocked both in the same instant and the second read as padding.
    const keys = await unlockedKeysFor(storesWorld(1));

    expect(keys).toContain("first-order");
    expect(keys).not.toContain("first-store");
  });

  it("does not unlock for a second order at the SAME store", async () => {
    const world = storesWorld(1);
    const keys = await unlockedKeysFor({
      ...world,
      orders: [...world.orders!, { id: "order-2", storeId: "store-1", orderDate: ORDER_DAY }],
    });

    expect(keys).not.toContain("first-store");
  });

  it("unlocks once an order exists at a second, different store", async () => {
    expect(await unlockedKeysFor(storesWorld(2))).toContain("first-store");
  });

  it("does not count a second store that cannot credit (BR-12-07)", async () => {
    const world = storesWorld(2);
    const keys = await unlockedKeysFor({
      ...world,
      stores: [eligibleStore("store-1"), { ...eligibleStore("store-2"), status: StoreStatus.PENDING }],
    });

    expect(keys).not.toContain("first-store");
  });
});

describe("first-preorder", () => {
  function preorderWorld(window: { expectedDeliveryFrom?: Date | null; expectedDeliveryTo?: Date | null }): FakeWorld {
    return {
      stores: [eligibleStore("store-1")],
      orders: [{ id: "order-1", storeId: "store-1", orderDate: ORDER_DAY, ...window }],
    };
  }

  it("does not unlock for an order with no expected arrival at all", async () => {
    expect(await unlockedKeysFor(preorderWorld({}))).not.toContain("first-preorder");
  });

  it("unlocks when only the far end of the window is recorded", async () => {
    // Recording "llega para abril" is the collector declaring this is a pre-reserva just as much as
    // recording both ends is, so either column alone has to answer yes.
    const keys = await unlockedKeysFor(preorderWorld({ expectedDeliveryTo: daysAfter(ORDER_DAY, 90) }));

    expect(keys).toContain("first-preorder");
  });

  it("unlocks when only the near end of the window is recorded", async () => {
    const keys = await unlockedKeysFor(preorderWorld({ expectedDeliveryFrom: daysAfter(ORDER_DAY, 60) }));

    expect(keys).toContain("first-preorder");
  });

  it("does not unlock through a store that cannot credit (BR-12-07)", async () => {
    const keys = await unlockedKeysFor({
      ...preorderWorld({ expectedDeliveryTo: daysAfter(ORDER_DAY, 90) }),
      stores: [{ ...eligibleStore("store-1"), isPrivate: true }],
    });

    expect(keys).not.toContain("first-preorder");
  });
});

describe("the display case", () => {
  /** One order carrying `count` delivered product lines. */
  function shelfWorld(count: number): FakeWorld {
    return {
      stores: [eligibleStore("store-1")],
      orders: [{ id: "order-1", storeId: "store-1", orderDate: ORDER_DAY }],
      items: Array.from({ length: count }, () => ({
        orderId: "order-1",
        productTypeKey: "figure",
        deliveryState: OrderItemDeliveryState.DELIVERED,
      })),
    };
  }

  it("does not unlock collection-10 at nine products", async () => {
    expect(await unlockedKeysFor(shelfWorld(9))).not.toContain("collection-10");
  });

  it("unlocks collection-10 at exactly ten products", async () => {
    const keys = await unlockedKeysFor(shelfWorld(10));

    expect(keys).toContain("collection-10");
    expect(keys).not.toContain("collection-50");
  });

  it("counts only products that actually arrived", async () => {
    const world = shelfWorld(10);
    const keys = await unlockedKeysFor({
      ...world,
      items: world.items!.map((item, index) =>
        index < 5 ? item : { ...item, deliveryState: OrderItemDeliveryState.ARRIVED_AT_STORE },
      ),
    });

    expect(keys).not.toContain("collection-10");
  });

  it("counts nothing through a store that cannot credit (BR-12-07)", async () => {
    const keys = await unlockedKeysFor({
      ...shelfWorld(10),
      stores: [{ ...eligibleStore("store-1"), status: StoreStatus.REJECTED }],
    });

    expect(keys).not.toContain("collection-10");
  });
});

describe("arrivals-25", () => {
  /** `count` delivered deliveries, all from one store. */
  function arrivalsWorld(count: number): FakeWorld {
    return {
      stores: [eligibleStore("store-1")],
      orders: [{ id: "order-1", storeId: "store-1", orderDate: ORDER_DAY }],
      deliveries: Array.from({ length: count }, (_, index) => ({
        id: `delivery-${index + 1}`,
        storeId: "store-1",
        status: DeliveryStatus.DELIVERED,
        orderIds: ["order-1"],
        receivedDate: daysAfter(ORDER_DAY, 5),
      })),
    };
  }

  it("does not unlock at twenty-four deliveries", async () => {
    expect(await unlockedKeysFor(arrivalsWorld(24))).not.toContain("arrivals-25");
  });

  it("unlocks at exactly twenty-five deliveries", async () => {
    expect(await unlockedKeysFor(arrivalsWorld(25))).toContain("arrivals-25");
  });

  it("ignores deliveries still in transit", async () => {
    const world = arrivalsWorld(25);
    const keys = await unlockedKeysFor({
      ...world,
      deliveries: world.deliveries!.map((delivery, index) =>
        index === 0 ? { ...delivery, status: DeliveryStatus.IN_TRANSIT } : delivery,
      ),
    });

    expect(keys).not.toContain("arrivals-25");
  });
});

describe("the explorer's counters", () => {
  /** One delivered product line per named type, at one creditable store. */
  function typesWorld(types: Array<string | null>): FakeWorld {
    return {
      stores: [eligibleStore("store-1")],
      orders: [{ id: "order-1", storeId: "store-1", orderDate: ORDER_DAY }],
      items: types.map((productTypeKey) => ({
        orderId: "order-1",
        productTypeKey,
        deliveryState: OrderItemDeliveryState.DELIVERED,
      })),
    };
  }

  it("does not unlock variety-3 at two distinct types, however many products there are", async () => {
    const keys = await unlockedKeysFor(typesWorld(["figure", "figure", "manga", "manga"]));

    expect(keys).not.toContain("variety-3");
  });

  it("unlocks variety-3 at three distinct types", async () => {
    const keys = await unlockedKeysFor(typesWorld(["figure", "manga", "card"]));

    expect(keys).toContain("variety-3");
    expect(keys).not.toContain("variety-6");
  });

  it("does not count an uncategorised product as a type of its own", async () => {
    // `productTypeKey` is nullable, and a run of blanks collapsing into one "type" would hand out
    // the variety medals for never having filled the field in.
    const keys = await unlockedKeysFor(typesWorld(["figure", "manga", null, null, null]));

    expect(keys).not.toContain("variety-3");
  });

  /** `count` creditable stores, each with one delivered delivery, optionally spread over countries. */
  function storeMapWorld(count: number, countries?: string[]): FakeWorld {
    return {
      stores: Array.from({ length: count }, (_, index) => ({
        ...eligibleStore(`store-${index + 1}`),
        countryCode: countries?.[index] ?? "PE",
      })),
      orders: Array.from({ length: count }, (_, index) => ({
        id: `order-${index + 1}`,
        storeId: `store-${index + 1}`,
        orderDate: ORDER_DAY,
      })),
      deliveries: Array.from({ length: count }, (_, index) => ({
        id: `delivery-${index + 1}`,
        storeId: `store-${index + 1}`,
        status: DeliveryStatus.DELIVERED,
        orderIds: [`order-${index + 1}`],
        receivedDate: daysAfter(ORDER_DAY, 5),
      })),
    };
  }

  it("does not unlock stores-10 at nine stores that delivered", async () => {
    expect(await unlockedKeysFor(storeMapWorld(9))).not.toContain("stores-10");
  });

  it("unlocks stores-10 at exactly ten stores that delivered", async () => {
    expect(await unlockedKeysFor(storeMapWorld(10))).toContain("stores-10");
  });

  it("does not unlock countries-3 for three stores sharing one country", async () => {
    const keys = await unlockedKeysFor(storeMapWorld(3, ["JP", "JP", "JP"]));

    expect(keys).not.toContain("countries-3");
  });

  it("unlocks countries-3 for stores in three different countries", async () => {
    expect(await unlockedKeysFor(storeMapWorld(3, ["JP", "US", "PE"]))).toContain("countries-3");
  });

  it("counts a country only once something actually arrived from it", async () => {
    const world = storeMapWorld(3, ["JP", "US", "PE"]);
    const keys = await unlockedKeysFor({ ...world, deliveries: world.deliveries!.slice(0, 2) });

    expect(keys).not.toContain("countries-3");
  });
});

describe("the chronicler's clean records", () => {
  /** `count` orders, each with one product line, complete unless said otherwise. */
  function recordWorld(count: number, options: { blank?: "price" | "type" } = {}): FakeWorld {
    return {
      stores: [eligibleStore("store-1")],
      orders: Array.from({ length: count }, (_, index) => ({
        id: `order-${index + 1}`,
        storeId: "store-1",
        orderDate: ORDER_DAY,
      })),
      items: Array.from({ length: count }, (_, index) => ({
        orderId: `order-${index + 1}`,
        productTypeKey: options.blank === "type" ? null : "figure",
        unitPrice: options.blank === "price" ? null : 1_000,
      })),
    };
  }

  it("does not unlock clean-record-1 while a product has no price written down", async () => {
    expect(await unlockedKeysFor(recordWorld(1, { blank: "price" }))).not.toContain("clean-record-1");
  });

  it("does not unlock clean-record-1 while a product has no type written down", async () => {
    expect(await unlockedKeysFor(recordWorld(1, { blank: "type" }))).not.toContain("clean-record-1");
  });

  it("unlocks clean-record-1 for one order whose every field is filled in", async () => {
    const keys = await unlockedKeysFor(recordWorld(1));

    expect(keys).toContain("clean-record-1");
    expect(keys).not.toContain("clean-record-10");
  });

  it("does not count an order with no products at all as a spotless record", async () => {
    const keys = await unlockedKeysFor({ ...recordWorld(1), items: [] });

    expect(keys).not.toContain("clean-record-1");
  });

  it("unlocks clean-record-10 at exactly ten complete orders", async () => {
    expect(await unlockedKeysFor(recordWorld(9))).not.toContain("clean-record-10");
    expect(await unlockedKeysFor(recordWorld(10))).toContain("clean-record-10");
  });
});

describe("store-charted-1", () => {
  function chartedWorld(store: Partial<FakeWorld["stores"] extends undefined ? never : object>): FakeWorld {
    return {
      stores: [{ ...eligibleStore("store-1"), createdByUserId: USER_ID, ...store }],
      orders: [{ id: "order-1", storeId: "store-1", orderDate: ORDER_DAY }],
    };
  }

  it("unlocks for a store the collector registered that survived moderation", async () => {
    expect(await unlockedKeysFor(chartedWorld({}))).toContain("store-charted-1");
  });

  it("does not unlock for a store somebody else registered", async () => {
    expect(await unlockedKeysFor(chartedWorld({ createdByUserId: OTHER_USER_ID }))).not.toContain("store-charted-1");
  });

  it("does not unlock while the store is still waiting for approval", async () => {
    expect(await unlockedKeysFor(chartedWorld({ status: StoreStatus.PENDING }))).not.toContain("store-charted-1");
  });

  it("does not unlock for a private store, which is on nobody's map", async () => {
    expect(await unlockedKeysFor(chartedWorld({ isPrivate: true }))).not.toContain("store-charted-1");
  });
});

describe("reviews-5", () => {
  /** `count` creditable stores the collector received from and reviewed. */
  function reviewsWorld(count: number): FakeWorld {
    return {
      stores: Array.from({ length: count }, (_, index) => eligibleStore(`store-${index + 1}`)),
      orders: Array.from({ length: count }, (_, index) => ({
        id: `order-${index + 1}`,
        storeId: `store-${index + 1}`,
        orderDate: ORDER_DAY,
      })),
      items: Array.from({ length: count }, (_, index) => ({
        orderId: `order-${index + 1}`,
        productTypeKey: "figure",
        deliveryState: OrderItemDeliveryState.DELIVERED,
      })),
      reviewedStoreIds: Array.from({ length: count }, (_, index) => `store-${index + 1}`),
    };
  }

  it("does not unlock at four reviews", async () => {
    const keys = await unlockedKeysFor(reviewsWorld(4));

    expect(keys).toContain("first-review");
    expect(keys).not.toContain("reviews-5");
  });

  it("unlocks at exactly five reviews", async () => {
    expect(await unlockedKeysFor(reviewsWorld(5))).toContain("reviews-5");
  });

  it("does not count a review of a store nothing ever arrived from", async () => {
    const world = reviewsWorld(5);
    const keys = await unlockedKeysFor({
      ...world,
      items: world.items!.map((item, index) =>
        index === 0 ? { ...item, deliveryState: OrderItemDeliveryState.NONE } : item,
      ),
    });

    expect(keys).not.toContain("reviews-5");
  });
});

describe("swift-arrival", () => {
  /** One order fully arrived `days` after it was placed. */
  function swiftWorld(days: number): FakeWorld {
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

  it("does not unlock for an order that took eight days", async () => {
    expect(await unlockedKeysFor(swiftWorld(8))).not.toContain("swift-arrival");
  });

  it("unlocks for an order that took exactly seven days", async () => {
    expect(await unlockedKeysFor(swiftWorld(7))).toContain("swift-arrival");
  });

  it("unlocks for an order that arrived the very same day", async () => {
    expect(await unlockedKeysFor(swiftWorld(0))).toContain("swift-arrival");
  });

  it("ignores an order that has not fully arrived, however fast the first box was", async () => {
    const world = swiftWorld(1);
    const keys = await unlockedKeysFor({
      ...world,
      items: [
        ...world.items!,
        { orderId: "order-1", productTypeKey: "manga", deliveryState: OrderItemDeliveryState.NONE },
      ],
    });

    expect(keys).not.toContain("swift-arrival");
  });
});

describe("same-day-settle", () => {
  const ARRIVAL_DAY = daysAfter(ORDER_DAY, 30);

  /** One fully arrived order, with money declared on `paymentDate`. */
  function settleWorld(paymentDate: Date | null, allocated = 0): FakeWorld {
    return {
      stores: [eligibleStore("store-1")],
      orders: [
        { id: "order-1", storeId: "store-1", orderDate: ORDER_DAY, totalCost: 10_000, allocatedAmountMinor: allocated },
      ],
      deliveries: [
        {
          id: "delivery-1",
          storeId: "store-1",
          status: DeliveryStatus.DELIVERED,
          orderIds: ["order-1"],
          receivedDate: ARRIVAL_DAY,
        },
      ],
      items: [{ orderId: "order-1", productTypeKey: "figure", deliveryState: OrderItemDeliveryState.DELIVERED }],
      paymentDays: paymentDate ? [{ orderId: "order-1", paymentDate }] : [],
    };
  }

  it("unlocks when the order was settled and money was declared on the arrival day", async () => {
    expect(await unlockedKeysFor(settleWorld(ARRIVAL_DAY, 10_000))).toContain("same-day-settle");
  });

  it("does not unlock when the money was declared the day before it arrived", async () => {
    const keys = await unlockedKeysFor(settleWorld(daysAfter(ARRIVAL_DAY, -1), 10_000));

    expect(keys).not.toContain("same-day-settle");
  });

  it("does not unlock while the order still owes money", async () => {
    expect(await unlockedKeysFor(settleWorld(ARRIVAL_DAY, 4_000))).not.toContain("same-day-settle");
  });

  it("does not unlock for an order that never fully arrived", async () => {
    const world = settleWorld(ARRIVAL_DAY, 10_000);
    const keys = await unlockedKeysFor({
      ...world,
      items: [
        ...world.items!,
        { orderId: "order-1", productTypeKey: "manga", deliveryState: OrderItemDeliveryState.NONE },
      ],
    });

    expect(keys).not.toContain("same-day-settle");
  });
});

describe("year-streak", () => {
  /** One order in each of the given `YYYY-MM` offsets from January 2025. */
  function streakWorld(monthOffsets: number[]): FakeWorld {
    return {
      stores: [eligibleStore("store-1")],
      orders: monthOffsets.map((offset) => ({
        id: `order-${offset}`,
        storeId: "store-1",
        orderDate: civilDay(2025 + Math.floor(offset / 12), (offset % 12) + 1, 5),
      })),
    };
  }

  const consecutive = (count: number) => Array.from({ length: count }, (_, index) => index);

  it("does not unlock at eleven consecutive months", async () => {
    expect(await unlockedKeysFor(streakWorld(consecutive(11)))).not.toContain("year-streak");
  });

  it("unlocks at exactly twelve consecutive months", async () => {
    expect(await unlockedKeysFor(streakWorld(consecutive(12)))).toContain("year-streak");
  });

  it("does not unlock when a month in the middle is missing", async () => {
    // Fourteen months of orders with a hole at month six is two runs, not one run of fourteen.
    const withGap = consecutive(14).filter((month) => month !== 6);

    expect(await unlockedKeysFor(streakWorld(withGap))).not.toContain("year-streak");
  });

  it("counts a month once however many orders it holds", async () => {
    const repeated = [...consecutive(11), 10, 10, 10, 10];

    expect(await unlockedKeysFor(streakWorld(repeated))).not.toContain("year-streak");
  });
});

describe("medal artwork", () => {
  it("points every imageKey at a file that actually exists in public/medals", () => {
    // `MedalStage` renders the placeholder medallion for a null key and an `<Image>` for a present
    // one, so a key naming a file nobody dropped in ships a broken tile rather than a graceful
    // fallback. Only a check against the filesystem can see that; the types cannot.
    const missing = MEDAL_CATALOGUE.filter(
      (medal) =>
        medal.imageKey !== null && !existsSync(join(process.cwd(), "public", "medals", `${medal.imageKey}.png`)),
    );

    expect(missing.map((medal) => medal.medalKey)).toEqual([]);
  });

  it("names the artwork after the medal, so publishing a piece is one edit", () => {
    for (const medal of MEDAL_CATALOGUE) {
      if (medal.imageKey !== null) {
        expect(medal.imageKey).toBe(medal.medalKey);
      }
    }
  });
});

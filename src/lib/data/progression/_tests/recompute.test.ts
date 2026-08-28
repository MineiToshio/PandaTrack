import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeliveryStatus,
  OrderItemDeliveryState,
  OrderStatus,
  StoreStatus,
  StoreVisibility,
} from "../../../../../generated/prisma/client";
import { POINT_RULE_KEYS, PROGRESSION_ENTITY_TYPES, orderRegisteredPoints } from "../pointRules";
import { applyCaps, recomputeUserProgress, type RecomputeLedgerEntry } from "../recompute";
import {
  civilDay,
  eligibleStore,
  ledgerEntry,
  makeFakeDb,
  OTHER_USER_ID,
  USER_ID,
  type FakeWorld,
} from "./progressionFixtures";

const { ORDER, DELIVERY, STORE, PRODUCT_TYPE } = PROGRESSION_ENTITY_TYPES;

async function derivedTotalFor(world: FakeWorld): Promise<number> {
  const { db } = makeFakeDb(world);
  const result = await recomputeUserProgress(USER_ID, db as never);
  return result.derivedTotal;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cap enforcement", () => {
  it("caps order-created in EVENTS, not points (AC-12-01)", () => {
    // Twenty create-and-cancel cycles in one month. The cap is ten EVENTS, so ten entries count and
    // the rest contribute nothing: 50 points, never 100.
    const entries: RecomputeLedgerEntry[] = Array.from({ length: 20 }, (_unused, index) =>
      ledgerEntry({
        ruleKey: POINT_RULE_KEYS.ORDER_CREATED,
        entityType: ORDER,
        entityId: `order-${index}`,
        points: 5,
        occurredOn: civilDay(2026, 3, (index % 28) + 1),
      }),
    );

    expect(applyCaps(entries)).toBe(50);
  });

  it("keeps a points cap and an events cap from being conflated (BR-12-15)", () => {
    // Same ten entries, same month. Read as ten events the delivery rule would pay 250; its cap is
    // 200 POINTS, so it pays 200. Reading either cap in the other's unit changes both answers.
    const deliveries = Array.from({ length: 10 }, (_unused, index) =>
      ledgerEntry({
        ruleKey: POINT_RULE_KEYS.DELIVERY_RECEIVED,
        entityType: DELIVERY,
        entityId: `delivery-${index}`,
        points: 25,
        occurredOn: civilDay(2026, 3, index + 1),
      }),
    );

    expect(applyCaps(deliveries)).toBe(200);
  });

  it("resets a monthly cap on the civil month boundary and never re-buckets an old entry", () => {
    const march = Array.from({ length: 12 }, (_unused, index) =>
      ledgerEntry({
        ruleKey: POINT_RULE_KEYS.ORDER_CREATED,
        entityType: ORDER,
        entityId: `march-${index}`,
        points: 5,
        occurredOn: civilDay(2026, 3, index + 1),
      }),
    );
    const april = Array.from({ length: 3 }, (_unused, index) =>
      ledgerEntry({
        ruleKey: POINT_RULE_KEYS.ORDER_CREATED,
        entityType: ORDER,
        entityId: `april-${index}`,
        points: 5,
        occurredOn: civilDay(2026, 4, index + 1),
      }),
    );

    // March pays its ten-event ceiling, April starts fresh.
    expect(applyCaps([...march, ...april])).toBe(50 + 15);
  });

  it("counts a lifetime cap per entity, so it is not a single credit for the whole rule", () => {
    // Two different product types discovered in the same month. Grouping a lifetime cap by rule
    // alone would pay 12 once; it is once per TYPE, forever, so it pays both.
    const discoveries = ["figure", "manga"].map((key) =>
      ledgerEntry({
        ruleKey: POINT_RULE_KEYS.PRODUCT_TYPE_DISCOVERED,
        entityType: PRODUCT_TYPE,
        entityId: key,
        points: 12,
        occurredOn: civilDay(2026, 3, 4),
      }),
    );

    expect(applyCaps(discoveries)).toBe(24);
  });

  it("pays the remainder of a points cap rather than dropping the entry that crosses it", () => {
    // 20 + 15 + 10 + 5 x 14 = 115 uncapped over the 120 ceiling... the entry that crosses it
    // contributes only what is left, so the ceiling is reached exactly instead of stopping short.
    const entries = Array.from({ length: 8 }, (_unused, index) =>
      ledgerEntry({
        ruleKey: POINT_RULE_KEYS.ORDER_FIRST_PAYMENT,
        entityType: ORDER,
        entityId: `order-${index}`,
        points: 30,
        occurredOn: civilDay(2026, 3, index + 1),
      }),
    );

    // Cap is 80 points: 30 + 30 + the 20 that is left of the third.
    expect(applyCaps(entries)).toBe(80);
  });

  it("is deterministic whatever order the rows arrive in (AC-12-14)", () => {
    const entries = Array.from({ length: 15 }, (_unused, index) =>
      ledgerEntry({
        ruleKey: POINT_RULE_KEYS.ORDER_CREATED,
        entityType: ORDER,
        entityId: `order-${index}`,
        points: 5,
        occurredOn: civilDay(2026, 3, 1),
      }),
    );

    expect(applyCaps([...entries].reverse())).toBe(applyCaps(entries));
  });
});

describe("the anti-split ladder", () => {
  it("pays 20 / 15 / 10 then a floor of 5, never zero (FR-12-07, BR-12-14)", () => {
    const paid = [1, 2, 3, 4, 5, 8].map((position) => orderRegisteredPoints({ storeMonthPosition: position }));

    expect(paid).toEqual([20, 15, 10, 5, 5, 5]);
  });

  it("makes eight same-store orders worth strictly less than eight cross-store ones (AC-12-09)", () => {
    const sameStore = Array.from({ length: 8 }, (_unused, index) =>
      ledgerEntry({
        ruleKey: POINT_RULE_KEYS.ORDER_REGISTERED,
        entityType: ORDER,
        entityId: `same-${index}`,
        points: orderRegisteredPoints({ storeMonthPosition: index + 1 }),
        occurredOn: civilDay(2026, 3, index + 1),
      }),
    );
    const crossStore = Array.from({ length: 8 }, (_unused, index) =>
      ledgerEntry({
        ruleKey: POINT_RULE_KEYS.ORDER_REGISTERED,
        entityType: ORDER,
        entityId: `cross-${index}`,
        // Every order is the first at its own store, so every one is priced at the top of the ladder.
        points: orderRegisteredPoints({ storeMonthPosition: 1 }),
        occurredOn: civilDay(2026, 3, index + 1),
      }),
    );

    const sameStoreTotal = applyCaps(sameStore);
    const crossStoreTotal = applyCaps(crossStore);
    const eightTimesFirstOrder = 8 * 20;

    expect(sameStoreTotal).toBeLessThan(crossStoreTotal);
    expect(sameStoreTotal).toBeLessThan(eightTimesFirstOrder);
    expect(crossStoreTotal).toBeLessThan(eightTimesFirstOrder);
  });
});

describe("eligibility against current state", () => {
  const store = eligibleStore("store-1");

  it("keeps order-created through cancel, reactivate, cancel (AC-12-04, BR-12-16)", async () => {
    const entry = ledgerEntry({
      ruleKey: POINT_RULE_KEYS.ORDER_CREATED,
      entityType: ORDER,
      entityId: "order-1",
      points: 5,
    });

    const cancelled = await derivedTotalFor({
      stores: [store],
      orders: [{ id: "order-1", storeId: "store-1", status: OrderStatus.CANCELLED }],
      ledger: [entry],
    });
    const reactivated = await derivedTotalFor({
      stores: [store],
      orders: [{ id: "order-1", storeId: "store-1", status: OrderStatus.OPEN }],
      ledger: [entry],
    });

    // Cancelling is a real outcome, not something to be punished for recording.
    expect(cancelled).toBe(5);
    expect(reactivated).toBe(5);
  });

  it("stops counting an order that was physically deleted (BR-12-05)", async () => {
    const total = await derivedTotalFor({
      stores: [store],
      // The order row is gone; the ledger row survives it, which is how the recompute can notice.
      orders: [],
      ledger: [
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.ORDER_CREATED, entityType: ORDER, entityId: "order-1", points: 5 }),
      ],
    });

    expect(total).toBe(0);
  });

  it("credits only order-created for an order with no assigned payment (AC-12-08, BR-12-13)", async () => {
    const world: FakeWorld = {
      stores: [store],
      orders: [{ id: "order-1", storeId: "store-1", status: OrderStatus.PARTIALLY_DELIVERED }],
      paidOrderIds: [],
      deliveries: [{ id: "delivery-1", storeId: "store-1", status: DeliveryStatus.DELIVERED, orderIds: ["order-1"] }],
      ledger: [
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.ORDER_CREATED, entityType: ORDER, entityId: "order-1", points: 5 }),
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.ORDER_REGISTERED, entityType: ORDER, entityId: "order-1", points: 20 }),
        ledgerEntry({
          ruleKey: POINT_RULE_KEYS.DELIVERY_RECEIVED,
          entityType: DELIVERY,
          entityId: "delivery-1",
          points: 25,
        }),
      ],
    };

    // Self-declaring an order and marking it arrived would otherwise be ~50 free points with no
    // money having moved anywhere.
    expect(await derivedTotalFor(world)).toBe(5);
  });

  it("credits the same order once its first payment lands", async () => {
    const world: FakeWorld = {
      stores: [store],
      orders: [{ id: "order-1", storeId: "store-1", status: OrderStatus.PARTIALLY_DELIVERED }],
      paidOrderIds: ["order-1"],
      deliveries: [{ id: "delivery-1", storeId: "store-1", status: DeliveryStatus.DELIVERED, orderIds: ["order-1"] }],
      ledger: [
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.ORDER_CREATED, entityType: ORDER, entityId: "order-1", points: 5 }),
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.ORDER_REGISTERED, entityType: ORDER, entityId: "order-1", points: 20 }),
        ledgerEntry({
          ruleKey: POINT_RULE_KEYS.DELIVERY_RECEIVED,
          entityType: DELIVERY,
          entityId: "delivery-1",
          points: 25,
        }),
      ],
    };

    expect(await derivedTotalFor(world)).toBe(50);
  });

  it("credits an arrival once across deliver, reopen and delete (AC-12-03)", async () => {
    const base: FakeWorld = {
      stores: [store],
      orders: [{ id: "order-1", storeId: "store-1" }],
      paidOrderIds: ["order-1"],
      ledger: [
        ledgerEntry({
          ruleKey: POINT_RULE_KEYS.DELIVERY_RECEIVED,
          entityType: DELIVERY,
          entityId: "delivery-1",
          points: 25,
        }),
      ],
    };

    const delivered = await derivedTotalFor({
      ...base,
      deliveries: [{ id: "delivery-1", storeId: "store-1", status: DeliveryStatus.DELIVERED, orderIds: ["order-1"] }],
    });
    const reopened = await derivedTotalFor({
      ...base,
      deliveries: [{ id: "delivery-1", storeId: "store-1", status: DeliveryStatus.IN_TRANSIT, orderIds: ["order-1"] }],
      ledger: base.ledger,
    });
    const deleted = await derivedTotalFor({ ...base, deliveries: [] });
    const recreated = await derivedTotalFor({
      ...base,
      deliveries: [{ id: "delivery-2", storeId: "store-1", status: DeliveryStatus.DELIVERED, orderIds: ["order-1"] }],
      // Recreating writes a second row; the first names a delivery that no longer exists, so only
      // one of them ever counts and the total returns to where it was.
      ledger: [
        ...(base.ledger ?? []),
        ledgerEntry({
          ruleKey: POINT_RULE_KEYS.DELIVERY_RECEIVED,
          entityType: DELIVERY,
          entityId: "delivery-2",
          points: 25,
        }),
      ],
    });

    expect(delivered).toBe(25);
    expect(reopened).toBe(0);
    expect(deleted).toBe(0);
    expect(recreated).toBe(25);
  });

  it.each([
    ["a private store", { isPrivate: true }],
    ["a store hidden from the public directory", { visibility: StoreVisibility.PRIVATE }],
    ["a store still awaiting approval", { status: StoreStatus.PENDING }],
    ["a store that was rejected", { status: StoreStatus.REJECTED }],
  ])("credits nothing for %s (AC-12-07, BR-12-07)", async (_label, storeOverride) => {
    const total = await derivedTotalFor({
      stores: [{ ...eligibleStore("store-1"), ...storeOverride }],
      orders: [{ id: "order-1", storeId: "store-1" }],
      paidOrderIds: ["order-1"],
      deliveries: [{ id: "delivery-1", storeId: "store-1", status: DeliveryStatus.DELIVERED, orderIds: ["order-1"] }],
      items: [{ orderId: "order-1", productTypeKey: "figure", deliveryState: OrderItemDeliveryState.DELIVERED }],
      ledger: [
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.ORDER_CREATED, entityType: ORDER, entityId: "order-1", points: 5 }),
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.ORDER_REGISTERED, entityType: ORDER, entityId: "order-1", points: 20 }),
        ledgerEntry({
          ruleKey: POINT_RULE_KEYS.DELIVERY_RECEIVED,
          entityType: DELIVERY,
          entityId: "delivery-1",
          points: 25,
        }),
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.STORE_FIRST_ORDER, entityType: STORE, entityId: "store-1", points: 20 }),
        ledgerEntry({
          ruleKey: POINT_RULE_KEYS.PRODUCT_TYPE_DISCOVERED,
          entityType: PRODUCT_TYPE,
          entityId: "figure",
          points: 12,
        }),
      ],
    });

    expect(total).toBe(0);
  });

  it("credits in full at an approved public store the collector registered themselves (BR-12-07)", async () => {
    // The Notion import attributed every store to the collector, and registering the store you buy
    // from is the ordinary flow. Approval, not authorship, is the anti-abuse lock.
    const world: FakeWorld = {
      stores: [{ ...eligibleStore("store-1"), createdByUserId: USER_ID }],
      orders: [{ id: "order-1", storeId: "store-1" }],
      paidOrderIds: ["order-1"],
      deliveries: [{ id: "delivery-1", storeId: "store-1", status: DeliveryStatus.DELIVERED, orderIds: ["order-1"] }],
      items: [{ orderId: "order-1", productTypeKey: "figure", deliveryState: OrderItemDeliveryState.DELIVERED }],
      ledger: [
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.ORDER_CREATED, entityType: ORDER, entityId: "order-1", points: 5 }),
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.ORDER_REGISTERED, entityType: ORDER, entityId: "order-1", points: 20 }),
        ledgerEntry({
          ruleKey: POINT_RULE_KEYS.DELIVERY_RECEIVED,
          entityType: DELIVERY,
          entityId: "delivery-1",
          points: 25,
        }),
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.STORE_FIRST_ORDER, entityType: STORE, entityId: "store-1", points: 20 }),
        ledgerEntry({
          ruleKey: POINT_RULE_KEYS.PRODUCT_TYPE_DISCOVERED,
          entityType: PRODUCT_TYPE,
          entityId: "figure",
          points: 12,
        }),
      ],
    };

    expect(await derivedTotalFor(world)).toBe(82);
  });

  it("credits a discovery only once the product has actually arrived (AC-12-15)", async () => {
    const world: FakeWorld = {
      stores: [eligibleStore("store-1")],
      orders: [{ id: "order-1", storeId: "store-1" }],
      ledger: [
        ledgerEntry({
          ruleKey: POINT_RULE_KEYS.PRODUCT_TYPE_DISCOVERED,
          entityType: PRODUCT_TYPE,
          entityId: "figure",
          points: 12,
        }),
      ],
    };

    const inTransit = await derivedTotalFor({
      ...world,
      items: [{ orderId: "order-1", productTypeKey: "figure", deliveryState: OrderItemDeliveryState.IN_TRANSIT }],
    });
    const delivered = await derivedTotalFor({
      ...world,
      items: [{ orderId: "order-1", productTypeKey: "figure", deliveryState: OrderItemDeliveryState.DELIVERED }],
    });

    expect(inTransit).toBe(0);
    expect(delivered).toBe(12);
  });

  it("credits store-first-order only while a live order at that store remains", async () => {
    const world: FakeWorld = {
      stores: [eligibleStore("store-1")],
      ledger: [
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.STORE_FIRST_ORDER, entityType: STORE, entityId: "store-1", points: 20 }),
      ],
    };

    const withOrder = await derivedTotalFor({ ...world, orders: [{ id: "order-1", storeId: "store-1" }] });
    const cancelledOnly = await derivedTotalFor({
      ...world,
      orders: [{ id: "order-1", storeId: "store-1", status: OrderStatus.CANCELLED }],
    });

    expect(withOrder).toBe(20);
    expect(cancelledOnly).toBe(0);
  });

  it("credits order-settled only when the balance is exactly covered", async () => {
    const world: FakeWorld = {
      stores: [eligibleStore("store-1")],
      paidOrderIds: ["order-1"],
      ledger: [
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.ORDER_SETTLED, entityType: ORDER, entityId: "order-1", points: 12 }),
      ],
    };

    const partiallyPaid = await derivedTotalFor({
      ...world,
      orders: [{ id: "order-1", storeId: "store-1", totalCost: 10_000, allocatedAmountMinor: 4_000 }],
    });
    const settled = await derivedTotalFor({
      ...world,
      orders: [{ id: "order-1", storeId: "store-1", totalCost: 10_000, allocatedAmountMinor: 10_000 }],
    });

    expect(partiallyPaid).toBe(0);
    expect(settled).toBe(12);
  });

  it("credits order-completed only while the order is still COMPLETED", async () => {
    const world: FakeWorld = {
      stores: [eligibleStore("store-1")],
      paidOrderIds: ["order-1"],
      ledger: [
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.ORDER_COMPLETED, entityType: ORDER, entityId: "order-1", points: 30 }),
      ],
    };

    expect(
      await derivedTotalFor({
        ...world,
        orders: [{ id: "order-1", storeId: "store-1", status: OrderStatus.COMPLETED }],
      }),
    ).toBe(30);
    expect(
      await derivedTotalFor({
        ...world,
        orders: [{ id: "order-1", storeId: "store-1", status: OrderStatus.PARTIALLY_DELIVERED }],
      }),
    ).toBe(0);
  });

  it("ignores an entry whose rule is no longer in the catalogue", async () => {
    const total = await derivedTotalFor({
      stores: [eligibleStore("store-1")],
      orders: [{ id: "order-1", storeId: "store-1" }],
      ledger: [ledgerEntry({ ruleKey: "retired-rule", entityType: ORDER, entityId: "order-1", points: 999 })],
    });

    // A retired rule stops paying; it does not take the collector's whole progression down with it.
    expect(total).toBe(0);
  });
});

describe("recomputeUserProgress", () => {
  it("excludes a voided entry whatever the state of the entity it names", async () => {
    const world: FakeWorld = {
      stores: [eligibleStore("store-1")],
      orders: [
        { id: "order-1", storeId: "store-1" },
        { id: "order-2", storeId: "store-1" },
      ],
      ledger: [
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.ORDER_CREATED, entityType: ORDER, entityId: "order-1", points: 5 }),
        ledgerEntry({
          ruleKey: POINT_RULE_KEYS.ORDER_CREATED,
          entityType: ORDER,
          entityId: "order-2",
          points: 5,
          voidedAt: new Date("2026-03-20T00:00:00.000Z"),
        }),
      ],
    };

    // Both orders are perfectly healthy; only the void separates them.
    expect(await derivedTotalFor(world)).toBe(5);
  });

  it("produces identical output on two consecutive runs (AC-12-14)", async () => {
    const { db } = makeFakeDb({
      stores: [eligibleStore("store-1")],
      orders: [{ id: "order-1", storeId: "store-1" }],
      paidOrderIds: ["order-1"],
      ledger: [
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.ORDER_CREATED, entityType: ORDER, entityId: "order-1", points: 5 }),
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.ORDER_REGISTERED, entityType: ORDER, entityId: "order-1", points: 20 }),
      ],
    });

    const first = await recomputeUserProgress(USER_ID, db as never);
    const second = await recomputeUserProgress(USER_ID, db as never);

    expect(second).toEqual(first);
  });

  it("never lowers the highest rank reached, even when the total collapses (BR-12-06)", async () => {
    const { db, upserts } = makeFakeDb({
      stores: [eligibleStore("store-1")],
      // Every entity is gone, so the derived total is zero.
      orders: [],
      progress: { highestRankIndex: 6 },
      ledger: [
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.ORDER_CREATED, entityType: ORDER, entityId: "order-1", points: 5 }),
      ],
    });

    const result = await recomputeUserProgress(USER_ID, db as never);

    expect(result.derivedTotal).toBe(0);
    expect(result.highestRankIndex).toBe(6);
    expect(upserts.at(-1)).toMatchObject({ maturedPoints: 0, highestRankIndex: 6 });
  });

  it("writes the derived figures into the rebuildable cache", async () => {
    const { db, upserts } = makeFakeDb({
      stores: [eligibleStore("store-1")],
      orders: [{ id: "order-1", storeId: "store-1" }],
      ledger: [
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.ORDER_CREATED, entityType: ORDER, entityId: "order-1", points: 5 }),
      ],
    });

    await recomputeUserProgress(USER_ID, db as never);

    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({ maturedPoints: 5, rankIndex: 1, highestRankIndex: 1 });
    expect(upserts[0]?.lastRecomputedAt).toBeInstanceOf(Date);
  });

  it("resolves eligibility in batch, one query per entity type", async () => {
    const { db } = makeFakeDb({
      stores: [eligibleStore("store-1")],
      orders: Array.from({ length: 30 }, (_unused, index) => ({ id: `order-${index}`, storeId: "store-1" })),
      ledger: Array.from({ length: 30 }, (_unused, index) =>
        ledgerEntry({
          ruleKey: POINT_RULE_KEYS.ORDER_CREATED,
          entityType: ORDER,
          entityId: `order-${index}`,
          points: 5,
        }),
      ),
    });

    // The medal evaluator has query costs of its own; this test is about the LEDGER's reads, so it
    // is silenced rather than counted, and its own cost is asserted in `medalCatalogue.test.ts`.
    const medalEvaluation = await import("../medalEvaluation");
    vi.spyOn(medalEvaluation, "evaluateUnlocks").mockResolvedValue([]);

    await recomputeUserProgress(USER_ID, db as never);

    // Thirty entries must not become thirty round trips: the cost has to grow with the number of
    // entity KINDS, not with the length of the collector's history.
    expect(db.order.findMany).toHaveBeenCalledTimes(1);
    expect(db.paymentAllocation.findMany).toHaveBeenCalledTimes(1);

    vi.mocked(medalEvaluation.evaluateUnlocks).mockRestore();
  });

  it("persists medals the evaluator returns, keyed for idempotency", async () => {
    const medalEvaluation = await import("../medalEvaluation");
    vi.spyOn(medalEvaluation, "evaluateUnlocks").mockResolvedValue([
      { medalKey: "first-order", series: "first-steps", rarity: "normal", numbered: false },
    ]);

    const { db, createdUnlocks } = makeFakeDb({
      stores: [eligibleStore("store-1")],
      orders: [{ id: "order-1", storeId: "store-1" }],
      ledger: [
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.ORDER_CREATED, entityType: ORDER, entityId: "order-1", points: 5 }),
      ],
    });

    const result = await recomputeUserProgress(USER_ID, db as never);

    expect(result.unlockedThisRun).toEqual(["first-order"]);
    expect(createdUnlocks[0]).toMatchObject({ userId: USER_ID, medalKey: "first-order", series: "first-steps" });
    expect(db.medalUnlock.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));

    vi.mocked(medalEvaluation.evaluateUnlocks).mockRestore();
  });

  it("credits nothing at all for a collector with an empty ledger (BR-12-03)", async () => {
    const { db } = makeFakeDb({ ledger: [] });

    const result = await recomputeUserProgress(USER_ID, db as never);

    expect(result.derivedTotal).toBe(0);
    expect(result.currentRankIndex).toBe(1);
  });

  it("ignores another collector's store when deciding this one's eligibility", async () => {
    // The gate is "a store THIS collector created", not "a store somebody created".
    const total = await derivedTotalFor({
      stores: [{ ...eligibleStore("store-1"), createdByUserId: OTHER_USER_ID }],
      orders: [{ id: "order-1", storeId: "store-1" }],
      ledger: [
        ledgerEntry({ ruleKey: POINT_RULE_KEYS.ORDER_CREATED, entityType: ORDER, entityId: "order-1", points: 5 }),
      ],
    });

    expect(total).toBe(5);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeliveryStatus } from "../../../../../generated/prisma/client";
import { POINT_RULE_KEYS, PROGRESSION_ENTITY_TYPES } from "../pointRules";
import { getProgressSummary, isProgressCacheStale } from "../progressionQueries";
import { civilDay, eligibleStore, ledgerEntry, makeFakeDb, USER_ID, type FakeWorld } from "./progressionFixtures";

const { ORDER, DELIVERY } = PROGRESSION_ENTITY_TYPES;

const NOW = new Date("2026-03-20T15:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
});

/** A world with one eligible, paid order and one delivered arrival, both credited this month. */
function populatedWorld(overrides: Partial<FakeWorld> = {}): FakeWorld {
  return {
    stores: [eligibleStore("store-1")],
    orders: [{ id: "order-1", storeId: "store-1" }],
    paidOrderIds: ["order-1"],
    deliveries: [{ id: "delivery-1", storeId: "store-1", orderIds: ["order-1"], status: DeliveryStatus.DELIVERED }],
    ledger: [
      ledgerEntry({
        ruleKey: POINT_RULE_KEYS.ORDER_CREATED,
        entityType: ORDER,
        entityId: "order-1",
        points: 5,
        occurredOn: civilDay(2026, 3, 4),
      }),
      ledgerEntry({
        ruleKey: POINT_RULE_KEYS.ORDER_FIRST_PAYMENT,
        entityType: ORDER,
        entityId: "order-1",
        points: 8,
        occurredOn: civilDay(2026, 3, 6),
      }),
      ledgerEntry({
        ruleKey: POINT_RULE_KEYS.DELIVERY_RECEIVED,
        entityType: DELIVERY,
        entityId: "delivery-1",
        points: 25,
        occurredOn: civilDay(2026, 3, 11),
      }),
    ],
    progress: { highestRankIndex: 2, rankIndex: 2, maturedPoints: 210, lastRecomputedAt: NOW },
    ...overrides,
  };
}

async function summaryFor(world: FakeWorld, now: Date = NOW) {
  const { db } = makeFakeDb(world);
  return getProgressSummary(USER_ID, now, db as never);
}

describe("isProgressCacheStale", () => {
  it("treats a never-recomputed collector as stale, so the first open schedules the recompute", () => {
    expect(isProgressCacheStale(null, NOW)).toBe(true);
  });

  it("is stale past six hours and fresh inside them", () => {
    expect(isProgressCacheStale(new Date(NOW.getTime() - 7 * HOUR_MS), NOW)).toBe(true);
    expect(isProgressCacheStale(new Date(NOW.getTime() - 5 * HOUR_MS), NOW)).toBe(false);
    // The boundary itself is not stale: six hours old is exactly the window, not past it.
    expect(isProgressCacheStale(new Date(NOW.getTime() - 6 * HOUR_MS), NOW)).toBe(false);
  });
});

describe("getProgressSummary", () => {
  it("reports the cached total and rank rather than re-deriving one behind the collector's back", async () => {
    const summary = await summaryFor(populatedWorld());

    expect(summary.totalPoints).toBe(210);
    expect(summary.currentRankIndex).toBe(2);
    expect(summary.currentRankKey).toBe("preorder-hunter");
    expect(summary.highestRankIndex).toBe(2);
    expect(summary.hasPoints).toBe(true);
  });

  it("measures the bar between the two thresholds that bound the current rung, not from zero", async () => {
    const summary = await summaryFor(populatedWorld());

    // Rank 2 starts at 200 and rank 3 at 670: 210 points is ten into a 470-point rung.
    expect(summary.nextRank).toEqual({ rankKey: "volume-keeper", rankIndex: 3, threshold: 670 });
    expect(summary.pointsToNextRank).toBe(460);
    expect(Math.round(summary.nextRankProgressPercent)).toBe(2);
  });

  it("breaks this civil month down by rule group and never counts an older month", async () => {
    const world = populatedWorld();
    world.ledger = [
      ...(world.ledger ?? []),
      ledgerEntry({
        ruleKey: POINT_RULE_KEYS.ORDER_CREATED,
        entityType: ORDER,
        entityId: "order-1",
        points: 5,
        // February: real, still counted in the total, and deliberately absent from this month.
        occurredOn: civilDay(2026, 2, 14),
      }),
    ];

    const summary = await summaryFor(world);

    expect(summary.monthlyGroups).toEqual([
      { group: "orders", points: 5 },
      { group: "payments", points: 8 },
      { group: "arrivals", points: 25 },
    ]);
    expect(summary.pointsThisMonth).toBe(38);
  });

  it("reports the credited figure, so a truncated entry is counted for what it actually paid", async () => {
    const world = populatedWorld();
    // `order-registered` is capped at 120 POINTS a month. Three entries of 50 are worth 150 at face
    // value; the third crosses the ceiling and contributes the remaining 20, not its own 50.
    world.ledger = [50, 50, 50].map((points, index) =>
      ledgerEntry({
        ruleKey: POINT_RULE_KEYS.ORDER_REGISTERED,
        entityType: ORDER,
        entityId: "order-1",
        points,
        occurredOn: civilDay(2026, 3, index + 1),
      }),
    );

    const summary = await summaryFor(world);

    expect(summary.pointsThisMonth).toBe(120);
    expect(summary.monthlyGroups).toEqual([{ group: "orders", points: 120 }]);
  });

  it("says a collector has no points when the ledger is empty, instead of showing a zero score", async () => {
    const summary = await summaryFor({ progress: null });

    expect(summary.hasPoints).toBe(false);
    expect(summary.totalPoints).toBe(0);
    expect(summary.monthlyGroups).toEqual([]);
    expect(summary.currentRankIndex).toBe(1);
  });

  it("marks a cache older than six hours as stale and a recent one as fresh", async () => {
    const stale = await summaryFor(
      populatedWorld({
        progress: {
          highestRankIndex: 2,
          rankIndex: 2,
          maturedPoints: 210,
          lastRecomputedAt: new Date(NOW.getTime() - 7 * HOUR_MS),
        },
      }),
    );
    const fresh = await summaryFor(populatedWorld());

    expect(stale.stale).toBe(true);
    expect(fresh.stale).toBe(false);
  });

  it("keeps naming the highest rank reached after the live total falls back below its threshold", async () => {
    // `BR-12-06` / `FR-12-16`: deleting an order moves the BAR backwards, never the title. The
    // cache below is exactly what a recompute writes after such a deletion: the live rank slid to
    // three while the high-water mark stayed at five.
    const summary = await summaryFor(
      populatedWorld({
        progress: { highestRankIndex: 5, rankIndex: 3, maturedPoints: 900, lastRecomputedAt: NOW },
      }),
    );

    expect(summary.currentRankIndex).toBe(5);
    expect(summary.currentRankKey).toBe("first-print-hunter");
    expect(summary.highestRankIndex).toBe(5);
    // The next threshold is measured above the HIGHEST rank, not above the live one, so the bar
    // reads as progress toward six rather than restarting the rung the collector already cleared.
    expect(summary.nextRank?.rankIndex).toBe(6);
    // Below the band's own floor, so the bar sits empty rather than reporting a negative walk.
    expect(summary.nextRankProgressPercent).toBe(0);
  });

  it("hides the merit-lock counter below rank six and points it at the next locked rank above", async () => {
    const below = await summaryFor(
      populatedWorld({ progress: { highestRankIndex: 5, rankIndex: 5, maturedPoints: 2300, lastRecomputedAt: NOW } }),
    );
    expect(below.meritLock).toBeNull();

    const visible = await summaryFor(
      populatedWorld({
        progress: { highestRankIndex: 6, rankIndex: 6, maturedPoints: 3400, lastRecomputedAt: NOW },
        unlockedMedalKeys: ["first-order", "first-payment"],
      }),
    );
    expect(visible.meritLock?.rankIndex).toBe(9);
    expect(visible.meritLock?.requiredFraction).toBe(0.45);
    expect(visible.meritLock?.unlockedMedalCount).toBe(2);
    expect(visible.meritLock?.satisfied).toBe(false);
  });
});

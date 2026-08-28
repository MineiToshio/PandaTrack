import { DeliveryStatus, OrderItemDeliveryState, OrderStatus } from "../../../../generated/prisma/client";
import type { Prisma } from "../../../../generated/prisma/client";
import { resolveMigratedPaymentOrderIds, resolveSettledOrderIds } from "./moneyPredicateAdapter";
import {
  orderRegisteredPoints,
  POINT_RULE_KEYS,
  PROGRESSION_ENTITY_TYPES,
  type PointRuleKey,
  type ProgressionEntityType,
} from "./pointRules";
import { awardPointsBatch, type AwardPointsInput } from "./progressionMutations";
import { FIRST_RANK_INDEX } from "./rankLadder";
import { recomputeUserProgress } from "./recompute";
import { isStoreCreditEligible, STORE_CREDIT_ELIGIBILITY_SELECT } from "./storeCreditEligibility";

/**
 * The one-off replay of a collector's existing history into the points ledger.
 *
 * Everything the app credits today is credited at the moment the collector does it. A history that
 * predates the ledger (the Notion import, and every order recorded before this feature shipped) has
 * therefore never been credited at all, which is why the owner reads as rank 1 with an empty album
 * over a real archive. This module rebuilds those entries from the rows that survived, once.
 *
 * Four rules shape the whole thing, and each of them is the difference between a replay and a
 * fabrication:
 *
 *   1. **Every entry is stamped `BACKFILL`, never `LIVE`.** The source column is what keeps a
 *      reconstructed point out of any future comparison between collectors (`BR-12-12`) while still
 *      letting it count toward this collector's own rank.
 *   2. **Every `occurredOn` is the real historical civil day of the fact**: the order's `orderDate`,
 *      the payment's `paymentDate`, the delivery's `receivedDate`. Never `new Date()`. Filing a
 *      decade of history under today would put it all in one civil month, where the monthly caps
 *      would swallow almost all of it and the collector's timeline would read as a single day.
 *   3. **A migrated order gets ONE synthetic entry set** (`FR-12-42`). The import fused each order's
 *      advance and its balance into a single payment record, so the two payment events that really
 *      happened cannot be told apart any more. Inventing the second one would credit a payment
 *      nobody can point at, so a migrated order is credited for its FIRST payment and never for the
 *      settlement.
 *   4. **The whole run refuses before it writes anything**, rather than crediting some collectors and
 *      not others (`BACKFILL_SOURCE_INCOMPLETE`). Re-running is a no-op instead, inherited from the
 *      ledger's own `(userId, ruleKey, entityId)` unique key rather than re-implemented here
 *      (`BACKFILL_ALREADY_APPLIED`).
 *
 * No figure ever enters or leaves this module. Whether an order is settled arrives as a boolean from
 * the predicate adapter, exactly as it does on the live credit path, and the census below reports
 * points and ranks only.
 */

/**
 * Point values, mirrored from the live credit call sites so a replayed fact is worth exactly what
 * the same fact would have been worth had it been recorded through the app. They are restated here
 * rather than imported because the call sites price them inline; the values must be kept in step
 * with `accrual.ts`, and the tests assert them against the same expectations that file's do.
 */
const BACKFILL_POINTS = {
  ORDER_CREATED: 5,
  STORE_FIRST_ORDER: 20,
  ORDER_FIRST_PAYMENT: 8,
  ORDER_SETTLED: 12,
  DELIVERY_RECEIVED: 25,
  ORDER_COMPLETED: 30,
  PRODUCT_TYPE_DISCOVERED: 12,
  STORE_REVIEWED: 20,
} as const;

/** Error code the caller maps. Defined by the Error Contract, not invented here. */
export const BACKFILL_SOURCE_INCOMPLETE = "BACKFILL_SOURCE_INCOMPLETE";

/**
 * Raised when a migrated payment the run depends on is missing a field the replay needs.
 *
 * It carries the offending ids so the operator can go and look at them, and it is thrown rather
 * than returned because it must abort the run: half a backfill is worse than none, since the second
 * attempt would credit the remaining collectors against a ledger the first one already half filled.
 */
export class ProgressionBackfillSourceIncompleteError extends Error {
  readonly code = BACKFILL_SOURCE_INCOMPLETE;

  constructor(readonly incompletePaymentIds: readonly string[]) {
    super(BACKFILL_SOURCE_INCOMPLETE);
    this.name = "ProgressionBackfillSourceIncompleteError";
  }
}

export type ProgressionBackfillOptions = {
  /** Restrict the run to these collectors. Absent means every collector who has at least one order. */
  userIds?: readonly string[];
};

/** What one collector's replay did. Points and ranks only: never a monetary figure. */
export type ProgressionBackfillUserResult = {
  userId: string;
  entriesWritten: number;
  pointsBefore: number;
  pointsAfter: number;
  rankIndexBefore: number;
  rankIndexAfter: number;
  medalsUnlocked: string[];
  /**
   * The run offered entries and the ledger accepted none of them, which is the observable shape of
   * `BACKFILL_ALREADY_APPLIED`. Reported, never thrown: a second run being a no-op is the guarantee
   * working, not a failure.
   */
  alreadyApplied: boolean;
};

export type ProgressionBackfillResult = {
  users: ProgressionBackfillUserResult[];
  usersProcessed: number;
  totalEntriesWritten: number;
  totalMedalsUnlocked: number;
  /** True when every collector the run touched was already backfilled. */
  alreadyApplied: boolean;
};

/** One credit the replay decided to offer, already dated on the day the fact really happened. */
type BackfillCredit = {
  ruleKey: PointRuleKey;
  entityType: ProgressionEntityType;
  entityId: string;
  points: number;
  occurredOn: Date;
};

/**
 * The civil day of a stored instant, pinned to UTC midnight.
 *
 * Domain dates (`orderDate`, `paymentDate`, `receivedDate`) already sit on UTC midnight, so this is
 * an identity for them and the read is deliberately in UTC either way. It matters for the true
 * timestamps the replay also has to date (a review's `createdAt`), where reading local components
 * would move the fact a day in either direction depending on where the script happens to run.
 */
function toCivilDayUtc(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

/**
 * `YYYY-MM` of a civil day, used to bucket the anti-split ladder. Same shape the recompute uses to
 * bucket the monthly caps, so a ladder position and the cap that later truncates it agree.
 */
function civilMonthKeyOf(day: Date): string {
  return `${day.getUTCFullYear()}-${`${day.getUTCMonth() + 1}`.padStart(2, "0")}`;
}

/**
 * The historical day a fact is filed under, never later than today.
 *
 * `awardPointsBatch` refuses an `occurredOn` more than a day ahead of the server clock, and a single
 * stray future-dated row (a mistyped `orderDate` in a decade of history) would otherwise abort the
 * entire run. Clamping affects only rows that are already impossible, and it is the conservative
 * direction: the fact is filed on the earliest day it could plausibly have happened.
 */
function historicalDay(value: Date, todayUtc: Date): Date {
  const day = toCivilDayUtc(value);
  return day.getTime() > todayUtc.getTime() ? todayUtc : day;
}

/** Smallest of two possibly absent days. */
function earliest(current: Date | undefined, candidate: Date): Date {
  return current && current.getTime() <= candidate.getTime() ? current : candidate;
}

/** Largest of two possibly absent days. */
function latest(current: Date | undefined, candidate: Date): Date {
  return current && current.getTime() >= candidate.getTime() ? current : candidate;
}

/**
 * Refuses the whole run when the migrated payment history cannot support a replay.
 *
 * The "required fields" are exactly the ones the synthetic entry mapping needs to proceed: a
 * `paymentDate` (there is no other honest day to file the payment under), a `storeId`, and at least
 * one `PaymentAllocation` naming the order the payment belongs to. This runs before any write for
 * every collector in scope at once, so the refusal is all-or-nothing rather than per collector.
 */
async function assertMigratedSourceComplete(
  db: Prisma.TransactionClient,
  userIds: readonly string[] | undefined,
): Promise<void> {
  const payments = await db.storePayment.findMany({
    where: {
      migratedFromOrderId: { not: null },
      ...(userIds ? { userId: { in: [...userIds] } } : {}),
    },
    select: {
      id: true,
      paymentDate: true,
      storeId: true,
      allocations: { select: { orderId: true }, take: 1 },
    },
  });

  const incomplete = payments
    .filter((payment) => !payment.paymentDate || !payment.storeId || payment.allocations.length === 0)
    .map((payment) => payment.id);

  if (incomplete.length > 0) {
    throw new ProgressionBackfillSourceIncompleteError(incomplete);
  }
}

/**
 * The 1-based position of each order among the collector's own orders at the same store within the
 * same civil month, which is the only input the anti-split ladder takes.
 *
 * The live path derives this from the orders created in the credit's month; the replay derives it
 * from each order's own `orderDate`, which is the historical equivalent and is what keeps the
 * ladder's month and the monthly cap's month talking about the same thing. Ordering is by day, then
 * write instant, then id, so two runs over the same history hand out the same ladder.
 */
function resolveStoreMonthPositions(
  orders: readonly { id: string; storeId: string; day: Date }[],
): Map<string, number> {
  const positions = new Map<string, number>();
  const used = new Map<string, number>();

  for (const order of orders) {
    const groupKey = `${order.storeId}|${civilMonthKeyOf(order.day)}`;
    const position = (used.get(groupKey) ?? 0) + 1;
    used.set(groupKey, position);
    positions.set(order.id, position);
  }

  return positions;
}

/**
 * Collapses credits that name the same rule and entity twice.
 *
 * The unique key would drop the duplicate anyway, but two rows offered in one insert make it the
 * database's problem rather than a decided one, and the surviving row would be whichever the batch
 * happened to reach first. Keeping the EARLIEST day is the deliberate answer: a product type is
 * discovered the first time it arrives, not the last.
 */
function dedupeCredits(credits: readonly BackfillCredit[]): BackfillCredit[] {
  const byKey = new Map<string, BackfillCredit>();

  for (const credit of credits) {
    const key = `${credit.ruleKey}|${credit.entityId}`;
    const existing = byKey.get(key);
    if (!existing || credit.occurredOn.getTime() < existing.occurredOn.getTime()) {
      byKey.set(key, credit);
    }
  }

  return [...byKey.values()];
}

/** Replays one collector's history. Returns the credits it decided to offer, already deduped. */
async function resolveUserCredits(db: Prisma.TransactionClient, userId: string): Promise<BackfillCredit[]> {
  const todayUtc = toCivilDayUtc(new Date());

  // Cancelled orders are excluded outright. The live path credits `order-created` even for an order
  // that was later cancelled, because cancelling is a real outcome worth recording; a replay has no
  // such moment to honour, and reconstructing points for a history the collector already abandoned
  // would credit the one shape the anti-abuse rules care most about.
  const orderRows = await db.order.findMany({
    where: { userId, status: { not: OrderStatus.CANCELLED } },
    select: {
      id: true,
      storeId: true,
      status: true,
      orderDate: true,
      store: { select: STORE_CREDIT_ELIGIBILITY_SELECT },
    },
    orderBy: [{ orderDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

  // The store gate, applied at write time exactly as the live path applies it: a store the collector
  // invented, a private one or one that was never approved credits nothing, so no entry for it ever
  // enters the ledger in the first place (`BR-12-07`).
  const orders = orderRows
    .filter((order) => isStoreCreditEligible(order.store))
    .map((order) => ({
      id: order.id,
      storeId: order.storeId,
      status: order.status,
      day: historicalDay(order.orderDate, todayUtc),
    }));

  if (orders.length === 0) {
    return [];
  }

  const orderIds = orders.map((order) => order.id);
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const migratedOrderIds = await resolveMigratedPaymentOrderIds(userId, orderIds, db);

  // Payment DAYS, never payment amounts: `order-first-payment` has to be filed under the day the
  // money was actually declared, and the day is provenance rather than a figure.
  const allocationRows = await db.paymentAllocation.findMany({
    where: { userId, orderId: { in: orderIds } },
    select: { orderId: true, payment: { select: { paymentDate: true } } },
  });

  const firstPaymentDayByOrderId = new Map<string, Date>();
  for (const allocation of allocationRows) {
    if (!allocation.payment?.paymentDate) {
      continue;
    }
    const day = historicalDay(allocation.payment.paymentDate, todayUtc);
    firstPaymentDayByOrderId.set(allocation.orderId, earliest(firstPaymentDayByOrderId.get(allocation.orderId), day));
  }

  // `order-settled` is asked about NON-migrated orders only. A migrated order's advance and balance
  // were fused into one record, so crediting both the first payment and the settlement would be the
  // second payment event `FR-12-42` forbids.
  const settledCandidateIds = orderIds.filter(
    (orderId) => firstPaymentDayByOrderId.has(orderId) && !migratedOrderIds.has(orderId),
  );
  const settledOrderIds = await resolveSettledOrderIds(userId, settledCandidateIds, db);

  const deliveryRows = await db.delivery.findMany({
    where: { userId, status: DeliveryStatus.DELIVERED },
    select: {
      id: true,
      receivedDate: true,
      deliveryDate: true,
      store: { select: STORE_CREDIT_ELIGIBILITY_SELECT },
      orderItems: {
        select: { orderItem: { select: { orderId: true, productTypeKey: true, deliveryState: true } } },
      },
    },
    orderBy: [{ deliveryDate: "asc" }, { id: "asc" }],
  });

  const reviewRows = await db.storeReview.findMany({
    where: { userId },
    select: { storeId: true, createdAt: true },
  });

  const credits: BackfillCredit[] = [];

  // Store-scoped facts. Offered once per order rather than once per store: `store-first-order` is
  // keyed by the STORE, so the dedupe pass below is what collapses the collector's whole run at a
  // store into the single earliest day, and it is the only place that invariant is decided.
  for (const order of orders) {
    credits.push({
      ruleKey: POINT_RULE_KEYS.STORE_FIRST_ORDER,
      entityType: PROGRESSION_ENTITY_TYPES.STORE,
      entityId: order.storeId,
      points: BACKFILL_POINTS.STORE_FIRST_ORDER,
      occurredOn: order.day,
    });
  }

  // Arrivals, and the facts that fall out of them: the day each order finally closed, and every
  // product type that ever arrived (again keyed by the type, again collapsed by the dedupe pass).
  const lastArrivalDayByOrderId = new Map<string, Date>();
  const storeIdsWithArrival = new Set<string>();

  for (const delivery of deliveryRows) {
    const day = historicalDay(delivery.receivedDate ?? delivery.deliveryDate, todayUtc);
    const linkedItems = delivery.orderItems.map((link) => link.orderItem).filter((item) => orderById.has(item.orderId));

    if (isStoreCreditEligible(delivery.store) && linkedItems.length > 0) {
      credits.push({
        ruleKey: POINT_RULE_KEYS.DELIVERY_RECEIVED,
        entityType: PROGRESSION_ENTITY_TYPES.DELIVERY,
        entityId: delivery.id,
        points: BACKFILL_POINTS.DELIVERY_RECEIVED,
        occurredOn: day,
      });
    }

    for (const item of linkedItems) {
      if (item.deliveryState !== OrderItemDeliveryState.DELIVERED) {
        continue;
      }
      lastArrivalDayByOrderId.set(item.orderId, latest(lastArrivalDayByOrderId.get(item.orderId), day));
      const order = orderById.get(item.orderId);
      if (order) {
        storeIdsWithArrival.add(order.storeId);
      }
      if (item.productTypeKey) {
        credits.push({
          ruleKey: POINT_RULE_KEYS.PRODUCT_TYPE_DISCOVERED,
          entityType: PROGRESSION_ENTITY_TYPES.PRODUCT_TYPE,
          entityId: item.productTypeKey,
          points: BACKFILL_POINTS.PRODUCT_TYPE_DISCOVERED,
          occurredOn: day,
        });
      }
    }
  }

  // A review is only worth anything once the collector has actually received something from that
  // store, which is the same existence question the live path asks and never a count.
  for (const review of reviewRows) {
    if (!storeIdsWithArrival.has(review.storeId)) {
      continue;
    }
    credits.push({
      ruleKey: POINT_RULE_KEYS.STORE_REVIEWED,
      entityType: PROGRESSION_ENTITY_TYPES.STORE,
      entityId: review.storeId,
      points: BACKFILL_POINTS.STORE_REVIEWED,
      occurredOn: historicalDay(review.createdAt, todayUtc),
    });
  }

  const positions = resolveStoreMonthPositions(orders);

  for (const order of orders) {
    const migrated = migratedOrderIds.has(order.id);
    const firstPaymentDay = firstPaymentDayByOrderId.get(order.id);

    credits.push({
      ruleKey: POINT_RULE_KEYS.ORDER_CREATED,
      entityType: PROGRESSION_ENTITY_TYPES.ORDER,
      entityId: order.id,
      points: BACKFILL_POINTS.ORDER_CREATED,
      occurredOn: order.day,
    });

    // `order-registered` is filed under the order's own day rather than the payment's, so the
    // anti-split ladder's month and the monthly cap that truncates it are the same month. The live
    // path gets that alignment for free because it prices and files on the same instant.
    if (firstPaymentDay) {
      credits.push({
        ruleKey: POINT_RULE_KEYS.ORDER_REGISTERED,
        entityType: PROGRESSION_ENTITY_TYPES.ORDER,
        entityId: order.id,
        points: orderRegisteredPoints({ storeMonthPosition: positions.get(order.id) ?? 1 }),
        occurredOn: order.day,
      });
      credits.push({
        ruleKey: POINT_RULE_KEYS.ORDER_FIRST_PAYMENT,
        entityType: PROGRESSION_ENTITY_TYPES.ORDER,
        entityId: order.id,
        points: BACKFILL_POINTS.ORDER_FIRST_PAYMENT,
        occurredOn: firstPaymentDay,
      });
    }

    if (migrated) {
      // The synthetic set ends here (`FR-12-42`). Settlement and completion are the two order-scoped
      // facts a fused payment record cannot evidence separately.
      continue;
    }

    if (settledOrderIds.has(order.id)) {
      credits.push({
        ruleKey: POINT_RULE_KEYS.ORDER_SETTLED,
        entityType: PROGRESSION_ENTITY_TYPES.ORDER,
        entityId: order.id,
        points: BACKFILL_POINTS.ORDER_SETTLED,
        occurredOn: firstPaymentDay ?? order.day,
      });
    }

    if (order.status === OrderStatus.COMPLETED) {
      credits.push({
        ruleKey: POINT_RULE_KEYS.ORDER_COMPLETED,
        entityType: PROGRESSION_ENTITY_TYPES.ORDER,
        entityId: order.id,
        points: BACKFILL_POINTS.ORDER_COMPLETED,
        occurredOn: lastArrivalDayByOrderId.get(order.id) ?? order.day,
      });
    }
  }

  return dedupeCredits(credits);
}

/** Replays one collector and re-derives their progression, returning the census row for the run. */
async function backfillUser(db: Prisma.TransactionClient, userId: string): Promise<ProgressionBackfillUserResult> {
  const credits = await resolveUserCredits(db, userId);

  const [progressBefore, unlocksBefore] = await Promise.all([
    db.userProgress.findUnique({ where: { userId }, select: { maturedPoints: true, rankIndex: true } }),
    db.medalUnlock.findMany({ where: { userId }, select: { medalKey: true } }),
  ]);
  const pointsBefore = progressBefore?.maturedPoints ?? 0;
  const rankIndexBefore = progressBefore?.rankIndex ?? FIRST_RANK_INDEX;
  // Captured BEFORE the recompute, because that is the only moment the difference between "this
  // collector already held this medal" and "the backfill just unlocked it" still exists.
  const heldMedalKeys = new Set(unlocksBefore.map((unlock) => unlock.medalKey));

  if (credits.length === 0) {
    return {
      userId,
      entriesWritten: 0,
      pointsBefore,
      pointsAfter: pointsBefore,
      rankIndexBefore,
      rankIndexAfter: rankIndexBefore,
      medalsUnlocked: [],
      alreadyApplied: false,
    };
  }

  const inputs: AwardPointsInput[] = credits.map((credit) => ({
    userId,
    ruleKey: credit.ruleKey,
    entityType: credit.entityType,
    entityId: credit.entityId,
    points: credit.points,
    occurredOn: credit.occurredOn,
    // Never `LIVE`. The source column is the only thing that will ever distinguish a reconstructed
    // point from one the collector earned in front of the app (`BR-12-12`).
    source: "BACKFILL",
  }));

  const { credited } = await awardPointsBatch(db, inputs);

  // Essential, not a tidy-up: an appended ledger with no recompute leaves the collector on a stale
  // cache and, worse, leaves every medal the replayed history satisfies unevaluated.
  const after = await recomputeUserProgress(userId, db);

  // The recompute writes its unlocks the way a live unlock is written: unseen, and `LIVE`. A
  // backfilled unlock must be silent instead (`FR-12-43`), so the ones this run created are marked
  // as already seen and relabelled. Only the NEW ones: a medal the collector genuinely unlocked
  // before the backfill keeps its own source and its own unseen state.
  const medalsUnlocked = after.unlockedThisRun.filter((medalKey) => !heldMedalKeys.has(medalKey));
  if (medalsUnlocked.length > 0) {
    await db.medalUnlock.updateMany({
      where: { userId, medalKey: { in: medalsUnlocked } },
      data: { seenAt: new Date(), source: "BACKFILL" },
    });
  }

  return {
    userId,
    entriesWritten: credited,
    pointsBefore,
    pointsAfter: after.derivedTotal,
    rankIndexBefore,
    rankIndexAfter: after.currentRankIndex,
    medalsUnlocked,
    // Entries were offered and none was accepted: the ledger already holds this collector's replay.
    alreadyApplied: credited === 0,
  };
}

/**
 * Replays the existing history of every collector who has at least one order.
 *
 * Takes the caller's client rather than reaching for the singleton so the operator script can run
 * the whole thing inside one interactive transaction and roll it back for a dry run, and so the
 * tests can drive it against a fake without a database.
 *
 * Deliberately does NOT touch `progression_settings`. The aggregated welcome celebration is derived
 * from "this collector has `BACKFILL` ledger entries and has never celebrated a rank", so writing a
 * settings row here would consume the celebration before the collector ever saw it.
 */
export async function runProgressionBackfill(
  db: Prisma.TransactionClient,
  options: ProgressionBackfillOptions = {},
): Promise<ProgressionBackfillResult> {
  await assertMigratedSourceComplete(db, options.userIds);

  const users = await db.user.findMany({
    where: {
      orders: { some: {} },
      ...(options.userIds ? { id: { in: [...options.userIds] } } : {}),
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  const results: ProgressionBackfillUserResult[] = [];
  for (const user of users) {
    results.push(await backfillUser(db, user.id));
  }

  const applied = results.filter((result) => result.alreadyApplied);

  return {
    users: results,
    usersProcessed: results.length,
    totalEntriesWritten: results.reduce((sum, result) => sum + result.entriesWritten, 0),
    totalMedalsUnlocked: results.reduce((sum, result) => sum + result.medalsUnlocked.length, 0),
    alreadyApplied: applied.length > 0 && applied.length === results.length,
  };
}

import { OrderStatus, DeliveryStatus, OrderItemDeliveryState } from "../../../../generated/prisma/client";
import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveSettledOrderIds } from "./moneyPredicateAdapter";
import { getMeritLockDenominator } from "./medalCatalogue";
import { evaluateUnlocks, type MedalEvaluationContext } from "./medalEvaluation";
import { deriveRank, FIRST_RANK_INDEX } from "./rankLadder";
import {
  findPointRule,
  POINT_RULE_CONDITIONS,
  POINT_RULE_KEYS,
  PROGRESSION_ENTITY_TYPES,
  type PointRule,
  type PointRuleCondition,
} from "./pointRules";
import {
  CREDITABLE_STORE_FILTER,
  isStoreCreditEligible,
  STORE_CREDIT_ELIGIBILITY_SELECT,
} from "./storeCreditEligibility";

/**
 * The on-demand recompute: the only thing that decides what a collector's points actually are.
 *
 * Nothing stores a running total. Every entry in the ledger is re-examined against the CURRENT state
 * of the row it names, and an entry that no longer passes simply stops counting. That is what makes
 * cancelling an order, reactivating it, hard-deleting it, reopening a delivery and rewriting a review
 * all one mechanism instead of five reversal handlers scattered across domains that know nothing
 * about progression.
 *
 * Two consequences worth naming, because they look like bugs otherwise:
 *
 *   - A total can go DOWN between two runs with no write in between, if the collector deleted
 *     something. That is correct.
 *   - The rank a collector has REACHED never goes down with it. Only the bar inside the band moves
 *     backwards, never the title.
 *
 * Points come from the entry's own stored `points` column, not from re-running the rule's formula.
 * The value was priced when the fact happened and the ledger is the record of that; the recompute's
 * job is to decide which entries still count and to apply the caps over them, in that order.
 */

/** Fields the recompute needs off a ledger row. Narrower than the model on purpose. */
export type RecomputeLedgerEntry = {
  id: string;
  ruleKey: string;
  entityType: string;
  entityId: string;
  points: number;
  occurredOn: Date;
  createdAt: Date;
};

export type OrderFact = {
  cancelled: boolean;
  completed: boolean;
  storeCreditEligible: boolean;
  hasAssignedPayment: boolean;
  settled: boolean;
};

export type DeliveryFact = {
  delivered: boolean;
  storeCreditEligible: boolean;
  /** At least one of the delivery's orders is credit-eligible and carries an assigned payment. */
  hasCreditableOrder: boolean;
};

export type StoreFact = {
  creditEligible: boolean;
  hasOrder: boolean;
  /** The collector has actually received a product from this store. Existence only, no count. */
  productReceived: boolean;
};

/**
 * Current state of every entity the ledger points at, resolved in batch: one query per entity type,
 * never one per entry. A missing key means the row is gone, which is exactly how a hard delete stops
 * counting without any delete hook knowing the ledger exists.
 */
export type ProgressionFacts = {
  orders: Map<string, OrderFact>;
  deliveries: Map<string, DeliveryFact>;
  stores: Map<string, StoreFact>;
  /** Product-type keys with at least one delivered product on a credit-eligible order. */
  deliveredProductTypes: Set<string>;
};

export type RecomputeResult = {
  derivedTotal: number;
  currentRankIndex: number;
  highestRankIndex: number;
  unlockedThisRun: string[];
};

const {
  ENTITY_EXISTS,
  STORE_CREDIT_ELIGIBLE,
  ORDER_NOT_CANCELLED,
  ORDER_HAS_ASSIGNED_PAYMENT,
  ORDER_COMPLETED,
  ORDER_SETTLED,
  DELIVERY_DELIVERED,
  PRODUCT_TYPE_DELIVERED,
  STORE_HAS_ORDER,
  STORE_PRODUCT_RECEIVED,
} = POINT_RULE_CONDITIONS;

/** Which conditions hold for one entry, given the batch-resolved state of the world. */
function resolveSatisfiedConditions(entry: RecomputeLedgerEntry, facts: ProgressionFacts): Set<PointRuleCondition> {
  const satisfied = new Set<PointRuleCondition>();

  if (entry.entityType === PROGRESSION_ENTITY_TYPES.ORDER) {
    const order = facts.orders.get(entry.entityId);
    if (!order) {
      return satisfied;
    }
    satisfied.add(ENTITY_EXISTS);
    if (order.storeCreditEligible) satisfied.add(STORE_CREDIT_ELIGIBLE);
    if (!order.cancelled) satisfied.add(ORDER_NOT_CANCELLED);
    if (order.hasAssignedPayment) satisfied.add(ORDER_HAS_ASSIGNED_PAYMENT);
    if (order.completed) satisfied.add(ORDER_COMPLETED);
    if (order.settled) satisfied.add(ORDER_SETTLED);
    return satisfied;
  }

  if (entry.entityType === PROGRESSION_ENTITY_TYPES.DELIVERY) {
    const delivery = facts.deliveries.get(entry.entityId);
    if (!delivery) {
      return satisfied;
    }
    satisfied.add(ENTITY_EXISTS);
    if (delivery.storeCreditEligible) satisfied.add(STORE_CREDIT_ELIGIBLE);
    if (delivery.delivered) satisfied.add(DELIVERY_DELIVERED);
    if (delivery.hasCreditableOrder) satisfied.add(ORDER_HAS_ASSIGNED_PAYMENT);
    return satisfied;
  }

  if (entry.entityType === PROGRESSION_ENTITY_TYPES.STORE) {
    const store = facts.stores.get(entry.entityId);
    if (!store) {
      return satisfied;
    }
    satisfied.add(ENTITY_EXISTS);
    if (store.creditEligible) satisfied.add(STORE_CREDIT_ELIGIBLE);
    if (store.hasOrder) satisfied.add(STORE_HAS_ORDER);
    if (store.productReceived) satisfied.add(STORE_PRODUCT_RECEIVED);
    return satisfied;
  }

  if (entry.entityType === PROGRESSION_ENTITY_TYPES.PRODUCT_TYPE) {
    // Existence and the delivered condition collapse into one fact here: the set is built from
    // order items that still reference the catalogue key, so a key present in it necessarily exists.
    if (facts.deliveredProductTypes.has(entry.entityId)) {
      satisfied.add(ENTITY_EXISTS);
      satisfied.add(PRODUCT_TYPE_DELIVERED);
    }
    return satisfied;
  }

  return satisfied;
}

/**
 * Whether an entry still counts. An entry whose `ruleKey` is no longer in the catalogue counts for
 * nothing rather than crashing the whole recompute: a retired rule should quietly stop paying, not
 * take a collector's entire progression down with it.
 */
export function isEntryEligible(entry: RecomputeLedgerEntry, facts: ProgressionFacts): boolean {
  const rule = findPointRule(entry.ruleKey);
  if (!rule) {
    return false;
  }
  const satisfied = resolveSatisfiedConditions(entry, facts);
  return rule.conditions.every((condition) => satisfied.has(condition));
}

/** `YYYY-MM` of the civil day the entry was bucketed into when it was written. `occurredOn` is
 *  already pinned to UTC midnight of that day, so reading it in UTC is what keeps an old entry from
 *  being re-bucketed by a recompute that runs in a different month or a different timezone. */
export function civilMonthKey(occurredOn: Date): string {
  const month = `${occurredOn.getUTCMonth() + 1}`.padStart(2, "0");
  return `${occurredOn.getUTCFullYear()}-${month}`;
}

/**
 * A cap's counter is shared by every entry in the same group. Monthly caps group by rule and civil
 * month. A lifetime cap groups by rule AND entity, which is what makes "once per product type,
 * forever" different from "once, forever": each type keeps its own counter and none of them reset.
 */
function capGroupKey(rule: PointRule, entry: RecomputeLedgerEntry): string {
  return rule.capWindow === "lifetime"
    ? `${rule.ruleKey}|entity:${entry.entityId}`
    : `${rule.ruleKey}|month:${civilMonthKey(entry.occurredOn)}`;
}

/**
 * Deterministic order: oldest civil day first, then write time, then id.
 *
 * The id tiebreak is not decoration. Two entries written in the same millisecond for the same day
 * would otherwise be ordered by whatever the database felt like returning, and under a points cap
 * that changes which one gets truncated, so two runs over identical data could disagree.
 */
function compareForCaps(left: RecomputeLedgerEntry, right: RecomputeLedgerEntry): number {
  const byOccurredOn = left.occurredOn.getTime() - right.occurredOn.getTime();
  if (byOccurredOn !== 0) return byOccurredOn;
  const byCreatedAt = left.createdAt.getTime() - right.createdAt.getTime();
  if (byCreatedAt !== 0) return byCreatedAt;
  return left.id.localeCompare(right.id);
}

/**
 * Applies each rule's declared cap over the surviving entries and returns the total.
 *
 * The unit matters and is read off the rule rather than assumed. `order-created` is capped in
 * EVENTS: ten a month, whatever they are worth. Every other phase-1 rule is capped in POINTS, where
 * the last entry to cross the ceiling contributes the remainder rather than being dropped whole,
 * because a cap of 120 that pays out 115 is not a cap of 120.
 */
export function applyCaps(entries: readonly RecomputeLedgerEntry[]): number {
  return applyCapsDetailed(entries).total;
}

/** What each surviving entry actually contributed, alongside the total the caps produced. */
export type CappedCredit = {
  total: number;
  /** Credited points per entry id. An entry a cap truncated to zero is absent, not mapped to `0`. */
  creditedByEntryId: ReadonlyMap<string, number>;
};

/**
 * The same cap pass as `applyCaps`, keeping what each entry contributed instead of only the sum.
 *
 * The monthly breakdown of the `Progreso` section needs the per-entry figure, and it has to be the
 * CREDITED one: a rule whose ceiling truncated the last entry of the month contributed the
 * remainder, not its face value, and a breakdown that adds up to more than the total the collector
 * sees above it would be reporting points nobody has. The pass runs over the whole history rather
 * than over one month's entries, because a lifetime cap is counted per entity across months, so
 * feeding it a single month would let an already-exhausted counter pay out a second time.
 */
export function applyCapsDetailed(entries: readonly RecomputeLedgerEntry[]): CappedCredit {
  const ordered = [...entries].sort(compareForCaps);
  const eventCounts = new Map<string, number>();
  const pointTotals = new Map<string, number>();
  const creditedByEntryId = new Map<string, number>();
  let total = 0;

  for (const entry of ordered) {
    const rule = findPointRule(entry.ruleKey);
    if (!rule) {
      continue;
    }
    const groupKey = capGroupKey(rule, entry);

    if (rule.capUnit === "events") {
      const used = eventCounts.get(groupKey) ?? 0;
      if (used >= rule.capValue) {
        continue;
      }
      eventCounts.set(groupKey, used + 1);
      creditedByEntryId.set(entry.id, entry.points);
      total += entry.points;
      continue;
    }

    const used = pointTotals.get(groupKey) ?? 0;
    const remaining = rule.capValue - used;
    if (remaining <= 0) {
      continue;
    }
    const contribution = Math.min(entry.points, remaining);
    pointTotals.set(groupKey, used + contribution);
    creditedByEntryId.set(entry.id, contribution);
    total += contribution;
  }

  return { total, creditedByEntryId };
}

/** Loads the current state of every entity the given entries name, one query per entity type. */
export async function loadProgressionFacts(
  db: Prisma.TransactionClient,
  userId: string,
  entries: readonly RecomputeLedgerEntry[],
): Promise<ProgressionFacts> {
  const orderIds = new Set<string>();
  const deliveryIds = new Set<string>();
  const storeIds = new Set<string>();
  const productTypeKeys = new Set<string>();
  const settledCandidateIds = new Set<string>();

  for (const entry of entries) {
    if (entry.entityType === PROGRESSION_ENTITY_TYPES.ORDER) {
      orderIds.add(entry.entityId);
      if (entry.ruleKey === POINT_RULE_KEYS.ORDER_SETTLED) {
        settledCandidateIds.add(entry.entityId);
      }
    } else if (entry.entityType === PROGRESSION_ENTITY_TYPES.DELIVERY) {
      deliveryIds.add(entry.entityId);
    } else if (entry.entityType === PROGRESSION_ENTITY_TYPES.STORE) {
      storeIds.add(entry.entityId);
    } else if (entry.entityType === PROGRESSION_ENTITY_TYPES.PRODUCT_TYPE) {
      productTypeKeys.add(entry.entityId);
    }
  }

  const deliveryRows =
    deliveryIds.size === 0
      ? []
      : await db.delivery.findMany({
          where: { userId, id: { in: [...deliveryIds] } },
          select: {
            id: true,
            status: true,
            store: { select: STORE_CREDIT_ELIGIBILITY_SELECT },
            orderItems: { select: { orderItem: { select: { orderId: true } } } },
          },
        });

  // A delivery's own eligibility depends on the orders behind it, so their ids join the order query
  // rather than triggering a second one.
  for (const delivery of deliveryRows) {
    for (const link of delivery.orderItems) {
      orderIds.add(link.orderItem.orderId);
    }
  }

  const orderRows =
    orderIds.size === 0
      ? []
      : await db.order.findMany({
          where: { userId, id: { in: [...orderIds] } },
          select: {
            id: true,
            status: true,
            store: { select: STORE_CREDIT_ELIGIBILITY_SELECT },
          },
        });

  const paidOrderRows =
    orderIds.size === 0
      ? []
      : await db.paymentAllocation.findMany({
          where: { userId, orderId: { in: [...orderIds] } },
          select: { orderId: true },
          distinct: ["orderId"],
        });
  const paidOrderIds = new Set(paidOrderRows.map((row) => row.orderId));

  const settledOrderIds = await resolveSettledOrderIds(userId, [...settledCandidateIds], db);

  const orders = new Map<string, OrderFact>();
  for (const order of orderRows) {
    orders.set(order.id, {
      cancelled: order.status === OrderStatus.CANCELLED,
      completed: order.status === OrderStatus.COMPLETED,
      storeCreditEligible: isStoreCreditEligible(order.store),
      hasAssignedPayment: paidOrderIds.has(order.id),
      settled: settledOrderIds.has(order.id),
    });
  }

  const deliveries = new Map<string, DeliveryFact>();
  for (const delivery of deliveryRows) {
    const linkedOrderIds = delivery.orderItems.map((link) => link.orderItem.orderId);
    deliveries.set(delivery.id, {
      delivered: delivery.status === DeliveryStatus.DELIVERED,
      storeCreditEligible: isStoreCreditEligible(delivery.store),
      hasCreditableOrder: linkedOrderIds.some((orderId) => {
        const order = orders.get(orderId);
        return Boolean(order && order.storeCreditEligible && !order.cancelled && order.hasAssignedPayment);
      }),
    });
  }

  const storeRows =
    storeIds.size === 0
      ? []
      : await db.store.findMany({
          where: { id: { in: [...storeIds] } },
          select: { id: true, ...STORE_CREDIT_ELIGIBILITY_SELECT },
        });

  const storesWithOrderRows =
    storeIds.size === 0
      ? []
      : await db.order.findMany({
          where: { userId, storeId: { in: [...storeIds] }, status: { not: OrderStatus.CANCELLED } },
          select: { storeId: true },
          distinct: ["storeId"],
        });
  const storeIdsWithOrder = new Set(storesWithOrderRows.map((row) => row.storeId));

  // The anchor `store-reviewed` reads: a review is only worth anything once the collector has
  // actually received something from that store, which is a property of the store, not the review.
  const storesWithArrivalRows =
    storeIds.size === 0
      ? []
      : await db.order.findMany({
          where: {
            userId,
            storeId: { in: [...storeIds] },
            status: { not: OrderStatus.CANCELLED },
            items: { some: { deliveryState: OrderItemDeliveryState.DELIVERED } },
          },
          select: { storeId: true },
          distinct: ["storeId"],
        });
  const storeIdsWithArrival = new Set(storesWithArrivalRows.map((row) => row.storeId));

  const stores = new Map<string, StoreFact>();
  for (const store of storeRows) {
    stores.set(store.id, {
      creditEligible: isStoreCreditEligible(store),
      hasOrder: storeIdsWithOrder.has(store.id),
      productReceived: storeIdsWithArrival.has(store.id),
    });
  }

  // The store gate is pushed into the query itself: a product delivered through a store the
  // collector never got approved, or kept private, must not register as a discovery at all.
  const deliveredTypeRows =
    productTypeKeys.size === 0
      ? []
      : await db.orderItem.findMany({
          where: {
            userId,
            productTypeKey: { in: [...productTypeKeys] },
            deliveryState: OrderItemDeliveryState.DELIVERED,
            order: {
              status: { not: OrderStatus.CANCELLED },
              store: CREDITABLE_STORE_FILTER,
            },
          },
          select: { productTypeKey: true },
          distinct: ["productTypeKey"],
        });

  const deliveredProductTypes = new Set<string>();
  for (const row of deliveredTypeRows) {
    if (row.productTypeKey) {
      deliveredProductTypes.add(row.productTypeKey);
    }
  }

  return { orders, deliveries, stores, deliveredProductTypes };
}

/**
 * Recomputes and caches a collector's progression.
 *
 * Accepts a caller-owned transaction so an administrative void can reverse and re-derive atomically.
 * It is never folded into a payment transaction: the cache is one row per user, and writing it from
 * the serializable money path would add a write-write conflict surface that domain does not have
 * today, for a figure that is rebuildable by definition.
 */
export async function recomputeUserProgress(
  userId: string,
  tx?: Prisma.TransactionClient,
  medalContext?: MedalEvaluationContext,
): Promise<RecomputeResult> {
  const db = tx ?? prisma;

  const entries = await db.pointLedgerEntry.findMany({
    // A voided entry never re-enters the surviving set, whatever the state of the entity it names.
    where: { userId, voidedAt: null },
    select: {
      id: true,
      ruleKey: true,
      entityType: true,
      entityId: true,
      points: true,
      occurredOn: true,
      createdAt: true,
    },
  });

  const facts = await loadProgressionFacts(db, userId, entries);
  const eligible = entries.filter((entry) => isEntryEligible(entry, facts));
  const derivedTotal = applyCaps(eligible);

  const [existing, unlocks] = await Promise.all([
    db.userProgress.findUnique({ where: { userId }, select: { highestRankIndex: true } }),
    db.medalUnlock.findMany({ where: { userId }, select: { medalKey: true } }),
  ]);
  const alreadyUnlockedKeys = unlocks.map((unlock) => unlock.medalKey);

  const candidates = await evaluateUnlocks({ userId, alreadyUnlockedKeys, context: medalContext, db });
  const now = new Date();
  if (candidates.length > 0) {
    await db.medalUnlock.createMany({
      data: candidates.map((candidate) => ({
        userId,
        medalKey: candidate.medalKey,
        series: candidate.series,
        rarity: candidate.rarity,
        numbered: candidate.numbered,
        unlockedAt: now,
      })),
      // The unique key is the idempotency guarantee; a concurrent run must not turn into a crash.
      skipDuplicates: true,
    });
  }

  const unlockedMedalKeys = [...alreadyUnlockedKeys, ...candidates.map((candidate) => candidate.medalKey)];
  const { currentRankIndex: rankIndex } = deriveRank({
    maturedPoints: derivedTotal,
    unlockedMedalCount: unlockedMedalKeys.length,
    // Not the raw shipped count: the merit lock's denominator drops the medals this collector
    // cannot reach on their own, so a gate they can never satisfy is never presented as one
    // (`FR-12-17`).
    shippedMedalCount: getMeritLockDenominator(unlockedMedalKeys, now),
  });
  const currentRankIndex = Math.max(FIRST_RANK_INDEX, rankIndex);
  // The running maximum, never a comparison against the current total. A collector who deletes an
  // order loses the points and keeps the title.
  const highestRankIndex = Math.max(existing?.highestRankIndex ?? FIRST_RANK_INDEX, currentRankIndex);

  await db.userProgress.upsert({
    where: { userId },
    create: {
      userId,
      maturedPoints: derivedTotal,
      rankIndex: currentRankIndex,
      highestRankIndex,
      lastRecomputedAt: now,
    },
    update: { maturedPoints: derivedTotal, rankIndex: currentRankIndex, highestRankIndex, lastRecomputedAt: now },
  });

  return {
    derivedTotal,
    currentRankIndex,
    highestRankIndex,
    unlockedThisRun: candidates.map((candidate) => candidate.medalKey),
  };
}

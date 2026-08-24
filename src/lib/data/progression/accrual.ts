import * as Sentry from "@sentry/nextjs";
import { OrderItemDeliveryState, OrderStatus } from "../../../../generated/prisma/client";
import type { Prisma } from "../../../../generated/prisma/client";
import { resolveSettledOrderIds } from "./moneyPredicateAdapter";
import {
  orderRegisteredPoints,
  POINT_RULE_KEYS,
  PROGRESSION_ENTITY_TYPES,
  type PointRuleKey,
  type ProgressionEntityType,
} from "./pointRules";
import { findMedal } from "./medalCatalogue";
import type { MedalEvaluationContext } from "./medalEvaluation";
import { awardPointsBatch, type AwardPointsInput } from "./progressionMutations";
import { getUserProgressCache, resolveProgressionOccurredOn } from "./progressionQueries";
import { recomputeUserProgress } from "./recompute";
import { isStoreCreditEligible, type StoreEligibilityRow } from "./storeCreditEligibility";

/**
 * The credit call sites: the bridge between what the collector just did and the ledger.
 *
 * Everything here follows three rules that are easy to state and easy to break:
 *
 *   1. **A credit never fails a business mutation.** Progression is a secondary effect. Every
 *      function below resolves to `null` instead of throwing, whatever went wrong, and the host's
 *      own result is untouched. `null` is not "zero points", it is "we do not know", and it travels
 *      all the way to the client as `progression: null` rather than a guessed delta.
 *   2. **The write rides inside the host's transaction, after its last refusal.** A mutation that
 *      ends up refusing must not leave a credit behind, so the ledger append shares the host's
 *      atomicity. The progress CACHE is the opposite: it is written after that transaction commits,
 *      because a single row per user inside the serializable payment path would be a new
 *      write-write conflict surface the money domain does not have today.
 *   3. **The write prices, the recompute decides.** A call site computes what a fact is worth at the
 *      moment it happens (the anti-split position, for instance, which is only knowable then) and
 *      appends it. Whether that entry still counts, and whether the monthly cap already swallowed
 *      it, is re-derived every recompute and is never cached here.
 *
 * The store gate (a private store, or one that is not approved, credits nothing) is applied HERE, at
 * write time, as well as at recompute time. Both are needed: the recompute stops a store that turns
 * ineligible later, and this stops the entry from ever existing, which is what keeps a store nobody
 * ever approved out of the ledger entirely.
 */

/**
 * What a Server Action hands back so the client can raise the toast without a second round trip.
 *
 * Deliberately no display name: this path runs inside a mutation that has no locale, and a name
 * resolved here would be a hardcoded user-facing string. The client already has the catalogue key
 * and reads `progress.medals.<medalKey>.name` from its own translations.
 */
export type MedalUnlockSummary = {
  medalKey: string;
  rarity: string;
  series: string;
};

export type ProgressionDelta = {
  pointsDelta: number;
  rankUp: { from: number; to: number } | null;
  medalsUnlocked: MedalUnlockSummary[];
};

/**
 * Rows a credit step actually appended, or `null` when the step itself failed and was swallowed.
 *
 * Deliberately not a list of what was credited: the ledger is not the balance. Two entries worth 30
 * points can be worth 30, 12 or 0 depending on the caps and on facts this call site cannot see, so
 * the only honest delta comes from re-deriving the total afterwards.
 */
export type CreditOutcome = number | null;

type PointCredit = {
  ruleKey: PointRuleKey;
  entityType: ProgressionEntityType;
  entityId: string;
  points: number;
};

/** Reports a swallowed credit failure with progression-safe context: no amounts, no store names. */
function captureCreditFailure(error: unknown, callSite: string, userId: string): null {
  Sentry.withScope((scope) => {
    scope.setTag("feature", "progression");
    scope.setTag("severity", "low");
    scope.setContext("progression", { callSite, userId });
    Sentry.captureException(error);
  });
  return null;
}

/** Appends the given credits, all stamped with the one civil day the call site resolved. */
async function appendCredits(
  tx: Prisma.TransactionClient,
  userId: string,
  occurredOn: Date,
  credits: readonly PointCredit[],
): Promise<number> {
  if (credits.length === 0) {
    return 0;
  }

  const inputs: AwardPointsInput[] = credits.map((credit) => ({
    userId,
    ruleKey: credit.ruleKey,
    entityType: credit.entityType,
    entityId: credit.entityId,
    points: credit.points,
    occurredOn,
    source: "LIVE",
  }));

  const { credited } = await awardPointsBatch(tx, inputs);
  return credited;
}

/**
 * Folds several credit steps into one outcome.
 *
 * A single failed step poisons the whole answer rather than being netted out, because a partial
 * delta is worse than no delta: the collector would be told a number that is wrong in a direction
 * nothing on screen can explain.
 */
export function combineCredits(...outcomes: readonly CreditOutcome[]): CreditOutcome {
  if (outcomes.some((outcome) => outcome === null)) {
    return null;
  }
  return outcomes.reduce((sum: number, outcome) => sum + (outcome ?? 0), 0);
}

/**
 * `order-created` (immediate) and `store-first-order`, at the moment the order row exists.
 *
 * `store-first-order` is decided by a count of the collector's OTHER orders at this store. It is a
 * write-time hint under concurrency, not a source of truth: the entry is keyed by the store, so two
 * racing first orders can at worst both offer the same entry and the unique key keeps one.
 */
export async function creditOrderCreation(
  tx: Prisma.TransactionClient,
  params: { userId: string; orderId: string; storeId: string; store: StoreEligibilityRow | null },
): Promise<CreditOutcome> {
  try {
    if (!isStoreCreditEligible(params.store)) {
      return 0;
    }

    const occurredOn = await resolveProgressionOccurredOn(params.userId, new Date(), tx);
    const credits: PointCredit[] = [
      {
        ruleKey: POINT_RULE_KEYS.ORDER_CREATED,
        entityType: PROGRESSION_ENTITY_TYPES.ORDER,
        entityId: params.orderId,
        points: 5,
      },
    ];

    const previousOrdersAtStore = await tx.order.count({
      where: { userId: params.userId, storeId: params.storeId, id: { not: params.orderId } },
    });
    if (previousOrdersAtStore === 0) {
      credits.push({
        ruleKey: POINT_RULE_KEYS.STORE_FIRST_ORDER,
        entityType: PROGRESSION_ENTITY_TYPES.STORE,
        entityId: params.storeId,
        points: 20,
      });
    }

    return await appendCredits(tx, params.userId, occurredOn, credits);
  } catch (error) {
    return captureCreditFailure(error, "creditOrderCreation", params.userId);
  }
}

/**
 * The first day of the civil month the entry itself is being filed under.
 *
 * Derived from the entry's own `occurredOn` (already resolved through the collector's timezone and
 * pinned to UTC midnight), never from a bare `new Date()`: the ladder's window and the monthly cap
 * that later truncates it have to be talking about the same month, and at 21:00 in Lima a wall-clock
 * instant is already tomorrow in UTC, so on the last evening of a month the two would disagree.
 */
function civilMonthStart(occurredOn: Date): Date {
  return new Date(Date.UTC(occurredOn.getUTCFullYear(), occurredOn.getUTCMonth(), 1));
}

/**
 * The 1-based position of each order among the collector's own orders at the same store within the
 * same civil month, which is the only input the anti-split ladder takes.
 *
 * One query for the whole store rather than one per order, and ordered by creation so the ladder is
 * stable: re-running it for the same order yields the same position as long as no earlier order was
 * inserted, and the recompute settles any tie two same-month creates could produce.
 */
async function resolveStoreMonthPositions(
  tx: Prisma.TransactionClient,
  userId: string,
  storeId: string,
  orderIds: readonly string[],
  occurredOn: Date,
): Promise<Map<string, number>> {
  const positions = new Map<string, number>();
  if (orderIds.length === 0) {
    return positions;
  }

  const monthStart = civilMonthStart(occurredOn);
  const monthOrders = await tx.order.findMany({
    where: { userId, storeId, createdAt: { gte: monthStart } },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const wanted = new Set(orderIds);
  monthOrders.forEach((order, index) => {
    if (wanted.has(order.id)) {
      positions.set(order.id, index + 1);
    }
  });

  // An order created in an EARLIER civil month than the payment that first funds it is not in the
  // window above, and `order-registered` is filed under the credit's month, not the order's. It
  // joins that month's ladder at the back rather than at the front: a collector whose first payment
  // of the month lands on an old order has still registered one more thing at that store this
  // month, and giving it the opening 20 would hand out the top of the ladder as many times as they
  // have old orders, which is exactly the split the ladder exists to discourage.
  let tail = monthOrders.length;
  for (const orderId of orderIds) {
    if (!positions.has(orderId)) {
      tail += 1;
      positions.set(orderId, tail);
    }
  }

  return positions;
}

/**
 * `order-first-payment`, `order-registered` and `order-settled`, at the moment an order first
 * carries declared money.
 *
 * All three are offered unconditionally for every order this write touched, including orders that
 * were already paid before. That is not sloppiness: the idempotency key is the order itself, so a
 * second payment against the same order appends nothing, and offering it every time is what makes
 * the credit robust against a first payment that was recorded through a path this slice does not
 * know about.
 *
 * `order-settled` is the one that reads money, and it reads it through the predicate adapter, which
 * answers yes or no and hands back no figure.
 */
export async function creditOrderPayment(
  tx: Prisma.TransactionClient,
  params: { userId: string; storeId: string; orderIds: readonly string[]; storeCreditEligible: boolean },
): Promise<CreditOutcome> {
  try {
    if (!params.storeCreditEligible || params.orderIds.length === 0) {
      return 0;
    }

    const orderIds = [...new Set(params.orderIds)];
    const occurredOn = await resolveProgressionOccurredOn(params.userId, new Date(), tx);
    const positions = await resolveStoreMonthPositions(tx, params.userId, params.storeId, orderIds, occurredOn);
    const settledOrderIds = await resolveSettledOrderIds(params.userId, orderIds, tx);

    const credits: PointCredit[] = [];
    for (const orderId of orderIds) {
      credits.push({
        ruleKey: POINT_RULE_KEYS.ORDER_FIRST_PAYMENT,
        entityType: PROGRESSION_ENTITY_TYPES.ORDER,
        entityId: orderId,
        points: 8,
      });
      credits.push({
        ruleKey: POINT_RULE_KEYS.ORDER_REGISTERED,
        entityType: PROGRESSION_ENTITY_TYPES.ORDER,
        entityId: orderId,
        points: orderRegisteredPoints({ storeMonthPosition: positions.get(orderId) ?? 1 }),
      });
      if (settledOrderIds.has(orderId)) {
        credits.push({
          ruleKey: POINT_RULE_KEYS.ORDER_SETTLED,
          entityType: PROGRESSION_ENTITY_TYPES.ORDER,
          entityId: orderId,
          points: 12,
        });
      }
    }

    return await appendCredits(tx, params.userId, occurredOn, credits);
  } catch (error) {
    return captureCreditFailure(error, "creditOrderPayment", params.userId);
  }
}

/**
 * `delivery-received` and `product-type-discovered`, inside whichever transaction actually moved the
 * delivery into its delivered state.
 *
 * Never inside the independent money transaction that settles the orders the arrival closed: that
 * one runs after, commits separately, and can refuse on its own without the arrival being any less
 * real.
 *
 * `delivery-received` is credited per delivery, not per product. `product-type-discovered` is the
 * exception, and is keyed by the catalogue type rather than by anything belonging to this delivery,
 * which is what makes it "the first time this collector ever received one of these" for good.
 */
export async function creditDeliveryReceived(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    deliveryId: string;
    store: StoreEligibilityRow | null;
    deliveredItemIds: readonly string[];
  },
): Promise<CreditOutcome> {
  try {
    if (!isStoreCreditEligible(params.store)) {
      return 0;
    }

    const occurredOn = await resolveProgressionOccurredOn(params.userId, new Date(), tx);
    const credits: PointCredit[] = [
      {
        ruleKey: POINT_RULE_KEYS.DELIVERY_RECEIVED,
        entityType: PROGRESSION_ENTITY_TYPES.DELIVERY,
        entityId: params.deliveryId,
        points: 25,
      },
    ];

    if (params.deliveredItemIds.length > 0) {
      const deliveredTypes = await tx.orderItem.findMany({
        where: {
          id: { in: [...params.deliveredItemIds] },
          userId: params.userId,
          productTypeKey: { not: null },
          deliveryState: OrderItemDeliveryState.DELIVERED,
          order: { status: { not: OrderStatus.CANCELLED } },
        },
        select: { productTypeKey: true },
        distinct: ["productTypeKey"],
      });

      for (const row of deliveredTypes) {
        if (row.productTypeKey) {
          credits.push({
            ruleKey: POINT_RULE_KEYS.PRODUCT_TYPE_DISCOVERED,
            entityType: PROGRESSION_ENTITY_TYPES.PRODUCT_TYPE,
            entityId: row.productTypeKey,
            points: 12,
          });
        }
      }
    }

    return await appendCredits(tx, params.userId, occurredOn, credits);
  } catch (error) {
    return captureCreditFailure(error, "creditDeliveryReceived", params.userId);
  }
}

/**
 * `store-reviewed`, at the moment a review is written for a store the collector already bought from.
 *
 * The `entityId` is the STORE, never the review row, which is what makes deleting a review and
 * writing it again credit exactly once (`AC-12-05`). Two gates apply and both are the same shape
 * every other call site uses: the store must be able to credit at all (`BR-12-07`), and the
 * collector must have actually received a product from it, checked as an existence question over
 * delivered products rather than as anything monetary.
 */
export async function creditStoreReviewed(
  tx: Prisma.TransactionClient,
  params: { userId: string; storeId: string; store: StoreEligibilityRow | null },
): Promise<CreditOutcome> {
  try {
    if (!isStoreCreditEligible(params.store)) {
      return 0;
    }

    const received = await tx.order.findFirst({
      where: {
        userId: params.userId,
        storeId: params.storeId,
        status: { not: OrderStatus.CANCELLED },
        items: { some: { deliveryState: OrderItemDeliveryState.DELIVERED } },
      },
      select: { id: true },
    });
    if (!received) {
      return 0;
    }

    const occurredOn = await resolveProgressionOccurredOn(params.userId, new Date(), tx);
    return await appendCredits(tx, params.userId, occurredOn, [
      {
        ruleKey: POINT_RULE_KEYS.STORE_REVIEWED,
        entityType: PROGRESSION_ENTITY_TYPES.STORE,
        entityId: params.storeId,
        points: 20,
      },
    ]);
  } catch (error) {
    return captureCreditFailure(error, "creditStoreReviewed", params.userId);
  }
}

/**
 * `order-completed`, at the exact point the derived status is persisted.
 *
 * The anchor is the derivation itself rather than any one delivery mutation, because `COMPLETED` is
 * never typed by anybody: it falls out of every product of the order having arrived. Crediting where
 * that fact is written is what keeps the two from drifting apart, whichever caller produced it.
 */
export async function creditOrdersCompleted(
  tx: Prisma.TransactionClient,
  params: { userId: string; orders: ReadonlyArray<{ orderId: string; store: StoreEligibilityRow | null }> },
): Promise<CreditOutcome> {
  try {
    // The gate runs before the civil day is resolved, not after: a batch where no order's store can
    // credit must cost nothing at all, not a user read for entries that will never be written.
    const creditable = params.orders.filter((order) => isStoreCreditEligible(order.store));
    if (creditable.length === 0) {
      return 0;
    }

    const occurredOn = await resolveProgressionOccurredOn(params.userId, new Date(), tx);
    const credits: PointCredit[] = creditable.map((order) => ({
      ruleKey: POINT_RULE_KEYS.ORDER_COMPLETED,
      entityType: PROGRESSION_ENTITY_TYPES.ORDER,
      entityId: order.orderId,
      points: 30,
    }));

    return await appendCredits(tx, params.userId, occurredOn, credits);
  } catch (error) {
    return captureCreditFailure(error, "creditOrdersCompleted", params.userId);
  }
}

/**
 * Widens the recompute's list of newly unlocked keys into what the toast needs.
 *
 * A key the catalogue no longer knows is dropped rather than reported: a retired medal should
 * quietly stop appearing, not raise a toast for something the client cannot name.
 */
function toMedalUnlockSummaries(medalKeys: readonly string[]): MedalUnlockSummary[] {
  return medalKeys.flatMap((medalKey) => {
    const medal = findMedal(medalKey);
    return medal ? [{ medalKey: medal.medalKey, rarity: medal.rarity, series: medal.series }] : [];
  });
}

/**
 * Turns "we appended N rows" into the delta the client shows, AFTER the host transaction committed.
 *
 * The figure is never guessed from the rows just written. The recompute is what applies the caps and
 * the eligibility conditions, so an order that has no assigned payment yet correctly reports a delta
 * of zero even though its entries exist, and a collector who already hit the monthly ceiling is not
 * told they earned something they did not.
 *
 * Running the recompute here is the only write that touches the progress cache on a mutation path,
 * and it deliberately happens outside the host transaction, on its own connection.
 */
export async function settleProgression(
  userId: string,
  credited: CreditOutcome,
  medalContext?: MedalEvaluationContext,
): Promise<ProgressionDelta | null> {
  if (credited === null) {
    return null;
  }
  // Nothing was appended, which means the store gate refused or every entry was already there. No
  // new fact reached the ledger, so no medal can have turned true from this action either; one that
  // did turn true through some other path is picked up by the next recompute, never lost.
  if (credited === 0) {
    return { pointsDelta: 0, rankUp: null, medalsUnlocked: [] };
  }

  try {
    const before = await getUserProgressCache(userId);
    const after = await recomputeUserProgress(userId, undefined, medalContext);

    // No previous cache means this is the collector's first ever credited action; there is no rank
    // they moved UP from, so nothing is announced as a promotion.
    const rankUp =
      before && after.currentRankIndex > before.rankIndex
        ? { from: before.rankIndex, to: after.currentRankIndex }
        : null;

    return {
      pointsDelta: after.derivedTotal - (before?.maturedPoints ?? 0),
      rankUp,
      medalsUnlocked: toMedalUnlockSummaries(after.unlockedThisRun),
    };
  } catch (error) {
    return captureCreditFailure(error, "settleProgression", userId);
  }
}

import { DeliveryStatus, OrderItemDeliveryState, OrderStatus } from "../../../../generated/prisma/client";
import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveTimeZone } from "@/lib/data/dashboard/dashboardPeriods";
import { hasImageIntakeMarker } from "@/lib/imageIntake/imageIntakeMarker";
import { resolveSettledOrderIds } from "./moneyPredicateAdapter";
import { CREDITABLE_STORE_FILTER } from "./storeCreditEligibility";
import {
  MEDAL_CONDITIONS,
  listStatefulUnlockedMedals,
  resolveConditionsToEvaluate,
  selectUnlockedMedals,
  type MedalCondition,
  type MedalUnlockCandidate,
} from "./medalCatalogue";

/**
 * The database side of the medal catalogue: one resolver per condition key.
 *
 * The catalogue itself is a leaf that may not import anything, so this is where a medal's condition
 * meets the rows behind it. The division is the same one `pointRules.ts` and `recompute.ts` already
 * use, and it is what lets the money guard keep scanning the catalogue while medals still depend on
 * facts that are only knowable from the database.
 *
 * Three properties this module is built around:
 *
 *   1. **It never awards points.** Nothing here reaches the ledger, in either direction. A medal is
 *      status only (`FR-12-22`, `BR-12-08`, `ADR 0040`).
 *   2. **It resolves only what it has to.** A condition behind a medal the collector already holds
 *      is not queried at all, unless that medal is `stateful` and its currency has to be re-derived.
 *      An album that is almost full therefore costs almost nothing to evaluate.
 *   3. **Money arrives as a boolean.** `first-order-closed` needs to know whether an order is fully
 *      covered; it asks `moneyPredicateAdapter.ts` and receives a yes or no, never a figure.
 *
 * The store gate of `BR-12-07` is pushed into every query rather than applied afterwards: a private
 * store, or one that is not approved, unlocks nothing at all. It is the same `CREDITABLE_STORE_FILTER`
 * the points side reads, so the album and the ledger can never disagree about which stores count.
 */

const {
  ANY_ORDER,
  ANY_PAYMENT,
  ANY_ARRIVAL,
  ORDER_FULLY_CLOSED,
  REVIEW_AFTER_ARRIVAL,
  ORDER_FROM_IMAGE,
  WAIT_60_DAYS,
  WAIT_120_DAYS,
  WAIT_200_DAYS,
  SPLIT_ARRIVAL,
  MIDNIGHT_ORDER,
} = MEDAL_CONDITIONS;

/** Orders that count towards any medal: this collector's, not cancelled, at a creditable store. */
function creditableOrderFilter(userId: string) {
  return {
    userId,
    status: { not: OrderStatus.CANCELLED },
    store: CREDITABLE_STORE_FILTER,
  } as const;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Days between the day an order was placed and the day its last product arrived. */
const WAIT_DAY_THRESHOLDS: Readonly<Record<string, number>> = {
  [WAIT_60_DAYS]: 60,
  [WAIT_120_DAYS]: 120,
  [WAIT_200_DAYS]: 200,
};

/** The civil hour a stored instant falls on in the collector's own timezone, 0 to 23. */
export function getCivilHour(instant: Date, timeZone: string | null | undefined): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimeZone(timeZone),
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  return Number(parts.find((part) => part.type === "hour")?.value ?? "0");
}

/** First civil hour of the night window, and the first hour outside it (`00:00` to `03:59`). */
const MIDNIGHT_WINDOW_START_HOUR = 0;
const MIDNIGHT_WINDOW_END_HOUR = 4;

/**
 * Call-time facts a condition cannot re-derive from stored state later.
 *
 * `createdOrderNote` is the note of the order the CURRENT request just wrote, and it is the only
 * honest source for `first-photo-order`: the image-intake marker lives in a note the collector can
 * edit afterwards, so scanning notes at an arbitrary later recompute could lose a win that was
 * genuinely earned. Reading it here, in the same request that wrote it, cannot (`ADR 0040`).
 */
export type MedalEvaluationContext = {
  createdOrderNote?: string | null;
};

/** Runs `load` at most once, however many conditions end up asking for the same fact. */
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    pending ??= load();
    return pending;
  };
}

type ArrivalShape = {
  /** Longest wait, in days, over the collector's fully arrived orders. `-1` when there are none. */
  longestFullWaitDays: number;
  /** Whether some order's products arrived across more than one delivery. */
  hasSplitArrival: boolean;
};

/**
 * The one query behind `patience-*` and `split-arrival`, over orders with at least one arrival.
 *
 * Both conditions need the same join (order to its items to their deliveries), so they share it
 * rather than issuing it twice. The wait is measured only over orders that arrived COMPLETELY: an
 * order still missing a product has not "taken N days to arrive", it is simply still arriving.
 */
async function loadArrivalShape(db: Prisma.TransactionClient, userId: string): Promise<ArrivalShape> {
  const orders = await db.order.findMany({
    where: {
      ...creditableOrderFilter(userId),
      items: { some: { deliveryState: OrderItemDeliveryState.DELIVERED } },
    },
    select: {
      orderDate: true,
      items: {
        select: {
          deliveryState: true,
          deliveryItems: {
            select: { delivery: { select: { id: true, status: true, receivedDate: true } } },
          },
        },
      },
    },
  });

  let longestFullWaitDays = -1;
  let hasSplitArrival = false;

  for (const order of orders) {
    const deliveryIds = new Set<string>();
    let lastReceivedAt: number | null = null;

    for (const item of order.items) {
      for (const link of item.deliveryItems) {
        if (link.delivery.status !== DeliveryStatus.DELIVERED) {
          continue;
        }
        deliveryIds.add(link.delivery.id);
        const receivedAt = link.delivery.receivedDate?.getTime() ?? null;
        if (receivedAt !== null && (lastReceivedAt === null || receivedAt > lastReceivedAt)) {
          lastReceivedAt = receivedAt;
        }
      }
    }

    if (deliveryIds.size > 1) {
      hasSplitArrival = true;
    }

    const fullyArrived =
      order.items.length > 0 && order.items.every((item) => item.deliveryState === OrderItemDeliveryState.DELIVERED);
    if (!fullyArrived || lastReceivedAt === null) {
      continue;
    }

    // Both dates are civil days pinned to UTC midnight, so the difference is already whole days and
    // needs no timezone resolution of its own.
    const waitDays = Math.floor((lastReceivedAt - order.orderDate.getTime()) / MS_PER_DAY);
    if (waitDays > longestFullWaitDays) {
      longestFullWaitDays = waitDays;
    }
  }

  return { longestFullWaitDays, hasSplitArrival };
}

/** Whether any fully arrived order is also fully covered. The money half comes from the adapter. */
async function hasFullyClosedOrder(db: Prisma.TransactionClient, userId: string): Promise<boolean> {
  const orders = await db.order.findMany({
    where: {
      ...creditableOrderFilter(userId),
      items: {
        some: {},
        every: { deliveryState: OrderItemDeliveryState.DELIVERED },
      },
    },
    select: { id: true },
  });

  if (orders.length === 0) {
    return false;
  }

  const settled = await resolveSettledOrderIds(
    userId,
    orders.map((order) => order.id),
    db,
  );
  return settled.size > 0;
}

/** Whether an order was created inside the collector's own 00:00 to 04:00 window. */
async function hasMidnightOrder(db: Prisma.TransactionClient, userId: string): Promise<boolean> {
  const [user, orders] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
    db.order.findMany({ where: creditableOrderFilter(userId), select: { createdAt: true } }),
  ]);

  // `createdAt` is a real instant, unlike `orderDate`, which is a civil day with no time on it at
  // all. Comparing raw UTC hours would credit the wrong collectors entirely, so the instant is
  // resolved through the collector's own timezone first.
  return orders.some((order) => {
    const hour = getCivilHour(order.createdAt, user?.timezone);
    return hour >= MIDNIGHT_WINDOW_START_HOUR && hour < MIDNIGHT_WINDOW_END_HOUR;
  });
}

/**
 * Resolves the given condition keys against current state, and returns the ones that hold.
 *
 * Only the conditions actually asked for are queried; the caller decides which those are, which is
 * what keeps a collector with a full album from paying for eleven queries on every mutation.
 */
export async function resolveMedalConditions(
  db: Prisma.TransactionClient,
  userId: string,
  conditions: ReadonlySet<MedalCondition>,
  context: MedalEvaluationContext = {},
): Promise<ReadonlySet<MedalCondition>> {
  const arrivalShape = once(() => loadArrivalShape(db, userId));

  const resolvers: Readonly<Record<MedalCondition, () => Promise<boolean>>> = {
    [ANY_ORDER]: async () =>
      (await db.order.findFirst({ where: creditableOrderFilter(userId), select: { id: true } })) !== null,

    [ANY_PAYMENT]: async () =>
      (await db.paymentAllocation.findFirst({
        where: { userId, order: creditableOrderFilter(userId) },
        select: { id: true },
      })) !== null,

    [ANY_ARRIVAL]: async () =>
      (await db.delivery.findFirst({
        where: { userId, status: DeliveryStatus.DELIVERED, store: CREDITABLE_STORE_FILTER },
        select: { id: true },
      })) !== null,

    [ORDER_FULLY_CLOSED]: () => hasFullyClosedOrder(db, userId),

    [REVIEW_AFTER_ARRIVAL]: async () =>
      (await db.storeReview.findFirst({
        where: {
          userId,
          store: {
            ...CREDITABLE_STORE_FILTER,
            // The same anchor the `store-reviewed` point rule reads: a review only counts once the
            // collector has actually received something from that store.
            orders: {
              some: {
                userId,
                status: { not: OrderStatus.CANCELLED },
                items: { some: { deliveryState: OrderItemDeliveryState.DELIVERED } },
              },
            },
          },
        },
        select: { id: true },
      })) !== null,

    [ORDER_FROM_IMAGE]: async () => hasImageIntakeMarker(context.createdOrderNote),

    [WAIT_60_DAYS]: async () => (await arrivalShape()).longestFullWaitDays >= WAIT_DAY_THRESHOLDS[WAIT_60_DAYS],
    [WAIT_120_DAYS]: async () => (await arrivalShape()).longestFullWaitDays >= WAIT_DAY_THRESHOLDS[WAIT_120_DAYS],
    [WAIT_200_DAYS]: async () => (await arrivalShape()).longestFullWaitDays >= WAIT_DAY_THRESHOLDS[WAIT_200_DAYS],

    [SPLIT_ARRIVAL]: async () => (await arrivalShape()).hasSplitArrival,

    [MIDNIGHT_ORDER]: () => hasMidnightOrder(db, userId),

    // Phase 2 conditions are catalogued but not shipped, so nothing resolves them and no medal
    // behind one can ever be offered by this build.
    [MEDAL_CONDITIONS.PRODUCTS_DELIVERED_10]: async () => false,
    [MEDAL_CONDITIONS.PRODUCTS_DELIVERED_50]: async () => false,
    [MEDAL_CONDITIONS.PRODUCTS_DELIVERED_150]: async () => false,
    [MEDAL_CONDITIONS.ARRIVALS_25]: async () => false,
    [MEDAL_CONDITIONS.PRODUCT_TYPES_3]: async () => false,
    [MEDAL_CONDITIONS.PRODUCT_TYPES_6]: async () => false,
    [MEDAL_CONDITIONS.STORES_WITH_ARRIVAL_10]: async () => false,
    [MEDAL_CONDITIONS.COMPLETE_RECORD_1]: async () => false,
    [MEDAL_CONDITIONS.COMPLETE_RECORD_10]: async () => false,
    [MEDAL_CONDITIONS.STORE_ADOPTED]: async () => false,
    [MEDAL_CONDITIONS.SAME_DAY_SETTLE]: async () => false,
    [MEDAL_CONDITIONS.YEAR_STREAK]: async () => false,
  };

  const wanted = [...conditions];
  const results = await Promise.all(wanted.map((condition) => resolvers[condition]()));

  const satisfied = new Set<MedalCondition>();
  wanted.forEach((condition, index) => {
    if (results[index]) {
      satisfied.add(condition);
    }
  });
  return satisfied;
}

export type EvaluateUnlocksInput = {
  userId: string;
  alreadyUnlockedKeys: readonly string[];
  context?: MedalEvaluationContext;
  db?: Prisma.TransactionClient;
};

/**
 * The medals this collector has just earned, in catalogue order.
 *
 * Returns candidates only; writing them is the recompute's job, through `MedalUnlock`'s
 * `@@unique([userId, medalKey])`, so a re-evaluation of an already-held medal is a no-op insert
 * rather than a duplicate. The list is deterministic, which is what the celebration queue consumes.
 */
export async function evaluateUnlocks(input: EvaluateUnlocksInput): Promise<readonly MedalUnlockCandidate[]> {
  const db = input.db ?? prisma;
  const conditions = resolveConditionsToEvaluate(input.alreadyUnlockedKeys);
  if (conditions.size === 0) {
    return [];
  }

  const satisfiedConditions = await resolveMedalConditions(db, input.userId, conditions, input.context);
  return selectUnlockedMedals({ satisfiedConditions, alreadyUnlockedKeys: input.alreadyUnlockedKeys });
}

/**
 * Whether each `stateful` medal this collector holds still describes their situation.
 *
 * The unlock itself is never touched: a medal whose state stopped holding stays unlocked and in
 * colour, and only gains a line saying it is no longer current (`FR-12-23`, `BR-12-08`, `AC-12-12`).
 * Medals absent from the returned map are not stateful and are always current by construction.
 */
export async function resolveStatefulMedalCurrency(
  userId: string,
  unlockedMedalKeys: readonly string[],
  db: Prisma.TransactionClient = prisma,
): Promise<ReadonlyMap<string, boolean>> {
  const stateful = listStatefulUnlockedMedals(unlockedMedalKeys);
  if (stateful.length === 0) {
    return new Map();
  }

  const satisfied = await resolveMedalConditions(db, userId, new Set(stateful.map((medal) => medal.condition)));
  return new Map(stateful.map((medal) => [medal.medalKey, satisfied.has(medal.condition)]));
}

import { DeliveryStatus, OrderItemDeliveryState, OrderStatus } from "../../../../generated/prisma/client";
import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveTimeZone } from "@/lib/data/dashboard/dashboardPeriods";
import { hasImageIntakeMarker } from "@/lib/imageIntake/imageIntakeMarker";
import { countOrdersWithCompleteProductRecords, resolveSettledOrderIds } from "./moneyPredicateAdapter";
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
  STORES_ORDERED_2,
  ANY_PAYMENT,
  PREORDER_WINDOW_RECORDED,
  ANY_ARRIVAL,
  ORDER_FULLY_CLOSED,
  REVIEW_AFTER_ARRIVAL,
  REVIEWS_5,
  ORDER_FROM_IMAGE,
  WAIT_60_DAYS,
  WAIT_120_DAYS,
  WAIT_200_DAYS,
  SWIFT_ARRIVAL_7,
  SPLIT_ARRIVAL,
  MIDNIGHT_ORDER,
  PRODUCTS_DELIVERED_10,
  PRODUCTS_DELIVERED_50,
  PRODUCTS_DELIVERED_150,
  ARRIVALS_25,
  PRODUCT_TYPES_3,
  PRODUCT_TYPES_6,
  STORES_WITH_ARRIVAL_10,
  COUNTRIES_3,
  COMPLETE_RECORD_1,
  COMPLETE_RECORD_10,
  STORE_APPROVED_1,
  SAME_DAY_SETTLE,
  YEAR_STREAK,
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

/** The other end of the same measurement: an order that arrived within a week of being placed. */
const SWIFT_ARRIVAL_MAX_DAYS = 7;

/**
 * Delivered product LINES, not units.
 *
 * A collector who records "Nendoroid x3" on one line has one thing on the shelf as far as the album
 * is concerned, because counting the quantity column would turn a bulk purchase into three medals.
 */
const DELIVERED_PRODUCT_THRESHOLDS: Readonly<Record<string, number>> = {
  [PRODUCTS_DELIVERED_10]: 10,
  [PRODUCTS_DELIVERED_50]: 50,
  [PRODUCTS_DELIVERED_150]: 150,
};

/** Distinct `productTypeKey` values across delivered products. */
const PRODUCT_TYPE_THRESHOLDS: Readonly<Record<string, number>> = {
  [PRODUCT_TYPES_3]: 3,
  [PRODUCT_TYPES_6]: 6,
};

/** Orders whose every product line is fully filled in. */
const COMPLETE_RECORD_THRESHOLDS: Readonly<Record<string, number>> = {
  [COMPLETE_RECORD_1]: 1,
  [COMPLETE_RECORD_10]: 10,
};

/** Deliveries received, distinct stores something arrived from, and distinct countries behind them. */
const ARRIVAL_COUNT_THRESHOLD = 25;
const DISTINCT_ARRIVAL_STORE_THRESHOLD = 10;
const DISTINCT_ARRIVAL_COUNTRY_THRESHOLD = 3;

/** Distinct stores ordered from, which is what tells `first-store` apart from `first-order`. */
const DISTINCT_ORDERED_STORE_THRESHOLD = 2;

/** Reviews of stores the collector actually received from. */
const REVIEW_COUNT_THRESHOLD = 5;

/** Consecutive civil months carrying at least one order. */
const ORDER_STREAK_MONTHS = 12;

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

/** A fully arrived order, and the day its LAST product got here. */
type FullyArrivedOrder = { id: string; lastReceivedAt: number };

type ArrivalShape = {
  /** Longest wait, in days, over the collector's fully arrived orders. `-1` when there are none. */
  longestFullWaitDays: number;
  /**
   * Shortest such wait, `Number.POSITIVE_INFINITY` when there are none. A separate field rather than
   * a second pass because it is the same loop, and a negative wait (an arrival recorded before the
   * order date, which the app does not prevent) is skipped instead of winning the race.
   */
  shortestFullWaitDays: number;
  /** Whether some order's products arrived across more than one delivery. */
  hasSplitArrival: boolean;
  /** The fully arrived orders themselves, for the conditions that need to ask something else of them. */
  fullyArrivedOrders: readonly FullyArrivedOrder[];
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
      id: true,
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
  let shortestFullWaitDays = Number.POSITIVE_INFINITY;
  let hasSplitArrival = false;
  const fullyArrivedOrders: FullyArrivedOrder[] = [];

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
    if (waitDays >= 0 && waitDays < shortestFullWaitDays) {
      shortestFullWaitDays = waitDays;
    }
    fullyArrivedOrders.push({ id: order.id, lastReceivedAt });
  }

  return { longestFullWaitDays, shortestFullWaitDays, hasSplitArrival, fullyArrivedOrders };
}

/** Products that reached the collector's hands, at a store that may credit. */
function deliveredProductFilter(userId: string) {
  return {
    userId,
    deliveryState: OrderItemDeliveryState.DELIVERED,
    order: creditableOrderFilter(userId),
  } as const;
}

/** Deliveries that reached the collector's hands, at a store that may credit. */
function receivedDeliveryFilter(userId: string) {
  return { userId, status: DeliveryStatus.DELIVERED, store: CREDITABLE_STORE_FILTER } as const;
}

/**
 * A review that counts: of a creditable store the collector has actually received something from.
 *
 * The same anchor the `store-reviewed` point rule reads, stated once because two conditions share
 * it (`first-review` asks whether there is one, `reviews-5` asks how many).
 */
function creditableReviewFilter(userId: string) {
  return {
    userId,
    store: {
      ...CREDITABLE_STORE_FILTER,
      orders: {
        some: {
          userId,
          status: { not: OrderStatus.CANCELLED },
          items: { some: { deliveryState: OrderItemDeliveryState.DELIVERED } },
        },
      },
    },
  } as const;
}

/**
 * The longest run of CONSECUTIVE civil months carrying at least one order.
 *
 * `orderDate` is a civil day pinned to UTC midnight, so the month it belongs to is read straight
 * off the stored value with no timezone resolution: a collector who orders at 23:00 on the last day
 * of a month recorded that order ON that day, whatever instant the row was written at.
 */
function longestConsecutiveMonthRun(orderDates: readonly Date[]): number {
  const months = [...new Set(orderDates.map((date) => date.getUTCFullYear() * 12 + date.getUTCMonth()))].sort(
    (left, right) => left - right,
  );

  let longest = 0;
  let run = 0;
  let previous: number | null = null;

  for (const month of months) {
    run = previous !== null && month === previous + 1 ? run + 1 : 1;
    previous = month;
    if (run > longest) {
      longest = run;
    }
  }

  return longest;
}

/**
 * Whether some fully arrived order was also settled, with money declared on the very day it landed.
 *
 * Both dates are civil days pinned to UTC midnight, so "the same day" is a plain equality rather
 * than a timezone question. The money half stays a boolean: `resolveSettledOrderIds` decides which
 * orders are covered, and nothing here ever sees the figure that made them so.
 */
async function hasSameDaySettlement(db: Prisma.TransactionClient, userId: string, shape: ArrivalShape) {
  if (shape.fullyArrivedOrders.length === 0) {
    return false;
  }

  const settled = await resolveSettledOrderIds(
    userId,
    shape.fullyArrivedOrders.map((order) => order.id),
    db,
  );
  const arrivalDayByOrderId = new Map(
    shape.fullyArrivedOrders.filter((order) => settled.has(order.id)).map((order) => [order.id, order.lastReceivedAt]),
  );
  if (arrivalDayByOrderId.size === 0) {
    return false;
  }

  const allocations = await db.paymentAllocation.findMany({
    where: { userId, orderId: { in: [...arrivalDayByOrderId.keys()] } },
    select: { orderId: true, payment: { select: { paymentDate: true } } },
  });

  return allocations.some(
    (allocation) => arrivalDayByOrderId.get(allocation.orderId) === allocation.payment.paymentDate.getTime(),
  );
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
  const deliveredProductCount = once(() => db.orderItem.count({ where: deliveredProductFilter(userId) }));
  const deliveredProductTypes = once(() =>
    db.orderItem.findMany({
      where: { ...deliveredProductFilter(userId), productTypeKey: { not: null } },
      distinct: ["productTypeKey"],
      select: { productTypeKey: true },
    }),
  );
  const creditableReviewCount = once(() => db.storeReview.count({ where: creditableReviewFilter(userId) }));
  const completeRecordCount = once(() =>
    countOrdersWithCompleteProductRecords(userId, creditableOrderFilter(userId), db),
  );

  const resolvers: Readonly<Record<MedalCondition, () => Promise<boolean>>> = {
    [ANY_ORDER]: async () =>
      (await db.order.findFirst({ where: creditableOrderFilter(userId), select: { id: true } })) !== null,

    [STORES_ORDERED_2]: async () => {
      // `take` bounds the read: the question is "are there two", not "how many are there".
      const stores = await db.order.findMany({
        where: creditableOrderFilter(userId),
        distinct: ["storeId"],
        take: DISTINCT_ORDERED_STORE_THRESHOLD,
        select: { storeId: true },
      });
      return stores.length >= DISTINCT_ORDERED_STORE_THRESHOLD;
    },

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

    [PREORDER_WINDOW_RECORDED]: async () =>
      (await db.order.findFirst({
        where: {
          ...creditableOrderFilter(userId),
          // Either end of the window is enough: recording "llega entre marzo y abril" and recording
          // only the far end are both the collector saying this is a pre-order.
          OR: [{ expectedDeliveryFrom: { not: null } }, { expectedDeliveryTo: { not: null } }],
        },
        select: { id: true },
      })) !== null,

    [ORDER_FULLY_CLOSED]: () => hasFullyClosedOrder(db, userId),

    [REVIEW_AFTER_ARRIVAL]: async () => (await creditableReviewCount()) >= 1,

    // `StoreReview` is unique per store and collector, so five reviews are five different stores.
    [REVIEWS_5]: async () => (await creditableReviewCount()) >= REVIEW_COUNT_THRESHOLD,

    [ORDER_FROM_IMAGE]: async () => hasImageIntakeMarker(context.createdOrderNote),

    [WAIT_60_DAYS]: async () => (await arrivalShape()).longestFullWaitDays >= WAIT_DAY_THRESHOLDS[WAIT_60_DAYS],
    [WAIT_120_DAYS]: async () => (await arrivalShape()).longestFullWaitDays >= WAIT_DAY_THRESHOLDS[WAIT_120_DAYS],
    [WAIT_200_DAYS]: async () => (await arrivalShape()).longestFullWaitDays >= WAIT_DAY_THRESHOLDS[WAIT_200_DAYS],

    [SWIFT_ARRIVAL_7]: async () => (await arrivalShape()).shortestFullWaitDays <= SWIFT_ARRIVAL_MAX_DAYS,

    [SPLIT_ARRIVAL]: async () => (await arrivalShape()).hasSplitArrival,

    [MIDNIGHT_ORDER]: () => hasMidnightOrder(db, userId),

    [PRODUCTS_DELIVERED_10]: async () =>
      (await deliveredProductCount()) >= DELIVERED_PRODUCT_THRESHOLDS[PRODUCTS_DELIVERED_10],
    [PRODUCTS_DELIVERED_50]: async () =>
      (await deliveredProductCount()) >= DELIVERED_PRODUCT_THRESHOLDS[PRODUCTS_DELIVERED_50],
    [PRODUCTS_DELIVERED_150]: async () =>
      (await deliveredProductCount()) >= DELIVERED_PRODUCT_THRESHOLDS[PRODUCTS_DELIVERED_150],

    [ARRIVALS_25]: async () =>
      (await db.delivery.count({ where: receivedDeliveryFilter(userId) })) >= ARRIVAL_COUNT_THRESHOLD,

    [PRODUCT_TYPES_3]: async () => (await deliveredProductTypes()).length >= PRODUCT_TYPE_THRESHOLDS[PRODUCT_TYPES_3],
    [PRODUCT_TYPES_6]: async () => (await deliveredProductTypes()).length >= PRODUCT_TYPE_THRESHOLDS[PRODUCT_TYPES_6],

    [STORES_WITH_ARRIVAL_10]: async () => {
      const stores = await db.delivery.findMany({
        where: receivedDeliveryFilter(userId),
        distinct: ["storeId"],
        select: { storeId: true },
      });
      return stores.length >= DISTINCT_ARRIVAL_STORE_THRESHOLD;
    },

    [COUNTRIES_3]: async () => {
      // Asked of the STORE rather than of the delivery, because the country is the store's column
      // and a collector importing from three stores in one country has not crossed three borders.
      const countries = await db.store.findMany({
        where: {
          ...CREDITABLE_STORE_FILTER,
          deliveries: { some: { userId, status: DeliveryStatus.DELIVERED } },
        },
        distinct: ["countryCode"],
        select: { countryCode: true },
      });
      return countries.length >= DISTINCT_ARRIVAL_COUNTRY_THRESHOLD;
    },

    [COMPLETE_RECORD_1]: async () => (await completeRecordCount()) >= COMPLETE_RECORD_THRESHOLDS[COMPLETE_RECORD_1],
    [COMPLETE_RECORD_10]: async () => (await completeRecordCount()) >= COMPLETE_RECORD_THRESHOLDS[COMPLETE_RECORD_10],

    // The same `BR-12-07` gate as every other condition, not merely `status: APPROVED`: a private
    // store is not on the shared map, so putting one there is not the contribution this medal names.
    [STORE_APPROVED_1]: async () =>
      (await db.store.findFirst({
        where: { ...CREDITABLE_STORE_FILTER, createdByUserId: userId },
        select: { id: true },
      })) !== null,

    [SAME_DAY_SETTLE]: async () => hasSameDaySettlement(db, userId, await arrivalShape()),

    [YEAR_STREAK]: async () => {
      const orders = await db.order.findMany({
        where: creditableOrderFilter(userId),
        select: { orderDate: true },
      });
      return longestConsecutiveMonthRun(orders.map((order) => order.orderDate)) >= ORDER_STREAK_MONTHS;
    },
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

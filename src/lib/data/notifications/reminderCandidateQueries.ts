import {
  DeliveryStatus,
  NotificationSubjectType,
  NotificationType,
  OrderItemDeliveryState,
  OrderStatus,
} from "../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  REMINDER_ARRIVAL_LEAD_DAYS,
  REMINDER_COARSE_WINDOW_PADDING_DAYS,
  REMINDER_PAYMENT_LEAD_DAYS,
} from "@/lib/notifications/reminderConstants";

/**
 * Thin due-soon / overdue candidate queries used only by the reminder dispatcher.
 *
 * These intentionally never call `getDashboardData` (`BR-09-04`): a batch job must
 * not pay for a full per-collector dashboard build. Each query loads only the minimal
 * fields needed to compose and dedup a reminder (subject id, the relevant expected
 * dates, the store name, and the collector's timezone) and joins to
 * `user.pushSubscriptions.some({})` so only reachable collectors enter the batch. No
 * money rollups, no FX, no note text, and no full order graph are selected. The SQL
 * date bounds are coarse (padded for timezone edges); the authoritative window gate
 * runs per collector in the dispatcher.
 */

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The minimal reminder candidate the dispatcher consumes. `locale` is a nullable
 * extension point: `User` has no locale column today, so it is always `null` and the
 * dispatcher falls back to the default locale until a stored locale ships.
 */
export interface ReminderCandidate {
  userId: string;
  type: NotificationType;
  subjectType: NotificationSubjectType;
  subjectId: string;
  /** Deduplication key and window-gate input. */
  dueDate: Date;
  /** Currency-free display descriptor (the store name). Never money or note text. */
  descriptor: string;
  locale: string | null;
  timezone: string | null;
}

/** Only collectors with at least one persisted (active) push subscription are batched. */
const HAS_ACTIVE_SUBSCRIPTION = { pushSubscriptions: { some: {} } } as const;

function daysFromNow(now: Date, days: number): Date {
  return new Date(now.getTime() + days * MILLISECONDS_PER_DAY);
}

/** Coarse forward window `[now - padding, now + leadDays + padding]` for a "due" type. */
function coarseDueBounds(now: Date, leadDays: number): { gte: Date; lte: Date } {
  return {
    gte: daysFromNow(now, -REMINDER_COARSE_WINDOW_PADDING_DAYS),
    lte: daysFromNow(now, leadDays + REMINDER_COARSE_WINDOW_PADDING_DAYS),
  };
}

/** Coarse upper bound for the overdue gate: a reference date before `now + padding`. */
function coarseOverdueUpperBound(now: Date): Date {
  return daysFromNow(now, REMINDER_COARSE_WINDOW_PADDING_DAYS);
}

/**
 * Upcoming-payment candidates: non-cancelled orders with an outstanding balance whose
 * expected date falls in the coarse payment window (`BR-09-05`, `BR-09-08`). Outstanding
 * is read from the transactionally-synced `paidAmountMinor` cache and compared in memory,
 * so the payment graph is never loaded.
 */
export async function getPaymentDueCandidates(now: Date): Promise<ReminderCandidate[]> {
  const bounds = coarseDueBounds(now, REMINDER_PAYMENT_LEAD_DAYS);

  const rows = await prisma.order.findMany({
    where: {
      status: { not: OrderStatus.CANCELLED },
      expectedDeliveryFrom: bounds,
      user: HAS_ACTIVE_SUBSCRIPTION,
    },
    select: {
      id: true,
      userId: true,
      expectedDeliveryFrom: true,
      totalCost: true,
      paidAmountMinor: true,
      store: { select: { name: true } },
      user: { select: { timezone: true } },
    },
  });

  return rows
    .filter((row) => row.paidAmountMinor < row.totalCost && row.expectedDeliveryFrom !== null)
    .map((row) => ({
      userId: row.userId,
      type: NotificationType.PAYMENT_DUE,
      subjectType: NotificationSubjectType.ORDER,
      subjectId: row.id,
      dueDate: row.expectedDeliveryFrom!,
      descriptor: row.store.name,
      locale: null,
      timezone: row.user.timezone,
    }));
}

/**
 * Upcoming-arrival candidates: not-yet-arrived non-cancelled orders and `IN_TRANSIT`
 * deliveries whose expected arrival falls in the coarse arrival window (`BR-09-05`,
 * `BR-09-06`). An order counts as not-yet-arrived when none of its items has left the
 * `NONE` delivery state.
 */
export async function getArrivalDueCandidates(now: Date): Promise<ReminderCandidate[]> {
  const bounds = coarseDueBounds(now, REMINDER_ARRIVAL_LEAD_DAYS);

  const [orderRows, deliveryRows] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { not: OrderStatus.CANCELLED },
        items: { none: { deliveryState: { not: OrderItemDeliveryState.NONE } } },
        expectedDeliveryFrom: bounds,
        user: HAS_ACTIVE_SUBSCRIPTION,
      },
      select: {
        id: true,
        userId: true,
        expectedDeliveryFrom: true,
        store: { select: { name: true } },
        user: { select: { timezone: true } },
      },
    }),
    prisma.delivery.findMany({
      where: {
        status: DeliveryStatus.IN_TRANSIT,
        expectedArrivalFrom: bounds,
        user: HAS_ACTIVE_SUBSCRIPTION,
      },
      select: {
        id: true,
        userId: true,
        expectedArrivalFrom: true,
        store: { select: { name: true } },
        user: { select: { timezone: true } },
      },
    }),
  ]);

  const orderCandidates: ReminderCandidate[] = orderRows
    .filter((row) => row.expectedDeliveryFrom !== null)
    .map((row) => ({
      userId: row.userId,
      type: NotificationType.ARRIVAL_DUE,
      subjectType: NotificationSubjectType.ORDER,
      subjectId: row.id,
      dueDate: row.expectedDeliveryFrom!,
      descriptor: row.store.name,
      locale: null,
      timezone: row.user.timezone,
    }));

  const deliveryCandidates: ReminderCandidate[] = deliveryRows
    .filter((row) => row.expectedArrivalFrom !== null)
    .map((row) => ({
      userId: row.userId,
      type: NotificationType.ARRIVAL_DUE,
      subjectType: NotificationSubjectType.DELIVERY,
      subjectId: row.id,
      dueDate: row.expectedArrivalFrom!,
      descriptor: row.store.name,
      locale: null,
      timezone: row.user.timezone,
    }));

  return [...orderCandidates, ...deliveryCandidates];
}

/**
 * Overdue-arrival candidates: not-yet-arrived non-cancelled orders and `IN_TRANSIT`
 * deliveries whose arrival reference date is already past (`BR-09-05`, `BR-09-06`). The
 * reference date is `expectedDeliveryTo ?? expectedDeliveryFrom` for orders and
 * `expectedArrivalTo ?? expectedArrivalFrom` for deliveries. The SQL bound is coarse; the
 * dispatcher applies the precise per-collector "before today" gate.
 */
export async function getArrivalOverdueCandidates(now: Date): Promise<ReminderCandidate[]> {
  const upperBound = coarseOverdueUpperBound(now);

  const [orderRows, deliveryRows] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { not: OrderStatus.CANCELLED },
        items: { none: { deliveryState: { not: OrderItemDeliveryState.NONE } } },
        user: HAS_ACTIVE_SUBSCRIPTION,
        OR: [
          { expectedDeliveryTo: { lt: upperBound } },
          { expectedDeliveryTo: null, expectedDeliveryFrom: { lt: upperBound } },
        ],
      },
      select: {
        id: true,
        userId: true,
        expectedDeliveryFrom: true,
        expectedDeliveryTo: true,
        store: { select: { name: true } },
        user: { select: { timezone: true } },
      },
    }),
    prisma.delivery.findMany({
      where: {
        status: DeliveryStatus.IN_TRANSIT,
        user: HAS_ACTIVE_SUBSCRIPTION,
        OR: [
          { expectedArrivalTo: { lt: upperBound } },
          { expectedArrivalTo: null, expectedArrivalFrom: { lt: upperBound } },
        ],
      },
      select: {
        id: true,
        userId: true,
        expectedArrivalFrom: true,
        expectedArrivalTo: true,
        store: { select: { name: true } },
        user: { select: { timezone: true } },
      },
    }),
  ]);

  const orderCandidates: ReminderCandidate[] = orderRows
    .map((row) => ({ row, reference: row.expectedDeliveryTo ?? row.expectedDeliveryFrom }))
    .filter((entry) => entry.reference !== null)
    .map((entry) => ({
      userId: entry.row.userId,
      type: NotificationType.ARRIVAL_OVERDUE,
      subjectType: NotificationSubjectType.ORDER,
      subjectId: entry.row.id,
      dueDate: entry.reference!,
      descriptor: entry.row.store.name,
      locale: null,
      timezone: entry.row.user.timezone,
    }));

  const deliveryCandidates: ReminderCandidate[] = deliveryRows
    .map((row) => ({ row, reference: row.expectedArrivalTo ?? row.expectedArrivalFrom }))
    .filter((entry) => entry.reference !== null)
    .map((entry) => ({
      userId: entry.row.userId,
      type: NotificationType.ARRIVAL_OVERDUE,
      subjectType: NotificationSubjectType.DELIVERY,
      subjectId: entry.row.id,
      dueDate: entry.reference!,
      descriptor: entry.row.store.name,
      locale: null,
      timezone: entry.row.user.timezone,
    }));

  return [...orderCandidates, ...deliveryCandidates];
}

/** Loads every reminder candidate across the three types for a single dispatch run. */
export async function getAllReminderCandidates(now: Date): Promise<ReminderCandidate[]> {
  const [paymentDue, arrivalDue, arrivalOverdue] = await Promise.all([
    getPaymentDueCandidates(now),
    getArrivalDueCandidates(now),
    getArrivalOverdueCandidates(now),
  ]);
  return [...paymentDue, ...arrivalDue, ...arrivalOverdue];
}

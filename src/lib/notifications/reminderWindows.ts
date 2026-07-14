import { getTodayStart, resolveTimeZone } from "@/lib/data/dashboard/dashboardPeriods";
import { NotificationType } from "../../../generated/prisma/client";
import { REMINDER_ARRIVAL_LEAD_DAYS, REMINDER_PAYMENT_LEAD_DAYS } from "./reminderConstants";

/**
 * Timezone-aware windowing for reminder dispatch.
 *
 * Domain dates (`expectedDeliveryFrom`, `expectedArrivalTo`, ...) are persisted at
 * UTC midnight and represent a civil calendar day, so the collector's "today" is
 * resolved in their timezone (`UTC` fallback) and every boundary is expressed as a
 * UTC-midnight instant that compares cleanly against those columns. This mirrors the
 * budget-cycle rule the settings and dashboard domains already apply (`BR-09-03`).
 */

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** Forward lead window, in days, for each "due" reminder type. */
const LEAD_DAYS_BY_TYPE: Record<NotificationType, number> = {
  [NotificationType.PAYMENT_DUE]: REMINDER_PAYMENT_LEAD_DAYS,
  [NotificationType.ARRIVAL_DUE]: REMINDER_ARRIVAL_LEAD_DAYS,
  // Overdue is a "past" gate, not a forward window; the value is unused for it.
  [NotificationType.ARRIVAL_OVERDUE]: 0,
};

/** UTC-midnight instant of the collector's current civil day, given their timezone. */
export function resolveTodayStart(now: Date, timezone: string | null | undefined): Date {
  return getTodayStart(now, resolveTimeZone(timezone));
}

/**
 * True when a "due" reminder's expected date falls inside the collector's forward
 * window `[today, today + leadDays)`. Past-dated subjects are excluded here; those
 * belong to the overdue gate instead.
 */
export function isWithinDueWindow(dueDate: Date, todayStart: Date, leadDays: number): boolean {
  const time = dueDate.getTime();
  const windowEnd = todayStart.getTime() + leadDays * MILLISECONDS_PER_DAY;
  return time >= todayStart.getTime() && time < windowEnd;
}

/** True when an arrival's reference date is already before the collector's today. */
export function isOverdue(referenceDate: Date, todayStart: Date): boolean {
  return referenceDate.getTime() < todayStart.getTime();
}

/**
 * Authoritative per-collector gate: whether a candidate's due date still qualifies
 * once the collector's timezone is applied. "Due" types use the forward lead window;
 * the overdue type uses the past gate. Candidate queries pre-filter coarsely in UTC,
 * so this is the single source of truth for inclusion.
 */
export function isCandidateInWindow(type: NotificationType, dueDate: Date, todayStart: Date): boolean {
  if (type === NotificationType.ARRIVAL_OVERDUE) {
    return isOverdue(dueDate, todayStart);
  }
  return isWithinDueWindow(dueDate, todayStart, LEAD_DAYS_BY_TYPE[type]);
}

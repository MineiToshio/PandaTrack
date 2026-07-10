import { resolveBudgetResetCalendarDay } from "@/lib/user-settings/budgetCalendar";
import { DASHBOARD_DEFAULT_RANGE_MONTHS } from "./dashboardConstants";
import type { DashboardRangeSelection, DateRange, MonthKey } from "./dashboardTypes";

/**
 * Period helpers for the dashboard.
 *
 * Domain dates (`orderDate`, `paymentDate`, `expectedDelivery*`) are persisted at midnight UTC
 * and represent a civil calendar day (see `src/lib/domainDate.ts`). Period boundaries are
 * therefore expressed as UTC-midnight instants so they compare cleanly against those columns.
 * Which month/day is "current", however, depends on the collector's timezone, so the civil
 * date of `now` is resolved in `User.timezone` before the UTC boundaries are built (FR-06 notes).
 */

const DEFAULT_TIME_ZONE = "UTC";

type CivilDate = {
  year: number;
  /** Zero-based month, matching the `Date` convention. */
  monthIndex: number;
  day: number;
};

/** Returns a valid IANA timezone, falling back to UTC for null/invalid input. */
export function resolveTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) {
    return DEFAULT_TIME_ZONE;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** Civil (wall-clock) year/month/day of an instant in the given timezone. */
function getCivilDate(instant: Date, timeZone: string): CivilDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const lookup = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: lookup("year"),
    monthIndex: lookup("month") - 1,
    day: lookup("day"),
  };
}

/** UTC-midnight instant for a civil day. `Date.UTC` normalizes month/day overflow and underflow. */
function utcMidnight(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

/** Current calendar-month range `[start, end)` in the collector's timezone (FR-06-02). */
export function getCalendarMonthRange(now: Date, timeZone: string | null | undefined): DateRange {
  const zone = resolveTimeZone(timeZone);
  const { year, monthIndex } = getCivilDate(now, zone);
  return {
    start: utcMidnight(year, monthIndex, 1),
    end: utcMidnight(year, monthIndex + 1, 1),
  };
}

/**
 * Current budget-cycle range `[start, end)` anchored on `resetDay` (FR-06-06, BR-06-03).
 * The cycle containing `now` starts on this month's reset day when the current day has reached it,
 * otherwise on the previous month's reset day. A null reset day means "last day of the month".
 */
export function getBudgetCycleRange(
  now: Date,
  timeZone: string | null | undefined,
  resetDay: number | null,
): DateRange {
  const zone = resolveTimeZone(timeZone);
  const { year, monthIndex, day } = getCivilDate(now, zone);
  const currentReset = resolveBudgetResetCalendarDay(year, monthIndex, resetDay);

  if (day >= currentReset) {
    const nextReset = resolveBudgetResetCalendarDay(year, monthIndex + 1, resetDay);
    return {
      start: utcMidnight(year, monthIndex, currentReset),
      end: utcMidnight(year, monthIndex + 1, nextReset),
    };
  }

  const previousReset = resolveBudgetResetCalendarDay(year, monthIndex - 1, resetDay);
  return {
    start: utcMidnight(year, monthIndex - 1, previousReset),
    end: utcMidnight(year, monthIndex, currentReset),
  };
}

/** UTC-midnight instant of the current civil day, used for overdue comparisons (BR-06-01). */
export function getTodayStart(now: Date, timeZone: string | null | undefined): Date {
  const zone = resolveTimeZone(timeZone);
  const { year, monthIndex, day } = getCivilDate(now, zone);
  return utcMidnight(year, monthIndex, day);
}

/** Default trend range: the current month plus the previous five (FR-06-12). */
export function getDefaultDashboardRange(now: Date, timeZone: string | null | undefined): DateRange {
  const zone = resolveTimeZone(timeZone);
  const { year, monthIndex } = getCivilDate(now, zone);
  return {
    start: utcMidnight(year, monthIndex - (DASHBOARD_DEFAULT_RANGE_MONTHS - 1), 1),
    end: utcMidnight(year, monthIndex + 1, 1),
  };
}

/** Trailing window of `months` calendar months, ending with (and including) the current month. */
function getTrailingMonthsRange(now: Date, timeZone: string, months: number): DateRange {
  const { year, monthIndex } = getCivilDate(now, timeZone);
  return {
    start: utcMidnight(year, monthIndex - (months - 1), 1),
    end: utcMidnight(year, monthIndex + 1, 1),
  };
}

/**
 * Turns the collector's range selection into a concrete half-open month window (FR-06-12).
 * Presets are anchored on the current month in the collector's timezone; `all` starts at the month
 * of their earliest recorded activity and falls back to the default window when they have none.
 * A custom range is snapped outward to whole months, since every trend series is bucketed by month.
 */
export function resolveDashboardRange(
  selection: DashboardRangeSelection,
  now: Date,
  timeZone: string | null | undefined,
  earliestActivity: Date | null,
): DateRange {
  const zone = resolveTimeZone(timeZone);

  if (selection.preset === "custom") {
    const [from, to] =
      selection.from.getTime() <= selection.to.getTime()
        ? [selection.from, selection.to]
        : [selection.to, selection.from];
    return {
      start: utcMidnight(from.getUTCFullYear(), from.getUTCMonth(), 1),
      end: utcMidnight(to.getUTCFullYear(), to.getUTCMonth() + 1, 1),
    };
  }

  const { year, monthIndex } = getCivilDate(now, zone);
  const end = utcMidnight(year, monthIndex + 1, 1);

  switch (selection.preset) {
    case "3m":
      return getTrailingMonthsRange(now, zone, 3);
    case "12m":
      return getTrailingMonthsRange(now, zone, 12);
    case "ytd":
      return { start: utcMidnight(year, 0, 1), end };
    case "all": {
      if (!earliestActivity) {
        return getDefaultDashboardRange(now, zone);
      }
      const start = utcMidnight(earliestActivity.getUTCFullYear(), earliestActivity.getUTCMonth(), 1);
      return start.getTime() < end.getTime() ? { start, end } : getDefaultDashboardRange(now, zone);
    }
    case "6m":
    default:
      return getDefaultDashboardRange(now, zone);
  }
}

/** Month bucket of a domain date, keyed by its UTC calendar components. */
export function toMonthKey(instant: Date): MonthKey {
  return { year: instant.getUTCFullYear(), month: instant.getUTCMonth() + 1 };
}

/**
 * Exclusive end instant of a month bucket: UTC midnight of the first day of the following month.
 * `month` is 1-based, so passing it straight to `Date.UTC` already lands on the next month.
 */
export function getMonthEndExclusive(monthKey: MonthKey): Date {
  return new Date(Date.UTC(monthKey.year, monthKey.month, 1));
}

/** True when `instant` falls in the half-open range `[start, end)`. */
export function isWithinRange(instant: Date, range: DateRange): boolean {
  const time = instant.getTime();
  return time >= range.start.getTime() && time < range.end.getTime();
}

/** Ordered list of month buckets covered by a range, treating `range.end` as exclusive. */
export function enumerateMonthKeys(range: DateRange): MonthKey[] {
  const keys: MonthKey[] = [];
  let year = range.start.getUTCFullYear();
  let monthIndex = range.start.getUTCMonth();
  const endYear = range.end.getUTCFullYear();
  const endMonthIndex = range.end.getUTCMonth();

  while (year < endYear || (year === endYear && monthIndex < endMonthIndex)) {
    keys.push({ year, month: monthIndex + 1 });
    monthIndex += 1;
    if (monthIndex > 11) {
      monthIndex = 0;
      year += 1;
    }
  }

  return keys;
}

/** The month bucket `monthsAhead` calendar months after the current one, in the collector's timezone. */
export function getMonthKeyAhead(now: Date, timeZone: string | null | undefined, monthsAhead: number): MonthKey {
  const zone = resolveTimeZone(timeZone);
  const { year, monthIndex } = getCivilDate(now, zone);
  const target = utcMidnight(year, monthIndex + monthsAhead, 1);
  return toMonthKey(target);
}

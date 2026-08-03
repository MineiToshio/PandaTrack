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
 * date of `now` is resolved in `User.timezone` before the UTC boundaries are built.
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

/** Current calendar-month range `[start, end)` in the collector's timezone. */
export function getCalendarMonthRange(now: Date, timeZone: string | null | undefined): DateRange {
  const zone = resolveTimeZone(timeZone);
  const { year, monthIndex } = getCivilDate(now, zone);
  return {
    start: utcMidnight(year, monthIndex, 1),
    end: utcMidnight(year, monthIndex + 1, 1),
  };
}

/**
 * Current budget-cycle range `[start, end)` anchored on `resetDay`.
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

/** UTC-midnight instant of the current civil day, used for overdue comparisons. */
export function getTodayStart(now: Date, timeZone: string | null | undefined): Date {
  const zone = resolveTimeZone(timeZone);
  const { year, monthIndex, day } = getCivilDate(now, zone);
  return utcMidnight(year, monthIndex, day);
}

/** Default trend range: the current month plus the previous five. */
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
 * Trims months that precede the collector's first recorded activity.
 *
 * Those months are not "a month where nothing happened" — they are outside the series' domain
 * entirely, so plotting them buys a flat run of zeros that pushes the real data into a fraction of
 * the plot. A collector one month into the product asking for "last 12 months" would otherwise
 * spend 11/12 of the chart on months that predate their account.
 *
 * Only the leading run is trimmed. Interior gaps are left exactly where they are: an empty month
 * between two active ones is real data, and closing it up would put unequal time intervals on a
 * time axis, which misrepresents the slope between the points it joins (Few, *Line Graphs and
 * Irregular Intervals*; Tufte on scales that must "march to the very end in a consistent fashion").
 */
function clampToFirstActivity(range: DateRange, earliestActivity: Date | null): DateRange {
  if (!earliestActivity) {
    return range;
  }
  const activityMonth = utcMidnight(earliestActivity.getUTCFullYear(), earliestActivity.getUTCMonth(), 1);
  if (activityMonth.getTime() <= range.start.getTime() || activityMonth.getTime() >= range.end.getTime()) {
    return range;
  }
  return { start: activityMonth, end: range.end };
}

/**
 * Turns the collector's range selection into a concrete half-open month window.
 * Presets are anchored on the current month in the collector's timezone; `all` starts at the month
 * of their earliest recorded activity and falls back to the default window when they have none.
 * A custom range is snapped outward to whole months, since every trend series is bucketed by month.
 *
 * Every resolved window is then clamped forward to the collector's first activity, so no preset
 * ever renders months that predate their history. A custom range is exempt: the collector named
 * those bounds explicitly, and silently moving them would contradict the dates shown in the control.
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

  const preset = ((): DateRange => {
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
  })();

  return clampToFirstActivity(preset, earliestActivity);
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

import { describe, expect, it } from "vitest";
import {
  enumerateMonthKeys,
  getBudgetCycleRange,
  getCalendarMonthRange,
  getDefaultDashboardRange,
  getMonthKeyAhead,
  getTodayStart,
  isWithinRange,
  resolveDashboardRange,
  resolveTimeZone,
  toMonthKey,
} from "../dashboardPeriods";

const iso = (date: Date): string => date.toISOString();

describe("resolveTimeZone", () => {
  it("returns the timezone when valid", () => {
    expect(resolveTimeZone("Europe/Madrid")).toBe("Europe/Madrid");
  });

  it("falls back to UTC for null or invalid timezones", () => {
    expect(resolveTimeZone(null)).toBe("UTC");
    expect(resolveTimeZone("Not/AZone")).toBe("UTC");
  });
});

describe("getCalendarMonthRange", () => {
  it("returns half-open UTC-midnight month boundaries", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    const range = getCalendarMonthRange(now, "UTC");
    expect(iso(range.start)).toBe("2026-07-01T00:00:00.000Z");
    expect(iso(range.end)).toBe("2026-08-01T00:00:00.000Z");
  });

  it("uses the collector timezone to pick the month near a boundary (west of UTC)", () => {
    // 2026-07-01T00:30Z is still June 30 in Los Angeles (UTC-7 in summer).
    const now = new Date("2026-07-01T00:30:00Z");
    const range = getCalendarMonthRange(now, "America/Los_Angeles");
    expect(iso(range.start)).toBe("2026-06-01T00:00:00.000Z");
    expect(iso(range.end)).toBe("2026-07-01T00:00:00.000Z");
  });

  it("uses the collector timezone to pick the month near a boundary (east of UTC)", () => {
    // 2026-06-30T20:00Z is already July 1 in Tokyo (UTC+9).
    const now = new Date("2026-06-30T20:00:00Z");
    const range = getCalendarMonthRange(now, "Asia/Tokyo");
    expect(iso(range.start)).toBe("2026-07-01T00:00:00.000Z");
    expect(iso(range.end)).toBe("2026-08-01T00:00:00.000Z");
  });
});

describe("getBudgetCycleRange", () => {
  it("starts on this month's reset day once the current day has reached it", () => {
    const now = new Date("2026-07-20T12:00:00Z");
    const range = getBudgetCycleRange(now, "UTC", 15);
    expect(iso(range.start)).toBe("2026-07-15T00:00:00.000Z");
    expect(iso(range.end)).toBe("2026-08-15T00:00:00.000Z");
  });

  it("starts on the previous month's reset day before the reset day arrives", () => {
    const now = new Date("2026-07-10T12:00:00Z");
    const range = getBudgetCycleRange(now, "UTC", 15);
    expect(iso(range.start)).toBe("2026-06-15T00:00:00.000Z");
    expect(iso(range.end)).toBe("2026-07-15T00:00:00.000Z");
  });

  it("treats the reset day itself as the start of the new cycle", () => {
    const now = new Date("2026-07-15T00:00:00Z");
    const range = getBudgetCycleRange(now, "UTC", 15);
    expect(iso(range.start)).toBe("2026-07-15T00:00:00.000Z");
    expect(iso(range.end)).toBe("2026-08-15T00:00:00.000Z");
  });

  it("clamps a reset day that does not exist in a short month", () => {
    // Reset day 31, current month February -> clamps to the 28th.
    const now = new Date("2026-02-10T12:00:00Z");
    const range = getBudgetCycleRange(now, "UTC", 31);
    expect(iso(range.start)).toBe("2026-01-31T00:00:00.000Z");
    expect(iso(range.end)).toBe("2026-02-28T00:00:00.000Z");
  });

  it("uses the last day of the month when no reset day is configured", () => {
    const now = new Date("2026-07-10T12:00:00Z");
    const range = getBudgetCycleRange(now, "UTC", null);
    expect(iso(range.start)).toBe("2026-06-30T00:00:00.000Z");
    expect(iso(range.end)).toBe("2026-07-31T00:00:00.000Z");
  });
});

describe("getTodayStart", () => {
  it("returns the UTC-midnight instant of the collector's civil day", () => {
    const now = new Date("2026-07-01T02:00:00Z");
    // Still June 30 in Los Angeles.
    expect(iso(getTodayStart(now, "America/Los_Angeles"))).toBe("2026-06-30T00:00:00.000Z");
  });
});

describe("getDefaultDashboardRange", () => {
  it("spans the current month plus the previous five", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    const range = getDefaultDashboardRange(now, "UTC");
    expect(iso(range.start)).toBe("2026-02-01T00:00:00.000Z");
    expect(iso(range.end)).toBe("2026-08-01T00:00:00.000Z");
  });
});

describe("resolveDashboardRange", () => {
  const now = new Date("2026-07-15T12:00:00Z");

  it("anchors the trailing presets on the current month", () => {
    const threeMonths = resolveDashboardRange({ preset: "3m" }, now, "UTC", null);
    expect(iso(threeMonths.start)).toBe("2026-05-01T00:00:00.000Z");
    expect(iso(threeMonths.end)).toBe("2026-08-01T00:00:00.000Z");

    const twelveMonths = resolveDashboardRange({ preset: "12m" }, now, "UTC", null);
    expect(iso(twelveMonths.start)).toBe("2025-08-01T00:00:00.000Z");
    expect(iso(twelveMonths.end)).toBe("2026-08-01T00:00:00.000Z");
  });

  it("defaults to the last six months", () => {
    const range = resolveDashboardRange({ preset: "6m" }, now, "UTC", null);
    expect(iso(range.start)).toBe("2026-02-01T00:00:00.000Z");
    expect(iso(range.end)).toBe("2026-08-01T00:00:00.000Z");
  });

  it("starts year-to-date on January 1st", () => {
    const range = resolveDashboardRange({ preset: "ytd" }, now, "UTC", null);
    expect(iso(range.start)).toBe("2026-01-01T00:00:00.000Z");
    expect(iso(range.end)).toBe("2026-08-01T00:00:00.000Z");
  });

  it("starts `all` at the month of the earliest activity", () => {
    const range = resolveDashboardRange({ preset: "all" }, now, "UTC", new Date("2024-03-17T00:00:00Z"));
    expect(iso(range.start)).toBe("2024-03-01T00:00:00.000Z");
    expect(iso(range.end)).toBe("2026-08-01T00:00:00.000Z");
  });

  it("falls back to the default window when `all` has no activity to anchor on", () => {
    const range = resolveDashboardRange({ preset: "all" }, now, "UTC", null);
    expect(iso(range.start)).toBe("2026-02-01T00:00:00.000Z");
  });

  it("snaps a custom range outward to whole months", () => {
    const range = resolveDashboardRange(
      { preset: "custom", from: new Date("2026-03-17T00:00:00Z"), to: new Date("2026-05-02T00:00:00Z") },
      now,
      "UTC",
      null,
    );
    expect(iso(range.start)).toBe("2026-03-01T00:00:00.000Z");
    expect(iso(range.end)).toBe("2026-06-01T00:00:00.000Z");
  });

  it("tolerates a custom range whose endpoints are reversed", () => {
    const range = resolveDashboardRange(
      { preset: "custom", from: new Date("2026-05-02T00:00:00Z"), to: new Date("2026-03-17T00:00:00Z") },
      now,
      "UTC",
      null,
    );
    expect(iso(range.start)).toBe("2026-03-01T00:00:00.000Z");
    expect(iso(range.end)).toBe("2026-06-01T00:00:00.000Z");
  });
});

describe("toMonthKey", () => {
  it("keys a domain date by its UTC calendar month", () => {
    expect(toMonthKey(new Date("2026-07-01T00:00:00Z"))).toEqual({ year: 2026, month: 7 });
  });
});

describe("getMonthKeyAhead", () => {
  it("returns the month bucket a number of months ahead, rolling over the year", () => {
    const now = new Date("2026-11-15T12:00:00Z");
    expect(getMonthKeyAhead(now, "UTC", 3)).toEqual({ year: 2027, month: 2 });
  });
});

describe("isWithinRange", () => {
  const range = {
    start: new Date("2026-07-01T00:00:00Z"),
    end: new Date("2026-08-01T00:00:00Z"),
  };

  it("includes the start and excludes the end (half-open)", () => {
    expect(isWithinRange(new Date("2026-07-01T00:00:00Z"), range)).toBe(true);
    expect(isWithinRange(new Date("2026-07-31T23:59:59Z"), range)).toBe(true);
    expect(isWithinRange(new Date("2026-08-01T00:00:00Z"), range)).toBe(false);
    expect(isWithinRange(new Date("2026-06-30T23:59:59Z"), range)).toBe(false);
  });
});

describe("enumerateMonthKeys", () => {
  it("lists each month covered by a range, treating the end as exclusive", () => {
    const range = {
      start: new Date("2026-11-01T00:00:00Z"),
      end: new Date("2027-02-01T00:00:00Z"),
    };
    expect(enumerateMonthKeys(range)).toEqual([
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
    ]);
  });
});

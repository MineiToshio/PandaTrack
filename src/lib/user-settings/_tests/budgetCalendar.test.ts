import { describe, expect, it } from "vitest";
import { daysInMonth, resolveBudgetResetCalendarDay } from "@/lib/user-settings/budgetCalendar";

describe("resolveBudgetResetCalendarDay", () => {
  it("uses the last day when configured day is null", () => {
    expect(resolveBudgetResetCalendarDay(2026, 3, null)).toBe(30);
    expect(resolveBudgetResetCalendarDay(2026, 1, null)).toBe(28);
  });

  it("clamps to the last day when the day does not exist in the month", () => {
    expect(resolveBudgetResetCalendarDay(2026, 1, 31)).toBe(28);
    expect(resolveBudgetResetCalendarDay(2024, 1, 30)).toBe(29);
  });

  it("keeps the configured day when it exists", () => {
    expect(resolveBudgetResetCalendarDay(2026, 3, 15)).toBe(15);
  });
});

describe("daysInMonth", () => {
  it("returns 31 for March", () => {
    expect(daysInMonth(2026, 2)).toBe(31);
  });
});

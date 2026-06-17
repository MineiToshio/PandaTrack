import { describe, expect, it } from "vitest";
import { formatArrivalWindow, formatShortDate, getDeliveryOverdueDays } from "../deliveryDates";

describe("formatShortDate", () => {
  it("renders day + short month without year", () => {
    expect(formatShortDate(new Date(2026, 4, 2), "es")).toMatch(/2.*may/i);
  });
});

describe("formatArrivalWindow", () => {
  it("compacts a same-month range to a single month suffix", () => {
    const result = formatArrivalWindow(new Date(2026, 4, 15), new Date(2026, 4, 22), "es");
    expect(result).toMatch(/^15–22\s/);
    expect(result).toMatch(/may/i);
  });

  it("keeps both endpoints for a cross-month range", () => {
    const result = formatArrivalWindow(new Date(2026, 3, 25), new Date(2026, 4, 2), "es");
    expect(result).toContain("–");
    expect(result).toMatch(/abr/i);
    expect(result).toMatch(/may/i);
  });

  it("falls back to a single short date when one endpoint is missing", () => {
    expect(formatArrivalWindow(new Date(2026, 4, 18), null, "es")).toMatch(/18.*may/i);
    expect(formatArrivalWindow(null, new Date(2026, 4, 18), "es")).toMatch(/18.*may/i);
  });

  it("returns null when no endpoints exist", () => {
    expect(formatArrivalWindow(null, null, "es")).toBeNull();
  });
});

describe("getDeliveryOverdueDays", () => {
  const today = new Date(2026, 4, 3);

  it("returns whole days past the window end", () => {
    expect(getDeliveryOverdueDays(new Date(2026, 3, 30), today)).toBe(3);
  });

  it("returns 0 when the window has not passed", () => {
    expect(getDeliveryOverdueDays(new Date(2026, 4, 10), today)).toBe(0);
    expect(getDeliveryOverdueDays(new Date(2026, 4, 3), today)).toBe(0);
  });

  it("returns 0 when there is no window end", () => {
    expect(getDeliveryOverdueDays(null, today)).toBe(0);
  });
});

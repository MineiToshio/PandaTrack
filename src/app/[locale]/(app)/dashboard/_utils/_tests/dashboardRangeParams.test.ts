import { describe, expect, it } from "vitest";
import { buildDashboardRangeQuery, parseDashboardRangeSelection } from "../dashboardRangeParams";

describe("parseDashboardRangeSelection", () => {
  it("defaults to the last six months when the range param is absent", () => {
    expect(parseDashboardRangeSelection({})).toEqual({ preset: "6m" });
  });

  it("falls back to the default window for an unrecognized range", () => {
    expect(parseDashboardRangeSelection({ range: "last-decade" })).toEqual({ preset: "6m" });
  });

  it("reads a known preset", () => {
    expect(parseDashboardRangeSelection({ range: "12m" })).toEqual({ preset: "12m" });
    expect(parseDashboardRangeSelection({ range: "ytd" })).toEqual({ preset: "ytd" });
    expect(parseDashboardRangeSelection({ range: "all" })).toEqual({ preset: "all" });
  });

  it("reads a custom range as UTC-midnight domain dates", () => {
    const selection = parseDashboardRangeSelection({ range: "custom", from: "2026-03-17", to: "2026-05-02" });
    expect(selection).toEqual({
      preset: "custom",
      from: new Date("2026-03-17T00:00:00.000Z"),
      to: new Date("2026-05-02T00:00:00.000Z"),
    });
  });

  it("falls back to the default window when a custom range is missing or malformed", () => {
    expect(parseDashboardRangeSelection({ range: "custom" })).toEqual({ preset: "6m" });
    expect(parseDashboardRangeSelection({ range: "custom", from: "2026-03-17" })).toEqual({ preset: "6m" });
    expect(parseDashboardRangeSelection({ range: "custom", from: "yesterday", to: "today" })).toEqual({
      preset: "6m",
    });
  });

  it("reads the first value when a param is repeated", () => {
    expect(parseDashboardRangeSelection({ range: ["3m", "12m"] })).toEqual({ preset: "3m" });
  });
});

describe("buildDashboardRangeQuery", () => {
  it("encodes a preset", () => {
    expect(buildDashboardRangeQuery("12m")).toBe("?range=12m");
  });

  it("encodes a custom range with its day endpoints", () => {
    expect(buildDashboardRangeQuery("custom", "2026-03-17", "2026-05-02")).toBe(
      "?range=custom&from=2026-03-17&to=2026-05-02",
    );
  });

  it("drops incomplete custom endpoints rather than emitting a half range", () => {
    expect(buildDashboardRangeQuery("custom", "2026-03-17")).toBe("?range=custom");
  });
});

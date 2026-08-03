import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardLineChart, {
  resolveAxisTicks,
  resolveLabelIndices,
  shouldShowMarkers,
  type DashboardChartPoint,
  type DashboardChartSeries,
} from "../DashboardLineChart";

const spendSeries: DashboardChartSeries = {
  key: "spend",
  name: "Spend",
  color: "var(--accent)",
  values: [1000, 4000, 2500],
  formatted: ["$10.00", "$40.00", "$25.00"],
};

const POINTS: DashboardChartPoint[] = [
  { label: "May", year: 2026 },
  { label: "Jun", year: 2026 },
  { label: "Jul", year: 2026 },
];
const LABELS = POINTS.map((point) => point.label);

function renderChart(props: Partial<Parameters<typeof DashboardLineChart>[0]> = {}) {
  render(<DashboardLineChart series={[spendSeries]} points={POINTS} ariaLabel="Spend by month, 3 months" {...props} />);
  return screen.getByRole("img", { name: "Spend by month, 3 months" });
}

describe("DashboardLineChart", () => {
  it("plots one marker per month bucket", () => {
    const chart = renderChart();
    expect(chart.querySelectorAll("circle")).toHaveLength(POINTS.length);
    expect(chart.querySelectorAll("polyline")).toHaveLength(1);
  });

  it("renders the month labels along the x axis", () => {
    const chart = renderChart();
    const axisLabels = [...chart.querySelectorAll("text")].map((node) => node.textContent);
    expect(axisLabels).toEqual(expect.arrayContaining(LABELS));
  });

  it("describes the chart for screen readers", () => {
    const chart = renderChart();
    expect(chart.tagName.toLowerCase()).toBe("svg");
    expect(chart).toHaveAttribute("aria-label", "Spend by month, 3 months");
  });

  it("fills the area only when asked, and only for a single series", () => {
    expect(renderChart().querySelectorAll("polygon")).toHaveLength(0);
    screen.getByRole("img").remove();
    expect(renderChart({ showArea: true }).querySelectorAll("polygon")).toHaveLength(1);
  });

  it("prints the final value next to the last point when asked", () => {
    const chart = renderChart({ showLastValueLabel: true });
    const texts = [...chart.querySelectorAll("text")].map((node) => node.textContent);
    expect(texts).toContain("$25.00");
  });

  it("renders nothing when there is no data to plot", () => {
    const { container } = render(<DashboardLineChart series={[]} points={[]} ariaLabel="Spend by month, 0 months" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("stays flat at the baseline when every bucket is zero", () => {
    const chart = renderChart({
      series: [{ ...spendSeries, values: [0, 0, 0], formatted: ["$0.00", "$0.00", "$0.00"] }],
    });
    const yValues = [...chart.querySelectorAll("circle")].map((node) => node.getAttribute("cy"));
    expect(new Set(yValues).size).toBe(1);
  });

  // The chart's whole readability contract: one SVG user unit is one CSS pixel, so the declared
  // font sizes are the rendered font sizes. A viewBox wider than the element would scale the type
  // down again, which is the defect this replaced.
  it("keeps the viewBox at 1:1 so axis type is never scaled down", () => {
    const chart = renderChart();
    const [, , viewBoxWidth, viewBoxHeight] = (chart.getAttribute("viewBox") ?? "").split(" ").map(Number);
    expect(viewBoxWidth).toBe(Number(chart.getAttribute("width")));
    expect(viewBoxHeight).toBe(Number(chart.getAttribute("height")));
    // 12px is the design-system floor for chart text; a scaled viewBox would render it smaller.
    const axisFontSizes = [...chart.querySelectorAll("text")].map((node) => node.getAttribute("font-size"));
    expect(axisFontSizes).toContain("12");
  });

  it("prints the year on the axis only when the range spans more than one", () => {
    const singleYear = renderChart();
    expect([...singleYear.querySelectorAll("tspan")]).toHaveLength(0);
    screen.getByRole("img").remove();

    const crossing = renderChart({
      points: [
        { label: "Nov", year: 2025 },
        { label: "Dec", year: 2025 },
        { label: "Jan", year: 2026 },
      ],
    });
    const years = [...crossing.querySelectorAll("tspan")].map((node) => node.textContent);
    // One per distinct year, at the label where the year changes: never "Nov … Nov" with no clue.
    expect(years).toEqual(["2025", "2026"]);
  });
});

describe("shouldShowMarkers", () => {
  it("keeps markers while points are far enough apart to not overlap", () => {
    // 12 monthly points across a two-column plot: ~40px apart, comfortably above the 8px marker.
    expect(shouldShowMarkers(12, 444)).toBe(true);
  });

  it("drops markers once they would collide", () => {
    // The full 58-month history in the same plot: ~7.8px apart, under the 8px marker diameter.
    expect(shouldShowMarkers(58, 444)).toBe(false);
  });

  it("keeps a marker for a lone point", () => {
    expect(shouldShowMarkers(1, 444)).toBe(true);
  });
});

describe("resolveAxisTicks", () => {
  const months = (years: number[]) => years.map((year) => ({ year }));

  it("prints no year at all inside a single calendar year", () => {
    const ticks = resolveAxisTicks(months([2026, 2026, 2026]), 444);
    expect(ticks.every((tick) => !tick.showsYear)).toBe(true);
  });

  it("prints the year at the first tick and at every year change", () => {
    const ticks = resolveAxisTicks(months([2025, 2025, 2026, 2026, 2027]), 444);
    expect(ticks.filter((tick) => tick.showsYear).map((tick) => tick.index)).toEqual([0, 2, 4]);
  });

  it("still marks a year on a thinned axis, so a long range is never left undated", () => {
    // 58 months over five calendar years, thinned to ~12 ticks: at least the first must be dated.
    const years = Array.from({ length: 58 }, (_, i) => 2021 + Math.floor(i / 12));
    const ticks = resolveAxisTicks(months(years), 444);
    expect(ticks.some((tick) => tick.showsYear)).toBe(true);
    expect(ticks[0].showsYear).toBe(true);
  });
});

describe("resolveLabelIndices", () => {
  it("labels every month when they all fit", () => {
    expect(resolveLabelIndices(6, 444)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("thins the labels when they would collide, always keeping the last month", () => {
    const indices = resolveLabelIndices(58, 444);
    expect(indices.length).toBeLessThanOrEqual(13);
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(57);
  });

  it("keeps every pair of labels at least a label-width apart", () => {
    // Regression: at 295 points the forced final label landed 19 points after the previous tick,
    // rendering "2025" and "2026" on top of each other. The gap is now measured in pixels.
    const MIN_GAP = 36;
    for (const count of [7, 13, 24, 58, 100, 295]) {
      const plotWidth = 444;
      const indices = resolveLabelIndices(count, plotWidth);
      const pixelsPerPoint = plotWidth / (count - 1);
      const gaps = indices.slice(1).map((index, i) => (index - indices[i]) * pixelsPerPoint);
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(MIN_GAP);
    }
  });

  it("never repeats or overshoots the final index", () => {
    for (const count of [1, 2, 3, 7, 13, 24, 58, 295]) {
      const indices = resolveLabelIndices(count, 444);
      expect(new Set(indices).size).toBe(indices.length);
      expect(Math.max(...indices)).toBe(count - 1);
    }
  });
});

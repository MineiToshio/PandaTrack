import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardLineChart, { type DashboardChartSeries } from "../DashboardLineChart";

const spendSeries: DashboardChartSeries = {
  key: "spend",
  name: "Spend",
  color: "var(--accent)",
  values: [1000, 4000, 2500],
  formatted: ["$10.00", "$40.00", "$25.00"],
};

const LABELS = ["May", "Jun", "Jul"];

function renderChart(props: Partial<Parameters<typeof DashboardLineChart>[0]> = {}) {
  render(<DashboardLineChart series={[spendSeries]} labels={LABELS} ariaLabel="Spend by month, 3 months" {...props} />);
  return screen.getByRole("img", { name: "Spend by month, 3 months" });
}

describe("DashboardLineChart", () => {
  it("plots one marker per month bucket", () => {
    const chart = renderChart();
    expect(chart.querySelectorAll("circle")).toHaveLength(LABELS.length);
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
    const { container } = render(<DashboardLineChart series={[]} labels={[]} ariaLabel="Spend by month, 0 months" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("stays flat at the baseline when every bucket is zero", () => {
    const chart = renderChart({
      series: [{ ...spendSeries, values: [0, 0, 0], formatted: ["$0.00", "$0.00", "$0.00"] }],
    });
    const yValues = [...chart.querySelectorAll("circle")].map((node) => node.getAttribute("cy"));
    expect(new Set(yValues).size).toBe(1);
  });
});

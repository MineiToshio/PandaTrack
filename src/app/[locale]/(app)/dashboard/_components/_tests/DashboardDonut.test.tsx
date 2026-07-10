import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardDonut from "../DashboardDonut";

const SLICES = [
  { key: "a", color: "var(--accent)", percent: 50 },
  { key: "b", color: "var(--accent-cool)", percent: 30 },
  { key: "c", color: "var(--success)", percent: 20 },
];

function renderDonut(slices = SLICES) {
  render(
    <DashboardDonut slices={slices} centerValue="$16.50" centerLabel="Total" ariaLabel="Spend by category: a, b, c" />,
  );
  const svg = screen.getByRole("img", { name: "Spend by category: a, b, c" });
  // The first circle is the track; the rest are slices.
  return [...svg.querySelectorAll("circle")].slice(1);
}

describe("DashboardDonut", () => {
  it("draws one ring per slice, sized to its share", () => {
    const rings = renderDonut();
    expect(rings).toHaveLength(3);
    expect(rings.map((ring) => ring.getAttribute("stroke-dasharray"))).toEqual(["50 50", "30 70", "20 80"]);
  });

  it("offsets each slice by the running total before it, so they abut without overlapping", () => {
    const rings = renderDonut();
    expect(rings.map((ring) => ring.getAttribute("stroke-dashoffset"))).toEqual(["0", "-50", "-80"]);
  });

  it("renders the centre figure and label", () => {
    renderDonut();
    expect(screen.getByText("$16.50")).toBeVisible();
    expect(screen.getByText("Total")).toBeVisible();
  });

  it("handles a single full slice", () => {
    const rings = renderDonut([{ key: "only", color: "var(--success)", percent: 100 }]);
    expect(rings).toHaveLength(1);
    expect(rings[0].getAttribute("stroke-dasharray")).toBe("100 0");
    expect(rings[0].getAttribute("stroke-dashoffset")).toBe("0");
  });
});

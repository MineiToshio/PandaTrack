import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardBudgetMeter from "../DashboardBudgetMeter";

function renderMeter(status: "under" | "warning" | "over", percent: number) {
  render(<DashboardBudgetMeter status={status} percent={percent} ariaLabel={`${percent}% of budget used`} />);
  const track = screen.getByRole("img");
  const fill = track.firstElementChild as HTMLElement;
  return { track, fill };
}

describe("DashboardBudgetMeter", () => {
  it("paints the green band below 80% (FR-06-06)", () => {
    const { fill } = renderMeter("under", 65);
    expect(fill.style.backgroundColor).toBe("var(--success)");
    expect(fill.style.width).toBe("65%");
  });

  it("paints the amber band between 80% and 100%", () => {
    const { fill } = renderMeter("warning", 92);
    expect(fill.style.backgroundColor).toBe("var(--warning)");
    expect(fill.style.width).toBe("92%");
  });

  it("paints the red band above 100% with a hatch cue that does not rely on color", () => {
    const { fill } = renderMeter("over", 122);
    expect(fill.style.backgroundColor).toBe("var(--destructive)");
    expect(fill.style.backgroundImage).toContain("repeating-linear-gradient");
  });

  it("clamps the fill so an over-budget cycle never overflows the track", () => {
    const { fill } = renderMeter("over", 122);
    expect(fill.style.width).toBe("100%");
  });

  it("exposes the consumption as an accessible label", () => {
    const { track } = renderMeter("under", 65);
    expect(track).toHaveAccessibleName("65% of budget used");
  });
});

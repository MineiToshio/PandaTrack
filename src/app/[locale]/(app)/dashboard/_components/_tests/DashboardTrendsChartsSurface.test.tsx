import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { useTrendsRangeTransitionMock } = vi.hoisted(() => ({
  useTrendsRangeTransitionMock: vi.fn(),
}));

vi.mock("../DashboardTrendsRangeProvider", () => ({
  useTrendsRangeTransition: useTrendsRangeTransitionMock,
}));

import DashboardTrendsChartsSurface from "../DashboardTrendsChartsSurface";

const LOADING_LABEL = "Updating the charts with the new range.";

function renderSurface(isPending: boolean) {
  useTrendsRangeTransitionMock.mockReturnValue({ isPending, navigate: vi.fn() });
  return render(
    <DashboardTrendsChartsSurface loadingLabel={LOADING_LABEL}>
      <div data-testid="charts">real charts</div>
    </DashboardTrendsChartsSurface>,
  );
}

describe("DashboardTrendsChartsSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the charts when no range change is in flight", () => {
    renderSurface(false);
    expect(screen.getByTestId("charts")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("replaces the charts with placeholders while a range change resolves", () => {
    // The whole point: React holds the previous render across a transition, so without this swap
    // the stale charts sit on screen looking settled while a different range loads.
    const { container } = renderSurface(true);
    expect(screen.queryByTestId("charts")).not.toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("announces the pending state instead of leaving it visual-only", () => {
    const { container } = renderSurface(true);
    const region = container.querySelector('[aria-busy="true"]');
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-label", LOADING_LABEL);
  });

  it("lays the placeholders out on the same grid as the real charts, so the swap does not jump", () => {
    const { container } = renderSurface(true);
    const region = container.querySelector('[aria-busy="true"]');
    // One placeholder per shipped trend chart.
    expect(region?.children).toHaveLength(4);
    expect(region?.className).toContain("grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))]");
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardActivityTabs from "../DashboardActivityTabs";

vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));

const TABS = [
  { key: "recent", label: "Latest", panel: <p>Latest orders</p> },
  { key: "upcoming", label: "Upcoming arrivals", panel: <p>Upcoming arrivals list</p> },
  { key: "overdue", label: "Overdue", count: 2, panel: <p>Overdue list</p> },
];

function renderTabs() {
  render(<DashboardActivityTabs tabs={TABS} tablistLabel="Order view" />);
  return screen.getAllByRole("tab");
}

describe("DashboardActivityTabs", () => {
  it("selects the first tab and shows only its panel", () => {
    renderTabs();
    expect(screen.getByRole("tab", { name: /latest/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Latest orders");
  });

  it("wires each tab to its panel in both directions", () => {
    const tabs = renderTabs();
    const panel = screen.getByRole("tabpanel");
    expect(tabs[0]).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tabs[0].id);
  });

  it("switches panels on click", async () => {
    const user = userEvent.setup();
    renderTabs();
    await user.click(screen.getByRole("tab", { name: /overdue/i }));
    expect(screen.getByRole("tab", { name: /overdue/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Overdue list");
  });

  it("moves between tabs with the arrow keys and keeps a single tab stop", async () => {
    const user = userEvent.setup();
    const tabs = renderTabs();
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);

    tabs[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /upcoming arrivals/i })).toHaveAttribute("aria-selected", "true");

    // Arrow-left from the first tab wraps to the last.
    tabs[0].focus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: /overdue/i })).toHaveAttribute("aria-selected", "true");
  });

  it("jumps to the first and last tab with Home and End", async () => {
    const user = userEvent.setup();
    const tabs = renderTabs();
    tabs[0].focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: /overdue/i })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: /latest/i })).toHaveAttribute("aria-selected", "true");
  });

  it("shows a count badge only for tabs that carry one", () => {
    renderTabs();
    expect(screen.getByRole("tab", { name: /overdue/i })).toHaveTextContent("2");
    expect(screen.getByRole("tab", { name: /latest/i })).not.toHaveTextContent("2");
  });
});

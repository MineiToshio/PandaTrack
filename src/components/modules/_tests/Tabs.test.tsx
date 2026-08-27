import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs, type TabsItem } from "@/components/modules/Tabs";

const ITEMS: TabsItem[] = [
  { value: "summary", label: "Resumen", href: "/es/progress" },
  { value: "medals", label: "Medallas", href: "/es/progress/medals" },
  { value: "ranks", label: "Rangos", href: "/es/progress/ranks" },
];

function renderUnderline() {
  render(<Tabs items={ITEMS} value="ranks" ariaLabel="Secciones de progreso" variant="underline" panelId="panel" />);
  return screen.getByRole("tablist");
}

describe("Tabs", () => {
  it("renders an item carrying an href as a real link, and marks the selected one", () => {
    const bar = renderUnderline();
    const tabs = screen.getAllByRole("tab");

    expect(bar).toHaveAttribute("aria-label", "Secciones de progreso");
    expect(tabs).toHaveLength(ITEMS.length);
    expect(tabs.map((tab) => tab.tagName)).toEqual(["A", "A", "A"]);
    expect(screen.getByRole("tab", { name: "Rangos" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("tab", { name: "Resumen" })).not.toHaveAttribute("aria-current");
  });

  it("renders a panel-toggling item as a button when no href is given", () => {
    render(
      <Tabs
        items={ITEMS.map(({ value, label }) => ({ value, label }))}
        value="summary"
        ariaLabel="Secciones"
        variant="underline"
      />,
    );

    expect(screen.getAllByRole("tab").map((tab) => tab.tagName)).toEqual(["BUTTON", "BUTTON", "BUTTON"]);
  });

  it("names the swapped region only when the caller renders one", () => {
    renderUnderline();
    expect(screen.getByRole("tab", { name: "Rangos" })).toHaveAttribute("aria-controls", "panel");

    screen.getAllByRole("tab").forEach((tab) => expect(tab).not.toHaveAttribute("tabindex"));
  });

  it("keeps the underline bar from overflowing the axis it scrolls on", () => {
    const bar = renderUnderline();
    const items = screen.getAllByRole("tab");

    // `overflow-x-auto` makes the bar a scroll container in BOTH axes: CSS gives an element whose
    // other axis is `visible` an implied `auto`. So anything an item hangs past the bar's box turns
    // into a scrollbar. A `-mb-px` on the items (the usual way of pulling the active underline over
    // the bar's own `border-b`) hung exactly one pixel past it, and Chrome answered with a full
    // vertical scrollbar beside a 44px tab bar. The rule is an inset shadow instead, painted INSIDE
    // the box, which the active item's own `border-b-2` covers with nothing to overhang. jsdom does
    // no layout, so the pairing is pinned as a contract: keep the scroll container, keep the
    // negative margins out.
    expect(bar.className).toContain("overflow-x-auto");
    expect(bar.className).toContain("[box-shadow:inset_0_-1px_0_var(--border)]");
    expect(bar.className).not.toContain("border-b");
    items.forEach((item) => expect(item.className).not.toMatch(/(^|\s)-m[btly]?-/));
  });
});

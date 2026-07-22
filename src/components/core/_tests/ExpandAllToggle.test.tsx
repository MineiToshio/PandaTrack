import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ExpandAllToggle from "@/components/core/ExpandAllToggle";

// Minimal next-intl mock — returns a predictable string so label assertions are stable.
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

const EXPAND = "components.expandAllToggle.expandAll";
const COLLAPSE = "components.expandAllToggle.collapseAll";

describe("ExpandAllToggle", () => {
  it("shows 'expand all' with aria-pressed=false when none are expanded", () => {
    render(<ExpandAllToggle expandedCount={0} total={5} onExpandAll={vi.fn()} onCollapseAll={vi.fn()} />);
    expect(screen.getByRole("button", { name: EXPAND }).getAttribute("aria-pressed")).toBe("false");
  });

  it("shows 'expand all' with aria-pressed=mixed when some but not all are expanded", () => {
    render(<ExpandAllToggle expandedCount={2} total={5} onExpandAll={vi.fn()} onCollapseAll={vi.fn()} />);
    expect(screen.getByRole("button", { name: EXPAND }).getAttribute("aria-pressed")).toBe("mixed");
  });

  it("shows 'collapse all' with aria-pressed=true when every row is expanded", () => {
    render(<ExpandAllToggle expandedCount={5} total={5} onExpandAll={vi.fn()} onCollapseAll={vi.fn()} />);
    expect(screen.getByRole("button", { name: COLLAPSE }).getAttribute("aria-pressed")).toBe("true");
  });

  it("expands (not collapses) while partially expanded", () => {
    const onExpandAll = vi.fn();
    const onCollapseAll = vi.fn();
    render(<ExpandAllToggle expandedCount={2} total={5} onExpandAll={onExpandAll} onCollapseAll={onCollapseAll} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onExpandAll).toHaveBeenCalledOnce();
    expect(onCollapseAll).not.toHaveBeenCalled();
  });

  it("collapses when all are already expanded", () => {
    const onExpandAll = vi.fn();
    const onCollapseAll = vi.fn();
    render(<ExpandAllToggle expandedCount={3} total={3} onExpandAll={onExpandAll} onCollapseAll={onCollapseAll} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onCollapseAll).toHaveBeenCalledOnce();
    expect(onExpandAll).not.toHaveBeenCalled();
  });

  it("treats an empty set (total=0) as not all-expanded", () => {
    render(<ExpandAllToggle expandedCount={0} total={0} onExpandAll={vi.fn()} onCollapseAll={vi.fn()} />);
    expect(screen.getByRole("button", { name: EXPAND }).getAttribute("aria-pressed")).toBe("false");
  });
});

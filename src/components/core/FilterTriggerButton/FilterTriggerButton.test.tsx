import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FilterTriggerButton from "@/components/core/FilterTriggerButton/FilterTriggerButton";

describe("FilterTriggerButton — label variant", () => {
  it("renders label text", () => {
    render(<FilterTriggerButton appliedCount={0} onClick={vi.fn()} label="Filtrar" />);
    expect(screen.getByRole("button", { name: "Filtrar" })).toBeTruthy();
  });

  it("shows no badge when count is 0 (neutral state)", () => {
    const { container } = render(<FilterTriggerButton appliedCount={0} onClick={vi.fn()} label="Filtrar" />);
    // Badge span is only rendered when isActive
    const badge = container.querySelector("span.rounded-full");
    expect(badge).toBeNull();
  });

  it("shows badge with count and active inline style when count > 0", () => {
    render(<FilterTriggerButton appliedCount={3} onClick={vi.fn()} label="Filtrar" />);
    expect(screen.getByText("3")).toBeTruthy();
    const button = screen.getByRole("button", { name: /Filtrar/ });
    // Inline style background should be set for active state
    expect(button).toHaveStyle({ background: "color-mix(in oklch, var(--accent) 10%, transparent)" });
  });

  it("caps badge display at 9+ when count exceeds 9", () => {
    render(<FilterTriggerButton appliedCount={12} onClick={vi.fn()} label="Filtrar" />);
    expect(screen.getByText("9+")).toBeTruthy();
  });

  it("fires onClick when clicked", () => {
    const handleClick = vi.fn();
    render(<FilterTriggerButton appliedCount={0} onClick={handleClick} label="Filtrar" />);
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});

describe("FilterTriggerButton — icon-only variant", () => {
  it("renders with provided aria-label", () => {
    render(<FilterTriggerButton appliedCount={0} onClick={vi.fn()} variant="icon-only" aria-label="Filtrar pedidos" />);
    expect(screen.getByRole("button", { name: "Filtrar pedidos" })).toBeTruthy();
  });

  it("shows no badge when count is 0", () => {
    const { container } = render(
      <FilterTriggerButton appliedCount={0} onClick={vi.fn()} variant="icon-only" aria-label="Filtrar" />,
    );
    const badge = container.querySelector(".absolute");
    expect(badge).toBeNull();
  });

  it("shows compact badge when count > 0", () => {
    render(<FilterTriggerButton appliedCount={2} onClick={vi.fn()} variant="icon-only" aria-label="Filtrar" />);
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("fires onClick when clicked", () => {
    const handleClick = vi.fn();
    render(<FilterTriggerButton appliedCount={1} onClick={handleClick} variant="icon-only" aria-label="Filtrar" />);
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});

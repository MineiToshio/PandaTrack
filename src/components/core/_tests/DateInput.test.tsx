import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DateInput from "@/components/core/DateInput";

// Minimal next-intl mock — returns `namespace.key` so label assertions are stable
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

/** `placeholder` is a required prop; tests that don't assert on its text still need a value. */
const DEFAULT_PLACEHOLDER = "Choose a date";

describe("DateInput — trigger rendering", () => {
  it("shows placeholder when value is null", () => {
    render(<DateInput value={null} onChange={vi.fn()} placeholder="Choose a date" />);
    expect(screen.getByText("Choose a date")).toBeTruthy();
  });

  it("renders formatted date when value is set", () => {
    const { container } = render(
      <DateInput value="2025-06-15" onChange={vi.fn()} locale="en-US" placeholder={DEFAULT_PLACEHOLDER} />,
    );
    // Formatted with locale en-US: "Jun 15, 2025"
    const trigger = container.querySelector("button[aria-haspopup='dialog']") as HTMLButtonElement;
    expect(trigger.textContent).toContain("Jun");
    expect(trigger.textContent).toContain("2025");
  });

  it("has aria-haspopup=dialog on trigger", () => {
    render(<DateInput value={null} onChange={vi.fn()} placeholder={DEFAULT_PLACEHOLDER} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("aria-expanded is false when closed", () => {
    render(<DateInput value={null} onChange={vi.fn()} placeholder={DEFAULT_PLACEHOLDER} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  });
});

describe("DateInput — popover", () => {
  it("opens calendar on trigger click", () => {
    render(<DateInput value={null} onChange={vi.fn()} placeholder="Pick date" />);
    fireEvent.click(screen.getByRole("button", { name: /pick date/i }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("sets aria-expanded=true when open", () => {
    render(<DateInput value={null} onChange={vi.fn()} placeholder="Pick date" />);
    const trigger = screen.getByRole("button", { name: /pick date/i });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});

describe("DateInput — clear", () => {
  it("shows clear button when value is set and not disabled", () => {
    render(<DateInput value="2025-06-15" onChange={vi.fn()} placeholder={DEFAULT_PLACEHOLDER} />);
    expect(screen.getByRole("button", { name: "components.dateInput.clear" })).toBeTruthy();
  });

  it("calls onChange with null when clear button is clicked", () => {
    const onChange = vi.fn();
    render(<DateInput value="2025-06-15" onChange={onChange} placeholder={DEFAULT_PLACEHOLDER} />);
    fireEvent.click(screen.getByRole("button", { name: "components.dateInput.clear" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("does not show clear button when value is null", () => {
    render(<DateInput value={null} onChange={vi.fn()} placeholder={DEFAULT_PLACEHOLDER} />);
    expect(screen.queryByRole("button", { name: "components.dateInput.clear" })).toBeNull();
  });
});

describe("DateInput — error/helper", () => {
  it("renders error message", () => {
    render(<DateInput value={null} onChange={vi.fn()} placeholder={DEFAULT_PLACEHOLDER} error="Date is required." />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Date is required.")).toBeTruthy();
  });

  it("sets aria-invalid when error is set", () => {
    render(<DateInput value={null} onChange={vi.fn()} placeholder={DEFAULT_PLACEHOLDER} error="Bad date." />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-invalid", "true");
  });

  it("renders helper text when no error", () => {
    render(<DateInput value={null} onChange={vi.fn()} placeholder={DEFAULT_PLACEHOLDER} helperText="Arrival date." />);
    expect(screen.getByText("Arrival date.")).toBeTruthy();
  });
});

describe("DateInput — disabled state", () => {
  it("disables trigger button when disabled", () => {
    render(<DateInput value={null} onChange={vi.fn()} placeholder={DEFAULT_PLACEHOLDER} disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

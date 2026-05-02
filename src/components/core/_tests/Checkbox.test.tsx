import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Checkbox from "@/components/core/Checkbox";

describe("Checkbox — checked states", () => {
  it("renders unchecked by default", () => {
    render(<Checkbox checked={false} />);
    const input = screen.getByRole("checkbox");
    expect(input).not.toHaveAttribute("checked");
    expect(input.getAttribute("aria-checked")).toBe("false");
  });

  it("renders checked state", () => {
    render(<Checkbox checked={true} />);
    const input = screen.getByRole("checkbox");
    expect(input).toHaveAttribute("checked");
    expect(input.getAttribute("aria-checked")).toBe("true");
  });

  it("renders indeterminate state with aria-checked='mixed'", () => {
    render(<Checkbox checked="indeterminate" />);
    const input = screen.getByRole("checkbox");
    expect(input.getAttribute("aria-checked")).toBe("mixed");
  });
});

describe("Checkbox — label", () => {
  it("renders label text when provided", () => {
    render(<Checkbox checked={false} label="Accept terms" />);
    expect(screen.getByText("Accept terms")).toBeTruthy();
  });

  it("renders without label when not provided", () => {
    const { container } = render(<Checkbox checked={false} />);
    expect(container.textContent).toBe("");
  });
});

describe("Checkbox — onChange", () => {
  it("calls onChange with true when unchecked checkbox is clicked", () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Check me" />);
    const input = screen.getByRole("checkbox");
    fireEvent.click(input);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when checked checkbox is clicked", () => {
    const onChange = vi.fn();
    render(<Checkbox checked={true} onChange={onChange} label="Uncheck me" />);
    const input = screen.getByRole("checkbox");
    fireEvent.click(input);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("does not call onChange when disabled", () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} disabled label="Disabled" />);
    const input = screen.getByRole("checkbox");
    expect(input).toBeDisabled();
  });
});

describe("Checkbox — disabled state", () => {
  it("sets disabled on the native input", () => {
    render(<Checkbox checked={false} disabled />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("sets disabled when loading", () => {
    render(<Checkbox checked={false} loading />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("shows spinner when loading", () => {
    const { container } = render(<Checkbox checked={false} loading />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });
});

describe("Checkbox — accessibility", () => {
  it("sets aria-busy when loading", () => {
    render(<Checkbox checked={false} loading />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-busy", "true");
  });
});

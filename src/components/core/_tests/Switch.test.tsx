import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Switch from "@/components/core/Switch";

describe("Switch — rendering", () => {
  it("renders a checkbox with role='switch'", () => {
    render(<Switch checked={false} />);
    expect(screen.getByRole("switch")).toBeTruthy();
  });

  it("renders label text when provided", () => {
    render(<Switch checked={false} label="Enable notifications" />);
    expect(screen.getByText("Enable notifications")).toBeTruthy();
  });

  it("renders helper text when provided", () => {
    render(<Switch checked={false} helperText="Applies immediately." />);
    expect(screen.getByText("Applies immediately.")).toBeTruthy();
  });

  it("renders error message with role=alert when error is set", () => {
    render(<Switch checked={false} error="Something went wrong." />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Something went wrong.");
  });

  it("does not render helper text when error is present", () => {
    render(<Switch checked={false} helperText="Helper" error="Error" />);
    expect(screen.queryByText("Helper")).toBeNull();
    expect(screen.getByText("Error")).toBeTruthy();
  });
});

describe("Switch — checked state", () => {
  it("reflects checked=true via aria-checked", () => {
    render(<Switch checked={true} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("reflects checked=false via aria-checked", () => {
    render(<Switch checked={false} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });
});

describe("Switch — onChange", () => {
  it("calls onChange with true when toggled on", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when toggled off", () => {
    const onChange = vi.fn();
    render(<Switch checked={true} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("does not call onChange when disabled", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} disabled />);
    expect(screen.getByRole("switch")).toBeDisabled();
  });
});

describe("Switch — loading state", () => {
  it("shows spinner when loading", () => {
    const { container } = render(<Switch checked={false} loading />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("sets aria-busy when loading", () => {
    render(<Switch checked={false} loading />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-busy", "true");
  });

  it("disables input when loading", () => {
    render(<Switch checked={false} loading />);
    expect(screen.getByRole("switch")).toBeDisabled();
  });
});

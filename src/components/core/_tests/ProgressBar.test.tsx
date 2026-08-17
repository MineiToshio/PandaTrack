import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProgressBar from "@/components/core/ProgressBar";

describe("ProgressBar", () => {
  it("exposes the progressbar contract with the full sentence, not the bare percentage", () => {
    render(
      <ProgressBar value={83} label="Payment progress in PEN" valueText="13,647.30 paid of 16,272.30, 83 percent" />,
    );

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-valuenow", "83");
    expect(bar).toHaveAccessibleName("Payment progress in PEN");
    expect(bar).toHaveAttribute("aria-valuetext", "13,647.30 paid of 16,272.30, 83 percent");
  });

  it("clamps out-of-range values instead of overfilling or inverting the track", () => {
    const { rerender } = render(<ProgressBar value={180} label="l" valueText="v" />);
    expect(screen.getByRole("progressbar").firstElementChild).toHaveStyle({ transform: "scaleX(1)" });

    rerender(<ProgressBar value={-40} label="l" valueText="v" />);
    expect(screen.getByRole("progressbar").firstElementChild).toHaveStyle({ transform: "scaleX(0)" });
  });

  it("fills with transform, never with width, and keeps the fill square-edged", () => {
    render(<ProgressBar value={50} label="l" valueText="v" />);
    const fill = screen.getByRole("progressbar").firstElementChild as HTMLElement;

    expect(fill).toHaveStyle({ transform: "scaleX(0.5)", transformOrigin: "left" });
    expect(fill.style.width).toBe("");
    expect(fill.className).toContain("w-full");
    expect(fill.className).not.toContain("rounded-full");
  });

  it("paints the accent gradient by default and the warning gradient on the warning tone", () => {
    const { rerender } = render(<ProgressBar value={40} label="l" valueText="v" />);
    expect((screen.getByRole("progressbar").firstElementChild as HTMLElement).style.background).toContain(
      "var(--accent), var(--accent-warm)",
    );

    rerender(<ProgressBar value={40} tone="warning" label="l" valueText="v" />);
    expect((screen.getByRole("progressbar").firstElementChild as HTMLElement).style.background).toContain(
      "var(--warning), var(--accent-warm)",
    );
  });

  it("drops its own easing when the caller drives the value frame by frame", () => {
    const { rerender } = render(<ProgressBar value={40} label="l" valueText="v" />);
    expect((screen.getByRole("progressbar").firstElementChild as HTMLElement).className).toContain(
      "transition-transform",
    );

    rerender(<ProgressBar value={40} transition={false} label="l" valueText="v" />);
    expect((screen.getByRole("progressbar").firstElementChild as HTMLElement).className).not.toContain(
      "transition-transform",
    );
  });

  it("announces the settled percentage while an animated value is still travelling", () => {
    render(<ProgressBar value={12.5} valueNow={83} transition={false} label="l" valueText="v" />);

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "83");
    expect(bar.firstElementChild).toHaveStyle({ transform: "scaleX(0.125)" });
  });

  it("renders the dense 3px track for xs and the 4px one for sm", () => {
    const { rerender } = render(<ProgressBar value={10} size="xs" label="l" valueText="v" />);
    expect(screen.getByRole("progressbar").className).toContain("h-[3px]");

    rerender(<ProgressBar value={10} label="l" valueText="v" />);
    expect(screen.getByRole("progressbar").className).toContain("h-1");
  });
});

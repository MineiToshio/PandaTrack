import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Skeleton from "../Skeleton";

describe("Skeleton", () => {
  it("renders a decorative atom carrying the canonical `.skeleton` shimmer class", () => {
    const { container } = render(<Skeleton variant="rect" width={100} height={20} />);
    const atom = container.querySelector(".skeleton");
    expect(atom).toBeTruthy();
    // Atoms are decorative; the container owns aria-busy + label.
    expect(atom?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders one shimmer element per line for multi-line text", () => {
    const { container } = render(<Skeleton variant="text" lines={3} />);
    expect(container.querySelectorAll(".skeleton").length).toBe(3);
  });

  it("applies a circular radius for the circle variant", () => {
    const { container } = render(<Skeleton variant="circle" width={40} height={40} />);
    expect(container.querySelector(".skeleton.rounded-full")).toBeTruthy();
  });

  it("forwards numeric sizes as pixel values", () => {
    const { container } = render(<Skeleton variant="rect" width={120} height={8} />);
    const atom = container.querySelector(".skeleton") as HTMLElement;
    expect(atom.style.width).toBe("120px");
    expect(atom.style.height).toBe("8px");
  });
});

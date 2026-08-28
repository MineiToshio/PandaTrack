import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RankLadderScrollToCurrent from "../RankLadderScrollToCurrent";

/**
 * Stubs `getBoundingClientRect` for the real `RankLadder` marker, so the mount effect reads the
 * given position instead of jsdom's default all-zero rect (which always reads as "fully visible").
 * Every other element keeps that default, matching jsdom's real behavior.
 */
function stubCurrentRungRect(rect: Pick<DOMRect, "top" | "bottom">) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const isCurrentRung = this.getAttribute("data-rank-current") === "true";
    const base = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) };
    return isCurrentRung ? { ...base, ...rect } : base;
  });
}

function stubReducedMotion(prefersReduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: prefersReduced }) as unknown as typeof window.matchMedia,
  );
}

describe("RankLadderScrollToCurrent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("scrolls the current rung into view, centered, when it is not fully visible", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    stubReducedMotion(false);
    stubCurrentRungRect({ top: 950, bottom: 1150 });

    render(
      <>
        <li data-rank-current="true">Current rung</li>
        <RankLadderScrollToCurrent />
      </>,
    );

    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  });

  it("does nothing when the current rung is already fully inside the viewport", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    stubReducedMotion(false);
    stubCurrentRungRect({ top: 100, bottom: 300 });

    render(
      <>
        <li data-rank-current="true">Current rung</li>
        <RankLadderScrollToCurrent />
      </>,
    );

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("snaps instead of animating for a collector who prefers reduced motion", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    stubReducedMotion(true);
    stubCurrentRungRect({ top: 950, bottom: 1150 });

    render(
      <>
        <li data-rank-current="true">Current rung</li>
        <RankLadderScrollToCurrent />
      </>,
    );

    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: "auto", block: "center", inline: "nearest" });
  });

  it("does not throw when no rung is marked as current", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    stubReducedMotion(false);

    expect(() => render(<RankLadderScrollToCurrent />)).not.toThrow();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

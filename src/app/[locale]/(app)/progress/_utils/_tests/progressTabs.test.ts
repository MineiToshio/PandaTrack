import { describe, expect, it } from "vitest";
import { DEFAULT_PROGRESS_TAB, buildProgressTabHref, resolveProgressTab } from "../progressTabs";

describe("resolveProgressTab", () => {
  it("opens the section on the default tab when no tab segment is present", () => {
    expect(resolveProgressTab("/es/progress")).toBe("summary");
    expect(resolveProgressTab("/en/progress/")).toBe("summary");
    expect(DEFAULT_PROGRESS_TAB).toBe("summary");
  });

  it("resolves the two non-default tabs from their own segment", () => {
    expect(resolveProgressTab("/es/progress/medals")).toBe("medals");
    expect(resolveProgressTab("/en/progress/ranks")).toBe("ranks");
  });

  it("keeps the parent tab marked on the medal detail subview", () => {
    expect(resolveProgressTab("/es/progress/medals/first-order")).toBe("medals");
  });

  it("falls back to the default for an unknown segment instead of throwing", () => {
    expect(resolveProgressTab("/es/progress/unknown")).toBe("summary");
    expect(resolveProgressTab("/es/dashboard")).toBe("summary");
    expect(resolveProgressTab("")).toBe("summary");
  });
});

describe("buildProgressTabHref", () => {
  it("writes no segment of its own for the default tab", () => {
    expect(buildProgressTabHref("es", "summary")).toBe("/es/progress");
    expect(buildProgressTabHref("en", "summary")).toBe("/en/progress");
  });

  it("writes the tab segment for a non-default tab", () => {
    expect(buildProgressTabHref("es", "medals")).toBe("/es/progress/medals");
    expect(buildProgressTabHref("en", "ranks")).toBe("/en/progress/ranks");
  });

  it("round-trips: every href it builds resolves back to the tab it was built for", () => {
    for (const tab of ["summary", "medals", "ranks"] as const) {
      expect(resolveProgressTab(buildProgressTabHref("es", tab))).toBe(tab);
    }
  });
});

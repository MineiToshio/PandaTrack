import { describe, expect, it } from "vitest";
import { normalizeStoreName } from "../duplicateMatch";

describe("normalizeStoreName", () => {
  it("trims and lowercases", () => {
    expect(normalizeStoreName("  MANGA STORE  ")).toBe("manga store");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeStoreName("Comics   &   Stuff")).toBe("comics & stuff");
  });

  it("strips diacritics for matching", () => {
    expect(normalizeStoreName("Café España")).toBe("cafe espana");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeStoreName("")).toBe("");
    expect(normalizeStoreName("   ")).toBe("");
  });
});

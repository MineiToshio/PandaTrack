import { describe, expect, it } from "vitest";
import { getDuplicateMatchScore, normalizeStoreName } from "../duplicateMatch";

describe("normalizeStoreName", () => {
  it("trims and lowercases", () => {
    expect(normalizeStoreName("  MANGA STORE  ")).toBe("manga store");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeStoreName("Comics   &   Stuff")).toBe("comics stuff");
  });

  it("strips diacritics for matching", () => {
    expect(normalizeStoreName("Café España")).toBe("cafe espana");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeStoreName("")).toBe("");
    expect(normalizeStoreName("   ")).toBe("");
  });
});

describe("getDuplicateMatchScore", () => {
  it("matches accent-insensitive and case-insensitive names", () => {
    const score = getDuplicateMatchScore("Kotá Store", "kota store");
    expect(score).toBeGreaterThan(0);
  });

  it("matches when key tokens are present in different order", () => {
    const score = getDuplicateMatchScore("Kota Store", "Store Kota");
    expect(score).toBeGreaterThan(0);
  });

  it("matches partial names when meaningful token is shared", () => {
    const score = getDuplicateMatchScore("Kota Store", "Kota");
    expect(score).toBeGreaterThan(0);
  });

  it("does not match queries with only generic terms", () => {
    const score = getDuplicateMatchScore("Store", "Any Other Store");
    expect(score).toBe(0);
  });
});

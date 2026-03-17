import { describe, expect, it } from "vitest";
import {
  getDuplicateMatchScore,
  getSimilarityPercent,
  normalizeStoreName,
  SIMILARITY_THRESHOLD_PERCENT,
} from "../duplicateMatch";

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

  it("does not match when candidate is a single character that only appears inside the query", () => {
    const score = getDuplicateMatchScore("lang-en", "l");
    expect(score).toBe(0);
  });
});

describe("getSimilarityPercent", () => {
  it("returns 100 for exact match", () => {
    expect(getSimilarityPercent("Manga Store", "Manga Store")).toBe(100);
  });

  it("returns 0 when no match", () => {
    expect(getSimilarityPercent("Store", "Any Other Store")).toBe(0);
  });

  it("returns a value between 0 and 100 for partial match", () => {
    const percent = getSimilarityPercent("Kota Store", "Store Kota");
    expect(percent).toBeGreaterThan(0);
    expect(percent).toBeLessThanOrEqual(100);
  });
});

describe("SIMILARITY_THRESHOLD_PERCENT", () => {
  it("is 70 so submit modal only shows for same-country stores with at least 70% name similarity", () => {
    expect(SIMILARITY_THRESHOLD_PERCENT).toBe(70);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildAuthoredStoreProductTypeNameMap,
  pickAuthoredStoreProductTypeName,
  resolveStoreProductTypeName,
} from "@/lib/catalog/resolveStoreProductTypeName";

describe("pickAuthoredStoreProductTypeName", () => {
  it("returns the locale-matched authored name, or null when absent", () => {
    const authored = { nameEs: "Juguetes de vinilo", nameEn: "Vinyl toys" };
    expect(pickAuthoredStoreProductTypeName(authored, "es")).toBe("Juguetes de vinilo");
    expect(pickAuthoredStoreProductTypeName(authored, "en")).toBe("Vinyl toys");
    expect(pickAuthoredStoreProductTypeName(null, "es")).toBeNull();
    expect(pickAuthoredStoreProductTypeName({ nameEs: null, nameEn: "Vinyl toys" }, "es")).toBeNull();
    expect(pickAuthoredStoreProductTypeName({ nameEs: "  ", nameEn: null }, "es")).toBeNull();
  });
});

describe("resolveStoreProductTypeName", () => {
  it("prefers the authored DB name for the active locale", () => {
    const authored = { nameEs: "Juguetes de vinilo", nameEn: "Vinyl toys" };
    expect(resolveStoreProductTypeName(authored, "i18n fallback", "es")).toBe("Juguetes de vinilo");
    expect(resolveStoreProductTypeName(authored, "i18n fallback", "en")).toBe("Vinyl toys");
  });

  it("falls back to the i18n name for seeded keys (no authored entry)", () => {
    expect(resolveStoreProductTypeName(undefined, "Manga", "es")).toBe("Manga");
    expect(resolveStoreProductTypeName(null, "Sticker albums", "en")).toBe("Sticker albums");
  });
});

describe("buildAuthoredStoreProductTypeNameMap", () => {
  it("keys rows that carry a name and drops nameless rows", () => {
    const map = buildAuthoredStoreProductTypeNameMap([
      { key: "vinyl_toys", nameEs: "Juguetes de vinilo", nameEn: "Vinyl toys" },
      { key: "nameless", nameEs: null, nameEn: null },
    ]);
    expect(map).toEqual({ vinyl_toys: { nameEs: "Juguetes de vinilo", nameEn: "Vinyl toys" } });
    expect(map.nameless).toBeUndefined();
  });
});

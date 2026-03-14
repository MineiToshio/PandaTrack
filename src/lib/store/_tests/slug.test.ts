import { describe, expect, it } from "vitest";
import { generateStoreSlug, slugifyName, generateShortId } from "../slug";

describe("slugifyName", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugifyName("Manga Store")).toBe("manga-store");
  });

  it("trims and collapses multiple spaces/hyphens", () => {
    expect(slugifyName("  Comics   &  Stuff  ")).toBe("comics-stuff");
  });

  it("strips diacritics", () => {
    expect(slugifyName("Café España")).toBe("cafe-espana");
  });

  it("returns fallback when empty after trim", () => {
    expect(slugifyName("")).toBe("store");
    expect(slugifyName("   ")).toBe("store");
    expect(slugifyName("---")).toBe("store");
  });

  it("removes non-alphanumeric except hyphen", () => {
    expect(slugifyName("Store #1 (Official)")).toBe("store-1-official");
  });
});

describe("generateShortId", () => {
  it("returns 6 hex characters", () => {
    const id = generateShortId();
    expect(id).toMatch(/^[a-f0-9]{6}$/);
    expect(id.length).toBe(6);
  });

  it("returns different values on multiple calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateShortId()));
    expect(ids.size).toBe(50);
  });
});

describe("generateStoreSlug", () => {
  it("returns slug base plus 6-char suffix", () => {
    const slug = generateStoreSlug("My Store");
    expect(slug).toMatch(/^my-store-[a-f0-9]{6}$/);
  });

  it("produces different slugs for same name", () => {
    const a = generateStoreSlug("Store");
    const b = generateStoreSlug("Store");
    expect(a).not.toBe(b);
    expect(a.startsWith("store-")).toBe(true);
    expect(b.startsWith("store-")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { normalizeAssetsPublicBaseUrl } from "../assetsPublicBaseUrl";

describe("normalizeAssetsPublicBaseUrl", () => {
  it("gives a bare host an https scheme so stored asset URLs are absolute", () => {
    expect(normalizeAssetsPublicBaseUrl("assets.pandatrack.app")).toBe("https://assets.pandatrack.app");
  });

  it("keeps an absolute base and drops trailing slashes", () => {
    expect(normalizeAssetsPublicBaseUrl(" https://assets.pandatrack.app/ ")).toBe("https://assets.pandatrack.app");
    expect(normalizeAssetsPublicBaseUrl("https://pub-0123.r2.dev")).toBe("https://pub-0123.r2.dev");
    expect(normalizeAssetsPublicBaseUrl("https://cdn.example.com/assets//")).toBe("https://cdn.example.com/assets");
  });

  it("returns undefined for a missing, blank, malformed or non-http base", () => {
    expect(normalizeAssetsPublicBaseUrl(undefined)).toBeUndefined();
    expect(normalizeAssetsPublicBaseUrl("   ")).toBeUndefined();
    expect(normalizeAssetsPublicBaseUrl("not a url")).toBeUndefined();
    expect(normalizeAssetsPublicBaseUrl("ftp://assets.pandatrack.app")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { appendVersionTokenToAssetUrl, getStoreLogoVersionToken } from "../logoVersion";

describe("getStoreLogoVersionToken", () => {
  it("returns a stable 12-character token for the same content", () => {
    const body = Buffer.from("same-logo-content");

    expect(getStoreLogoVersionToken(body)).toMatch(/^[a-f0-9]{12}$/);
    expect(getStoreLogoVersionToken(body)).toBe(getStoreLogoVersionToken(body));
  });

  it("returns a different token when the content changes", () => {
    const original = Buffer.from("logo-a");
    const updated = Buffer.from("logo-b");

    expect(getStoreLogoVersionToken(original)).not.toBe(getStoreLogoVersionToken(updated));
  });
});

describe("appendVersionTokenToAssetUrl", () => {
  it("appends the version token as a query parameter", () => {
    expect(appendVersionTokenToAssetUrl("https://assets.example.com/store-logos/store-1.webp", "abc123def456")).toBe(
      "https://assets.example.com/store-logos/store-1.webp?v=abc123def456",
    );
  });

  it("preserves existing query parameters", () => {
    expect(
      appendVersionTokenToAssetUrl("https://assets.example.com/store-logos/store-1.webp?fit=cover", "abc123def456"),
    ).toBe("https://assets.example.com/store-logos/store-1.webp?fit=cover&v=abc123def456");
  });
});

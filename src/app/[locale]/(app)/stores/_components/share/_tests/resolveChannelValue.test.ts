import { describe, expect, it } from "vitest";
import { resolveChannelValue } from "../StoreContactChannelEditor";

describe("resolveChannelValue · PHONE", () => {
  it("normalizes a plain local number to E.164 using the store's own country", () => {
    const result = resolveChannelValue("PHONE", "987654321", "PE");
    expect(result).toEqual({ ok: true, value: "+51987654321" });
  });

  it("honours an explicit country prefix over the store's country", () => {
    // A Mexican number typed in full, even though the store itself is Peruvian.
    const result = resolveChannelValue("PHONE", "+525512345678", "PE");
    expect(result).toEqual({ ok: true, value: "+525512345678" });
  });

  it("rejects a local number with no way to infer the country", () => {
    const result = resolveChannelValue("PHONE", "987654321", null);
    expect(result).toEqual({ ok: false, error: "PHONE" });
  });

  it("rejects a number that is too short to be real, even with a country hint", () => {
    const result = resolveChannelValue("PHONE", "123", "PE");
    expect(result).toEqual({ ok: false, error: "PHONE" });
  });
});

describe("resolveChannelValue · WHATSAPP", () => {
  it("builds the canonical wa.me link from a plain local number", () => {
    const result = resolveChannelValue("WHATSAPP", "987654321", "PE");
    expect(result).toEqual({ ok: true, value: "https://wa.me/51987654321" });
  });

  it("keeps an existing wa.me link untouched instead of re-parsing it as a number", () => {
    const result = resolveChannelValue("WHATSAPP", "https://wa.me/51987654321", "PE");
    expect(result).toEqual({ ok: true, value: "https://wa.me/51987654321" });
  });

  it("rejects a value that is neither a wa.me link nor a valid phone number", () => {
    const result = resolveChannelValue("WHATSAPP", "not a number", "PE");
    expect(result).toEqual({ ok: false, error: "WHATSAPP" });
  });
});

describe("resolveChannelValue · other channel types are unchanged", () => {
  it("still requires an instagram.com URL for INSTAGRAM", () => {
    expect(resolveChannelValue("INSTAGRAM", "https://instagram.com/store", "PE")).toEqual({
      ok: true,
      value: "https://instagram.com/store",
    });
    expect(resolveChannelValue("INSTAGRAM", "@store", "PE")).toEqual({ ok: false, error: "INSTAGRAM" });
  });

  it("rejects an empty value for every type", () => {
    expect(resolveChannelValue("PHONE", "   ", "PE")).toEqual({ ok: false, error: "required" });
  });
});

import { describe, expect, it } from "vitest";
import { isSupportedTimeZone, userTimezoneSchema } from "../userTimezoneSchema";

describe("userTimezoneSchema", () => {
  it("accepts IANA zones the runtime's zone database resolves", () => {
    const zones = ["America/Lima", "Europe/Madrid", "Asia/Tokyo", "America/Argentina/Buenos_Aires", "UTC"];

    for (const zone of zones) {
      const result = userTimezoneSchema.safeParse(zone);
      expect(result.success, zone).toBe(true);
    }
  });

  it("trims surrounding whitespace before validating", () => {
    const result = userTimezoneSchema.safeParse("  America/Lima  ");

    expect(result.success).toBe(true);
    expect(result.success && result.data).toBe("America/Lima");
  });

  it("rejects a well-shaped value the zone database does not know", () => {
    const result = userTimezoneSchema.safeParse("Middle/Earth");

    expect(result.success).toBe(false);
  });

  it("rejects an empty value", () => {
    expect(userTimezoneSchema.safeParse("").success).toBe(false);
    expect(userTimezoneSchema.safeParse("   ").success).toBe(false);
  });

  it("rejects a value longer than any real zone identifier", () => {
    const result = userTimezoneSchema.safeParse(`America/${"a".repeat(80)}`);

    expect(result.success).toBe(false);
  });

  it("rejects crafted payloads that are not zone identifiers", () => {
    const crafted = [
      'America/Lima\'; DROP TABLE "user";--',
      "<script>alert(1)</script>",
      "America/Lima OR 1=1",
      "../../etc/passwd",
    ];

    for (const value of crafted) {
      expect(userTimezoneSchema.safeParse(value).success, value).toBe(false);
    }
  });

  it("rejects non-string input", () => {
    expect(userTimezoneSchema.safeParse(null).success).toBe(false);
    expect(userTimezoneSchema.safeParse(42).success).toBe(false);
    expect(userTimezoneSchema.safeParse({ timezone: "America/Lima" }).success).toBe(false);
  });
});

describe("isSupportedTimeZone", () => {
  it("is true for a known zone and false for an unknown one", () => {
    expect(isSupportedTimeZone("Europe/Madrid")).toBe(true);
    expect(isSupportedTimeZone("Not/AZone")).toBe(false);
  });
});

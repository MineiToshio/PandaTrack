import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  assertKnownProductTypeKeys,
  isValidIanaTimezone,
  parseCollectorPreferencesPatch,
  validateCollectorPreferencesState,
} from "@/lib/user-settings/collectorPreferencesValidation";

describe("parseCollectorPreferencesPatch", () => {
  it("accepts null clears and valid catalog codes", () => {
    const parsed = parseCollectorPreferencesPatch({
      preferredCountryCode: "ES",
      baseCurrencyCode: "EUR",
      budgetAmount: 500,
      budgetResetDayOfMonth: 31,
      timezone: "Europe/Madrid",
      preferredProductTypeKeys: ["manga", "figures"],
    });
    expect(parsed.ok).toBe(true);
  });

  it("rejects unknown country codes", () => {
    const parsed = parseCollectorPreferencesPatch({
      preferredCountryCode: "ZZ",
    });
    expect(parsed.ok).toBe(false);
  });

  it("rejects currency codes outside the curated list", () => {
    const parsed = parseCollectorPreferencesPatch({
      baseCurrencyCode: "XYZ",
    });
    expect(parsed.ok).toBe(false);
  });

  it("rejects fractional budget amounts", () => {
    const parsed = parseCollectorPreferencesPatch({
      budgetAmount: 10.5,
    });
    expect(parsed.ok).toBe(false);
  });

  it("rejects budget amounts carrying fractional subunits", () => {
    expect(parseCollectorPreferencesPatch({ budgetAmount: 20_050 }).ok).toBe(false);
    expect(parseCollectorPreferencesPatch({ budgetAmount: 20_001 }).ok).toBe(false);
  });

  it("rejects budget amounts below one whole currency unit", () => {
    expect(parseCollectorPreferencesPatch({ budgetAmount: 1 }).ok).toBe(false);
    expect(parseCollectorPreferencesPatch({ budgetAmount: 99 }).ok).toBe(false);
  });

  it("accepts the minimum and maximum budget amounts in minor units", () => {
    expect(parseCollectorPreferencesPatch({ budgetAmount: 100 }).ok).toBe(true);
    expect(parseCollectorPreferencesPatch({ budgetAmount: 999_999_900 }).ok).toBe(true);
  });

  it("rejects a budget amount that would overflow the int4 column", () => {
    expect(parseCollectorPreferencesPatch({ budgetAmount: 1_000_000_000 }).ok).toBe(false);
  });

  it("rejects malformed preferred product type keys by shape", () => {
    // Membership is now a DB-existence check; the schema only guards the snake_case shape, so a
    // hyphen or uppercase still fails here.
    expect(parseCollectorPreferencesPatch({ preferredProductTypeKeys: ["manga", "unknown-type"] }).ok).toBe(false);
    expect(parseCollectorPreferencesPatch({ preferredProductTypeKeys: ["Figures"] }).ok).toBe(false);
  });

  it("accepts well-formed non-seed keys at the schema layer (membership deferred to the DB check)", () => {
    const parsed = parseCollectorPreferencesPatch({
      preferredProductTypeKeys: ["manga", "vinyl_toys"],
    });
    expect(parsed.ok).toBe(true);
  });

  it("deduplicates repeated preferred product type keys", () => {
    const parsed = parseCollectorPreferencesPatch({
      preferredProductTypeKeys: ["manga", "figures", "manga"],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.preferredProductTypeKeys).toEqual(["manga", "figures"]);
    }
  });
});

describe("assertKnownProductTypeKeys", () => {
  it("accepts submitted keys that all exist in the catalog, including admin-authored ones", () => {
    expect(() => assertKnownProductTypeKeys(["manga", "vinyl_toys"], ["manga", "vinyl_toys", "figures"])).not.toThrow();
  });

  it("accepts an empty submission", () => {
    expect(() => assertKnownProductTypeKeys([], ["manga"])).not.toThrow();
  });

  it("throws a ZodError on preferredProductTypeKeys when a submitted key is not in the catalog", () => {
    try {
      assertKnownProductTypeKeys(["manga", "ghost_type"], ["manga", "figures"]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      expect((error as ZodError).issues[0]?.path).toEqual(["preferredProductTypeKeys"]);
      expect((error as ZodError).issues[0]?.message).toBe("INVALID_PRODUCT_TYPE");
    }
  });
});

describe("isValidIanaTimezone", () => {
  it("accepts Europe/Madrid", () => {
    expect(isValidIanaTimezone("Europe/Madrid")).toBe(true);
  });

  it("rejects invalid zones", () => {
    expect(isValidIanaTimezone("Not/AZone")).toBe(false);
  });
});

describe("validateCollectorPreferencesState", () => {
  it("rejects a persisted budget without a base currency", () => {
    const parsed = validateCollectorPreferencesState({
      preferredCountryCode: null,
      baseCurrencyCode: null,
      budgetAmount: 100,
      budgetResetDayOfMonth: null,
      timezone: null,
      preferredProductTypeKeys: [],
    });
    expect(parsed.ok).toBe(false);
  });
});

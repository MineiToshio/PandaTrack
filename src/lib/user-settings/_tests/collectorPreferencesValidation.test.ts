import { describe, expect, it } from "vitest";
import {
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

  it("rejects unknown preferred product type keys", () => {
    const parsed = parseCollectorPreferencesPatch({
      preferredProductTypeKeys: ["manga", "unknown-type"],
    });
    expect(parsed.ok).toBe(false);
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

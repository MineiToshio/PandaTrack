import { describe, expect, it } from "vitest";
import { COUNTRY_CODES, COUNTRY_FLAG_EMOJI_BY_CODE, getCollectorCountryFlagEmoji } from "../collectorCountries";

describe("collectorCountries", () => {
  describe("getCollectorCountryFlagEmoji", () => {
    it("maps every seeded collector country to a non-empty flag sequence", () => {
      for (const code of COUNTRY_CODES) {
        expect(COUNTRY_FLAG_EMOJI_BY_CODE[code].length).toBeGreaterThanOrEqual(2);
        expect(getCollectorCountryFlagEmoji(code).length).toBeGreaterThanOrEqual(2);
      }
    });

    it("is case-insensitive for ISO alpha-2 input", () => {
      expect(getCollectorCountryFlagEmoji("ar")).toBe(getCollectorCountryFlagEmoji("AR"));
    });

    it("returns an empty string for unknown codes", () => {
      expect(getCollectorCountryFlagEmoji("ZZ")).toBe("");
    });
  });
});

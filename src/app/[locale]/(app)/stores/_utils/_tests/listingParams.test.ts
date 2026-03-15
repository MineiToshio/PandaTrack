import { describe, expect, it } from "vitest";
import { parseListingSearchParams } from "../listingParams";

describe("parseListingSearchParams", () => {
  it("returns empty filters when searchParams is empty", () => {
    expect(parseListingSearchParams({})).toEqual({
      nameQuery: undefined,
      categoryKeys: [],
      countryCodes: [],
      importCountryCodes: [],
      presenceTypes: [],
      receivesOrders: false,
      hasStock: false,
    });
  });

  it("parses single name query", () => {
    expect(parseListingSearchParams({ q: "manga" })).toEqual({
      nameQuery: "manga",
      categoryKeys: [],
      countryCodes: [],
      importCountryCodes: [],
      presenceTypes: [],
      receivesOrders: false,
      hasStock: false,
    });
  });

  it("trims name query", () => {
    expect(parseListingSearchParams({ q: "  manga  " })).toEqual({
      nameQuery: "manga",
      categoryKeys: [],
      countryCodes: [],
      importCountryCodes: [],
      presenceTypes: [],
      receivesOrders: false,
      hasStock: false,
    });
  });

  it("treats empty string name as undefined", () => {
    expect(parseListingSearchParams({ q: "   " })).toEqual({
      nameQuery: undefined,
      categoryKeys: [],
      countryCodes: [],
      importCountryCodes: [],
      presenceTypes: [],
      receivesOrders: false,
      hasStock: false,
    });
  });

  it("parses multiple category keys", () => {
    expect(parseListingSearchParams({ category: ["manga", "comics"] })).toEqual({
      nameQuery: undefined,
      categoryKeys: ["manga", "comics"],
      countryCodes: [],
      importCountryCodes: [],
      presenceTypes: [],
      receivesOrders: false,
      hasStock: false,
    });
  });

  it("parses single category as array of one", () => {
    expect(parseListingSearchParams({ category: "manga" })).toEqual({
      nameQuery: undefined,
      categoryKeys: ["manga"],
      countryCodes: [],
      importCountryCodes: [],
      presenceTypes: [],
      receivesOrders: false,
      hasStock: false,
    });
  });

  it("parses country and presence filters", () => {
    expect(
      parseListingSearchParams({
        country: "ES",
        presence: ["ONLINE", "PHYSICAL"],
      }),
    ).toEqual({
      nameQuery: undefined,
      categoryKeys: [],
      countryCodes: ["ES"],
      importCountryCodes: [],
      presenceTypes: ["ONLINE", "PHYSICAL"],
      receivesOrders: false,
      hasStock: false,
    });
  });

  it("ignores invalid presence values", () => {
    expect(
      parseListingSearchParams({
        presence: ["ONLINE", "INVALID", "PHYSICAL"],
      }),
    ).toEqual({
      nameQuery: undefined,
      categoryKeys: [],
      countryCodes: [],
      importCountryCodes: [],
      presenceTypes: ["ONLINE", "PHYSICAL"],
      receivesOrders: false,
      hasStock: false,
    });
  });

  it("parses import country and receives orders filters", () => {
    expect(
      parseListingSearchParams({
        importCountry: ["JP", "US"],
        receivesOrders: "true",
        hasStock: "true",
      }),
    ).toEqual({
      nameQuery: undefined,
      categoryKeys: [],
      countryCodes: [],
      importCountryCodes: ["JP", "US"],
      presenceTypes: [],
      receivesOrders: true,
      hasStock: true,
    });
  });
});

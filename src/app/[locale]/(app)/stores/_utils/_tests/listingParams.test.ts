import { describe, expect, it } from "vitest";
import { parseListingSearchParams } from "../listingParams";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

const EMPTY_FILTERS = {
  nameQuery: undefined,
  productTypeKeys: [],
  countryCodes: [],
  importCountryCodes: [],
  presenceTypes: [],
  sellerTypes: [],
  receivesOrders: false,
  hasStock: false,
  includeClosed: false,
  onlyOwnPrivate: false,
  sort: "topRated" as const,
  page: 1,
  perPage: DEFAULT_PAGE_SIZE,
};

describe("parseListingSearchParams", () => {
  it("returns empty filters when searchParams is empty", () => {
    expect(parseListingSearchParams({})).toEqual(EMPTY_FILTERS);
  });

  it("parses single name query", () => {
    expect(parseListingSearchParams({ q: "manga" })).toEqual({
      ...EMPTY_FILTERS,
      nameQuery: "manga",
    });
  });

  it("trims name query", () => {
    expect(parseListingSearchParams({ q: "  manga  " })).toEqual({
      ...EMPTY_FILTERS,
      nameQuery: "manga",
    });
  });

  it("treats empty string name as undefined", () => {
    expect(parseListingSearchParams({ q: "   " })).toEqual(EMPTY_FILTERS);
  });

  it("parses multiple product type keys", () => {
    expect(parseListingSearchParams({ productType: ["manga", "comics"] })).toEqual({
      ...EMPTY_FILTERS,
      productTypeKeys: ["manga", "comics"],
    });
  });

  it("parses single product type as array of one", () => {
    expect(parseListingSearchParams({ productType: "manga" })).toEqual({
      ...EMPTY_FILTERS,
      productTypeKeys: ["manga"],
    });
  });

  it("parses country and presence filters", () => {
    expect(
      parseListingSearchParams({
        country: "ES",
        presence: ["ONLINE", "PHYSICAL"],
      }),
    ).toEqual({
      ...EMPTY_FILTERS,
      countryCodes: ["ES"],
      presenceTypes: ["ONLINE", "PHYSICAL"],
    });
  });

  it("parses seller-type filters, keeping every kind the caller asked for", () => {
    expect(
      parseListingSearchParams({
        sellerType: ["RETAILER", "PROXY"],
      }),
    ).toEqual({
      ...EMPTY_FILTERS,
      sellerTypes: ["RETAILER", "PROXY"],
    });
  });

  it("ignores a seller type that is not one of the three real kinds", () => {
    // The value reaches a Prisma enum filter, so anything unrecognised is dropped here rather
    // than passed down as a filter that matches nothing.
    expect(
      parseListingSearchParams({
        sellerType: ["PERSON", "BUSINESS", "person"],
      }),
    ).toEqual({
      ...EMPTY_FILTERS,
      sellerTypes: ["PERSON"],
    });
  });

  it("ignores invalid presence values", () => {
    expect(
      parseListingSearchParams({
        presence: ["ONLINE", "INVALID", "PHYSICAL"],
      }),
    ).toEqual({
      ...EMPTY_FILTERS,
      presenceTypes: ["ONLINE", "PHYSICAL"],
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
      ...EMPTY_FILTERS,
      importCountryCodes: ["JP", "US"],
      receivesOrders: true,
      hasStock: true,
    });
  });

  it("parses includeClosed when set to true", () => {
    expect(parseListingSearchParams({ includeClosed: "true" })).toEqual({
      ...EMPTY_FILTERS,
      includeClosed: true,
    });
  });

  it("keeps includeClosed false for any non-true value", () => {
    expect(parseListingSearchParams({ includeClosed: "1" })).toEqual(EMPTY_FILTERS);
  });

  it("parses page when value is valid", () => {
    expect(parseListingSearchParams({ page: "3" })).toEqual({
      ...EMPTY_FILTERS,
      page: 3,
    });
  });

  it("defaults page to one when value is invalid", () => {
    expect(parseListingSearchParams({ page: "0" })).toEqual(EMPTY_FILTERS);
  });

  it("defaults perPage when the param is missing", () => {
    expect(parseListingSearchParams({}).perPage).toBe(DEFAULT_PAGE_SIZE);
  });

  it("accepts an allow-listed perPage value", () => {
    expect(parseListingSearchParams({ perPage: "10" }).perPage).toBe(10);
    expect(parseListingSearchParams({ perPage: "100" }).perPage).toBe(100);
  });

  it("clamps an out-of-range or invalid perPage back to the default", () => {
    expect(parseListingSearchParams({ perPage: "37" }).perPage).toBe(DEFAULT_PAGE_SIZE);
    expect(parseListingSearchParams({ perPage: "abc" }).perPage).toBe(DEFAULT_PAGE_SIZE);
  });
});

describe("parseListingSearchParams sort", () => {
  it("defaults to the top-rated ordering", () => {
    expect(parseListingSearchParams({}).sort).toBe("topRated");
  });

  it("parses a known sort value", () => {
    expect(parseListingSearchParams({ sort: "alphabetical-desc" }).sort).toBe("alphabetical-desc");
  });

  /** The control used to write `sortBy`; bookmarks carrying it must keep working. */
  it("still accepts the legacy sortBy spelling", () => {
    expect(parseListingSearchParams({ sortBy: "newest" }).sort).toBe("newest");
  });

  it("falls back to the default for a value that is not a real sort", () => {
    expect(parseListingSearchParams({ sort: "by-vibes" }).sort).toBe("topRated");
  });
});

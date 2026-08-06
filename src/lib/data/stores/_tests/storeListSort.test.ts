import { describe, expect, it } from "vitest";
import { resolveStoreListOrderBy } from "../storeQueries";
import { DEFAULT_STORE_LIST_SORT, parseStoreListSort, STORE_LIST_SORT_VALUES } from "@/lib/stores/storeListSort";

describe("resolveStoreListOrderBy", () => {
  /**
   * `averageRating` is nullable and Postgres defaults DESC to NULLS FIRST, so without an explicit
   * placement the default listing would rank every unrated store above every rated one. Invisible
   * while nothing is rated, wrong the moment the first review lands.
   */
  it("keeps unrated stores last in the top-rated ordering", () => {
    const [primary] = resolveStoreListOrderBy("topRated");

    expect(primary).toEqual({ averageRating: { sort: "desc", nulls: "last" } });
  });

  it("orders alphabetically in both directions", () => {
    expect(resolveStoreListOrderBy("alphabetical")[0]).toEqual({ name: "asc" });
    expect(resolveStoreListOrderBy("alphabetical-desc")[0]).toEqual({ name: "desc" });
  });

  it("orders the newest first by creation date", () => {
    expect(resolveStoreListOrderBy("newest")[0]).toEqual({ createdAt: "desc" });
  });

  /**
   * `name` is not unique, so a non-unique final key lets two tied stores swap places between two
   * paginated queries — dropping a row from one page and repeating it on the next.
   */
  it.each(STORE_LIST_SORT_VALUES)("closes the %s ordering with a unique tiebreaker", (sort) => {
    const orderBy = resolveStoreListOrderBy(sort);

    expect(orderBy[orderBy.length - 1]).toEqual({ slug: "asc" });
  });
});

describe("parseStoreListSort", () => {
  it("accepts every real value", () => {
    for (const value of STORE_LIST_SORT_VALUES) {
      expect(parseStoreListSort(value)).toBe(value);
    }
  });

  it("falls back to the default for anything else", () => {
    expect(parseStoreListSort("by-vibes")).toBe(DEFAULT_STORE_LIST_SORT);
    expect(parseStoreListSort(undefined)).toBe(DEFAULT_STORE_LIST_SORT);
  });
});

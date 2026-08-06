import { describe, expect, it } from "vitest";
import { buildPublicStoreListingWhere, PUBLIC_VISIBLE_STORE_STATUSES } from "../storeQueries";

describe("PUBLIC_VISIBLE_STORE_STATUSES", () => {
  it("contains exactly the two lifecycle statuses a store can be publicly visible in", () => {
    expect([...PUBLIC_VISIBLE_STORE_STATUSES]).toEqual(["PENDING", "APPROVED"]);
  });

  it("excludes REJECTED, the only status that hides a store", () => {
    expect(PUBLIC_VISIBLE_STORE_STATUSES).not.toContain("REJECTED");
  });

  it("has no report-driven status: open reports never affect visibility", () => {
    expect(PUBLIC_VISIBLE_STORE_STATUSES).not.toContain("FLAGGED");
  });
});

describe("buildPublicStoreListingWhere status filter", () => {
  it("filters to the shared publicly-visible statuses (REJECTED excluded)", () => {
    const where = buildPublicStoreListingWhere({});

    expect(where.status).toEqual({ in: [...PUBLIC_VISIBLE_STORE_STATUSES] });
    const statuses = (where.status as { in: string[] }).in;
    expect(statuses).not.toContain("REJECTED");
    expect(where.visibility).toBe("PUBLIC");
    expect(where.isPrivate).toBe(false);
  });

  it("keeps the visibility filter regardless of other filters", () => {
    const where = buildPublicStoreListingWhere({ nameQuery: "pokemon", includeClosed: true });

    expect((where.status as { in: string[] }).in).not.toContain("REJECTED");
  });
});

describe("buildPublicStoreListingWhere seller-type filter", () => {
  it("filters to the requested kinds", () => {
    const where = buildPublicStoreListingWhere({ sellerTypes: ["PERSON", "PROXY"] });

    expect(where.sellerType).toEqual({ in: ["PERSON", "PROXY"] });
  });

  it("filters nothing when no kind is requested, so the listing stays complete", () => {
    expect(buildPublicStoreListingWhere({}).sellerType).toBeUndefined();
    expect(buildPublicStoreListingWhere({ sellerTypes: [] }).sellerType).toBeUndefined();
  });
});

describe("buildPublicStoreListingWhere private-store scoping", () => {
  it("shows a viewer their own private stores alongside the public ones", () => {
    // A private store hidden from its own creator is how a collector ended up unable to find the
    // stores image intake had created for them: reachable only by link from an order, absent from
    // the one surface that lists stores.
    const where = buildPublicStoreListingWhere({ viewerId: "user-1" });

    expect(where.OR).toEqual([{ isPrivate: false }, { createdByUserId: "user-1" }]);
    expect(where.isPrivate).toBeUndefined();
  });

  it("shows nobody else's private stores", () => {
    const where = buildPublicStoreListingWhere({ viewerId: "user-1" });
    const clauses = where.OR as Array<Record<string, unknown>>;

    // The only way a private store qualifies is by belonging to this viewer.
    expect(clauses.some((clause) => clause.isPrivate === true && !clause.createdByUserId)).toBe(false);
  });

  it("falls back to public-only when there is no viewer", () => {
    expect(buildPublicStoreListingWhere({}).isPrivate).toBe(false);
    expect(buildPublicStoreListingWhere({ viewerId: null }).isPrivate).toBe(false);
  });
});

describe("buildPublicStoreListingWhere own-private-stores view", () => {
  it("narrows to private stores the viewer created, so it can never surface anyone else's", () => {
    const where = buildPublicStoreListingWhere({ viewerId: "user-1", onlyOwnPrivate: true });

    // Both halves are required together. `isPrivate: true` on its own would be a request for
    // private stores in general, which is exactly the query this feature must never issue.
    expect(where.isPrivate).toBe(true);
    expect(where.createdByUserId).toBe("user-1");
    // It replaces the general visibility clause rather than stacking on it, so nothing that clause
    // would have allowed can widen it back.
    expect(where.OR).toBeUndefined();
  });

  it("matches nothing rather than falling open when there is no viewer", () => {
    // The route is authenticated, so this is defence in depth: if the viewer were ever missing, the
    // failure mode must be an empty listing, never the whole catalog's private stores.
    const where = buildPublicStoreListingWhere({ onlyOwnPrivate: true });

    expect(where.id).toEqual({ in: [] });
    expect(where.isPrivate).toBeUndefined();
  });

  it("leaves the listing alone when the view is off", () => {
    const where = buildPublicStoreListingWhere({ viewerId: "user-1" });

    expect(where.createdByUserId).toBeUndefined();
    expect(where.OR).toEqual([{ isPrivate: false }, { createdByUserId: "user-1" }]);
  });
});

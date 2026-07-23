import { describe, expect, it } from "vitest";
import { buildPublicStoreListingWhere, PUBLIC_VISIBLE_STORE_STATUSES } from "../storeQueries";

describe("PUBLIC_VISIBLE_STORE_STATUSES", () => {
  it("includes PENDING, APPROVED, and FLAGGED, and excludes REJECTED", () => {
    expect(PUBLIC_VISIBLE_STORE_STATUSES).toContain("PENDING");
    expect(PUBLIC_VISIBLE_STORE_STATUSES).toContain("APPROVED");
    // FLAGGED is now publicly visible (opened by this slice), REJECTED is a hidden tombstone.
    expect(PUBLIC_VISIBLE_STORE_STATUSES).toContain("FLAGGED");
    expect(PUBLIC_VISIBLE_STORE_STATUSES).not.toContain("REJECTED");
  });
});

describe("buildPublicStoreListingWhere status filter", () => {
  it("filters to the shared publicly-visible statuses (FLAGGED included, REJECTED excluded)", () => {
    const where = buildPublicStoreListingWhere({});

    expect(where.status).toEqual({ in: [...PUBLIC_VISIBLE_STORE_STATUSES] });
    const statuses = (where.status as { in: string[] }).in;
    expect(statuses).toContain("FLAGGED");
    expect(statuses).not.toContain("REJECTED");
    expect(where.visibility).toBe("PUBLIC");
    expect(where.isPrivate).toBe(false);
  });

  it("keeps the visibility filter regardless of other filters", () => {
    const where = buildPublicStoreListingWhere({ nameQuery: "pokemon", includeClosed: true });

    expect((where.status as { in: string[] }).in).not.toContain("REJECTED");
  });
});

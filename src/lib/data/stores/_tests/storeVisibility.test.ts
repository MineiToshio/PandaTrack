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

import { describe, expect, it } from "vitest";
import type { AdminOpenStoreReport } from "../adminStoreReportQueries";
import type { AdminPendingStoreChangeRequest } from "../adminStoreChangeRequestQueries";
import type { AdminPendingStoreProductTypeRequest } from "../adminStoreProductTypeRequestQueries";
import {
  assembleModerationQueue,
  resolveSelectedItem,
  type ModerationPendingStoreSummary,
  type ModerationQueueInput,
  type ModerationStoreRef,
} from "../moderationQueueQueries";

function storeRef(overrides: Partial<ModerationStoreRef> = {}): ModerationStoreRef {
  return {
    storeId: "store-1",
    slug: "store-1",
    name: "Store 1",
    status: "APPROVED",
    sellerType: "RETAILER",
    countryCode: "PE",
    ...overrides,
  };
}

function report(overrides: Partial<AdminOpenStoreReport> = {}): AdminOpenStoreReport {
  return {
    id: "report-1",
    reason: "SPAM",
    details: "spam details",
    createdAt: new Date("2026-07-01T00:00:00Z"),
    reporter: { id: "user-1", username: "reporter", name: "Reporter", image: null },
    ...overrides,
  };
}

function summary(): ModerationPendingStoreSummary {
  return {
    presenceTypes: [],
    productTypeKeys: [],
    importCountryCodes: [],
    contactChannels: [],
    receivesOrders: null,
    hasStock: null,
  };
}

function changeRequest(overrides: Partial<AdminPendingStoreChangeRequest> = {}): AdminPendingStoreChangeRequest {
  return {
    id: "cr-1",
    requester: { id: "user-2", username: "requester", name: "Requester" },
    comment: null,
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z"),
    fieldRows: [],
    storeDriftedSinceSubmission: false,
    effectiveDiffEmpty: false,
    ...overrides,
  };
}

function productTypeRequest(
  overrides: Partial<AdminPendingStoreProductTypeRequest> = {},
): AdminPendingStoreProductTypeRequest {
  return {
    id: "pt-1",
    suggestedName: "Sobres",
    suggestedKey: null,
    suggestedKeySlug: "sobres",
    reason: null,
    createdAt: new Date("2026-07-01T00:00:00Z"),
    requester: { id: "user-3", username: "suggester", name: "Suggester" },
    ...overrides,
  };
}

const EMPTY_INPUT: ModerationQueueInput = {
  pendingStores: [],
  storeReports: [],
  storeChangeRequests: [],
  productTypeRequests: [],
};

describe("assembleModerationQueue", () => {
  it("composes the four persisted categories into one list", () => {
    const result = assembleModerationQueue({
      pendingStores: [
        { store: storeRef({ storeId: "s-pending" }), summary: summary(), createdAt: new Date("2026-07-02T00:00:00Z") },
      ],
      storeReports: [{ store: storeRef({ storeId: "s-report" }), reports: [report({ id: "r-1" })] }],
      storeChangeRequests: [{ store: storeRef({ storeId: "s-cr" }), requests: [changeRequest({ id: "cr-9" })] }],
      productTypeRequests: [productTypeRequest({ id: "pt-9" })],
    });

    expect(result.items.map((item) => item.type)).toEqual([
      "report",
      "pending_store",
      "change_request",
      "product_type",
    ]);
    expect(result.counts).toEqual({ reports: 1, stores: 1, changes: 1, types: 1 });
  });

  it("derives a single flag row and drops individual report rows at the threshold", () => {
    const result = assembleModerationQueue({
      ...EMPTY_INPUT,
      storeReports: [
        {
          store: storeRef({ storeId: "s-flag" }),
          reports: [
            report({ id: "r-a", createdAt: new Date("2026-07-03T00:00:00Z") }),
            report({ id: "r-b", createdAt: new Date("2026-07-02T00:00:00Z") }),
          ],
        },
      ],
    });

    expect(result.items).toHaveLength(1);
    const [item] = result.items;
    expect(item.type).toBe("flag");
    expect(item.id).toBe("s-flag");
    if (item.type === "flag") {
      expect(item.reports).toHaveLength(2);
      // Sort key is the earliest of the accumulated reports.
      expect(item.sortAt).toEqual(new Date("2026-07-02T00:00:00Z"));
    }
    // Flag candidates count inside the stores bucket, not reports.
    expect(result.counts).toEqual({ reports: 0, stores: 1, changes: 0, types: 0 });
  });

  it("keeps a store with a single open report as an individual report row", () => {
    const result = assembleModerationQueue({
      ...EMPTY_INPUT,
      storeReports: [{ store: storeRef({ storeId: "s-one" }), reports: [report({ id: "r-solo" })] }],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe("report");
    expect(result.items[0].id).toBe("r-solo");
    expect(result.counts.reports).toBe(1);
    expect(result.counts.stores).toBe(0);
  });

  it("orders items across the five tiers, highest impact first", () => {
    const result = assembleModerationQueue({
      pendingStores: [
        { store: storeRef({ storeId: "s-pending" }), summary: summary(), createdAt: new Date("2026-07-05T00:00:00Z") },
      ],
      storeReports: [
        // Flag candidate (>= threshold) and a separate single-report store.
        {
          store: storeRef({ storeId: "s-flag" }),
          reports: [report({ id: "r-1" }), report({ id: "r-2" })],
        },
        { store: storeRef({ storeId: "s-report" }), reports: [report({ id: "r-3" })] },
      ],
      storeChangeRequests: [{ store: storeRef({ storeId: "s-cr" }), requests: [changeRequest({ id: "cr-1" })] }],
      productTypeRequests: [productTypeRequest({ id: "pt-1" })],
    });

    expect(result.items.map((item) => item.type)).toEqual([
      "flag",
      "report",
      "pending_store",
      "change_request",
      "product_type",
    ]);
  });

  it("sorts oldest first within a tier and breaks ties on id", () => {
    const result = assembleModerationQueue({
      ...EMPTY_INPUT,
      productTypeRequests: [
        productTypeRequest({ id: "pt-newer", createdAt: new Date("2026-07-10T00:00:00Z") }),
        productTypeRequest({ id: "pt-older", createdAt: new Date("2026-07-01T00:00:00Z") }),
        productTypeRequest({ id: "pt-a-tie", createdAt: new Date("2026-07-01T00:00:00Z") }),
      ],
    });

    // Oldest first; the two same-timestamp rows break the tie on the id.
    expect(result.items.map((item) => item.id)).toEqual(["pt-a-tie", "pt-older", "pt-newer"]);
  });

  it("shapes each store-related row with slug, name, and status", () => {
    const result = assembleModerationQueue({
      ...EMPTY_INPUT,
      storeReports: [
        {
          store: storeRef({ storeId: "s-x", slug: "panda-store", name: "Panda Store", status: "FLAGGED" }),
          reports: [report({ id: "r-x" })],
        },
      ],
    });

    const [item] = result.items;
    expect(item.type === "report" && item.store).toMatchObject({
      storeId: "s-x",
      slug: "panda-store",
      name: "Panda Store",
      status: "FLAGGED",
    });
  });

  it("returns zeroed counts and no items for an empty inbox", () => {
    const result = assembleModerationQueue(EMPTY_INPUT);
    expect(result.items).toEqual([]);
    expect(result.counts).toEqual({ reports: 0, stores: 0, changes: 0, types: 0 });
  });

  it("counts a pending store and a flag candidate together in the stores bucket", () => {
    const result = assembleModerationQueue({
      pendingStores: [
        { store: storeRef({ storeId: "s-p" }), summary: summary(), createdAt: new Date("2026-07-04T00:00:00Z") },
      ],
      storeReports: [
        { store: storeRef({ storeId: "s-flag" }), reports: [report({ id: "r-1" }), report({ id: "r-2" })] },
      ],
      storeChangeRequests: [],
      productTypeRequests: [],
    });

    expect(result.counts.stores).toBe(2);
  });
});

describe("resolveSelectedItem", () => {
  const built = assembleModerationQueue({
    ...EMPTY_INPUT,
    productTypeRequests: [
      productTypeRequest({ id: "pt-older", createdAt: new Date("2026-07-01T00:00:00Z") }),
      productTypeRequest({ id: "pt-newer", createdAt: new Date("2026-07-10T00:00:00Z") }),
    ],
  });

  it("returns null when the queue is empty", () => {
    expect(resolveSelectedItem([], "product_type:pt-older")).toBeNull();
  });

  it("auto-previews the first item when no selection is given", () => {
    expect(resolveSelectedItem(built.items, undefined)?.id).toBe("pt-older");
  });

  it("resolves an explicit <type>:<id> selection", () => {
    expect(resolveSelectedItem(built.items, "product_type:pt-newer")?.id).toBe("pt-newer");
  });

  it("falls back to the first item when the selection no longer resolves", () => {
    expect(resolveSelectedItem(built.items, "product_type:gone")?.id).toBe("pt-older");
    expect(resolveSelectedItem(built.items, "malformed")?.id).toBe("pt-older");
  });
});

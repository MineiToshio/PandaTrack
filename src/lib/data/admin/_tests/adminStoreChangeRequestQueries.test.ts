import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    store: { findUnique: vi.fn() },
    storeChangeRequest: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { getAdminPendingStoreChangeRequests } from "../adminStoreChangeRequestQueries";

const STORE_ID = "store-1";

const STORE_ROW = {
  id: STORE_ID,
  slug: "store-one",
  name: "Store One",
  description: "Original description",
  logoUrl: null,
  status: "APPROVED",
  sellerType: "RETAILER",
  countryCode: "PE",
  createdByUserId: "user-1",
  hasStock: true,
  receivesOrders: true,
  isPrivate: false,
  isActive: true,
  updatedAt: new Date("2026-07-23T12:00:00Z"),
  presences: [{ presenceType: "ONLINE" }],
  productTypeAssignments: [{ productTypeKey: "figures" }],
  importCountries: [{ countryCode: "JP" }],
  contactChannels: [],
  addresses: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.store.findUnique.mockResolvedValue(STORE_ROW);
});

describe("getAdminPendingStoreChangeRequests", () => {
  it("returns rebased per-field rows, the already-applied tag, list deltas, and the drift signal", async () => {
    prismaMock.storeChangeRequest.findMany.mockResolvedValue([
      {
        id: "cr-1",
        changes: {
          name: "New Name", // surviving scalar
          description: "Original description", // already equals current -> already applied
          productTypeKeys: ["figures", "manga"], // list: figures kept, manga added
        },
        comment: "Please update the name",
        createdAt: new Date("2026-07-20T09:00:00Z"),
        updatedAt: new Date("2026-07-20T09:00:00Z"), // older than store.updatedAt -> drift
        requestedBy: { id: "user-9", username: "collector99", name: "Nine Collector" },
      },
    ]);

    const [request] = await getAdminPendingStoreChangeRequests(STORE_ID);

    expect(prismaMock.storeChangeRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: STORE_ID, status: "PENDING" } }),
    );
    expect(request.requester).toEqual({ id: "user-9", username: "collector99", name: "Nine Collector" });
    expect(request.comment).toBe("Please update the name");
    expect(request.storeDriftedSinceSubmission).toBe(true);
    expect(request.effectiveDiffEmpty).toBe(false);

    const nameRow = request.fieldRows.find((row) => row.fieldKey === "name");
    expect(nameRow).toMatchObject({
      type: "scalar",
      current: { kind: "text", value: "Store One" },
      proposed: { kind: "text", value: "New Name" },
      alreadyApplied: false,
    });

    const descriptionRow = request.fieldRows.find((row) => row.fieldKey === "description");
    expect(descriptionRow?.alreadyApplied).toBe(true);

    const productRow = request.fieldRows.find((row) => row.fieldKey === "productTypeKeys");
    expect(productRow?.type).toBe("list");
    if (productRow?.type === "list") {
      const byToken = Object.fromEntries(productRow.items.map((item) => [item.token, item.delta]));
      expect(byToken).toEqual({ figures: "kept", manga: "added" });
    }
  });

  it("marks effectiveDiffEmpty when every proposed value already matches the store", async () => {
    prismaMock.storeChangeRequest.findMany.mockResolvedValue([
      {
        id: "cr-2",
        changes: { name: "Store One", description: "Original description" },
        comment: null,
        createdAt: new Date("2026-07-23T12:00:00Z"),
        updatedAt: new Date("2026-07-23T12:00:00Z"),
        requestedBy: { id: "user-2", username: "someone", name: "Some One" },
      },
    ]);

    const [request] = await getAdminPendingStoreChangeRequests(STORE_ID);

    expect(request.effectiveDiffEmpty).toBe(true);
    expect(request.storeDriftedSinceSubmission).toBe(false);
    expect(request.fieldRows.every((row) => row.alreadyApplied)).toBe(true);
  });
});

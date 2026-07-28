import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, getTranslationsMock, listAuthoredStoreProductTypeNamesCachedMock } = vi.hoisted(() => ({
  prismaMock: {
    store: { findUnique: vi.fn() },
    storeChangeRequest: { findMany: vi.fn() },
  },
  getTranslationsMock: vi.fn(),
  listAuthoredStoreProductTypeNamesCachedMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("next-intl/server", () => ({ getTranslations: getTranslationsMock }));

vi.mock("@/lib/data/catalog/storeProductTypeQueries", () => ({
  listAuthoredStoreProductTypeNamesCached: listAuthoredStoreProductTypeNamesCachedMock,
}));

import { getAdminPendingStoreChangeRequests } from "../adminStoreChangeRequestQueries";

const STORE_ID = "store-1";
const LOCALE = "en";

/** Namespace-aware passthrough translator: prefixes the resolved key so a test can tell which
 * namespace served it and that the resolver actually ran, rather than the raw token leaking through. */
function translatorFor(namespace: string): (key: string) => string {
  return (key: string) => `${namespace}:${key}`;
}

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
  // Passthrough translator prefixed with the requested namespace, so an assertion can tell a label
  // came from the resolver (and which namespace) rather than leaking the raw stored token.
  getTranslationsMock.mockImplementation(async ({ namespace }: { namespace: string }) => translatorFor(namespace));
  // No admin-authored (non-seed) product types by default; individual tests override this to
  // exercise the hybrid resolver's DB-name-first branch.
  listAuthoredStoreProductTypeNamesCachedMock.mockResolvedValue([]);
});

describe("getAdminPendingStoreChangeRequests", () => {
  it("returns rebased per-field rows, the already-applied tag, list deltas, and the drift signal", async () => {
    prismaMock.storeChangeRequest.findMany.mockResolvedValue([
      {
        id: "cr-1",
        changes: {
          name: "New Name", // surviving scalar
          description: "Original description", // already equals current -> already applied
          presenceTypes: ["ONLINE", "PHYSICAL"], // list: ONLINE kept, PHYSICAL added
          productTypeKeys: ["figures", "manga"], // list: figures kept, manga added
          importCountries: ["JP", "PE"], // list: JP kept, PE added
        },
        comment: "Please update the name",
        createdAt: new Date("2026-07-20T09:00:00Z"),
        updatedAt: new Date("2026-07-20T09:00:00Z"), // older than store.updatedAt -> drift
        requestedBy: { id: "user-9", username: "collector99", name: "Nine Collector" },
      },
    ]);
    // Admin-authored DB name wins over the i18n fallback for "figures" in this request.
    listAuthoredStoreProductTypeNamesCachedMock.mockResolvedValue([
      { key: "figures", nameEs: "Figuras a medida", nameEn: "Custom Figures" },
    ]);

    const [request] = await getAdminPendingStoreChangeRequests(STORE_ID, LOCALE);

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

    // Presence labels resolve through the `admin.review` namespace, the same keys the pending-store
    // review uses, instead of leaking the raw `StorePresenceType` token.
    const presenceRow = request.fieldRows.find((row) => row.fieldKey === "presenceTypes");
    expect(presenceRow?.type).toBe("list");
    if (presenceRow?.type === "list") {
      const byToken = Object.fromEntries(presenceRow.items.map((item) => [item.token, item.label]));
      expect(byToken).toEqual({ ONLINE: "admin.review:presence.ONLINE", PHYSICAL: "admin.review:presence.PHYSICAL" });
    }

    // Product-type labels resolve via the hybrid resolver: the authored DB name wins for "figures",
    // and the seeded "manga" key falls back to the `storeProductTypes` i18n namespace.
    const productRow = request.fieldRows.find((row) => row.fieldKey === "productTypeKeys");
    expect(productRow?.type).toBe("list");
    if (productRow?.type === "list") {
      const byToken = Object.fromEntries(productRow.items.map((item) => [item.token, item.delta]));
      expect(byToken).toEqual({ figures: "kept", manga: "added" });
      const labelByToken = Object.fromEntries(productRow.items.map((item) => [item.token, item.label]));
      expect(labelByToken).toEqual({ figures: "Custom Figures", manga: "storeProductTypes:manga" });
    }

    // Import-country labels resolve through the shared `countries` namespace convention.
    const importRow = request.fieldRows.find((row) => row.fieldKey === "importCountries");
    expect(importRow?.type).toBe("list");
    if (importRow?.type === "list") {
      const byToken = Object.fromEntries(importRow.items.map((item) => [item.token, item.label]));
      expect(byToken).toEqual({ JP: "countries:JP", PE: "countries:PE" });
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

    const [request] = await getAdminPendingStoreChangeRequests(STORE_ID, LOCALE);

    expect(request.effectiveDiffEmpty).toBe(true);
    expect(request.storeDriftedSinceSubmission).toBe(false);
    expect(request.fieldRows.every((row) => row.alreadyApplied)).toBe(true);
  });
});

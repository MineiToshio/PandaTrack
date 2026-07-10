import { describe, expect, it } from "vitest";
import { mergeEditableStoreWithChangeRequest, type EditableStore } from "../storeGovernanceQueries";

const BASE_STORE: EditableStore = {
  id: "store-1",
  slug: "store-one",
  name: "Store One",
  description: "Original description",
  logoUrl: "https://cdn.example.com/store-logos/store-1.webp",
  status: "APPROVED",
  storeType: "BUSINESS",
  countryCode: "PE",
  createdByUserId: "user-1",
  hasStock: true,
  receivesOrders: true,
  isPrivate: false,
  presenceTypes: ["ONLINE"],
  productTypeKeys: ["figures"],
  importCountryCodes: ["JP"],
  contactChannels: [],
  addresses: [],
};

describe("store governance helpers", () => {
  it("mergeEditableStoreWithChangeRequest prefers pending logoUrl values when reopening the edit form", () => {
    const merged = mergeEditableStoreWithChangeRequest(BASE_STORE, {
      logoUrl: "https://cdn.example.com/store-logos/pending/store-1-user-1.webp",
      description: "Pending description",
    });

    expect(merged.logoUrl).toBe("https://cdn.example.com/store-logos/pending/store-1-user-1.webp");
    expect(merged.description).toBe("Pending description");
    expect(merged.name).toBe(BASE_STORE.name);
  });

  it("mergeEditableStoreWithChangeRequest keeps the persisted logo when no pending logo change exists", () => {
    const merged = mergeEditableStoreWithChangeRequest(BASE_STORE, {
      description: "Updated description only",
    });

    expect(merged.logoUrl).toBe(BASE_STORE.logoUrl);
    expect(merged.description).toBe("Updated description only");
  });
});

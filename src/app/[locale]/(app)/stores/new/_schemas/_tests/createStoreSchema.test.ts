import { describe, expect, it } from "vitest";
import { createStoreSchema } from "../createStoreSchema";

const VALID_BASE = {
  name: "Akiba Records",
  sellerType: "PERSON" as const,
  countryCode: "JP",
  presenceTypes: ["ONLINE"],
  productTypeKeys: ["vinyl"],
  contactChannels: [],
  addresses: [],
  importCountries: [],
  logoAction: "keep",
};

describe("createStoreSchema — isPrivate flag (ADR 0009)", () => {
  it("accepts isPrivate=true when sellerType=PERSON", () => {
    const parsed = createStoreSchema.safeParse({ ...VALID_BASE, isPrivate: true });
    expect(parsed.success).toBe(true);
  });

  it("rejects isPrivate=true when sellerType=RETAILER", () => {
    const parsed = createStoreSchema.safeParse({
      ...VALID_BASE,
      sellerType: "RETAILER",
      isPrivate: true,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.message === "isPrivateOnlyPerson")).toBe(true);
    }
  });

  it("rejects isPrivate=true when sellerType=PROXY", () => {
    const parsed = createStoreSchema.safeParse({
      ...VALID_BASE,
      sellerType: "PROXY",
      productTypeKeys: [],
      isPrivate: true,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.message === "isPrivateOnlyPerson")).toBe(true);
    }
  });

  it("accepts isPrivate=false when sellerType=RETAILER", () => {
    const parsed = createStoreSchema.safeParse({
      ...VALID_BASE,
      sellerType: "RETAILER",
      isPrivate: false,
    });
    expect(parsed.success).toBe(true);
  });

  it("defaults isPrivate to false when omitted", () => {
    const parsed = createStoreSchema.safeParse(VALID_BASE);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.isPrivate).toBe(false);
    }
  });
});

describe("createStoreSchema — product types by seller type", () => {
  it("requires at least one product type for RETAILER", () => {
    const parsed = createStoreSchema.safeParse({
      ...VALID_BASE,
      sellerType: "RETAILER",
      productTypeKeys: [],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.message === "productTypeRequired")).toBe(true);
    }
  });

  it("requires at least one product type for PERSON", () => {
    const parsed = createStoreSchema.safeParse({ ...VALID_BASE, productTypeKeys: [] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.message === "productTypeRequired")).toBe(true);
    }
  });

  it("allows a PROXY to save with no product types (it has no catalog)", () => {
    const parsed = createStoreSchema.safeParse({
      ...VALID_BASE,
      sellerType: "PROXY",
      productTypeKeys: [],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.productTypeKeys).toEqual([]);
    }
  });
});

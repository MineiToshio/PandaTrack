import { describe, expect, it } from "vitest";
import { createStoreSchema } from "../createStoreSchema";

const VALID_BASE = {
  name: "Akiba Records",
  storeType: "PERSON" as const,
  countryCode: "JP",
  presenceTypes: ["ONLINE"],
  productTypeKeys: ["vinyl"],
  contactChannels: [],
  addresses: [],
  importCountries: [],
  logoAction: "keep",
};

describe("createStoreSchema — isPrivate flag (ADR 0009)", () => {
  it("accepts isPrivate=true when storeType=PERSON", () => {
    const parsed = createStoreSchema.safeParse({ ...VALID_BASE, isPrivate: true });
    expect(parsed.success).toBe(true);
  });

  it("rejects isPrivate=true when storeType=BUSINESS", () => {
    const parsed = createStoreSchema.safeParse({
      ...VALID_BASE,
      storeType: "BUSINESS",
      isPrivate: true,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.message === "isPrivateOnlyPerson")).toBe(true);
    }
  });

  it("accepts isPrivate=false when storeType=BUSINESS", () => {
    const parsed = createStoreSchema.safeParse({
      ...VALID_BASE,
      storeType: "BUSINESS",
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

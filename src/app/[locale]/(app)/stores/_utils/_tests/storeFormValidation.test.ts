import { describe, expect, it } from "vitest";
import { validateCatalogStep } from "../storeFormValidation";

describe("validateCatalogStep — product type requirement by seller type", () => {
  it("requires at least one product type by default (RETAILER / PERSON)", () => {
    const errors = validateCatalogStep({ productTypeKeys: [], presenceTypes: ["ONLINE"] });
    expect(errors.productTypeKeys).toBe("productTypeRequired");
  });

  it("does not require product types for a PROXY (no catalog)", () => {
    const errors = validateCatalogStep({
      productTypeKeys: [],
      presenceTypes: ["ONLINE"],
      requireProductTypes: false,
    });
    expect(errors.productTypeKeys).toBeUndefined();
  });

  it("still requires a presence type even for a PROXY", () => {
    const errors = validateCatalogStep({
      productTypeKeys: [],
      presenceTypes: [],
      requireProductTypes: false,
    });
    expect(errors.presenceTypes).toBe("presenceRequired");
    expect(errors.productTypeKeys).toBeUndefined();
  });
});

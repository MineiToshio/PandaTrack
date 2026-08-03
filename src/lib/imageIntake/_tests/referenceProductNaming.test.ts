import { describe, expect, it } from "vitest";
import type { ExtractedGroup, ExtractedProduct } from "../draftSchema";
import { findProductsNeedingReferenceSheet, isHostOnlyProductName } from "../referenceProductNaming";

function buildProduct(overrides: Partial<ExtractedProduct> = {}): ExtractedProduct {
  return {
    name: "Gojo Satoru Figure",
    unitPrice: 9000,
    suggestedProductTypeKey: null,
    referenceUrl: null,
    ...overrides,
  };
}

function buildGroup(overrides: Partial<ExtractedGroup> = {}): ExtractedGroup {
  return {
    sourcePhrase: "quiero este",
    reason: "sealed",
    doubtful: false,
    priceSplit: "explicit-unit",
    products: [buildProduct()],
    ...overrides,
  };
}

describe("isHostOnlyProductName", () => {
  it("recognizes the fallback name the extraction produces for a bare link", () => {
    expect(isHostOnlyProductName("mercadolibre.com.pe", "https://mercadolibre.com.pe/p/MPE123")).toBe(true);
  });

  it("ignores the www prefix on either side", () => {
    expect(isHostOnlyProductName("mercadolibre.com.pe", "https://www.mercadolibre.com.pe/p/MPE123")).toBe(true);
    expect(isHostOnlyProductName("www.mercadolibre.com.pe", "https://mercadolibre.com.pe/p/MPE123")).toBe(true);
  });

  it("ignores letter case and surrounding space", () => {
    expect(isHostOnlyProductName("  MercadoLibre.com.PE ", "https://mercadolibre.com.pe/p/MPE123")).toBe(true);
  });

  it("accepts a name that carries the scheme or a trailing slash", () => {
    expect(isHostOnlyProductName("https://mercadolibre.com.pe/", "https://mercadolibre.com.pe/p/MPE123")).toBe(true);
  });

  it("keeps a subdomain significant, because it is a different host", () => {
    expect(isHostOnlyProductName("mercadolibre.com.pe", "https://tienda.mercadolibre.com.pe/p/1")).toBe(false);
  });

  it("leaves a real product name alone even when the store is named after its domain", () => {
    expect(isHostOnlyProductName("Gojo Satoru Figure", "https://mercadolibre.com.pe/p/MPE123")).toBe(false);
    expect(isHostOnlyProductName("Mercado Libre Gojo", "https://mercadolibre.com.pe/p/MPE123")).toBe(false);
  });

  it("answers false for an empty name and for an unreadable address", () => {
    expect(isHostOnlyProductName("   ", "https://mercadolibre.com.pe/p/MPE123")).toBe(false);
    expect(isHostOnlyProductName("mercadolibre.com.pe", "not a url")).toBe(false);
  });
});

describe("findProductsNeedingReferenceSheet", () => {
  it("finds nothing when no product carries a link", () => {
    expect(findProductsNeedingReferenceSheet([buildGroup()])).toEqual([]);
  });

  it("finds nothing when a linked product already has a confident name", () => {
    const groups = [
      buildGroup({
        products: [buildProduct({ referenceUrl: "https://mercadolibre.com.pe/p/MPE123" })],
      }),
    ];

    expect(findProductsNeedingReferenceSheet(groups)).toEqual([]);
  });

  it("flags a linked product whose name is only the host, and says which one", () => {
    const groups = [
      buildGroup({ products: [buildProduct({ name: "Nendoroid Nezuko" })] }),
      buildGroup({
        sourcePhrase: "y este tambien",
        products: [
          buildProduct({ name: "mercadolibre.com.pe", referenceUrl: "https://www.mercadolibre.com.pe/p/MPE123" }),
        ],
      }),
    ];

    expect(findProductsNeedingReferenceSheet(groups)).toEqual([
      {
        groupIndex: 1,
        productIndex: 0,
        name: "mercadolibre.com.pe",
        referenceUrl: "https://www.mercadolibre.com.pe/p/MPE123",
        reason: "host-only-name",
      },
    ]);
  });

  it("flags a linked product inside a doubtful group even when it was named", () => {
    const groups = [
      buildGroup({
        doubtful: true,
        products: [buildProduct({ name: "Figura Gojo?", referenceUrl: "https://shopee.com/x" })],
      }),
    ];

    expect(findProductsNeedingReferenceSheet(groups)).toEqual([
      {
        groupIndex: 0,
        productIndex: 0,
        name: "Figura Gojo?",
        referenceUrl: "https://shopee.com/x",
        reason: "doubtful-group",
      },
    ]);
  });

  it("prefers the host-only reason when the group is also doubtful", () => {
    const groups = [
      buildGroup({
        doubtful: true,
        products: [buildProduct({ name: "shopee.com", referenceUrl: "https://shopee.com/x" })],
      }),
    ];

    expect(findProductsNeedingReferenceSheet(groups)[0]?.reason).toBe("host-only-name");
  });

  it("leaves an unlinked product in a doubtful group alone: a product page is not reachable for it", () => {
    const groups = [buildGroup({ doubtful: true, products: [buildProduct({ name: "algo del pack" })] })];

    expect(findProductsNeedingReferenceSheet(groups)).toEqual([]);
  });

  it("reports every weak row, in the order the draft holds them", () => {
    const groups = [
      buildGroup({
        products: [
          buildProduct({ name: "shopee.com", referenceUrl: "https://shopee.com/a" }),
          buildProduct({ name: "Figura Gojo", referenceUrl: "https://shopee.com/b" }),
          buildProduct({ name: "https://amiami.com", referenceUrl: "https://amiami.com/c" }),
        ],
      }),
    ];

    expect(findProductsNeedingReferenceSheet(groups).map((entry) => entry.productIndex)).toEqual([0, 2]);
  });
});

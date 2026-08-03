import { describe, expect, it, test } from "vitest";
import { applyBreakdown } from "../breakdown";
import type { ExtractedGroup, ExtractedProduct, ImageIntakeDraft } from "../draftSchema";
import { MAX_PRODUCTS_PER_ORDER } from "../constants";

function buildDraft(overrides: Partial<ImageIntakeDraft> = {}): ImageIntakeDraft {
  return {
    store: {
      matchedStoreId: null,
      name: { value: null, source: null },
      phone: { value: null, source: null },
      candidates: [],
    },
    currency: { value: "PEN", source: "read" },
    orderDate: { value: "2026-07-20", source: "read" },
    totalCost: { value: 15000, source: "read" },
    groups: [],
    payments: [],
    delivery: null,
    warnings: [],
    ...overrides,
  };
}

function buildProduct(overrides: Partial<ExtractedProduct> = {}): ExtractedProduct {
  return { name: "Product", unitPrice: null, suggestedProductTypeKey: null, referenceUrl: null, ...overrides };
}

function buildGroup(overrides: Partial<ExtractedGroup> = {}): ExtractedGroup {
  return {
    sourcePhrase: "test phrase",
    reason: "split",
    doubtful: false,
    priceSplit: "none",
    products: [],
    ...overrides,
  };
}

/** N identical-name products, all with the given raw unit price (or null). */
function identicalProducts(count: number, unitPrice: number | null = null, name = "Product"): ExtractedProduct[] {
  return Array.from({ length: count }, (_, index) => buildProduct({ name: `${name} ${index + 1}`, unitPrice }));
}

/**
 * A "divided-lot" group as the extraction engine is expected to produce it: the one amount it read
 * lands on the first product in source order, the rest are null (see breakdown.ts `findLotTotal`).
 */
function dividedLotGroup(total: number, count: number, overrides: Partial<ExtractedGroup> = {}): ExtractedGroup {
  const products = identicalProducts(count).map((product, index) => ({
    ...product,
    unitPrice: index === 0 ? total : null,
  }));
  return buildGroup({ priceSplit: "divided-lot", products, ...overrides });
}

function sumUnitPrices(products: ExtractedProduct[]): number {
  return products.reduce((sum, product) => sum + (product.unitPrice ?? 0), 0);
}

describe("applyBreakdown", () => {
  describe("divided-lot price split", () => {
    const EXACT_DIVISION_CASES: Array<[total: number, count: number, expected: number[]]> = [
      [23700, 5, [4740, 4740, 4740, 4740, 4740]],
    ];

    const REMAINDER_DIVISION_CASES: Array<[total: number, count: number, expected: number[]]> = [
      [10000, 3, [3334, 3333, 3333]],
      [100, 3, [34, 33, 33]],
      [7, 2, [4, 3]],
    ];

    test.each(EXACT_DIVISION_CASES)(
      "splits %i across %i products evenly as %j with no uneven warning",
      (total, count, expected) => {
        const draft = buildDraft({ groups: [dividedLotGroup(total, count)] });
        const result = applyBreakdown(draft);
        expect(result.outcome).toBe("ok");
        if (result.outcome !== "ok") return;
        const prices = result.draft.groups[0].products.map((product) => product.unitPrice);
        expect(prices).toEqual(expected);
        expect(sumUnitPrices(result.draft.groups[0].products)).toBe(total);
        expect(result.draft.warnings.some((warning) => warning.code === "price-split-uneven")).toBe(false);
      },
    );

    test.each(REMAINDER_DIVISION_CASES)(
      "splits %i across %i products as %j, sum exact, with an uneven warning",
      (total, count, expected) => {
        const draft = buildDraft({ groups: [dividedLotGroup(total, count)] });
        const result = applyBreakdown(draft);
        expect(result.outcome).toBe("ok");
        if (result.outcome !== "ok") return;
        const prices = result.draft.groups[0].products.map((product) => product.unitPrice);
        expect(prices).toEqual(expected);
        expect(sumUnitPrices(result.draft.groups[0].products)).toBe(total);
        expect(result.draft.warnings.some((warning) => warning.code === "price-split-uneven")).toBe(true);
      },
    );

    it("gives a single-product group the entire lot total, with no uneven warning", () => {
      const draft = buildDraft({ groups: [dividedLotGroup(5000, 1)] });
      const result = applyBreakdown(draft);
      expect(result.outcome).toBe("ok");
      if (result.outcome !== "ok") return;
      expect(result.draft.groups[0].products.map((product) => product.unitPrice)).toEqual([5000]);
      expect(result.draft.warnings.some((warning) => warning.code === "price-split-uneven")).toBe(false);
    });

    it("represents a quantity greater than one as several identical products, each receiving its own share", () => {
      // "2x figura a S/70 el par" arrives as one group with two identical-name products, quantity 1
      // each, and a lot total to redistribute. This engine never fuses or expands product counts.
      const draft = buildDraft({ groups: [dividedLotGroup(7000, 2, { sourcePhrase: "2x figura a S/70 el par" })] });
      const result = applyBreakdown(draft);
      expect(result.outcome).toBe("ok");
      if (result.outcome !== "ok") return;
      const products = result.draft.groups[0].products;
      expect(products).toHaveLength(2);
      expect(products.map((product) => product.unitPrice)).toEqual([3500, 3500]);
    });

    it("leaves every unit price null when the lot has no readable amount", () => {
      const draft = buildDraft({
        groups: [buildGroup({ priceSplit: "divided-lot", products: identicalProducts(3, null) })],
      });
      const result = applyBreakdown(draft);
      expect(result.outcome).toBe("ok");
      if (result.outcome !== "ok") return;
      expect(result.draft.groups[0].products.every((product) => product.unitPrice === null)).toBe(true);
      expect(result.draft.warnings.some((warning) => warning.code === "price-split-uneven")).toBe(false);
    });

    it("includes the source phrase on the uneven-split warning so it can be traced back", () => {
      const draft = buildDraft({ groups: [dividedLotGroup(10000, 3, { sourcePhrase: "3 figuras a S/100 el lote" })] });
      const result = applyBreakdown(draft);
      expect(result.outcome).toBe("ok");
      if (result.outcome !== "ok") return;
      const warning = result.draft.warnings.find((entry) => entry.code === "price-split-uneven");
      expect(warning?.detail).toBe("3 figuras a S/100 el lote");
    });
  });

  describe("zero-decimal currency split (CLP, JPY, KRW)", () => {
    it("divides on the major unit so no product gets a fractional-cent amount, uneven case", () => {
      // 10000 minor units = 100 JPY major, split 3 ways: 34/33/33 major -> 3400/3300/3300 minor.
      const draft = buildDraft({ currency: { value: "JPY", source: "read" }, groups: [dividedLotGroup(10000, 3)] });
      const result = applyBreakdown(draft);
      expect(result.outcome).toBe("ok");
      if (result.outcome !== "ok") return;
      const prices = result.draft.groups[0].products.map((product) => product.unitPrice);
      expect(prices).toEqual([3400, 3300, 3300]);
      expect(sumUnitPrices(result.draft.groups[0].products)).toBe(10000);
      expect(prices.every((price) => (price ?? 0) % 100 === 0)).toBe(true);
      expect(result.draft.warnings.some((warning) => warning.code === "price-split-uneven")).toBe(true);
    });

    it("divides on the major unit exactly, no uneven warning", () => {
      // 9000 minor units = 90 CLP major, split 3 ways evenly: 30 major each -> 3000 minor each.
      const draft = buildDraft({ currency: { value: "CLP", source: "read" }, groups: [dividedLotGroup(9000, 3)] });
      const result = applyBreakdown(draft);
      expect(result.outcome).toBe("ok");
      if (result.outcome !== "ok") return;
      expect(result.draft.groups[0].products.map((product) => product.unitPrice)).toEqual([3000, 3000, 3000]);
      expect(result.draft.warnings.some((warning) => warning.code === "price-split-uneven")).toBe(false);
    });
  });

  describe("explicit-unit price split", () => {
    it("respects the given unit prices as-is, including a null one, with no warning", () => {
      const products = [buildProduct({ name: "A", unitPrice: 3000 }), buildProduct({ name: "B", unitPrice: null })];
      const draft = buildDraft({ groups: [buildGroup({ priceSplit: "explicit-unit", products })] });
      const result = applyBreakdown(draft);
      expect(result.outcome).toBe("ok");
      if (result.outcome !== "ok") return;
      expect(result.draft.groups[0].products.map((product) => product.unitPrice)).toEqual([3000, null]);
      expect(result.draft.warnings.some((warning) => warning.code === "price-split-uneven")).toBe(false);
    });
  });

  describe("no price split", () => {
    it("sets every unit price to null and adds no split warning, even if raw prices were present", () => {
      const products = [buildProduct({ name: "A", unitPrice: 1000 }), buildProduct({ name: "B", unitPrice: 2000 })];
      const draft = buildDraft({ groups: [buildGroup({ priceSplit: "none", products })] });
      const result = applyBreakdown(draft);
      expect(result.outcome).toBe("ok");
      if (result.outcome !== "ok") return;
      expect(result.draft.groups[0].products.every((product) => product.unitPrice === null)).toBe(true);
      expect(result.draft.warnings).toHaveLength(0);
    });
  });

  describe("product ceiling", () => {
    it("passes with exactly the ceiling number of products", () => {
      const draft = buildDraft({
        groups: [buildGroup({ priceSplit: "none", products: identicalProducts(MAX_PRODUCTS_PER_ORDER) })],
      });
      const result = applyBreakdown(draft);
      expect(result.outcome).toBe("ok");
    });

    it("stops with the product-ceiling-exceeded outcome and the real count, with no truncated draft", () => {
      const overCount = 240;
      const draft = buildDraft({
        groups: [buildGroup({ priceSplit: "none", products: identicalProducts(overCount) })],
      });
      const result = applyBreakdown(draft);
      expect(result.outcome).toBe("product-ceiling-exceeded");
      if (result.outcome !== "product-ceiling-exceeded") return;
      expect(result.productCount).toBe(overCount);
      expect("draft" in result).toBe(false);
    });

    it("counts products across multiple groups, not just the largest one", () => {
      const draft = buildDraft({
        groups: [
          buildGroup({ priceSplit: "none", products: identicalProducts(150) }),
          buildGroup({ priceSplit: "none", products: identicalProducts(90) }),
        ],
      });
      const result = applyBreakdown(draft);
      expect(result.outcome).toBe("product-ceiling-exceeded");
      if (result.outcome !== "product-ceiling-exceeded") return;
      expect(result.productCount).toBe(240);
    });
  });

  describe("totalCost invariant", () => {
    it("never changes totalCost across explicit-unit, divided-lot, none, and ceiling-exceeded outcomes", () => {
      const scenarios: ImageIntakeDraft[] = [
        buildDraft({ groups: [buildGroup({ priceSplit: "explicit-unit", products: identicalProducts(2, 3000) })] }),
        buildDraft({ groups: [dividedLotGroup(10000, 3)] }),
        buildDraft({ groups: [buildGroup({ priceSplit: "none", products: identicalProducts(2, 1000) })] }),
        buildDraft({ groups: [buildGroup({ priceSplit: "none", products: identicalProducts(240) })] }),
      ];

      for (const draft of scenarios) {
        const result = applyBreakdown(draft);
        if (result.outcome === "ok") {
          expect(result.draft.totalCost).toEqual(draft.totalCost);
        }
        // Ceiling-exceeded carries no draft at all, so totalCost cannot have been touched either way.
      }
    });
  });

  describe("purity", () => {
    it("does not mutate the input draft", () => {
      const draft = buildDraft({ groups: [dividedLotGroup(10000, 3)] });
      const snapshot = JSON.parse(JSON.stringify(draft)) as ImageIntakeDraft;
      applyBreakdown(draft);
      expect(draft).toEqual(snapshot);
    });
  });
});

import { describe, expect, it } from "vitest";
import type { ImageIntakeDraft } from "../draftSchema";
import { withValidatedSuggestedCategories } from "../suggestedCategory";

function buildDraft(suggestionsPerGroup: (string | null)[][]): ImageIntakeDraft {
  return {
    store: {
      matchedStoreId: null,
      name: { value: "Pop Dealer", source: "read" },
      phone: { value: null, source: null },
      candidates: [],
    },
    currency: { value: "PEN", source: "read" },
    orderDate: { value: "2026-07-20", source: "read" },
    totalCost: { value: 15000, source: "read" },
    groups: suggestionsPerGroup.map((suggestions, groupIndex) => ({
      sourcePhrase: `lote ${groupIndex}`,
      reason: "split" as const,
      doubtful: false,
      priceSplit: "explicit-unit" as const,
      products: suggestions.map((suggestedProductTypeKey, index) => ({
        name: `Producto ${groupIndex}-${index}`,
        unitPrice: 1000,
        suggestedProductTypeKey,
        referenceUrl: null,
      })),
    })),
    payments: [],
    delivery: null,
    warnings: [],
  };
}

function readSuggestions(draft: ImageIntakeDraft): (string | null)[][] {
  return draft.groups.map((group) => group.products.map((product) => product.suggestedProductTypeKey));
}

describe("withValidatedSuggestedCategories", () => {
  it("keeps a suggestion the active catalog backs", () => {
    const result = withValidatedSuggestedCategories(buildDraft([["manga"]]), ["manga", "figures"]);

    expect(readSuggestions(result)).toEqual([["manga"]]);
  });

  it("drops a suggestion no catalog row backs", () => {
    const result = withValidatedSuggestedCategories(buildDraft([["blu_rays"]]), ["manga", "figures"]);

    expect(readSuggestions(result)).toEqual([[null]]);
  });

  it("drops every suggestion when the catalog is empty", () => {
    const result = withValidatedSuggestedCategories(buildDraft([["manga", "figures"]]), []);

    expect(readSuggestions(result)).toEqual([[null, null]]);
  });

  it("decides per product, across groups", () => {
    const result = withValidatedSuggestedCategories(
      buildDraft([
        ["manga", "blu_rays"],
        [null, "figures"],
      ]),
      ["manga", "figures"],
    );

    expect(readSuggestions(result)).toEqual([
      ["manga", null],
      [null, "figures"],
    ]);
  });

  it("changes nothing else about the draft", () => {
    const draft = buildDraft([["blu_rays"]]);
    draft.groups[0].products[0].referenceUrl = "https://tienda.pe/producto/1";

    const result = withValidatedSuggestedCategories(draft, ["manga"]);

    expect(result.store).toEqual(draft.store);
    expect(result.currency).toEqual(draft.currency);
    expect(result.totalCost).toEqual(draft.totalCost);
    expect(result.groups[0].sourcePhrase).toBe(draft.groups[0].sourcePhrase);
    expect(result.groups[0].products[0].name).toBe(draft.groups[0].products[0].name);
    expect(result.groups[0].products[0].unitPrice).toBe(1000);
    expect(result.groups[0].products[0].referenceUrl).toBe("https://tienda.pe/producto/1");
  });

  it("is case-sensitive and does not repair a near miss into a real key", () => {
    // Repairing would be guessing. The collector picks instead, which is the honest outcome.
    const result = withValidatedSuggestedCategories(buildDraft([["Manga", "manga "]]), ["manga"]);

    expect(readSuggestions(result)).toEqual([[null, null]]);
  });

  it("does not mutate the draft it was given", () => {
    const draft = buildDraft([["blu_rays"]]);

    withValidatedSuggestedCategories(draft, ["manga"]);

    expect(draft.groups[0].products[0].suggestedProductTypeKey).toBe("blu_rays");
  });
});

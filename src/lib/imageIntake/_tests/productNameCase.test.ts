import { describe, expect, it } from "vitest";
import type { ImageIntakeDraft } from "../draftSchema";
import { capitalizeProductName, withCapitalizedProductNames } from "../productNameCase";

describe("capitalizeProductName", () => {
  it("raises the first letter of a name transcribed in lowercase", () => {
    expect(capitalizeProductName("set de 6 mistery box de One Piece")).toBe("Set de 6 mistery box de One Piece");
  });

  it("leaves every character after the first exactly as read", () => {
    // Title casing would be wrong in Spanish and would also destroy casing the source got right.
    expect(capitalizeProductName("figura de goku ssj de DBZ")).toBe("Figura de goku ssj de DBZ");
    expect(capitalizeProductName("mando para PS5")).toBe("Mando para PS5");
  });

  it("leaves an already capitalised name untouched", () => {
    expect(capitalizeProductName("Funko chase de Gojo")).toBe("Funko chase de Gojo");
    expect(capitalizeProductName("PACK completo")).toBe("PACK completo");
  });

  it("raises an accented first letter", () => {
    expect(capitalizeProductName("álbum de figuritas")).toBe("Álbum de figuritas");
  });

  it("leaves a name that does not start with a letter untouched", () => {
    // There is no first letter to raise, and inventing one would corrupt the name rather than tidy it.
    expect(capitalizeProductName("3 figuras de Gojo")).toBe("3 figuras de Gojo");
    expect(capitalizeProductName("+Ultra edición limitada")).toBe("+Ultra edición limitada");
    expect(capitalizeProductName("¡oferta! manga tomo 1")).toBe("¡oferta! manga tomo 1");
  });

  it("does not split an astral first character", () => {
    // Iterating code points keeps an emoji whole; indexing by UTF-16 unit would return half a pair
    // and produce a corrupted string.
    const withEmoji = "🎁 caja sorpresa";
    expect(capitalizeProductName(withEmoji)).toBe(withEmoji);
  });

  it("never lengthens the name through an expanding case change", () => {
    // The German sharp s upper-cases to two characters; growing the string would silently rewrite
    // the name rather than raise it.
    expect(capitalizeProductName("ßeta figura")).toBe("ßeta figura");
  });

  it("returns an empty name unchanged", () => {
    expect(capitalizeProductName("")).toBe("");
  });
});

function draftWithProductNames(names: string[]): ImageIntakeDraft {
  return {
    store: {
      matchedStoreId: null,
      name: { value: null, source: null },
      phone: { value: null, source: null },
      candidates: [],
    },
    currency: { value: "PEN", source: "assumed" },
    orderDate: { value: null, source: null },
    totalCost: { value: null, source: null },
    groups: [
      {
        sourcePhrase: "set de 6 mistery box",
        reason: "split",
        doubtful: false,
        priceSplit: "none",
        products: names.map((name) => ({
          name,
          unitPrice: null,
          suggestedProductTypeKey: null,
          referenceUrl: null,
        })),
      },
    ],
    payments: [],
    delivery: null,
    warnings: [],
  } as ImageIntakeDraft;
}

describe("withCapitalizedProductNames", () => {
  it("capitalises every product across the draft", () => {
    const result = withCapitalizedProductNames(draftWithProductNames(["set de 6", "figura de gojo"]));

    expect(result.groups[0].products.map((product) => product.name)).toEqual(["Set de 6", "Figura de gojo"]);
  });

  it("leaves the quoted source phrase verbatim", () => {
    // The phrase is shown to the collector as evidence of what the chat literally said, so editing
    // it would undermine the one field whose whole job is to be a quote.
    const result = withCapitalizedProductNames(draftWithProductNames(["set de 6"]));

    expect(result.groups[0].sourcePhrase).toBe("set de 6 mistery box");
  });

  it("does not mutate the draft it was given", () => {
    const draft = draftWithProductNames(["set de 6"]);

    withCapitalizedProductNames(draft);

    expect(draft.groups[0].products[0].name).toBe("set de 6");
  });
});

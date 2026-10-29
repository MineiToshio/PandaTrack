import { describe, expect, it } from "vitest";
import type { ImageIntakeDraft } from "../draftSchema";
import { compareNaturally, sortDraftProductsNaturally } from "../naturalSort";

function draftWithNames(groups: string[][]): ImageIntakeDraft {
  return {
    groups: groups.map((names, index) => ({
      sourcePhrase: `Source ${index}`,
      reason: "split",
      doubtful: false,
      priceSplit: "explicit-unit",
      products: names.map((name) => ({ name, unitPrice: 100, suggestedProductTypeKey: null, referenceUrl: null })),
    })),
  } as ImageIntakeDraft;
}

describe("compareNaturally", () => {
  it("sorts Billy Bat, Hajime no Ippo and volume numbers in ascending natural order", () => {
    const names = [
      "Billy Bat 07",
      "Billy Bat 06",
      "Billy Bat 05",
      "Billy Bat 03",
      "Hajime no Ippo 10",
      "Hajime no Ippo 09",
      "Vol. 10",
      "Vol. 2",
    ];
    expect(names.sort(compareNaturally)).toEqual([
      "Billy Bat 03",
      "Billy Bat 05",
      "Billy Bat 06",
      "Billy Bat 07",
      "Hajime no Ippo 09",
      "Hajime no Ippo 10",
      "Vol. 2",
      "Vol. 10",
    ]);
  });

  it("ignores case and accents and preserves ties", () => {
    const names = ["Éclair 10", "éclair 2", "ECLAIR 2", "eclair 1"];
    expect(compareNaturally("éclair 2", "ECLAIR 2")).toBe(0);
    expect(names.sort(compareNaturally)).toEqual(["eclair 1", "éclair 2", "ECLAIR 2", "Éclair 10"]);
  });
});

describe("sortDraftProductsNaturally", () => {
  it("sorts products and groups by their first sorted product without mutating the draft", () => {
    const draft = draftWithNames([
      ["Hajime no Ippo 10", "Hajime no Ippo 09"],
      ["Billy Bat 07", "Billy Bat 06", "Billy Bat 05", "Billy Bat 03"],
      ["Vol. 10", "Vol. 2"],
    ]);
    const before = structuredClone(draft);
    const sorted = sortDraftProductsNaturally(draft);
    expect(sorted.groups.map((group) => group.products.map((product) => product.name))).toEqual([
      ["Billy Bat 03", "Billy Bat 05", "Billy Bat 06", "Billy Bat 07"],
      ["Hajime no Ippo 09", "Hajime no Ippo 10"],
      ["Vol. 2", "Vol. 10"],
    ]);
    expect(draft).toEqual(before);
    expect(sorted.groups[0].sourcePhrase).toBe("Source 1");
  });

  it("preserves product and group ties and retains empty groups", () => {
    const draft = draftWithNames([["Z"], ["Éclair 2", "ECLAIR 2"], ["eclair 2"], []]);
    const sorted = sortDraftProductsNaturally(draft);
    expect(sorted.groups.map((group) => group.sourcePhrase)).toEqual(["Source 3", "Source 1", "Source 2", "Source 0"]);
    expect(sorted.groups[1].products).toEqual(draft.groups[1].products);
    expect(sorted.groups[1].products[0]).toBe(draft.groups[1].products[0]);
  });
});

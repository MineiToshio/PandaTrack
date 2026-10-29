import type { ImageIntakeDraft } from "./draftSchema";

// Fix the locale so the host's language cannot change the review or saved positions.
const NATURAL_COLLATOR = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function compareNaturally(left: string, right: string): number {
  return NATURAL_COLLATOR.compare(left, right);
}

/** Returns a sorted copy; stable ties retain the extraction's relative order. */
export function sortDraftProductsNaturally(draft: ImageIntakeDraft): ImageIntakeDraft {
  const groups = draft.groups.map((group) => ({
    ...group,
    products: [...group.products].sort((left, right) => compareNaturally(left.name, right.name)),
  }));
  // Keep source groups intact: interleaving names cannot be globally sorted without flattening.
  groups.sort((left, right) => compareNaturally(left.products[0]?.name ?? "", right.products[0]?.name ?? ""));
  return { ...draft, groups };
}

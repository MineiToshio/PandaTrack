import type { ImageIntakeDraft } from "./draftSchema";

/**
 * Drops every suggested category the live catalog does not back, silently.
 *
 * This is not defensive tidiness, it is what keeps a suggestion from being able to destroy a save.
 * `OrderItem.productTypeKey` is a real foreign key onto `StoreProductType.key`, and the write path
 * validates membership before it inserts anything: one key the catalog does not have (a plausible
 * invention like "blu_rays", a type an admin has since deactivated) makes `createOrderItems` refuse,
 * and the collector loses the whole order, not the category. The exchange is entirely one-sided,
 * so an unbacked suggestion is discarded here and the collector picks the category by hand, exactly
 * as they would have if the model had suggested nothing.
 *
 * `activeProductTypeKeys` must be the keys that are present AND active, read from the catalog in the
 * same request that produced the draft: "exists" is not enough, because the write path refuses a
 * deactivated type too.
 */
export function withValidatedSuggestedCategories(
  draft: ImageIntakeDraft,
  activeProductTypeKeys: Iterable<string>,
): ImageIntakeDraft {
  const allowedKeys = new Set(activeProductTypeKeys);

  return {
    ...draft,
    groups: draft.groups.map((group) => ({
      ...group,
      products: group.products.map((product) =>
        product.suggestedProductTypeKey !== null && !allowedKeys.has(product.suggestedProductTypeKey)
          ? { ...product, suggestedProductTypeKey: null }
          : product,
      ),
    })),
  };
}

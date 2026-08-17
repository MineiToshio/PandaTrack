import type { PendingProductsByStoreGroup } from "@/lib/data/orders/pendingProductsByStoreQueries";
import { foldSearchText } from "@/lib/strings/foldSearchText";

/**
 * Free-text filter for the Orders list "Por tienda" view: a folded (case- and accent-insensitive)
 * substring match against the store name and the pending products' names. Pure and in-memory, like
 * `sortStoreGroups` and for the same reason — this view is not paginated, so the whole result set is
 * already in hand (see `getPendingProductsByStore`).
 *
 * The two match sources are not symmetric, on purpose:
 *
 * - a match on the STORE keeps the group whole. The collector named the store, so hiding the
 *   products inside it would answer a question they did not ask.
 * - a match on a PRODUCT narrows the group to the matching products, which is the entire point of
 *   typing a product name. `openOrdersCount` is recomputed from the survivors (the query's own
 *   definition: one count per order that still contributes a pending product) and the undetailed
 *   block is narrowed to the orders still represented, so it never names money on an order whose
 *   products are all filtered out.
 *
 * `debts` is deliberately untouched: the store's debt is a fact about the store, not about the
 * subset currently on screen, and a figure that shrinks because someone typed into a search box
 * would be a lie about what is owed.
 */
export function filterStoreGroups(
  groups: PendingProductsByStoreGroup[],
  rawQuery: string | undefined,
): PendingProductsByStoreGroup[] {
  const query = rawQuery ? foldSearchText(rawQuery) : "";
  if (!query) return groups;

  const filtered: PendingProductsByStoreGroup[] = [];
  for (const group of groups) {
    if (foldSearchText(group.store.name).includes(query)) {
      filtered.push(group);
      continue;
    }

    const pendingProducts = group.pendingProducts.filter((product) => foldSearchText(product.name).includes(query));
    if (pendingProducts.length === 0) continue;

    const matchedOrderIds = new Set(pendingProducts.map((product) => product.orderId));
    filtered.push({
      ...group,
      pendingProducts,
      openOrdersCount: matchedOrderIds.size,
      undetailedByOrder: group.undetailedByOrder.filter((entry) => matchedOrderIds.has(entry.orderId)),
    });
  }

  return filtered;
}

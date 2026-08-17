import type { PendingProductRow, PendingProductsByStoreGroup } from "@/lib/data/orders/pendingProductsByStoreQueries";

/**
 * Sort options for the Orders list "Por tienda" view. Two-level: products are ordered within their
 * store, then stores are ordered by an aggregate of their own products. Pure and in-memory — this
 * view is not paginated (see `getPendingProductsByStore`), so the whole result set is sorted once.
 */
export const STORE_VIEW_SORT_VALUES = [
  "arrival-asc",
  "recent",
  "oldest",
  "store-asc",
  "store-desc",
  "total-desc",
] as const;

export type StoreViewSort = (typeof STORE_VIEW_SORT_VALUES)[number];

export const DEFAULT_STORE_VIEW_SORT: StoreViewSort = "arrival-asc";

/** Falls back to the default for any unknown value, the same way `?sort=` does for the order list. */
export function parseStoreViewSort(raw: string | string[] | undefined): StoreViewSort {
  const first = Array.isArray(raw) ? raw[0] : raw;
  return (STORE_VIEW_SORT_VALUES as readonly string[]).includes(first ?? "")
    ? (first as StoreViewSort)
    : DEFAULT_STORE_VIEW_SORT;
}

const NO_ARRIVAL_DATE = Number.POSITIVE_INFINITY;

/** A product with no arrival window sorts to the end, never to the top as if it were "soonest". */
function arrivalKey(product: PendingProductRow): number {
  const date = product.expectedDeliveryTo ?? product.expectedDeliveryFrom;
  return date ? date.getTime() : NO_ARRIVAL_DATE;
}

function compareByArrivalAsc(a: PendingProductRow, b: PendingProductRow): number {
  return arrivalKey(a) - arrivalKey(b) || a.itemId.localeCompare(b.itemId);
}

function compareByOrderDate(direction: 1 | -1) {
  return (a: PendingProductRow, b: PendingProductRow): number => {
    const diff = (a.orderDate.getTime() - b.orderDate.getTime()) * direction;
    return diff !== 0 ? diff : a.itemId.localeCompare(b.itemId);
  };
}

/** Products with no derivable price sort last, never first as if they were free. */
function compareByBaseDesc(a: PendingProductRow, b: PendingProductRow): number {
  const aBase = a.basePagableMinor;
  const bBase = b.basePagableMinor;
  if (aBase == null && bBase == null) return a.itemId.localeCompare(b.itemId);
  if (aBase == null) return 1;
  if (bBase == null) return -1;
  return bBase - aBase || a.itemId.localeCompare(b.itemId);
}

function sortProductsWithin(products: PendingProductRow[], sort: StoreViewSort): PendingProductRow[] {
  const sorted = [...products];
  switch (sort) {
    case "recent":
      sorted.sort(compareByOrderDate(-1));
      return sorted;
    case "oldest":
      sorted.sort(compareByOrderDate(1));
      return sorted;
    case "total-desc":
      sorted.sort(compareByBaseDesc);
      return sorted;
    // "store-asc"/"store-desc" only reorder the stores; their products stay in arrival order.
    case "store-asc":
    case "store-desc":
    case "arrival-asc":
    default:
      sorted.sort(compareByArrivalAsc);
      return sorted;
  }
}

function groupArrivalKey(group: PendingProductsByStoreGroup): number {
  return group.pendingProducts.reduce((min, product) => Math.min(min, arrivalKey(product)), NO_ARRIVAL_DATE);
}

function groupOrderDateExtreme(group: PendingProductsByStoreGroup, direction: 1 | -1): number {
  const times = group.pendingProducts.map((product) => product.orderDate.getTime());
  return direction === 1 ? Math.min(...times) : Math.max(...times);
}

/**
 * Store ranking for `total-desc`. When a store's debt spans more than one currency there is no
 * single "biggest" figure to compare without a shared unit, so — as a documented simplification —
 * the highest `debtMinor` across the store's currencies stands in for its rank. This can rank a
 * store with a large debt in a minor currency ahead of one with a smaller debt in a strong currency.
 * Acceptable at today's near-entirely-single-currency-per-store data; revisit with a base-currency
 * conversion if multi-currency debt becomes common.
 */
function groupMaxDebtMinor(group: PendingProductsByStoreGroup): number {
  return group.debts.reduce((max, debt) => Math.max(max, debt.debtMinor), Number.NEGATIVE_INFINITY);
}

/**
 * The store ranking, with `store.id` as the tie-break that makes it total.
 *
 * `diff` is checked for FINITENESS, not only for zero: every aggregate key here can legitimately be
 * infinite (`+Infinity` for a store with no arrival window on any product, `-Infinity` for a store
 * with no debt row), and `Infinity - Infinity` is `NaN`. `Array.prototype.sort` reads a `NaN`
 * comparator as 0, which does not fall through to the tie-break — it skips it, degenerating into
 * "keep whatever order the input happened to arrive in". Two lists holding the same groups in a
 * different order (the server's payload and this view's optimistic patch) would then render them
 * differently, which is exactly what the client-side re-sort exists to prevent.
 */
function withStoreTieBreak(diff: number, a: PendingProductsByStoreGroup, b: PendingProductsByStoreGroup): number {
  return Number.isFinite(diff) && diff !== 0 ? diff : a.store.id.localeCompare(b.store.id);
}

function compareGroups(a: PendingProductsByStoreGroup, b: PendingProductsByStoreGroup, sort: StoreViewSort): number {
  switch (sort) {
    case "recent":
      return withStoreTieBreak(groupOrderDateExtreme(b, -1) - groupOrderDateExtreme(a, -1), a, b);
    case "oldest":
      return withStoreTieBreak(groupOrderDateExtreme(a, 1) - groupOrderDateExtreme(b, 1), a, b);
    case "store-asc":
      return withStoreTieBreak(a.store.name.localeCompare(b.store.name), a, b);
    case "store-desc":
      return withStoreTieBreak(b.store.name.localeCompare(a.store.name), a, b);
    case "total-desc":
      return withStoreTieBreak(groupMaxDebtMinor(b) - groupMaxDebtMinor(a), a, b);
    case "arrival-asc":
    default:
      return withStoreTieBreak(groupArrivalKey(a) - groupArrivalKey(b), a, b);
  }
}

/**
 * Two-level sort for the Orders "Por tienda" view: orders products within each store first, then
 * orders the stores themselves by an aggregate of their own (already-sorted) products.
 */
export function sortStoreGroups(
  groups: PendingProductsByStoreGroup[],
  sort: StoreViewSort,
): PendingProductsByStoreGroup[] {
  const withSortedProducts = groups.map((group) => ({
    ...group,
    pendingProducts: sortProductsWithin(group.pendingProducts, sort),
  }));
  withSortedProducts.sort((a, b) => compareGroups(a, b, sort));
  return withSortedProducts;
}

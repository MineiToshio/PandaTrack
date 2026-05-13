/**
 * Detail-route loading boundary. Without this file Next.js would fall back to the parent
 * `/orders/loading.tsx` (the list skeleton) during list → detail navigation, which is
 * misleading — we're not reloading the list, we're opening a single order.
 *
 * Returning `null` keeps the existing list rendered (via view-transition) until the detail
 * page is ready. A proper detail skeleton can replace this when the detail screen ships
 * in Part 3 (S7-B detail).
 */
export default function OrderDetailLoading() {
  return null;
}

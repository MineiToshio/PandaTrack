import { revalidatePath } from "next/cache";

/**
 * Marks every surface whose contents depend on order or delivery state, so a mutation cannot leave
 * a stale copy behind.
 *
 * Why this is needed even though the clients already call `router.refresh()`: that only "clears the
 * Client Cache **for the current route**" (Next.js `useRouter` reference). Logging an arrival from
 * an order detail therefore refreshes the detail and leaves the cached orders-list entry untouched,
 * and back/forward navigation is explicitly exempt from `staleTimes` "to prevent layout shift and
 * to prevent losing the browser scroll position". The result is a completed order that can reappear
 * in a list filtered to active ones when the collector navigates back to it.
 *
 * `revalidatePath` inside a Server Function is the documented cure: it "causes all previously
 * visited pages to refresh when navigated to again".
 *
 * Cost: every route named here is dynamically rendered (session-scoped, and the lists also read
 * search params), so there is no Full Route Cache entry to throw away. The only effect is that the
 * next navigation to one of them refetches instead of replaying a stale payload. Navigation without
 * a preceding mutation is untouched.
 *
 * Route patterns rather than locale-literal paths, so one call covers `es` and `en`.
 */
export function revalidateCollectionSurfaces(): void {
  revalidatePath("/[locale]/(app)/orders", "page");
  revalidatePath("/[locale]/(app)/orders/[id]", "page");
  revalidatePath("/[locale]/(app)/deliveries", "page");
  revalidatePath("/[locale]/(app)/deliveries/[id]", "page");
  revalidatePath("/[locale]/(app)/dashboard", "page");
}

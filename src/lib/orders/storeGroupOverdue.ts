import { resolveArrivalState } from "@/lib/arrivalWindow";
import type { ItemDeliveryState } from "@/lib/orders/orderState";

/** The three fields an arrival state is derived from, which is all this count needs. */
export type OverdueCountableProduct = {
  deliveryState: ItemDeliveryState;
  expectedDeliveryFrom: Date | null;
  expectedDeliveryTo: Date | null;
};

/**
 * How many of a store group's pending products are already late.
 *
 * Exists because the Orders "Por tienda" list now lands with every group CLOSED (`FR-05-70`), which
 * would otherwise hide the one thing the collector opens this screen for. The closed header answers
 * it instead, and answers it with exactly the same predicate the rows themselves use once the group
 * is opened: `resolveArrivalState`. Deriving it a second way here is the failure mode worth naming,
 * because the header and the rows underneath it would then be free to disagree about which products
 * are late, on the same screen, with no way for the reader to tell which one is wrong.
 *
 * `today` is the collector's civil day at UTC midnight, resolved on the SERVER from `User.timezone`
 * and threaded down, never `new Date()` here: a client clock would both mismatch the server render
 * and compare a wall-clock instant against midnight-UTC domain dates.
 */
export function countOverdueProducts(products: readonly OverdueCountableProduct[], today: Date): number {
  return products.reduce(
    (count, product) => (resolveArrivalState(product, today) === "overdue" ? count + 1 : count),
    0,
  );
}

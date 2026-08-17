"use client";

import { useTranslations } from "next-intl";
import { formatExpectedArrival, getOverdueDays, resolveArrivalState } from "@/lib/arrivalWindow";
import { resolveOrderArrivalDueDate } from "@/lib/orders/orderDerivedState";
import type { ItemDeliveryState } from "@/lib/orders/orderState";
import { cn } from "@/lib/styles";
import { describeArrivalOverdueLabel } from "./orderListStatusChip";

/**
 * Structural on purpose, and deliberately WITHOUT `deliveryState`: the row passes that separately
 * (see below), and leaving it in the object would let a caller satisfy the type with the server prop
 * without ever noticing there was a choice to make.
 */
type ArrivalMetaInput = {
  expectedDeliveryFrom: Date | null;
  expectedDeliveryTo: Date | null;
};

/**
 * The "Por tienda" row's arrival line: ONE slot of text, one typeface, one size, in every state.
 * Only its colour changes.
 *
 * It replaced a two-piece design (a `warning` pill on line 1 plus a muted window on line 2) after
 * the collector read the shipped version and said the pill was too loud and in the wrong place. The
 * fix is not a quieter pill, it is the observation underneath the request: on a row that is LATE,
 * the estimate is the least interesting thing on screen. "Esperada 26 jul" asks the reader to
 * subtract; "Atrasado 17 días" is the answer to the question they were subtracting to get. So the
 * delay does not accompany the window, it REPLACES it.
 *
 * Which leaves colour doing the one job WCAG 1.4.1 allows it: reinforcing a distinction the words
 * already make. "Atrasado" and "Esperada" are different words, so a reader who cannot see the amber
 * loses nothing. That is why this is more conformant than the chip it replaces, not less — and it
 * is also why there is no longer a `soon` state (see `resolveArrivalState`): with no chip left to
 * carry it, it would have been the same sentence as `scheduled` in a different colour, which is
 * exactly the violation the chip had been introduced to avoid.
 *
 * Shared by the desktop row and the mobile card so the two cannot drift. It lives in
 * `_components/share/` rather than `src/components/` because it knows this list's own
 * `orderListing.storeView.arrival` namespace.
 */
export function ArrivalMeta({
  product,
  deliveryState,
  today,
  locale,
  className,
}: {
  product: ArrivalMetaInput;
  /**
   * The delivery state the row is SHOWING, which is not always `product.deliveryState`: the state
   * chip on the line above owns an optimistic value that flips the moment the collector presses
   * "Marcar como listo en tienda", a whole revalidation before the server prop agrees. Passed
   * explicitly, and separately from `product`, so the choice has to be made rather than inherited —
   * handing the server prop down leaves a delay counter running over a product already on the
   * shelf, which is the exact reading `resolved` exists to prevent, produced by the row's own
   * primary control. The chip reports its ROLLBACK too, so a refused mark restores "Atrasado".
   */
  deliveryState: ItemDeliveryState;
  today: Date;
  locale: string;
  className?: string;
}) {
  const t = useTranslations("orderListing");
  const input = {
    deliveryState,
    expectedDeliveryFrom: product.expectedDeliveryFrom,
    expectedDeliveryTo: product.expectedDeliveryTo,
  };
  const state = resolveArrivalState(input, today);

  if (state === "overdue") {
    const { labelKey, labelVars } = describeArrivalOverdueLabel(
      getOverdueDays(resolveOrderArrivalDueDate(input), today),
    );
    return (
      // `--warning-chip-text`, not `--warning`. The raw status token is 2.5:1 on `--surface` in the
      // light theme — it is calibrated as a chip FILL, not as text — while this alias is the one the
      // system already created for status text and lands at 8.4:1 light / 11.3:1 dark. The name says
      // "chip" only because a chip was the first thing that needed it.
      <span className={cn("[color:var(--warning-chip-text)]", className)}>{t(labelKey, labelVars)}</span>
    );
  }

  // The row that produced this branch: a product physically at the store, on an order whose window
  // closed on 12 jun, rendering "Esperada 12 jun" three columns away from the chip that explains
  // why no delay is counted. The collector read it as a defect and asked why it was not late. The
  // suppression is right (ADR 0030 §3) and the ROW was the thing at fault: it stated a prediction
  // and said nothing about the event that answered it, so the reader had to join two facts that the
  // desktop grid puts 270px apart — and on the two rows whose window is still ahead it read as a
  // live promise ("Esperada oct") about something already on the shelf.
  //
  // So the slot stops reporting the estimate and reports what CLOSED it. The window is not
  // shortened, it is dropped: it is the order's, not the product's, it is no longer actionable once
  // the product is at the store, and keeping it would need a verb to disown it ("Ya llegó a la
  // tienda, se esperaba 20 sep – 31 oct"), which is 50 characters in a slot the mobile card pins
  // with `whitespace-nowrap`. The order's detail still holds it for anyone who wants it.
  //
  // Split by state rather than shared, because the two are not the same news and the collector acts
  // differently on them. Neither repeats its chip verbatim ("Listo en tienda" / "En camino"): the
  // chip names the STATE and is a control, this line answers the question the slot exists for
  // ("when does it get here?") in the past tense.
  if (state === "resolved") {
    return (
      <span className={cn("[color:var(--text-muted)]", className)}>
        {deliveryState === "in_transit"
          ? t("storeView.arrival.resolvedInTransit")
          : t("storeView.arrival.resolvedAtStore")}
      </span>
    );
  }

  const window = formatExpectedArrival(
    product.expectedDeliveryFrom,
    product.expectedDeliveryTo,
    locale,
    today.getUTCFullYear(),
  );

  // Only two states reach here, and both are strictly about a prediction that is still open, so the
  // slot needs one verb rather than the house pair: "Llega" while the window is ahead. "Esperada"
  // used to cover `resolved` from this list and no longer has a caller here — the answered case has
  // its own words above, and `scheduled` is future by construction (`dueDate >= today`). The
  // per-order list keeps its own `table.arrivalExpected` for a window that has passed on an order
  // still waiting, which is a different sentence on a different surface.
  const label =
    state === "noDate" || !window ? t("storeView.arrival.noDate") : t("storeView.arrival.arrives", { window });

  return <span className={cn("[color:var(--text-muted)]", className)}>{label}</span>;
}

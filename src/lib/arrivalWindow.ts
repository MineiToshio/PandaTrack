import { formatDomainDate, formatDomainShortDate } from "@/lib/domainDate";
import { resolveOrderArrivalDueDate } from "@/lib/orders/orderDerivedState";
import type { ItemDeliveryState } from "@/lib/orders/orderState";

const MS_PER_DAY = 86_400_000;

/**
 * Shared arrival-window formatting for the collector's two dense lists: deliveries (a shipment's
 * expected arrival) and orders (the order's own expected delivery). Both answer the same question
 * in the same row shape, so they render it the same way. Promoted out of `deliveries/_utils/`
 * when the orders list started showing the window too.
 */

/**
 * "2 may" — day + short month, no year (list column / mobile meta). Domain dates are
 * stored at midnight UTC, so formatting is pinned to UTC (see `src/lib/domainDate.ts`).
 */
export function formatShortDate(date: Date, locale: string): string {
  return formatDomainShortDate(date, locale);
}

/**
 * Compact expected-arrival window: "15–22 may" (same month), "25 abr – 2 may"
 * (cross-month), or a single short date when only one endpoint exists. Same-month
 * detection uses UTC getters so it matches the UTC-pinned display.
 */
export function formatArrivalWindow(from: Date | null, to: Date | null, locale: string): string | null {
  if (from && to) {
    // A window whose ends are the same day is a single promised date, not a range: image intake
    // writes both ends from one stated date ("llega el 20"), and so does a collector who picks the
    // same day twice. Rendering it as "23–23 jul" reads as a defect.
    if (from.getTime() === to.getTime()) return formatShortDate(to, locale);
    const sameMonth = from.getUTCMonth() === to.getUTCMonth() && from.getUTCFullYear() === to.getUTCFullYear();
    if (sameMonth) {
      const monthPart = formatDomainDate(to, locale, { month: "short" });
      return `${from.getUTCDate()}–${to.getUTCDate()} ${monthPart}`;
    }
    return `${formatShortDate(from, locale)} – ${formatShortDate(to, locale)}`;
  }
  const single = from ?? to;
  return single ? formatShortDate(single, locale) : null;
}

/**
 * Whole days past a due date. 0 when not overdue or when there is no due date.
 *
 * The single source for that arithmetic. It existed three times (here, in the orders list chip, and
 * in the order detail), and the third copy had already drifted to `Math.max(1, …)`, so an order due
 * TODAY read "Atrasado 1 día" there and "Atrasado" everywhere else. `src/test/overdue-formula-single-source-guard.test.ts`
 * keeps the count from growing back.
 */
export function getOverdueDays(dueDate: Date | null, today: Date): number {
  if (!dueDate) return 0;
  const diff = today.getTime() - dueDate.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / MS_PER_DAY);
}

/**
 * Delivery-shaped alias, kept because `deliveries/_utils/deliveryDates.ts` re-exports it and its
 * three consumers name the shipment's own window.
 */
export function getDeliveryOverdueDays(expectedArrivalTo: Date | null, today: Date): number {
  return getOverdueDays(expectedArrivalTo, today);
}

/**
 * From here up, lateness is stated in months instead of days. "Atrasado 228d" forces mental
 * arithmetic; "Atrasado 7 meses" does not. Below it, days stay precise enough to be read directly.
 */
export const OVERDUE_MONTHS_THRESHOLD_DAYS = 60;

/**
 * Is `d` the last calendar day of its UTC month? `Date.UTC(y, m + 1, 0)` is day zero of the next
 * month, i.e. the last day of this one — so this answers 28, 29, 30 or 31 by construction. Never
 * compare against a constant: the real data holds 5 rows in February, 21 in 30-day months and 18 in
 * 31-day ones, and a hardcoded 30 would mis-read two of the three.
 */
function isLastDayOfUtcMonth(d: Date): boolean {
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return d.getUTCDate() === lastDay;
}

function isFirstDayOfUtcMonth(d: Date): boolean {
  return d.getUTCDate() === 1;
}

/** "sep" / "sep 2027". UTC-pinned like every other domain-date rendering. */
function formatMonthPart(date: Date, locale: string, withYear: boolean): string {
  return formatDomainDate(date, locale, withYear ? { month: "short", year: "numeric" } : { month: "short" });
}

/** "12 jun" / "12 jun 2027". */
function formatDayPart(date: Date, locale: string, withYear: boolean): string {
  return withYear ? formatDomainDate(date, locale) : formatDomainShortDate(date, locale);
}

/**
 * The expected-arrival window rendered with the granularity it was actually DECLARED with.
 *
 * `formatArrivalWindow` above would paint `2026-09-01 → 2026-09-30` as "1–30 sep", which reads as a
 * day-level promise. It is not one: the order form offers "este mes" / "el próximo mes" presets that
 * write exactly those two endpoints, so a whole-month range IS the encoding of "septiembre". 48 of
 * the 62 dated rows in the collector's data are that shape. Collapsing them is not a shortening, it
 * is the removal of a precision nobody entered.
 *
 * The year is printed only when it is not `referenceYear` (the year the reader is standing in), and
 * the rule holds in every branch — including a window that CROSSES the year, where each endpoint
 * carries its own ("20 dic 2026 – 16 ene 2027"). That is why the irregular branch does not delegate
 * to `formatArrivalWindow`, which never prints a year at all.
 *
 * Returns `null` when there is no window; the caller renders its own "no estimated date" copy.
 */
export function formatExpectedArrival(
  from: Date | null,
  to: Date | null,
  locale: string,
  referenceYear: number,
): string | null {
  if (!from && !to) return null;

  const start = from ?? to;
  const end = to ?? from;
  if (!start || !end) return null;

  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  const crossesYear = startYear !== endYear;
  // One shared year that the reader is not already standing in gets printed once, at the end.
  const sharedYearShown = !crossesYear && startYear !== referenceYear;

  // A window whose ends are the same day is a single promised date, never a range.
  if (start.getTime() === end.getTime()) {
    return formatDayPart(end, locale, sharedYearShown);
  }

  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && !crossesYear;

  if (isFirstDayOfUtcMonth(start) && isLastDayOfUtcMonth(end)) {
    if (sameMonth) return formatMonthPart(end, locale, sharedYearShown);
    if (crossesYear) {
      return `${formatMonthPart(start, locale, true)} – ${formatMonthPart(end, locale, true)}`;
    }
    return `${formatMonthPart(start, locale, false)} – ${formatMonthPart(end, locale, sharedYearShown)}`;
  }

  if (sameMonth) {
    const monthPart = formatMonthPart(end, locale, sharedYearShown);
    return `${start.getUTCDate()}–${end.getUTCDate()} ${monthPart}`;
  }
  if (crossesYear) {
    return `${formatDayPart(start, locale, true)} – ${formatDayPart(end, locale, true)}`;
  }
  return `${formatDayPart(start, locale, false)} – ${formatDayPart(end, locale, sharedYearShown)}`;
}

/**
 * How a pending product's arrival reads in the "Por tienda" list.
 *
 * `resolved` is evaluated FIRST, before anything relative to `today`, and that ordering is the whole
 * point of the state: once a delivery event has been observed — the product is at the store, or it
 * has shipped — the prediction is answered and must stop being scored. Without it, a product sitting
 * on a shelf renders "Atrasado 2 meses" (a counter running on a resolved prediction) or, worse,
 * "llega sep 2026" about something that already arrived, which is not an inconsistency but a false
 * statement. Both shapes exist in the real data.
 *
 * It is NOT called `settled`: that word is already the payment vocabulary of this very list
 * ("Saldado", `storeView.settled`, ADR 0026), rendered forty lines from where this state lands.
 *
 * `resolved` does NOT depend on there being a window to resolve, and that is a correction rather
 * than a simplification. While the state still rendered the window ("Esperada 12 jun") a product
 * with no window had nothing to render, so it fell to `noDate`; now that the state says what
 * HAPPENED instead of what was predicted, the sentence is exactly as true without a window as with
 * one, and routing it to `noDate` made two products on the same shelf read differently ("Sin fecha
 * estimada" beside "Ya llegó a la tienda") for a reason the collector cannot see. Three of the
 * collector's seven at-the-store rows are dateless, so this is the majority case, not an edge.
 *
 * There is no `soon` state, and its absence is a decision rather than an omission. It existed to
 * carry a "Pronto" chip, and once the row went from a chip to a single line of text there was
 * nothing left to distinguish it from `scheduled`: both say "Llega {ventana}", so the only possible
 * difference was colour, which is precisely what WCAG 1.4.1 forbids and what the chip had been
 * introduced to avoid. The window itself already answers "are we close": "Llega sep" read in
 * September IS the proximity, at a finer resolution than a badge, and the list's default
 * `arrival-asc` sort puts the nearest rows first anyway.
 *
 * `delivered` resolves too, for the same reason `arrived_at_store` and `in_transit` do: it is an
 * event further along the same chain, not a different question. This list's own query filters
 * `delivered` items out before this function ever sees one (`pendingProductsByStoreQueries.ts`), and
 * the optimistic toggle that is this function's other caller only ever produces `open` or
 * `arrived_at_store` — so the branch below has no live row today. It is still declared, not left to
 * the `else`, because `isOrderArrivalObserved` (the order-level counterpart this function documents
 * itself as matching, ADR 0030 §3.2) already treats `delivered` as observed; leaving it out here
 * would make the two "the same rule" in prose while disagreeing on this one input.
 */
export function resolveArrivalState(
  input: {
    deliveryState: ItemDeliveryState;
    expectedDeliveryFrom: Date | null;
    expectedDeliveryTo: Date | null;
  },
  today: Date,
): "resolved" | "overdue" | "scheduled" | "noDate" {
  const dueDate = resolveOrderArrivalDueDate({
    expectedDeliveryFrom: input.expectedDeliveryFrom,
    expectedDeliveryTo: input.expectedDeliveryTo,
  });

  if (
    input.deliveryState === "arrived_at_store" ||
    input.deliveryState === "in_transit" ||
    input.deliveryState === "delivered"
  ) {
    return "resolved";
  }

  if (!dueDate) return "noDate";
  if (dueDate < today) return "overdue";
  return "scheduled";
}

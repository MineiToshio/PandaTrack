import { needsFxReconciliation, type FxContext } from "@/lib/fx/reconciliation";
import { calculatePaymentSummary } from "@/lib/orders/paymentSummary";
import { OrderItemDeliveryState, type DeliveryStatus, type OrderStatus } from "../../../../generated/prisma/client";
import type { BaseCurrencyTotal } from "./dashboardTypes";

/**
 * Base-currency money helpers for the dashboard.
 *
 * The stored `Order.exchangeRate` is the rate from the order currency to the base currency:
 * "how many base-currency units equal 1 order-currency unit" (order form copy). Base-currency
 * conversion is therefore `amountMinor * exchangeRate`, rounded to whole minor units.
 */

/**
 * Converts an order-currency minor amount to base-currency minor units.
 * Returns null exactly when `needsFxReconciliation` says the row has no usable rate for this base,
 * so a figure is never quietly computed from a rate that belongs to a different base currency.
 */
export function convertToBaseCurrencyMinor(
  amountMinor: number,
  context: FxContext,
  baseCurrencyCode: string,
): number | null {
  if (context.currencyCode === baseCurrencyCode) {
    return amountMinor;
  }
  if (needsFxReconciliation(context, baseCurrencyCode)) {
    return null;
  }
  return Math.round(amountMinor * (context.exchangeRate as number));
}

/** An amount denominated in a specific order currency, carrying that order's FX context. */
export type RollupItem = FxContext & {
  amountMinor: number;
};

/**
 * Sums order-currency amounts into a base-currency total, excluding every row that cannot be
 * converted and reporting how many were excluded. The exclusion test is the same
 * `needsFxReconciliation` the orders list filters on, so the banner's count and the rows the
 * collector can act on are the same set by construction, not by coincidence.
 * A null base currency yields a zeroed, non-partial total (the collector must configure one first).
 */
export function rollUpToBaseCurrency(items: RollupItem[], baseCurrencyCode: string | null): BaseCurrencyTotal {
  if (!baseCurrencyCode) {
    return { totalMinor: 0, isPartial: false, excludedOrderCount: 0 };
  }

  let totalMinor = 0;
  let excludedOrderCount = 0;
  let isPartial = false;

  for (const item of items) {
    const converted = convertToBaseCurrencyMinor(item.amountMinor, item, baseCurrencyCode);
    if (converted === null) {
      excludedOrderCount += 1;
      isPartial = true;
      continue;
    }
    totalMinor += converted;
  }

  return { totalMinor, isPartial, excludedOrderCount };
}

/**
 * Outstanding balance of an order in its own currency: `totalCost − Σ payments`, clamped at 0.
 * Reuses the order-domain payment summary so balance math stays in one place; the
 * summary already clamps the remaining amount at 0, so no extra clamp is needed here.
 */
export function computeOutstandingMinor(totalCost: number, payments: Array<{ amount: number }>): number {
  return calculatePaymentSummary(totalCost, payments).remainingAmount;
}

/** Total paid on an order in its own currency: `Σ payments`. */
export function computePaidMinor(payments: Array<{ amount: number }>): number {
  return calculatePaymentSummary(0, payments).paidAmount;
}

/**
 * An order counts as "arrived" once any of its items has left the `NONE` delivery state:
 * the store has received it, independent of physical delivery to the collector.
 */
export function hasOrderArrived(items: Array<{ deliveryState: OrderItemDeliveryState }>): boolean {
  return items.some((item) => item.deliveryState !== OrderItemDeliveryState.NONE);
}

/** Orders in `CANCELLED` status are excluded from every dashboard rollup. */
export function isCancelled(status: OrderStatus): boolean {
  return status === "CANCELLED";
}

/** Deliveries in `CANCELLED` status are excluded from the spend rollup (`BR-06-04`). */
export function isCancelledDelivery(status: DeliveryStatus): boolean {
  return status === "CANCELLED";
}

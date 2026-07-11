import { calculatePaymentSummary } from "@/lib/orders/paymentSummary";
import { OrderItemDeliveryState, type DeliveryStatus, type OrderStatus } from "../../../../generated/prisma/client";
import type { BaseCurrencyTotal, DashboardOrderInput } from "./dashboardTypes";

/**
 * Base-currency money helpers for the dashboard.
 *
 * The stored `Order.exchangeRate` is the rate from the order currency to the base currency:
 * "how many base-currency units equal 1 order-currency unit" (order form copy). Base-currency
 * conversion is therefore `amountMinor * exchangeRate`, rounded to whole minor units.
 */

/**
 * Converts an order-currency minor amount to base-currency minor units.
 * Returns null when conversion is impossible (foreign currency with no usable rate).
 */
export function convertToBaseCurrencyMinor(
  amountMinor: number,
  orderCurrencyCode: string,
  exchangeRate: number | null,
  baseCurrencyCode: string,
): number | null {
  if (orderCurrencyCode === baseCurrencyCode) {
    return amountMinor;
  }
  if (exchangeRate === null || exchangeRate <= 0) {
    return null;
  }
  return Math.round(amountMinor * exchangeRate);
}

/** True when an order must be excluded from single-currency base totals. */
export function isFxPending(
  order: Pick<DashboardOrderInput, "currencyCode" | "needsExchangeRateUpdate">,
  baseCurrencyCode: string,
): boolean {
  return order.needsExchangeRateUpdate && order.currencyCode !== baseCurrencyCode;
}

/** An amount denominated in a specific order currency, carrying that order's FX context. */
export type RollupItem = {
  amountMinor: number;
  currencyCode: string;
  exchangeRate: number | null;
  needsExchangeRateUpdate: boolean;
};

/**
 * Sums order-currency amounts into a base-currency total, excluding FX-unreconciled orders and
 * any order whose currency cannot be converted, and reporting how many were excluded.
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
    if (isFxPending(item, baseCurrencyCode)) {
      excludedOrderCount += 1;
      isPartial = true;
      continue;
    }
    const converted = convertToBaseCurrencyMinor(
      item.amountMinor,
      item.currencyCode,
      item.exchangeRate,
      baseCurrencyCode,
    );
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

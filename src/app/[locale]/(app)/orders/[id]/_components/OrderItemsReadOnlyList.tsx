import { Box, Truck } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/styles";
import { ROUTES } from "@/lib/constants";
import { formatAmountSymbolOnly } from "@/lib/currency";
import { getStoreProductTypeIcon } from "@/lib/catalog/storeProductTypeIcons";
import type { OrderItemWithDeliveryState } from "@/lib/data/orders/orderQueries";
import { offersPaidMark, resolveProductPaymentState } from "@/lib/orders/productPaymentState";
import OrderItemPaidMark from "./OrderItemPaidMark";
import OrderItemStatePill from "./OrderItemStatePill";

type OrderItemsReadOnlyListProps = {
  orderId: string;
  items: OrderItemWithDeliveryState[];
  currencyCode: string;
  locale: string;
  isOrderCancelled: boolean;
  showCreateDeliveryLink: boolean;
  /** This order's own total, so a product can be resolved against its order's balance. */
  totalCost: number;
  allocatedAmountMinor: number;
  /**
   * Money on this order that names no product. This list draws no ratio, so it changes nothing
   * here; it is required because `resolveProductPaymentState` refuses to answer without it, and
   * that refusal is the point: the two "Por tienda" surfaces DO draw a ratio and must not draw one
   * while this is above zero.
   */
  undetailedPaidMinor: number;
  className?: string;
};

/**
 * Item list of the order detail. Layout mirrors demo `.item-row`:
 *
 *     [icon 32×32]  Name           ×qty   $price
 *                   state-pill
 *
 * The state pill itself is the toggle (`<OrderItemStatePill>`) — no extra "Marcar como listo"
 * copy in the row. Pill is read-only when the item is locked by an active delivery or by a
 * cancelled order; otherwise tapping it flips `NONE ↔ ARRIVED_AT_STORE` with optimistic update.
 *
 * The list is otherwise read-only: the only interactive control is that pill, so the rows render
 * on the server and the component holds no client boundary of its own. Changing which products an
 * order has is order edit's job, reachable from the header action.
 */
export default async function OrderItemsReadOnlyList({
  orderId,
  items,
  currencyCode,
  locale,
  isOrderCancelled,
  showCreateDeliveryLink,
  totalCost,
  allocatedAmountMinor,
  undetailedPaidMinor,
  className,
}: OrderItemsReadOnlyListProps) {
  const t = await getTranslations({ locale, namespace: "orders" });

  return (
    <div className={cn("space-y-3", className)}>
      {items.length === 0 ? (
        <div className="border-warning/30 bg-warning/10 text-warning flex items-start gap-2 rounded-xl border p-4 text-sm">
          <Box className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {t("detail.items.emptyWarning")}{" "}
            <Link href={`/${locale}${ROUTES.orders}/${orderId}/edit`} className="underline underline-offset-2">
              {t("detail.items.emptyWarningCta")}
            </Link>
          </span>
        </div>
      ) : (
        <ul className="list-none" role="list">
          {items.map((item) => {
            const Icon = item.productTypeKey ? getStoreProductTypeIcon(item.productTypeKey) : Box;
            const itemTotal = item.unitPrice != null ? item.quantity * item.unitPrice : null;
            const lockedByDelivery = item.deliveryState === "in_transit" || item.deliveryState === "delivered";
            // Proven either by the order's own balance (case 0: nothing is owed at all) or by this
            // item's own allocations covering its own price base (case 1). A mark outranked by
            // either case still exists and stays visible; this only decides whether the control
            // still offers it.
            const paymentState = resolveProductPaymentState({
              basePagableMinor: item.basePagableMinor,
              allocatedMinor: item.allocatedMinor,
              paidDeclared: item.paidDeclared,
              orderTotalCost: totalCost,
              orderAllocatedAmountMinor: allocatedAmountMinor,
              orderHasUndetailedMoney: undetailedPaidMinor > 0,
            });
            // Where the exact number is known, the number is the answer and the mark is not offered
            // — the same rule the store payment sheet already applied, now shared by both surfaces.
            const canOfferMark = offersPaidMark({
              basePagableMinor: item.basePagableMinor,
              allocatedMinor: item.allocatedMinor,
              paidDeclared: item.paidDeclared,
              locked: isOrderCancelled,
            });

            return (
              <li key={item.id} className="border-border flex items-center gap-3 border-b py-2.5 last:border-b-0">
                {/* Demo `.item-icon`: 32×32 · rounded-lg · surface-elevated bg · border · accent-cool icon */}
                <div
                  className="border-border bg-surface-elevated flex size-8 shrink-0 items-center justify-center rounded-lg border"
                  style={{ color: "var(--accent-cool)" }}
                >
                  <Icon className="size-4" aria-hidden />
                </div>

                {/* Demo `.item-name` (14px) + `small` (block 12px text-muted, mt:2px) */}
                <div className="min-w-0 flex-1">
                  <span className="text-text-title block text-[14px] leading-snug">{item.name}</span>
                  {/* Delivery state and payment coverage are different axes, so they sit side by
                      side and neither hides the other. Under 640px they stack rather than compete
                      with the price column on the right. */}
                  <span className="mt-0.5 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                    <OrderItemStatePill
                      orderId={orderId}
                      itemId={item.id}
                      initialState={item.deliveryState}
                      lockedByDelivery={lockedByDelivery}
                      lockedByCancellation={isOrderCancelled}
                    />
                    {/* No price base but money against it: state the amount and no ratio. There is
                        no denominator here, so there is no percentage and no bar to draw. */}
                    {paymentState === "unpriced-partial" && (
                      <span className="text-text-secondary text-[11px] tabular-nums">
                        {t("detail.payments.unpricedPartial", {
                          amount: formatAmountSymbolOnly(item.allocatedMinor, currencyCode, locale),
                        })}
                      </span>
                    )}
                    {/* Priced, but its order also holds money that names no product, so this
                        product's own share is a FLOOR and no ratio built on it is honest (ADR 0028
                        §6). Same answer and the same copy key the two "Por tienda" surfaces already
                        give this state: the figure, and nothing to divide it by. Without this
                        branch the third surface printed nothing at all about a product that does
                        carry declared money, which is worse than the ratio the rule suppresses. */}
                    {paymentState === "partial-undetailed" && (
                      <span className="text-text-secondary text-[11px] tabular-nums">
                        {t("detail.payments.declaredAgainst", {
                          amount: formatAmountSymbolOnly(item.allocatedMinor, currencyCode, locale),
                        })}
                      </span>
                    )}
                    <OrderItemPaidMark
                      orderId={orderId}
                      itemId={item.id}
                      itemName={item.name}
                      initialDeclared={item.paidDeclared}
                      proven={paymentState === "proven"}
                      offersMark={canOfferMark}
                      locked={isOrderCancelled}
                    />
                  </span>
                </div>

                {/* Demo `.item-qty` (12px mono muted, mr:8px) + `.item-price` (14px 500) */}
                <span className="text-text-muted mr-2 font-mono text-[12px] tabular-nums">×{item.quantity}</span>
                {itemTotal != null ? (
                  <span className="text-text-title text-[14px] font-medium tabular-nums">
                    {formatAmountSymbolOnly(itemTotal, currencyCode, locale)}
                  </span>
                ) : item.unitPrice != null ? (
                  <span className="text-text-muted text-[14px] font-medium tabular-nums">
                    {formatAmountSymbolOnly(item.unitPrice, currencyCode, locale)}
                  </span>
                ) : (
                  // No unit price recorded — keep the column to preserve row alignment.
                  <span className="text-text-muted text-[14px] font-medium tabular-nums" aria-hidden>
                    —
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showCreateDeliveryLink && items.length > 0 && (
        <div className="pt-3">
          <Link
            href={`/${locale}${ROUTES.deliveriesNew}?sourceOrderId=${orderId}`}
            className="text-accent inline-flex items-center gap-1.5 text-[13px] font-medium underline-offset-2 hover:underline"
          >
            <Truck className="size-3.5" aria-hidden />
            {t("detail.items.createDeliveryWithProducts")}
          </Link>
        </div>
      )}
    </div>
  );
}

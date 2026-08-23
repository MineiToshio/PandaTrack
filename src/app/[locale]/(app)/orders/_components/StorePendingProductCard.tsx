"use client";

import { ArrowUpRight, CheckCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import Chip from "@/components/core/Chip";
import ViewTransitionLink from "@/components/core/ViewTransitionLink";
import { formatAmountSymbolOnly, formatAmountWithSymbol } from "@/lib/currency";
import { calculatePaymentSummary } from "@/lib/orders/paymentSummary";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import { isItemEligibleForDelivery, type ItemDeliveryState } from "@/lib/orders/orderState";
import { offersPaidMark, rendersPaidMark, resolveProductPaymentState } from "@/lib/orders/productPaymentState";
import type { PendingProductRow } from "@/lib/data/orders/pendingProductsByStoreQueries";
import { ArrivalMeta } from "./share/ArrivalMeta";
import OrderItemStateChip from "./share/OrderItemStateChip";
import PaidMarkControl from "./share/PaidMarkControl";
import type { PaidDeclarationFailure } from "./share/useOrderItemPaidDeclaration";
import PendingProductSelectToggle from "./PendingProductSelectToggle";

type StorePendingProductCardProps = {
  product: PendingProductRow;
  locale: string;
  returnTo: string;
  /**
   * Touch has no hover to reveal a control with, so the tile only exists once the group's own
   * "Seleccionar" strip has been pressed.
   */
  isSelectable: boolean;
  isSelected: boolean;
  isFlaggedIneligible: boolean;
  /** The collector's civil day at UTC midnight, computed on the SERVER. See the desktop row's note. */
  today: Date;
  /** True when this store group holds more than one currency, which is the only case the code earns. */
  showCurrencyCode: boolean;
  onToggleSelect: (itemId: string, shiftKey: boolean) => void;
  onPaidMarkError: (failure: PaidDeclarationFailure) => void;
};

/**
 * Mobile row for one pending product inside a store group.
 *
 * The anatomy is Material's leading / content / trailing, and every part of it was measured at 375px
 * against the collector's own 66 products before it was drawn:
 *
 * - **The name may take two lines** (`line-clamp-2`). It is the row's whole identity and it used to
 *   be truncated on 43 of the 66 rows: the longest needs 505px and one line here is 275. Two lines
 *   are 550, so almost every name lands whole, and the ones that do not now lose their tail rather
 *   than their middle. This is the wrap-when-the-text-is-the-decision case, against
 *   truncate-when-it-is-secondary; line 2 below is the secondary half and still truncates.
 * - **Line 2 is two fixed slots**, money left and arrival right, never a wrapping run of three or
 *   four things. Widest real pairing measures 238px of the 275 available, so it cannot wrap.
 * - **The state chip is the trailing slot**, top-aligned, and no longer sits inside line 1. It was
 *   competing with the name for the row's most valuable line while carrying, on 61 of 67 rows, the
 *   one value this list is entirely about.
 *
 * The `gap-4` before the trailing slot is load-bearing, not spacing taste: `OrderItemStateChip`
 * buys its 44px target with `after:[inset:-13px]` around an 18px box, so anything under 13px of
 * clearance would put that invisible band on top of the product link's own hit area, and the chip,
 * being later in the DOM, would win it (`interface-patterns.md` §12).
 */
export default function StorePendingProductCard({
  product,
  locale,
  returnTo,
  isSelectable,
  isSelected,
  isFlaggedIneligible,
  today,
  showCurrencyCode,
  onToggleSelect,
  onPaidMarkError,
}: StorePendingProductCardProps) {
  const t = useTranslations("orderListing");
  // One string only, and deliberately the SAME one the order detail renders for this state.
  const tOrders = useTranslations("orders");
  // The state this card is CURRENTLY showing, reported by the chip that owns the optimistic toggle.
  const [liveDeliveryState, setLiveDeliveryState] = useState<ItemDeliveryState>(product.deliveryState);
  const orderHref = `/${locale}${ROUTES.orders}/${product.orderId}?returnTo=${encodeURIComponent(returnTo)}`;
  const base = product.basePagableMinor;
  const money = (amountMinor: number) =>
    showCurrencyCode
      ? formatAmountWithSymbol(amountMinor, product.currencyCode, locale)
      : formatAmountSymbolOnly(amountMinor, product.currencyCode, locale);
  const paidRatio =
    base != null && product.allocatedMinor > 0
      ? calculatePaymentSummary(base, [{ amount: product.allocatedMinor }])
      : null;
  const paymentState = resolveProductPaymentState({
    basePagableMinor: base,
    allocatedMinor: product.allocatedMinor,
    paidDeclared: product.paidDeclared,
    orderTotalCost: product.orderTotalCost,
    orderAllocatedAmountMinor: product.orderAllocatedAmountMinor,
    orderHasUndetailedMoney: product.orderHasUndetailedMoney,
  });
  // Availability is decided on the RAW input, never on `paymentState`: a marked product resolves to
  // `"declared"` whether or not it has a price, so a check on the resolved state would trap the mark.
  const markAvailability = {
    basePagableMinor: base,
    allocatedMinor: product.allocatedMinor,
    paidDeclared: product.paidDeclared,
    locked: false,
  };

  return (
    <li
      className={cn(
        "flex items-start gap-4 py-2.5 [border-bottom:1px_solid_var(--border)] last:border-b-0",
        isSelected && "state-selected",
      )}
    >
      {isSelectable && (
        <PendingProductSelectToggle
          itemId={product.itemId}
          label={t("storeView.selection.itemAriaLabel", { name: product.name })}
          checked={isSelected}
          selectable={isItemEligibleForDelivery(product.deliveryState)}
          disabledReason={t("storeView.selection.notSelectable")}
          armed
          variant="card"
          onToggle={onToggleSelect}
        />
      )}

      <div className="flex min-w-0 grow flex-col gap-1">
        {/* Line 1: the name, up to two lines, and nothing else competing for it. */}
        <p className="min-w-0 [font-size:var(--text-body)] [color:var(--text-primary)]">
          <ViewTransitionLink
            href={orderHref}
            viewTransitionEntity="order"
            // `[display:-webkit-box]` is THE display here and must stay the only one: a stray `block`
            // beside it silently wins on source order and takes the clamp with it, which renders as
            // names running to three and four lines with nothing in the class list looking wrong.
            // Guarded in the card's test rather than left to review.
            //
            // A clamped box, not an `inline-flex` that truncates. The hit area
            // still needs the `::before` for the one-line case (22px of text is under the touch
            // floor); with two lines the box is already 44px and the pseudo only adds clearance.
            // The expansion stays vertical and asymmetric, sized to the space that actually exists:
            // 10px of the row's own top padding above, the 4px inter-line gap below, and it stops
            // there because line 2 carries its own controls directly underneath.
            className="relative [display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2] before:absolute before:[inset:-10px_0_-4px] before:content-[''] hover:[color:var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]"
          >
            {product.name}
            <ArrowUpRight width={10} height={10} className="ml-1 inline shrink-0 align-baseline" aria-hidden />
          </ViewTransitionLink>
          {isFlaggedIneligible && (
            <Chip variant="warning" size="sm" className="mt-1">
              {t("storeView.selection.ineligibleRow")}
            </Chip>
          )}
        </p>

        {/* Line 2: money left, arrival right. Two slots, always the same two, never a wrap. */}
        <div className="flex min-w-0 items-center justify-between gap-2.5 [font-size:var(--text-caption)] [color:var(--text-secondary)] tabular-nums">
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {base == null ? (
              <ViewTransitionLink
                href={orderHref}
                viewTransitionEntity="order"
                className="[color:var(--accent)] underline-offset-4 hover:underline"
              >
                {t("storeView.addPrice")}
              </ViewTransitionLink>
            ) : paymentState === "partial" && paidRatio ? (
              // One string rather than price + gap + percentage: "24% pagado" is 79px of a 275px
              // line, and the word repeats on every priced row. The figure keeps the precision a
              // 34px bar could not carry anyway.
              <span className="truncate">
                {t("storeView.priceWithPaidPercent", {
                  price: money(base),
                  pct: paidRatio.paymentPercentage,
                })}
              </span>
            ) : (
              <span className="truncate">{money(base)}</span>
            )}

            {paymentState === "proven" && (
              <Chip variant="success" size="sm" icon={<CheckCircle width={11} height={11} aria-hidden />}>
                {t("storeView.settled")}
              </Chip>
            )}
            {/* Money against a product with no price: the figure, never a ratio. */}
            {paymentState === "unpriced-partial" && (
              <span className="truncate">
                {tOrders("detail.payments.unpricedPartial", { amount: money(product.allocatedMinor) })}
              </span>
            )}
            {/* Priced, but its order also holds money that names no product, so this product's own
                share is a floor: the figure, and no percentage to state it as. */}
            {paymentState === "partial-undetailed" && (
              <span className="truncate">
                {tOrders("detail.payments.declaredAgainst", { amount: money(product.allocatedMinor) })}
              </span>
            )}
            {/* Touch has no hover, so the control is simply present. `proven` is excluded here and
                not inside `rendersPaidMark`: the predicate answers "is there a number for this
                product", while case 0 is the ORDER's arithmetic, and in this list the proven fact is
                the whole answer. */}
            {paymentState !== "proven" && rendersPaidMark(markAvailability) && (
              <PaidMarkControl
                orderId={product.orderId}
                itemId={product.itemId}
                itemName={product.name}
                initialDeclared={product.paidDeclared}
                proven={false}
                offersMark={offersPaidMark(markAvailability)}
                size="sm"
                onError={onPaidMarkError}
              />
            )}
          </span>

          {/* The one piece of line 2 that must not wrap. An overdue row is the CHEAPEST case here,
              not the most expensive: "Atrasado 17 días" replaces "Llega 20 sep a 31 oct" rather
              than joining it, so the widest string this slot can hold is a future irregular window. */}
          <ArrivalMeta
            product={product}
            deliveryState={liveDeliveryState}
            today={today}
            locale={locale}
            className="shrink-0 whitespace-nowrap"
          />
        </div>
      </div>

      {/* Trailing slot. It steps aside entirely while selecting: marking one product at a time and
          marking several at once are the same decision, and offering both on one row is what made
          this row crowded in the first place. The row's height does not change either way. */}
      {!isSelectable && (
        <span className="shrink-0 pt-0.5">
          <OrderItemStateChip
            orderId={product.orderId}
            itemId={product.itemId}
            initialState={product.deliveryState}
            lockedByCancellation={false}
            // This card only ever renders below `lg` and it is a list of PENDING products, so
            // "Pendiente en tienda" is the value 61 of 67 rows carry. Below `md` those rows keep
            // the control and drop the words; "Listo en tienda", the state worth scanning for,
            // keeps them.
            labelDisplay="exceptional"
            onStateChange={setLiveDeliveryState}
          />
        </span>
      )}
    </li>
  );
}

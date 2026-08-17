"use client";

import { ArrowUpRight, CheckCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import Chip from "@/components/core/Chip";
import ViewTransitionLink from "@/components/core/ViewTransitionLink";
import { formatAmountWithSymbol } from "@/lib/currency";
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
   * "Seleccionar" strip has been pressed. Off, the card is byte-for-byte what it always was.
   */
  isSelectable: boolean;
  isSelected: boolean;
  isFlaggedIneligible: boolean;
  /** The collector's civil day at UTC midnight, computed on the SERVER. See the row's own note. */
  today: Date;
  onToggleSelect: (itemId: string, shiftKey: boolean) => void;
  onPaidMarkError: (failure: PaidDeclarationFailure) => void;
};

/** Mobile two-line row for one pending product, inside a collapsible store group card. */
export default function StorePendingProductCard({
  product,
  locale,
  returnTo,
  isSelectable,
  isSelected,
  isFlaggedIneligible,
  today,
  onToggleSelect,
  onPaidMarkError,
}: StorePendingProductCardProps) {
  const t = useTranslations("orderListing");
  // One string only, and deliberately the SAME one the order detail renders for this state.
  const tOrders = useTranslations("orders");
  // The state this card is CURRENTLY showing, reported by the chip that owns the optimistic toggle.
  // See the desktop row's note: without it the delay chip keeps counting on a product the collector
  // has just marked as waiting at the store.
  const [liveDeliveryState, setLiveDeliveryState] = useState<ItemDeliveryState>(product.deliveryState);
  const orderHref = `/${locale}${ROUTES.orders}/${product.orderId}?returnTo=${encodeURIComponent(returnTo)}`;
  const base = product.basePagableMinor;
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
        "py-2.5 [border-bottom:1px_solid_var(--border)] last:border-b-0",
        isSelectable && "flex items-center gap-3",
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
        {/* Line 1: name (the order link) + the ineligible flag, if any + delivery state. The
            arrival state is not a pill and never lands here; it is line 2's text. */}
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 [font-size:var(--text-body)] [color:var(--text-primary)]">
            <ViewTransitionLink
              href={orderHref}
              viewTransitionEntity="order"
              // The order link moved here from the order date on line 2, which was this card's only
              // route into the order and is now replaced by the arrival window. The name is the
              // primary identifier, the natural destination, and on touch a far bigger target than
              // a caption-sized date was. It is NOT inside the select toggle's `<label>` (that
              // wraps only the `sr-only` input and three `aria-hidden` spans), so the checkbox
              // markup is untouched.
              //
              // The hit area is grown with a `::before` rather than with height, because the row's
              // density is the point of this list (the state chip beside it makes the same trade).
              // The expansion is VERTICAL ONLY and asymmetric, sized to the clearance that actually
              // exists: 10px of the card's own top padding above, and the 4px inter-line gap below.
              // It stops there because line 2 carries its own controls (the paid mark, "Añadir
              // precio") directly underneath, and overlapping their hit areas trades one defect for
              // a worse one. The link is an `inline-flex` one line of `--text-body` tall (line
              // height 1.375rem = 22px), so 22 + 10 + 4 lands the target at 36px, not 44 — see the
              // note in `docs/design/interface-patterns.md` §12 about measuring it by hand.
              className="relative inline-flex min-w-0 items-center gap-1 before:absolute before:[inset:-10px_0_-4px] before:content-[''] hover:[color:var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]"
            >
              <span className="min-w-0 truncate">{product.name}</span>
              <ArrowUpRight width={10} height={10} className="shrink-0" aria-hidden />
            </ViewTransitionLink>
            {isFlaggedIneligible && (
              <Chip variant="warning" size="sm">
                {t("storeView.selection.ineligibleRow")}
              </Chip>
            )}
          </p>
          {/* The chip is a pill with a background, so letting flex squeeze it wraps the PILL into a
              two- or three-line blob instead of shortening its text: 54 of 67 rows at 375px and 63
              of 67 at 320px, with row heights ranging 66-135px. Pinned here rather than inside the
              chip because the fix depends on there being something else on the line that can give
              up the width, and here there is: the product name truncates. `white-space` inherits,
              so it reaches the pill's text from this wrapper. */}
          <span className="shrink-0 whitespace-nowrap">
            <OrderItemStateChip
              orderId={product.orderId}
              itemId={product.itemId}
              initialState={product.deliveryState}
              lockedByCancellation={false}
              // This card only ever renders below `lg` (its container is `lg:hidden`) and it is a
              // list of PENDING products, so "Pendiente en tienda" is the value 61 of 67 rows
              // carry. Below `md` those rows keep the control and drop the words; "Listo en
              // tienda" — the state worth scanning for — keeps them.
              labelDisplay="exceptional"
              onStateChange={setLiveDeliveryState}
            />
          </span>
        </div>
        {/* Line 2: price/payment + order link */}
        <div className="flex min-w-0 items-center justify-between gap-2 [font-size:var(--text-caption)] [color:var(--text-secondary)] tabular-nums">
          <div className="flex min-w-0 items-center gap-1.5">
            {base != null ? (
              <span>{formatAmountWithSymbol(base, product.currencyCode, locale)}</span>
            ) : (
              <ViewTransitionLink
                href={orderHref}
                viewTransitionEntity="order"
                className="[color:var(--accent)] underline-offset-4 hover:underline"
              >
                {t("storeView.addPrice")}
              </ViewTransitionLink>
            )}
            {paymentState === "proven" && (
              <Chip variant="success" size="sm" icon={<CheckCircle width={11} height={11} aria-hidden />}>
                {t("storeView.settled")}
              </Chip>
            )}
            {paymentState === "partial" && paidRatio && (
              <span>{t("card.paymentPercentage", { pct: paidRatio.paymentPercentage })}</span>
            )}
            {/* Money against a product with no price: the figure, never a ratio. */}
            {paymentState === "unpriced-partial" && (
              <span>
                {tOrders("detail.payments.unpricedPartial", {
                  amount: formatAmountWithSymbol(product.allocatedMinor, product.currencyCode, locale),
                })}
              </span>
            )}
            {/* Priced, but its order also holds money that names no product, so this product's own
                share is a floor: the figure, and no percentage to state it as. */}
            {paymentState === "partial-undetailed" && (
              <span>
                {tOrders("detail.payments.declaredAgainst", {
                  amount: formatAmountWithSymbol(product.allocatedMinor, product.currencyCode, locale),
                })}
              </span>
            )}
            {/* Touch has no hover, so the control is simply present: it takes the slot where the
                percentage or nothing at all used to sit, on the same line as the order link.
                `proven` is excluded here and not inside `rendersPaidMark`: the predicate answers
                "is there a number for this product", while case 0 is the ORDER's arithmetic, and in
                this list the proven fact is the whole answer (the detail is the audit surface that
                keeps such a mark visible and reversible). */}
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
          </div>
          {/* Exactly where the order-date link used to sit, and pinned the same way: it is the one
              piece of line 2 that must not wrap. An overdue row is the CHEAPEST case here, not the
              most expensive: "Atrasado 17 días" replaces "Esperada 20 sep – 31 oct" rather than
              joining it, so the widest string this slot can hold is a future irregular window. */}
          <ArrivalMeta
            product={product}
            deliveryState={liveDeliveryState}
            today={today}
            locale={locale}
            className="shrink-0 whitespace-nowrap"
          />
        </div>
      </div>
    </li>
  );
}

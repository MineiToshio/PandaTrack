"use client";

import { ArrowUpRight, CheckCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import Chip from "@/components/core/Chip";
import ProgressBar from "@/components/core/ProgressBar";
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

/** Desktop grid: Producto (flexible) | Precio | Estado | Pagado. Shared with the header row. */
export const STORE_PRODUCT_ROW_GRID = "[grid-template-columns:minmax(0,1fr)_120px_150px_140px]";

/**
 * The tile's box and the gap that follows it, reused verbatim by the column-header strip so its
 * master checkbox indents by exactly the same amount and "Producto" keeps sitting over the names.
 */
export const STORE_PRODUCT_TILE_BOX = "h-8 w-8";
export const STORE_PRODUCT_TILE_GAP = "gap-2.5";

type StorePendingProductRowProps = {
  product: PendingProductRow;
  locale: string;
  returnTo: string;
  isSelected: boolean;
  /** True once the group has a live selection: the tiles stop waiting for hover. */
  isArmed: boolean;
  /** Server said this product was no longer eligible when the last batch was refused. */
  isFlaggedIneligible: boolean;
  /**
   * The collector's civil day at UTC midnight, computed on the SERVER from their timezone. Never
   * derived here: a client-side `new Date()` would disagree with the server render (hydration) and
   * would carry a wall-clock time into a comparison against midnight-UTC domain dates.
   */
  today: Date;
  onToggleSelect: (itemId: string, shiftKey: boolean) => void;
  onPaidMarkError: (failure: PaidDeclarationFailure) => void;
};

export default function StorePendingProductRow({
  product,
  locale,
  returnTo,
  isSelected,
  isArmed,
  isFlaggedIneligible,
  today,
  onToggleSelect,
  onPaidMarkError,
}: StorePendingProductRowProps) {
  const t = useTranslations("orderListing");
  // One string only, and deliberately the SAME one the order detail renders for this state, so a
  // product with money and no price reads identically on both surfaces.
  const tOrders = useTranslations("orders");
  // The delivery state the row is CURRENTLY showing, which is the chip's optimistic one and not the
  // server prop: pressing "Marcar como listo en tienda" answers the arrival prediction on the spot,
  // and until the page revalidates `product.deliveryState` still says `open`. The chip reports every
  // transition, the rollback included, so this never lags behind a refusal.
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
        "grid items-center gap-3 py-3 [border-bottom:1px_solid_var(--border)] last:border-b-0",
        STORE_PRODUCT_ROW_GRID,
        isSelected && "state-selected",
      )}
    >
      <div className={cn("flex min-w-0 items-center", STORE_PRODUCT_TILE_GAP)}>
        <PendingProductSelectToggle
          itemId={product.itemId}
          label={t("storeView.selection.itemAriaLabel", { name: product.name })}
          checked={isSelected}
          selectable={isItemEligibleForDelivery(product.deliveryState)}
          disabledReason={t("storeView.selection.notSelectable")}
          armed={isArmed}
          variant="row"
          onToggle={onToggleSelect}
        />
        <div className="min-w-0">
          {/* Line 1 carries the name and, at most, the ineligible flag. The arrival state has no
              pill of its own: it is line 2's text, so the two can never compete for this line. */}
          <p className="flex min-w-0 items-center gap-1.5 [font-size:var(--text-body)] [color:var(--text-primary)]">
            <ViewTransitionLink
              href={orderHref}
              viewTransitionEntity="order"
              // The order link moved here from the (now removed) order date, which was this row's
              // only route into the order: 11 rows have no date at all and would have been left
              // with no navigation. The name is the row's primary identifier and the natural
              // target. It is NOT inside the select toggle's `<label>` — that wraps only the
              // invisible input and three `aria-hidden` spans — so no invalid markup is created.
              // No hit-area expansion here: this row only renders from `lg` up (its container is
              // `hidden lg:block`), which is the density this grid was designed for. The touch
              // surface is `StorePendingProductCard`, and the expansion lives there.
              className="inline-flex min-w-0 items-center gap-1 hover:[color:var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]"
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
          <ArrivalMeta
            product={product}
            deliveryState={liveDeliveryState}
            today={today}
            locale={locale}
            className="[font-size:var(--text-caption)]"
          />
        </div>
      </div>

      <div className="text-right [font-size:var(--text-caption)] [color:var(--text-secondary)] tabular-nums">
        {base != null ? (
          formatAmountWithSymbol(base, product.currencyCode, locale)
        ) : (
          <ViewTransitionLink
            href={orderHref}
            viewTransitionEntity="order"
            className="[color:var(--accent)] underline-offset-4 hover:underline"
          >
            {t("storeView.addPrice")}
          </ViewTransitionLink>
        )}
      </div>

      <div className="flex justify-center">
        <OrderItemStateChip
          orderId={product.orderId}
          itemId={product.itemId}
          initialState={product.deliveryState}
          lockedByCancellation={false}
          onStateChange={setLiveDeliveryState}
        />
      </div>

      <div className="group flex items-center justify-end gap-2">
        {paymentState === "proven" ? (
          <Chip variant="success" size="sm" icon={<CheckCircle width={11} height={11} aria-hidden />}>
            {t("storeView.settled")}
          </Chip>
        ) : paymentState === "partial" && paidRatio ? (
          <>
            <ProgressBar
              value={paidRatio.paymentPercentage}
              size="xs"
              label={t("card.paymentBarLabel")}
              valueText={t("card.paymentBarValueText", {
                paid: formatAmountWithSymbol(product.allocatedMinor, product.currencyCode, locale),
                total: formatAmountWithSymbol(base ?? 0, product.currencyCode, locale),
                pct: paidRatio.paymentPercentage,
              })}
              className="w-[44px]"
            />
            <span className="[font-size:var(--text-caption)] [color:var(--text-secondary)] tabular-nums">
              {t("card.paymentPercentage", { pct: paidRatio.paymentPercentage })}
            </span>
          </>
        ) : (
          <>
            {/* Money against a product with no price: the figure, never a ratio. */}
            {paymentState === "unpriced-partial" && (
              <span className="[font-size:var(--text-caption)] [color:var(--text-secondary)] tabular-nums">
                {tOrders("detail.payments.unpricedPartial", {
                  amount: formatAmountWithSymbol(product.allocatedMinor, product.currencyCode, locale),
                })}
              </span>
            )}
            {/* Priced, but its order also holds money that names no product, so this product's own
                share is a floor: the figure, and no bar to draw it against. Needs a branch of its
                own because the `else` above renders nothing, and showing nothing at all about a
                product that DOES carry money is worse than the bad ratio this replaces. */}
            {paymentState === "partial-undetailed" && (
              <span className="[font-size:var(--text-caption)] [color:var(--text-secondary)] tabular-nums">
                {tOrders("detail.payments.declaredAgainst", {
                  amount: formatAmountWithSymbol(product.allocatedMinor, product.currencyCode, locale),
                })}
              </span>
            )}
            {/* Always in the DOM and always in the tab order; only its OPACITY waits for hover or
                focus, copying `PendingProductSelectToggle`'s crossfade. A marked product keeps full
                opacity, because there the chip is the answer, not an affordance. */}
            {rendersPaidMark(markAvailability) && (
              <span
                className={cn(
                  "transition-opacity",
                  paymentState === "declared"
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
                )}
              >
                <PaidMarkControl
                  orderId={product.orderId}
                  itemId={product.itemId}
                  itemName={product.name}
                  initialDeclared={product.paidDeclared}
                  proven={false}
                  offersMark={offersPaidMark(markAvailability)}
                  onError={onPaidMarkError}
                />
              </span>
            )}
          </>
        )}
      </div>
    </li>
  );
}

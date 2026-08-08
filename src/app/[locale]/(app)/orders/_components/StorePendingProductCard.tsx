"use client";

import { ArrowUpRight, CheckCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import Chip from "@/components/core/Chip";
import ViewTransitionLink from "@/components/core/ViewTransitionLink";
import { formatAmountWithSymbol } from "@/lib/currency";
import { formatDomainDate } from "@/lib/domainDate";
import { calculatePaymentSummary } from "@/lib/orders/paymentSummary";
import { ROUTES } from "@/lib/constants";
import type { PendingProductRow } from "@/lib/data/orders/pendingProductsByStoreQueries";
import OrderItemStateChip from "./share/OrderItemStateChip";

type StorePendingProductCardProps = {
  product: PendingProductRow;
  locale: string;
  returnTo: string;
};

/** Mobile two-line row for one pending product, inside a collapsible store group card. */
export default function StorePendingProductCard({ product, locale, returnTo }: StorePendingProductCardProps) {
  const t = useTranslations("orderListing");
  const orderHref = `/${locale}${ROUTES.orders}/${product.orderId}?returnTo=${encodeURIComponent(returnTo)}`;
  const base = product.basePagableMinor;
  const paidRatio =
    base != null && product.allocatedMinor > 0
      ? calculatePaymentSummary(base, [{ amount: product.allocatedMinor }])
      : null;

  return (
    <li className="flex flex-col gap-1 py-2.5 [border-bottom:1px_solid_var(--border)] last:border-b-0">
      {/* Line 1: name + delivery state */}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="min-w-0 truncate [font-size:var(--text-body)] [color:var(--text-primary)]">{product.name}</p>
        <OrderItemStateChip
          orderId={product.orderId}
          itemId={product.itemId}
          initialState={product.deliveryState}
          lockedByCancellation={false}
        />
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
          {product.settled && (
            <Chip variant="success" size="sm" icon={<CheckCircle width={11} height={11} aria-hidden />}>
              {t("storeView.settled")}
            </Chip>
          )}
          {!product.settled && paidRatio && (
            <span>{t("card.paymentPercentage", { pct: paidRatio.paymentPercentage })}</span>
          )}
        </div>
        <ViewTransitionLink
          href={orderHref}
          viewTransitionEntity="order"
          className="inline-flex shrink-0 items-center gap-1 [color:var(--text-muted)] hover:[color:var(--text-secondary)]"
        >
          {t("storeView.orderedOn", { date: formatDomainDate(product.orderDate, locale) })}
          <ArrowUpRight width={10} height={10} aria-hidden />
        </ViewTransitionLink>
      </div>
    </li>
  );
}

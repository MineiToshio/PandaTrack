"use client";

import { ArrowUpRight, CheckCircle, Package } from "lucide-react";
import { useTranslations } from "next-intl";
import Chip from "@/components/core/Chip";
import ViewTransitionLink from "@/components/core/ViewTransitionLink";
import { formatAmountWithSymbol } from "@/lib/currency";
import { formatDomainDate } from "@/lib/domainDate";
import { calculatePaymentSummary } from "@/lib/orders/paymentSummary";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import type { PendingProductRow } from "@/lib/data/orders/pendingProductsByStoreQueries";
import OrderItemStateChip from "./share/OrderItemStateChip";

/** Desktop grid: Producto (flexible) | Precio | Llegada | Pagado. Shared with the header row. */
export const STORE_PRODUCT_ROW_GRID = "[grid-template-columns:minmax(0,1fr)_120px_150px_140px]";

type StorePendingProductRowProps = {
  product: PendingProductRow;
  locale: string;
  returnTo: string;
};

export default function StorePendingProductRow({ product, locale, returnTo }: StorePendingProductRowProps) {
  const t = useTranslations("orderListing");
  const orderHref = `/${locale}${ROUTES.orders}/${product.orderId}?returnTo=${encodeURIComponent(returnTo)}`;
  const base = product.basePagableMinor;
  const paidRatio =
    base != null && product.allocatedMinor > 0
      ? calculatePaymentSummary(base, [{ amount: product.allocatedMinor }])
      : null;

  return (
    <li
      className={cn(
        "grid items-center gap-3 py-3 [border-bottom:1px_solid_var(--border)] last:border-b-0",
        STORE_PRODUCT_ROW_GRID,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] [color:var(--accent-cool)] [background:color-mix(in_oklch,var(--accent-cool)_10%,transparent)]"
          aria-hidden
        >
          <Package width={14} height={14} />
        </span>
        <div className="min-w-0">
          <p className="min-w-0 truncate [font-size:var(--text-body)] [color:var(--text-primary)]">{product.name}</p>
          <ViewTransitionLink
            href={orderHref}
            viewTransitionEntity="order"
            className="inline-flex items-center gap-1 [font-size:var(--text-caption)] [color:var(--text-muted)] hover:[color:var(--text-secondary)]"
          >
            {t("storeView.orderedOn", { date: formatDomainDate(product.orderDate, locale) })}
            <ArrowUpRight width={10} height={10} aria-hidden />
          </ViewTransitionLink>
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
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        {product.settled ? (
          <Chip variant="success" size="sm" icon={<CheckCircle width={11} height={11} aria-hidden />}>
            {t("storeView.settled")}
          </Chip>
        ) : paidRatio ? (
          <>
            <div
              role="progressbar"
              aria-label={t("card.paymentBarLabel")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={paidRatio.paymentPercentage}
              className="h-[3px] w-[44px] overflow-hidden rounded-full [background:color-mix(in_oklch,var(--text-primary)_10%,transparent)]"
            >
              <div
                className="h-full rounded-full [background:var(--accent)]"
                style={{ width: `${Math.min(100, Math.max(0, paidRatio.paymentPercentage))}%` }}
              />
            </div>
            <span className="[font-size:var(--text-caption)] [color:var(--text-secondary)] tabular-nums">
              {t("card.paymentPercentage", { pct: paidRatio.paymentPercentage })}
            </span>
          </>
        ) : (
          <span className="[color:var(--text-muted)]">
            <span aria-hidden>·</span>
            <span className="sr-only">{t("storeView.paidEmptyAria")}</span>
          </span>
        )}
      </div>
    </li>
  );
}

"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CircleDollarSign, CircleOff, ExternalLink, Wallet } from "lucide-react";
import Chip from "@/components/core/Chip";
import Eyebrow, { type EyebrowTone } from "@/components/core/Eyebrow";
import { cn } from "@/lib/styles";
import { ROUTES } from "@/lib/constants";
import type { PaymentSummary } from "@/lib/orders/paymentSummary";
import { formatAmountSymbolOnly } from "@/lib/currency";
import type { OrderStatus } from "../../../../../../../generated/prisma/client";
import OrderPaymentRow from "./OrderPaymentRow";
import OrderInlinePaymentForm from "./OrderInlinePaymentForm";

const TOP_ACCENT_VAR: Record<EyebrowTone, string> = {
  muted: "var(--text-muted)",
  accent: "var(--accent)",
  cool: "var(--accent-cool)",
  warm: "var(--accent-warm)",
  success: "var(--success)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
};

/**
 * State-aware tone for the Pagos card:
 *  - 100% paid → success
 *  - overdue (active order past estimated date) → destructive
 *  - completed with saldo pendiente → warning
 *  - everything else (active, cancelled) → cool (neutral tracking)
 */
function derivePaymentsTone({
  isFullyPaid,
  isOverdue,
  isCompleted,
  hasUnpaidBalance,
}: {
  isFullyPaid: boolean;
  isOverdue: boolean;
  isCompleted: boolean;
  hasUnpaidBalance: boolean;
}): EyebrowTone {
  if (isFullyPaid) return "success";
  if (isOverdue) return "destructive";
  if (isCompleted && hasUnpaidBalance) return "warning";
  return "cool";
}

/**
 * A payment as this order sees it: one allocation, carrying its parent payment's id/total/shared
 * flag so this card (and the row's delete-confirm modal) can describe the shared case without a
 * second query. Mirrors `OrderPaymentRecord` (see `orderPaymentAllocations.ts`).
 */
type PaymentRecord = {
  id: string;
  amount: number;
  paymentDate: Date;
  paymentId: string;
  paymentTotalMinor: number;
  isShared: boolean;
};

export type OrderPaymentsAsideCardHandle = {
  openForm: () => void;
};

type OrderPaymentsAsideCardProps = {
  /** Live payments list — controlled by `OrderDetailClient` so the hero, sticky bar, and this
      card all share the same source of truth. */
  payments: PaymentRecord[];
  summary: PaymentSummary;
  hasUnpaidBalance: boolean;
  status: OrderStatus;
  /** True when this is an active order past its estimated delivery date. */
  isOverdue: boolean;
  currencyCode: string;
  orderDate: Date;
  locale: string;
  /** Store this order belongs to — threads into the "Parte de un pago a {store}" row subtitle and
      the empty-state "Ver deuda de la tienda" link. */
  storeName: string;
  storeSlug: string;
  /** Handlers are owned by the parent; this card only triggers them via UI events. */
  onAddPayment: (amount: number, paymentDate: Date) => Promise<{ ok: boolean; error?: string }>;
  onDeletePayment: (paymentId: string) => Promise<{ ok: boolean; error?: string }>;
  /**
   * When false, hides the "Anotar pago" CTA inside the card so the sticky action bar at the
   * bottom of mobile becomes the single source of truth for that action (spec §5.8).
   */
  showAddCta?: boolean;
  className?: string;
};

/**
 * Pure presentational payments card. All payment state (list, summary, has-unpaid-balance)
 * is controlled by `OrderDetailClient` so the hero amount and progress bar animate in
 * lockstep whenever the user adds or deletes a payment.
 */
const OrderPaymentsAsideCard = forwardRef<OrderPaymentsAsideCardHandle, OrderPaymentsAsideCardProps>(
  function OrderPaymentsAsideCard(
    {
      payments,
      summary,
      hasUnpaidBalance,
      status,
      isOverdue,
      currencyCode,
      orderDate,
      locale,
      storeName,
      storeSlug,
      onAddPayment,
      onDeletePayment,
      showAddCta = true,
      className,
    },
    ref,
  ) {
    const t = useTranslations("orders");
    const [showForm, setShowForm] = useState(false);

    useImperativeHandle(ref, () => ({
      openForm: () => setShowForm(true),
    }));

    const isCancelled = status === "CANCELLED";
    const isCompleted = status === "COMPLETED";
    const isFullyPaid = summary.paymentPercentage >= 100;
    const canAddPayment = !isCancelled && !isFullyPaid;
    const tone = derivePaymentsTone({ isFullyPaid, isOverdue, isCompleted, hasUnpaidBalance });
    // A cancelled order that still carries payments kept them deliberately at cancel time —
    // that money is sunk, not an active balance. A cancelled order with no payments (removed,
    // refunded, or never paid) shows no marker.
    const showLostMarker = isCancelled && summary.paidAmount > 0;
    const storeHref = `/${locale}${ROUTES.stores}/${storeSlug}`;

    async function handleAddPayment(amount: number, paymentDate: Date) {
      const result = await onAddPayment(amount, paymentDate);
      if (result.ok) setShowForm(false);
      return result;
    }

    return (
      <section
        aria-labelledby="payments-aside-heading"
        className={cn(
          "bg-surface-elevated border-border rounded-2xl border p-[18px] [box-shadow:var(--elevation-2)] sm:p-[22px]",
          className,
        )}
        style={{ borderTop: `2px solid color-mix(in oklch, ${TOP_ACCENT_VAR[tone]} 55%, transparent)` }}
      >
        <div className="flex items-center justify-between gap-2">
          <Eyebrow as="h2" variant="chip" tone={tone} icon={Wallet} id="payments-aside-heading">
            {t("detail.payments.sectionTitle")}
          </Eyebrow>
        </div>

        {/* Payment rows — only rendered when there are payments. With 0 payments, an empty-state
            line replaces the rows so the collector knows nothing is assigned to THIS order yet
            (it may still owe the store from other orders — the link below points there). */}
        {payments.length > 0 ? (
          <ul className="mt-3 list-none" role="list">
            {payments.map((payment) => (
              <OrderPaymentRow
                key={payment.id}
                payment={payment}
                currencyCode={currencyCode}
                locale={locale}
                storeName={storeName}
                onConfirmDelete={onDeletePayment}
              />
            ))}
          </ul>
        ) : (
          <div className="mt-3 space-y-1.5">
            <p className="text-text-muted text-[13px]">{t("detail.payments.emptyAllocated")}</p>
            <Link
              href={storeHref}
              className="text-accent inline-flex items-center gap-1.5 text-[13px] font-medium underline-offset-2 hover:underline"
            >
              <ExternalLink size={14} aria-hidden="true" />
              {t("detail.payments.viewStoreDebt")}
            </Link>
          </div>
        )}

        {/* Demo totals breakdown: padding-top 8px · padding-right 40px (= pay-delete width
            + gap, keeps amounts aligned with pay-row amounts above) · gap 4px between rows.
            Always rendered — see comment above. */}
        <div className={cn("border-border space-y-1 border-t pt-2 pr-10", payments.length === 0 ? "mt-3" : "mt-0")}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span className="text-text-muted text-[12px]">{t("detail.payments.totalAllocated")}</span>
              {showLostMarker && (
                <Chip variant="warning" size="sm" icon={<CircleOff size={12} aria-hidden="true" />}>
                  {t("detail.payments.lostMarker")}
                </Chip>
              )}
            </span>
            <span className="text-text-title text-[13px] font-semibold tabular-nums">
              {formatAmountSymbolOnly(summary.paidAmount, currencyCode, locale)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-text-secondary text-[13px]">{t("detail.payments.remainingToAllocate")}</span>
            <strong
              className={cn(
                "text-[15px] font-bold tabular-nums",
                hasUnpaidBalance ? "text-warning" : "text-text-muted",
              )}
            >
              {hasUnpaidBalance ? formatAmountSymbolOnly(summary.remainingAmount, currencyCode, locale) : "—"}
            </strong>
          </div>
        </div>

        {canAddPayment && !showForm && showAddCta && (
          // Demo `.btn.accent.full`: min-h 40px · padding 10px 16px · radius 8px · 14px / 500 · gap 8px
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className={cn(
              "mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5",
              "text-[14px] leading-none font-medium",
              "[background:color-mix(in_oklch,var(--accent)_10%,transparent)]",
              "[color:var(--accent)]",
              "[border:1px_solid_color-mix(in_oklch,var(--accent)_28%,transparent)]",
              "transition-colors hover:[background:color-mix(in_oklch,var(--accent)_16%,transparent)]",
            )}
          >
            <CircleDollarSign className="size-4 shrink-0" aria-hidden />
            {t("detail.payments.addCta")}
          </button>
        )}

        {showForm && (
          <OrderInlinePaymentForm
            currencyCode={currencyCode}
            remainingAmount={summary.remainingAmount}
            orderDate={orderDate}
            locale={locale}
            onCancel={() => setShowForm(false)}
            onSubmit={handleAddPayment}
          />
        )}
      </section>
    );
  },
);

export default OrderPaymentsAsideCard;

"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslations } from "next-intl";
import { CircleDollarSign } from "lucide-react";
import { cn } from "@/lib/styles";
import type { PaymentSummary } from "@/lib/orders/paymentSummary";
import { formatAmountSymbolOnly } from "@/lib/currency";
import type { OrderStatus } from "../../../../../../../generated/prisma/client";
import OrderPaymentRow from "./OrderPaymentRow";
import OrderInlinePaymentForm from "./OrderInlinePaymentForm";

type PaymentRecord = { id: string; amount: number; paymentDate: Date };

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
  currencyCode: string;
  orderDate: Date;
  locale: string;
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
      currencyCode,
      orderDate,
      locale,
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
    const isFullyPaid = summary.paymentPercentage >= 100;
    const canAddPayment = !isCancelled && !isFullyPaid;

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
      >
        <div className="flex items-center justify-between gap-2">
          <h2
            id="payments-aside-heading"
            className="text-text-muted font-mono text-[11px] font-medium tracking-[0.08em] uppercase"
          >
            {t("detail.payments.sectionTitle")}
          </h2>
        </div>

        {/* Payment rows — only rendered when there are payments. Sergio wants the totals
            block (Total pagado / Saldo pendiente) to look identical whether there are 0 or
            N payments, so it lives below and is unconditional. With 0 payments the rows
            container is omitted and the totals separator (border-t) sits flush under the
            section heading, which still reads cleanly. */}
        {payments.length > 0 && (
          <ul className="mt-3 list-none" role="list">
            {payments.map((payment) => (
              <OrderPaymentRow
                key={payment.id}
                payment={payment}
                currencyCode={currencyCode}
                locale={locale}
                onConfirmDelete={onDeletePayment}
              />
            ))}
          </ul>
        )}

        {/* Demo totals breakdown: padding-top 8px · padding-right 40px (= pay-delete width
            + gap, keeps amounts aligned with pay-row amounts above) · gap 4px between rows.
            Always rendered — see comment above. */}
        <div className={cn("border-border space-y-1 border-t pt-2 pr-10", payments.length === 0 ? "mt-3" : "mt-0")}>
          <div className="flex items-baseline justify-between">
            <span className="text-text-muted text-[12px]">{t("detail.payments.totalPaid")}</span>
            <span className="text-text-title text-[13px] font-semibold tabular-nums">
              {formatAmountSymbolOnly(summary.paidAmount, currencyCode, locale)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-text-secondary text-[13px]">{t("detail.payments.saldoPendiente")}</span>
            <strong
              className={cn(
                "text-[15px] font-bold tabular-nums",
                hasUnpaidBalance ? "text-warning" : "text-text-title",
              )}
            >
              {formatAmountSymbolOnly(summary.remainingAmount, currencyCode, locale)}
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

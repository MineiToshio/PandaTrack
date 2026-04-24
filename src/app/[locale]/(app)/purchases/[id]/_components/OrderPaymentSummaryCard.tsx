"use client";

import { useTranslations } from "next-intl";
import Typography from "@/components/core/Typography";
import type { PaymentSummary } from "@/lib/orders/paymentSummary";
import type { OrderStatus } from "../../../../../../../generated/prisma/client";

type OrderPaymentSummaryCardProps = {
  summary: PaymentSummary;
  hasUnpaidBalance: boolean;
  status: OrderStatus;
  currencyCode: string;
  lastPaymentDate: Date | null;
  locale: string;
};

function formatAmount(amount: number, currencyCode: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(amount / 100);
  } catch {
    return `${currencyCode} ${(amount / 100).toFixed(2)}`;
  }
}

export default function OrderPaymentSummaryCard({
  summary,
  hasUnpaidBalance,
  status,
  currencyCode,
  lastPaymentDate,
  locale,
}: OrderPaymentSummaryCardProps) {
  const t = useTranslations("orders");
  const { paidAmount, remainingAmount, paymentPercentage } = summary;
  const isFullyPaid = paymentPercentage >= 100;
  const showUnpaidBanner = status === "COMPLETED" && hasUnpaidBalance;

  const lastPaymentLabel = lastPaymentDate
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(lastPaymentDate)
    : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-0.5">
          <Typography size="xs" className="text-text-muted">
            {t("detail.payments.summaryPaid")}
          </Typography>
          <Typography size="sm" className="text-text-body font-semibold tabular-nums">
            {formatAmount(paidAmount, currencyCode, locale)}
          </Typography>
        </div>
        {!isFullyPaid && (
          <div className="space-y-0.5">
            <Typography size="xs" className="text-text-muted">
              {t("detail.payments.summaryRemaining")}
            </Typography>
            <Typography size="sm" className="text-text-body font-semibold tabular-nums">
              {formatAmount(remainingAmount, currencyCode, locale)}
            </Typography>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="bg-muted h-2 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min(paymentPercentage, 100)}%` }}
            role="progressbar"
            aria-valuenow={paymentPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("detail.payments.summaryProgress", { pct: paymentPercentage })}
          />
        </div>
        {isFullyPaid ? (
          <Typography size="xs" className="text-success font-medium">
            {t("detail.payments.summaryFullyPaid")}
          </Typography>
        ) : (
          <Typography size="xs" className="text-text-muted">
            {t("detail.payments.summaryProgress", { pct: paymentPercentage })}
          </Typography>
        )}
        {lastPaymentLabel && (
          <Typography size="xs" className="text-text-muted">
            {t("detail.payments.summaryLastPayment", { date: lastPaymentLabel })}
          </Typography>
        )}
      </div>

      {showUnpaidBanner && (
        <div className="border-warning/30 bg-warning/10 text-warning rounded-lg border p-3 text-xs" role="alert">
          {t("detail.payments.unpaidBanner")}
        </div>
      )}
    </div>
  );
}

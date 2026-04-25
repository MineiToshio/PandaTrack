"use client";

import { useTranslations } from "next-intl";
import { Wallet } from "lucide-react";
import Typography from "@/components/core/Typography";
import SectionSurfaceCard from "@/components/modules/SectionSurfaceCard";
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

  const pct = Math.min(paymentPercentage, 100);

  return (
    <SectionSurfaceCard title={t("detail.payments.summaryRegionAria")} icon={Wallet} iconClassName="text-primary">
      <div className={`grid gap-4 ${isFullyPaid ? "grid-cols-1" : "grid-cols-2"}`}>
        <div className="min-w-0 space-y-1">
          <Typography as="span" size="2xs" className="text-text-muted block font-medium tracking-wider uppercase">
            {t("detail.payments.summaryPaid")}
          </Typography>
          <p className="text-success text-xl font-bold tabular-nums sm:text-2xl">
            {formatAmount(paidAmount, currencyCode, locale)}
          </p>
        </div>
        {!isFullyPaid && (
          <div className="min-w-0 space-y-1 text-right">
            <Typography as="span" size="2xs" className="text-text-muted block font-medium tracking-wider uppercase">
              {t("detail.payments.summaryRemaining")}
            </Typography>
            <p className="text-accent text-xl font-bold tabular-nums sm:text-2xl">
              {formatAmount(remainingAmount, currencyCode, locale)}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div
          className="bg-muted relative h-2.5 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={paymentPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("detail.payments.summaryProgress", { pct: paymentPercentage })}
        >
          {pct > 0 && (
            <div
              className="absolute inset-y-0 left-0 flex items-center transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            >
              <div className="bg-success h-full min-h-2 flex-1 rounded-l-full" />
              <span className="bg-success ring-surface-2 z-10 size-2.5 shrink-0 rounded-full ring-2" aria-hidden />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          {isFullyPaid ? (
            <Typography size="2xs" className="text-success font-medium">
              {t("detail.payments.summaryFullyPaid")}
            </Typography>
          ) : (
            <Typography size="2xs" className="text-text-muted">
              {t("detail.payments.summaryProgress", { pct: paymentPercentage })}
            </Typography>
          )}
          {lastPaymentLabel && (
            <Typography size="2xs" className="text-text-muted sm:text-right">
              {t("detail.payments.summaryLastPayment", { date: lastPaymentLabel })}
            </Typography>
          )}
        </div>
      </div>

      {showUnpaidBanner && (
        <div className="border-warning/30 bg-warning/10 text-warning rounded-lg border p-3 text-xs" role="alert">
          {t("detail.payments.unpaidBanner")}
        </div>
      )}
    </SectionSurfaceCard>
  );
}

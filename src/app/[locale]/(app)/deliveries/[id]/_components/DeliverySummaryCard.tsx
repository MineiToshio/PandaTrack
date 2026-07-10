"use client";

import Link from "next/link";
import { AlertTriangle, ClipboardList } from "lucide-react";
import { useTranslations } from "next-intl";
import Eyebrow from "@/components/core/Eyebrow";
import { formatAmountSymbolOnly, formatAmountWithSymbol } from "@/lib/currency";
import { formatDomainDate } from "@/lib/domainDate";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import type { DeliveryStatus } from "../../../../../../../generated/prisma/client";

type DeliverySummaryCardProps = {
  delivery: {
    deliveryDate: Date;
    expectedArrivalFrom: Date | null;
    expectedArrivalTo: Date | null;
    cost: number;
    currencyCode: string;
    exchangeRate: number | null;
    needsExchangeRateUpdate: boolean;
    store: { name: string; slug: string };
    sourceOrderCodes: string[];
  };
  status: DeliveryStatus;
  receivedDate: Date | null;
  baseCurrencyCode: string | null;
  locale: string;
  className?: string;
};

function formatDate(date: Date, locale: string) {
  return formatDomainDate(date, locale);
}

function formatWindow(from: Date | null, to: Date | null, locale: string): string {
  if (from && to) return `${formatDate(from, locale)} – ${formatDate(to, locale)}`;
  const single = from ?? to;
  return single ? formatDate(single, locale) : "—";
}

export default function DeliverySummaryCard({
  delivery,
  status,
  receivedDate,
  baseCurrencyCode,
  locale,
  className,
}: DeliverySummaryCardProps) {
  const t = useTranslations("deliveries");

  const differsFromBase = baseCurrencyCode != null && delivery.currencyCode !== baseCurrencyCode;
  // A stale FX flag suppresses the converted value; we surface a "pending" row instead so the
  // conversion is never shown from an outdated rate. Reconciled by editing the delivery.
  const fxPending = delivery.needsExchangeRateUpdate && differsFromBase;
  const showFxRow = !fxPending && delivery.exchangeRate != null && differsFromBase;

  const rows: Array<{ key: string; label: string; value: React.ReactNode; mono?: boolean }> = [
    {
      key: "store",
      label: t("detail.summary.store"),
      value: (
        <Link href={`/${locale}${ROUTES.stores}/${delivery.store.slug}`} className="text-accent hover:underline">
          {delivery.store.name}
        </Link>
      ),
    },
    { key: "shipped", label: t("detail.summary.shippedDate"), value: formatDate(delivery.deliveryDate, locale) },
    status === "DELIVERED" && receivedDate
      ? { key: "received", label: t("detail.summary.receivedDate"), value: formatDate(receivedDate, locale) }
      : {
          key: "arrival",
          label: t("detail.summary.expectedArrival"),
          value: formatWindow(delivery.expectedArrivalFrom, delivery.expectedArrivalTo, locale),
        },
    {
      key: "cost",
      label: t("detail.summary.cost"),
      value: formatAmountWithSymbol(delivery.cost, delivery.currencyCode, locale),
      mono: true,
    },
    ...(showFxRow
      ? [
          {
            key: "fx",
            label: t("detail.summary.exchangeRate"),
            value: t("detail.summary.exchangeRateValue", {
              from: delivery.currencyCode,
              rate: delivery.exchangeRate!,
              to: baseCurrencyCode!,
              converted: formatAmountSymbolOnly(
                Math.round(delivery.cost * delivery.exchangeRate!),
                baseCurrencyCode!,
                locale,
              ),
            }),
            mono: true,
          },
        ]
      : []),
    ...(fxPending
      ? [
          {
            key: "fxPending",
            label: t("detail.summary.exchangeRate"),
            value: (
              <span className="text-warning inline-flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                {t("detail.summary.exchangeRatePending")}
              </span>
            ),
          },
        ]
      : []),
    {
      key: "sourceOrders",
      label: t("detail.summary.sourceOrders"),
      value: delivery.sourceOrderCodes.join(" · "),
      mono: true,
    },
  ];

  return (
    <section
      aria-labelledby="delivery-summary-heading"
      className={cn(
        "bg-surface-elevated border-border rounded-2xl border p-[18px] [box-shadow:var(--elevation-2)] sm:p-[22px]",
        "[border-top:2px_solid_color-mix(in_oklch,var(--accent-cool)_55%,transparent)]",
        className,
      )}
    >
      <Eyebrow as="h2" variant="chip" tone="cool" icon={ClipboardList} id="delivery-summary-heading">
        {t("detail.summary.title")}
      </Eyebrow>
      <dl className="mt-2.5 flex flex-col">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-baseline justify-between gap-3 py-2 [border-top:1px_solid_var(--border)] first-of-type:[border-top:none]"
          >
            <dt className="text-text-muted shrink-0 text-[12.5px]">{row.label}</dt>
            <dd
              className={cn(
                "text-text-primary min-w-0 text-right text-[13px] break-words",
                row.mono && "font-mono text-[12.5px] tabular-nums",
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

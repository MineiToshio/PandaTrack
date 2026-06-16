"use client";

import { Ban, CheckCircle, PackageCheck, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import CodeCopyButton from "@/components/core/CodeCopyButton";
import Eyebrow from "@/components/core/Eyebrow";
import StatusChip from "@/components/core/StatusChip";
import StoreAvatar from "@/components/core/StoreAvatar";
import { cn } from "@/lib/styles";
import { formatAmountSymbolOnly, formatAmountWithSymbol } from "@/lib/currency";
import { formatDomainDate } from "@/lib/domainDate";
import type { DeliveryStatus } from "../../../../../../../generated/prisma/client";
import { getDeliveryOverdueDays } from "../../_utils/deliveryDates";

type DeliveryDetailHeroProps = {
  delivery: {
    id: string;
    humanReadableId: string;
    storeName: string;
    deliveryDate: Date;
    expectedArrivalFrom: Date | null;
    expectedArrivalTo: Date | null;
    cost: number;
    currencyCode: string;
    exchangeRate: number | null;
    productCount: number;
  };
  /** Live (optimistic) lifecycle state owned by the coordinator. */
  status: DeliveryStatus;
  receivedDate: Date | null;
  baseCurrencyCode: string | null;
  locale: string;
};

const MS_PER_DAY = 86_400_000;

function formatDate(date: Date, locale: string) {
  return formatDomainDate(date, locale);
}

/**
 * "15 – 22 may 2026" / "25 abr – 2 may 2026" / "18 may 2026" — hero-sized window.
 * Same-month detection uses UTC getters so it matches the UTC-pinned display of dates
 * stored at midnight UTC.
 */
function formatHeroWindow(from: Date | null, to: Date | null, locale: string): string | null {
  if (from && to) {
    const sameMonth = from.getUTCMonth() === to.getUTCMonth() && from.getUTCFullYear() === to.getUTCFullYear();
    if (sameMonth) {
      const tail = formatDomainDate(to, locale, { month: "short", year: "numeric" });
      return `${from.getUTCDate()} – ${to.getUTCDate()} ${tail}`;
    }
    const fromPart = formatDomainDate(from, locale, { day: "numeric", month: "short" });
    return `${fromPart} – ${formatDate(to, locale)}`;
  }
  const single = from ?? to;
  return single ? formatDate(single, locale) : null;
}

export default function DeliveryDetailHero({
  delivery,
  status,
  receivedDate,
  baseCurrencyCode,
  locale,
}: DeliveryDetailHeroProps) {
  const t = useTranslations("deliveries");
  const today = new Date();

  const isDelivered = status === "DELIVERED";
  const isCancelled = status === "CANCELLED";
  const overdueDays = status === "IN_TRANSIT" ? getDeliveryOverdueDays(delivery.expectedArrivalTo, today) : 0;

  const costLabel = formatAmountWithSymbol(delivery.cost, delivery.currencyCode, locale);
  const showConversion =
    delivery.exchangeRate != null && baseCurrencyCode != null && delivery.currencyCode !== baseCurrencyCode;
  // Same minor-unit scale on both sides: minor × rate = converted minor.
  const convertedLabel = showConversion
    ? formatAmountSymbolOnly(Math.round(delivery.cost * delivery.exchangeRate!), baseCurrencyCode!, locale)
    : null;
  const costCaption = convertedLabel
    ? t("detail.hero.costWithConversion", { cost: costLabel, converted: convertedLabel, base: baseCurrencyCode! })
    : t("detail.hero.cost", { cost: costLabel });

  // Temporal progress of the shipping window: shipped date → window end (S9-D1).
  const windowLabel = formatHeroWindow(delivery.expectedArrivalFrom, delivery.expectedArrivalTo, locale);
  let progressPct: number | null = null;
  let windowCaption: string | null = null;
  if (status === "IN_TRANSIT" && delivery.expectedArrivalTo) {
    const total = delivery.expectedArrivalTo.getTime() - delivery.deliveryDate.getTime();
    const elapsed = today.getTime() - delivery.deliveryDate.getTime();
    progressPct = total > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))) : null;

    const from = delivery.expectedArrivalFrom;
    if (from && today < from) {
      const daysToWindow = Math.max(1, Math.ceil((from.getTime() - today.getTime()) / MS_PER_DAY));
      windowCaption = t("detail.hero.windowStartsIn", { days: daysToWindow });
    } else if (today <= delivery.expectedArrivalTo) {
      const daysToEnd = Math.max(1, Math.ceil((delivery.expectedArrivalTo.getTime() - today.getTime()) / MS_PER_DAY));
      windowCaption = t("detail.hero.windowEndsIn", { days: daysToEnd });
    } else {
      windowCaption = t("detail.hero.windowEndedAgo", { days: overdueDays });
    }
  }

  const eyebrowLabel = t("detail.hero.eyebrow", { count: delivery.productCount });

  return (
    <div
      className={cn(
        "bg-surface-elevated border-border relative rounded-[18px] border p-[22px]",
        "[box-shadow:var(--elevation-2)]",
        // Cancelled drops the accent top-border for a neutral one (demo `…-cancelled`).
        isCancelled
          ? "[border-top:2px_solid_var(--border-strong)]"
          : "[border-top:2px_solid_color-mix(in_oklch,var(--accent)_55%,transparent)]",
      )}
      style={{ viewTransitionName: `dlv-${delivery.id}` }}
    >
      <div className={cn("mb-[18px] flex flex-wrap items-center gap-3", isCancelled && "opacity-80")}>
        <StoreAvatar
          store={{ name: delivery.storeName }}
          size={56}
          className={cn("shrink-0 [&]:rounded-[14px]", isCancelled && "[filter:grayscale(0.6)]")}
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-text-title text-[17px] leading-tight font-semibold">{delivery.storeName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <CodeCopyButton
              code={delivery.humanReadableId}
              copyAriaLabel={t("detail.hero.copyCodeAria")}
              copiedAnnouncement={t("detail.hero.codeCopied")}
            />
            <StatusChip kind="deliveryStatus" value={status} overdueDays={overdueDays} />
          </div>
        </div>
      </div>

      <Eyebrow
        variant="chip"
        tone={isDelivered ? "success" : isCancelled ? "destructive" : "accent"}
        icon={isDelivered ? PackageCheck : isCancelled ? Ban : Truck}
        className={cn("mt-3", isCancelled && "opacity-85")}
      >
        {eyebrowLabel}
      </Eyebrow>

      <div className="mt-3">
        {isDelivered ? (
          <>
            <div className="text-success flex items-center gap-2.5 leading-none">
              <CheckCircle className="size-[26px] shrink-0" aria-hidden />
              <span className="text-[clamp(24px,4vw,30px)] font-bold tracking-[0.02em] uppercase">
                {t("detail.hero.deliveredTitle")}
              </span>
            </div>
            <div className="text-text-secondary mt-1 text-[14px] tabular-nums">
              {receivedDate
                ? t("detail.hero.deliveredSub", {
                    received: formatDate(receivedDate, locale),
                    shipped: formatDate(delivery.deliveryDate, locale),
                  })
                : t("detail.hero.shippedOn", { date: formatDate(delivery.deliveryDate, locale) })}
            </div>
            <div className="text-text-muted mt-1.5 text-[12px] leading-snug">{costCaption}</div>
          </>
        ) : isCancelled ? (
          <>
            <div className="text-text-muted flex items-center gap-2.5 leading-none">
              <Ban className="size-[26px] shrink-0" aria-hidden />
              <span className="text-[clamp(24px,4vw,30px)] font-bold tracking-[0.02em] uppercase">
                {t("detail.hero.cancelledTitle")}
              </span>
            </div>
            <div className="text-text-secondary mt-1 text-[14px] tabular-nums">
              {t("detail.hero.shippedOn", { date: formatDate(delivery.deliveryDate, locale) })}
            </div>
            <div className="text-text-muted mt-1.5 text-[12px] leading-snug">
              {t.rich("detail.hero.cancelledNote", {
                count: delivery.productCount,
                strong: (chunks) => <strong className="text-text-secondary font-semibold">{chunks}</strong>,
              })}
            </div>
          </>
        ) : (
          <>
            <div className="text-text-secondary text-[13px]">{t("detail.hero.arrivalLabel")}</div>
            <div className="text-text-title text-[clamp(26px,4.5vw,34px)] leading-tight font-bold tracking-[-0.02em] tabular-nums">
              {windowLabel ?? t("detail.hero.noWindow")}
            </div>
            <div className="text-text-secondary mt-1 text-[14px] tabular-nums">
              {t("detail.hero.shippedOn", { date: formatDate(delivery.deliveryDate, locale) })}
            </div>
            {progressPct != null && (
              <div
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t("detail.hero.progressAria", { pct: progressPct })}
                className="mt-4 h-1 w-full overflow-hidden rounded-full"
                style={{ background: "color-mix(in oklab, var(--text-primary) 8%, transparent)" }}
              >
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${progressPct}%`,
                    background:
                      overdueDays > 0
                        ? "linear-gradient(90deg, var(--warning), var(--accent-warm))"
                        : "linear-gradient(90deg, var(--accent), var(--accent-warm))",
                  }}
                />
              </div>
            )}
            <div
              className={cn(
                "text-text-muted flex flex-wrap items-baseline gap-x-2 text-[12px] leading-snug",
                progressPct != null ? "mt-1.5" : "mt-3",
              )}
            >
              {windowCaption && (
                <>
                  <span className="whitespace-nowrap">{windowCaption}</span>
                  <span aria-hidden>·</span>
                </>
              )}
              <span className="whitespace-nowrap">{costCaption}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

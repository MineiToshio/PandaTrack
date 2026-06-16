"use client";

import { AlertTriangle, CircleCheck, Package, PackageCheck, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import Eyebrow from "@/components/core/Eyebrow";
import StoreAvatar from "@/components/core/StoreAvatar";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { cn } from "@/lib/styles";
import { formatAmountSymbolOnly, formatAmountWithSymbol } from "@/lib/currency";
import { formatDomainDate } from "@/lib/domainDate";
import type { OrderStatus } from "../../../../../../../generated/prisma/client";
import OrderCodeCopyButton from "./OrderCodeCopyButton";

type Store = { id: string; name: string; slug: string };

type OrderDetailHeroProps = {
  order: {
    id: string;
    humanReadableId: string;
    store: Store;
    orderDate: Date;
    expectedDeliveryFrom: Date | null;
    expectedDeliveryTo: Date | null;
    currencyCode: string;
    exchangeRate: number | null;
    totalCost: number;
    status: OrderStatus;
  };
  /** Live payment summary — refreshed on each add/delete payment so amount + progress animate. */
  paidAmount: number;
  remainingAmount: number;
  paymentPercentage: number;
  hasUnpaidBalance: boolean;
  isOverdue: boolean;
  overdueDays: number;
  locale: string;
};

function formatDate(date: Date, locale: string) {
  return formatDomainDate(date, locale);
}

function statusChipClass(status: OrderStatus): string {
  switch (status) {
    case "OPEN":
      return "border-info/35 bg-info/15 text-info";
    case "IN_TRANSIT":
    case "PARTIALLY_IN_TRANSIT":
      return "border-info/35 bg-info/15 text-info";
    case "PARTIALLY_DELIVERED":
      return "border-highlight/35 bg-highlight/15 text-highlight";
    case "COMPLETED":
      return "border-success/35 bg-success/15 text-success";
    case "CANCELLED":
      return "border-border bg-muted/60 text-text-muted";
  }
}

function StatusChipIcon({ status, className }: { status: OrderStatus; className?: string }) {
  switch (status) {
    case "COMPLETED":
      return <PackageCheck className={className} aria-hidden />;
    case "CANCELLED":
      return <AlertTriangle className={className} aria-hidden />;
    default:
      return <Truck className={className} aria-hidden />;
  }
}

export default function OrderDetailHero({
  order,
  paidAmount,
  remainingAmount,
  paymentPercentage,
  hasUnpaidBalance,
  isOverdue,
  overdueDays,
  locale,
}: OrderDetailHeroProps) {
  const t = useTranslations("orders");

  const isCancelled = order.status === "CANCELLED";
  const isCompleted = order.status === "COMPLETED";
  const completedUnpaid = isCompleted && hasUnpaidBalance;

  const showOverdueChip = isOverdue && !isCancelled && !isCompleted;
  const showUnpaidChip = completedUnpaid;

  // Hero layout — same shape for every active state (Sergio prefers consistent UX):
  //  - Active → label "Saldo pendiente" + amount = remainingAmount + "de TOTAL" sub + progress + meta
  //  - Cancelled → label "Total" + amount = totalCost (no progress/sub)
  const showActiveLayout = !isCancelled;
  const heroLabel = showActiveLayout ? t("detail.hero.saldoPendiente") : t("detail.hero.total");
  const heroAmountMinor = showActiveLayout ? remainingAmount : order.totalCost;
  const showSubAmount = showActiveLayout;
  const showProgress = showActiveLayout;

  // Counter-roll animation when amount + percentage change (after add/delete payment).
  const animatedAmount = useAnimatedNumber(heroAmountMinor);
  const animatedPct = useAnimatedNumber(paymentPercentage);
  const pctRounded = Math.round(animatedPct);
  const pctForDisplay = Math.round(paymentPercentage); // settled value for the meta copy

  // Amount color: warning when there's an unpaid balance on a completed order, dimmed
  // secondary on cancelled (matches demo `s7-order-detail-cancelled` which uses
  // `color:var(--text-secondary)` on the hero amount), default text-title otherwise.
  const amountClass = cn(
    "tabular-nums font-bold leading-none tracking-[-0.03em] text-[clamp(32px,5vw,40px)]",
    completedUnpaid ? "text-warning" : isCancelled ? "text-text-secondary" : "text-text-title",
  );

  // Fully-paid swap — replace the literal "$0.00" with a "Pago completado" status block.
  // We gate on BOTH the settled value AND the animated value being at 0 so the counter
  // animation can finish counting down to 0 before the swap happens (visually: $25 → $0 →
  // morph to text). When the user is on an already-paid order at first paint, `animatedAmount`
  // starts at 0 and we render the text immediately. If they later delete a payment and the
  // balance comes back, `isFullyPaid` flips false and we go back to the number layout.
  const isFullyPaid = showActiveLayout && remainingAmount === 0;
  const showPaidStatus = isFullyPaid && Math.round(animatedAmount) === 0;

  const progressFillStyle: React.CSSProperties = {
    width: `${Math.min(100, Math.max(0, animatedPct))}%`,
    background:
      completedUnpaid || isOverdue
        ? "linear-gradient(90deg, var(--warning), var(--accent-warm))"
        : "linear-gradient(90deg, var(--accent), var(--accent-warm))",
  };

  // Meta line segments — order date is always present so the hero surfaces the same
  // "when was this ordered" anchor regardless of estimate (per Sergio). On narrow
  // viewports the line wraps at the `·` separators (segments are `whitespace-nowrap`)
  // so timeline copy never breaks mid-phrase like "entrega / estimada".
  const orderDateLabel = formatDate(order.orderDate, locale);
  const expectedToLabel = order.expectedDeliveryTo ? formatDate(order.expectedDeliveryTo, locale) : null;

  return (
    <div
      className={cn(
        "bg-surface-elevated border-border relative rounded-[18px] border p-[22px]",
        "[border-top:2px_solid_color-mix(in_oklch,var(--accent)_55%,transparent)]",
        "[box-shadow:var(--elevation-2)]",
        isCancelled && "opacity-75",
      )}
      style={{ viewTransitionName: `order-${order.id}` }}
    >
      {/* Demo `.detail-hero-head`: items-center, gap 12px, margin-bottom 18px, flex-wrap */}
      <div className="mb-[18px] flex flex-wrap items-center gap-3">
        <StoreAvatar
          store={{ name: order.store.name }}
          size={56}
          className={cn("shrink-0 [&]:rounded-[14px]", isCancelled && "[filter:grayscale(0.6)]")}
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-text-title text-[17px] leading-tight font-semibold">{order.store.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <OrderCodeCopyButton code={order.humanReadableId} locale={locale} />
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                statusChipClass(order.status),
              )}
            >
              <StatusChipIcon status={order.status} className="size-3.5" />
              {t(`detail.status.${order.status}`)}
            </span>
            {showOverdueChip && (
              <span className="border-warning/35 bg-warning/15 text-warning inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
                <AlertTriangle className="size-3.5" aria-hidden />
                {t("detail.hero.chipOverdue", { days: overdueDays })}
              </span>
            )}
            {showUnpaidChip && (
              <span className="border-warning/35 bg-warning/15 text-warning inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
                <AlertTriangle className="size-3.5" aria-hidden />
                {t("detail.hero.chipUnpaid")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* S8 chip eyebrow — top accent border + tinted pill identify this card as the
          order identity / main content. Order date intentionally lives in the meta line
          below (and in Historial), not as a standalone Calendar row. */}
      <Eyebrow variant="chip" tone="accent" icon={Package} className="mt-3">
        {t("detail.hero.eyebrow")} · {order.currencyCode}
      </Eyebrow>

      {/* Amount block — matches demo `.detail-hero-amount` + `.detail-hero-amount-sub`.
          Fully-paid swap: when the saldo settles at 0 we replace `Saldo pendiente · $0.00`
          with an icon + status text in `text-success` so the hero reads as a state, not a
          dead "$0.00" value. The `de $TOTAL` sub line stays so the user still sees what
          the total was. */}
      <div className="mt-3">
        {showPaidStatus ? (
          <div className="text-success flex items-center gap-2 leading-none">
            <CircleCheck className="size-7 shrink-0" aria-hidden strokeWidth={2.25} />
            <span className="text-[clamp(22px,3.5vw,28px)] font-bold tracking-[0.04em] uppercase">
              {t("detail.hero.paidInFull")}
            </span>
          </div>
        ) : (
          <>
            <div className="text-text-secondary text-[13px]">{heroLabel}</div>
            <div className={amountClass}>
              {/* Round the animated value so currency formatter receives an integer of minor units */}
              {formatAmountSymbolOnly(Math.round(animatedAmount), order.currencyCode, locale)}
            </div>
          </>
        )}
        {showSubAmount && (
          <div className="text-text-secondary mt-1 text-[14px] tabular-nums">
            {t("detail.hero.totalDe", {
              total: formatAmountWithSymbol(order.totalCost, order.currencyCode, locale),
            })}
          </div>
        )}

        {showProgress && (
          <div
            role="progressbar"
            aria-valuenow={pctForDisplay}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("detail.hero.paidPercent", { pct: pctForDisplay })}
            className="mt-4 h-1 w-full overflow-hidden rounded-full"
            style={{ background: "color-mix(in oklab, var(--text-primary) 8%, transparent)" }}
          >
            <span className="block h-full rounded-full" style={progressFillStyle} />
          </div>
        )}

        {isCancelled ? (
          <div className={cn("text-text-muted text-[12px] leading-snug", showProgress ? "mt-1.5" : "mt-3")}>
            {t("detail.hero.cancelledOn", { date: orderDateLabel })}
          </div>
        ) : (
          // Flex-wrap container with `gap-x-2` (~8px) reproduces the demo `·` rhythm while
          // letting each segment wrap as a unit. `aria-hidden` on the dot so screen readers
          // hear three discrete phrases instead of a literal middle-dot character.
          <div
            className={cn(
              "text-text-muted flex flex-wrap items-baseline gap-x-2 text-[12px] leading-snug",
              showProgress ? "mt-1.5" : "mt-3",
            )}
          >
            {/* Order: payment % → order date → estimated delivery. Payment % first so the
                animated counter sits closest to the progress bar that drives it. */}
            <span className="whitespace-nowrap">{t("detail.hero.metaPaidPct", { pct: pctRounded })}</span>
            <span aria-hidden>·</span>
            <span className="whitespace-nowrap">{t("detail.hero.metaOrdered", { date: orderDateLabel })}</span>
            {expectedToLabel && (
              <>
                <span aria-hidden>·</span>
                <span className="whitespace-nowrap">{t("detail.hero.metaEstimate", { date: expectedToLabel })}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { AlertTriangle, ArrowUpRight, CircleCheck, Package, PackageCheck, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Eyebrow from "@/components/core/Eyebrow";
import ProgressBar from "@/components/core/ProgressBar";
import StoreAvatar from "@/components/core/StoreAvatar";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { cn } from "@/lib/styles";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { formatAmountSymbolOnly } from "@/lib/currency";
import { formatDomainDate } from "@/lib/domainDate";
import { resolveStoreTombstone } from "@/lib/store/storeTombstone";
import type { OrderStatus, StoreRemovalReason, StoreStatus } from "../../../../../../../generated/prisma/client";
import OrderCodeCopyButton from "./OrderCodeCopyButton";
import StoreTombstoneNotice from "../../_components/share/StoreTombstoneNotice";

type Store = {
  id: string;
  name: string;
  slug: string;
  status: StoreStatus;
  removalReason: StoreRemovalReason | null;
  logoUrl: string | null;
};

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
    needsExchangeRateUpdate: boolean;
    totalCost: number;
    status: OrderStatus;
  };
  /** Sum of every payment declared against this order (§ store-level payments). Live — refreshed
      on each add/delete payment so the "Asignado X de Y" line + progress bar animate. */
  allocatedAmountMinor: number;
  hasUnpaidBalance: boolean;
  isOverdue: boolean;
  overdueDays: number;
  /** The store's LIFETIME debt in this order's currency, read server-side. Only decides whether the
      store is in credit (`< 0`, `FR-05-63`): the credit branch reads this figure unchanged, since
      "in credit" is a fact about the store's whole history, not about its open orders alone. Never
      used to print the positive-debt figure itself; see {@link openOrderDebtMinor}. */
  storeDebtMinor: number;
  /** `StoreDebtRow.openOrderDebtMinor` (`ADR 0033`, `BR-05-26` / `FR-05-61`): the figure the
      positive-debt link prints. Surfaced only while nothing is allocated to THIS order yet, so a
      collector who hasn't logged a payment here still sees what they already owe the store from
      other open orders (a fully delivered order does not contribute here even if it still carries
      an unregistered balance). Deliberately NOT clamped: see `openOrderDebtMinor`'s own doc. */
  openOrderDebtMinor: number;
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
  allocatedAmountMinor,
  hasUnpaidBalance,
  isOverdue,
  overdueDays,
  storeDebtMinor,
  openOrderDebtMinor,
  locale,
}: OrderDetailHeroProps) {
  const t = useTranslations("orders");

  const storeTombstone = resolveStoreTombstone(order.store);
  // Reciprocal with the store page's "Volver al pedido {orderId}" back link (FRD-04): this order
  // detail page IS the `returnTo` target, and the order's own code is the `returnLabel` it reads.
  const orderDetailPath = `/${locale}${ROUTES.orders}/${order.id}`;
  const storeHref = `/${locale}${ROUTES.stores}/${order.store.slug}?returnTo=${encodeURIComponent(orderDetailPath)}&returnLabel=${encodeURIComponent(order.humanReadableId)}`;
  const isCancelled = order.status === "CANCELLED";
  const isCompleted = order.status === "COMPLETED";
  const completedUnpaid = isCompleted && hasUnpaidBalance;

  const showOverdueChip = isOverdue && !isCancelled && !isCompleted;
  const showUnpaidChip = completedUnpaid;

  // Store-level payments: the hero's main figure is always the order's TOTAL — a stable number
  // that never moves as payments come and go. What sits below it depends on whether anything has
  // been declared against THIS order yet:
  //  - allocated > 0 → "Asignado X de Y" + a progress bar (allocated / total).
  //  - allocated === 0 → no progress bar; instead a link into the store's own debt figure, since
  //    the collector likely already owes the store from other orders.
  // Neither line renders on a cancelled order, which keeps its own "Cancelado el {date}" meta line.
  const hasAllocation = allocatedAmountMinor > 0;
  const isFullyAllocated = order.totalCost > 0 && allocatedAmountMinor >= order.totalCost;
  const showPaidInFullBadge = !isCancelled && isFullyAllocated;

  // Counter-roll animation when the allocated amount (and the percentage it drives) changes,
  // after add/delete payment.
  const animatedAllocated = useAnimatedNumber(allocatedAmountMinor);
  const allocatedPct =
    order.totalCost === 0 ? 0 : Math.min(100, Math.max(0, Math.floor((allocatedAmountMinor / order.totalCost) * 100)));
  const animatedPct = useAnimatedNumber(allocatedPct);
  const pctForDisplay = Math.round(allocatedPct); // settled value for the aria label

  // Amount color: dimmed secondary on cancelled (matches demo `s7-order-detail-cancelled`, which
  // uses `color:var(--text-secondary)` on the hero amount), default text-title otherwise. The
  // total is a neutral, stable figure now, so it no longer takes a warning tint — that signal
  // lives in the "Saldo pendiente" chip instead.
  const amountClass = cn(
    "tabular-nums font-bold leading-none tracking-[-0.03em] text-[clamp(32px,5vw,40px)]",
    isCancelled ? "text-text-secondary" : "text-text-title",
  );

  // The bar itself is `<ProgressBar>`; `useAnimatedNumber` drives its value per frame (and snaps
  // under reduced-motion), so it opts out of the component's own CSS easing — two interpolations
  // stacked would drift the fill away from the counter above it.
  const progressTone = completedUnpaid || isOverdue ? "warning" : "accent";

  // Credit is decided on the LIFETIME debt (`FR-05-63`): "in credit" is a fact about the store's
  // whole history, not about its open orders alone. The positive-debt figure itself is
  // `openOrderDebtMinor` (`ADR 0033`): a fully delivered order leaves this link together with its
  // own payments, so it never re-inflates once an order that carried this debt is settled.
  const isCreditAtStore = storeDebtMinor < 0;
  const showDebtLink = isCreditAtStore || openOrderDebtMinor !== 0;
  const debtLabel = isCreditAtStore
    ? t("detail.hero.storeCreditLink", {
        amount: formatAmountSymbolOnly(Math.abs(storeDebtMinor), order.currencyCode, locale),
      })
    : t("detail.hero.storeDebtLink", {
        amount: formatAmountSymbolOnly(openOrderDebtMinor, order.currencyCode, locale),
      });

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
        {order.store.logoUrl ? (
          <StoreAvatar
            store={{ name: order.store.name, logo: { src: order.store.logoUrl, aspect: "square" } }}
            size={56}
            className={cn("shrink-0 [&]:rounded-[14px]", isCancelled && "[filter:grayscale(0.6)]")}
          />
        ) : (
          <StoreAvatar
            store={{ name: order.store.name }}
            size={56}
            className={cn("shrink-0 [&]:rounded-[14px]", isCancelled && "[filter:grayscale(0.6)]")}
          />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-text-title text-[17px] leading-tight font-semibold">
            <Link
              href={storeHref}
              className="rounded-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]"
              data-ph-event={POSTHOG_EVENTS.ORDER.VIEW_STORE_CLICKED}
              data-ph-props={JSON.stringify({ source: "detail_hero" })}
            >
              {order.store.name}
            </Link>
          </h1>
          {storeTombstone.isRemoved && <StoreTombstoneNotice tone={storeTombstone.tone} variant="full" />}
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
            {showPaidInFullBadge && (
              <span className="border-success/35 bg-success/15 text-success inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
                <CircleCheck className="size-3.5" aria-hidden />
                {t("detail.hero.paidInFull")}
              </span>
            )}
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
            {order.needsExchangeRateUpdate && !isCancelled && (
              <span className="border-warning/35 bg-warning/15 text-warning inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
                <AlertTriangle className="size-3.5" aria-hidden />
                {t("detail.hero.chipFxPending")}
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

      {/* Amount block — the total is the stable headline figure; what changes underneath it is
          the allocation state (see the block comment above `hasAllocation`). */}
      <div className="mt-3">
        <div className="text-text-secondary text-[13px]">{t("detail.hero.total")}</div>
        <div className={amountClass}>{formatAmountSymbolOnly(order.totalCost, order.currencyCode, locale)}</div>

        {!isCancelled &&
          (hasAllocation ? (
            <>
              <div className="text-text-secondary mt-1 text-[14px] tabular-nums">
                {t("detail.hero.allocatedOfTotal", {
                  allocated: formatAmountSymbolOnly(Math.round(animatedAllocated), order.currencyCode, locale),
                  total: formatAmountSymbolOnly(order.totalCost, order.currencyCode, locale),
                })}
              </div>
              <ProgressBar
                value={animatedPct}
                valueNow={pctForDisplay}
                transition={false}
                tone={progressTone}
                label={t("detail.hero.allocatedPercentAria", { pct: pctForDisplay })}
                // The whole sentence, with both operands and the residual: "Ya pagaste X de Y.
                // Falta Z." A percentage alone makes a screen reader user do the subtraction the
                // sighted reader gets for free.
                valueText={t("detail.payments.heroProgressSentence", {
                  paid: formatAmountSymbolOnly(allocatedAmountMinor, order.currencyCode, locale),
                  total: formatAmountSymbolOnly(order.totalCost, order.currencyCode, locale),
                  remaining: formatAmountSymbolOnly(
                    Math.max(0, order.totalCost - allocatedAmountMinor),
                    order.currencyCode,
                    locale,
                  ),
                })}
                className="mt-2 w-full"
              />
            </>
          ) : (
            // Nothing declared against THIS order yet. A debt link only makes sense when there is
            // something to say: a credit (lifetime `storeDebtMinor < 0`, the existing "A favor"
            // link), or a positive `openOrderDebtMinor`. At exactly 0 on both the collector owes
            // this store nothing open, so the line is omitted entirely rather than rendering a
            // "Deuda de la tienda: 0.00" link to nowhere.
            showDebtLink && (
              <Link
                href={storeHref}
                className={cn(
                  "mt-1 inline-flex items-center gap-1 text-[14px] font-medium hover:underline",
                  isCreditAtStore ? "text-success" : "text-text-secondary",
                )}
              >
                {debtLabel}
                <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
              </Link>
            )
          ))}

        {isCancelled ? (
          <div className="text-text-muted mt-3 text-[12px] leading-snug">
            {t("detail.hero.cancelledOn", { date: orderDateLabel })}
          </div>
        ) : (
          // Flex-wrap container with `gap-x-2` (~8px) reproduces the demo `·` rhythm while
          // letting each segment wrap as a unit. `aria-hidden` on the dot so screen readers
          // hear discrete phrases instead of a literal middle-dot character.
          <div className="text-text-muted mt-2 flex flex-wrap items-baseline gap-x-2 text-[12px] leading-snug">
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

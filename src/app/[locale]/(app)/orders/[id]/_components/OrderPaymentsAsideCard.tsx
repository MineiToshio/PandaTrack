"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CircleDollarSign, CircleOff, ExternalLink, Wallet } from "lucide-react";
import Chip from "@/components/core/Chip";
import Eyebrow, { type EyebrowTone } from "@/components/core/Eyebrow";
import { cn } from "@/lib/styles";
import { ROUTES } from "@/lib/constants";
import type { PaymentSummary } from "@/lib/orders/paymentSummary";
import type { OrderStatus } from "../../../../../../../generated/prisma/client";
import { formatAmountSymbolOnly } from "@/lib/currency";
import type { OrderMarkReconciliation } from "@/lib/orders/productPaymentState";
import OrderPaymentRow from "./OrderPaymentRow";
import OrderInlinePaymentForm, {
  type OrderInlinePaymentOutcome,
  type OrderInlinePaymentSubmission,
} from "./OrderInlinePaymentForm";
import type { BreakdownItem } from "@/lib/orders/orderPaymentBreakdown";

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
 * A payment as this order sees it: one TRANSFER, carrying this order's total claim on it plus the
 * payment's own id/total/shared flag, so this card (and the row's delete-confirm modal) can
 * describe the shared case without a second query. Mirrors `OrderPaymentRecord` (see
 * `orderPaymentAllocations.ts`), where `id` is the payment id because that is what an order-scoped
 * delete acts on.
 */
type PaymentRecord = {
  id: string;
  amount: number;
  paymentDate: Date;
  paymentId: string;
  paymentTotalMinor: number;
  isShared: boolean;
  isPartialClaim: boolean;
  /** Products of this order the transfer names. `0` = it sits on the order as a whole. */
  detailedLineCount: number;
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
  /** Money declared against this order without naming a product. Rendered as its own figure. */
  undetailedPaidMinor: number;
  /** The order's products, threaded into the payment form's breakdown panel. */
  breakdownItems: BreakdownItem[];
  /** The order's own total. The denominator of the breakdown's by-price percentage. */
  totalCost: number;
  /**
   * This order's own canonical NET balance (`BR-05-32`, `ADR 0034`), threaded into the inline
   * payment form's writable ceiling. Optional and defaulting to `summary.remainingAmount` (the
   * GROSS balance this card already renders everywhere else): most callers carry no reconciliation
   * write-off, and a caller that never asks about one gets the pre-existing behaviour unchanged.
   */
  openBalanceMinor?: number;
  /** Coverage marks against this order's items, computed over EVERY item (see the pure rule). */
  markReconciliation: OrderMarkReconciliation;
  /** Handlers are owned by the parent; this card only triggers them via UI events. */
  onAddPayment: (submission: OrderInlinePaymentSubmission) => Promise<OrderInlinePaymentOutcome>;
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
      undetailedPaidMinor,
      breakdownItems,
      totalCost,
      openBalanceMinor,
      markReconciliation,
      onAddPayment,
      onDeletePayment,
      showAddCta = true,
      className,
    },
    ref,
  ) {
    const t = useTranslations("orders");
    const [showForm, setShowForm] = useState(false);
    // The amount the panel opens with, or `null` for the plain "Anotar pago" path. Only the
    // contradiction notice sets it, because only its label already names a figure.
    const [prefillMinor, setPrefillMinor] = useState<number | null>(null);
    const addCtaRef = useRef<HTMLButtonElement>(null);

    useImperativeHandle(ref, () => ({
      openForm: () => {
        setPrefillMinor(null);
        setShowForm(true);
      },
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

    /** The plain path: an empty amount, because nothing on the way in named one. */
    function handleOpenForm() {
      setPrefillMinor(null);
      setShowForm(true);
    }

    /**
     * The contradiction notice's own path. Its label reads "Registrar {amount}", so the panel opens
     * holding that exact amount: a CTA that names a figure and lands on an empty field with a greyed
     * submit is a promise the panel does not keep, and the collector has to retype what the button
     * just told them.
     */
    function handleOpenFormWithBalance() {
      setPrefillMinor(summary.remainingAmount);
      setShowForm(true);
    }

    function closeForm() {
      setShowForm(false);
      setPrefillMinor(null);
      // Without this the focus falls to `<body>` when the panel unmounts, and the next Tab leaves
      // the card entirely. The CTA the panel came from is where the collector was.
      requestAnimationFrame(() => addCtaRef.current?.focus());
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
          {/* The milestone is the ORDER, not the instalment: once the last centavo lands, the card
              itself says so (tone `success` via `derivePaymentsTone`, and the heading with it). */}
          <Eyebrow as="h2" variant="chip" tone={tone} icon={Wallet} id="payments-aside-heading">
            {isFullyPaid ? t("detail.payments.summaryFullyPaid") : t("detail.payments.sectionTitle")}
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

          {/* The money that named no product, stated where it is instead of split across items. */}
          {undetailedPaidMinor > 0 && (
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-text-muted text-[12px]">{t("detail.payments.undetailed")}</span>
              <span className="text-text-secondary text-[12px] tabular-nums">
                {formatAmountSymbolOnly(undetailedPaidMinor, currencyCode, locale)}
              </span>
            </div>
          )}

          {markReconciliation.totalCount > 0 && (
            <p className="text-text-muted text-[12px]">
              {t("detail.payments.markedCount", {
                marked: markReconciliation.markedCount,
                total: markReconciliation.totalCount,
              })}
            </p>
          )}
        </div>

        {/* The one place the two axes are allowed to meet: the collector says every product is
            paid and the order still owes money. Tone `info`, never `warning`: this is unusual
            information, not a fault, and the collector did nothing wrong. It states what is missing
            and offers the one action that resolves it with the books intact. Suppressed once
            cancelled: a cancelled order's open balance is money that will never be collected, not a
            live contradiction the collector still needs to resolve. */}
        {markReconciliation.reason === "allMarked" && !isCancelled && (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 rounded-[var(--radius-md)] p-3 text-[12.5px] [color:var(--text-secondary)] [background:color-mix(in_oklch,var(--info)_8%,transparent)]"
          >
            <p>
              {t("detail.payments.allMarkedOpenBalance", {
                amount: formatAmountSymbolOnly(summary.remainingAmount, currencyCode, locale),
              })}
            </p>
            {/* `showAddCta` and not just `canAddPayment`: on mobile this card renders with the CTA
                off because the sticky bar is the single source of truth for "Anotar pago" (spec
                §5.8), and it routes through `OrderPaymentMobileSheet`. Without this gate the notice
                mounted the DESKTOP panel inside the card, keyboard-first (`autoFocus` defaults to
                true), over the very quick-picks the sheet exists to keep reachable. */}
            {canAddPayment && !showForm && showAddCta && (
              <button
                type="button"
                onClick={handleOpenFormWithBalance}
                className="mt-1.5 inline-flex min-h-9 items-center text-[12.5px] font-medium [color:var(--accent)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]"
              >
                {t("detail.payments.allMarkedOpenBalanceCta", {
                  amount: formatAmountSymbolOnly(summary.remainingAmount, currencyCode, locale),
                })}
              </button>
            )}
          </div>
        )}

        {canAddPayment && !showForm && showAddCta && (
          // Demo `.btn.accent.full`: min-h 40px · padding 10px 16px · radius 8px · 14px / 500 · gap 8px
          <button
            ref={addCtaRef}
            type="button"
            onClick={handleOpenForm}
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
          /* Optimistic confirmation still governs the plain path: the form dismisses itself in the
             SAME tick as the submit so the collector watches the hero bar move instead of a
             spinner. What changed is that the form now owns the exception (a breakdown draft is
             worth waiting for a verdict on), so the rule lives in one place for both breakpoints
             instead of being written twice, here and in the mobile sheet. */
          <OrderInlinePaymentForm
            currencyCode={currencyCode}
            remainingAmount={summary.remainingAmount}
            orderDate={orderDate}
            locale={locale}
            initialAmountMinor={prefillMinor ?? undefined}
            items={breakdownItems}
            orderTotalCostMinor={totalCost}
            undetailedPaidMinor={undetailedPaidMinor}
            openBalanceMinor={openBalanceMinor ?? summary.remainingAmount}
            onCancel={closeForm}
            onSubmit={onAddPayment}
            onSubmitted={closeForm}
          />
        )}
      </section>
    );
  },
);

export default OrderPaymentsAsideCard;

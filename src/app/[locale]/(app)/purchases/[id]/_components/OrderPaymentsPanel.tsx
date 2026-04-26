"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Receipt } from "lucide-react";
import Button from "@/components/core/Button/Button";
import Typography from "@/components/core/Typography";
import SectionSurfaceCard from "@/components/modules/SectionSurfaceCard";
import { calculatePaymentSummary } from "@/lib/orders/paymentSummary";
import type { PaymentSummary } from "@/lib/orders/paymentSummary";
import type { OrderStatus } from "../../../../../../../generated/prisma/client";
import { addPaymentAction, deletePaymentAction } from "../_actions/orderPaymentActions";
import OrderPaymentRow from "./OrderPaymentRow";
import OrderPaymentForm from "./OrderPaymentForm";
import OrderPaymentSummaryCard from "./OrderPaymentSummaryCard";

type PaymentRecord = { id: string; amount: number; paymentDate: Date };

const PAYMENTS_LIST_HEADING_ID = "payments-list-heading";

/**
 * After a Server Action, Next may re-fetch RSC and reset scroll; devtools also show a short "Rendering" state.
 * Restore window scroll and optionally move focus to the section title without scrolling the page.
 */
function stabilizePaymentsPanelAfterMutation(scrollY: number, focusHeading: boolean) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
      if (focusHeading) {
        document.getElementById(PAYMENTS_LIST_HEADING_ID)?.focus({ preventScroll: true });
      }
    });
  });
}

type OrderPaymentsPanelProps = {
  orderId: string;
  totalCost: number;
  initialPayments: PaymentRecord[];
  initialSummary: PaymentSummary;
  hasUnpaidBalance: boolean;
  status: OrderStatus;
  currencyCode: string;
  orderDate: Date;
  locale: string;
};

export default function OrderPaymentsPanel({
  orderId,
  totalCost,
  initialPayments,
  initialSummary,
  hasUnpaidBalance: initialHasUnpaidBalance,
  status,
  currencyCode,
  orderDate,
  locale,
}: OrderPaymentsPanelProps) {
  const t = useTranslations("orders");
  const [payments, setPayments] = useState<PaymentRecord[]>(initialPayments);
  const [summary, setSummary] = useState<PaymentSummary>(initialSummary);
  const [hasUnpaidBalance, setHasUnpaidBalance] = useState(initialHasUnpaidBalance);
  const [showForm, setShowForm] = useState(false);
  const paymentFormAnchorRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!showForm) return;
    paymentFormAnchorRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
  }, [showForm]);

  function recalculate(updatedPayments: PaymentRecord[]) {
    const newSummary = calculatePaymentSummary(totalCost, updatedPayments);
    setSummary(newSummary);
    setHasUnpaidBalance(newSummary.remainingAmount > 0);
  }

  const lastPayment = payments.length > 0 ? payments[0] : null;

  async function handleAddPayment(amount: number, paymentDate: Date): Promise<{ ok: boolean; error?: string }> {
    const scrollY = window.scrollY;
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticPayment: PaymentRecord = { id: optimisticId, amount, paymentDate };

    // optimistic: insert row sorted by paymentDate desc
    const optimisticList = [optimisticPayment, ...payments].sort(
      (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime(),
    );
    setPayments(optimisticList);
    recalculate(optimisticList);

    const result = await addPaymentAction(orderId, amount, paymentDate, currencyCode);

    if (result.ok) {
      // reconcile with server response
      setPayments(result.payments);
      setSummary({
        paidAmount: result.paidAmount,
        remainingAmount: result.remainingAmount,
        paymentPercentage: result.paymentPercentage,
      });
      setHasUnpaidBalance(result.remainingAmount > 0);
      setShowForm(false);
      stabilizePaymentsPanelAfterMutation(scrollY, true);
      return { ok: true };
    }

    setPayments(payments);
    recalculate(payments);
    stabilizePaymentsPanelAfterMutation(scrollY, false);
    return { ok: false, error: result.error };
  }

  async function handleDeletePayment(paymentId: string): Promise<{ ok: boolean; error?: string }> {
    const scrollY = window.scrollY;
    const previousPayments = payments;

    // optimistic remove
    const optimisticList = payments.filter((p) => p.id !== paymentId);
    setPayments(optimisticList);
    recalculate(optimisticList);

    const result = await deletePaymentAction(paymentId, orderId);

    if (result.ok) {
      setPayments(result.payments);
      setSummary({
        paidAmount: result.paidAmount,
        remainingAmount: result.remainingAmount,
        paymentPercentage: result.paymentPercentage,
      });
      setHasUnpaidBalance(result.remainingAmount > 0);
      stabilizePaymentsPanelAfterMutation(scrollY, false);
      return { ok: true };
    }

    setPayments(previousPayments);
    recalculate(previousPayments);
    stabilizePaymentsPanelAfterMutation(scrollY, false);
    return { ok: false, error: result.error };
  }

  const isFullyPaid = summary.paymentPercentage >= 100;

  return (
    <section className="space-y-6" aria-label={t("detail.payments.sectionTitle")}>
      <div role="region" aria-label={t("detail.payments.summaryRegionAria")}>
        <OrderPaymentSummaryCard
          summary={summary}
          hasUnpaidBalance={hasUnpaidBalance}
          status={status}
          currencyCode={currencyCode}
          lastPaymentDate={lastPayment ? new Date(lastPayment.paymentDate) : null}
          locale={locale}
        />
      </div>

      <SectionSurfaceCard
        title={t("detail.payments.listSectionTitle")}
        titleId={PAYMENTS_LIST_HEADING_ID}
        titleAs="h2"
        icon={Receipt}
        iconClassName="text-success"
        headerEnd={
          !isFullyPaid && !showForm ? (
            <Button
              type="button"
              variant="link"
              onClick={() => setShowForm(true)}
              className="max-w-full shrink-0 text-end"
            >
              {t("detail.payments.addCta")}
            </Button>
          ) : null
        }
      >
        {payments.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="space-y-1">
              <Typography size="sm" className="text-text-title font-medium">
                {t("detail.payments.emptyTitle")}
              </Typography>
              <Typography size="xs" className="text-text-muted">
                {t("detail.payments.emptyHelper")}
              </Typography>
            </div>
            {!isFullyPaid && !showForm && (
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(true)}>
                {t("detail.payments.addCta")}
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-border/50 list-none divide-y" role="list" aria-labelledby={PAYMENTS_LIST_HEADING_ID}>
            {payments.map((payment) => (
              <OrderPaymentRow
                key={payment.id}
                payment={payment}
                currencyCode={currencyCode}
                locale={locale}
                onDeleted={(id) => {
                  const updated = payments.filter((p) => p.id !== id);
                  setPayments(updated);
                  recalculate(updated);
                }}
                onConfirmDelete={handleDeletePayment}
              />
            ))}
          </ul>
        )}

        {showForm && (
          <div ref={paymentFormAnchorRef} className="border-border -mx-4 scroll-mt-24 border-t pt-4 sm:-mx-5">
            <div className="px-4 sm:px-5">
              <OrderPaymentForm
                orderId={orderId}
                currencyCode={currencyCode}
                remainingAmount={summary.remainingAmount}
                orderDate={orderDate}
                locale={locale}
                embedded
                onCancel={() => setShowForm(false)}
                onSubmit={handleAddPayment}
              />
            </div>
          </div>
        )}
      </SectionSurfaceCard>
    </section>
  );
}

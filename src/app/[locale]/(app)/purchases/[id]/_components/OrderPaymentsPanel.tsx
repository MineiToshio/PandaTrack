"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Banknote } from "lucide-react";
import Button from "@/components/core/Button/Button";
import Typography from "@/components/core/Typography";
import SectionTitleWithAccent from "@/components/modules/SectionTitleWithAccent";
import { calculatePaymentSummary } from "@/lib/orders/paymentSummary";
import type { PaymentSummary } from "@/lib/orders/paymentSummary";
import type { OrderStatus } from "../../../../../../../generated/prisma/client";
import { addPaymentAction, deletePaymentAction } from "../_actions/orderPaymentActions";
import OrderPaymentRow from "./OrderPaymentRow";
import OrderPaymentForm from "./OrderPaymentForm";
import OrderPaymentSummaryCard from "./OrderPaymentSummaryCard";

type PaymentRecord = { id: string; amount: number; paymentDate: Date };

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

  function recalculate(updatedPayments: PaymentRecord[]) {
    const newSummary = calculatePaymentSummary(totalCost, updatedPayments);
    setSummary(newSummary);
    setHasUnpaidBalance(newSummary.remainingAmount > 0);
  }

  const lastPayment = payments.length > 0 ? payments[0] : null;

  async function handleAddPayment(amount: number, paymentDate: Date): Promise<{ ok: boolean; error?: string }> {
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
      return { ok: true };
    } else {
      // revert
      setPayments(payments);
      recalculate(payments);
      return { ok: false, error: result.error };
    }
  }

  async function handleDeletePayment(paymentId: string): Promise<{ ok: boolean; error?: string }> {
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
      return { ok: true };
    } else {
      // revert
      setPayments(previousPayments);
      recalculate(previousPayments);
      return { ok: false, error: result.error };
    }
  }

  const isFullyPaid = summary.paymentPercentage >= 100;

  return (
    <section aria-labelledby="payments-panel-heading" className="space-y-4">
      {/* Section header: title + add payment shortcut */}
      <div className="flex items-center justify-between gap-2">
        <SectionTitleWithAccent as="h2" id="payments-panel-heading">
          {t("detail.payments.sectionTitle")}
        </SectionTitleWithAccent>
        {!isFullyPaid && !showForm && payments.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setShowForm(true)}>
            {t("detail.payments.addCta")}
          </Button>
        )}
      </div>

      {/* Payment metrics */}
      <OrderPaymentSummaryCard
        summary={summary}
        hasUnpaidBalance={hasUnpaidBalance}
        status={status}
        currencyCode={currencyCode}
        lastPaymentDate={lastPayment ? new Date(lastPayment.paymentDate) : null}
        locale={locale}
      />

      {/* Payment list or empty state */}
      {payments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Banknote className="text-text-muted size-8" aria-hidden />
          <div className="space-y-1">
            <Typography size="sm" className="text-text-title font-medium">
              {t("detail.payments.emptyTitle")}
            </Typography>
            <Typography size="xs" className="text-text-muted">
              {t("detail.payments.emptyHelper")}
            </Typography>
          </div>
          {!isFullyPaid && !showForm && (
            <Button variant="secondary" size="md" onClick={() => setShowForm(true)}>
              {t("detail.payments.emptyCta")}
            </Button>
          )}
        </div>
      ) : (
        <ul className="divide-border/50 divide-y" role="list">
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
        <OrderPaymentForm
          orderId={orderId}
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
}

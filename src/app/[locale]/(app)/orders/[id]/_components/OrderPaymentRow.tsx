"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, X } from "lucide-react";
import Typography from "@/components/core/Typography";
import { Modal } from "@/components/modules/Modal";
import { formatAmountSymbolOnly } from "@/lib/currency";
import { formatDomainDate } from "@/lib/domainDate";

type PaymentRecord = {
  id: string;
  amount: number;
  paymentDate: Date;
  paymentId: string;
  paymentTotalMinor: number;
  isShared: boolean;
  /** This is the payment's only allocation, and it does not cover the payment's full amount — an
      unclaimed remainder rides along, so deleting this allocation deletes the whole payment. */
  isPartialClaim: boolean;
};

type OrderPaymentRowProps = {
  payment: PaymentRecord;
  currencyCode: string;
  locale: string;
  /** Store this order belongs to — only needed for the "part of a payment to {store}" copy on a
      shared payment. */
  storeName: string;
  /** Parent owns the payments list and removes the row when this resolves with `ok: true`. */
  onConfirmDelete: (paymentId: string) => Promise<{ ok: boolean; error?: string }>;
};

/**
 * Single row of the payments list. Layout mirrors the demo's `.pay-row`:
 * date (left) · amount (right, mono) · delete × button (far right, muted).
 * The amount always carries two decimals so it lines up across rows.
 *
 * Under store-level payments, a row is one order's allocation of a store payment, and the
 * delete-confirm copy has three variants depending on what deleting this allocation actually does:
 *  - 1:1 (`!isShared && !isPartialClaim`): the payment exists only for this declaration at its full
 *    amount, so removing it removes the payment too — the plain "delete this payment" copy applies.
 *  - shared (`isShared`): other orders also claim this payment, so only this order's slice goes —
 *    the copy is explicit that the rest of the payment survives.
 *  - partial claim (`isPartialClaim`): this is the payment's only allocation, but it does not cover
 *    the payment's full amount (an unclaimed remainder rides along "on account"). Deleting it still
 *    deletes the whole payment (`deleteOrderPayment` has no partial-allocation path for a sole
 *    claim), so the copy says so explicitly rather than implying only this order's slice goes — and
 *    the row's own subtitle names the payment's full amount for the same reason, so it never reads
 *    as if this order's amount were the entire payment.
 */
export default function OrderPaymentRow({
  payment,
  currencyCode,
  locale,
  storeName,
  onConfirmDelete,
}: OrderPaymentRowProps) {
  const t = useTranslations("orders");
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateLabel = formatDomainDate(payment.paymentDate, locale, { dateStyle: "medium" });
  const amountLabel = formatAmountSymbolOnly(payment.amount, currencyCode, locale);
  const paymentTotalLabel = formatAmountSymbolOnly(payment.paymentTotalMinor, currencyCode, locale);

  async function handleConfirm() {
    setIsPending(true);
    setError(null);
    const result = await onConfirmDelete(payment.id);
    setIsPending(false);
    if (result.ok) {
      setModalOpen(false);
    } else {
      setError(t("detail.payments.errorDelete"));
    }
  }

  return (
    <>
      {/* Demo `.pay-row`: gap 12px · py 6px · font 14px. No inter-row border — payments
          read as a single block; the only visible separator is the one between the last
          payment and the totals row (rendered by the parent aside card). */}
      <li className="flex items-start gap-3 py-1.5 text-[14px]">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <span className="text-text-muted font-mono text-[12px] tabular-nums">{dateLabel}</span>
          </div>
          {(payment.isShared || payment.isPartialClaim) && (
            <p className="text-text-muted mt-0.5 text-[11px] leading-snug">
              {t("detail.payments.sharedSubtitle", { paymentTotal: paymentTotalLabel, store: storeName })}
            </p>
          )}
        </div>
        <span className="text-text-title shrink-0 font-semibold tabular-nums">{amountLabel}</span>
        {/* Demo `.pay-row .pay-delete`: 28×28 · rounded 6px · transparent bg · muted icon */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          aria-label={t("detail.payments.deleteLabelDetailed", { amount: amountLabel, date: dateLabel })}
          className="text-text-muted hover:text-text-title focus-visible:ring-ring focus-visible:ring-offset-background grid size-7 shrink-0 cursor-pointer place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <X className="size-[13px]" aria-hidden />
        </button>
      </li>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t(
          payment.isShared
            ? "detail.payments.deleteModalTitleShared"
            : payment.isPartialClaim
              ? "detail.payments.deleteModalTitlePartial"
              : "detail.payments.deleteModalTitle",
        )}
        subtitle={
          payment.isShared
            ? t("detail.payments.deleteModalDescriptionShared", {
                amount: amountLabel,
                paymentTotal: paymentTotalLabel,
                store: storeName,
              })
            : payment.isPartialClaim
              ? t("detail.payments.deleteModalDescriptionPartial", {
                  paymentTotal: paymentTotalLabel,
                  store: storeName,
                })
              : t("detail.payments.deleteModalDescription")
        }
        icon={<Trash2 size={20} aria-hidden="true" />}
        tone="destructive"
        role="alertdialog"
        dismissible={false}
        primaryAction={{
          label: isPending ? "…" : t("detail.payments.deleteConfirm"),
          onClick: handleConfirm,
          variant: "destructive",
          loading: isPending,
          disabled: isPending,
        }}
        secondaryAction={{
          label: t("detail.payments.deleteCancel"),
          onClick: () => setModalOpen(false),
          disabled: isPending,
        }}
      >
        {error && (
          <Typography size="sm" className="text-destructive" role="alert">
            {error}
          </Typography>
        )}
      </Modal>
    </>
  );
}

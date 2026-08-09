"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, Wallet, X } from "lucide-react";
import Chip from "@/components/core/Chip";
import Eyebrow from "@/components/core/Eyebrow";
import Typography from "@/components/core/Typography";
import CollapsibleSection from "@/components/modules/CollapsibleSection";
import { Modal } from "@/components/modules/Modal";
import { formatAmountSymbolOnly } from "@/lib/currency";
import { formatDomainDate } from "@/lib/domainDate";
import type { StorePaymentListRow } from "@/lib/data/orders/storePaymentQueries";
import { useStorePaymentState } from "./StorePaymentStateProvider";

type StorePaymentsSectionProps = {
  locale: string;
};

/**
 * "Pagos a esta tienda": every `store_payment` the collector has made here, independent of which
 * order (if any) claims it. Both the order detail payments card and the store payment sheet work
 * through allocations, so a payment recorded "on account" (no allocation) or one whose remainder
 * was never declared has no other screen it can be seen or deleted from — this card is that door.
 * Renders nothing when the viewer has never paid this store.
 */
export default function StorePaymentsSection({ locale }: StorePaymentsSectionProps) {
  const tStores = useTranslations("stores");
  const { storePayments, storePaymentsTotalCount, deleteStorePayment } = useStorePaymentState();

  if (storePayments.length === 0) return null;

  const hiddenCount = Math.max(0, storePaymentsTotalCount - storePayments.length);

  return (
    <CollapsibleSection
      eyebrow={
        <Eyebrow variant="chip" tone="accent" icon={Wallet}>
          {tStores("redesign.detail.paymentsTitle")}
        </Eyebrow>
      }
      count={storePayments.length}
      topAccent="accent"
    >
      <ul role="list" className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
        {storePayments.map((payment) => (
          <StorePaymentListItem
            key={payment.id}
            payment={payment}
            locale={locale}
            onConfirmDelete={deleteStorePayment}
          />
        ))}
      </ul>
      {hiddenCount > 0 && (
        <p className="mt-2 [font-size:var(--text-caption)] [color:var(--text-muted)]">
          {tStores("redesign.detail.payments.moreCount", { count: hiddenCount })}
        </p>
      )}
    </CollapsibleSection>
  );
}

type StorePaymentListItemProps = {
  payment: StorePaymentListRow;
  locale: string;
  onConfirmDelete: (paymentId: string) => Promise<{ ok: boolean; error?: string }>;
};

/** One payment row: date · unassigned badge (when the payment isn't fully declared) · amount ·
    delete. Mirrors `OrderPaymentRow`'s layout so the two payment lists read as one family. */
function StorePaymentListItem({ payment, locale, onConfirmDelete }: StorePaymentListItemProps) {
  const tStores = useTranslations("stores");
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountLabel = formatAmountSymbolOnly(payment.amount, payment.currencyCode, locale);
  const dateLabel = formatDomainDate(payment.paymentDate, locale, { dateStyle: "medium" });
  const unassignedMinor = payment.amount - payment.allocatedTotal;
  const hasUnassigned = unassignedMinor > 0;

  async function handleConfirm() {
    setIsPending(true);
    setError(null);
    const result = await onConfirmDelete(payment.id);
    setIsPending(false);
    if (result.ok) {
      setModalOpen(false);
    } else {
      setError(tStores("redesign.detail.payments.errorDelete"));
    }
  }

  return (
    <>
      <li className="flex items-start gap-3 py-2 text-[14px]">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-text-muted font-mono text-[12px] tabular-nums">{dateLabel}</span>
            {hasUnassigned && (
              <Chip variant="warning" size="sm">
                {tStores("redesign.detail.payments.unassignedBadge", {
                  amount: formatAmountSymbolOnly(unassignedMinor, payment.currencyCode, locale),
                })}
              </Chip>
            )}
          </div>
          {payment.note && (
            <p className="text-text-muted mt-0.5 text-[11px] leading-snug">
              {tStores("redesign.detail.payments.noteLabel", { note: payment.note })}
            </p>
          )}
        </div>
        <span className="text-text-title shrink-0 font-semibold tabular-nums">{amountLabel}</span>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          aria-label={tStores("redesign.detail.payments.deleteAria", { amount: amountLabel, date: dateLabel })}
          className="text-text-muted hover:text-text-title focus-visible:ring-ring focus-visible:ring-offset-background grid size-7 shrink-0 cursor-pointer place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <X className="size-[13px]" aria-hidden />
        </button>
      </li>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={tStores("redesign.detail.payments.deleteModalTitle")}
        subtitle={
          payment.allocationsCount > 0
            ? tStores("redesign.detail.payments.deleteModalDescriptionWithAllocations", {
                amount: amountLabel,
                date: dateLabel,
                count: payment.allocationsCount,
              })
            : tStores("redesign.detail.payments.deleteModalDescription", { amount: amountLabel, date: dateLabel })
        }
        icon={<Trash2 size={20} aria-hidden="true" />}
        tone="destructive"
        role="alertdialog"
        dismissible={false}
        primaryAction={{
          label: isPending ? "…" : tStores("redesign.detail.payments.deleteConfirm"),
          onClick: handleConfirm,
          variant: "destructive",
          loading: isPending,
          disabled: isPending,
        }}
        secondaryAction={{
          label: tStores("redesign.detail.payments.deleteCancel"),
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

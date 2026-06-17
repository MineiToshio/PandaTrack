"use client";

import { useTranslations } from "next-intl";
import { CircleDollarSign } from "lucide-react";
import Modal from "@/components/modules/Modal/Modal";
import { formatAmountSymbolOnly } from "@/lib/currency";
import OrderInlinePaymentForm from "./OrderInlinePaymentForm";

type OrderPaymentMobileSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  currencyCode: string;
  remainingAmount: number;
  orderDate: Date;
  locale: string;
  onSubmit: (amount: number, paymentDate: Date) => Promise<{ ok: boolean; error?: string }>;
};

export default function OrderPaymentMobileSheet({
  isOpen,
  onClose,
  currencyCode,
  remainingAmount,
  orderDate,
  locale,
  onSubmit,
}: OrderPaymentMobileSheetProps) {
  const t = useTranslations("orders");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("detail.payments.addMobileCta")}
      role="dialog"
      tone="default"
      icon={<CircleDollarSign />}
      dismissible
    >
      <div className="space-y-4">
        <div
          className="rounded-xl border p-3 text-sm"
          style={{
            background: "color-mix(in oklch, var(--warning) 8%, var(--surface))",
            borderColor: "color-mix(in oklch, var(--warning) 28%, transparent)",
          }}
        >
          <div className="text-text-muted text-[11px] font-bold tracking-[0.06em] uppercase">
            {t("detail.payments.saldoPendiente")}
          </div>
          <div className="text-warning mt-1 text-xl font-bold tabular-nums">
            {formatAmountSymbolOnly(remainingAmount, currencyCode, locale)}
          </div>
        </div>

        <OrderInlinePaymentForm
          currencyCode={currencyCode}
          remainingAmount={remainingAmount}
          orderDate={orderDate}
          locale={locale}
          onCancel={onClose}
          onSubmit={async (amount, date) => {
            // Fire-and-forget (optimistic confirmation): close the sheet immediately so the
            // user sees the hero amount + progress bar animate behind it. The parent's
            // `handleAddPayment` owns the optimistic patch + rollback + error toast — by the
            // time the server responds the sheet is gone, so any failure surfaces via toast
            // instead of an inline error in this now-unmounted form.
            void onSubmit(amount, date);
            onClose();
            return { ok: true };
          }}
        />
      </div>
    </Modal>
  );
}

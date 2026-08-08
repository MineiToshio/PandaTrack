"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Ban } from "lucide-react";
import Modal from "@/components/modules/Modal/Modal";
import Radio, { type RadioOption } from "@/components/core/Radio";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import { formatAmountSymbolOnly } from "@/lib/currency";
import { cancelOrderAction } from "../_actions/orderLifecycleActions";
import { MAX_CANCELLATION_REASON_LENGTH } from "@/lib/orders/orderValidation";

type PaymentsChoice = "credit" | "lost";

type OrderCancelModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  humanReadableId: string;
  storeName: string;
  /** Sum of the order's recorded payments, in minor units of `currencyCode`. Drives the
      payments-choice control (shown only when `hasPayments`) and its `{amount}` placeholder. */
  paidAmountMinor: number;
  currencyCode: string;
  /** Whether the order has any recorded payments. When false the payments-choice control is
      hidden and the order cancels exactly as before (no added friction). */
  hasPayments: boolean;
  onSuccess?: () => void;
};

const ERROR_MAP: Record<string, string> = {
  HAS_LIVE_DELIVERY_LINKS: "errorLinkedDelivery",
  server_error: "errorGeneral",
  unauthorized: "errorGeneral",
};

// Defaults to "credit": most cancellations are not a lost cause, they free the money to cover
// another order at the same store, so that is the choice that should require no action.
const DEFAULT_PAYMENTS_CHOICE: PaymentsChoice = "credit";

export default function OrderCancelModal({
  isOpen,
  onClose,
  orderId,
  humanReadableId,
  storeName,
  paidAmountMinor,
  currencyCode,
  hasPayments,
  onSuccess,
}: OrderCancelModalProps) {
  const t = useTranslations("orders");
  const locale = useLocale();
  const [reason, setReason] = useState("");
  const [paymentsChoice, setPaymentsChoice] = useState<PaymentsChoice>(DEFAULT_PAYMENTS_CHOICE);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paymentsChoiceOptions: RadioOption<PaymentsChoice>[] = [
    {
      value: "credit",
      label: t("detail.cancelModal.paymentsCreditLabel", { store: storeName }),
      description: t("detail.cancelModal.paymentsCreditHint"),
    },
    {
      value: "lost",
      label: t("detail.cancelModal.paymentsLostLabel"),
      description: t("detail.cancelModal.paymentsLostHint"),
      tone: "destructive",
    },
  ];

  async function handleConfirm() {
    setIsPending(true);
    setError(null);
    const result = await cancelOrderAction(orderId, reason.trim() || null, paymentsChoice);
    setIsPending(false);
    if (result.ok) {
      setReason("");
      setPaymentsChoice(DEFAULT_PAYMENTS_CHOICE);
      onSuccess?.();
      onClose();
    } else {
      const errKey = ERROR_MAP[result.error] ?? "errorGeneral";
      setError(t(`detail.cancelModal.${errKey}` as Parameters<typeof t>[0]));
    }
  }

  function handleClose() {
    if (isPending) return;
    setError(null);
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("detail.cancelModal.title")}
      subtitle={t("detail.cancelModal.subtitle")}
      role="alertdialog"
      tone="warning"
      icon={<Ban />}
      dismissible={!isPending}
      primaryAction={{
        label: t("detail.cancelModal.confirm"),
        onClick: () => void handleConfirm(),
        loading: isPending,
      }}
      secondaryAction={{
        label: t("detail.cancelModal.cancel"),
        onClick: handleClose,
        disabled: isPending,
      }}
    >
      <div className="space-y-3">
        {/* Body para — matches demo `#s7-order-detail-cancel-modal` paragraph above the reason field. */}
        <p className="text-text-secondary text-[13px] leading-snug">
          {t("detail.cancelModal.descriptionBase", { id: humanReadableId, store: storeName })}
        </p>

        {hasPayments && (
          <div className="border-border bg-surface-elevated rounded-lg border p-3">
            <p className="text-text-primary text-[13px] leading-snug font-medium">
              {t("detail.cancelModal.paymentsQuestion", {
                amount: formatAmountSymbolOnly(paidAmountMinor, currencyCode, locale),
              })}
            </p>
            <Radio
              name="cancel-payments-choice"
              value={paymentsChoice}
              onChange={setPaymentsChoice}
              options={paymentsChoiceOptions}
              disabled={isPending}
              className="mt-2.5"
            />
          </div>
        )}

        <label htmlFor="cancel-reason" className="text-text-secondary block text-[13px]">
          {t("detail.cancelModal.reasonLabel")}
        </label>
        <Textarea
          id="cancel-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={MAX_CANCELLATION_REASON_LENGTH}
          disabled={isPending}
          placeholder={t("detail.cancelModal.reasonPlaceholder")}
          className="resize-none"
        />
        {error && (
          <Typography size="sm" className="text-destructive" role="alert">
            {error}
          </Typography>
        )}
      </div>
    </Modal>
  );
}

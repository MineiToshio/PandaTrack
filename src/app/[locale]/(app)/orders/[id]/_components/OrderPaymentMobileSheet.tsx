"use client";

import { useTranslations } from "next-intl";
import { CircleDollarSign } from "lucide-react";
import Modal from "@/components/modules/Modal/Modal";
import { formatAmountSymbolOnly } from "@/lib/currency";
import OrderInlinePaymentForm, {
  type OrderInlinePaymentOutcome,
  type OrderInlinePaymentSubmission,
} from "./OrderInlinePaymentForm";
import type { BreakdownItem } from "@/lib/orders/orderPaymentBreakdown";

type OrderPaymentMobileSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  currencyCode: string;
  remainingAmount: number;
  orderDate: Date;
  locale: string;
  /** The order's products, threaded into the payment form's breakdown panel. */
  breakdownItems: BreakdownItem[];
  /** The order's own total. The denominator of the breakdown's by-price percentage. */
  totalCost: number;
  /** Money already on this order naming no product. Named by the breakdown, never split. */
  undetailedPaidMinor: number;
  /**
   * This order's own canonical NET balance (`BR-05-32`, `ADR 0034`), threaded into the inline
   * payment form's writable ceiling. Optional and defaulting to `remainingAmount` (the GROSS
   * balance this sheet's own subtitle already renders): a caller that never asks about a
   * reconciliation write-off gets the pre-existing behaviour unchanged.
   */
  openBalanceMinor?: number;
  onSubmit: (submission: OrderInlinePaymentSubmission) => Promise<OrderInlinePaymentOutcome>;
};

export default function OrderPaymentMobileSheet({
  isOpen,
  onClose,
  currencyCode,
  remainingAmount,
  orderDate,
  locale,
  breakdownItems,
  totalCost,
  undetailedPaidMinor,
  openBalanceMinor,
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
        {/* One line, not a panel. The four-line amber box that used to sit here repeated the
            balance that the "Todo · {amount}" chip and the submit button each already state. */}
        <p className="text-text-secondary text-[13px]">
          {t("detail.payments.mobileSubtitle", {
            amount: formatAmountSymbolOnly(remainingAmount, currencyCode, locale),
          })}
        </p>

        <OrderInlinePaymentForm
          currencyCode={currencyCode}
          remainingAmount={remainingAmount}
          orderDate={orderDate}
          locale={locale}
          // On a phone, focusing the amount field raises the keyboard over the quick-picks, which
          // are the whole one-tap path. The field stays one tap away for whoever wants to type.
          autoFocus={false}
          items={breakdownItems}
          orderTotalCostMinor={totalCost}
          undetailedPaidMinor={undetailedPaidMinor}
          openBalanceMinor={openBalanceMinor ?? remainingAmount}
          onCancel={onClose}
          // Optimistic confirmation by default (the sheet is dismissed in the same tick and the
          // coordinator's toast reports a refusal), with ONE exception the form owns: a breakdown
          // draft keeps the sheet up until the server answers. It has to be that way round here in
          // particular, because this surface is a `<Modal>` and the toast renders BEHIND it, so a
          // sheet that closed on a refusal would take the whole hand-typed draft with it and a
          // sheet that stayed open would show nothing at all.
          onSubmit={onSubmit}
          onSubmitted={onClose}
        />
      </div>
    </Modal>
  );
}

"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import DatePickerInput from "@/components/core/DatePickerInput";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";

type OrderPaymentFormProps = {
  orderId: string;
  currencyCode: string;
  remainingAmount: number;
  orderDate: Date;
  locale: string;
  onCancel: () => void;
  onSubmit: (amount: number, paymentDate: Date) => Promise<{ ok: boolean; error?: string }>;
  /**
   * When set, omits the standalone bordered card; parent provides layout (e.g. inside `SectionSurfaceCard`).
   */
  embedded?: boolean;
};

function parseDecimalToMinorUnits(value: string): number | null {
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

function formatAmount(amount: number, currencyCode: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(amount / 100);
  } catch {
    return `${currencyCode} ${(amount / 100).toFixed(2)}`;
  }
}

export default function OrderPaymentForm({
  currencyCode,
  remainingAmount,
  orderDate,
  locale,
  onCancel,
  onSubmit,
  embedded = false,
}: OrderPaymentFormProps) {
  const t = useTranslations("orders");
  const today = new Date();
  const amountInputRef = useRef<HTMLInputElement>(null);
  const [amountStr, setAmountStr] = useState("");

  /** After the form mounts (user opened “Registrar pago”), move focus to amount — runs after DOM commit. */
  useLayoutEffect(() => {
    amountInputRef.current?.focus();
  }, []);
  const [paymentDate, setPaymentDate] = useState<Date | null>(today);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = parseDecimalToMinorUnits(amountStr);
  const amountExceedsBalance = parsedAmount !== null && parsedAmount > remainingAmount;
  const dateBeforeOrder =
    paymentDate !== null && paymentDate < new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
  const dateFuture = paymentDate !== null && paymentDate > today;

  const canSubmit =
    parsedAmount !== null &&
    parsedAmount > 0 &&
    !amountExceedsBalance &&
    paymentDate !== null &&
    !dateBeforeOrder &&
    !dateFuture;

  async function handleSubmit() {
    if (!canSubmit || parsedAmount === null || paymentDate === null) return;
    setIsPending(true);
    setError(null);
    const result = await onSubmit(parsedAmount, paymentDate);
    setIsPending(false);
    if (!result.ok) {
      if (result.error === "EXCEEDS_BALANCE") {
        setError(
          t("detail.payments.amountExceedsBalance", { remaining: formatAmount(remainingAmount, currencyCode, locale) }),
        );
      } else if (result.error === "DATE_BEFORE_ORDER") {
        setError(t("detail.payments.dateBeforeOrder"));
      } else {
        setError(t("detail.payments.errorAdd"));
      }
    }
  }

  return (
    <div className={cn(embedded ? "space-y-3" : "border-border mt-2 space-y-3 rounded-xl border p-4")}>
      <form
        className="space-y-3"
        method="post"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void handleSubmit();
        }}
      >
        <div>
          <Label htmlFor="payment-amount">{t("detail.payments.amountLabel")}</Label>
          <Input
            ref={amountInputRef}
            id="payment-amount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder={t("detail.payments.amountPlaceholder")}
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            disabled={isPending}
            error={amountExceedsBalance}
            aria-invalid={amountExceedsBalance}
            className="mt-1"
          />
          {amountExceedsBalance && (
            <Typography size="xs" className="text-destructive mt-1" role="alert">
              {t("detail.payments.amountExceedsBalance", {
                remaining: formatAmount(remainingAmount, currencyCode, locale),
              })}
            </Typography>
          )}
        </div>

        <div>
          <Label htmlFor="payment-date">{t("detail.payments.dateLabel")}</Label>
          <div className="mt-1">
            <DatePickerInput
              id="payment-date"
              value={paymentDate}
              onChange={setPaymentDate}
              placeholder={t("detail.payments.datePlaceholder")}
              disabled={isPending}
              disableFuture
              locale={locale}
              error={dateBeforeOrder}
            />
          </div>
          {dateBeforeOrder && (
            <Typography size="xs" className="text-destructive mt-1" role="alert">
              {t("detail.payments.dateBeforeOrder")}
            </Typography>
          )}
        </div>

        {error && (
          <Typography size="xs" className="text-destructive" role="alert">
            {error}
          </Typography>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="md" onClick={onCancel} disabled={isPending}>
            {t("detail.payments.cancelAdd")}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={!canSubmit || isPending}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handleSubmit();
            }}
          >
            {isPending ? t("detail.payments.submittingPayment") : t("detail.payments.submitPayment")}
          </Button>
        </div>
      </form>
    </div>
  );
}

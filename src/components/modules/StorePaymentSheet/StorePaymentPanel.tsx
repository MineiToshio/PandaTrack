"use client";

import type { RefObject } from "react";
import { useTranslations } from "next-intl";
import DatePickerInput from "@/components/core/DatePickerInput";
import FieldErrorMsg from "@/components/core/FieldErrorMsg";
import Input from "@/components/core/Input";
import Select from "@/components/core/Select";
import Textarea from "@/components/core/Textarea";
import Button from "@/components/core/Button/Button";
import { formatAmountWithSymbol } from "@/lib/currency";
import { sanitizeDecimalInput } from "@/lib/decimalInput";
import type { StorePaymentSheetDebt } from "./StorePaymentSheet.types";

export const STORE_PAYMENT_AMOUNT_FIELD_ID = "store-payment-amount";
export const STORE_PAYMENT_DATE_FIELD_ID = "store-payment-date";

export type StorePaymentPanelProps = {
  debts: StorePaymentSheetDebt[];
  currencyCode: string;
  onCurrencyChange: (next: string) => void;
  locale: string;
  amount: string;
  amountRef: RefObject<HTMLInputElement | null>;
  onAmountChange: (raw: string) => void;
  amountTouched: boolean;
  exceedsDebt: boolean;
  debtMinor: number;
  paymentDate: Date | null;
  onDateChange: (date: Date | null) => void;
  dateError: string | null;
  hasDateBeforeOrderError: boolean;
  note: string;
  onNoteChange: (next: string) => void;
  /** How many lines the draft currently declares, and what they add up to. */
  allocationCount: number;
  allocatedMinor: number;
  /** Products this payment declares covered. Not money, so it is a suffix and never a total. */
  declaredCount: number;
  /** True when the draft's allocations are what is blocking the CTA. */
  hasAllocationError: boolean;
  /** Id of the entry button, so leaving the allocation panel can return focus to it. */
  openButtonId: string;
  onOpenAllocations: () => void;
  onClearAllocations: () => void;
};

/**
 * Panel A of the store payment sheet: the payment itself. This is the default and by far the most
 * travelled path (a payment with nothing declared is a legitimate result, recorded "on account"),
 * so it stays short — roughly seven tab stops from open to submit — and never waits on the
 * asynchronous order list, which is why the header subtitle it is described by cannot flicker.
 *
 * The allocation list does not live here. It gets its own panel, reached from the summary row at
 * the bottom, so it can take the whole body instead of competing with these fields for height.
 */
export default function StorePaymentPanel({
  debts,
  currencyCode,
  onCurrencyChange,
  locale,
  amount,
  amountRef,
  onAmountChange,
  amountTouched,
  exceedsDebt,
  debtMinor,
  paymentDate,
  onDateChange,
  dateError,
  hasDateBeforeOrderError,
  note,
  onNoteChange,
  allocationCount,
  allocatedMinor,
  declaredCount,
  hasAllocationError,
  openButtonId,
  onOpenAllocations,
  onClearAllocations,
}: StorePaymentPanelProps) {
  const t = useTranslations("orders.detail.storePayment");
  const isMultiCurrency = debts.length > 1;
  const hasAllocations = allocationCount > 0 || declaredCount > 0;

  return (
    <div className="space-y-4">
      {/* Debt readout — one line, for the currency actually selected. */}
      <div className="flex items-center justify-between gap-3 rounded-xl p-3 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
        <span className="[font-size:11px] font-bold tracking-[0.06em] [color:var(--text-muted)] uppercase">
          {t("debtLabel")}
        </span>
        <span
          className={
            debtMinor < 0
              ? "text-success [font-size:13px] font-medium tabular-nums"
              : "[font-size:13px] font-medium [color:var(--text-primary)] tabular-nums"
          }
        >
          {debtMinor < 0
            ? t("creditAmount", { amount: formatAmountWithSymbol(Math.abs(debtMinor), currencyCode || "USD", locale) })
            : t("debtAmount", { amount: formatAmountWithSymbol(debtMinor, currencyCode || "USD", locale) })}
        </span>
      </div>

      {isMultiCurrency && (
        <div className="space-y-1.5">
          <label
            htmlFor="store-payment-currency"
            className="[font-size:13px] font-medium [color:var(--text-secondary)]"
          >
            {t("currencyLabel")}
          </label>
          <Select
            id="store-payment-currency"
            value={currencyCode}
            onChange={(event) => onCurrencyChange(event.target.value)}
            showChevron
          >
            {debts.map((debt) => (
              <option key={debt.currencyCode} value={debt.currencyCode}>
                {debt.currencyCode}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor={STORE_PAYMENT_AMOUNT_FIELD_ID}
            className="[font-size:13px] font-medium [color:var(--text-secondary)]"
          >
            {t("amountLabel")} <span className="[color:var(--destructive)]">*</span>
          </label>
          <Input
            ref={amountRef}
            id={STORE_PAYMENT_AMOUNT_FIELD_ID}
            type="text"
            inputMode="decimal"
            value={amount}
            placeholder={t("amountPlaceholder")}
            error={amountTouched && exceedsDebt}
            onChange={(event) => onAmountChange(sanitizeDecimalInput(event.target.value, currencyCode))}
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor={STORE_PAYMENT_DATE_FIELD_ID}
            className="[font-size:13px] font-medium [color:var(--text-secondary)]"
          >
            {t("dateLabel")} <span className="[color:var(--destructive)]">*</span>
          </label>
          <DatePickerInput
            id={STORE_PAYMENT_DATE_FIELD_ID}
            value={paymentDate}
            error={hasDateBeforeOrderError}
            onChange={onDateChange}
            placeholder={t("datePlaceholder")}
            locale={locale}
            disableFuture
            popupAlign="end"
          />
          {dateError ? (
            <FieldErrorMsg>{dateError}</FieldErrorMsg>
          ) : (
            hasDateBeforeOrderError && <FieldErrorMsg>{t("dateBeforeOrder")}</FieldErrorMsg>
          )}
        </div>
      </div>

      {amountTouched && exceedsDebt && (
        <p role="alert" className="[font-size:12.5px] [color:var(--destructive)]">
          {t("exceedsDebt", { debt: formatAmountWithSymbol(debtMinor, currencyCode || "USD", locale) })}
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="store-payment-note" className="[font-size:13px] font-medium [color:var(--text-secondary)]">
          {t("noteLabel")}{" "}
          <span className="[font-size:11px] font-normal [color:var(--text-muted)]">{t("optional")}</span>
        </label>
        <Textarea
          id="store-payment-note"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder={t("notePlaceholder")}
          minRows={2}
          maxRows={4}
        />
      </div>

      {/* Summary row — the door into the allocation panel. Independent of the async order list, so
          it never flickers while the list loads. */}
      <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 [border:1px_solid_var(--border)]">
        <div className="min-w-0">
          <p className="[font-size:12.5px] font-medium [color:var(--text-secondary)]">
            {t("allocations.heading")}{" "}
            <span className="[font-size:11px] font-normal [color:var(--text-muted)]">{t("optional")}</span>
          </p>
          <p className="[font-size:11.5px] [color:var(--text-muted)] tabular-nums">
            {hasAllocations
              ? t("allocations.summaryAssigned", {
                  count: allocationCount,
                  amount: formatAmountWithSymbol(allocatedMinor, currencyCode || "USD", locale),
                })
              : t("allocations.summaryNone")}
            {declaredCount > 0 && ` · ${t("allocations.summaryMarked", { count: declaredCount })}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button id={openButtonId} variant="secondary" size="sm" onClick={onOpenAllocations}>
            {hasAllocationError
              ? t("allocations.review")
              : hasAllocations
                ? t("allocations.edit")
                : t("allocations.open")}
          </Button>
          {hasAllocations && (
            <Button variant="ghost" size="sm" onClick={onClearAllocations} aria-label={t("allocations.clearAria")}>
              {t("allocations.clear")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

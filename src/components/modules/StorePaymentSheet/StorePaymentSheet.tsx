"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDown, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import DatePickerInput from "@/components/core/DatePickerInput";
import FieldErrorMsg from "@/components/core/FieldErrorMsg";
import Input from "@/components/core/Input";
import Select from "@/components/core/Select";
import Textarea from "@/components/core/Textarea";
import Modal from "@/components/modules/Modal/Modal";
import { formatAmountWithSymbol } from "@/lib/currency";
import { sanitizeDecimalInput } from "@/lib/decimalInput";
import { parseDecimalToMinorUnits } from "@/lib/money/parseDecimalToMinorUnits";
import { cn } from "@/lib/styles";
import type { AssignableOrder } from "@/lib/data/orders/storePaymentAssignableOrdersQueries";
import {
  buildAllocationInputs,
  validateStorePaymentSheetDraft,
  type SheetOrderDraft,
  type StorePaymentSheetDraft,
} from "@/lib/orders/storePaymentSheetValidation";
import StorePaymentOrderAllocationRow from "./StorePaymentOrderAllocationRow";

export type StorePaymentSheetDebt = { currencyCode: string; debtMinor: number };

export type StorePaymentSheetSubmitInput = {
  amount: number;
  paymentDate: Date;
  currencyCode: string;
  note: string | null;
  allocations: ReturnType<typeof buildAllocationInputs>;
};

export type StorePaymentSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  storeName: string;
  /** One row per currency the collector has standing orders or payments with this store in. */
  debts: StorePaymentSheetDebt[];
  /** Every open order with an assignable balance, across every currency; filtered here by the
      selected payment currency. Loaded by the coordinator when the sheet opens. */
  orders: AssignableOrder[];
  ordersLoading: boolean;
  locale: string;
  /** Optimistic Confirmation: synchronous, fire-and-forget — the coordinator owns the patch,
      rollback and toast. The sheet never awaits this. */
  onSubmit: (input: StorePaymentSheetSubmitInput) => void;
};

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Domain dates travel as UTC-midnight instants; the picker emits local midnight. */
function toDomainDate(date: Date): Date {
  return new Date(`${toIsoDate(date)}T00:00:00.000Z`);
}

/**
 * "Registrar pago a {tienda}": records money handed to a store, with an optional declaration of
 * what it covers (§ store-level payments). The declaration list starts collapsed — most payments
 * are recorded "on account" and refined later, so the common path is amount + date + submit.
 *
 * Every client-side rule in `storePaymentSheetValidation.ts` runs live as the collector types, so
 * the primary CTA is only ever enabled on a draft the server is expected to accept; the server's
 * own refusal (`STORE_DEBT_EXCEEDED`, `EXCEEDS_BALANCE`, …) stays as the coordinator's safety net,
 * surfaced through a toast because the sheet has already closed by then (Optimistic Confirmation).
 */
export default function StorePaymentSheet({
  isOpen,
  onClose,
  storeName,
  debts,
  orders,
  ordersLoading,
  locale,
  onSubmit,
}: StorePaymentSheetProps) {
  const t = useTranslations("orders.detail.storePayment");

  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState<Date | null>(startOfToday);
  const [note, setNote] = useState("");
  const [currencyCode, setCurrencyCode] = useState(() => debts[0]?.currencyCode ?? "");
  const [showAllocations, setShowAllocations] = useState(false);
  const [orderAmounts, setOrderAmounts] = useState<Record<string, string>>({});
  const [itemAmounts, setItemAmounts] = useState<Record<string, string>>({});
  const [itemSettled, setItemSettled] = useState<Record<string, boolean>>({});
  const [dateError, setDateError] = useState<string | null>(null);

  const isMultiCurrency = debts.length > 1;
  const ordersForCurrency = useMemo(
    () => orders.filter((order) => order.currencyCode === currencyCode),
    [orders, currencyCode],
  );
  const debtForCurrency = debts.find((debt) => debt.currencyCode === currencyCode)?.debtMinor ?? 0;

  const resetDraftState = useCallback(() => {
    setOrderAmounts({});
    setItemAmounts({});
    setItemSettled({});
  }, []);

  const handleClose = useCallback(() => {
    setAmount("");
    setPaymentDate(startOfToday());
    setNote("");
    setCurrencyCode(debts[0]?.currencyCode ?? "");
    setShowAllocations(false);
    setDateError(null);
    resetDraftState();
    onClose();
  }, [debts, onClose, resetDraftState]);

  const handleCurrencyChange = useCallback(
    (next: string) => {
      setCurrencyCode(next);
      // A different currency means a different set of eligible orders — a draft amount typed
      // against last currency's orders would silently misattribute if it survived the switch.
      resetDraftState();
    },
    [resetDraftState],
  );

  const handleOrderAmountChange = useCallback((orderId: string, raw: string) => {
    setOrderAmounts((prev) => ({ ...prev, [orderId]: raw }));
  }, []);

  const handleItemAmountChange = useCallback((orderId: string, itemId: string, raw: string) => {
    setItemAmounts((prev) => ({ ...prev, [itemId]: raw }));
    if (raw.trim() !== "") setItemSettled((prev) => (prev[itemId] ? { ...prev, [itemId]: false } : prev));
  }, []);

  const handleItemSettledToggle = useCallback((_orderId: string, itemId: string) => {
    setItemSettled((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
    setItemAmounts((prev) => (prev[itemId] ? { ...prev, [itemId]: "" } : prev));
  }, []);

  const draft: StorePaymentSheetDraft = useMemo(() => {
    const amountMinor = parseDecimalToMinorUnits(amount, currencyCode) ?? 0;
    const orderDrafts: SheetOrderDraft[] = ordersForCurrency.map((order) => ({
      orderId: order.orderId,
      assignableMinor: order.assignableMinor,
      amountMinor: Math.max(0, parseDecimalToMinorUnits(orderAmounts[order.orderId] ?? "", currencyCode) ?? 0),
      items: order.items.map((item) => ({
        itemId: item.itemId,
        remainingBaseMinor: item.basePagableMinor != null ? item.basePagableMinor - item.allocatedMinor : null,
        amountMinor: Math.max(0, parseDecimalToMinorUnits(itemAmounts[item.itemId] ?? "", currencyCode) ?? 0),
        settled: itemSettled[item.itemId] ?? false,
      })),
    }));
    return { paymentAmountMinor: amountMinor, debtMinor: debtForCurrency, orders: orderDrafts };
  }, [amount, currencyCode, ordersForCurrency, orderAmounts, itemAmounts, itemSettled, debtForCurrency]);

  const validation = useMemo(() => validateStorePaymentSheetDraft(draft), [draft]);
  const amountTouched = amount.trim() !== "";

  const handleConfirm = useCallback(() => {
    if (!paymentDate) {
      setDateError(t("dateRequired"));
      return;
    }
    if (!validation.canSubmit) return;

    onSubmit({
      amount: draft.paymentAmountMinor,
      paymentDate: toDomainDate(paymentDate),
      currencyCode,
      note: note.trim() || null,
      allocations: buildAllocationInputs(draft.orders),
    });
    handleClose();
  }, [currencyCode, draft, handleClose, note, onSubmit, paymentDate, t, validation.canSubmit]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("title", { store: storeName })}
      subtitle={t("subtitle")}
      icon={<Wallet />}
      tone="default"
      primaryAction={{
        label: t("submit"),
        onClick: handleConfirm,
        disabled: !amountTouched || !validation.canSubmit,
      }}
      secondaryAction={{ label: t("cancel"), onClick: handleClose }}
    >
      <div className="space-y-4">
        {/* Debt readout — stacked per currency, always visible regardless of selection. */}
        <div className="rounded-xl p-3 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
          <div className="[font-size:11px] font-bold tracking-[0.06em] text-[color:var(--text-muted)] uppercase">
            {t("debtLabel")}
          </div>
          <div className="mt-1 space-y-0.5">
            {debts.map((debt) => (
              <div key={debt.currencyCode} className="flex items-center justify-between gap-2 text-[13px] tabular-nums">
                <span className="[color:var(--text-secondary)]">{debt.currencyCode}</span>
                <span
                  className={
                    debt.debtMinor < 0 ? "text-success font-medium" : "font-medium [color:var(--text-primary)]"
                  }
                >
                  {debt.debtMinor < 0
                    ? t("creditAmount", {
                        amount: formatAmountWithSymbol(Math.abs(debt.debtMinor), debt.currencyCode, locale),
                      })
                    : t("debtAmount", { amount: formatAmountWithSymbol(debt.debtMinor, debt.currencyCode, locale) })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {isMultiCurrency && (
          <div className="space-y-1.5">
            <label htmlFor="store-payment-currency" className="text-[13px] font-medium [color:var(--text-secondary)]">
              {t("currencyLabel")}
            </label>
            <Select
              id="store-payment-currency"
              value={currencyCode}
              onChange={(event) => handleCurrencyChange(event.target.value)}
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
            <label htmlFor="store-payment-amount" className="text-[13px] font-medium [color:var(--text-secondary)]">
              {t("amountLabel")} <span className="[color:var(--destructive)]">*</span>
            </label>
            <Input
              id="store-payment-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              placeholder={t("amountPlaceholder")}
              error={amountTouched && validation.exceedsDebt}
              onChange={(event) => setAmount(sanitizeDecimalInput(event.target.value, currencyCode))}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="store-payment-date" className="text-[13px] font-medium [color:var(--text-secondary)]">
              {t("dateLabel")} <span className="[color:var(--destructive)]">*</span>
            </label>
            <DatePickerInput
              id="store-payment-date"
              value={paymentDate}
              onChange={(date) => {
                setPaymentDate(date);
                setDateError(null);
              }}
              placeholder={t("datePlaceholder")}
              locale={locale}
              disableFuture
              popupAlign="end"
            />
            {dateError && <FieldErrorMsg>{dateError}</FieldErrorMsg>}
          </div>
        </div>

        {amountTouched && validation.exceedsDebt && (
          <p role="alert" className="text-[12.5px] [color:var(--destructive)]">
            {t("exceedsDebt", { debt: formatAmountWithSymbol(debtForCurrency, currencyCode, locale) })}
          </p>
        )}

        <div className="space-y-1.5">
          <label htmlFor="store-payment-note" className="text-[13px] font-medium [color:var(--text-secondary)]">
            {t("noteLabel")} <span className="text-[11px] font-normal [color:var(--text-muted)]">{t("optional")}</span>
          </label>
          <Textarea
            id="store-payment-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("notePlaceholder")}
            minRows={2}
            maxRows={4}
          />
        </div>

        {/* "¿A qué va este pago?" — collapsed by default; the common path is amount + date. */}
        <div className="rounded-xl [border:1px_solid_var(--border)]">
          <button
            type="button"
            onClick={() => setShowAllocations((current) => !current)}
            aria-expanded={showAllocations}
            className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left"
          >
            <span className="[font-size:12.5px] font-medium [color:var(--text-secondary)]">
              {t("allocations.toggle")}
            </span>
            <ChevronDown
              size={15}
              aria-hidden
              className={cn("shrink-0 [color:var(--text-muted)] transition-transform", showAllocations && "rotate-180")}
            />
          </button>

          {showAllocations && (
            <div className="space-y-3 px-3 pt-1 pb-3.5">
              <p className="[font-size:11.5px] leading-relaxed [color:var(--text-muted)]">{t("allocations.hint")}</p>

              <div className="flex items-center justify-between gap-2 [font-size:12.5px]">
                <span
                  className={
                    validation.allocationExceedsAmount ? "[color:var(--destructive)]" : "[color:var(--text-secondary)]"
                  }
                >
                  {t("allocations.unallocated", {
                    amount: formatAmountWithSymbol(validation.unallocatedMinor, currencyCode || "USD", locale),
                  })}
                </span>
                {validation.allocationExceedsAmount && (
                  <span role="alert" className="[color:var(--destructive)]">
                    {t("allocations.exceedsAmount")}
                  </span>
                )}
              </div>

              {ordersLoading ? (
                <p className="[font-size:12.5px] [color:var(--text-muted)]">{t("allocations.loading")}</p>
              ) : ordersForCurrency.length === 0 ? (
                <p className="[font-size:12.5px] [color:var(--text-muted)]">{t("allocations.empty")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {ordersForCurrency.map((order) => (
                    <StorePaymentOrderAllocationRow
                      key={order.orderId}
                      order={order}
                      locale={locale}
                      orderAmount={orderAmounts[order.orderId] ?? ""}
                      itemAmounts={itemAmounts}
                      itemSettled={itemSettled}
                      isOrderOverAssignable={validation.orderErrors.has(order.orderId)}
                      itemErrors={validation.itemErrors}
                      onOrderAmountChange={handleOrderAmountChange}
                      onItemAmountChange={handleItemAmountChange}
                      onItemSettledToggle={handleItemSettledToggle}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

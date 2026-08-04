"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDown, PackageCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import Checkbox from "@/components/core/Checkbox";
import DatePickerInput from "@/components/core/DatePickerInput";
import FieldErrorMsg from "@/components/core/FieldErrorMsg";
import Input from "@/components/core/Input";
import Select from "@/components/core/Select";
import Modal from "@/components/modules/Modal/Modal";
import { ALLOWED_COLLECTOR_BASE_CURRENCY_CODES } from "@/lib/catalog/collectorCountries";
import { isValidNonNegativeDecimal, isValidRate, sanitizeDecimalInput, sanitizeRateInput } from "@/lib/decimalInput";
import { cn } from "@/lib/styles";
import type { QuickArrivalSubmitInput } from "./useQuickArrival";

export type QuickArrivalItem = {
  id: string;
  name: string;
};

export type QuickArrivalModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orderHumanReadableId: string;
  storeName: string;
  /** Products still eligible for a delivery (NONE or ARRIVED_AT_STORE). Never empty when open. */
  items: QuickArrivalItem[];
  baseCurrencyCode: string | null;
  locale: string;
  /** Optimistic Confirmation: fire-and-forget, the coordinator owns the toast and the refresh. */
  onSubmit: (input: QuickArrivalSubmitInput) => void;
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
 * "Ya me llegó": logs an already-received delivery for one order in a single step, instead of
 * the 4-step create wizard followed by a separate mark-delivered action.
 *
 * Two deliberate defaults, both stated on screen rather than applied silently:
 * - every eligible product starts selected, because the common case is that the whole box
 *   arrived; the list is always visible when there is more than one product so nothing is
 *   confirmed blind;
 * - shipping cost and dispatch date stay collapsed and unrecorded, because neither is knowable
 *   once the box is already here. The collapsed summary says exactly what will be written, and
 *   the section expands for the cases where the collector does know.
 */
export default function QuickArrivalModal({
  isOpen,
  onClose,
  orderHumanReadableId,
  storeName,
  items,
  baseCurrencyCode,
  locale,
  onSubmit,
}: QuickArrivalModalProps) {
  const t = useTranslations("orders");
  const tCurrencies = useTranslations("orders.currencies");

  const isSingleItem = items.length === 1;

  // The state tracks what the collector UNCHECKED, not what is checked: "everything arrived" is
  // then the natural empty state, and the live selection is always derived from the products that
  // are still eligible. A stale id left over from a previous open cannot leak into a submission.
  const [deselectedIds, setDeselectedIds] = useState<string[]>([]);
  const [receivedDate, setReceivedDate] = useState<Date | null>(startOfToday);
  const [showShippingDetails, setShowShippingDetails] = useState(false);
  const [shippedDate, setShippedDate] = useState<Date | null>(null);
  const [cost, setCost] = useState("");
  const [currencyCode, setCurrencyCode] = useState(baseCurrencyCode ?? "");
  const [exchangeRate, setExchangeRate] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const selectedIds = useMemo(
    () => items.filter((item) => !deselectedIds.includes(item.id)).map((item) => item.id),
    [items, deselectedIds],
  );

  const showExchangeRate = Boolean(baseCurrencyCode && currencyCode && currencyCode !== baseCurrencyCode);
  const allSelected = selectedIds.length === items.length;

  const handleToggleItem = useCallback((itemId: string) => {
    setDeselectedIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
    setErrors((prev) => (prev.items ? { ...prev, items: null } : prev));
  }, []);

  const handleToggleAll = useCallback(() => {
    setDeselectedIds((current) => (current.length === 0 ? items.map((item) => item.id) : []));
    setErrors((prev) => (prev.items ? { ...prev, items: null } : prev));
  }, [items]);

  /** Every dismissal path funnels here so the next open always starts clean. */
  const handleClose = useCallback(() => {
    setDeselectedIds([]);
    setReceivedDate(startOfToday());
    setShowShippingDetails(false);
    setShippedDate(null);
    setCost("");
    setCurrencyCode(baseCurrencyCode ?? "");
    setExchangeRate("");
    setErrors({});
    onClose();
  }, [baseCurrencyCode, onClose]);

  const validate = useCallback((): boolean => {
    const next: Record<string, string | null> = {};
    if (selectedIds.length === 0) next.items = t("detail.quickArrival.validation.itemsRequired");
    if (!receivedDate) next.receivedDate = t("detail.quickArrival.validation.receivedRequired");
    if (receivedDate && shippedDate && shippedDate > receivedDate) {
      next.shippedDate = t("detail.quickArrival.validation.shippedAfterReceived");
    }
    if (showShippingDetails) {
      if (cost.trim() !== "" && !isValidNonNegativeDecimal(cost, currencyCode)) {
        next.cost = t("detail.quickArrival.validation.costInvalid");
      }
      if (cost.trim() !== "" && !currencyCode) {
        next.currencyCode = t("detail.quickArrival.validation.currencyRequired");
      }
      if (showExchangeRate && cost.trim() !== "" && !isValidRate(exchangeRate)) {
        next.exchangeRate = t("detail.quickArrival.validation.fxRequired");
      }
    }
    setErrors(next);
    return Object.values(next).every((value) => !value);
  }, [
    cost,
    currencyCode,
    exchangeRate,
    receivedDate,
    selectedIds.length,
    shippedDate,
    showExchangeRate,
    showShippingDetails,
    t,
  ]);

  const handleConfirm = useCallback(() => {
    if (!validate() || !receivedDate) return;

    const hasCost = showShippingDetails && cost.trim() !== "" && isValidNonNegativeDecimal(cost, currencyCode);
    onSubmit({
      productIds: selectedIds,
      receivedDate: toDomainDate(receivedDate),
      shippedDate: showShippingDetails && shippedDate ? toDomainDate(shippedDate) : null,
      cost: hasCost ? Math.round(parseFloat(cost) * 100) : 0,
      // A delivery row always needs a currency; with no cost recorded it is only a unit label.
      currencyCode: currencyCode || baseCurrencyCode || "USD",
      exchangeRate: hasCost && showExchangeRate && isValidRate(exchangeRate) ? parseFloat(exchangeRate) : null,
    });
    handleClose();
  }, [
    baseCurrencyCode,
    cost,
    currencyCode,
    exchangeRate,
    handleClose,
    onSubmit,
    receivedDate,
    selectedIds,
    shippedDate,
    showExchangeRate,
    showShippingDetails,
    validate,
  ]);

  const selectedCount = selectedIds.length;
  const summaryLabel = useMemo(
    () => (showShippingDetails ? t("detail.quickArrival.shipping.hide") : t("detail.quickArrival.shipping.show")),
    [showShippingDetails, t],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("detail.quickArrival.title")}
      subtitle={`${orderHumanReadableId} · ${storeName}`}
      icon={<PackageCheck />}
      tone="success"
      size="md"
      primaryAction={{
        label: t("detail.quickArrival.confirm"),
        onClick: handleConfirm,
        variant: "success",
      }}
      secondaryAction={{ label: t("detail.quickArrival.cancel"), onClick: handleClose }}
    >
      <div className="space-y-4">
        {isSingleItem ? (
          <p className="rounded-xl px-3 py-2.5 text-[13px] [color:var(--text-secondary)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
            {t.rich("detail.quickArrival.singleItem", {
              name: items[0]?.name ?? "",
              strong: (chunks) => <strong className="[color:var(--text-primary)]">{chunks}</strong>,
            })}
          </p>
        ) : (
          <fieldset className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <legend className="text-[13px] font-medium [color:var(--text-secondary)]">
                {t("detail.quickArrival.itemsLabel")}
              </legend>
              <button
                type="button"
                onClick={handleToggleAll}
                className="text-[12.5px] font-medium [color:var(--accent)] hover:underline"
              >
                {allSelected ? t("detail.quickArrival.selectNone") : t("detail.quickArrival.selectAll")}
              </button>
            </div>
            <p className="text-[11.5px] [color:var(--text-muted)]">{t("detail.quickArrival.itemsHelper")}</p>
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl p-1.5 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
              {items.map((item) => (
                <li key={item.id}>
                  <div className="rounded-lg px-2 py-1.5 hover:[background:color-mix(in_oklch,var(--accent)_6%,transparent)]">
                    <Checkbox
                      id={`quick-arrival-item-${item.id}`}
                      checked={selectedIds.includes(item.id)}
                      onChange={() => handleToggleItem(item.id)}
                      label={item.name}
                      size="sm"
                    />
                  </div>
                </li>
              ))}
            </ul>
            {errors.items ? (
              <FieldErrorMsg>{errors.items}</FieldErrorMsg>
            ) : (
              <p className="text-[11.5px] [color:var(--text-muted)]">
                {t("detail.quickArrival.selectedCount", { count: selectedCount, total: items.length })}
              </p>
            )}
          </fieldset>
        )}

        <div className="space-y-1.5">
          <label htmlFor="quick-arrival-received" className="text-[13px] font-medium [color:var(--text-secondary)]">
            {t("detail.quickArrival.receivedLabel")} <span className="[color:var(--destructive)]">*</span>
          </label>
          <DatePickerInput
            id="quick-arrival-received"
            value={receivedDate}
            onChange={(date) => {
              setReceivedDate(date);
              setErrors((prev) => (prev.receivedDate ? { ...prev, receivedDate: null } : prev));
            }}
            placeholder={t("detail.quickArrival.receivedPlaceholder")}
            locale={locale}
            disableFuture
            popupAlign="end"
          />
          {errors.receivedDate ? (
            <FieldErrorMsg>{errors.receivedDate}</FieldErrorMsg>
          ) : (
            <p className="text-[11.5px] [color:var(--text-muted)]">{t("detail.quickArrival.receivedHelper")}</p>
          )}
        </div>

        <div className="rounded-xl [border:1px_solid_var(--border)]">
          <button
            type="button"
            onClick={() => setShowShippingDetails((current) => !current)}
            aria-expanded={showShippingDetails}
            className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left"
          >
            <span className="text-[12.5px] font-medium [color:var(--text-secondary)]">{summaryLabel}</span>
            <ChevronDown
              size={15}
              aria-hidden
              className={cn(
                "shrink-0 [color:var(--text-muted)] transition-transform",
                showShippingDetails && "rotate-180",
              )}
            />
          </button>

          {!showShippingDetails && (
            <p className="px-3 pb-2.5 text-[11.5px] leading-relaxed [color:var(--text-muted)]">
              {t("detail.quickArrival.shipping.defaultsNotice")}
            </p>
          )}

          {showShippingDetails && (
            <div className="space-y-4 px-3 pt-1 pb-3.5">
              <div className="space-y-1.5">
                <label
                  htmlFor="quick-arrival-shipped"
                  className="text-[13px] font-medium [color:var(--text-secondary)]"
                >
                  {t("detail.quickArrival.shippedLabel")}{" "}
                  <span className="text-[11px] font-normal [color:var(--text-muted)]">
                    {t("detail.quickArrival.optional")}
                  </span>
                </label>
                <DatePickerInput
                  id="quick-arrival-shipped"
                  value={shippedDate}
                  onChange={(date) => {
                    setShippedDate(date);
                    setErrors((prev) => (prev.shippedDate ? { ...prev, shippedDate: null } : prev));
                  }}
                  placeholder={t("detail.quickArrival.shippedPlaceholder")}
                  locale={locale}
                  disableFuture
                  popupAlign="end"
                />
                {errors.shippedDate && <FieldErrorMsg>{errors.shippedDate}</FieldErrorMsg>}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="quick-arrival-cost" className="text-[13px] font-medium [color:var(--text-secondary)]">
                    {t("detail.quickArrival.costLabel")}{" "}
                    <span className="text-[11px] font-normal [color:var(--text-muted)]">
                      {t("detail.quickArrival.optional")}
                    </span>
                  </label>
                  <Input
                    id="quick-arrival-cost"
                    type="text"
                    inputMode="decimal"
                    value={cost}
                    placeholder={t("detail.quickArrival.costPlaceholder")}
                    error={Boolean(errors.cost)}
                    onChange={(event) => {
                      setCost(sanitizeDecimalInput(event.target.value, currencyCode));
                      setErrors((prev) => (prev.cost ? { ...prev, cost: null } : prev));
                    }}
                  />
                  {errors.cost && <FieldErrorMsg>{errors.cost}</FieldErrorMsg>}
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="quick-arrival-currency"
                    className="text-[13px] font-medium [color:var(--text-secondary)]"
                  >
                    {t("detail.quickArrival.currencyLabel")}
                  </label>
                  <Select
                    id="quick-arrival-currency"
                    value={currencyCode}
                    onChange={(event) => {
                      setCurrencyCode(event.target.value);
                      setErrors((prev) => ({ ...prev, currencyCode: null, exchangeRate: null }));
                    }}
                    error={Boolean(errors.currencyCode)}
                    showChevron
                  >
                    <option value="">{t("detail.quickArrival.currencyPlaceholder")}</option>
                    {(ALLOWED_COLLECTOR_BASE_CURRENCY_CODES as readonly string[]).map((code) => (
                      <option key={code} value={code}>
                        {code} · {tCurrencies(code as never)}
                      </option>
                    ))}
                  </Select>
                  {errors.currencyCode && <FieldErrorMsg>{errors.currencyCode}</FieldErrorMsg>}
                </div>
              </div>

              {showExchangeRate && (
                <div className="space-y-1.5">
                  <label htmlFor="quick-arrival-fx" className="text-[13px] font-medium [color:var(--text-secondary)]">
                    {t("detail.quickArrival.fxLabel")}
                  </label>
                  <Input
                    id="quick-arrival-fx"
                    type="text"
                    inputMode="decimal"
                    value={exchangeRate}
                    placeholder={t("detail.quickArrival.fxPlaceholder")}
                    error={Boolean(errors.exchangeRate)}
                    onChange={(event) => {
                      setExchangeRate(sanitizeRateInput(event.target.value));
                      setErrors((prev) => (prev.exchangeRate ? { ...prev, exchangeRate: null } : prev));
                    }}
                  />
                  {errors.exchangeRate ? (
                    <FieldErrorMsg>{errors.exchangeRate}</FieldErrorMsg>
                  ) : (
                    <p className="text-[11.5px] [color:var(--text-muted)]">
                      {t("detail.quickArrival.fxHelper", { from: currencyCode, to: baseCurrencyCode ?? "" })}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

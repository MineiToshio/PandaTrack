"use client";

import { AlertTriangle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import DatePickerInput from "@/components/core/DatePickerInput";
import DateRangePickerInput from "@/components/core/DateRangePickerInput";
import Input from "@/components/core/Input";
import Select from "@/components/core/Select";
import { ALLOWED_COLLECTOR_BASE_CURRENCY_CODES } from "@/lib/catalog/collectorCountries";
import { sanitizeDecimalInput } from "@/lib/decimalInput";
import FieldErrorMsg from "@/components/core/FieldErrorMsg";

export type DeliveryDataValues = {
  deliveryDate: Date | null;
  arrivalFrom: Date | null;
  arrivalTo: Date | null;
  cost: string;
  currencyCode: string;
  exchangeRate: string;
};

export type DeliveryDataErrors = {
  deliveryDate?: string | null;
  cost?: string | null;
  currencyCode?: string | null;
  exchangeRate?: string | null;
};

type DeliveryDataFieldsProps = {
  values: DeliveryDataValues;
  errors: DeliveryDataErrors;
  baseCurrencyCode: string | null;
  /** Field DOM id prefix so create + edit instances never collide. */
  idPrefix: string;
  onChange: (patch: Partial<DeliveryDataValues>) => void;
  /** Clears the inline error of an edited field. */
  onClearError: (field: keyof DeliveryDataErrors) => void;
  /** Edit-only: warns that the stored rate may be stale after a base-currency change. */
  showFxOutdatedWarning?: boolean;
};

/**
 * Shared "Datos de la entrega" fieldset (create paso 3 + edit card): shipping date
 * (past/today only), optional arrival window, cost ≥ 0, currency defaulting to the
 * user base, and the FX rate rendered ONLY when the currency differs from the base.
 */
export default function DeliveryDataFields({
  values,
  errors,
  baseCurrencyCode,
  idPrefix,
  onChange,
  onClearError,
  showFxOutdatedWarning = false,
}: DeliveryDataFieldsProps) {
  const t = useTranslations("deliveries");
  const tCurrencies = useTranslations("orders.currencies");
  const locale = useLocale();

  const showExchangeRate = Boolean(baseCurrencyCode && values.currencyCode && values.currencyCode !== baseCurrencyCode);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}-date`} className="text-[13px] font-medium [color:var(--text-secondary)]">
            {t("create.fields.shippedDateLabel")} <span className="[color:var(--destructive)]">*</span>
          </label>
          <DatePickerInput
            id={`${idPrefix}-date`}
            value={values.deliveryDate}
            error={Boolean(errors.deliveryDate)}
            onChange={(d) => {
              onChange({ deliveryDate: d });
              onClearError("deliveryDate");
            }}
            placeholder={t("create.fields.shippedDatePlaceholder")}
            locale={locale}
            disableFuture
          />
          {errors.deliveryDate ? (
            <FieldError message={errors.deliveryDate} />
          ) : (
            <p className="text-[11.5px] [color:var(--text-muted)]">{t("create.fields.shippedDateHelper")}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}-arrival`} className="text-[13px] font-medium [color:var(--text-secondary)]">
            {t("create.fields.arrivalLabel")}{" "}
            <span className="text-[11px] font-normal [color:var(--text-muted)]">
              {t("create.fields.arrivalOptional")}
            </span>
          </label>
          <DateRangePickerInput
            id={`${idPrefix}-arrival`}
            from={values.arrivalFrom}
            to={values.arrivalTo}
            onChange={(from, to) => onChange({ arrivalFrom: from, arrivalTo: to })}
            placeholder={t("create.fields.arrivalPlaceholder")}
            clearLabel={t("create.fields.arrivalClearLabel")}
            locale={locale}
          />
          <p className="text-[11.5px] [color:var(--text-muted)]">{t("create.fields.arrivalHelper")}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}-cost`} className="text-[13px] font-medium [color:var(--text-secondary)]">
            {t("create.fields.costLabel")} <span className="[color:var(--destructive)]">*</span>
          </label>
          <Input
            id={`${idPrefix}-cost`}
            type="text"
            inputMode="decimal"
            value={values.cost}
            placeholder={t("create.fields.costPlaceholder")}
            error={Boolean(errors.cost)}
            onChange={(e) => {
              onChange({ cost: sanitizeDecimalInput(e.target.value, values.currencyCode) });
              onClearError("cost");
            }}
          />
          {errors.cost ? (
            <FieldError message={errors.cost} />
          ) : (
            <p className="text-[11.5px] [color:var(--text-muted)]">{t("create.fields.costHelper")}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}-currency`} className="text-[13px] font-medium [color:var(--text-secondary)]">
            {t("create.fields.currencyLabel")} <span className="[color:var(--destructive)]">*</span>
          </label>
          <Select
            id={`${idPrefix}-currency`}
            value={values.currencyCode}
            onChange={(event) => {
              onChange({ currencyCode: event.target.value });
              onClearError("currencyCode");
              onClearError("exchangeRate");
            }}
            error={Boolean(errors.currencyCode)}
            showChevron
          >
            <option value="">{t("create.fields.currencyPlaceholder")}</option>
            {(ALLOWED_COLLECTOR_BASE_CURRENCY_CODES as readonly string[]).map((code) => (
              <option key={code} value={code}>
                {code} — {tCurrencies(code as never)}
              </option>
            ))}
          </Select>
          {errors.currencyCode ? (
            <FieldError message={errors.currencyCode} />
          ) : baseCurrencyCode ? (
            <p className="text-[11.5px] [color:var(--text-muted)]">
              {showExchangeRate
                ? t("create.fields.currencyHelper", { base: baseCurrencyCode })
                : t("create.fields.currencySameAsBaseHelper")}
            </p>
          ) : null}
        </div>
        {/* FX only renders when the currency differs from the user base. */}
        {showExchangeRate && (
          <div className="space-y-1.5">
            <label htmlFor={`${idPrefix}-fx`} className="text-[13px] font-medium [color:var(--text-secondary)]">
              {t("create.fields.fxLabel")} <span className="[color:var(--destructive)]">*</span>
            </label>
            <Input
              id={`${idPrefix}-fx`}
              type="text"
              inputMode="decimal"
              value={values.exchangeRate}
              placeholder={t("create.fields.fxPlaceholder")}
              error={Boolean(errors.exchangeRate)}
              onChange={(e) => {
                onChange({ exchangeRate: sanitizeDecimalInput(e.target.value) });
                onClearError("exchangeRate");
              }}
            />
            {showFxOutdatedWarning && (
              <p className="text-warning flex items-center gap-1.5 text-[12px]" role="status">
                <AlertTriangle size={13} aria-hidden />
                {t("create.fields.fxOutdatedWarning")}
              </p>
            )}
            {errors.exchangeRate ? (
              <FieldError message={errors.exchangeRate} />
            ) : (
              <p className="text-[11.5px] [color:var(--text-muted)]">
                {t("create.fields.fxHelper", { from: values.currencyCode, to: baseCurrencyCode ?? "" })}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  return <FieldErrorMsg>{message}</FieldErrorMsg>;
}

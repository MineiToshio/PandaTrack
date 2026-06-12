"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import posthog from "posthog-js";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import SearchableSelect from "@/components/core/SearchableSelect";
import SectionTitleWithAccent from "@/components/modules/SectionTitleWithAccent";
import Typography from "@/components/core/Typography";
import { Modal } from "@/components/modules/Modal";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/styles";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { ALLOWED_COLLECTOR_BASE_CURRENCY_CODES, COUNTRY_CODES } from "@/lib/catalog/collectorCountries";
import { STORE_PRODUCT_TYPE_KEYS } from "@/lib/catalog/storeProductTypes";
import { SETTINGS_SECTION_SURFACE_CLASSNAME } from "@/app/[locale]/(app)/settings/settingsSectionChrome";
import { savePreferencesAction } from "@/app/[locale]/(app)/settings/_actions/preferencesActions";
import MultiTagAutocomplete from "@/components/core/MultiTagAutocomplete";

/* -------------------------------------------------------------------------- */
/* Types                                                                        */
/* -------------------------------------------------------------------------- */

type SettingsPreferencesSectionProps = {
  initialCountryCode: string | null;
  initialCurrencyCode: string | null;
  initialProductTypeKeys: string[];
  initialBudgetAmount: number | null;
  initialBudgetResetDayOfMonth: number | null;
  /** When true, successful save navigates to order create (`/orders/new`). */
  redirectToOrderCreateAfterSave?: boolean;
};

type FormValues = {
  countryCode: string | null;
  currencyCode: string | null;
  productTypeKeys: string[];
  budgetAmount: string;
  budgetResetDay: string;
};

const BUDGET_RESET_DAY_LAST = 31;

function toFormValues(
  countryCode: string | null,
  currencyCode: string | null,
  productTypeKeys: string[],
  budgetAmount: number | null,
  budgetResetDayOfMonth: number | null,
): FormValues {
  return {
    countryCode,
    currencyCode,
    productTypeKeys: [...productTypeKeys].sort(),
    budgetAmount: budgetAmount !== null ? String(budgetAmount) : "",
    // A null reset day means "last day of the month"; day 31 is functionally
    // identical (shorter months resolve to their last valid day per FR-07-26),
    // so we surface both as "31 selected" in the UI.
    budgetResetDay: String(budgetResetDayOfMonth ?? BUDGET_RESET_DAY_LAST),
  };
}

function formValuesEqual(a: FormValues, b: FormValues): boolean {
  return (
    a.countryCode === b.countryCode &&
    a.currencyCode === b.currencyCode &&
    [...a.productTypeKeys].sort().join(",") === [...b.productTypeKeys].sort().join(",") &&
    a.budgetAmount === b.budgetAmount &&
    a.budgetResetDay === b.budgetResetDay
  );
}

const BUDGET_RESET_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/* -------------------------------------------------------------------------- */
/* Budget reset day picker                                                      */
/* -------------------------------------------------------------------------- */

type BudgetResetDayPickerProps = {
  id: string;
  labelledById: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  labels: {
    dayAriaLabel: (day: number) => string;
  };
};

function BudgetResetDayPicker({
  id,
  labelledById,
  value,
  onChange,
  disabled = false,
  labels,
}: BudgetResetDayPickerProps) {
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, currentValue: string) => {
      if (disabled) return;
      const currentDay = parseInt(currentValue, 10);
      if (!Number.isFinite(currentDay)) return;

      const selectDay = (nextDay: number) => {
        const clamped = Math.min(Math.max(nextDay, 1), BUDGET_RESET_DAYS.length);
        const next = String(clamped);
        onChange(next);
        btnRefs.current[next]?.focus();
      };

      switch (event.key) {
        case "ArrowRight":
          event.preventDefault();
          selectDay(currentDay + 1);
          return;
        case "ArrowLeft":
          event.preventDefault();
          selectDay(currentDay - 1);
          return;
        case "ArrowDown":
          event.preventDefault();
          selectDay(currentDay + 7);
          return;
        case "ArrowUp":
          event.preventDefault();
          selectDay(currentDay - 7);
          return;
        case "Home":
          event.preventDefault();
          selectDay(1);
          return;
        case "End":
          event.preventDefault();
          selectDay(BUDGET_RESET_DAYS.length);
          return;
        default:
          return;
      }
    },
    [disabled, onChange],
  );

  const baseBtn =
    "focus-visible:ring-ring focus-visible:ring-offset-background cursor-pointer border transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
  const idleClass = "border-border bg-background text-text-body hover:border-primary/50 hover:bg-muted/25";
  const selectedClass = "border-primary bg-primary/10 text-text-title hover:bg-primary/15";

  return (
    <div id={id} role="radiogroup" aria-labelledby={labelledById} className="grid grid-cols-7 gap-1.5">
      {BUDGET_RESET_DAYS.map((day) => {
        const strValue = String(day);
        const isSelected = value === strValue;
        return (
          <button
            key={day}
            ref={(el) => {
              btnRefs.current[strValue] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={labels.dayAriaLabel(day)}
            tabIndex={isSelected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(strValue)}
            onKeyDown={(e) => handleKeyDown(e, strValue)}
            className={cn(
              baseBtn,
              "flex h-10 items-center justify-center rounded-md text-sm font-medium tabular-nums",
              isSelected ? selectedClass : idleClass,
            )}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main section                                                                 */
/* -------------------------------------------------------------------------- */

export default function SettingsPreferencesSection({
  initialCountryCode,
  initialCurrencyCode,
  initialProductTypeKeys,
  initialBudgetAmount,
  initialBudgetResetDayOfMonth,
  redirectToOrderCreateAfterSave = false,
}: SettingsPreferencesSectionProps) {
  const t = useTranslations("settings.preferences");
  const locale = useLocale();
  const router = useRouter();
  const tErrors = useTranslations("settings.preferences.errors");
  const tCountries = useTranslations("countries");
  const tProductTypes = useTranslations("storeProductTypes");
  const { addToast } = useToast();

  const sectionId = useId();
  const currencyId = useId();
  const countryId = useId();
  const productTypesId = useId();
  const budgetAmountId = useId();
  const budgetResetDayId = useId();
  const budgetAmountErrorId = useId();
  const formErrorId = useId();

  const [savedValues, setSavedValues] = useState<FormValues>(() =>
    toFormValues(
      initialCountryCode,
      initialCurrencyCode,
      initialProductTypeKeys,
      initialBudgetAmount,
      initialBudgetResetDayOfMonth,
    ),
  );

  const [countryCode, setCountryCode] = useState<string | null>(initialCountryCode);
  const [currencyCode, setCurrencyCode] = useState<string | null>(initialCurrencyCode);
  const [productTypeKeys, setProductTypeKeys] = useState<string[]>(initialProductTypeKeys);
  const [budgetAmount, setBudgetAmount] = useState<string>(
    initialBudgetAmount !== null ? String(initialBudgetAmount) : "",
  );
  const [budgetResetDay, setBudgetResetDay] = useState<string>(
    String(initialBudgetResetDayOfMonth ?? BUDGET_RESET_DAY_LAST),
  );

  const [budgetAmountError, setBudgetAmountError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);

  const currentFormValues = useMemo<FormValues>(
    () => ({
      countryCode,
      currencyCode,
      productTypeKeys: [...productTypeKeys].sort(),
      budgetAmount,
      budgetResetDay,
    }),
    [countryCode, currencyCode, productTypeKeys, budgetAmount, budgetResetDay],
  );

  const isDirty = useMemo(() => !formValuesEqual(currentFormValues, savedValues), [currentFormValues, savedValues]);

  const currencyOptions = useMemo(
    () =>
      (ALLOWED_COLLECTOR_BASE_CURRENCY_CODES as string[]).map((code) => ({
        value: code,
        label: `${code} - ${t(`currencies.${code}`)}`,
      })),
    [t],
  );

  const countryOptions = useMemo(
    () =>
      (COUNTRY_CODES as readonly string[]).map((code) => ({
        value: code,
        label: `${code} - ${tCountries(code)}`,
      })),
    [tCountries],
  );

  const productTypeOptions = useMemo(
    () => (STORE_PRODUCT_TYPE_KEYS as readonly string[]).map((key) => ({ value: key, label: tProductTypes(key) })),
    [tProductTypes],
  );

  const hasBudgetCurrencyError = budgetAmount.trim() !== "" && currencyCode === null;
  const budgetAmountDescribedBy = [budgetAmountError != null ? budgetAmountErrorId : ""].filter(Boolean).join(" ");

  const validateBudgetAmount = useCallback(
    (raw: string): boolean => {
      if (raw.trim() === "") return true;
      const parsed = parseInt(raw, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 999_999_999 || String(parsed) !== raw.trim()) {
        setBudgetAmountError(tErrors("validation"));
        return false;
      }
      return true;
    },
    [tErrors],
  );

  const buildPayload = useCallback(() => {
    const budgetAmountValue = budgetAmount.trim() === "" ? null : parseInt(budgetAmount.trim(), 10);
    const budgetResetDayValue = parseInt(budgetResetDay, 10);
    return {
      preferredCountryCode: countryCode,
      baseCurrencyCode: currencyCode,
      preferredProductTypeKeys: productTypeKeys,
      budgetAmount: budgetAmountValue,
      budgetResetDayOfMonth: budgetResetDayValue,
    };
  }, [countryCode, currencyCode, productTypeKeys, budgetAmount, budgetResetDay]);

  const persist = useCallback(
    async (skipReconciliation: boolean) => {
      setIsSubmitting(true);
      setFormError(null);

      const payload = buildPayload();
      const result = await savePreferencesAction(payload);

      setIsSubmitting(false);

      if (!result.ok) {
        setFormError(tErrors(result.error === "unauthorized" ? "unauthorized" : "generic"));
        posthog.capture(POSTHOG_EVENTS.SETTINGS.PREFERENCES_SAVED, {
          success: false,
          changedCurrency: currencyCode !== savedValues.currencyCode,
          changedCountry: countryCode !== savedValues.countryCode,
          changedProductTypes:
            [...productTypeKeys].sort().join(",") !== [...savedValues.productTypeKeys].sort().join(","),
          changedBudget: budgetAmount !== savedValues.budgetAmount,
          changedResetRule: budgetResetDay !== savedValues.budgetResetDay,
          errorCode: result.error,
          skipReconciliation,
        });
        return;
      }

      const nextSaved = toFormValues(
        countryCode,
        currencyCode,
        productTypeKeys,
        payload.budgetAmount,
        payload.budgetResetDayOfMonth,
      );
      setSavedValues(nextSaved);

      posthog.capture(POSTHOG_EVENTS.SETTINGS.PREFERENCES_SAVED, {
        success: true,
        changedCurrency: currencyCode !== savedValues.currencyCode,
        changedCountry: countryCode !== savedValues.countryCode,
        changedProductTypes:
          [...productTypeKeys].sort().join(",") !== [...savedValues.productTypeKeys].sort().join(","),
        changedBudget: budgetAmount !== savedValues.budgetAmount,
        changedResetRule: budgetResetDay !== savedValues.budgetResetDay,
        skipReconciliation,
      });

      addToast(t("success"));
      if (redirectToOrderCreateAfterSave) {
        router.push(`/${locale}${ROUTES.ordersNew}`);
      }
    },
    [
      buildPayload,
      currencyCode,
      countryCode,
      productTypeKeys,
      budgetAmount,
      budgetResetDay,
      savedValues,
      tErrors,
      t,
      addToast,
      redirectToOrderCreateAfterSave,
      locale,
      router,
    ],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setBudgetAmountError(null);
      setFormError(null);

      if (!validateBudgetAmount(budgetAmount)) return;
      if (hasBudgetCurrencyError) return;

      const currencyChanged = savedValues.currencyCode !== null && currencyCode !== savedValues.currencyCode;
      if (currencyChanged) {
        setIsCurrencyModalOpen(true);
        return;
      }

      await persist(false);
    },
    [budgetAmount, hasBudgetCurrencyError, currencyCode, savedValues.currencyCode, validateBudgetAmount, persist],
  );

  const handleCurrencyModalConfirmSkip = useCallback(async () => {
    setIsCurrencyModalOpen(false);
    await persist(true);
  }, [persist]);

  const handleCurrencyModalConfirmReconcile = useCallback(async () => {
    setIsCurrencyModalOpen(false);
    await persist(false);
  }, [persist]);

  const handleCurrencyModalCancel = useCallback(() => {
    setIsCurrencyModalOpen(false);
  }, []);

  const handleBudgetAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBudgetAmountError(null);
    const raw = e.target.value;
    if (raw === "" || /^\d+$/.test(raw)) {
      setBudgetAmount(raw);
    }
  }, []);

  return (
    <section className={SETTINGS_SECTION_SURFACE_CLASSNAME} aria-labelledby={sectionId}>
      <SectionTitleWithAccent id={sectionId} as="h2">
        {t("title")}
      </SectionTitleWithAccent>

      <div className="mt-6">
        <Typography size="xs" className="text-text-muted">
          {t("intro")}
        </Typography>

        <form className="mt-6 space-y-8" onSubmit={handleSubmit} noValidate>
          {/* Country */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={countryId}>{t("country.label")}</Label>
              <Typography size="xs" className="text-text-muted">
                {t("country.helper")}
              </Typography>
            </div>
            <SearchableSelect
              id={countryId}
              options={countryOptions}
              value={countryCode}
              onChange={setCountryCode}
              placeholder={t("country.placeholder")}
              clearLabel={t("country.clear")}
              noResultsLabel={t("country.noResults")}
              clearable
              disabled={isSubmitting}
            />
          </div>

          {/* Product types */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={productTypesId}>{t("productTypes.label")}</Label>
              <Typography size="xs" className="text-text-muted">
                {t("productTypes.helper")}
              </Typography>
            </div>
            <MultiTagAutocomplete
              id={productTypesId}
              options={productTypeOptions}
              selectedValues={productTypeKeys}
              onChange={setProductTypeKeys}
              placeholder={t("productTypes.placeholder")}
              removeItemAriaLabel={(label) => t("productTypes.removeAriaLabel", { label })}
            />
          </div>

          {/* Currency */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={currencyId}>{t("currency.label")}</Label>
              <Typography size="xs" className="text-text-muted">
                {t("currency.helper")}
              </Typography>
            </div>
            <SearchableSelect
              id={currencyId}
              options={currencyOptions}
              value={currencyCode}
              onChange={setCurrencyCode}
              placeholder={t("currency.placeholder")}
              clearLabel={t("currency.clear")}
              noResultsLabel={t("currency.noResults")}
              clearable
              disabled={isSubmitting}
            />
          </div>

          {/* Budget amount */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={budgetAmountId}>{t("budgetAmount.label")}</Label>
              <Typography size="xs" className="text-text-muted">
                {currencyCode ? t("budgetAmount.helper") : t("budgetAmount.currencyRequired")}
              </Typography>
            </div>
            <Input
              id={budgetAmountId}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={budgetAmount}
              onChange={handleBudgetAmountChange}
              disabled={isSubmitting || currencyCode === null}
              error={Boolean(budgetAmountError) || hasBudgetCurrencyError}
              placeholder={t("budgetAmount.placeholder")}
              aria-invalid={Boolean(budgetAmountError) || hasBudgetCurrencyError}
              aria-describedby={budgetAmountDescribedBy || undefined}
            />
            {budgetAmountError ? (
              <Typography id={budgetAmountErrorId} size="sm" className="text-destructive" role="alert">
                {budgetAmountError}
              </Typography>
            ) : null}
          </div>

          {/* Budget reset day */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label id={`${budgetResetDayId}-label`}>{t("budgetResetDay.label")}</Label>
              <Typography size="xs" className="text-text-muted">
                {t("budgetResetDay.helper")}
              </Typography>
            </div>
            <div className="space-y-1.5">
              <BudgetResetDayPicker
                id={budgetResetDayId}
                labelledById={`${budgetResetDayId}-label`}
                value={budgetResetDay}
                onChange={setBudgetResetDay}
                disabled={isSubmitting}
                labels={{
                  dayAriaLabel: (day) => t("budgetResetDay.dayAriaLabel", { day }),
                }}
              />
              <Typography size="xs" className="text-text-muted" aria-live="polite">
                {budgetResetDay === String(BUDGET_RESET_DAY_LAST)
                  ? t("budgetResetDay.summaryLastDay")
                  : t("budgetResetDay.summaryDay", { day: parseInt(budgetResetDay, 10) })}
              </Typography>
            </div>
          </div>

          {/* Form-level error */}
          {formError ? (
            <Typography id={formErrorId} size="sm" className="text-destructive" role="alert">
              {formError}
            </Typography>
          ) : null}

          {/* Submit */}
          <Button type="submit" variant="primary" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? t("pending") : t("save")}
          </Button>
        </form>
      </div>

      {/* Currency change confirmation modal */}
      <Modal
        isOpen={isCurrencyModalOpen}
        onClose={handleCurrencyModalCancel}
        title={t("currencyChangeModal.title")}
        subtitle={t("currencyChangeModal.description")}
        icon={<AlertTriangle size={20} aria-hidden="true" />}
        tone="warning"
        role="alertdialog"
        dismissible={false}
        closeButtonLabel={t("currencyChangeModal.cancel")}
        primaryAction={{
          label: isSubmitting ? t("pending") : t("currencyChangeModal.saveAndReconcile"),
          onClick: handleCurrencyModalConfirmReconcile,
          loading: isSubmitting,
          disabled: isSubmitting,
        }}
        secondaryAction={{
          label: isSubmitting ? t("pending") : t("currencyChangeModal.saveSkip"),
          onClick: handleCurrencyModalConfirmSkip,
          disabled: isSubmitting,
        }}
        tertiaryAction={{
          label: t("currencyChangeModal.cancel"),
          onClick: handleCurrencyModalCancel,
          disabled: isSubmitting,
        }}
      />
    </section>
  );
}

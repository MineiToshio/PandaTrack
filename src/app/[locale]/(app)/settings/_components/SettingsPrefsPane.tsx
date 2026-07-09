"use client";

import { Heart, LogOut, Monitor } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import Eyebrow from "@/components/core/Eyebrow";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import SearchableSelect from "@/components/core/SearchableSelect";
import SectionCard from "@/components/core/SectionCard";
import { COUNTRY_CODES, COUNTRY_FLAG_EMOJI_BY_CODE } from "@/lib/catalog/collectorCountries";
import { parseBudgetInputValue, toBudgetInputValue } from "@/lib/user-settings/budgetAmount";
import { STORE_PRODUCT_TYPE_KEYS } from "@/lib/catalog/storeProductTypes";
import { getStoreProductTypeIcon } from "@/lib/catalog/storeProductTypeIcons";
import { useTheme } from "@/contexts/ThemeContext";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/styles";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/lib/constants";
import { savePreferencesAction, updateLanguageAction } from "@/app/[locale]/(app)/settings/_actions/preferencesActions";
import CurrencyModal from "./CurrencyModal";
import PreferencesAutosaveIndicator, { type AutosaveStatus } from "./PreferencesAutosaveIndicator";
import SegmentedToggle from "./SegmentedToggle";
import SettingsRow from "./SettingsRow";

const AUTOSAVE_DEBOUNCE_MS = 300;
const BUDGET_RESET_DAY_LAST = 31;

export type SettingsPrefsPaneProps = {
  locale: Locale;
  initialCountryCode: string | null;
  initialCurrencyCode: string | null;
  initialProductTypeKeys: string[];
  initialBudgetAmount: number | null;
  initialBudgetResetDayOfMonth: number | null;
};

type PreferencesValues = {
  preferredCountryCode: string | null;
  baseCurrencyCode: string | null;
  preferredProductTypeKeys: string[];
  budgetAmount: number | null;
  budgetResetDayOfMonth: number | null;
};

export default function SettingsPrefsPane({
  locale,
  initialCountryCode,
  initialCurrencyCode,
  initialProductTypeKeys,
  initialBudgetAmount,
  initialBudgetResetDayOfMonth,
}: SettingsPrefsPaneProps) {
  const t = useTranslations("settings");
  const tCurrencies = useTranslations("settings.preferences.currencies");
  const tProductTypes = useTranslations("storeProductTypes");
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const budgetId = useId();
  const resetDayId = useId();
  const countryId = useId();
  const [, startTransition] = useTransition();

  const [values, setValues] = useState<PreferencesValues>({
    preferredCountryCode: initialCountryCode,
    baseCurrencyCode: initialCurrencyCode,
    preferredProductTypeKeys: [...initialProductTypeKeys].sort(),
    budgetAmount: initialBudgetAmount,
    budgetResetDayOfMonth: initialBudgetResetDayOfMonth,
  });
  const [budgetInput, setBudgetInput] = useState<string>(toBudgetInputValue(initialBudgetAmount));
  const [autosave, setAutosave] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [openCurrencyModal, setOpenCurrencyModal] = useState(false);
  const lastCommittedRef = useRef<PreferencesValues>(values);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback((next: PreferencesValues) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setAutosave("saving");
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const result = await savePreferencesAction(next);
        if (!result.ok) {
          setValues(lastCommittedRef.current);
          setBudgetInput(toBudgetInputValue(lastCommittedRef.current.budgetAmount));
          setAutosave("error");
          return;
        }
        lastCommittedRef.current = next;
        setLastSavedAt(Date.now());
        setAutosave("saved");
      });
    }, AUTOSAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const updateValues = useCallback(
    (patch: Partial<PreferencesValues>) => {
      setValues((current) => {
        const next: PreferencesValues = { ...current, ...patch };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const handleCurrencySaved = useCallback(
    (code: string) => {
      const next: PreferencesValues = { ...values, baseCurrencyCode: code };
      lastCommittedRef.current = next;
      setValues(next);
      setLastSavedAt(Date.now());
      setAutosave("saved");
    },
    [values],
  );

  const handleLanguageChange = (next: Locale) => {
    if (next === locale) return;
    startTransition(async () => {
      const result = await updateLanguageAction(next);
      if (!result.ok) {
        setAutosave("error");
        return;
      }
      setLastSavedAt(Date.now());
      setAutosave("saved");
      router.refresh();
    });
  };

  const toggleCategory = (key: string) => {
    const current = values.preferredProductTypeKeys;
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key].sort();
    updateValues({ preferredProductTypeKeys: next });
  };

  const handleBudgetCommit = () => {
    const parsed = parseBudgetInputValue(budgetInput);
    if (!parsed.ok) {
      setBudgetInput(toBudgetInputValue(values.budgetAmount));
      return;
    }
    updateValues({ budgetAmount: parsed.minorUnits });
  };

  const countryOptions = COUNTRY_CODES.map((code) => ({
    value: code,
    label: `${COUNTRY_FLAG_EMOJI_BY_CODE[code]} ${code}`,
  }));

  return (
    <div className="space-y-3.5">
      <SectionCard
        topAccent="cool"
        headingLevel="h2"
        eyebrow={
          <Eyebrow variant="chip" tone="cool" icon={Monitor}>
            {t("preferences.interfaz.eyebrow")}
          </Eyebrow>
        }
        title={t("preferences.interfaz.title")}
        trailing={<PreferencesAutosaveIndicator status={autosave} lastSavedAt={lastSavedAt} />}
      >
        <p className="-mt-2 mb-2 text-[13px] [color:var(--text-secondary)]">{t("preferences.interfaz.subtitle")}</p>
        <SettingsRow
          label={t("preferences.interfaz.themeRow.label")}
          value={<span className="[color:var(--text-secondary)]">{t("preferences.interfaz.themeRow.helper")}</span>}
          actions={
            <SegmentedToggle<"light" | "dark">
              value={theme}
              onChange={setTheme}
              ariaLabel={t("preferences.interfaz.themeRow.label")}
              options={[
                { value: "light", label: t("preferences.interfaz.themeRow.options.light") },
                { value: "dark", label: t("preferences.interfaz.themeRow.options.dark") },
              ]}
            />
          }
        />
        <SettingsRow
          label={t("preferences.interfaz.langRow.label")}
          value={<span className="[color:var(--text-secondary)]">{t("preferences.interfaz.langRow.helper")}</span>}
          actions={
            <SegmentedToggle<Locale>
              value={locale}
              onChange={handleLanguageChange}
              ariaLabel={t("preferences.interfaz.langRow.label")}
              options={[
                { value: "es", label: t("preferences.interfaz.langRow.options.es") },
                { value: "en", label: t("preferences.interfaz.langRow.options.en") },
              ]}
            />
          }
        />
      </SectionCard>

      <SectionCard
        topAccent="warm"
        headingLevel="h2"
        eyebrow={
          <Eyebrow variant="chip" tone="warm" icon={Heart}>
            {t("preferences.collector.eyebrow")}
          </Eyebrow>
        }
        title={t("preferences.collector.title")}
      >
        <p className="-mt-2 mb-2 text-[13px] [color:var(--text-secondary)]">{t("preferences.collector.subtitle")}</p>
        <SettingsRow
          label={t("preferences.collector.rows.country")}
          value={
            <SearchableSelect
              id={countryId}
              options={countryOptions}
              value={values.preferredCountryCode}
              onChange={(next) => updateValues({ preferredCountryCode: next })}
              placeholder={t("preferences.collector.country.placeholder")}
              clearLabel={t("preferences.collector.country.changeButton")}
              noResultsLabel={t("preferences.collector.country.noResults")}
            />
          }
          fullWidthValue
        />
        <SettingsRow
          label={t("preferences.collector.rows.currency")}
          value={
            <span className="flex flex-col gap-1">
              <span className="[font-family:var(--font-mono)] [font-weight:var(--font-weight-semibold)]">
                {values.baseCurrencyCode ?? t("preferences.collector.currency.empty")}
              </span>
              {values.baseCurrencyCode ? (
                <span className="text-[12px] [font-weight:var(--font-weight-regular)] [color:var(--text-muted)]">
                  {tCurrencies(values.baseCurrencyCode as never)} · {t("preferences.collector.currency.summary")}
                </span>
              ) : null}
            </span>
          }
          actions={
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpenCurrencyModal(true)}>
              {t("preferences.collector.currency.changeButton")}
            </Button>
          }
        />
        <SettingsRow
          label={t("preferences.collector.rows.categories")}
          value={
            <div className="flex flex-wrap gap-2">
              {STORE_PRODUCT_TYPE_KEYS.map((key) => {
                const Icon = getStoreProductTypeIcon(key);
                const active = values.preferredProductTypeKeys.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleCategory(key)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px]",
                      "[font-weight:var(--font-weight-medium)] transition-colors",
                      "focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:2px]",
                      active
                        ? "[color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_10%,transparent)] [border:1.5px_solid_var(--accent)]"
                        : "[color:var(--text-secondary)] [background:var(--surface-elevated)] [border:1.5px_solid_var(--border-strong)]",
                    )}
                  >
                    <Icon
                      size={14}
                      aria-hidden="true"
                      className={active ? "[color:var(--accent)]" : "[color:var(--accent-cool)]"}
                    />
                    {tProductTypes(key)}
                  </button>
                );
              })}
            </div>
          }
          fullWidthValue
        />
        <SettingsRow
          label={t("preferences.collector.rows.budget")}
          value={
            <div className="flex flex-wrap items-center gap-2.5">
              <Input
                id={budgetId}
                type="text"
                inputMode="numeric"
                value={budgetInput}
                onChange={(event) => setBudgetInput(event.target.value)}
                onBlur={handleBudgetCommit}
                placeholder={t("preferences.collector.budget.placeholder")}
                disabled={values.baseCurrencyCode == null}
                className="max-w-[180px]"
              />
              <Label htmlFor={resetDayId} className="text-[13px] [color:var(--text-secondary)]">
                {t("preferences.collector.budget.resetLabel")}
              </Label>
              <Input
                id={resetDayId}
                type="text"
                inputMode="numeric"
                value={String(values.budgetResetDayOfMonth ?? BUDGET_RESET_DAY_LAST).padStart(2, "0")}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, "");
                  if (digits === "") return;
                  const parsed = Number.parseInt(digits, 10);
                  if (!Number.isFinite(parsed)) return;
                  const clamped = Math.min(Math.max(parsed, 1), 31);
                  updateValues({ budgetResetDayOfMonth: clamped });
                }}
                aria-label={t("preferences.collector.budget.dayAriaLabel", {
                  day: values.budgetResetDayOfMonth ?? BUDGET_RESET_DAY_LAST,
                })}
                className="max-w-[64px] text-center [font-variant-numeric:tabular-nums]"
                disabled={values.baseCurrencyCode == null}
              />
            </div>
          }
          fullWidthValue
        />
      </SectionCard>

      <div className="flex justify-center pt-2 lg:hidden">
        <button
          type="button"
          onClick={() => {
            authClient.signOut({
              fetchOptions: {
                onSuccess: () => {
                  router.push(`/${locale}${ROUTES.signIn}`);
                },
              },
            });
          }}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] px-4 py-2 text-[14px] [font-weight:var(--font-weight-medium)] [color:var(--destructive)] [border:1px_solid_color-mix(in_oklch,var(--destructive)_28%,transparent)] hover:[background:color-mix(in_oklch,var(--destructive)_8%,transparent)]"
        >
          <LogOut size={16} aria-hidden="true" />
          {t("preferences.signOut.mobile")}
        </button>
      </div>

      <CurrencyModal
        isOpen={openCurrencyModal}
        onClose={() => setOpenCurrencyModal(false)}
        locale={locale}
        initialCurrencyCode={values.baseCurrencyCode}
        onSaved={handleCurrencySaved}
      />
    </div>
  );
}

"use client";

import { ArrowRight, Heart, LogOut, Monitor } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import Eyebrow from "@/components/core/Eyebrow";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import SearchableSelect from "@/components/core/SearchableSelect";
import SectionCard from "@/components/core/SectionCard";
import {
  ALLOWED_COLLECTOR_BASE_CURRENCY_CODES,
  COUNTRY_CODES,
  COUNTRY_FLAG_EMOJI_BY_CODE,
} from "@/lib/catalog/collectorCountries";
import { parseBudgetInputValue, toBudgetInputValue } from "@/lib/user-settings/budgetAmount";
import { STORE_PRODUCT_TYPE_KEYS } from "@/lib/catalog/storeProductTypes";
import { getStoreProductTypeIcon } from "@/lib/catalog/storeProductTypeIcons";
import { useTheme } from "@/contexts/ThemeContext";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/styles";
import { authClient } from "@/lib/auth/auth-client";
import { ROUTES } from "@/lib/constants";
import {
  savePreferencesAction,
  updateCurrencyAction,
  updateLanguageAction,
} from "@/app/[locale]/(app)/settings/_actions/preferencesActions";
import PreferencesAutosaveIndicator, { type AutosaveStatus } from "./PreferencesAutosaveIndicator";
import SegmentedToggle from "./SegmentedToggle";
import SettingsNotificationsSection, { type NotificationPreferencesState } from "./SettingsNotificationsSection";
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
  initialNotificationPreferences: NotificationPreferencesState;
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
  initialNotificationPreferences,
}: SettingsPrefsPaneProps) {
  const t = useTranslations("settings");
  const tCurrencies = useTranslations("settings.preferences.currencies");
  const tProductTypes = useTranslations("storeProductTypes");
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const budgetId = useId();
  const resetDayId = useId();
  const countryId = useId();
  const currencyId = useId();
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
  // Base currency is an explicit-confirm field (not autosaved): the select stages a pending choice,
  // and only "Save" commits it via updateCurrencyAction. `fxReconcileCount` drives the optional
  // "reconcile rates" shortcut shown after a commit when foreign-currency orders were flagged.
  const [pendingCurrency, setPendingCurrency] = useState<string | null>(null);
  const [currencySaving, setCurrencySaving] = useState(false);
  const [fxReconcileCount, setFxReconcileCount] = useState(0);
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

  const committedCurrency = values.baseCurrencyCode;
  const selectedCurrency = pendingCurrency ?? committedCurrency;
  const currencyDirty = pendingCurrency !== null && pendingCurrency !== committedCurrency;

  const handleCurrencySelect = useCallback((next: string | null) => {
    if (!next) return; // Base currency is required; the select is non-clearable.
    setFxReconcileCount(0);
    setPendingCurrency(next);
  }, []);

  const handleCurrencyCancel = useCallback(() => {
    setPendingCurrency(null);
  }, []);

  const handleCurrencySave = useCallback(() => {
    if (!currencyDirty || pendingCurrency === null || currencySaving) return;
    const chosen = pendingCurrency;
    setCurrencySaving(true);
    setAutosave("saving");
    startTransition(async () => {
      const result = await updateCurrencyAction({ baseCurrencyCode: chosen });
      if (!result.ok) {
        setCurrencySaving(false);
        setAutosave("error");
        return;
      }
      setValues((current) => {
        const next: PreferencesValues = { ...current, baseCurrencyCode: chosen };
        lastCommittedRef.current = next;
        return next;
      });
      setPendingCurrency(null);
      setCurrencySaving(false);
      setFxReconcileCount(result.pendingFxOrderCount);
      setLastSavedAt(Date.now());
      setAutosave("saved");
    });
  }, [currencyDirty, currencySaving, pendingCurrency, startTransition]);

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

  const countryOptions = useMemo(() => {
    // Localized full country name (e.g. "Perú" in es, "Peru" in en) instead of the raw ISO code,
    // shown both in the dropdown options and the selected value. Falls back to the code if the
    // runtime cannot resolve a display name.
    const countryNames = new Intl.DisplayNames([locale], { type: "region" });
    return COUNTRY_CODES.map((code) => ({
      value: code,
      label: `${COUNTRY_FLAG_EMOJI_BY_CODE[code]} ${countryNames.of(code) ?? code}`,
    }));
  }, [locale]);

  // "PEN — Sol peruano": code plus its localized name, searchable by either, sorted by name so the
  // small allowlist reads alphabetically.
  const currencyOptions = useMemo(
    () =>
      ALLOWED_COLLECTOR_BASE_CURRENCY_CODES.map((code) => ({
        value: code,
        label: `${code} — ${tCurrencies(code as never)}`,
      })).sort((a, b) => a.label.localeCompare(b.label, locale)),
    [locale, tCurrencies],
  );

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
              aria-label={t("preferences.collector.rows.country")}
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
          align="control"
          value={
            <div className="flex flex-col gap-2">
              <SearchableSelect
                id={currencyId}
                aria-label={t("preferences.collector.rows.currency")}
                options={currencyOptions}
                value={selectedCurrency}
                onChange={handleCurrencySelect}
                clearable={false}
                disabled={currencySaving}
                placeholder={t("preferences.collector.currency.placeholder")}
                clearLabel={t("preferences.collector.currency.changeButton")}
                noResultsLabel={t("preferences.collector.currency.noResults")}
              />
              {currencyDirty ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" onClick={handleCurrencySave} disabled={currencySaving}>
                    {currencySaving
                      ? t("preferences.collector.currency.pending")
                      : t("preferences.collector.currency.save")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCurrencyCancel}
                    disabled={currencySaving}
                  >
                    {t("preferences.collector.currency.cancel")}
                  </Button>
                  <span className="text-[12px] [color:var(--text-muted)]">
                    {t("preferences.collector.currency.dirtyHint")}
                  </span>
                </div>
              ) : fxReconcileCount > 0 ? (
                <Link
                  href={`/${locale}${ROUTES.orders}?fxPending=true`}
                  className="inline-flex w-fit items-center gap-1 text-[13px] [font-weight:var(--font-weight-medium)] [color:var(--accent)] hover:underline focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:outline-offset-2"
                >
                  {t("preferences.collector.currency.reconcileLink", { count: fxReconcileCount })}
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          }
          fullWidthValue
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
              <Label htmlFor={resetDayId} className="mb-0 text-[13px] [color:var(--text-secondary)]">
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

      <SettingsNotificationsSection locale={locale} initialPreferences={initialNotificationPreferences} />

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
    </div>
  );
}

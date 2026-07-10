"use client";

import { Check, Coins, TriangleAlert } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Modal from "@/components/modules/Modal/Modal";
import { ALLOWED_COLLECTOR_BASE_CURRENCY_CODES } from "@/lib/catalog/collectorCountries";
import { ROUTES } from "@/lib/constants";
import { updateCurrencyAction } from "@/app/[locale]/(app)/settings/_actions/preferencesActions";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/styles";

export type CurrencyModalProps = {
  isOpen: boolean;
  onClose: () => void;
  locale: Locale;
  initialCurrencyCode: string | null;
  onSaved: (currencyCode: string) => void;
};

export default function CurrencyModal({ isOpen, onClose, locale, initialCurrencyCode, onSaved }: CurrencyModalProps) {
  const t = useTranslations("settings");
  const tCurrencies = useTranslations("settings.preferences.currencies");
  const router = useRouter();
  const [selected, setSelected] = useState<string>(initialCurrencyCode ?? "USD");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingPath, setPendingPath] = useState<"without" | "update" | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) return;
    // Intentional state reset on modal re-open.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(initialCurrencyCode ?? "USD");
    setErrorMessage(null);
    setPendingPath(null);
  }, [initialCurrencyCode, isOpen]);

  const isPending = pendingPath !== null;
  const dirty = selected !== initialCurrencyCode;

  const submit = (saveFxRates: boolean) => {
    if (!dirty || isPending) return;
    setErrorMessage(null);
    setPendingPath(saveFxRates ? "update" : "without");
    startTransition(async () => {
      const result = await updateCurrencyAction({ baseCurrencyCode: selected, saveFxRates });
      if (!result.ok) {
        setPendingPath(null);
        setErrorMessage(t(`preferences.errors.${result.error}` as never));
        return;
      }
      onSaved(selected);
      if (result.redirectToFxReconcile) {
        // Redirect to the existing FX reconciliation flow on /orders so the user
        // sees per-row preview before any rate is applied (research-driven, see §research
        // synthesis in the S8 Fase B plan).
        router.push(`/${locale}${ROUTES.orders}`);
      }
      onClose();
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("preferences.currencyModal.title")}
      subtitle={t("preferences.currencyModal.subtitle")}
      icon={<Coins size={20} aria-hidden="true" />}
      tone="warning"
      dismissible={!isPending}
      tertiaryAction={{
        label: t("preferences.currencyModal.cancel"),
        onClick: onClose,
        disabled: isPending,
      }}
      secondaryAction={{
        label:
          pendingPath === "without"
            ? t("preferences.currencyModal.pending")
            : t("preferences.currencyModal.saveWithout"),
        onClick: () => submit(false),
        disabled: !dirty || isPending,
      }}
      primaryAction={{
        label:
          pendingPath === "update"
            ? t("preferences.currencyModal.pending")
            : t("preferences.currencyModal.saveAndUpdate"),
        onClick: () => submit(true),
        disabled: !dirty || isPending,
        loading: pendingPath === "update",
      }}
    >
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed [color:var(--text-secondary)]">
          {t("preferences.currencyModal.intro")}
        </p>

        <ul role="listbox" aria-label={t("preferences.currencyModal.listAriaLabel")} className="flex flex-col gap-1">
          {ALLOWED_COLLECTOR_BASE_CURRENCY_CODES.map((code) => {
            const isSelected = code === selected;
            return (
              <li key={code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => setSelected(code)}
                  disabled={isPending}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-left",
                    "transition-colors [background:var(--surface)] [border:1px_solid_var(--border)]",
                    "hover:[border-color:var(--border-strong)]",
                    "focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:-2px]",
                    isSelected && [
                      "[background:color-mix(in_oklch,var(--accent)_8%,var(--surface))]",
                      "[border-color:color-mix(in_oklch,var(--accent)_36%,transparent)]",
                    ],
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex min-w-[44px] justify-start [font-family:var(--font-mono)] text-[13px]",
                      "[font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]",
                    )}
                  >
                    {code}
                  </span>
                  <span className="flex-1 text-[13px] [color:var(--text-secondary)]">{tCurrencies(code as never)}</span>
                  {isSelected ? <Check size={16} aria-hidden="true" className="[color:var(--accent)]" /> : null}
                </button>
              </li>
            );
          })}
        </ul>

        <div
          role="note"
          className={cn(
            "flex items-start gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 text-[12.5px] leading-relaxed",
            "[color:var(--warning)] [background:color-mix(in_oklch,var(--warning)_10%,transparent)]",
            "[border:1px_solid_color-mix(in_oklch,var(--warning)_24%,transparent)]",
          )}
        >
          <TriangleAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{t("preferences.currencyModal.warning")}</span>
        </div>

        {errorMessage ? (
          <p role="alert" className="text-[12px] [color:var(--destructive)]">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

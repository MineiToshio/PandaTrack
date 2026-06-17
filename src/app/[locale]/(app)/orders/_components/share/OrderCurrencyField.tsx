"use client";

import { ChevronsUpDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MobilePicker, type MobilePickerOption } from "@/components/modules/MobilePicker";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/styles";
import { foldSearchText } from "@/lib/strings/foldSearchText";

// Currency code → glyph used in the row icon column on mobile (compact)
const CURRENCY_GLYPHS: Record<string, string> = {
  USD: "$",
  ARS: "AR$",
  EUR: "€",
  JPY: "¥",
  GBP: "£",
  BRL: "R$",
  CAD: "C$",
  CLP: "CLP",
  CNY: "¥",
  COP: "COP",
  KRW: "₩",
  MXN: "MX$",
  PEN: "S/",
};

type CurrencyOption = { code: string; label: string };

type OrderCurrencyFieldProps = {
  id: string;
  options: CurrencyOption[];
  value: string;
  onChange: (next: string) => void;
  baseCurrencyCode: string | null;
  error?: boolean;
};

export default function OrderCurrencyField({
  id,
  options,
  value,
  onChange,
  baseCurrencyCode,
  error,
}: OrderCurrencyFieldProps) {
  const t = useTranslations("orders.form");
  const tPicker = useTranslations("orders.picker");
  const isMobile = useIsMobile();

  const selected = useMemo(() => options.find((o) => o.code === value) ?? null, [options, value]);

  // Desktop combobox state
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<number | null>(null);

  const filtered = useMemo(() => {
    if (!open) return [] as CurrencyOption[];
    const folded = foldSearchText(query);
    return folded
      ? options.filter((o) => foldSearchText(o.code).includes(folded) || foldSearchText(o.label).includes(folded))
      : options;
  }, [open, query, options]);

  const safeActive = useMemo(() => {
    if (filtered.length === 0) return -1;
    if (activeIdx < 0) return 0;
    return Math.min(activeIdx, filtered.length - 1);
  }, [activeIdx, filtered.length]);

  const openCombobox = useCallback(() => {
    setQuery("");
    setActiveIdx(-1);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const closeCombobox = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIdx(-1);
  }, []);

  const handleClear = useCallback(() => {
    onChange("");
    closeCombobox();
    inputRef.current?.focus();
  }, [onChange, closeCombobox]);

  useEffect(
    () => () => {
      if (blurTimer.current) window.clearTimeout(blurTimer.current);
    },
    [],
  );

  // Mobile picker — sort base currency first
  const sortedForMobile = useMemo(() => {
    const base = options.find((o) => o.code === baseCurrencyCode);
    const rest = options.filter((o) => o.code !== baseCurrencyCode);
    return base ? [base, ...rest] : rest;
  }, [options, baseCurrencyCode]);

  const mobileOptions: MobilePickerOption[] = useMemo(
    () =>
      sortedForMobile.map((opt) => {
        const isBase = baseCurrencyCode && opt.code === baseCurrencyCode;
        const description = isBase
          ? tPicker("currencyBaseRow")
          : baseCurrencyCode
            ? tPicker("currencyOtherRow", { from: opt.code, to: baseCurrencyCode })
            : undefined;
        return {
          value: opt.code,
          label: opt.label,
          description,
          searchText: `${opt.code} ${opt.label}`,
          icon: (
            <span className="font-mono text-[13px] leading-none font-semibold">
              {CURRENCY_GLYPHS[opt.code] ?? opt.code}
            </span>
          ),
        };
      }),
    [sortedForMobile, baseCurrencyCode, tPicker],
  );

  const [sheetOpen, setSheetOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          id={id}
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          aria-invalid={error || undefined}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] px-3 text-left",
            "h-[2.875rem] [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]",
            error &&
              "[border-color:var(--destructive)] [background:color-mix(in_oklch,var(--destructive)_5%,var(--surface-elevated))]",
            "focus-visible:[box-shadow:0_0_0_3px_var(--focus-ring)] focus-visible:outline-none",
          )}
        >
          <span className={cn("text-[14px]", selected ? "[color:var(--text-primary)]" : "[color:var(--text-muted)]")}>
            {selected ? selected.label : t("currencyPlaceholder")}
          </span>
          <ChevronsUpDown size={16} className="shrink-0 [color:var(--text-muted)]" aria-hidden />
        </button>

        <MobilePicker
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={tPicker("currencyTitle")}
          searchPlaceholder={tPicker("currencySearch")}
          emptyLabel={tPicker("currencyEmpty")}
          options={mobileOptions}
          selectedValue={value || null}
          onSelect={(v) => onChange(v)}
          hint={
            baseCurrencyCode ? (
              <span>
                {tPicker.rich("currencyBaseHint", {
                  code: baseCurrencyCode,
                  strong: (chunks) => <strong className="[color:var(--text-primary)]">{chunks}</strong>,
                })}
              </span>
            ) : undefined
          }
        />
      </>
    );
  }

  // Desktop combobox
  const renderClosedSelected = Boolean(selected && !open);

  return (
    <div className="relative">
      <div
        className={cn(
          "flex h-[2.875rem] w-full items-center gap-2 rounded-[var(--radius-md)] px-3 text-sm transition-colors",
          "[background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]",
          error &&
            "[border-color:var(--destructive)] [background:color-mix(in_oklch,var(--destructive)_5%,var(--surface-elevated))]",
          "focus-within:[box-shadow:0_0_0_3px_color-mix(in_oklch,var(--accent)_15%,transparent)]",
        )}
      >
        {renderClosedSelected ? (
          <button
            type="button"
            id={id}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            onClick={openCombobox}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openCombobox();
              }
            }}
            className="flex min-w-0 flex-1 items-center text-left text-[13px] [color:var(--text-primary)]"
          >
            <span className="truncate">{selected!.label}</span>
          </button>
        ) : (
          <input
            ref={inputRef}
            id={id}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={`${id}-list`}
            aria-activedescendant={safeActive >= 0 ? `${id}-opt-${safeActive}` : undefined}
            aria-invalid={error || undefined}
            value={open ? query : ""}
            placeholder={selected ? selected.label : t("currencyPlaceholder")}
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] [color:var(--text-primary)] placeholder:[color:var(--text-muted)] focus:outline-none"
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActiveIdx(-1);
            }}
            onClick={() => setOpen(true)}
            onBlur={() => {
              blurTimer.current = window.setTimeout(() => closeCombobox(), 150);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                if (!open) setOpen(true);
                else if (filtered.length > 0) setActiveIdx((p) => (p < 0 ? 0 : (p + 1) % filtered.length));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (!open) setOpen(true);
                else if (filtered.length > 0) setActiveIdx((p) => (p <= 0 ? filtered.length - 1 : p - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const opt = filtered[safeActive];
                if (opt) {
                  onChange(opt.code);
                  closeCombobox();
                }
              } else if (e.key === "Escape") {
                closeCombobox();
              }
            }}
          />
        )}
        {selected && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={t("currencyClearLabel")}
            className="shrink-0 rounded p-0.5 [color:var(--text-muted)] hover:[color:var(--text-primary)] focus-visible:[box-shadow:0_0_0_2px_var(--focus-ring)] focus-visible:outline-none"
          >
            <X size={13} aria-hidden />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          onClick={() => (open ? closeCombobox() : openCombobox())}
          aria-hidden
          className="shrink-0 rounded p-0.5 [color:var(--text-muted)]"
        >
          <ChevronsUpDown size={15} aria-hidden />
        </button>
      </div>

      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-auto rounded-[10px] p-1 [box-shadow:0_8px_24px_color-mix(in_oklch,black_18%,transparent)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)]"
          onMouseDown={(e) => e.preventDefault()}
        >
          {filtered.length === 0 && (
            <li className="px-2 py-2 text-[13px] [color:var(--text-muted)]">{tPicker("currencyEmpty")}</li>
          )}
          {filtered.map((opt, idx) => {
            const isBase = baseCurrencyCode && opt.code === baseCurrencyCode;
            return (
              <li key={opt.code}>
                <button
                  id={`${id}-opt-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={safeActive === idx}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => {
                    onChange(opt.code);
                    closeCombobox();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] [color:var(--text-primary)]",
                    safeActive === idx
                      ? "[background:color-mix(in_oklch,var(--accent)_10%,transparent)]"
                      : "hover:[background:color-mix(in_oklch,var(--text-primary)_4%,transparent)]",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                  {isBase && (
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium [color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_10%,transparent)]">
                      base
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

"use client";

import { ChevronsUpDown, Plus, PlusCircle, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StoreAvatar from "@/components/core/StoreAvatar";
import { MobilePicker } from "@/components/modules/MobilePicker";
import { useIsMobile } from "@/hooks/useIsMobile";
import { AUTH_RETURN_TO_PARAM } from "@/lib/auth/authRedirect";
import { isCollectorCountryCode, PRIMARY_CURRENCY_BY_COUNTRY } from "@/lib/catalog/collectorCountries";
import { RETURN_TO_ORDER_CREATE, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import { foldSearchText } from "@/lib/strings/foldSearchText";

export type OrderStoreOption = {
  id: string;
  name: string;
  countryCode: string;
};

type OrderStoreFieldProps = {
  id: string;
  stores: OrderStoreOption[];
  value: string | null;
  onChange: (next: string | null) => void;
  error?: boolean;
};

function storeMeta(store: OrderStoreOption): string | undefined {
  const upper = store.countryCode.toUpperCase();
  if (!isCollectorCountryCode(upper)) return undefined;
  const cur = PRIMARY_CURRENCY_BY_COUNTRY[upper];
  return cur ? `${upper} · ${cur}` : upper;
}

export default function OrderStoreField({ id, stores, value, onChange, error }: OrderStoreFieldProps) {
  const t = useTranslations("orders.form");
  const tPicker = useTranslations("orders.picker");
  const locale = useLocale();
  const isMobile = useIsMobile();

  const selectedStore = useMemo(() => stores.find((s) => s.id === value) ?? null, [stores, value]);
  const createHref = `/${locale}${ROUTES.storesNew}?${AUTH_RETURN_TO_PARAM}=${RETURN_TO_ORDER_CREATE}`;

  const [sheetOpen, setSheetOpen] = useState(false);

  // Desktop combobox state
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<number | null>(null);

  const filtered = useMemo(() => {
    if (!open) return [] as OrderStoreOption[];
    const folded = foldSearchText(query);
    return folded ? stores.filter((s) => foldSearchText(s.name).includes(folded)) : stores;
  }, [open, query, stores]);

  const total = filtered.length + 1; // +1 for create option
  const safeActive = useMemo(() => {
    if (total === 0) return -1;
    if (activeIdx < 0) return 0;
    return Math.min(activeIdx, total - 1);
  }, [activeIdx, total]);

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
    onChange(null);
    closeCombobox();
    inputRef.current?.focus();
  }, [onChange, closeCombobox]);

  useEffect(
    () => () => {
      if (blurTimer.current) window.clearTimeout(blurTimer.current);
    },
    [],
  );

  const mobileOptions = useMemo(
    () =>
      stores.map((s) => ({
        value: s.id,
        label: s.name,
        description: storeMeta(s),
        avatar: <StoreAvatar store={{ name: s.name }} size={32} />,
        searchText: `${s.name} ${s.countryCode}`,
      })),
    [stores],
  );

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
            "flex h-[2.875rem] w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-left",
            "[background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]",
            error &&
              "[border-color:var(--destructive)] [background:color-mix(in_oklch,var(--destructive)_5%,var(--surface-elevated))]",
            "focus-visible:[box-shadow:0_0_0_3px_var(--focus-ring)] focus-visible:outline-none",
          )}
        >
          {selectedStore ? (
            <>
              <StoreAvatar store={{ name: selectedStore.name }} size={24} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium [color:var(--text-primary)]">
                {selectedStore.name}
              </span>
            </>
          ) : (
            <span className="flex-1 text-[14px] [color:var(--text-muted)]">{t("storePlaceholder")}</span>
          )}
          <ChevronsUpDown size={16} className="shrink-0 [color:var(--text-muted)]" aria-hidden />
        </button>

        <MobilePicker
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={tPicker("storeTitle")}
          searchPlaceholder={tPicker("storeSearch")}
          emptyLabel={tPicker("storeEmpty")}
          options={mobileOptions}
          selectedValue={value}
          onSelect={(v) => onChange(v)}
          inlineAction={{
            label: tPicker("storeCreate"),
            icon: <Plus size={14} aria-hidden />,
            href: createHref,
          }}
        />
      </>
    );
  }

  // Desktop combobox
  const renderClosedSelected = Boolean(selectedStore && !open);

  return (
    <div>
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
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              <StoreAvatar store={{ name: selectedStore!.name }} size={24} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium [color:var(--text-primary)]">
                {selectedStore!.name}
              </span>
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
              placeholder={selectedStore ? selectedStore.name : t("storePlaceholder")}
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
                  else setActiveIdx((p) => (p < 0 ? 0 : (p + 1) % total));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  if (!open) setOpen(true);
                  else setActiveIdx((p) => (p <= 0 ? total - 1 : p - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (safeActive === filtered.length) {
                    closeCombobox();
                  } else {
                    const opt = filtered[safeActive];
                    if (opt) {
                      onChange(opt.id);
                      closeCombobox();
                    }
                  }
                } else if (e.key === "Escape") {
                  closeCombobox();
                }
              }}
            />
          )}
          {selectedStore && (
            <button
              type="button"
              onClick={handleClear}
              aria-label={t("storeClearLabel")}
              className="shrink-0 rounded p-0.5 [color:var(--text-muted)] hover:[color:var(--text-primary)] focus-visible:[box-shadow:0_0_0_2px_var(--focus-ring)] focus-visible:outline-none"
            >
              <X size={13} aria-hidden />
            </button>
          )}
          {!selectedStore && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => (open ? closeCombobox() : openCombobox())}
              aria-hidden
              className="shrink-0 rounded p-0.5 [color:var(--text-muted)]"
            >
              <ChevronsUpDown size={15} aria-hidden />
            </button>
          )}
        </div>

        {open && (
          <ul
            id={`${id}-list`}
            role="listbox"
            className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-auto rounded-[10px] p-1 [box-shadow:0_8px_24px_color-mix(in_oklch,black_18%,transparent)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)]"
            onMouseDown={(e) => e.preventDefault()}
          >
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-[13px] [color:var(--text-muted)]">{tPicker("storeEmpty")}</li>
            ) : (
              filtered.map((store, idx) => (
                <li key={store.id}>
                  <button
                    id={`${id}-opt-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={safeActive === idx}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => {
                      onChange(store.id);
                      closeCombobox();
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] [color:var(--text-primary)]",
                      safeActive === idx
                        ? "[background:color-mix(in_oklch,var(--accent)_10%,transparent)]"
                        : "hover:[background:color-mix(in_oklch,var(--text-primary)_4%,transparent)]",
                    )}
                  >
                    <StoreAvatar store={{ name: store.name }} size={24} />
                    <span className="min-w-0 flex-1 truncate font-medium">{store.name}</span>
                    {storeMeta(store) && (
                      <span className="shrink-0 text-[11px] [color:var(--text-muted)]">{storeMeta(store)}</span>
                    )}
                  </button>
                </li>
              ))
            )}
            <li className="mx-1 my-1 pt-1 [border-top:1px_solid_var(--border)]">
              <Link
                id={`${id}-opt-${filtered.length}`}
                href={createHref}
                role="option"
                aria-selected={safeActive === filtered.length}
                onMouseEnter={() => setActiveIdx(filtered.length)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-[13px] font-medium [color:var(--accent)]",
                  safeActive === filtered.length
                    ? "[background:color-mix(in_oklch,var(--accent)_12%,transparent)]"
                    : "hover:[background:color-mix(in_oklch,var(--accent)_8%,transparent)]",
                )}
              >
                <PlusCircle size={14} aria-hidden /> {tPicker("storeCreate")}
              </Link>
            </li>
          </ul>
        )}
      </div>

      {!selectedStore && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] [color:var(--text-muted)]">
          <span>{t("storeNotFoundQuestion")}</span>
          <Link
            href={createHref}
            className="inline-flex items-center gap-1 text-[12px] [color:var(--accent)] hover:underline"
          >
            <PlusCircle size={12} aria-hidden /> {tPicker("storeCreate")}
          </Link>
        </p>
      )}
    </div>
  );
}

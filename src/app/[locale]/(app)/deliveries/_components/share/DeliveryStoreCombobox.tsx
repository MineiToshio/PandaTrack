"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import StoreAvatar from "@/components/core/StoreAvatar";
import { cn } from "@/lib/styles";
import { foldSearchText } from "@/lib/strings/foldSearchText";

export type DeliveryStoreOption = {
  storeId: string;
  storeName: string;
  /** Eligible-product count shown as trailing meta ("N productos sin entregar"). */
  eligibleCount: number;
};

type DeliveryStoreComboboxProps = {
  id: string;
  stores: DeliveryStoreOption[];
  value: string | null;
  onChange: (next: string) => void;
  placeholder: string;
  noResultsLabel: string;
  /** Formats the trailing eligible-count meta of each option. */
  eligibleCountLabel: (count: number) => string;
  listAriaLabel: string;
  error?: boolean;
};

/**
 * Store combobox for the standalone create entry (FR-08-16/17): only stores with
 * eligible products are listed, each with its pending-product count. Accent-folded
 * search; no "create new store" escape hatch (an ineligible store is not fixable here).
 */
export default function DeliveryStoreCombobox({
  id,
  stores,
  value,
  onChange,
  placeholder,
  noResultsLabel,
  eligibleCountLabel,
  listAriaLabel,
  error = false,
}: DeliveryStoreComboboxProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedStore = useMemo(() => stores.find((s) => s.storeId === value) ?? null, [stores, value]);

  const filteredStores = useMemo(() => {
    if (!isOpen) return [];
    const folded = foldSearchText(query);
    if (!folded) return stores;
    return stores.filter((s) => foldSearchText(s.storeName).includes(folded));
  }, [isOpen, stores, query]);

  const safeActiveIndex = useMemo(() => {
    if (filteredStores.length === 0) return -1;
    if (activeIndex < 0) return 0;
    return Math.min(activeIndex, filteredStores.length - 1);
  }, [activeIndex, filteredStores.length]);

  const select = useCallback(
    (storeId: string) => {
      onChange(storeId);
      setQuery("");
      setIsOpen(false);
      setActiveIndex(-1);
    },
    [onChange],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((prev) => {
        const norm = prev < 0 ? 0 : Math.min(prev, filteredStores.length - 1);
        const next = norm + delta;
        if (next < 0) return filteredStores.length - 1;
        return next % Math.max(filteredStores.length, 1);
      });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const active = filteredStores[safeActiveIndex];
      if (active) select(active.storeId);
      return;
    }
    if (event.key === "Escape") {
      setQuery("");
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleOpenList = useCallback(() => {
    setQuery("");
    setActiveIndex(-1);
    setIsOpen(true);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const showClosedValueTrigger = Boolean(selectedStore && !isOpen);

  return (
    <div className="relative">
      <div
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-[var(--radius-md)] px-3 text-sm transition-colors",
          "[background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]",
          "focus-within:[border-color:var(--accent)] focus-within:outline-none",
          error && "[border-color:var(--destructive)]",
        )}
      >
        <Search size={14} aria-hidden className="shrink-0 [color:var(--text-muted)]" />
        {showClosedValueTrigger ? (
          <button
            type="button"
            id={id}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={`${id}-options`}
            className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left [color:var(--text-primary)] focus-visible:outline-none"
            onClick={handleOpenList}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleOpenList();
              }
            }}
          >
            <StoreAvatar store={{ name: selectedStore!.storeName }} size={24} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{selectedStore!.storeName}</span>
          </button>
        ) : (
          <input
            ref={inputRef}
            id={id}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-controls={`${id}-options`}
            aria-activedescendant={safeActiveIndex >= 0 ? `${id}-option-${safeActiveIndex}` : undefined}
            value={isOpen ? query : ""}
            placeholder={selectedStore ? selectedStore.storeName : placeholder}
            className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm [color:var(--text-primary)] placeholder:[color:var(--text-muted)] focus:outline-none"
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setIsOpen(false), 150);
            }}
            onKeyDown={handleKeyDown}
          />
        )}
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            if (selectedStore) handleOpenList();
            else {
              setIsOpen((prev) => !prev);
              inputRef.current?.focus();
            }
          }}
          className="shrink-0 rounded p-0.5 [color:var(--text-muted)]"
          aria-hidden
        >
          <ChevronDown size={16} aria-hidden />
        </button>
      </div>

      {isOpen && (
        <ul
          id={`${id}-options`}
          role="listbox"
          aria-label={listAriaLabel}
          className="absolute top-full right-0 left-0 z-10 mt-1.5 max-h-60 overflow-auto rounded-xl [box-shadow:0_12px_32px_color-mix(in_oklab,var(--text-primary)_12%,transparent)] [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]"
        >
          {filteredStores.length === 0 && (
            <li className="px-3 py-2.5 text-sm [color:var(--text-muted)]">{noResultsLabel}</li>
          )}
          {filteredStores.map((store, idx) => (
            <li key={store.storeId} className={idx > 0 ? "[border-top:1px_solid_var(--border)]" : undefined}>
              <button
                id={`${id}-option-${idx}`}
                type="button"
                role="option"
                aria-selected={store.storeId === value}
                onClick={() => select(store.storeId)}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(idx)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left",
                  safeActiveIndex === idx && "[background:color-mix(in_oklch,var(--accent)_8%,transparent)]",
                )}
              >
                <StoreAvatar store={{ name: store.storeName }} size={24} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium [color:var(--text-primary)]">
                  {store.storeName}
                </span>
                <span className="shrink-0 text-[12px] [color:var(--text-muted)]">
                  {eligibleCountLabel(store.eligibleCount)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

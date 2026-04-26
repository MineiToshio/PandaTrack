"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/styles";
import { foldSearchText } from "@/lib/strings/foldSearchText";

type StoreOption = {
  id: string;
  name: string;
};

type OrderStoreSelectProps = {
  id: string;
  stores: StoreOption[];
  value: string | null;
  onChange: (next: string | null) => void;
  placeholder: string;
  clearLabel: string;
  noResultsLabel: string;
  createLabel: string;
  createWithNameLabel: (name: string) => string;
  onCreateStore: (prefillName?: string) => void;
  error?: boolean;
  disabled?: boolean;
};

export default function OrderStoreSelect({
  id,
  stores,
  value,
  onChange,
  placeholder,
  clearLabel,
  noResultsLabel,
  createLabel,
  createWithNameLabel,
  onCreateStore,
  error = false,
  disabled = false,
}: OrderStoreSelectProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedStore = useMemo(() => stores.find((s) => s.id === value) ?? null, [stores, value]);

  const filteredStores = useMemo(() => {
    if (!isOpen) return [];
    const folded = foldSearchText(query);
    if (!folded) return stores;
    return stores.filter((s) => foldSearchText(s.name).includes(folded));
  }, [isOpen, stores, query]);

  const totalOptions = filteredStores.length + 1;

  const safeActiveIndex = useMemo(() => {
    if (totalOptions === 0) return -1;
    if (activeIndex < 0) return 0;
    return Math.min(activeIndex, totalOptions - 1);
  }, [activeIndex, totalOptions]);

  const select = useCallback(
    (storeId: string) => {
      onChange(storeId);
      setQuery("");
      setIsOpen(false);
      setActiveIndex(-1);
    },
    [onChange],
  );

  const clear = useCallback(() => {
    onChange(null);
    setQuery("");
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }, [onChange]);

  const handleCreate = useCallback(() => {
    setIsOpen(false);
    onCreateStore(query.trim() || undefined);
  }, [onCreateStore, query]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setActiveIndex((prev) => {
        const norm = prev < 0 ? 0 : Math.min(prev, totalOptions - 1);
        return (norm + 1) % totalOptions;
      });
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setActiveIndex((prev) => {
        const norm = prev < 0 ? 0 : Math.min(prev, totalOptions - 1);
        return norm <= 0 ? totalOptions - 1 : norm - 1;
      });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (safeActiveIndex === filteredStores.length) {
        handleCreate();
      } else {
        const active = filteredStores[safeActiveIndex];
        if (active) select(active.id);
      }
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

  const createOptionLabel = query.trim() ? createWithNameLabel(query.trim()) : createLabel;

  return (
    <div className="relative">
      <div
        className={cn(
          "border-input bg-background focus-within:ring-ring flex h-10 w-full items-center rounded-md border text-sm transition-colors focus-within:ring-2 focus-within:ring-offset-2 focus-within:outline-none",
          error && "border-destructive focus-within:ring-destructive",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        {showClosedValueTrigger ? (
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={`${id}-options`}
            className="text-foreground focus-visible:ring-ring flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-left text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed"
            onClick={handleOpenList}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleOpenList();
              }
            }}
          >
            <span className="min-w-0 flex-1 truncate">{selectedStore?.name}</span>
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
            placeholder={!selectedStore ? placeholder : ""}
            disabled={disabled}
            className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm focus:outline-none disabled:cursor-not-allowed"
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
        <div className="flex shrink-0 items-center gap-1 pr-2">
          {selectedStore ? (
            <button
              type="button"
              onClick={clear}
              disabled={disabled}
              aria-label={clearLabel}
              className="focus-visible:ring-ring text-text-muted hover:text-foreground rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none"
            >
              <X size={14} aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            tabIndex={-1}
            onClick={() => {
              if (selectedStore) handleOpenList();
              else {
                setIsOpen((prev) => !prev);
                inputRef.current?.focus();
              }
            }}
            className="focus-visible:ring-ring text-text-muted rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none"
            aria-hidden
          >
            <ChevronDown size={16} aria-hidden />
          </button>
        </div>
      </div>

      {isOpen && (
        <ul
          id={`${id}-options`}
          role="listbox"
          className="border-border bg-background absolute top-full right-0 left-0 z-10 mt-1 max-h-52 overflow-auto rounded-md border p-1 shadow-lg"
        >
          {filteredStores.length === 0 && <li className="text-text-muted px-2 py-2 text-sm">{noResultsLabel}</li>}
          {filteredStores.map((store, idx) => (
            <li key={store.id}>
              <button
                id={`${id}-option-${idx}`}
                type="button"
                role="option"
                aria-selected={safeActiveIndex === idx}
                onClick={() => select(store.id)}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(idx)}
                className={cn(
                  "text-foreground hover:bg-muted focus-visible:ring-ring w-full cursor-pointer rounded px-2 py-2 text-left text-sm focus-visible:ring-2 focus-visible:outline-none",
                  safeActiveIndex === idx && "bg-muted",
                )}
              >
                {store.name}
              </button>
            </li>
          ))}
          <li>
            <button
              id={`${id}-option-${filteredStores.length}`}
              type="button"
              role="option"
              aria-selected={safeActiveIndex === filteredStores.length}
              onClick={handleCreate}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActiveIndex(filteredStores.length)}
              className={cn(
                "text-primary hover:bg-primary/10 focus-visible:ring-ring w-full cursor-pointer rounded px-2 py-2 text-left text-sm font-medium focus-visible:ring-2 focus-visible:outline-none",
                safeActiveIndex === filteredStores.length && "bg-primary/10",
              )}
            >
              {createOptionLabel}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

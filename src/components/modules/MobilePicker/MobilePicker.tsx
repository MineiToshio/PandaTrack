"use client";

import { Check, Plus, Search } from "lucide-react";
import Link from "next/link";
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Sheet from "@/components/modules/Sheet/Sheet";
import { cn } from "@/lib/styles";
import { foldSearchText } from "@/lib/strings/foldSearchText";

export type MobilePickerOption<TValue extends string = string> = {
  value: TValue;
  label: string;
  description?: string;
  icon?: ReactNode;
  avatar?: ReactNode;
  disabled?: boolean;
  searchText?: string;
};

export type MobilePickerInlineAction = {
  label: string;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
};

export type MobilePickerProps<TValue extends string = string> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  options: MobilePickerOption<TValue>[];
  selectedValue: TValue | null;
  onSelect: (value: TValue) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  hint?: ReactNode;
  emptyLabel?: string;
  inlineAction?: MobilePickerInlineAction;
  searchAriaLabel?: string;
  listAriaLabel?: string;
};

export default function MobilePicker<TValue extends string = string>({
  open,
  onOpenChange,
  title,
  options,
  selectedValue,
  onSelect,
  searchable = options.length > 5,
  searchPlaceholder,
  hint,
  emptyLabel,
  inlineAction,
  searchAriaLabel,
  listAriaLabel,
}: MobilePickerProps<TValue>) {
  const reactId = useId();
  const listId = `${reactId}-list`;
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const folded = foldSearchText(query);
    return options.filter((opt) => {
      const haystack = foldSearchText(opt.searchText ?? `${opt.label} ${opt.description ?? ""}`);
      return haystack.includes(folded);
    });
  }, [options, query]);

  const enabledIndexes = useMemo(
    () => filteredOptions.flatMap((opt, idx) => (opt.disabled ? [] : [idx])),
    [filteredOptions],
  );

  // Reset transient picker state when the sheet opens again. Intentional state
  // reset on prop transition — disabling the lint rule on the setState calls.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery("");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(-1);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (searchable) {
      searchRef.current?.focus();
    }
  }, [open, searchable]);

  const handleSelect = useCallback(
    (value: TValue, disabled?: boolean) => {
      if (disabled) return;
      onSelect(value);
      onOpenChange(false);
    },
    [onSelect, onOpenChange],
  );

  const moveActive = useCallback(
    (delta: 1 | -1) => {
      if (enabledIndexes.length === 0) return;
      setActiveIndex((prev) => {
        const currentPos = enabledIndexes.indexOf(prev);
        const startPos = currentPos === -1 ? (delta === 1 ? -1 : 0) : currentPos;
        const nextPos = (startPos + delta + enabledIndexes.length) % enabledIndexes.length;
        const nextIdx = enabledIndexes[nextPos]!;
        rowRefs.current[nextIdx]?.focus();
        return nextIdx;
      });
    },
    [enabledIndexes],
  );

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    }
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLButtonElement>, option: MobilePickerOption<TValue>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelect(option.value, option.disabled);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} size="lg" bodyClassName="px-0 py-0">
      <div className="flex flex-col">
        {searchable && (
          <div className="px-5 pt-2 pb-3">
            <div className="relative flex items-center">
              <Search size={14} className="pointer-events-none absolute left-3 [color:var(--text-muted)]" aria-hidden />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(-1);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder ?? title}
                aria-label={searchAriaLabel ?? searchPlaceholder ?? title}
                aria-controls={listId}
                className={cn(
                  "w-full rounded-[10px] py-2 pr-3 pl-9 text-[13px]",
                  "[color:var(--text-primary)] [background:var(--surface)] [border:1px_solid_var(--border)]",
                  "placeholder:[color:var(--text-muted)]",
                  "focus:[border-color:color-mix(in_oklch,var(--accent)_45%,var(--border))] focus:outline-none",
                  "focus:[box-shadow:0_0_0_3px_color-mix(in_oklch,var(--accent)_18%,transparent)]",
                )}
              />
            </div>
          </div>
        )}
        {hint && <p className="px-5 pb-1 text-[11px] [color:var(--text-muted)]">{hint}</p>}
        <ul id={listId} role="listbox" aria-label={listAriaLabel ?? title} className="flex flex-col gap-1 px-3 py-2">
          {filteredOptions.length === 0 ? (
            <li className="px-4 py-6 text-center text-[13px] [color:var(--text-muted)]">{emptyLabel ?? "—"}</li>
          ) : (
            filteredOptions.map((option, idx) => {
              const isSelected = selectedValue === option.value;
              const isActive = activeIndex === idx;
              return (
                <li key={option.value}>
                  <button
                    ref={(el) => {
                      rowRefs.current[idx] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    onClick={() => handleSelect(option.value, option.disabled)}
                    onKeyDown={(event) => handleRowKeyDown(event, option)}
                    onFocus={() => setActiveIndex(idx)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                      "min-h-[44px]",
                      "[border:1px_solid_transparent]",
                      isSelected
                        ? "[border-color:color-mix(in_oklch,var(--accent)_30%,transparent)] [background:color-mix(in_oklch,var(--accent)_8%,transparent)]"
                        : "hover:[background:color-mix(in_oklch,var(--text-primary)_4%,transparent)]",
                      isActive && "[box-shadow:0_0_0_2px_color-mix(in_oklch,var(--accent)_24%,transparent)]",
                      option.disabled && "cursor-not-allowed",
                      "focus:outline-none focus-visible:[box-shadow:0_0_0_2px_var(--focus-ring)]",
                    )}
                  >
                    {option.avatar ? (
                      <span className="flex shrink-0 items-center justify-center">{option.avatar}</span>
                    ) : option.icon ? (
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px]",
                          "[&_svg]:h-[13px] [&_svg]:w-[13px]",
                          isSelected
                            ? "[color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_14%,transparent)]"
                            : "[color:var(--accent-cool)] [background:color-mix(in_oklch,var(--accent-cool)_8%,transparent)]",
                        )}
                      >
                        {option.icon}
                      </span>
                    ) : null}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] font-medium [color:var(--text-primary)]">
                        {option.label}
                      </span>
                      {option.description && (
                        <span className="truncate text-[11.5px] [color:var(--text-muted)]">{option.description}</span>
                      )}
                    </span>
                    {isSelected && <Check size={15} className="shrink-0 [color:var(--accent)]" aria-hidden />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        {inlineAction && (
          <div className="mx-5 mt-1 mb-3 pt-3 [border-top:1px_solid_var(--border)]">
            {inlineAction.href ? (
              <Link
                href={inlineAction.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium",
                  "[color:var(--text-primary)] [background:transparent] [border:1px_solid_var(--border-strong)]",
                  "hover:[background:color-mix(in_oklch,var(--text-primary)_3%,transparent)]",
                  "transition-colors",
                )}
              >
                {inlineAction.icon ?? <Plus size={14} aria-hidden />}
                {inlineAction.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  inlineAction.onClick?.();
                }}
                className={cn(
                  "flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium",
                  "[color:var(--text-primary)] [background:transparent] [border:1px_solid_var(--border-strong)]",
                  "hover:[background:color-mix(in_oklch,var(--text-primary)_3%,transparent)]",
                  "transition-colors",
                )}
              >
                {inlineAction.icon ?? <Plus size={14} aria-hidden />}
                {inlineAction.label}
              </button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

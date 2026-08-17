"use client";

import { ChevronDown, X } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/styles";
import { foldSearchText } from "@/lib/strings/foldSearchText";

export type SearchableSelectOption = {
  value: string;
  label: string;
  /** Optional decoration rendered before the label (flag, icon, etc.). */
  leadingDecoration?: ReactNode;
};

export type SearchableSelectProps = {
  id: string;
  options: SearchableSelectOption[];
  value: string | null;
  onChange: (next: string | null) => void;
  placeholder: string;
  clearLabel: string;
  noResultsLabel: string;
  /** When false, the selected value cannot be cleared from the UI. */
  clearable?: boolean;
  error?: boolean;
  disabled?: boolean;
  /** Form input name; emits a hidden input so the value is included in form submission. */
  name?: string;
  required?: boolean;
  /** Accessible name for the combobox trigger, so multiple selects on one page are distinguishable. */
  "aria-label"?: string;
  "aria-required"?: boolean;
  "aria-invalid"?: boolean;
};

/**
 * Generic searchable single-select combobox. Filters by value or label as the user types.
 * Uses semantic design tokens so it inherits the active theme.
 */
export default function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder,
  clearLabel,
  noResultsLabel,
  clearable = true,
  error = false,
  disabled = false,
  name,
  required = false,
  "aria-label": ariaLabel,
  "aria-required": ariaRequired,
  "aria-invalid": ariaInvalid = false,
}: SearchableSelectProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  const filtered = useMemo(() => {
    if (!isOpen) return [];
    const folded = foldSearchText(query);
    if (!folded) return options;
    return options.filter((o) => foldSearchText(o.value).includes(folded) || foldSearchText(o.label).includes(folded));
  }, [isOpen, options, query]);

  const totalOptions = filtered.length;

  const safeActiveIndex = useMemo(() => {
    if (totalOptions === 0) return -1;
    if (activeIndex < 0) return 0;
    return Math.min(activeIndex, totalOptions - 1);
  }, [activeIndex, totalOptions]);

  const select = useCallback(
    (next: string) => {
      onChange(next);
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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (totalOptions === 0) return;
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
      if (totalOptions === 0) return;
      setActiveIndex((prev) => {
        const norm = prev < 0 ? 0 : Math.min(prev, totalOptions - 1);
        return norm <= 0 ? totalOptions - 1 : norm - 1;
      });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const active = filtered[safeActiveIndex];
      if (active) select(active.value);
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

  const showClosedValueTrigger = Boolean(selected && !isOpen);

  return (
    <div className="relative">
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
      <div
        className={cn(
          "flex w-full items-center rounded-[var(--radius-md)] text-sm",
          "h-[2.875rem]",
          "[border-width:1px] [border-style:solid]",
          // Border + background + focus glow depend on error state. Emit only one rule per state.
          !error &&
            "[border-color:var(--border-strong)] [background:var(--surface-elevated)] focus-within:[border-color:var(--accent)] focus-within:[box-shadow:0_0_0_3px_color-mix(in_oklch,var(--accent)_15%,transparent)]",
          error &&
            "[border-color:var(--destructive)] [background:color-mix(in_oklch,var(--destructive)_5%,var(--surface-elevated))] focus-within:[box-shadow:0_0_0_3px_color-mix(in_oklch,var(--destructive)_15%,transparent)]",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        {showClosedValueTrigger ? (
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-label={ariaLabel}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={`${id}-options`}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-md)] px-[var(--space-4)] py-[var(--space-3)] text-left text-sm [color:var(--text-primary)] focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:-1px] disabled:cursor-not-allowed"
            onClick={handleOpenList}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleOpenList();
              }
            }}
          >
            {selected?.leadingDecoration ? (
              <span className="flex shrink-0 items-center" aria-hidden>
                {selected.leadingDecoration}
              </span>
            ) : null}
            <span className="min-w-0 flex-1 truncate">{selected?.label}</span>
          </button>
        ) : (
          <input
            ref={inputRef}
            id={id}
            type="text"
            role="combobox"
            aria-label={ariaLabel}
            aria-required={ariaRequired ?? required}
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-invalid={ariaInvalid}
            aria-haspopup="listbox"
            aria-controls={`${id}-options`}
            aria-activedescendant={safeActiveIndex >= 0 ? `${id}-option-${safeActiveIndex}` : undefined}
            value={isOpen ? query : ""}
            placeholder={!selected ? placeholder : ""}
            disabled={disabled}
            className="min-w-0 flex-1 border-0 bg-transparent px-[var(--space-4)] py-[var(--space-3)] text-sm [color:var(--text-primary)] placeholder:[color:var(--text-muted)] focus:outline-none disabled:cursor-not-allowed"
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
        {/*
          Trailing cluster — one touch target at a time (see `docs/design/interface-patterns.md`
          §12, "A field's trailing cluster holds one touch target"). The clear is a real 44×44
          box below `md` and drops to its 18px desktop box from `md` up; the chevron is
          decoration (the input and the value trigger both open the list), so it steps aside
          below `md` rather than sharing 4px of clearance with a 44px neighbour.
        */}
        <div className="flex shrink-0 items-center gap-1 pr-2 [color:var(--text-muted)]">
          {clearable && selected ? (
            <button
              type="button"
              onClick={clear}
              disabled={disabled}
              aria-label={clearLabel}
              className="grid size-11 place-items-center rounded hover:[color:var(--text-primary)] focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:outline-offset-1 disabled:pointer-events-none md:size-[18px]"
            >
              <X size={14} aria-hidden />
            </button>
          ) : null}
          <span aria-hidden className={cn("items-center px-0.5", clearable && selected ? "hidden md:flex" : "flex")}>
            <ChevronDown size={16} />
          </span>
        </div>
      </div>

      {isOpen && (
        <ul
          id={`${id}-options`}
          role="listbox"
          className="absolute top-full right-0 left-0 z-50 mt-1 max-h-52 overflow-auto rounded-[var(--radius-md)] [border-width:1px] [border-style:solid] [border-color:var(--border-strong)] p-1 [box-shadow:var(--shadow-elevation-3)] [background:var(--surface-elevated)]"
        >
          {filtered.length === 0 && <li className="px-2 py-2 text-sm [color:var(--text-muted)]">{noResultsLabel}</li>}
          {filtered.map((opt, idx) => (
            <li key={opt.value}>
              <button
                id={`${id}-option-${idx}`}
                type="button"
                role="option"
                aria-selected={safeActiveIndex === idx}
                onClick={() => select(opt.value)}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(idx)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-2 text-left text-sm [color:var(--text-primary)]",
                  "hover:[background:color-mix(in_oklch,var(--accent)_8%,transparent)]",
                  safeActiveIndex === idx && "[background:color-mix(in_oklch,var(--accent)_10%,transparent)]",
                )}
              >
                {opt.leadingDecoration ? (
                  <span className="flex shrink-0 items-center" aria-hidden>
                    {opt.leadingDecoration}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate">{opt.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

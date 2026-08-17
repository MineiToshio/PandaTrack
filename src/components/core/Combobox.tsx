"use client";

import { cn } from "@/lib/styles";
import { Check, ChevronDown, Loader2, Plus, X } from "lucide-react";
import { useId, useRef, useState } from "react";

export type ComboboxOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type ComboboxSingle = {
  mode?: "single";
  value: string | null;
  onChange: (value: string | null) => void;
};

type ComboboxMulti = {
  mode: "multi";
  value: string[];
  onChange: (value: string[]) => void;
  maxSelected?: number;
};

type ComboboxCommon = {
  id?: string;
  name?: string;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  helperText?: string;
  error?: string | boolean;
  disabled?: boolean;
  loading?: boolean;
  required?: boolean;
  /** Renders a "create new" action at the bottom of the option list. */
  inlineAction?: { label: string; onClick: () => void };
  className?: string;
};

export type ComboboxProps = ComboboxCommon & (ComboboxSingle | ComboboxMulti);

export default function Combobox(props: ComboboxProps) {
  const {
    id,
    name,
    options,
    placeholder = "Select…",
    searchPlaceholder = "Search…",
    helperText,
    error,
    disabled,
    loading,
    required,
    inlineAction,
    className,
  } = props;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const uid = useId();
  const triggerId = id ?? uid;
  const listboxId = `${triggerId}-listbox`;
  const errorId = `${triggerId}-error`;
  const helperId = `${triggerId}-helper`;
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const hasError = Boolean(error);
  const errorMessage = typeof error === "string" ? error : undefined;
  const isMulti = props.mode === "multi";

  const selectedValues: string[] = isMulti ? (props.value as string[]) : props.value ? [props.value as string] : [];

  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
  const allItems = [
    ...filtered,
    ...(inlineAction
      ? [{ value: "__inline_action__", label: inlineAction.label, description: undefined, disabled: false }]
      : []),
  ];

  function isSelected(v: string) {
    return selectedValues.includes(v);
  }

  function toggleOption(opt: ComboboxOption) {
    if (opt.disabled) return;
    if (isMulti) {
      const current = props.value as string[];
      if (isSelected(opt.value)) {
        (props as ComboboxMulti).onChange(current.filter((v) => v !== opt.value));
      } else {
        const max = (props as ComboboxMulti).maxSelected;
        if (max != null && current.length >= max) return;
        (props as ComboboxMulti).onChange([...current, opt.value]);
      }
    } else {
      (props as ComboboxSingle).onChange(isSelected(opt.value) ? null : opt.value);
      closePopover();
    }
  }

  function removeChip(v: string) {
    if (isMulti) {
      (props as ComboboxMulti).onChange((props.value as string[]).filter((x) => x !== v));
    }
  }

  function openPopover() {
    if (disabled || loading) return;
    setOpen(true);
    setQuery("");
    setActiveIndex(0);
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  function closePopover() {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, allItems.length - 1));
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      }
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(allItems.length - 1);
        break;
      case "Enter": {
        e.preventDefault();
        const item = allItems[activeIndex];
        if (!item) break;
        if (item.value === "__inline_action__") {
          inlineAction?.onClick();
          closePopover();
        } else {
          const opt = options.find((o) => o.value === item.value);
          if (opt) toggleOption(opt);
        }
        break;
      }
      case "Backspace": {
        if (isMulti && query === "" && selectedValues.length > 0) {
          removeChip(selectedValues[selectedValues.length - 1]);
        }
        break;
      }
      case "Escape":
      case "Tab":
        closePopover();
        break;
    }
  }

  const selectedOptions = options.filter((o) => isSelected(o.value));
  const triggerLabel = !isMulti && selectedOptions.length === 1 ? selectedOptions[0].label : undefined;

  return (
    <div className={cn("relative w-full", className)}>
      {/* Chips row (multi mode) */}
      {isMulti && selectedOptions.length > 0 && (
        <div className="mb-[var(--space-1_5)] flex flex-wrap gap-[var(--space-1)]">
          {selectedOptions.map((opt) => (
            <span
              key={opt.value}
              className={cn(
                "inline-flex items-center gap-[var(--space-1)] rounded-[var(--radius-pill)]",
                "bg-[color-mix(in_oklch,var(--accent)_var(--state-selected-bg-mix),var(--surface))]",
                "[border:1px_solid_color-mix(in_oklch,var(--accent)_30%,var(--border))]",
                "px-[var(--space-2)] py-[var(--space-0_5)]",
                "[font-family:var(--font-sans)] [font-size:var(--text-caption)] [color:var(--text-primary)]",
              )}
            >
              {opt.label}
              {/*
                Removable-chip contract (`docs/design/interface-patterns.md` §12): the remove is a
                real 44×44 box below `md`, never a `::before`. Chips wrap at 4px, so an expansion
                large enough to reach 44 would overlap the row above and below and, by paint order,
                hand the band to the later chip — a remove that deletes a different chip. The
                negative margins are exactly this chip's own `px-2 py-0.5`, so the target reaches
                the chip's edges and the chip lands at exactly 44px tall instead of 48.
              */}
              <button
                type="button"
                aria-label={`Remove ${opt.label}`}
                onClick={() => removeChip(opt.value)}
                className="-my-[var(--space-0_5)] -mr-[var(--space-2)] grid size-11 place-items-center [color:var(--text-muted)] hover:[color:var(--text-primary)] md:m-0 md:size-[10px]"
              >
                <X size={10} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Trigger */}
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-required={required ? "true" : undefined}
        aria-invalid={hasError ? "true" : undefined}
        aria-describedby={errorMessage ? errorId : helperText ? helperId : undefined}
        aria-busy={loading ? "true" : undefined}
        disabled={disabled}
        onClick={() => (open ? closePopover() : openPopover())}
        className={cn(
          "flex w-full items-center justify-between gap-[var(--space-2)]",
          "min-h-[2.75rem] @md:min-h-[2.5rem]",
          "rounded-[var(--radius-md)] bg-[var(--surface)]",
          "[border:1px_solid_var(--border)]",
          "[font-family:var(--font-sans)] [font-size:var(--text-body)] [color:var(--text-primary)]",
          "cursor-pointer px-[var(--space-4)] py-[var(--space-3)] text-left",
          "transition-[border-color] [transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease-emphasis)]",
          "focus-visible:[border-color:var(--border-strong)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          "focus-visible:[outline-color:var(--focus-ring)]",
          hasError && "[border-color:color-mix(in_oklch,var(--destructive)_60%,var(--border-strong))]",
          open && "[border-color:var(--border-strong)]",
          (disabled || loading) && "pointer-events-none [border-color:var(--border)] [color:var(--text-muted)]",
        )}
      >
        <span className={cn(!triggerLabel && "[color:var(--text-muted)]")}>
          {triggerLabel ?? (isMulti && selectedValues.length > 0 ? `${selectedValues.length} selected` : placeholder)}
        </span>
        <span className="flex flex-shrink-0 items-center [color:var(--text-muted)]">
          {loading ? (
            <Loader2
              size={16}
              aria-hidden="true"
              className="animate-spin"
              style={{ animationDuration: "calc(var(--motion-base) * 4)", animationTimingFunction: "linear" }}
            />
          ) : (
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={cn(
                "transition-transform [transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease-emphasis)]",
                open && "rotate-180",
              )}
            />
          )}
        </span>
      </button>

      {/* Hidden native input for form submission */}
      {name && !isMulti && <input type="hidden" name={name} value={(props.value as string | null) ?? ""} />}

      {/* Popover */}
      {open && (
        <>
          <div className="fixed inset-0 z-[39]" onClick={closePopover} aria-hidden="true" />
          <div
            className={cn(
              "absolute top-full left-0 z-[var(--z-popover)] mt-1 w-full",
              "rounded-[var(--radius-lg)] bg-[var(--surface-elevated)]",
              "[box-shadow:var(--elevation-2)] [border:1px_solid_var(--border)]",
              "overflow-hidden",
            )}
          >
            {/* Search input */}
            <div className="p-[var(--space-2)] [border-bottom:1px_solid_var(--border)]">
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder}
                aria-autocomplete="list"
                aria-controls={listboxId}
                className={cn(
                  "w-full border-0 bg-transparent p-0 outline-none",
                  "[font-family:var(--font-sans)] [font-size:var(--text-body)] [color:var(--text-primary)]",
                  "placeholder:[color:var(--text-muted)]",
                )}
              />
            </div>

            {/* Options list */}
            <ul
              id={listboxId}
              role="listbox"
              aria-multiselectable={isMulti ? "true" : undefined}
              className="max-h-[14rem] overflow-y-auto p-[var(--space-1)]"
            >
              {filtered.length === 0 && !inlineAction && (
                <li className="px-[var(--space-3)] py-[var(--space-2)] [font-size:var(--text-caption)] [color:var(--text-muted)]">
                  No results.
                </li>
              )}
              {filtered.map((opt, idx) => {
                const selected = isSelected(opt.value);
                const active = idx === activeIndex;
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={selected}
                    aria-disabled={opt.disabled ? "true" : undefined}
                    onClick={() => !opt.disabled && toggleOption(opt)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      "flex cursor-pointer items-center gap-[var(--space-2)]",
                      "rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)]",
                      "[font-family:var(--font-sans)] [font-size:var(--text-body)] [color:var(--text-primary)]",
                      active &&
                        !opt.disabled &&
                        "[background:color-mix(in_oklch,var(--text-primary)_var(--state-hover-mix),transparent)]",
                      selected &&
                        "[background:color-mix(in_oklch,var(--accent)_var(--state-selected-bg-mix),var(--surface))]",
                      opt.disabled && "pointer-events-none [color:var(--text-muted)]",
                    )}
                  >
                    <span className="flex-1">{opt.label}</span>
                    {opt.description && (
                      <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">
                        {opt.description}
                      </span>
                    )}
                    {selected && (
                      <span className="flex flex-shrink-0 items-center [color:var(--accent)]">
                        <Check size={14} aria-hidden="true" />
                      </span>
                    )}
                  </li>
                );
              })}
              {inlineAction && (
                <li
                  role="option"
                  aria-selected="false"
                  onClick={() => {
                    inlineAction.onClick();
                    closePopover();
                  }}
                  onMouseEnter={() => setActiveIndex(filtered.length)}
                  className={cn(
                    "flex cursor-pointer items-center gap-[var(--space-2)]",
                    "rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)]",
                    "[font-family:var(--font-sans)] [font-size:var(--text-body)] [color:var(--accent)]",
                    "mt-[var(--space-1)] pt-[var(--space-2)] [border-top:1px_solid_var(--border)]",
                    activeIndex === filtered.length &&
                      "[background:color-mix(in_oklch,var(--accent)_var(--state-hover-mix),transparent)]",
                  )}
                >
                  <Plus size={14} aria-hidden="true" />
                  {inlineAction.label}
                </li>
              )}
            </ul>
          </div>
        </>
      )}

      {errorMessage && (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className="mt-[var(--space-1)] [font-size:var(--text-caption)] [color:var(--destructive-chip-text)]"
        >
          {errorMessage}
        </p>
      )}
      {helperText && !hasError && (
        <p id={helperId} className="mt-[var(--space-1)] [font-size:var(--text-caption)] [color:var(--text-muted)]">
          {helperText}
        </p>
      )}
    </div>
  );
}

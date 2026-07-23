"use client";

import { cn } from "@/lib/styles";
import { ChevronDown, Loader2, X } from "lucide-react";
import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export type SelectGroup = {
  heading: string;
  options: SelectOption[];
};

export type SelectSize = "sm" | "md" | "lg";

export type SelectControlledProps = {
  id?: string;
  name?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  onClear?: () => void;
  options: SelectOption[] | SelectGroup[];
  placeholder?: string;
  clearLabel?: string;
  helperText?: string;
  error?: string | boolean;
  disabled?: boolean;
  loading?: boolean;
  size?: SelectSize;
  required?: boolean;
  renderOption?: (option: SelectOption) => ReactNode;
  renderValue?: (option: SelectOption) => ReactNode;
  className?: string;
  children?: never;
  showChevron?: never;
};

// Native (legacy API) — used when `children` prop is provided.
export type SelectNativeProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  error?: boolean | string;
  showChevron?: boolean;
  size?: SelectSize;
  helperText?: string;
  options?: never;
  loading?: boolean;
};

export type SelectProps = SelectControlledProps | SelectNativeProps;

function isControlled(props: SelectProps): props is SelectControlledProps {
  return "options" in props && props.options !== undefined;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isGrouped(options: SelectOption[] | SelectGroup[]): options is SelectGroup[] {
  return options.length > 0 && "heading" in options[0];
}

function flatOptions(options: SelectOption[] | SelectGroup[]): SelectOption[] {
  if (isGrouped(options)) return options.flatMap((g) => g.options);
  return options;
}

const SIZE_CLASSES: Record<SelectSize, string> = {
  sm: "h-8 px-[var(--space-3)] [font-size:var(--text-caption)] [line-height:var(--text-caption--line-height)]",
  md: "h-11 px-[var(--space-4)] md:h-10 [font-size:var(--text-body)] [line-height:var(--text-body--line-height)]",
  lg: "h-12 px-[var(--space-5)] [font-size:var(--text-body-lg)] [line-height:var(--text-body-lg--line-height)]",
};

// ─── Listbox auto-placement (open up when there isn't room below) ───────────

type ListboxPlacement = "down" | "up";

/** Keep in sync with the listbox's `max-h-[14rem]` class below. */
const LISTBOX_MAX_HEIGHT_PX = 224;
/** Approximate rendered height of a single option row (py-2 + body line-height). */
const OPTION_ITEM_HEIGHT_PX = 36;
/** Approximate rendered height of a group heading row. */
const GROUP_HEADING_HEIGHT_PX = 28;
/** Listbox container padding (p-1, top + bottom). */
const LISTBOX_PADDING_PX = 8;
/** Matches the `mt-1`/`mb-1` gap between trigger and listbox. */
const PLACEMENT_GAP_PX = 4;

/** Rough listbox height used before the listbox itself has been measured (e.g. its first open frame). */
function estimateListboxHeight(options: SelectOption[] | SelectGroup[]): number {
  const grouped = isGrouped(options);
  const itemCount = flatOptions(options).length;
  const headingCount = grouped ? options.length : 0;
  const estimated = itemCount * OPTION_ITEM_HEIGHT_PX + headingCount * GROUP_HEADING_HEIGHT_PX + LISTBOX_PADDING_PX;
  return Math.min(estimated, LISTBOX_MAX_HEIGHT_PX);
}

// ─── Native select (legacy mode) ──────────────────────────────────────────────

const NativeSelect = forwardRef<HTMLSelectElement, SelectNativeProps>(function NativeSelectInner(
  { error, showChevron = false, size = "md", helperText, loading, className, children, disabled, ...rest },
  ref,
) {
  const hasError = Boolean(error);
  const errorMessage = typeof error === "string" ? error : undefined;

  const selectEl = (
    <select
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "w-full cursor-pointer rounded-[var(--radius-md)]",
        "[border-width:1px] [border-style:solid] [font-family:var(--font-sans)] [color:var(--text-primary)]",
        "outline-none",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "focus-visible:[outline-color:var(--focus-ring)]",
        // Border + background depend on error state. Emit only one rule per state.
        !hasError && "[border-color:var(--border-strong)] bg-[var(--surface-elevated)]",
        hasError &&
          "[border-color:var(--destructive)] [background:color-mix(in_oklch,var(--destructive)_5%,var(--surface-elevated))]",
        (disabled || loading) && "pointer-events-none [border-color:var(--border)] [color:var(--text-muted)]",
        showChevron ? "appearance-none pr-10" : "block",
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );

  if (!showChevron) return selectEl;

  return (
    <div className="relative">
      {selectEl}
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 shrink-0 -translate-y-1/2 [color:var(--text-muted)]"
        aria-hidden="true"
      />
      {errorMessage && (
        <p
          role="alert"
          aria-live="polite"
          className="mt-[var(--space-1)] [font-size:var(--text-caption)] [color:var(--destructive-chip-text)]"
        >
          {errorMessage}
        </p>
      )}
      {helperText && !hasError && (
        <p className="mt-[var(--space-1)] [font-size:var(--text-caption)] [color:var(--text-muted)]">{helperText}</p>
      )}
    </div>
  );
});

// ─── Controlled select (custom dropdown, no search) ───────────────────────────

function ControlledSelect({
  id,
  name,
  value,
  onChange,
  onClear,
  options,
  placeholder,
  clearLabel = "Clear",
  helperText,
  error,
  disabled,
  loading,
  size = "md",
  required,
  renderOption,
  renderValue,
  className,
}: SelectControlledProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placement, setPlacement] = useState<ListboxPlacement>("down");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const uid = useId();
  const triggerId = id ?? uid;
  const listboxId = `${triggerId}-listbox`;
  const errorId = `${triggerId}-error`;
  const helperId = `${triggerId}-helper`;

  const hasError = Boolean(error);
  const errorMessage = typeof error === "string" ? error : undefined;
  const flat = flatOptions(options);
  const selectedOption = flat.find((o) => o.value === value) ?? null;

  function openDropdown() {
    if (disabled || loading) return;
    setOpen(true);
    setActiveIndex(-1);
  }

  function closeDropdown() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function selectOption(opt: SelectOption) {
    if (opt.disabled) return;
    onChange(opt.value);
    closeDropdown();
    triggerRef.current?.focus();
  }

  function handleTriggerClick() {
    if (open) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      openDropdown();
    } else if (e.key === "Escape") {
      closeDropdown();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openDropdown();
    }
  }

  function handleListKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    const safeActive = flat.length === 0 || activeIndex < 0 ? -1 : Math.min(activeIndex, flat.length - 1);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (Math.max(prev, 0) + 1) % flat.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => {
          const current = prev <= 0 ? flat.length : prev;
          return current - 1;
        });
        break;
      case "Enter": {
        e.preventDefault();
        const idx = safeActive >= 0 ? safeActive : 0;
        const opt = flat[idx];
        if (opt && !opt.disabled) selectOption(opt);
        break;
      }
      case "Escape":
        e.preventDefault();
        closeDropdown();
        triggerRef.current?.focus();
        break;
      case "Tab":
        closeDropdown();
        break;
    }
  }

  function handleContainerBlur(e: React.FocusEvent) {
    if (!containerRef.current?.contains(e.relatedTarget as Node | null)) {
      closeDropdown();
    }
  }

  // Flip the listbox upward when there isn't enough room below the trigger and the space
  // above is larger. Prefers the actual rendered listbox height (already mounted by the time
  // this runs); falls back to an estimate from option count on the very first measurement.
  const updatePlacement = useCallback(() => {
    if (typeof window === "undefined") return;
    const trigger = triggerRef.current;
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    const measuredHeight = listboxRef.current?.getBoundingClientRect().height;
    const listboxHeight = measuredHeight && measuredHeight > 0 ? measuredHeight : estimateListboxHeight(options);
    const requiredSpace = listboxHeight + PLACEMENT_GAP_PX;

    setPlacement(spaceBelow < requiredSpace && spaceAbove > spaceBelow ? "up" : "down");
  }, [options]);

  // Measure synchronously before paint so the flip never flickers in the wrong direction.
  useLayoutEffect(() => {
    if (!open) return;
    updatePlacement();
  }, [open, updatePlacement]);

  // Keep placement correct while open if the page scrolls or the viewport resizes.
  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    let frame = 0;
    function scheduleUpdate() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updatePlacement();
      });
    }

    window.addEventListener("scroll", scheduleUpdate, true);
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.removeEventListener("scroll", scheduleUpdate, true);
      window.removeEventListener("resize", scheduleUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [open, updatePlacement]);

  const triggerLabel = selectedOption
    ? renderValue
      ? renderValue(selectedOption)
      : selectedOption.label
    : placeholder;

  const ariaDescribedBy = errorMessage ? errorId : helperText ? helperId : undefined;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)} onBlur={handleContainerBlur}>
      {name && <input type="hidden" name={name} value={value ?? ""} readOnly />}

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
        aria-describedby={ariaDescribedBy}
        aria-busy={loading ? "true" : undefined}
        disabled={disabled}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "flex w-full items-center justify-between gap-[var(--space-2)]",
          "rounded-[var(--radius-md)]",
          "[border-width:1px] [border-style:solid]",
          "[font-family:var(--font-sans)] [color:var(--text-primary)]",
          "cursor-pointer text-left",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          "focus-visible:[outline-color:var(--focus-ring)]",
          // Border + background depend on error state. Emit only one rule per state.
          !hasError &&
            "[border-color:var(--border-strong)] bg-[var(--surface-elevated)] focus-visible:[border-color:var(--accent)]",
          !hasError && open && "[border-color:var(--accent)]",
          hasError &&
            "[border-color:var(--destructive)] [background:color-mix(in_oklch,var(--destructive)_5%,var(--surface-elevated))]",
          (disabled || loading) && "pointer-events-none [border-color:var(--border)] opacity-60",
          SIZE_CLASSES[size],
        )}
      >
        <span className={cn("truncate", !selectedOption && "[color:var(--text-muted)]")}>{triggerLabel}</span>
        <span className="flex shrink-0 items-center gap-[var(--space-1)] [color:var(--text-muted)]">
          {selectedOption && onClear && !loading && (
            <span
              role="button"
              tabIndex={0}
              aria-label={clearLabel}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                onClear();
                closeDropdown();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onClear();
                  closeDropdown();
                }
              }}
              className={cn(
                "rounded-sm p-0.5",
                "[color:var(--text-muted)] hover:[color:var(--text-primary)]",
                "transition-colors [transition-duration:var(--motion-fast)]",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1",
                "focus-visible:[outline-color:var(--focus-ring)]",
              )}
            >
              <X size={14} aria-hidden="true" />
            </span>
          )}
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

      {open && (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-required={required ? "true" : undefined}
          tabIndex={-1}
          onKeyDown={handleListKeyDown}
          className={cn(
            "absolute left-0 z-[var(--z-popover)] w-full",
            placement === "up" ? "bottom-full mb-1" : "top-full mt-1",
            "rounded-[var(--radius-lg)]",
            "bg-[var(--surface-elevated)] [border:1px_solid_var(--border)]",
            "[box-shadow:var(--elevation-2)]",
            "max-h-[14rem] overflow-y-auto p-[var(--space-1)] outline-none",
          )}
        >
          {flat.length === 0 && (
            <li
              role="presentation"
              className="px-[var(--space-3)] py-[var(--space-2)] [font-size:var(--text-caption)] [color:var(--text-muted)]"
            >
              No options.
            </li>
          )}
          {isGrouped(options)
            ? (options as SelectGroup[]).map((group) => (
                <li key={group.heading} role="presentation">
                  <span
                    className={cn(
                      "block px-[var(--space-3)] py-[var(--space-1)]",
                      "[font-family:var(--font-mono)] [font-size:var(--text-eyebrow)]",
                      "[letter-spacing:var(--text-eyebrow--letter-spacing)] uppercase",
                      "[color:var(--text-muted)]",
                    )}
                  >
                    {group.heading}
                  </span>
                  <ul role="group">
                    {group.options.map((opt) => {
                      const flatIdx = flat.indexOf(opt);
                      return (
                        <OptionItem
                          key={opt.value}
                          id={`${listboxId}-${flatIdx}`}
                          option={opt}
                          isSelected={opt.value === value}
                          isActive={activeIndex === flatIdx}
                          onSelect={() => selectOption(opt)}
                          onHover={() => setActiveIndex(flatIdx)}
                          renderOption={renderOption}
                        />
                      );
                    })}
                  </ul>
                </li>
              ))
            : (options as SelectOption[]).map((opt, idx) => (
                <OptionItem
                  key={opt.value}
                  id={`${listboxId}-${idx}`}
                  option={opt}
                  isSelected={opt.value === value}
                  isActive={activeIndex === idx}
                  onSelect={() => selectOption(opt)}
                  onHover={() => setActiveIndex(idx)}
                  renderOption={renderOption}
                />
              ))}
        </ul>
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

function OptionItem({
  id,
  option,
  isSelected,
  isActive,
  onSelect,
  onHover,
  renderOption,
}: {
  id: string;
  option: SelectOption;
  isSelected: boolean;
  isActive: boolean;
  onSelect: () => void;
  onHover: () => void;
  renderOption?: (opt: SelectOption) => ReactNode;
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={isSelected}
      aria-disabled={option.disabled ? "true" : undefined}
      onMouseDown={(e) => e.preventDefault()}
      onClick={option.disabled ? undefined : onSelect}
      onMouseEnter={onHover}
      className={cn(
        "flex cursor-pointer items-center gap-[var(--space-2)]",
        "rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)]",
        "[font-family:var(--font-sans)] [font-size:var(--text-body)] [color:var(--text-primary)]",
        "[line-height:var(--text-body--line-height)]",
        isActive &&
          !option.disabled &&
          "[background:color-mix(in_oklch,var(--text-primary)_var(--state-hover-mix),transparent)]",
        option.disabled && "pointer-events-none [color:var(--text-muted)]",
      )}
    >
      <span className="flex-1">{renderOption ? renderOption(option) : option.label}</span>
      {option.description && (
        <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">{option.description}</span>
      )}
    </li>
  );
}

// ─── Public export ─────────────────────────────────────────────────────────────

const Select = forwardRef<HTMLSelectElement, SelectProps>((props, ref) => {
  if (isControlled(props)) {
    return <ControlledSelect {...props} />;
  }
  return <NativeSelect {...(props as SelectNativeProps)} ref={ref} />;
});

Select.displayName = "Select";

export default Select;

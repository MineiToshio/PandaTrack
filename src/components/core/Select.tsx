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
  /**
   * Accessible name for the trigger, for callers whose selected-value text alone doesn't say what
   * the control is (e.g. a bare "Por pedido" / "Por tienda" reads as a value, not as "grouped by").
   * Optional: a trigger whose visible text already names the field doesn't need it.
   */
  "aria-label"?: string;
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

/**
 * `md` matches `<Input>`'s fixed `h-[2.875rem]` (46px) rather than tracking `<Button>`'s 44/40.
 *
 * A select is a form field, and the two sit side by side in every two-column form row in the app,
 * where a 6px difference on a pointer reads as one of them having slipped. `<Input>` and the store
 * combobox already agree on 46px, so the select was the outlier. Buttons are a different family and
 * keep their own scale.
 */
const SIZE_CLASSES: Record<SelectSize, string> = {
  sm: "h-8 px-[var(--space-3)] [font-size:var(--text-caption)] [line-height:var(--text-caption--line-height)]",
  md: "h-[2.875rem] px-[var(--space-4)] [font-size:var(--text-body)] [line-height:var(--text-body--line-height)]",
  lg: "h-12 px-[var(--space-5)] [font-size:var(--text-body-lg)] [line-height:var(--text-body-lg--line-height)]",
};

// ─── Listbox auto-placement (open up when there isn't room below) ───────────

type ListboxPlacement = "down" | "up";

/** Keep in sync with the listbox's `max-h-[17rem]` class below. */
const LISTBOX_MAX_HEIGHT_PX = 272;
/** Approximate rendered height of a single option row (py-2 + body line-height). */
const OPTION_ITEM_HEIGHT_PX = 38;
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
  "aria-label": ariaLabel,
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

  // Moves activeIndex by one step, wrapping at both ends. Starting from -1 (nothing
  // highlighted yet) lands on the first option going down and the last option going up.
  function moveActiveIndex(direction: 1 | -1) {
    setActiveIndex((prev) => {
      if (flat.length === 0) return -1;
      if (prev < 0) return direction === 1 ? 0 : flat.length - 1;
      return (prev + direction + flat.length) % flat.length;
    });
  }

  // Single keyboard handler on the trigger button: DOM focus stays on the button while the
  // listbox is open (aria-activedescendant combobox pattern), so all navigation must live here
  // rather than on the listbox `<ul>`, which never receives focus and is a sibling, not an
  // ancestor, of the button.
  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        moveActiveIndex(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveActiveIndex(-1);
        break;
      case "Enter":
      case " ": {
        e.preventDefault();
        const idx = activeIndex >= 0 ? activeIndex : 0;
        const opt = flat[idx];
        if (opt && !opt.disabled) selectOption(opt);
        break;
      }
      case "Escape":
        e.preventDefault();
        closeDropdown();
        triggerRef.current?.focus();
        break;
      default:
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

  // Keep the highlighted option in view as it moves via keyboard, including when the
  // list itself scrolls (long option lists, e.g. page-size pickers).
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const activeOption = document.getElementById(`${listboxId}-${activeIndex}`);
    activeOption?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex, listboxId]);

  const triggerLabel = selectedOption
    ? renderValue
      ? renderValue(selectedOption)
      : selectedOption.label
    : placeholder;

  const ariaDescribedBy = errorMessage ? errorId : helperText ? helperId : undefined;
  const activeDescendant = open && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)} onBlur={handleContainerBlur}>
      {name && <input type="hidden" name={name} value={value ?? ""} readOnly />}

      {/*
        Invisible width floor: every option label, stacked, contributing its intrinsic width and
        nothing else (zero height, no paint, no hit area, hidden from assistive tech).

        Without it an intrinsically-sized control (`w-max` / `w-auto` in a flex row) is only as wide
        as the label that happens to be *selected*, so the popup — which matches the container —
        squeezes every other option into that box. That is what made the sort dropdowns render two
        lines per option. Sizing to the longest option instead is one of the two widths a dropdown
        may legitimately take, and it keeps the popup exactly as wide as its trigger, so it can
        never overflow the viewport (the listbox is `left-0` with no horizontal flip logic) nor be
        clipped by an `overflow-hidden` ancestor.

        Inert wherever the caller sets an explicit width (`w-full`, `w-[4.5rem]`, `w-[150px]`),
        since a definite width wins over intrinsic sizing.
      */}
      <div aria-hidden className="pointer-events-none h-0 overflow-hidden" data-testid="select-width-sizer">
        {flat.map((option) => (
          <span key={`sizer-${option.value}`} className={cn("block whitespace-nowrap", SIZE_CLASSES[size])}>
            {option.label}
          </span>
        ))}
      </div>

      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeDescendant}
        aria-label={ariaLabel}
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
          className={cn(
            "absolute left-0 z-[var(--z-popover)] w-full",
            placement === "up" ? "bottom-full mb-1" : "top-full mt-1",
            "rounded-[var(--radius-lg)]",
            "bg-[var(--surface-elevated)] [border:1px_solid_var(--border)]",
            "[box-shadow:var(--elevation-2)]",
            // 17rem clears seven 38px rows plus padding, so none of the app's sort menus scroll. A row is
            // 38px (body line-height 22 + py-2), not the 36 the estimate below assumed.
            "max-h-[17rem] overflow-y-auto p-[var(--space-1)] outline-none",
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
      <span className="flex-1 whitespace-nowrap">{renderOption ? renderOption(option) : option.label}</span>
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

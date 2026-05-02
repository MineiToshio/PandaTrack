"use client";

import { cn } from "@/lib/styles";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { forwardRef, useId, useRef, useState, type ReactNode } from "react";

// ─── New S4 controlled types ───────────────────────────────────────────────────

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

// Controlled (new S4 API) — used when `options` prop is provided.
export type SelectControlledProps = {
  id?: string;
  name?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  options: SelectOption[] | SelectGroup[];
  placeholder?: string;
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
// Preserved for backward compatibility; custom popover is S12 work.
// Omit native `size` (number, visible rows) to avoid collision with our design-system size.
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

// ─── Helper ───────────────────────────���───────────────────────────────────────

function isGrouped(options: SelectOption[] | SelectGroup[]): options is SelectGroup[] {
  return options.length > 0 && "heading" in options[0];
}

function flatOptions(options: SelectOption[] | SelectGroup[]): SelectOption[] {
  if (isGrouped(options)) return options.flatMap((g) => g.options);
  return options;
}

const SIZE_CLASSES: Record<SelectSize, string> = {
  sm: "min-h-[2rem] px-[var(--space-3)] py-[var(--space-2)] [font-size:var(--text-caption)]",
  md: "min-h-[2.75rem] @md:min-h-[2.5rem] px-[var(--space-4)] py-[var(--space-3)] [font-size:var(--text-body)]",
  lg: "min-h-[2.75rem] px-[var(--space-4)] py-[var(--space-3)] [font-size:var(--text-body-lg)]",
};

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
        "w-full cursor-pointer rounded-[var(--radius-md)] bg-[var(--surface)]",
        "[font-family:var(--font-sans)] [color:var(--text-primary)] [border:1px_solid_var(--border)]",
        "transition-[border-color] outline-none",
        "[transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease-emphasis)]",
        "focus-visible:[border-color:var(--border-strong)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "focus-visible:[outline-color:var(--focus-ring)]",
        hasError && "[border-color:color-mix(in_oklch,var(--destructive)_60%,var(--border-strong))]",
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

// ─── Controlled select (new S4 mode) ─────────────────────────────────────────

function ControlledSelect({
  id,
  name,
  value,
  onChange,
  options,
  placeholder,
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
  const [typeBuffer, setTypeBuffer] = useState("");
  const typeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const uid = useId();
  const triggerId = id ?? uid;
  const listboxId = `${triggerId}-listbox`;
  const errorId = `${triggerId}-error`;
  const helperId = `${triggerId}-helper`;

  const hasError = Boolean(error);
  const errorMessage = typeof error === "string" ? error : undefined;
  const flat = flatOptions(options);
  const selectedOption = flat.find((o) => o.value === value) ?? null;
  const [activeIndex, setActiveIndex] = useState<number>(() => {
    const idx = flat.findIndex((o) => o.value === value);
    return idx >= 0 ? idx : 0;
  });

  function openPopover() {
    if (disabled || loading) return;
    setOpen(true);
    const idx = flat.findIndex((o) => o.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);
  }

  function closePopover() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function selectOption(opt: SelectOption) {
    if (opt.disabled) return;
    onChange(opt.value);
    closePopover();
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      openPopover();
    }
  }

  function handleListKeyDown(e: React.KeyboardEvent) {
    const enabledIndices = flat.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
    const currentPos = enabledIndices.indexOf(activeIndex);

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next = enabledIndices[(currentPos + 1) % enabledIndices.length];
        setActiveIndex(next ?? activeIndex);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = enabledIndices[(currentPos - 1 + enabledIndices.length) % enabledIndices.length];
        setActiveIndex(prev ?? activeIndex);
        break;
      }
      case "Home":
        e.preventDefault();
        setActiveIndex(enabledIndices[0] ?? activeIndex);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(enabledIndices[enabledIndices.length - 1] ?? activeIndex);
        break;
      case "Enter":
      case " ": {
        e.preventDefault();
        const opt = flat[activeIndex];
        if (opt && !opt.disabled) selectOption(opt);
        break;
      }
      case "Escape":
      case "Tab":
        closePopover();
        break;
      default: {
        if (e.key.length === 1) {
          const next = typeBuffer + e.key.toLowerCase();
          setTypeBuffer(next);
          if (typeTimerRef.current) clearTimeout(typeTimerRef.current);
          typeTimerRef.current = setTimeout(() => setTypeBuffer(""), 500);
          const match = flat.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(next));
          if (match >= 0) setActiveIndex(match);
        }
      }
    }
  }

  const triggerLabel = selectedOption
    ? renderValue
      ? renderValue(selectedOption)
      : selectedOption.label
    : placeholder;

  return (
    <div className={cn("relative w-full", className)}>
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
        name={name}
        onClick={() => (open ? closePopover() : openPopover())}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "flex w-full items-center justify-between gap-[var(--space-2)]",
          "rounded-[var(--radius-md)] bg-[var(--surface)]",
          "[border:1px_solid_var(--border)]",
          "[font-family:var(--font-sans)] [color:var(--text-primary)]",
          "cursor-pointer text-left",
          "transition-[border-color] [transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease-emphasis)]",
          "focus-visible:[border-color:var(--border-strong)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          "focus-visible:[outline-color:var(--focus-ring)]",
          hasError && "[border-color:color-mix(in_oklch,var(--destructive)_60%,var(--border-strong))]",
          open && "[border-color:var(--border-strong)]",
          (disabled || loading) && "pointer-events-none [border-color:var(--border)] [color:var(--text-muted)]",
          SIZE_CLASSES[size],
        )}
      >
        <span className={cn(!selectedOption && "[color:var(--text-muted)]")}>{triggerLabel}</span>
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

      {open && (
        <>
          <div className="fixed inset-0 z-[39]" onClick={closePopover} aria-hidden="true" />
          <ul
            id={listboxId}
            role="listbox"
            aria-required={required ? "true" : undefined}
            onKeyDown={handleListKeyDown}
            tabIndex={-1}
            className={cn(
              "absolute top-full left-0 z-[var(--z-popover)] mt-1 w-full",
              "overflow-y-auto rounded-[var(--radius-lg)]",
              "bg-[var(--surface-elevated)] [border:1px_solid_var(--border)]",
              "[box-shadow:var(--elevation-2)]",
              "max-h-[18rem] p-[var(--space-1)]",
              "outline-none",
            )}
          >
            {flat.length === 0 && (
              <li className="px-[var(--space-3)] py-[var(--space-2)] [font-size:var(--text-caption)] [color:var(--text-muted)]">
                No options yet.
              </li>
            )}
            {isGrouped(options)
              ? options.map((group) => (
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
                      {group.options.map((opt) => (
                        <OptionItem
                          key={opt.value}
                          option={opt}
                          isSelected={opt.value === value}
                          isActive={flat.indexOf(opt) === activeIndex}
                          onSelect={() => selectOption(opt)}
                          onHover={() => setActiveIndex(flat.indexOf(opt))}
                          renderOption={renderOption}
                        />
                      ))}
                    </ul>
                  </li>
                ))
              : (options as SelectOption[]).map((opt, idx) => (
                  <OptionItem
                    key={opt.value}
                    option={opt}
                    isSelected={opt.value === value}
                    isActive={idx === activeIndex}
                    onSelect={() => selectOption(opt)}
                    onHover={() => setActiveIndex(idx)}
                    renderOption={renderOption}
                  />
                ))}
          </ul>
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

function OptionItem({
  option,
  isSelected,
  isActive,
  onSelect,
  onHover,
  renderOption,
}: {
  option: SelectOption;
  isSelected: boolean;
  isActive: boolean;
  onSelect: () => void;
  onHover: () => void;
  renderOption?: (opt: SelectOption) => ReactNode;
}) {
  return (
    <li
      role="option"
      aria-selected={isSelected}
      aria-disabled={option.disabled ? "true" : undefined}
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
        isSelected && "[background:color-mix(in_oklch,var(--accent)_var(--state-selected-bg-mix),var(--surface))]",
        option.disabled && "pointer-events-none [color:var(--text-muted)]",
      )}
    >
      <span className="flex-1">{renderOption ? renderOption(option) : option.label}</span>
      {option.description && (
        <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">{option.description}</span>
      )}
      {isSelected && (
        <span className="flex flex-shrink-0 items-center [color:var(--accent)]">
          <Check size={14} aria-hidden="true" />
        </span>
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

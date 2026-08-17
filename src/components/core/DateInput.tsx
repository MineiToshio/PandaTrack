"use client";

import { cn } from "@/lib/styles";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { DayPicker, type ChevronProps } from "react-day-picker";

// ISO date string "YYYY-MM-DD"
export type ISODateString = string;

export type DateInputProps = {
  id?: string;
  name?: string;
  value: ISODateString | null;
  onChange: (value: ISODateString | null) => void;
  onBlur?: () => void;
  placeholder?: string;
  helperText?: string;
  error?: string | boolean;
  disabled?: boolean;
  loading?: boolean;
  required?: boolean;
  /** ISO date string — disables all dates before this. */
  min?: ISODateString;
  /** ISO date string — disables all dates after this. */
  max?: ISODateString;
  locale?: string;
  className?: string;
};

function parseISO(iso: ISODateString): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m as number) - 1, d as number);
}

function toISO(date: Date): ISODateString {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(iso: ISODateString, locale: string): string {
  const date = parseISO(iso);
  return date.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

function CalendarChevron({ orientation = "right", disabled }: ChevronProps) {
  const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
  return (
    <Icon size={14} strokeWidth={2.5} className={cn(disabled && "[color:var(--text-muted)]")} aria-hidden="true" />
  );
}

export default function DateInput({
  id,
  name,
  value,
  onChange,
  onBlur,
  placeholder = "Select date",
  helperText,
  error,
  disabled,
  loading,
  required,
  min,
  max,
  locale = "en-US",
  className,
}: DateInputProps) {
  const t = useTranslations("components.dateInput");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasError = Boolean(error);
  const errorMessage = typeof error === "string" ? error : undefined;
  const errorId = id ? `${id}-error` : undefined;
  const helperId = id ? `${id}-helper` : undefined;

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        onBlur?.();
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open, onBlur]);

  useEffect(() => {
    if (!open) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open]);

  const selectedDate = value ? parseISO(value) : undefined;
  const minDate = min ? parseISO(min) : undefined;
  const maxDate = max ? parseISO(max) : undefined;

  function handleSelect(day: Date | undefined) {
    onChange(day ? toISO(day) : null);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  const isDisabled = disabled || loading;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/*
        This button is the only accessible surface for the field (it opens the day-picker
        dialog; the sibling `<input type="hidden">` below is excluded from the accessibility
        tree), so `aria-required`/`aria-invalid` are kept despite the button role not
        formally supporting them in the ARIA spec — they are the sole way to expose the
        field's required/invalid state to assistive tech here.
      */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-required={required ? "true" : undefined}
        aria-invalid={hasError ? "true" : undefined}
        aria-describedby={errorMessage ? errorId : helperText ? helperId : undefined}
        aria-busy={loading ? "true" : undefined}
        disabled={isDisabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center justify-between gap-[var(--space-2)]",
          "min-h-[2.75rem] @md:min-h-[2.5rem]",
          "rounded-[var(--radius-md)] bg-[var(--surface)]",
          "[border:1px_solid_var(--border)]",
          "[font-family:var(--font-sans)] [font-size:var(--text-body)]",
          "cursor-pointer px-[var(--space-4)] py-[var(--space-3)] text-left",
          "transition-[border-color] [transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease-emphasis)]",
          "focus-visible:[border-color:var(--border-strong)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          "focus-visible:[outline-color:var(--focus-ring)]",
          hasError && "[border-color:color-mix(in_oklch,var(--destructive)_60%,var(--border-strong))]",
          open && "[border-color:var(--border-strong)]",
          isDisabled && "pointer-events-none [border-color:var(--border)]",
          value ? "[color:var(--text-primary)]" : "[color:var(--text-muted)]",
        )}
      >
        <span className="flex-1 truncate">{value ? formatDisplay(value, locale) : placeholder}</span>
        {/*
          Trailing cluster — one touch target at a time (`docs/design/interface-patterns.md` §12).
          The clear is a 44×44 box below `md`; the negative margins are exactly the trigger's own
          `py-3` / `pr-4`, so the box reaches the field's edges without making the field taller or
          the cluster wider. Growing INTO the parent trigger is safe in a way growing into a
          sibling is not: the trigger is this control's fallback, not its peer, and the click is
          stopped here. The calendar glyph steps aside below `md` — it is decoration, and the
          trigger it sits in is what opens the picker.
        */}
        <span className="flex flex-shrink-0 items-center gap-[var(--space-1)] [color:var(--text-muted)]">
          {value && !isDisabled && (
            <span
              role="button"
              aria-label={t("clear")}
              onClick={handleClear}
              className="-my-[var(--space-3)] -mr-[var(--space-4)] grid size-11 place-items-center hover:[color:var(--text-primary)] md:m-0 md:size-[14px]"
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
            <CalendarDays size={16} aria-hidden="true" className={cn(value && !isDisabled && "hidden md:block")} />
          )}
        </span>
      </button>

      {name && <input type="hidden" name={name} value={value ?? ""} />}

      {open && (
        <div
          role="dialog"
          aria-label={placeholder}
          className={cn(
            "absolute top-full left-0 z-[var(--z-popover)] mt-1",
            "rounded-[var(--radius-lg)] bg-[var(--surface-elevated)]",
            "[box-shadow:var(--elevation-2)] [border:1px_solid_var(--border)]",
            "p-[var(--space-3)]",
          )}
        >
          <DayPicker
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
            onSelect={handleSelect}
            components={{ Chevron: CalendarChevron }}
            classNames={{
              root: "[font-family:var(--font-sans)] [font-size:var(--text-body)]",
              month_caption: "flex items-center justify-center px-1 py-1 mb-2",
              caption_label: "[font-weight:var(--font-weight-medium)] [color:var(--text-primary)]",
              nav: "flex items-center justify-between gap-1 mb-1",
              button_previous: cn(
                "inline-flex h-7 w-7 cursor-pointer items-center justify-center",
                "rounded-[var(--radius-md)] [border:1px_solid_var(--border)]",
                "bg-[var(--surface)] [color:var(--text-primary)]",
                "hover:[background:color-mix(in_oklch,var(--text-primary)_var(--state-hover-mix),transparent)]",
                "focus-visible:outline focus-visible:outline-2 focus-visible:[outline-color:var(--focus-ring)]",
                "disabled:[color:var(--text-muted)] disabled:pointer-events-none",
              ),
              button_next: cn(
                "inline-flex h-7 w-7 cursor-pointer items-center justify-center",
                "rounded-[var(--radius-md)] [border:1px_solid_var(--border)]",
                "bg-[var(--surface)] [color:var(--text-primary)]",
                "hover:[background:color-mix(in_oklch,var(--text-primary)_var(--state-hover-mix),transparent)]",
                "focus-visible:outline focus-visible:outline-2 focus-visible:[outline-color:var(--focus-ring)]",
                "disabled:[color:var(--text-muted)] disabled:pointer-events-none",
              ),
              weeks: "space-y-1",
              weekdays: "flex",
              weekday:
                "[font-family:var(--font-mono)] [font-size:var(--text-eyebrow)] uppercase [letter-spacing:var(--text-eyebrow--letter-spacing)] [color:var(--text-muted)] w-8 text-center",
              week: "flex",
              day: "w-8 h-8 p-0 flex items-center justify-center",
              day_button: cn(
                "w-full h-full cursor-pointer rounded-[var(--radius-md)]",
                "hover:[background:color-mix(in_oklch,var(--text-primary)_var(--state-hover-mix),transparent)]",
                "focus-visible:outline focus-visible:outline-2 focus-visible:[outline-color:var(--focus-ring)]",
                "[color:var(--text-primary)] [font-size:var(--text-body)]",
              ),
              selected:
                "[&>button]:bg-[var(--accent)] [&>button]:[color:var(--text-on-accent)] [&>button]:hover:opacity-90",
              today: "[&>button]:[border:1.5px_solid_var(--accent)]",
              outside: "opacity-40",
              disabled: "opacity-30 pointer-events-none",
            }}
          />
        </div>
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

"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { DayPicker, type ChevronProps, type Matcher } from "react-day-picker";
import Pill from "@/components/core/Pill";
import { cn } from "@/lib/styles";

function CalendarChevron({ orientation = "right", disabled, className }: ChevronProps) {
  const Icon =
    orientation === "left"
      ? ChevronLeft
      : orientation === "up"
        ? ChevronUp
        : orientation === "down"
          ? ChevronDown
          : ChevronRight;
  return <Icon size={16} strokeWidth={2.5} className={cn(disabled && "opacity-40", className)} aria-hidden />;
}

export type DatePickerPreset = { value: string; label: string };

type DatePickerInputProps = {
  id: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder: string;
  disabled?: boolean;
  error?: boolean;
  locale?: string;
  /** When true, disables any date after today (local timezone). */
  disableFuture?: boolean;
  /** Quick-select pills rendered inside the popup. */
  presets?: DatePickerPreset[];
  /** Called when the user picks a preset; consumer resolves the value to a date selection. */
  onPresetSelect?: (value: string) => void;
  /**
   * Popup alignment. `auto` (default) flips to `end` if the popup would overflow the viewport.
   * Use `end` when the input lives near the right edge of a constrained container (drawer, modal).
   */
  popupAlign?: "start" | "end" | "auto";
  /**
   * `"md"` (default) → form-sized input (h=46px, body text 15px).
   * `"sm"` → compact filter-sized input (min-h=44px, caption text 13px) — matches
   * `MultiTagAutocomplete` and the pills inside the filter drawer.
   */
  size?: "md" | "sm";
};

function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

function isFutureCalendarDay(date: Date): boolean {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return startOfDay(date).getTime() > startOfDay(new Date()).getTime();
}

export default function DatePickerInput({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  error = false,
  locale = "en",
  disableFuture = false,
  presets,
  onPresetSelect,
  popupAlign = "auto",
  size = "md",
}: DatePickerInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Auto-flip: on open, measure the popup against the viewport and mutate `left`/`right`
  // directly so we don't trigger a render (lint blocks `setState` inside effects, and the
  // visual flip is purely presentational — no derived state needed downstream).
  useEffect(() => {
    if (!isOpen) return;
    const popup = popupRef.current;
    const container = containerRef.current;
    if (!popup || !container) return;
    if (popupAlign === "end") {
      popup.style.left = "auto";
      popup.style.right = "0";
      return;
    }
    if (popupAlign === "start") {
      popup.style.left = "0";
      popup.style.right = "auto";
      return;
    }
    // auto
    const containerRect = container.getBoundingClientRect();
    const popupWidth = popup.getBoundingClientRect().width;
    const overflowsRight = containerRect.left + popupWidth > window.innerWidth - 8;
    if (overflowsRight) {
      popup.style.left = "auto";
      popup.style.right = "0";
    } else {
      popup.style.left = "0";
      popup.style.right = "auto";
    }
  }, [isOpen, popupAlign]);

  const dayDisabled: Matcher | undefined = disableFuture ? isFutureCalendarDay : undefined;

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center justify-between gap-[var(--space-2)]",
          "rounded-[var(--radius-md)] [border-width:1px] [border-style:solid] [color:var(--text-primary)]",
          "transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]",
          size === "sm" ? "min-h-11 px-3 py-2" : "h-[2.875rem] px-[var(--space-4)] py-[var(--space-3)]",
          !error && "[border-color:var(--border-strong)] bg-[var(--surface-elevated)]",
          error &&
            "[border-color:var(--destructive)] [background:color-mix(in_oklch,var(--destructive)_5%,var(--surface-elevated))]",
          disabled && "pointer-events-none [border-color:var(--border)] [color:var(--text-muted)]",
          !value && "[color:var(--text-muted)]",
        )}
      >
        <span
          className={cn(
            "truncate text-left",
            // Note: Tailwind shorthand for size+text-token resolves as color, not font-size.
            // Use the explicit `[font-size:...]` arbitrary form so the token applies as size.
            size === "sm"
              ? "[font-size:var(--text-caption)] [line-height:var(--text-caption--line-height)]"
              : "[font-size:var(--text-body)] [line-height:var(--text-body--line-height)]",
          )}
        >
          {value ? formatDate(value, locale) : placeholder}
        </span>
        <CalendarDays size={size === "sm" ? 14 : 16} className="shrink-0 [color:var(--text-muted)]" aria-hidden />
      </button>

      {isOpen && (
        <div
          ref={popupRef}
          role="dialog"
          aria-label={placeholder}
          className={cn(
            "absolute top-full left-0 z-20 mt-1 flex flex-col gap-2 rounded-[var(--radius-lg)] p-3 shadow-lg",
            "[background:var(--surface-elevated)] [border:1px_solid_var(--border)]",
          )}
        >
          {presets && presets.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-2 [border-bottom:1px_solid_var(--border)]">
              {presets.map((preset) => (
                <Pill
                  key={preset.value}
                  onClick={() => {
                    onPresetSelect?.(preset.value);
                    setIsOpen(false);
                  }}
                >
                  {preset.label}
                </Pill>
              ))}
            </div>
          )}
          <DayPicker
            mode="single"
            selected={value ?? undefined}
            disabled={dayDisabled}
            onSelect={(day) => {
              onChange(day ?? null);
              setIsOpen(false);
            }}
            components={{ Chevron: CalendarChevron }}
            classNames={{
              root: "text-sm",
              // `months` is the positioning context for the absolutely placed nav chevrons.
              months: "relative",
              // Caption sits behind the chevrons (which flank it) with horizontal padding to clear them.
              month_caption:
                "flex items-center justify-center px-9 py-1 mb-2 [color:var(--text-primary)] font-semibold",
              caption_label: "[color:var(--text-primary)]",
              // Nav overlays the caption row — chevrons appear left and right of the month label.
              nav: "pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-1 py-1",
              button_previous:
                "pointer-events-auto inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[var(--radius-md)] [border:1px_solid_var(--border)] [background:var(--surface-elevated)] [color:var(--text-primary)] hover:[background:color-mix(in_oklch,var(--accent)_12%,transparent)] hover:[color:var(--accent)] hover:[border-color:color-mix(in_oklch,var(--accent)_28%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:pointer-events-none transition-colors",
              button_next:
                "pointer-events-auto inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[var(--radius-md)] [border:1px_solid_var(--border)] [background:var(--surface-elevated)] [color:var(--text-primary)] hover:[background:color-mix(in_oklch,var(--accent)_12%,transparent)] hover:[color:var(--accent)] hover:[border-color:color-mix(in_oklch,var(--accent)_28%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:pointer-events-none transition-colors",
              weeks: "space-y-1",
              weekdays: "flex",
              weekday: "w-9 text-center text-xs font-medium [color:var(--text-muted)]",
              week: "flex",
              day: "w-9 h-9 p-0 flex items-center justify-center",
              day_button:
                "w-full h-full cursor-pointer rounded-full text-center text-sm transition-colors hover:[background:color-mix(in_oklch,var(--accent)_12%,transparent)] hover:[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected:
                "[&>button]:rounded-full [&>button]:[background:var(--accent)] [&>button]:[color:var(--text-on-accent)] [&>button]:hover:[background:var(--accent)] [&>button]:hover:[color:var(--text-on-accent)]",
              today: "[&>button]:font-semibold [&>button]:[color:var(--accent)]",
              outside: "opacity-40",
              disabled: "opacity-30 pointer-events-none",
            }}
          />
        </div>
      )}
    </div>
  );
}

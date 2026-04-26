"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X } from "lucide-react";
import { DayPicker, type ChevronProps, type DateRange } from "react-day-picker";
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

type DateRangePickerInputProps = {
  id: string;
  from: Date | null;
  to: Date | null;
  onChange: (from: Date | null, to: Date | null) => void;
  placeholder: string;
  clearLabel: string;
  disabled?: boolean;
  error?: boolean;
  locale?: string;
};

function formatDate(date: Date, locale: string, withYear: boolean): string {
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

function formatRange(from: Date | null, to: Date | null, locale: string): string | null {
  if (!from && !to) return null;
  if (from && to) {
    const sameYear = from.getFullYear() === to.getFullYear();
    return `${formatDate(from, locale, !sameYear)} – ${formatDate(to, locale, true)}`;
  }
  const anchor = (from ?? to)!;
  return `${formatDate(anchor, locale, true)} – …`;
}

export default function DateRangePickerInput({
  id,
  from,
  to,
  onChange,
  placeholder,
  clearLabel,
  disabled = false,
  error = false,
  locale = "en",
}: DateRangePickerInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"from" | "to">("from");
  const containerRef = useRef<HTMLDivElement>(null);

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

  const openPicker = () => {
    setStep("from");
    setIsOpen(true);
  };

  const togglePicker = () => {
    if (isOpen) setIsOpen(false);
    else openPicker();
  };

  const handleSelect = (_range: DateRange | undefined, triggerDate: Date | undefined) => {
    if (!triggerDate) return;

    if (step === "from") {
      // First click: always treat as the range start; clear any stale `to`.
      onChange(triggerDate, null);
      setStep("to");
      return;
    }

    // Second click: close the range. Swap endpoints if the user clicks before `from`.
    const anchor = from ?? triggerDate;
    const [rangeFrom, rangeTo] =
      triggerDate.getTime() < anchor.getTime() ? [triggerDate, anchor] : [anchor, triggerDate];
    onChange(rangeFrom, rangeTo);
    setStep("from");
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null, null);
    setIsOpen(false);
  };

  // While the user is picking the second endpoint, hide the transient 1-day range
  // that react-day-picker paints right after the first click, so the calendar
  // doesn't look "finished" before they actually click the closing date.
  const selectedRange: DateRange | undefined =
    step === "to" && from ? { from } : from || to ? { from: from ?? undefined, to: to ?? undefined } : undefined;

  const displayValue = formatRange(from, to, locale);
  const hasValue = !!displayValue;

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          "border-input bg-background focus-within:ring-ring flex h-10 w-full items-center rounded-md border text-sm transition-colors focus-within:ring-2 focus-within:ring-offset-2 focus-within:outline-none",
          error && "border-destructive focus-within:ring-destructive",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={togglePicker}
          className={cn(
            "focus-visible:ring-ring flex min-w-0 flex-1 items-center rounded-md px-3 py-2 text-left focus-visible:outline-none",
            !hasValue && "text-muted-foreground",
          )}
        >
          <span className="min-w-0 flex-1 truncate">{hasValue ? displayValue : placeholder}</span>
        </button>
        <div className="flex shrink-0 items-center gap-1 pr-2">
          {hasValue && !disabled && (
            <button
              type="button"
              aria-label={clearLabel}
              onClick={handleClear}
              className="text-text-muted hover:text-foreground focus-visible:ring-ring rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
            >
              <X size={14} aria-hidden />
            </button>
          )}
          <CalendarDays size={16} className="text-text-muted" aria-hidden />
        </div>
      </div>

      {isOpen && (
        <div
          role="dialog"
          aria-label={placeholder}
          className="border-border bg-background absolute top-full left-0 z-20 mt-1 rounded-xl border p-3 shadow-lg"
        >
          <DayPicker
            mode="range"
            selected={selectedRange}
            onSelect={handleSelect}
            defaultMonth={from ?? to ?? new Date()}
            components={{ Chevron: CalendarChevron }}
            classNames={{
              root: "text-sm",
              month_caption: "flex items-center justify-center px-1 py-1 mb-2",
              caption_label: "font-semibold text-text-title",
              nav: "flex items-center justify-between gap-1 mb-1",
              button_previous:
                "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-border bg-surface text-foreground shadow-sm hover:bg-primary hover:text-primary-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:pointer-events-none transition-colors",
              button_next:
                "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-border bg-surface text-foreground shadow-sm hover:bg-primary hover:text-primary-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:pointer-events-none transition-colors",
              weeks: "space-y-1",
              weekdays: "flex",
              weekday: "text-text-muted w-8 text-center text-xs font-medium",
              week: "flex",
              day: "w-8 h-8 p-0 flex items-center justify-center",
              day_button:
                "w-full h-full cursor-pointer rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-center text-sm",
              selected: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary/90",
              // `selected` also applies to in-range days; without this, `text-primary-foreground` makes
              // white text on the light `bg-primary/15` middle segment (poor contrast).
              range_middle: "[&>button]:bg-primary/15 [&>button]:!text-foreground [&>button]:rounded-none",
              today: "[&>button]:font-semibold [&>button]:text-primary",
              outside: "opacity-40",
              disabled: "opacity-30 pointer-events-none",
            }}
          />
        </div>
      )}
    </div>
  );
}

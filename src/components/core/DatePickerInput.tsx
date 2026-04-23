"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { DayPicker, type ChevronProps, type Matcher } from "react-day-picker";
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
}: DatePickerInputProps) {
  const [isOpen, setIsOpen] = useState(false);
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
          "border-input bg-background focus-visible:ring-ring flex h-10 w-full items-center justify-between rounded-md border px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          error && "border-destructive focus-visible:ring-destructive",
          disabled && "cursor-not-allowed opacity-50",
          !value && "text-muted-foreground",
        )}
      >
        <span>{value ? formatDate(value, locale) : placeholder}</span>
        <CalendarDays size={16} className="text-text-muted shrink-0" aria-hidden />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label={placeholder}
          className="border-border bg-background absolute top-full left-0 z-20 mt-1 rounded-xl border p-3 shadow-lg"
        >
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

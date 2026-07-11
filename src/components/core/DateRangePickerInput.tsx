"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X } from "lucide-react";
import { DayPicker, type ChevronProps, type DateRange } from "react-day-picker";
import Portal from "@/components/core/Portal";
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

export type DateRangePreset = { value: string; label: string };

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
  /** Quick-select pills rendered in a left column inside the popup. */
  presets?: DateRangePreset[];
  /** Called when the user picks a preset; consumer resolves it to a date range. */
  onPresetSelect?: (value: string) => void;
  /** Number of calendar months rendered side-by-side. Default 2. */
  numberOfMonths?: number;
  /**
   * `"md"` (default) → form-sized trigger (h=46px, body text 15px).
   * `"sm"` → compact filter-sized trigger (min-h=44px, caption text 13px).
   */
  size?: "md" | "sm";
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

/**
 * Desktop popup width = preset rail (150) + border (1) + calendar wrapper padding
 * (24) + two month columns (252 each via `w-9 × 7 = 36 × 7`) + months gap (24)
 * + horizontal slack so the navigation chevrons (`absolute inset-x-0`) and the
 * Saturday column don't clip on the right edge.
 *
 * 150 + 1 + 24 + 252 + 24 + 252 + 17 (slack) = 720.
 */
const POPUP_WIDTH_PX = 720;
/**
 * Mobile popup width = calendar wrapper padding (24) + single month (252) + ~20
 * slack for the floating prev/next chevrons that sit outside the month-caption
 * box. Tightened from 320 → 296 so the calendar hugs the popup with no visible
 * right-side gutter.
 */
const POPUP_WIDTH_MOBILE_PX = 296;
const POPUP_OFFSET_PX = 6;
const VIEWPORT_PADDING_PX = 12;
const MOBILE_BREAKPOINT_PX = 768;

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
  presets,
  onPresetSelect,
  numberOfMonths = 2,
  size = "md",
}: DateRangePickerInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"from" | "to">("from");
  // The first-click anchor, tracked locally so the in-progress selection survives even when the
  // consumer defers updating `from`/`to` until both endpoints are chosen (e.g. the dashboard range
  // control, which returns early on a partial range and only writes to the URL once it is complete).
  const [pendingFrom, setPendingFrom] = useState<Date | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number; width: number; isMobile: boolean } | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Position the popup relative to the trigger using `position: fixed`. Renders via Portal
  // to escape any `overflow: hidden` ancestor (e.g. the FilterDrawer scroll container).
  // Right-aligned to the trigger by default; flips left if it would overflow the viewport.
  const reposition = () => {
    const trigger = containerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isMobile = viewportWidth < MOBILE_BREAKPOINT_PX;
    // Mobile: hug the single-month width (no empty gutters). Desktop: full 660px (two months side-by-side).
    const width = isMobile ? Math.min(viewportWidth - VIEWPORT_PADDING_PX * 2, POPUP_WIDTH_MOBILE_PX) : POPUP_WIDTH_PX;
    const popupHeight = popupRef.current?.getBoundingClientRect().height ?? 420;
    // Prefer right edge of trigger as anchor → popup hangs to the left.
    let left = rect.right - width;
    if (left < VIEWPORT_PADDING_PX) left = VIEWPORT_PADDING_PX;
    if (left + width > viewportWidth - VIEWPORT_PADDING_PX) {
      left = viewportWidth - width - VIEWPORT_PADDING_PX;
    }
    if (left < VIEWPORT_PADDING_PX) left = VIEWPORT_PADDING_PX;
    // Below the trigger by default; flip above if not enough space.
    let top = rect.bottom + POPUP_OFFSET_PX;
    if (top + popupHeight > viewportHeight - VIEWPORT_PADDING_PX) {
      const flipped = rect.top - popupHeight - POPUP_OFFSET_PX;
      top =
        flipped > VIEWPORT_PADDING_PX
          ? flipped
          : Math.max(VIEWPORT_PADDING_PX, viewportHeight - popupHeight - VIEWPORT_PADDING_PX);
    }
    setPopupPos({ top, left, width, isMobile });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    reposition();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    function handleViewport() {
      reposition();
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleViewport);
    window.addEventListener("scroll", handleViewport, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleViewport);
      window.removeEventListener("scroll", handleViewport, true);
    };
  }, [isOpen]);

  const openPicker = () => {
    setStep("from");
    setPendingFrom(null);
    setIsOpen(true);
  };

  const togglePicker = () => {
    if (isOpen) setIsOpen(false);
    else openPicker();
  };

  const handleSelect = (_range: DateRange | undefined, triggerDate: Date | undefined) => {
    if (!triggerDate) return;
    if (step === "from") {
      setPendingFrom(triggerDate);
      onChange(triggerDate, null);
      setStep("to");
      return;
    }
    // Anchor on the locally-tracked first click, falling back to the committed `from` prop so the
    // range is correct even when the consumer did not echo the first click back into props.
    const anchor = pendingFrom ?? from ?? triggerDate;
    const [rangeFrom, rangeTo] =
      triggerDate.getTime() < anchor.getTime() ? [triggerDate, anchor] : [anchor, triggerDate];
    setPendingFrom(null);
    onChange(rangeFrom, rangeTo);
    setStep("from");
    setIsOpen(false);
  };

  const handleClear = () => {
    setPendingFrom(null);
    onChange(null, null);
    setIsOpen(false);
  };

  // While selecting the second endpoint, render the partial range from the locally-tracked anchor
  // (or the committed `from`) so the first click stays highlighted; middle days don't paint until
  // the closing day is picked.
  const inProgressFrom = pendingFrom ?? from;
  const selectedRange: DateRange | undefined =
    step === "to" && inProgressFrom
      ? { from: inProgressFrom }
      : from || to
        ? { from: from ?? undefined, to: to ?? undefined }
        : undefined;

  const displayValue = formatRange(from, to, locale);
  const hasValue = !!displayValue;
  const triggerHeight = size === "sm" ? "min-h-11" : "h-[2.875rem]";
  const triggerText =
    size === "sm"
      ? "[font-size:var(--text-caption)] [line-height:var(--text-caption--line-height)]"
      : "[font-size:var(--text-body)] [line-height:var(--text-body--line-height)]";
  const triggerPadding = size === "sm" ? "px-3 py-2" : "px-[var(--space-4)] py-[var(--space-3)]";

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          "flex w-full items-center rounded-[var(--radius-md)] [border-width:1px] [border-style:solid] transition-colors",
          triggerHeight,
          "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:[outline-color:var(--focus-ring)]",
          !error && "[border-color:var(--border-strong)] bg-[var(--surface-elevated)]",
          error &&
            "[border-color:var(--destructive)] [background:color-mix(in_oklch,var(--destructive)_5%,var(--surface-elevated))]",
          disabled && "pointer-events-none [border-color:var(--border)] [color:var(--text-muted)]",
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
            "flex min-w-0 flex-1 items-center rounded-[var(--radius-md)] text-left [color:var(--text-primary)]",
            "focus-visible:outline-none",
            triggerPadding,
            !hasValue && "[color:var(--text-muted)]",
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate", triggerText)}>{hasValue ? displayValue : placeholder}</span>
        </button>
        <div className="flex shrink-0 items-center gap-1 pr-3">
          {hasValue && !disabled && (
            <button
              type="button"
              aria-label={clearLabel}
              onClick={handleClear}
              className="focus-visible:ring-ring rounded p-0.5 [color:var(--text-muted)] hover:[color:var(--text-primary)] focus-visible:ring-2 focus-visible:outline-none"
            >
              <X size={size === "sm" ? 12 : 14} aria-hidden />
            </button>
          )}
          <CalendarDays size={size === "sm" ? 14 : 16} className="[color:var(--text-muted)]" aria-hidden />
        </div>
      </div>

      {isOpen && (
        <Portal>
          <div
            ref={popupRef}
            role="dialog"
            aria-label={placeholder}
            style={{
              position: "fixed",
              top: popupPos?.top ?? -9999,
              left: popupPos?.left ?? -9999,
              width: popupPos?.width ?? POPUP_WIDTH_PX,
            }}
            className={cn(
              // Z=60 sits above `--z-drawer` (50) so the popover floats over the FilterDrawer
              // it was opened from, but below `--z-modal-backdrop` (70) so a real modal can
              // still occlude it. Hardcoded because the token system has no slot for
              // "popover-over-drawer" yet.
              "z-[60] overflow-hidden rounded-[var(--radius-lg)]",
              // Distinct elevation tier so it visibly floats over the sidebar.
              "[box-shadow:var(--shadow-elevation-3)] [background:var(--background)] [border:1px_solid_var(--border-strong)]",
              // Desktop: side-by-side preset column + calendar. Mobile: stacked.
              popupPos?.isMobile ? "flex flex-col" : "flex",
            )}
          >
            {presets && presets.length > 0 && (
              <div
                className={cn(
                  // Tinted "shortcut" zone — left column on desktop, top strip on mobile.
                  popupPos?.isMobile
                    ? "flex flex-wrap gap-1.5 p-2 [border-bottom:1px_solid_var(--border)]"
                    : "flex w-[150px] shrink-0 flex-col gap-1 p-3 [border-right:1px_solid_var(--border)]",
                  "[background:color-mix(in_oklab,var(--text-primary)_4%,var(--background))]",
                )}
              >
                {presets.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => {
                      onPresetSelect?.(preset.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "rounded-[var(--radius-md)] [font-size:var(--text-caption)] [color:var(--text-primary)]",
                      "transition-colors hover:[color:var(--accent)] hover:[background:color-mix(in_oklch,var(--accent)_12%,transparent)]",
                      "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                      popupPos?.isMobile
                        ? "px-2 py-1 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]"
                        : "px-2.5 py-1.5 text-left",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-1 justify-center p-3">
              <DayPicker
                mode="range"
                numberOfMonths={popupPos?.isMobile ? 1 : numberOfMonths}
                selected={selectedRange}
                onSelect={handleSelect}
                defaultMonth={pendingFrom ?? from ?? to ?? new Date()}
                components={{ Chevron: CalendarChevron }}
                classNames={{
                  root: "text-sm",
                  months: "relative flex gap-6",
                  month: "relative",
                  month_caption:
                    "flex items-center justify-center px-9 py-1 mb-2 [color:var(--text-primary)] font-semibold",
                  caption_label: "[color:var(--text-primary)]",
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
                  range_middle:
                    "[&>button]:rounded-none [&>button]:[background:color-mix(in_oklch,var(--accent)_14%,transparent)] [&>button]:[color:var(--text-primary)] [&>button]:hover:[color:var(--text-primary)]",
                  range_start:
                    "[&>button]:rounded-l-full [&>button]:rounded-r-none [&>button]:[background:var(--accent)] [&>button]:[color:var(--text-on-accent)]",
                  range_end:
                    "[&>button]:rounded-r-full [&>button]:rounded-l-none [&>button]:[background:var(--accent)] [&>button]:[color:var(--text-on-accent)]",
                  today: "[&>button]:font-semibold [&>button]:[color:var(--accent)]",
                  outside: "opacity-40",
                  disabled: "opacity-30 pointer-events-none",
                }}
              />
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

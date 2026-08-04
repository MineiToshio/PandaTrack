"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { DayPicker, type ChevronProps, type Matcher } from "react-day-picker";
import Pill from "@/components/core/Pill";
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

/** Gap between the trigger and the popup. */
const POPUP_OFFSET_PX = 4;
/** Minimum breathing room kept between the popup and every viewport edge. */
const VIEWPORT_PADDING_PX = 12;

type PopupPosition = { top: number; left: number; maxWidth: number };

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
  const [popupPos, setPopupPos] = useState<PopupPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  /**
   * Positions the popup against the trigger with `position: fixed`. The popup renders through a
   * `<Portal>`, so it escapes ancestor clipping (the modal panel is `overflow-hidden` and its body
   * is `overflow-y-auto`, which used to slice the calendar in half); the price of leaving the
   * container is that the offset has to be computed by hand from the trigger's viewport rect.
   *
   * `popupAlign` stays an explicit override: `start` and `end` pick the anchor edge outright and
   * only `auto` measures for a flip. Every branch is then clamped into the viewport, which is a
   * safety net against overflow, not an alignment decision.
   */
  const reposition = () => {
    const trigger = containerRef.current;
    const popup = popupRef.current;
    if (!trigger || !popup) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxWidth = viewportWidth - VIEWPORT_PADDING_PX * 2;
    // The popup is content-sized (no fixed width), so measure what it actually renders as.
    const { width, height } = popup.getBoundingClientRect();

    let left: number;
    if (popupAlign === "end") {
      left = rect.right - width;
    } else if (popupAlign === "start") {
      left = rect.left;
    } else {
      left = rect.left;
      if (left + width > viewportWidth - VIEWPORT_PADDING_PX) left = rect.right - width;
    }
    left = Math.min(left, viewportWidth - width - VIEWPORT_PADDING_PX);
    left = Math.max(left, VIEWPORT_PADDING_PX);

    // Below the trigger by default; flip above when the calendar would run past the bottom edge.
    let top = rect.bottom + POPUP_OFFSET_PX;
    if (top + height > viewportHeight - VIEWPORT_PADDING_PX) {
      top = rect.top - height - POPUP_OFFSET_PX;
    }
    // Clamp last, mirroring the horizontal axis: a trigger scrolled out of view can make even the
    // flipped position overflow, and the calendar must stay reachable whatever the anchor does.
    top = Math.min(top, viewportHeight - height - VIEWPORT_PADDING_PX);
    top = Math.max(top, VIEWPORT_PADDING_PX);

    setPopupPos({ top, left, maxWidth });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    reposition();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `reposition` reads refs + props on call.
  }, [isOpen, popupAlign]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      // The popup lives outside `containerRef` now that it is portaled, so it needs its own
      // check or selecting a day would register as an outside click and close the calendar.
      if (containerRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    function handleViewportChange() {
      reposition();
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("resize", handleViewportChange);
    // Capture phase so scrolling any ancestor (the modal body, a drawer) keeps the popup pinned
    // to its trigger instead of leaving it stranded mid-viewport.
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `reposition` reads refs + props on call.
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
        <Portal>
          <div
            ref={popupRef}
            role="dialog"
            aria-label={placeholder}
            style={{
              position: "fixed",
              // Park it offscreen for the very first layout pass: the popup has to exist and be
              // laid out before it can be measured, and `useLayoutEffect` corrects this before paint.
              top: popupPos?.top ?? -9999,
              left: popupPos?.left ?? -9999,
              maxWidth: popupPos?.maxWidth,
            }}
            className={cn(
              // Above `--z-modal` (80) because this picker is opened from inside modals, and below
              // `--z-toast` (90) so feedback still surfaces over it. The sibling range picker sits
              // at 60 instead: it is opened from drawers, where a modal should occlude it.
              "z-[85] flex flex-col gap-2 rounded-[var(--radius-lg)] p-3",
              // Vaul (the mobile `<ModalSheet>`) parks `pointer-events: none` on `document.body`
              // and re-enables it only inside its own content. Portaling lands this popup as a body
              // sibling, so without this it renders perfectly and ignores every click.
              "pointer-events-auto",
              // Match DateRangePickerInput popup chrome — surface tier + border-strong + elevated
              // shadow so single-date and range-date popovers feel like the same component family.
              "[background:var(--background)] [border:1px_solid_var(--border-strong)]",
              "[box-shadow:var(--shadow-elevation-3)]",
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
        </Portal>
      )}
    </div>
  );
}

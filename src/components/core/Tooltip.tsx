"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Portal from "@/components/core/Portal";
import { cn } from "@/lib/styles";

const TOOLTIP_VIEWPORT_GAP_PX = 16;
const TOOLTIP_TRIGGER_GAP_PX = 8;
/** Wide enough for paragraph-style help; fixed positioning escapes the narrow pill wrapper. */
const TOOLTIP_PANEL_CLASSNAME = cn(
  "border-border/60 bg-popover text-text-body pointer-events-none rounded-lg border px-3 py-2.5 text-xs leading-relaxed shadow-lg",
  "fixed z-[80] w-max min-w-[14rem] max-w-[min(26rem,calc(100vw-2rem))]",
  "motion-safe:transition-opacity motion-safe:duration-150",
);

const TRIGGER_FOCUS_RING_CLASSNAME =
  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

export type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  /** Classes for the focusable trigger (for example chip or pill styles). */
  triggerClassName?: string;
  /**
   * Use on surfaces where a full-area link or overlay sits above siblings (for example store listing cards).
   * Restores pointer events and raises stacking order so the trigger can receive hover and focus.
   */
  liftAboveCardOverlay?: boolean;
  side?: "top" | "bottom";
  /**
   * Cross-axis alignment when this root sits in a parent `flex` row. Default `start` (maps to
   * `self-start`) matches chips and dense toolbars; `center` lines the trigger up with an adjacent
   * label in the same row.
   */
  alignSelfInFlexRow?: "start" | "center";
};

type TooltipCoords = { left: number; top: number };

function clampHorizontalCenter(left: number, viewportWidth: number, estimatedHalfWidth: number) {
  const margin = TOOLTIP_VIEWPORT_GAP_PX;
  return Math.min(Math.max(left, margin + estimatedHalfWidth), viewportWidth - margin - estimatedHalfWidth);
}

/**
 * Lightweight accessible tooltip: hover or keyboard focus on the trigger shows explanatory content.
 * Wrapper uses `w-fit self-start` so it does not stretch to the full width of column flex parents.
 * The panel is portaled with fixed positioning so its width is not limited by the trigger width.
 */
export default function Tooltip({
  content,
  children,
  triggerClassName,
  liftAboveCardOverlay = false,
  side = "top",
  alignSelfInFlexRow = "start",
}: TooltipProps) {
  const tooltipId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<TooltipCoords | null>(null);

  const updatePosition = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const maxTooltipHalfWidthPx = 208;
    const estimatedHalfWidth = Math.min(maxTooltipHalfWidthPx, vw / 2 - TOOLTIP_VIEWPORT_GAP_PX);
    const left = clampHorizontalCenter(rect.left + rect.width / 2, vw, estimatedHalfWidth);
    const top = side === "top" ? rect.top : rect.bottom;
    setCoords({ left, top });
  }, [side]);

  const close = useCallback(() => {
    setOpen(false);
    setCoords(null);
  }, []);

  const handleTriggerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Escape") {
        close();
      }
    },
    [close],
  );

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [close, open, updatePosition]);

  const transform =
    side === "top"
      ? `translate(-50%, calc(-100% - ${TOOLTIP_TRIGGER_GAP_PX}px))`
      : `translate(-50%, ${TOOLTIP_TRIGGER_GAP_PX}px)`;

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative inline-flex w-fit max-w-full shrink-0 flex-col items-center",
        alignSelfInFlexRow === "center" ? "self-center" : "self-start",
        liftAboveCardOverlay && "pointer-events-auto z-20",
      )}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={close}
    >
      <button
        type="button"
        className={cn(
          TRIGGER_FOCUS_RING_CLASSNAME,
          "gap-inherit font-inherit inline-flex cursor-help items-center",
          triggerClassName,
        )}
        aria-describedby={open ? tooltipId : undefined}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onKeyDown={handleTriggerKeyDown}
      >
        {children}
      </button>
      {open && coords ? (
        <Portal>
          <span
            id={tooltipId}
            role="tooltip"
            className={TOOLTIP_PANEL_CLASSNAME}
            style={{
              left: coords.left,
              top: coords.top,
              transform,
            }}
          >
            {content}
          </span>
        </Portal>
      ) : null}
    </div>
  );
}

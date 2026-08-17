import type { CSSProperties } from "react";
import { cn } from "@/lib/styles";

export type ProgressBarTone = "accent" | "warning";
export type ProgressBarSize = "xs" | "sm";

export type ProgressBarProps = {
  /** 0..100. Clamped by the component, so callers may pass a raw ratio without guarding it. */
  value: number;
  /** Accessible NAME of the measurement, e.g. "Payment progress in PEN". */
  label: string;
  /**
   * The full sentence a screen reader announces INSTEAD of the bare percentage. Required, not
   * optional: "88%" hides the denominator from screen-reader users exactly the way a lone
   * percentage hides it from sighted ones, and the denominator is the whole point of these bars.
   */
  valueText: string;
  /** Track thickness: `xs` = 3px (dense list rows), `sm` = 4px (cards and heroes). Default `sm`. */
  size?: ProgressBarSize;
  /** `warning` is the overdue / unpaid family. Default `accent`. */
  tone?: ProgressBarTone;
  /**
   * Whether the fill eases to a new value on its own. Pass `false` when the caller already drives
   * `value` frame by frame (see `useAnimatedNumber`): a CSS transition layered on top of a
   * per-frame JS interpolation lags behind the counter it is supposed to track.
   */
  transition?: boolean;
  /**
   * The percentage to ANNOUNCE, when it differs from the one being drawn. A caller that animates
   * `value` frame by frame passes the settled figure here so assistive tech reports the destination
   * rather than whichever frame it happened to read.
   */
  valueNow?: number;
  /** Width comes from the caller; this component never sets its own width. */
  className?: string;
};

const TRACK_HEIGHT: Record<ProgressBarSize, string> = {
  xs: "h-[3px]",
  sm: "h-1",
};

/**
 * The single track + fill progress meter of the app: order detail hero, delivery detail hero, the
 * orders store-view product rows and the store detail payment progress block all render this.
 *
 * Two contracts are deliberate and must not be "simplified":
 *
 *  - **The fill is a gradient, not a flat token.** `--accent` → `--accent-warm` (and
 *    `--warning` → `--accent-warm` for the warning tone) is what the heroes have always drawn.
 *  - **The fill moves with `transform: scaleX`, never `width`.** The track clips the rounded ends,
 *    so the fill itself stays square-edged: scaling a `rounded-full` fill distorts its corners.
 *
 * `role="progressbar"` rather than `<meter>`: `<meter>` can only be themed through per-engine
 * pseudo-elements, which breaks the light/dark token contract, and the real accessibility problem
 * here was never the role but the announcement, which `valueText` fixes.
 */
export default function ProgressBar({
  value,
  label,
  valueText,
  size = "sm",
  tone = "accent",
  transition = true,
  valueNow,
  className,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

  const fillStyle: CSSProperties = {
    transform: `scaleX(${clamped / 100})`,
    transformOrigin: "left",
    background:
      tone === "warning"
        ? "linear-gradient(90deg, var(--warning), var(--accent-warm))"
        : "linear-gradient(90deg, var(--accent), var(--accent-warm))",
  };

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(valueNow ?? clamped)}
      aria-label={label}
      aria-valuetext={valueText}
      className={cn(
        "overflow-hidden rounded-full [background:color-mix(in_oklch,var(--text-primary)_10%,transparent)]",
        TRACK_HEIGHT[size],
        className,
      )}
    >
      <span
        className={cn(
          "block h-full w-full",
          transition && "transition-transform duration-[var(--motion-base)] motion-reduce:transition-none",
        )}
        style={fillStyle}
      />
    </div>
  );
}

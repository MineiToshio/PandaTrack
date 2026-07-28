import { cn } from "@/lib/styles";

export type DashboardDonutSlice = {
  key: string;
  /** CSS color token, e.g. `var(--accent)`. */
  color: string;
  /** Share of the ring, 0-100. Slices are laid out in order. */
  percent: number;
};

export type DashboardDonutProps = {
  slices: DashboardDonutSlice[];
  /** Headline rendered in the middle of the ring. May be abbreviated (e.g. `S/ 234.3K`). */
  centerValue: string;
  /** Full, unabbreviated headline surfaced on hover when `centerValue` is compacted. */
  centerTitle?: string;
  centerLabel: string;
  /** Sentence describing the whole split, for screen readers. */
  ariaLabel: string;
  className?: string;
};

/**
 * The circumference is normalized to 100 (`r = 100 / 2π`), so a slice's `stroke-dasharray`
 * reads directly as its percentage and offsets are simple running totals.
 */
const RADIUS = 15.915;
const CENTER = 21;
const STROKE_WIDTH = 5;

/** Thin multi-slice donut shared by the punctuality and spend-by-category surfaces. */
export default function DashboardDonut({
  slices,
  centerValue,
  centerTitle,
  centerLabel,
  ariaLabel,
  className,
}: DashboardDonutProps) {
  // Each slice starts where the previous one ended, so offsets are the running total before it.
  const offsets: number[] = [];
  slices.reduce((consumed, slice) => {
    offsets.push(consumed);
    return consumed + slice.percent;
  }, 0);

  return (
    <div className={cn("relative flex aspect-square items-center justify-center", className)}>
      <svg viewBox="0 0 42 42" role="img" aria-label={ariaLabel} className="h-full w-full -rotate-90">
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          stroke="color-mix(in oklab, var(--text-primary) 8%, transparent)"
        />
        {slices.map((slice, index) => {
          const offset = -offsets[index];
          return (
            <circle
              key={slice.key}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE_WIDTH}
              stroke={slice.color}
              strokeDasharray={`${slice.percent} ${100 - slice.percent}`}
              strokeDashoffset={offset}
            />
          );
        })}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span
          title={centerTitle}
          className="[font-size:19px] [font-weight:var(--font-weight-bold)] [letter-spacing:-0.02em] [color:var(--text-primary)] tabular-nums"
        >
          {centerValue}
        </span>
        <span className="[font-size:10.5px] [letter-spacing:0.05em] [color:var(--text-muted)] uppercase">
          {centerLabel}
        </span>
      </div>
    </div>
  );
}

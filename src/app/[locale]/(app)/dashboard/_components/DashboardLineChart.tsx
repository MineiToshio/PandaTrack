"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

export type DashboardChartSeries = {
  key: string;
  /** Series name shown in the hover tooltip. */
  name: string;
  /** CSS color token, e.g. `var(--accent)`. */
  color: string;
  values: number[];
  /** Pre-formatted values parallel to `values`. Formatting happens server-side. */
  formatted: string[];
};

/** One x-axis position: its short month label plus the calendar year it belongs to. */
export type DashboardChartPoint = {
  /** Short month name, already localized server-side. */
  label: string;
  year: number;
};

export type DashboardLineChartProps = {
  series: DashboardChartSeries[];
  points: DashboardChartPoint[];
  /** Sentence describing the chart for screen readers. */
  ariaLabel: string;
  /** Fills the area under a single series. */
  showArea?: boolean;
  /** Prints the final value next to the last point. */
  showLastValueLabel?: boolean;
};

const HEIGHT = 220;
const PAD_LEFT = 16;
const PAD_RIGHT = 18;
const PAD_TOP = 18;
const PAD_BOTTOM = 30;
const GRID_ROWS = 4;

/**
 * 12px is the floor the design-system consensus lands on for chart text: IBM Carbon's type scale
 * has no token below it, Atlassian treats 12px as fine-print-only, the Urban Institute style guide
 * specifies 12px for axis labels, and Chart.js defaults there. Datawrapper's rule for chart text is
 * "> 12px", with the explicit instruction that when labels do not fit you enlarge the chart rather
 * than shrink the type — which is what the two-column grid does.
 */
const AXIS_FONT_SIZE = 12;

/**
 * Width assumed before the container has been measured. Only ever visible for the one frame
 * between mount and the layout effect below, and only when `ResizeObserver` is unavailable.
 */
const FALLBACK_WIDTH = 480;

/**
 * Density thresholds, in real screen pixels — meaningful precisely because the chart renders 1:1
 * (see the `viewBox` note below). Point markers are 8px across, so they overlap once the spacing
 * between points drops under `MIN_MARKER_SPACING`; past that the marker layer stops being data and
 * becomes a smear, so it is dropped and the line carries the shape on its own. Axis labels get a
 * wider allowance because a localized short month can run to about four characters ("sept").
 */
const MIN_MARKER_SPACING = 14;
const MIN_LABEL_SPACING = 36;

/** `useLayoutEffect` warns during SSR; this component server-renders before it ever measures. */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Rounds the axis ceiling up to a readable number so gridlines land on sensible values. */
function niceMax(max: number): number {
  if (max <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 1.5, 2, 2.5, 5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= max) {
      return candidate;
    }
  }
  return 10 * magnitude;
}

/**
 * Picks which x positions get a label: evenly spaced at the density the width allows, always
 * including the last point so the series' most recent month is never anonymous.
 */
export function resolveLabelIndices(pointCount: number, plotWidth: number): number[] {
  if (pointCount <= 0) {
    return [];
  }
  const capacity = Math.max(1, Math.floor(plotWidth / MIN_LABEL_SPACING));
  const step = Math.max(1, Math.ceil(pointCount / capacity));
  const indices: number[] = [];
  for (let index = 0; index < pointCount; index += step) {
    indices.push(index);
  }

  const last = pointCount - 1;
  if (indices[indices.length - 1] === last) {
    return indices;
  }

  // The final month always gets a label, but appending it blindly can drop it right next to the
  // previous tick, since the regular stride rarely divides the series evenly. Measure the real gap
  // in pixels: too close, and the final label replaces its neighbour instead of colliding with it.
  const pixelsPerPoint = pointCount > 1 ? plotWidth / (pointCount - 1) : plotWidth;
  const gapToPrevious = (last - indices[indices.length - 1]) * pixelsPerPoint;
  if (gapToPrevious < MIN_LABEL_SPACING) {
    indices[indices.length - 1] = last;
  } else {
    indices.push(last);
  }
  return indices;
}

/** One rendered x-axis tick: which point it sits on, and whether it also prints the year. */
export type AxisTick = { index: number; showsYear: boolean };

/**
 * Resolves the axis ticks, marking the ones that also print their year.
 *
 * The year is printed at the first tick and wherever the year changes, so a multi-year range never
 * shows the same month name twice with nothing to distinguish the two. Computed up front rather
 * than accumulated while rendering, so the render stays a pure function of its inputs.
 */
export function resolveAxisTicks(points: Array<{ year: number }>, plotWidth: number): AxisTick[] {
  const indices = resolveLabelIndices(points.length, plotWidth);
  const spansMultipleYears = points.length > 0 && points[0].year !== points[points.length - 1].year;
  if (!spansMultipleYears) {
    return indices.map((index) => ({ index, showsYear: false }));
  }
  let previousYear: number | null = null;
  return indices.map((index) => {
    const showsYear = points[index].year !== previousYear;
    previousYear = points[index].year;
    return { index, showsYear };
  });
}

/** Markers stop being informative once they touch; `null`-safe for the single-point case. */
export function shouldShowMarkers(pointCount: number, plotWidth: number): boolean {
  if (pointCount <= 1) {
    return true;
  }
  return plotWidth / (pointCount - 1) >= MIN_MARKER_SPACING;
}

/**
 * Measures the element and keeps the value current across container resizes (sidebar collapse,
 * window resize, breakpoint changes). Measured rather than assumed because the chart's whole
 * correctness rests on knowing its real pixel width.
 */
function useMeasuredWidth<T extends HTMLElement>(): [RefObject<T | null>, number | null] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    // A zero width means "not laid out" (display:none, an unattached tree, jsdom), not "0px wide".
    // Treating it as a real measurement would collapse the plot to a single column of pixels, so
    // it is discarded and the fallback stays in force until a real width arrives.
    const apply = () => {
      const measured = element.getBoundingClientRect().width;
      setWidth(measured > 0 ? measured : null);
    };
    apply();

    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(apply);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

/**
 * Hand-rolled SVG line chart for the dashboard trend section (no charting dependency).
 *
 * The `viewBox` tracks the container's **measured pixel width**, so one user unit is one CSS pixel
 * and `font-size={11}` renders as 11px at every layout. The earlier fixed `600x220` viewBox scaled
 * with the container instead, which shrank the type along with the drawing: axis labels rendered at
 * 5.5px in the three-column grid and 5.0px on a phone, well under anything legible. Keep the
 * measured-width contract if this component is ever reworked; it is what makes the px constants
 * above mean what they say.
 */
export default function DashboardLineChart({
  series,
  points,
  ariaLabel,
  showArea = false,
  showLastValueLabel = false,
}: DashboardLineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [containerRef, measuredWidth] = useMeasuredWidth<HTMLDivElement>();

  const pointCount = points.length;
  const width = measuredWidth ?? FALLBACK_WIDTH;
  const plotWidth = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const maxValue = niceMax(Math.max(...series.flatMap((entry) => entry.values), 0));
  const xAt = (index: number): number =>
    pointCount <= 1 ? PAD_LEFT + plotWidth / 2 : PAD_LEFT + (index * plotWidth) / (pointCount - 1);
  const yAt = (value: number): number => PAD_TOP + (1 - value / maxValue) * plotHeight;

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width === 0) {
      return;
    }
    const localX = event.clientX - bounds.left;
    let nearest = 0;
    for (let index = 1; index < pointCount; index += 1) {
      if (Math.abs(xAt(index) - localX) < Math.abs(xAt(nearest) - localX)) {
        nearest = index;
      }
    }
    setHoverIndex(nearest);
  };

  const handlePointerLeave = () => setHoverIndex(null);

  if (pointCount === 0 || series.length === 0) {
    return null;
  }

  const showsArea = showArea && series.length === 1;
  const showsMarkers = shouldShowMarkers(pointCount, plotWidth);
  const axisTicks = resolveAxisTicks(points, plotWidth);
  const spansMultipleYears = points[0].year !== points[pointCount - 1].year;

  // Keep the tooltip inside the plot instead of letting it hang off either edge.
  const tooltipLeftPercent = hoverIndex === null ? 0 : Math.min(85, Math.max(15, (xAt(hoverIndex) / width) * 100));
  const hoveredIndex = hoverIndex;
  const hoveredPoint = hoveredIndex === null ? null : points[hoveredIndex];

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={ariaLabel}
        className="block h-[220px] w-full touch-none"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {Array.from({ length: GRID_ROWS + 1 }, (_, row) => {
          const y = PAD_TOP + (row * plotHeight) / GRID_ROWS;
          return (
            <line
              key={row}
              x1={PAD_LEFT}
              x2={width - PAD_RIGHT}
              y1={y}
              y2={y}
              stroke="color-mix(in oklab, var(--text-primary) 8%, transparent)"
              strokeWidth={1}
            />
          );
        })}

        {showsArea && (
          <polygon
            points={[
              `${xAt(0)},${PAD_TOP + plotHeight}`,
              ...series[0].values.map((value, index) => `${xAt(index)},${yAt(value)}`),
              `${xAt(pointCount - 1)},${PAD_TOP + plotHeight}`,
            ].join(" ")}
            fill={series[0].color}
            opacity={0.1}
          />
        )}

        {series.map((entry) => (
          <polyline
            key={entry.key}
            points={entry.values.map((value, index) => `${xAt(index)},${yAt(value)}`).join(" ")}
            fill="none"
            stroke={entry.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {hoverIndex !== null && (
          <line
            x1={xAt(hoverIndex)}
            x2={xAt(hoverIndex)}
            y1={PAD_TOP}
            y2={PAD_TOP + plotHeight}
            stroke="var(--border-strong)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {series.map((entry) =>
          entry.values.map((value, index) =>
            // Below the density threshold only the hovered point keeps a marker, so the crosshair
            // still has something to land on without the other 50-odd points smearing the line.
            showsMarkers || hoverIndex === index ? (
              <circle
                key={`${entry.key}-${index}`}
                cx={xAt(index)}
                cy={yAt(value)}
                r={hoverIndex === index ? 5 : 4}
                fill="var(--surface)"
                stroke={entry.color}
                strokeWidth={2}
              />
            ) : null,
          ),
        )}

        {axisTicks.map(({ index, showsYear }) => {
          const point = points[index];
          return (
            <text
              key={`axis-${index}`}
              x={xAt(index)}
              y={HEIGHT - (showsYear ? 16 : 10)}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize={AXIS_FONT_SIZE}
            >
              {point.label}
              {showsYear && (
                <tspan x={xAt(index)} dy={12} fill="var(--text-muted)">
                  {point.year}
                </tspan>
              )}
            </text>
          );
        })}

        {showLastValueLabel && (
          <text
            x={xAt(pointCount - 1)}
            y={Math.max(PAD_TOP - 4, yAt(series[0].values[pointCount - 1]) - 10)}
            textAnchor="end"
            fill="var(--text-primary)"
            fontSize={11.5}
            fontWeight={600}
            // The label sits wherever the last point lands, which on a dense series means on top of
            // the line itself. Painting the stroke first lays a card-coloured halo behind the
            // glyphs, so the value stays readable without a box that would clutter the plot.
            stroke="var(--surface-elevated)"
            strokeWidth={3}
            paintOrder="stroke"
          >
            {series[0].formatted[pointCount - 1]}
          </text>
        )}
      </svg>

      {hoveredPoint !== null && hoveredIndex !== null && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-[10px] px-2.5 py-2 [font-size:12px] [box-shadow:var(--shadow-2)] [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]"
          style={{ left: `${tooltipLeftPercent}%` }}
        >
          <p className="mb-1 [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
            {spansMultipleYears ? `${hoveredPoint.label} ${hoveredPoint.year}` : hoveredPoint.label}
          </p>
          {series.map((entry) => (
            <p key={entry.key} className="flex items-center gap-1.5 whitespace-nowrap [color:var(--text-secondary)]">
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: entry.color }} />
              {series.length > 1 && <span>{entry.name}</span>}
              <span className="[color:var(--text-primary)] tabular-nums">{entry.formatted[hoveredIndex]}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

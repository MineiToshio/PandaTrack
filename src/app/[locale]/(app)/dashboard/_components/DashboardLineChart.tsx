"use client";

import { useState, type PointerEvent } from "react";

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

export type DashboardLineChartProps = {
  series: DashboardChartSeries[];
  /** Short month labels, one per data point. */
  labels: string[];
  /** Sentence describing the chart for screen readers. */
  ariaLabel: string;
  /** Fills the area under a single series. */
  showArea?: boolean;
  /** Prints the final value next to the last point. */
  showLastValueLabel?: boolean;
};

const VIEW_WIDTH = 600;
const VIEW_HEIGHT = 220;
const PAD_LEFT = 16;
const PAD_RIGHT = 18;
const PAD_TOP = 18;
const PAD_BOTTOM = 30;
const GRID_ROWS = 4;
/** Beyond this many points the x-axis thins its labels so they stop colliding. */
const MAX_AXIS_LABELS = 12;

const PLOT_WIDTH = VIEW_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = VIEW_HEIGHT - PAD_TOP - PAD_BOTTOM;

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

/** Hand-rolled SVG line chart for the dashboard trend section (no charting dependency). */
export default function DashboardLineChart({
  series,
  labels,
  ariaLabel,
  showArea = false,
  showLastValueLabel = false,
}: DashboardLineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const pointCount = labels.length;
  if (pointCount === 0 || series.length === 0) {
    return null;
  }

  const maxValue = niceMax(Math.max(...series.flatMap((entry) => entry.values), 0));
  const xAt = (index: number): number =>
    pointCount === 1 ? PAD_LEFT + PLOT_WIDTH / 2 : PAD_LEFT + (index * PLOT_WIDTH) / (pointCount - 1);
  const yAt = (value: number): number => PAD_TOP + (1 - value / maxValue) * PLOT_HEIGHT;

  const labelStep = Math.ceil(pointCount / MAX_AXIS_LABELS);
  const showsArea = showArea && series.length === 1;

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width === 0) {
      return;
    }
    const viewBoxX = ((event.clientX - bounds.left) / bounds.width) * VIEW_WIDTH;
    let nearest = 0;
    for (let index = 1; index < pointCount; index += 1) {
      if (Math.abs(xAt(index) - viewBoxX) < Math.abs(xAt(nearest) - viewBoxX)) {
        nearest = index;
      }
    }
    setHoverIndex(nearest);
  };

  const handlePointerLeave = () => setHoverIndex(null);

  // Keep the tooltip inside the plot instead of letting it hang off either edge.
  const tooltipLeftPercent = hoverIndex === null ? 0 : Math.min(85, Math.max(15, (xAt(hoverIndex) / VIEW_WIDTH) * 100));

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label={ariaLabel}
        className="h-auto w-full touch-none"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {Array.from({ length: GRID_ROWS + 1 }, (_, row) => {
          const y = PAD_TOP + (row * PLOT_HEIGHT) / GRID_ROWS;
          return (
            <line
              key={row}
              x1={PAD_LEFT}
              x2={VIEW_WIDTH - PAD_RIGHT}
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
              `${xAt(0)},${PAD_TOP + PLOT_HEIGHT}`,
              ...series[0].values.map((value, index) => `${xAt(index)},${yAt(value)}`),
              `${xAt(pointCount - 1)},${PAD_TOP + PLOT_HEIGHT}`,
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
            y2={PAD_TOP + PLOT_HEIGHT}
            stroke="var(--border-strong)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {series.map((entry) =>
          entry.values.map((value, index) => (
            <circle
              key={`${entry.key}-${index}`}
              cx={xAt(index)}
              cy={yAt(value)}
              r={hoverIndex === index ? 5 : 4}
              fill="var(--surface)"
              stroke={entry.color}
              strokeWidth={2}
            />
          )),
        )}

        {labels.map((label, index) =>
          index % labelStep === 0 || index === pointCount - 1 ? (
            <text
              key={label + index}
              x={xAt(index)}
              y={VIEW_HEIGHT - 10}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize={11}
            >
              {label}
            </text>
          ) : null,
        )}

        {showLastValueLabel && (
          <text
            x={xAt(pointCount - 1)}
            y={yAt(series[0].values[pointCount - 1]) - 10}
            textAnchor="end"
            fill="var(--text-primary)"
            fontSize={11.5}
            fontWeight={600}
          >
            {series[0].formatted[pointCount - 1]}
          </text>
        )}
      </svg>

      {hoverIndex !== null && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-[10px] px-2.5 py-2 [font-size:12px] [box-shadow:var(--shadow-2)] [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]"
          style={{ left: `${tooltipLeftPercent}%` }}
        >
          <p className="mb-1 [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
            {labels[hoverIndex]}
          </p>
          {series.map((entry) => (
            <p key={entry.key} className="flex items-center gap-1.5 whitespace-nowrap [color:var(--text-secondary)]">
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: entry.color }} />
              {series.length > 1 && <span>{entry.name}</span>}
              <span className="[color:var(--text-primary)] tabular-nums">{entry.formatted[hoverIndex]}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

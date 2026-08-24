import type { CSSProperties } from "react";
import { cn } from "@/lib/styles";

/** Which band of the ladder the emblem is drawn in. Maps one to one onto `--rank-band-*`. */
export type RankBand = "conquered" | "current" | "locked" | "top";

/** Emblem sizes, in pixels, matching the surfaces that render a rank. */
export type RankEmblemSize = "xs" | "sm" | "md" | "lg" | "xl";

const EMBLEM_PIXELS: Readonly<Record<RankEmblemSize, number>> = {
  /** Mini ladder rows and compact glances. */
  xs: 38,
  /** Ladder rungs, and the dashboard widget on mobile. */
  sm: 56,
  /** The dashboard widget, and the summit rung. */
  md: 84,
  /** The `Resumen` hero on mobile. */
  lg: 120,
  /** The `Resumen` hero on desktop. */
  xl: 148,
};

const NUMERAL_SCALE = 0.34;

const BAND_RING_VAR: Readonly<Record<RankBand, string>> = {
  conquered: "var(--rank-band-conquered)",
  current: "var(--rank-band-current)",
  locked: "var(--rank-band-locked)",
  top: "var(--rank-band-top)",
};

const BAND_TEXT_VAR: Readonly<Record<RankBand, string>> = {
  conquered: "var(--rank-band-conquered-text)",
  current: "var(--rank-band-current-text)",
  locked: "var(--rank-band-locked-text)",
  top: "var(--rank-band-top-text)",
};

export type RankEmblemProps = {
  /** 1-based position in the ladder. Rendered inside the plate, so the band is never alone. */
  rankIndex: number;
  band: RankBand;
  size?: RankEmblemSize;
  /**
   * Accessible name, always naming the rank. Required rather than optional: the numeral alone reads
   * as an ordinal with no subject, and the band is colour, which carries nothing on its own.
   */
  label: string;
  className?: string;
};

/**
 * The plate a rank is drawn on, everywhere one is rendered.
 *
 * Until rank artwork exists this is one sober placeholder for all ten: a plate, a ring in the rank's
 * own band token, and the rank numeral in the mono face. That is deliberate, and the same choice
 * `MedalStage` already made. Inventing ten crests would be worse than an honest, uniform stand-in,
 * and the numeral plus the rank name beside it already carry what the collector needs to read.
 *
 * The band reaches the ring as a CSS variable, never as a hardcoded colour, so light and dark follow
 * the palette. Nothing here animates: the dashboard instance of this emblem has to stay calm, and a
 * component that animates by default cannot be made calm by its caller without fighting it.
 */
export default function RankEmblem({ rankIndex, band, size = "md", label, className }: RankEmblemProps) {
  const pixels = EMBLEM_PIXELS[size];
  const ring = BAND_RING_VAR[band];
  const isLocked = band === "locked";

  const plateStyle: CSSProperties = {
    // A ceiling rather than a fixed square: in a narrow rung or a stacked mobile hero the slot is
    // smaller than the nominal size, and a fixed width would simply overflow it.
    width: `min(${pixels}px, 100%)`,
    aspectRatio: "1 / 1",
    borderColor: "var(--border)",
    background: isLocked
      ? "var(--surface-elevated)"
      : `radial-gradient(circle at 50% 30%, color-mix(in oklch, ${ring} 12%, var(--surface-elevated)), var(--surface-elevated) 74%)`,
  };

  const ringStyle: CSSProperties = {
    borderColor: ring,
    boxShadow: isLocked ? "none" : `0 0 24px -14px ${ring}`,
    color: BAND_TEXT_VAR[band],
    fontSize: `${Math.round(pixels * NUMERAL_SCALE)}px`,
  };

  return (
    <figure
      data-rank={rankIndex}
      role="img"
      aria-label={label}
      className={cn("relative m-0 flex shrink-0 items-center justify-center rounded-full border", className)}
      style={plateStyle}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-[8%] flex items-center justify-center rounded-full border-2",
          "[font-family:var(--font-mono)] [font-feature-settings:'calt','ss01'] [font-weight:var(--font-weight-mono)]",
        )}
        style={ringStyle}
      >
        {rankIndex}
      </span>
    </figure>
  );
}

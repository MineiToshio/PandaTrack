import Image from "next/image";
import type { CSSProperties } from "react";
import { RANK_KEYS } from "@/lib/data/progression/rankLadder";
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

/** Public folder the finished rank artwork lives in. */
const RANK_ART_BASE_PATH = "/ranks";

/**
 * Turns a 1-based ladder position into the artwork the emblem draws, or `null` when the position is
 * off the ladder.
 *
 * The path is pure convention, `/ranks/<rankKey>.png`, resolved from `RANK_KEYS` and nothing else.
 * That is the whole reason the rank catalogue gained no `imageKey` column the way the medal one has:
 * the ladder is a fixed, ordered ten whose keys are already the source of truth for every other
 * per-rank asset (the translation namespaces `ranks.<rankKey>.name` and `.lore`), so a second
 * hand-maintained mapping could only ever drift out of step with it. Dropping a file into
 * `public/ranks/` named after its rank key is the entire installation procedure.
 */
export function resolveRankArtSrc(rankIndex: number): string | null {
  const rankKey = RANK_KEYS[rankIndex - 1];
  return rankKey ? `${RANK_ART_BASE_PATH}/${rankKey}.png` : null;
}

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
  /** 1-based position in the ladder. Resolves the artwork, and is published as `data-rank`. */
  rankIndex: number;
  band: RankBand;
  size?: RankEmblemSize;
  /**
   * Accessible name, always naming the rank. Required rather than optional: the artwork is
   * decorative to a screen reader, and the band is colour, which carries nothing on its own.
   */
  label: string;
  className?: string;
};

/**
 * The plate a rank is drawn on, everywhere one is rendered.
 *
 * The plate holds three things and no more: the rank's own artwork, a ring in the band's token, and
 * the state of that ring. Three deliberate decisions shape it, all of them consequences of the art
 * finally existing:
 *
 * 1. **No numeral.** It used to sit in the middle of the plate because there was nothing else to put
 *    there. The artwork occupies exactly that centre now, and a numeral over it would cover the one
 *    thing the emblem is for. Nothing is lost: every surface that draws an emblem already spells the
 *    position out beside it, in words rather than as a bare ordinal (the dashboard widget's `Rango N
 *    de 10` chip, the `Resumen` hero's eyebrow, the celebration's permanence line, and the ladder
 *    itself, which is an ordered list). The numeral survives only as the fallback below.
 * 2. **The ring stays, and becomes the plate's own border.** It is the only place the ladder's state
 *    (conquered, current, locked, summit) is carried on the emblem itself, and the artwork does not
 *    carry it: rank 4 looks the same whether the collector has passed it or not. Merging the old
 *    inner ring into the plate border keeps that state frame while giving the art the whole plate
 *    instead of the disc left inside a second ring.
 * 3. **Locked is the real artwork, desaturated.** The same reading `MedalStage` gives a locked
 *    medal: the piece is visible but drained, so what is waiting up the ladder is legible rather
 *    than hidden. Unlike `MedalStage` it carries no padlock, because a rank plate is drawn as small
 *    as 38 px, where a padlock covers the motif entirely, and because every surface that shows a
 *    locked rank labels it in text on the same row.
 *
 * The band reaches the ring as a CSS variable, never as a hardcoded colour, so light and dark follow
 * the palette. Nothing here animates: the dashboard instance of this emblem has to stay calm, and a
 * component that animates by default cannot be made calm by its caller without fighting it.
 */
export default function RankEmblem({ rankIndex, band, size = "md", label, className }: RankEmblemProps) {
  const pixels = EMBLEM_PIXELS[size];
  const ring = BAND_RING_VAR[band];
  const isLocked = band === "locked";
  const artSrc = resolveRankArtSrc(rankIndex);

  const plateStyle: CSSProperties = {
    // The `size` prop is the FALLBACK of a custom property the caller may redeclare at a breakpoint
    // (`className="sm:[--rank-emblem-size:148px]"`). Declaring the property here instead would put
    // it in the inline style, which outranks any class, and every responsive emblem would stay
    // silently pinned to its base size — a bug that produced no error and no warning.
    //
    // The `min()` is a ceiling rather than a fixed square: in a narrow rung or a stacked mobile hero
    // the slot is smaller than the nominal size, and a fixed width would simply overflow it.
    width: `min(var(--rank-emblem-size, ${pixels}px), 100%)`,
    aspectRatio: "1 / 1",
    borderColor: ring,
    boxShadow: isLocked ? "none" : `0 0 24px -14px ${ring}`,
    background: isLocked
      ? "var(--surface-elevated)"
      : `radial-gradient(circle at 50% 30%, color-mix(in oklch, ${ring} 12%, var(--surface-elevated)), var(--surface-elevated) 74%)`,
  };

  return (
    <figure
      data-rank={rankIndex}
      role="img"
      aria-label={label}
      className={cn(
        // The padding is what keeps the artwork inside the ring. `fill` resolves against the
        // PADDING box of this figure, so an 8 percent pad is the frame, and `object-contain` keeps
        // the widest emblem of the set (the winged shield of rank 4, whose wing tips reach the
        // corners of its own canvas) inside the circle instead of cropping them off.
        "relative m-0 flex shrink-0 items-center justify-center rounded-full border-2 p-[8%]",
        className,
      )}
      style={plateStyle}
    >
      {artSrc ? (
        <Image
          src={artSrc}
          alt=""
          fill
          // Twice the CSS box, so the plate stays crisp on a 2x screen at its largest breakpoint.
          sizes={`${pixels * 2}px`}
          className={cn("object-contain", isLocked && "opacity-60 grayscale")}
        />
      ) : (
        // Only reachable for a position off the ten-rung ladder, which the ladder itself cannot
        // produce. Kept as an honest stand-in rather than an empty plate, so a future eleventh rank
        // renders as a plate with a numeral instead of silently as a blank disc.
        <span
          aria-hidden="true"
          className={cn(
            "flex items-center justify-center",
            "[font-family:var(--font-mono)] [font-feature-settings:'calt','ss01'] [font-weight:var(--font-weight-mono)]",
          )}
          style={{
            color: BAND_TEXT_VAR[band],
            fontSize: `calc(var(--rank-emblem-size, ${pixels}px) * ${NUMERAL_SCALE})`,
          }}
        >
          {rankIndex}
        </span>
      )}
    </figure>
  );
}

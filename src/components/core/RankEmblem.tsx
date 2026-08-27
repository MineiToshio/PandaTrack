import Image from "next/image";
import type { CSSProperties } from "react";
import { RANK_KEYS } from "@/lib/data/progression/rankLadder";
import { cn } from "@/lib/styles";

/** Which band of the ladder the emblem is drawn in. */
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

const BAND_TEXT_VAR: Readonly<Record<RankBand, string>> = {
  conquered: "var(--rank-band-conquered-text)",
  current: "var(--rank-band-current-text)",
  locked: "var(--rank-band-locked-text)",
  top: "var(--rank-band-top-text)",
};

export type RankEmblemProps = {
  /** 1-based position in the ladder. Resolves the artwork, and is published as `data-rank`. */
  rankIndex: number;
  /**
   * Where the rank sits relative to the collector. Published as `data-band`, and drawn only when it
   * is `locked`; see the note on the component below for why the other three look alike.
   */
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
 * A rank's artwork, drawn full bleed in the box the caller gives it.
 *
 * **There is no plate.** No ring, no disc, no background, no inset. The emblems are finished
 * illustrations that already carry their own frame — a metal rim, a heater shield, a faceted crest —
 * so the ring this component used to draw was a second frame around the first one, and it cost the
 * art a fifth of its own box to do it (owner feedback, 2026-08-26). The artwork now occupies the
 * whole box, which is both larger and, being the piece's real silhouette rather than a circle, the
 * shape the illustrator actually drew.
 *
 * **Which means state is not on the emblem any more.** The ring used to be the one place the ladder's
 * reading (conquered, current, locked, summit) touched the plate, and three of those four now look
 * identical here on purpose: the artwork of rank 4 is the same piece whether it has been passed or
 * not, and every surface that draws an emblem already says which it is, in a form that does not
 * depend on colour (`ADR 0006`) — the ladder rung's accent border and `Estás aquí` pill, its check
 * and `Conquistado`, the summit's halo and `La cima` tag, the mini ladder's own labels. Re-adding a
 * coloured ring here would only repeat those, in the one register the art cannot afford to share.
 *
 * `locked` is the exception, because nothing else can say it: the piece is drawn through
 * `--locked-art-filter`, the theme-aware "struck but unfinished" recipe (`globals.css` §5c). It
 * carries no padlock, unlike `MedalStage` — a rank is drawn as small as 38 px, where a padlock covers
 * the motif entirely, and every surface that shows a locked rank labels it in text on the same row.
 *
 * Nothing here animates: the dashboard instance of this emblem has to stay calm, and a component that
 * animates by default cannot be made calm by its caller without fighting it.
 */
export default function RankEmblem({ rankIndex, band, size = "md", label, className }: RankEmblemProps) {
  const pixels = EMBLEM_PIXELS[size];
  const isLocked = band === "locked";
  const artSrc = resolveRankArtSrc(rankIndex);

  const emblemStyle: CSSProperties = {
    // The `size` prop is the FALLBACK of a custom property the caller may redeclare at a breakpoint
    // (`className="sm:[--rank-emblem-size:148px]"`). Declaring the property here instead would put
    // it in the inline style, which outranks any class, and every responsive emblem would stay
    // silently pinned to its base size — a bug that produced no error and no warning.
    //
    // A DEFINITE width with a separate `max-width` ceiling, never `min(<size>, 100%)`. The two read
    // the same and behave the same in a container of known width, but they part company in a
    // shrink-to-fit one — a centered `flex` box, a `fit-content` column, a grid track sized to its
    // content. There, the container's width comes from this emblem while `100%` asks for the
    // container's width: a cycle, which CSS breaks by resolving the percentage against nothing and
    // handing `min()` a zero. The emblem collapsed to 4.6 px on the ladder summit exactly that way
    // (owner report, 2026-08-26) — the art vanished and the warm aura behind it, sized in absolute
    // pixels and so immune to the collapse, was left painting on bare card as a red smudge. A
    // percentage `max-width` has no such cycle: it is ignored while the container measures its
    // contents, so the emblem contributes its real size and is only ever capped afterwards, which is
    // all the ceiling was ever for (a narrow rung, a stacked mobile hero).
    width: `var(--rank-emblem-size, ${pixels}px)`,
    maxWidth: "100%",
    // Squares the box against the width, so `fill` below always has a definite height to resolve
    // against. Without it `next/image` finds a zero-height parent and warns on every load.
    aspectRatio: "1 / 1",
  };

  return (
    <figure
      data-rank={rankIndex}
      data-band={band}
      role="img"
      aria-label={label}
      className={cn("relative m-0 flex shrink-0 items-center justify-center", className)}
      style={emblemStyle}
    >
      {artSrc ? (
        // `object-contain`, so the widest emblem of the set (the winged crest of rank 10, whose wing
        // tips reach the edges of its own canvas) is drawn whole rather than cropped. The pieces are
        // authored with their own margin inside a square canvas, which is the breathing room the
        // inset used to add a second time.
        <Image
          src={artSrc}
          alt=""
          fill
          // Twice the CSS box, so the art stays crisp on a 2x screen at its largest breakpoint.
          sizes={`${pixels * 2}px`}
          className={cn("object-contain", isLocked && "[filter:var(--locked-art-filter)]")}
        />
      ) : (
        // Only reachable for a position off the ten-rung ladder, which the ladder itself cannot
        // produce. Kept as an honest stand-in rather than an empty box, so a future eleventh rank
        // renders as a numeral instead of silently as nothing at all.
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

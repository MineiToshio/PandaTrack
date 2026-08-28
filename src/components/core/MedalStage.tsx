import Image from "next/image";
import { Lock, Medal } from "lucide-react";
import type { CSSProperties } from "react";
import { getRarityRingVar, type RarityGrade } from "@/components/core/RarityChip";
import { cn } from "@/lib/styles";

/** Art slot sizes, in pixels, matching the surfaces that render a medal. */
export type MedalStageSize = "sm" | "md" | "lg" | "xl" | "2xl";

const STAGE_PIXELS: Readonly<Record<MedalStageSize, number>> = {
  /** Toast and dense preview rows. */
  sm: 72,
  /** "Next on this page" preview, and the mobile album grid. */
  md: 116,
  /** The album grid. */
  lg: 168,
  /** The mobile medal detail hero, and the celebration panel. */
  xl: 208,
  /** The desktop medal detail hero. */
  "2xl": 262,
};

/** Size of the fallback medallion glyph, for a catalogue row with no artwork yet. */
const ICON_PIXELS: Readonly<Record<MedalStageSize, number>> = {
  sm: 26,
  md: 40,
  lg: 58,
  xl: 72,
  "2xl": 92,
};

/**
 * The padlock chip a locked piece carries, per size.
 *
 * Sized by hand rather than as a fraction of the art, because it is a control-scale object, not an
 * illustrated one: a straight percentage makes it a toy at `sm` and a dinner plate at `2xl`.
 */
const LOCK_BADGE_PIXELS: Readonly<Record<MedalStageSize, number>> = {
  sm: 22,
  md: 28,
  lg: 34,
  xl: 40,
  "2xl": 46,
};

const LOCK_GLYPH_RATIO = 0.56;

/** Public folder the finished medal artwork lives in. */
const MEDAL_ART_BASE_PATH = "/medals";

/**
 * Turns a catalogue `imageKey` into the source the stage draws, or `null` while there is none.
 *
 * The path convention lives here and nowhere else, so adding artwork is a matter of dropping files
 * into `public/medals/` and filling in `imageKey` on the catalogue rows.
 */
export function resolveMedalArtSrc(imageKey: string | null | undefined): string | null {
  return imageKey ? `${MEDAL_ART_BASE_PATH}/${imageKey}.png` : null;
}

export type MedalStageProps = {
  /** Catalogue key, published as `data-medal` so the artwork can be swapped in per medal. */
  medalKey: string;
  grade: RarityGrade;
  size?: MedalStageSize;
  /** A locked piece is drawn drained, under a padlock chip (`FR-12-25`). */
  locked?: boolean;
  /**
   * The medal's finished artwork. The ONE substitution point: pass a source and the stage renders
   * it, pass nothing and it renders the placeholder medallion.
   */
  imageSrc?: string | null;
  /**
   * Accessible name, always including the rarity grade. Required rather than optional: at the sizes
   * where the grade is not spelled out beside the art, this label is the only thing carrying it.
   */
  label: string;
  className?: string;
};

/**
 * A medal's artwork, drawn full bleed in the square the caller gives it.
 *
 * **There is no plate and no rarity ring.** Both are gone for the same reason the rank emblem's went
 * (owner feedback, 2026-08-26): the finished pieces carry their own frame, and the rarity is part of
 * that frame — the catalogue's own art system draws the rim, the rivets and the light differently per
 * print run (`medal-catalogue-v2.md` §3a). The ring was therefore a second, flatter statement of
 * something the illustration already made, drawn on top of it. Worse, it was a CIRCLE clipping art
 * that is often not circular: the shields, the pentagon and the star of the set were being cut at
 * their corners by it, which is the "borde raro" the owner saw.
 *
 * Rarity survives everywhere it is actually read: the `RarityChip` beside the piece, the hairline
 * `MedalCard` draws at its top edge, and this component's `label`, which always carries the grade in
 * words. `grade` remains a prop because the placeholder medallion still tints by it.
 *
 * A locked piece is drawn through `--locked-art-filter` (`globals.css` §5c) and carries a padlock
 * chip in its corner rather than a veil over its middle. The veil was part of the frame that just
 * left, and covering the motif to say "you have not got this" defeats an album whose whole job is to
 * show the collector what is waiting.
 *
 * The stage draws no infinite animation: motion belongs to the artwork and to the celebration.
 */
export default function MedalStage({
  medalKey,
  grade,
  size = "lg",
  locked = false,
  imageSrc,
  label,
  className,
}: MedalStageProps) {
  const pixels = STAGE_PIXELS[size];
  const badgePixels = LOCK_BADGE_PIXELS[size];

  const stageStyle: CSSProperties = {
    // A definite width with a separate percentage ceiling, never `min(<size>, 100%)`. The ceiling is
    // what lets the two-column mobile album draw a 168px piece in a narrower card; the shape of the
    // declaration is what keeps it from collapsing to nothing in a shrink-to-fit container, which is
    // the failure `RankEmblem` shipped and this component was one flex row away from sharing.
    width: `var(--medal-stage-size, ${pixels}px)`,
    maxWidth: "100%",
    aspectRatio: "1 / 1",
  };

  return (
    <figure
      data-medal={medalKey}
      data-locked={locked ? "true" : undefined}
      role="img"
      aria-label={label}
      className={cn("relative m-0 flex shrink-0 items-center justify-center", className)}
      style={stageStyle}
    >
      {imageSrc ? (
        // `object-contain`, never `cover`: the set is not all circles, and `cover` inside the old
        // round mask is what trimmed the corners off the shields and the star.
        <Image
          src={imageSrc}
          alt=""
          fill
          sizes={`${pixels * 2}px`}
          className={cn("object-contain", locked && "[filter:var(--locked-art-filter)]")}
        />
      ) : (
        // Reachable only for a catalogue row whose `imageKey` is still empty. An honest stand-in,
        // tinted by the rarity it stands in for.
        <Medal
          size={ICON_PIXELS[size]}
          strokeWidth={1.25}
          style={{ color: locked ? "var(--text-muted)" : getRarityRingVar(grade) }}
        />
      )}

      {locked && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute right-0 bottom-0 flex items-center justify-center rounded-full",
            "[background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)]",
          )}
          style={{ width: badgePixels, height: badgePixels }}
        >
          <Lock size={Math.round(badgePixels * LOCK_GLYPH_RATIO)} strokeWidth={2} className="text-text-secondary" />
        </span>
      )}
    </figure>
  );
}

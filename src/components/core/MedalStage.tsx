import Image from "next/image";
import { Lock, Medal } from "lucide-react";
import type { CSSProperties } from "react";
import { getRarityRingVar, type RarityGrade } from "@/components/core/RarityChip";
import { cn } from "@/lib/styles";

/** Art slot sizes, in pixels, matching the surfaces that render a medal. */
export type MedalStageSize = "sm" | "md" | "lg" | "xl";

const STAGE_PIXELS: Readonly<Record<MedalStageSize, number>> = {
  /** Toast and dense preview rows. */
  sm: 72,
  /** "Next on this page" preview, and the mobile album grid. */
  md: 116,
  /** The album grid. */
  lg: 168,
  /** The medal detail hero. */
  xl: 208,
};

const ICON_PIXELS: Readonly<Record<MedalStageSize, number>> = {
  sm: 26,
  md: 40,
  lg: 58,
  xl: 72,
};

/** Public folder the finished medal artwork will live in, once it exists. */
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
  /** A locked piece renders as a desaturated silhouette under a padlock (`FR-12-25`). */
  locked?: boolean;
  /**
   * The medal's finished artwork, when it exists. The ONE substitution point: pass a source and the
   * stage renders it, pass nothing and it renders the placeholder medallion. No other file needs to
   * change the day the real art lands.
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
 * The square art slot every medal is drawn in.
 *
 * Until the artwork itself exists, this renders one sober placeholder for all twenty-four pieces: a
 * plate, a ring in the medal's own rarity colour, and a generic medal glyph. That is deliberate.
 * Guessing twenty-four illustrations would be worse than an honest, uniform stand-in, and the ring
 * plus the rarity label beside it already carry everything the collector needs to read.
 *
 * Rarity reaches the ring as a CSS token, never as a hardcoded colour, so light and dark follow the
 * palette. The stage draws no infinite animation: motion belongs to the finished artwork, and a
 * spinning placeholder would be decoration pretending to be information.
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
  const ring = getRarityRingVar(grade);

  const plateStyle: CSSProperties = {
    // A ceiling, not a fixed size: in the two-column mobile grid the slot is narrower than the
    // nominal art size, and a fixed square would simply overflow its card.
    width: `min(${pixels}px, 100%)`,
    aspectRatio: "1 / 1",
    background: locked
      ? "var(--surface-elevated)"
      : `radial-gradient(circle at 50% 30%, color-mix(in oklch, ${ring} 10%, var(--surface-elevated)), var(--surface-elevated) 72%)`,
  };

  const ringStyle: CSSProperties = {
    borderColor: locked ? "var(--border-strong)" : ring,
    boxShadow: locked ? "none" : `0 0 24px -14px ${ring}`,
  };

  return (
    <figure
      data-medal={medalKey}
      role="img"
      aria-label={label}
      className={cn("relative m-0 flex shrink-0 items-center justify-center rounded-[26%] border", className)}
      style={{ ...plateStyle, borderColor: "var(--border)" }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-[6%] flex items-center justify-center overflow-hidden rounded-full border-2",
          locked && "grayscale",
        )}
        style={ringStyle}
      >
        {imageSrc ? (
          <Image src={imageSrc} alt="" fill sizes={`${pixels}px`} className="object-cover" />
        ) : (
          <Medal size={ICON_PIXELS[size]} strokeWidth={1.25} style={{ color: locked ? "var(--text-muted)" : ring }} />
        )}
      </span>

      {locked && (
        <span
          aria-hidden="true"
          className="absolute inset-[6%] flex items-center justify-center rounded-full [background:color-mix(in_oklch,var(--background)_55%,transparent)]"
        >
          <Lock size={Math.round(ICON_PIXELS[size] * 0.5)} className="text-text-secondary" strokeWidth={2} />
        </span>
      )}
    </figure>
  );
}

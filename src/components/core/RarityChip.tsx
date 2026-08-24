import type { CSSProperties } from "react";
import { cn } from "@/lib/styles";

/** The five print-run grades of `ADR 0036`, ascending. Keys match the medal catalogue's own. */
export type RarityGrade = "normal" | "first-print" | "limited" | "holo" | "signed";

/**
 * The same five grades as an ordered list, ascending, for the callers that have to compare two.
 *
 * Exported from here rather than restated wherever a comparison is needed: the ORDER is the whole
 * meaning of the scale, and a second copy of it is a second chance to get it wrong.
 */
export const RARITY_GRADES: readonly RarityGrade[] = ["normal", "first-print", "limited", "holo", "signed"];

export type RarityChipProps = {
  grade: RarityGrade;
  /** The grade's translated name. Always rendered: rarity is never carried by colour alone. */
  label: string;
  className?: string;
};

/** Ring token per grade. Declared once here so no caller composes a token name from a string. */
const RARITY_RING_VAR: Readonly<Record<RarityGrade, string>> = {
  normal: "var(--rarity-normal)",
  "first-print": "var(--rarity-first-print)",
  limited: "var(--rarity-limited)",
  holo: "var(--rarity-holo)",
  signed: "var(--rarity-signed)",
};

/** Chip-text alias per grade: a dedicated darker value in light, the ring token itself in dark. */
const RARITY_TEXT_VAR: Readonly<Record<RarityGrade, string>> = {
  normal: "var(--rarity-normal-chip-text)",
  "first-print": "var(--rarity-first-print-chip-text)",
  limited: "var(--rarity-limited-chip-text)",
  holo: "var(--rarity-holo-chip-text)",
  signed: "var(--rarity-signed-chip-text)",
};

export function getRarityRingVar(grade: RarityGrade): string {
  return RARITY_RING_VAR[grade];
}

/**
 * The rarity label that travels with every medal, everywhere one is rendered.
 *
 * `ADR 0036` fixes the contract this component exists to keep: a medal's grade is ALWAYS spelled
 * out in text next to whatever visual treatment carries it, on every surface with no exception. A
 * five-way colour gradient is not distinguishable by colour alone, so the swatch is decoration and
 * the word is the information (`ADR 0006`, `FR-12-21`).
 *
 * It follows `Chip`'s own recipe (14% fill, 28% border, chip-text alias) parametrized by grade,
 * rather than being a second, subtly different pill.
 */
export default function RarityChip({ grade, label, className }: RarityChipProps) {
  const ring = RARITY_RING_VAR[grade];

  const style: CSSProperties = {
    background: `color-mix(in oklch, ${ring} 14%, var(--background))`,
    border: `1px solid color-mix(in oklch, ${ring} 28%, var(--background))`,
    color: RARITY_TEXT_VAR[grade],
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-[var(--space-1_5)] whitespace-nowrap",
        "rounded-[var(--radius-pill)] px-[var(--space-2)] py-[var(--space-0_5)]",
        "[font-family:var(--font-mono)] [font-size:var(--text-mono)] [letter-spacing:var(--text-mono--letter-spacing)]",
        "font-bold uppercase",
        className,
      )}
      style={style}
    >
      <span aria-hidden="true" className="block size-2 shrink-0 rounded-[2px]" style={{ background: ring }} />
      {label}
    </span>
  );
}

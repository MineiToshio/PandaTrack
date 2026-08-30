import Link from "next/link";
import MedalStage, { type MedalStageSize } from "@/components/core/MedalStage";
import RarityChip, { getRarityRingVar, type RarityGrade } from "@/components/core/RarityChip";
import { cn } from "@/lib/styles";

export type MedalCardProps = {
  /** Catalogue key. Reaches the art slot as `data-medal`, never rendered as text. */
  medalKey: string;
  grade: RarityGrade;
  /** The medal's name, or the neutral locked title for a secret piece (`FR-12-25`). */
  title: string;
  /** The condition when held, the hint when not, the "no hint yet" line when secret and not held. */
  description: string;
  /** Eyebrow above the hint. Present only while the medal is locked. */
  hintLabel?: string | null;
  rarityLabel: string;
  /** Accessible name of the art slot, always carrying the rarity grade. */
  artLabel: string;
  locked: boolean;
  /** Already formatted for the collector's locale; this component never formats a date. */
  unlockedOn?: string | null;
  /** "No longer current" for a stateful medal, "Coming soon" for one this build cannot award. */
  statusLabel?: string | null;
  href: string;
  /** Accessible name of the link, since the visible title can be a neutral placeholder. */
  linkLabel: string;
  size?: Extract<MedalStageSize, "md" | "lg">;
  imageSrc?: string | null;
  className?: string;
};

/**
 * One medal in the album grid, and the same card the detail view reuses for its preview row.
 *
 * The whole card is the link rather than a control inside it: the target is comfortably past 44px
 * on every surface, and a card with a separate hit area invites the "I tapped the medal and nothing
 * happened" problem.
 *
 * Locked and unlocked differ in more than colour, on purpose. A locked piece carries a padlock, a
 * dashed border, an explicit "how to get it" eyebrow and its condition in words, so nothing about
 * its state depends on the collector distinguishing a desaturated illustration from a saturated
 * one (`FR-12-25`, `ADR 0006`).
 */
export default function MedalCard({
  medalKey,
  grade,
  title,
  description,
  hintLabel,
  rarityLabel,
  artLabel,
  locked,
  unlockedOn,
  statusLabel,
  href,
  linkLabel,
  size = "lg",
  imageSrc,
  className,
}: MedalCardProps) {
  return (
    <Link
      href={href}
      aria-label={linkLabel}
      className={cn(
        "group relative flex h-full flex-col items-center gap-1 overflow-hidden text-center no-underline",
        "rounded-[var(--radius-lg)] border px-[var(--space-3)] pt-[var(--space-5)] pb-[var(--space-4)]",
        "focus-visible:ring-ring focus-visible:ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        // A locked piece keeps the dashed border that marks it, but not a transparent background:
        // with no fill of its own it read as a hole punched in the grid rather than as a card.
        locked
          ? "border-border-strong bg-surface-elevated border-dashed"
          : "border-border bg-surface hover:border-border-strong",
        className,
      )}
    >
      {/* Rarity hairline: decoration that repeats what the chip below already says in words. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: getRarityRingVar(grade) }}
      />

      <MedalStage medalKey={medalKey} grade={grade} size={size} locked={locked} imageSrc={imageSrc} label={artLabel} />

      <h3 className="text-text-title mt-[var(--space-3)] [font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)]">
        {title}
      </h3>

      {hintLabel && (
        <span className="text-text-muted mt-[var(--space-2)] [font-family:var(--font-mono)] [font-size:var(--text-mono)] [letter-spacing:var(--text-mono--letter-spacing)] uppercase">
          {hintLabel}
        </span>
      )}

      <p className="text-text-secondary mt-[var(--space-1)] max-w-[28ch] [font-size:var(--text-caption)]">
        {description}
      </p>

      {/* `mt-auto` so the foot sits on the floor of the card. In a grid row whose cards differ by a
          line or two of hint, an unanchored foot leaves every chip at a different height. Chip and
          date stack in a column so every card foots the same way regardless of chip width. */}
      <div className="mt-auto flex flex-col items-center gap-[var(--space-2)] pt-[var(--space-3)]">
        <RarityChip grade={grade} label={rarityLabel} />
        {unlockedOn && (
          <span className="text-text-muted [font-family:var(--font-mono)] [font-size:var(--text-mono)]">
            {unlockedOn}
          </span>
        )}
      </div>

      {/* Set apart by the muted token, not by italics: the system has no italic register. */}
      {statusLabel && (
        <span className="text-text-muted mt-[var(--space-2)] [font-size:var(--text-caption)]">{statusLabel}</span>
      )}
    </Link>
  );
}

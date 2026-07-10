import { Star } from "lucide-react";
import { cn } from "@/lib/styles";

export type StarRatingProps = {
  /** Current rating value. When `null` or `undefined`, all stars are rendered as empty muted. */
  value: number | null | undefined;
  /** Pixel size for each star icon. Default `14`. */
  size?: number;
  /** Number of stars. Default `5`. */
  max?: number;
  /**
   * When `true`, stars fill by exact fractional value (e.g. `3.5` → half a star).
   * When `false` (default), the value is rounded to the nearest whole star.
   */
  fractional?: boolean;
  /**
   * When `true`, the element exposes no role/label and is marked `aria-hidden`.
   * Use when an interactive parent (e.g. `RatingStars`) already provides the
   * accessible rating semantics.
   */
  decorative?: boolean;
  className?: string;
  /** Optional aria-label override. Default uses the numeric value. */
  ariaLabel?: string;
};

/**
 * Canonical 5-star rating renderer. Server-safe and display-only. The interactive
 * rating input (`RatingStars`) composes this component so both share a single star
 * drawing and visual contract. Visual contract: see the Velvet design system at
 * `docs/design/` (`components.md`).
 *
 * Filled stars use `var(--accent-warm)`; empty stars use a 14% mix of `--text-primary`.
 * By default the value is rounded to the nearest whole star; pass `fractional` to
 * fill by exact value (used by the interactive input for half-star previews).
 */
export default function StarRating({
  value,
  size = 14,
  max = 5,
  fractional = false,
  decorative = false,
  className,
  ariaLabel,
}: StarRatingProps) {
  const safeValue = value ?? 0;
  const effectiveValue = fractional ? safeValue : Math.round(safeValue);
  const label = ariaLabel ?? (value != null ? `${value.toFixed(1)} de 5 estrellas` : "Sin reseñas");

  const semanticProps = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": label } as const);

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} {...semanticProps}>
      {Array.from({ length: max }).map((_, idx) => {
        const fillPercentage = value == null ? 0 : Math.max(0, Math.min(1, effectiveValue - idx)) * 100;
        return (
          <span key={idx} className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
            <Star
              size={size}
              aria-hidden="true"
              className="[color:color-mix(in_oklch,var(--text-primary)_14%,transparent)]"
            />
            {fillPercentage > 0 && (
              <span
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: `${fillPercentage}%` }}
                aria-hidden="true"
              >
                <Star size={size} fill="currentColor" className="[color:var(--accent-warm)]" />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

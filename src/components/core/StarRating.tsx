import { Star } from "lucide-react";
import { cn } from "@/lib/styles";

export type StarRatingProps = {
  /** Current rating value 0–5. When `null` or `undefined`, all stars are rendered as empty muted. */
  value: number | null | undefined;
  /** Pixel size for each star icon. Default `14`. */
  size?: number;
  className?: string;
  /** Optional aria-label override. Default uses the numeric value. */
  ariaLabel?: string;
};

/**
 * Inline 5-star rating display. Visual contract: see the Velvet design system at `docs/design/` (`components.md`).
 * Filled stars use `var(--accent-warm)`; empty stars use a 14% mix of `--text-primary`.
 * Half stars are rounded to nearest whole.
 */
export default function StarRating({ value, size = 14, className, ariaLabel }: StarRatingProps) {
  const safeValue = value ?? 0;
  const filled = Math.round(safeValue);
  const total = 5;
  const label = ariaLabel ?? (value != null ? `${value.toFixed(1)} de 5 estrellas` : "Sin reseñas");

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={label}>
      {Array.from({ length: total }).map((_, idx) => {
        const isFilled = idx < filled && value != null;
        return (
          <Star
            key={idx}
            size={size}
            aria-hidden="true"
            fill={isFilled ? "currentColor" : "transparent"}
            className={cn(
              isFilled
                ? "[color:var(--accent-warm)]"
                : "[color:color-mix(in_oklch,var(--text-primary)_14%,transparent)]",
            )}
          />
        );
      })}
    </span>
  );
}

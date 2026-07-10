"use client";

import { type MouseEvent, useMemo, useState } from "react";
import StarRating from "@/components/core/StarRating";
import { cn } from "@/lib/styles";

const STAR_SIZE_PX = {
  sm: 16,
  md: 20,
  lg: 28,
} as const;

type RatingStarsProps = {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  allowHalf?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  size?: keyof typeof STAR_SIZE_PX;
  className?: string;
  ariaLabel?: string;
};

function getPointerRatingValue(event: MouseEvent<HTMLButtonElement>, starIndex: number, allowHalf: boolean): number {
  const starNumber = starIndex + 1;
  if (!allowHalf) {
    return starNumber;
  }

  const rect = event.currentTarget.getBoundingClientRect();
  const relativeX = event.clientX - rect.left;
  const clickedHalf = relativeX <= rect.width / 2 ? 0.5 : 1;
  return starIndex + clickedHalf;
}

/**
 * Interactive rating input. Composes the canonical `StarRating` renderer for the
 * star drawing (single source of truth for the star visual) and layers hover/click
 * behavior on top. When not interactive (`readOnly` or no `onChange`) it renders the
 * display-only stars with exact fractional fill.
 */
export default function RatingStars({
  value,
  onChange,
  max = 5,
  allowHalf = true,
  readOnly = false,
  disabled = false,
  size = "md",
  className,
  ariaLabel,
}: RatingStarsProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const interactive = !readOnly && Boolean(onChange);
  const displayValue = hoverValue ?? value;
  const sizePx = STAR_SIZE_PX[size];

  const stars = useMemo(() => Array.from({ length: max }, (_, index) => index), [max]);

  return (
    <div
      className={cn("relative inline-flex items-center", className)}
      onMouseLeave={interactive ? () => setHoverValue(null) : undefined}
      aria-label={ariaLabel}
    >
      <StarRating value={displayValue} size={sizePx} max={max} fractional decorative />

      {interactive && (
        <div className="absolute inset-0 flex items-center gap-0.5">
          {stars.map((starIndex) => {
            const starValue = starIndex + 1;
            const halfValue = starIndex + 0.5;
            return (
              <button
                key={starIndex}
                type="button"
                className="focus-visible:ring-ring shrink-0 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                style={{ width: sizePx, height: sizePx }}
                onMouseMove={(event) => {
                  const previewValue = getPointerRatingValue(event, starIndex, allowHalf);
                  setHoverValue(previewValue);
                }}
                onClick={(event) => {
                  const selectedValue = getPointerRatingValue(event, starIndex, allowHalf);
                  onChange?.(selectedValue);
                }}
                disabled={disabled}
                aria-label={`${allowHalf ? halfValue : starValue} - ${starValue} / ${max}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

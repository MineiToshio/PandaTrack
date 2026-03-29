"use client";

import { Star } from "lucide-react";
import { type MouseEvent, useMemo, useState } from "react";
import { cn } from "@/lib/styles";

const STAR_SIZE_CLASSNAMES = {
  sm: "size-4",
  md: "size-5",
  lg: "size-7",
} as const;

type RatingStarsProps = {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  allowHalf?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  size?: keyof typeof STAR_SIZE_CLASSNAMES;
  className?: string;
  ariaLabel?: string;
};

function getStarFillPercentage(starIndex: number, value: number) {
  const starNumber = starIndex + 1;
  if (value >= starNumber) return 100;
  if (value >= starNumber - 0.5) return 50;
  return 0;
}

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
  const sizeClassName = STAR_SIZE_CLASSNAMES[size];

  const stars = useMemo(() => Array.from({ length: max }, (_, index) => index), [max]);

  return (
    <div
      className={cn("inline-flex items-center gap-1", className)}
      onMouseLeave={interactive ? () => setHoverValue(null) : undefined}
      aria-label={ariaLabel}
    >
      {stars.map((starIndex) => {
        const fillPercentage = getStarFillPercentage(starIndex, displayValue);
        const starValue = starIndex + 1;
        const halfValue = starIndex + 0.5;

        return (
          <div key={starIndex} className={cn("relative", sizeClassName)}>
            <Star className={cn("text-muted-foreground absolute inset-0", sizeClassName)} aria-hidden />
            <div
              className="absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${fillPercentage}%` }}
              aria-hidden
            >
              <Star className={cn("text-warning fill-warning", sizeClassName)} />
            </div>

            {interactive && (
              <div className="absolute inset-0">
                <button
                  type="button"
                  className="focus-visible:ring-ring absolute inset-0 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

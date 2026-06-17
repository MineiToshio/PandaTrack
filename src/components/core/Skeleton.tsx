import type { CSSProperties } from "react";
import { cn } from "@/lib/styles";

export type SkeletonVariant = "text" | "circle" | "rect" | "pill";

const VARIANT_RADIUS: Record<SkeletonVariant, string> = {
  text: "rounded-[4px]",
  rect: "rounded-[6px]",
  circle: "rounded-full",
  pill: "rounded-full",
};

/** Width of the last line in a multi-line `text` skeleton, so it reads like a paragraph. */
const LAST_TEXT_LINE_WIDTH = "65%";

export type SkeletonProps = {
  /** Shape. `text` (line/s), `circle` (avatar), `rect` (block), `pill` (chip). Default `rect`. */
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  /** For `text`: number of stacked lines. The last one is shortened. Ignored for other variants. */
  lines?: number;
  className?: string;
};

function toCssSize(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

/**
 * Canonical loading skeleton atom (ADR 0013). Renders the shared `.skeleton` shimmer
 * (defined in `globals.css`, static under `prefers-reduced-motion`). Purely decorative:
 * each atom is `aria-hidden`; the enclosing container owns `aria-busy` + a label.
 */
export default function Skeleton({ variant = "rect", width, height, lines = 1, className }: SkeletonProps) {
  if (variant === "text" && lines > 1) {
    return (
      <span aria-hidden className={cn("flex w-full flex-col gap-2", className)}>
        {Array.from({ length: lines }, (_, index) => {
          const isLast = index === lines - 1;
          return (
            <span
              key={index}
              className={cn("skeleton block", VARIANT_RADIUS.text)}
              style={{
                height: toCssSize(height) ?? "12px",
                width: isLast ? LAST_TEXT_LINE_WIDTH : (toCssSize(width) ?? "100%"),
              }}
            />
          );
        })}
      </span>
    );
  }

  const style: CSSProperties = {
    width: toCssSize(width),
    height: toCssSize(height),
  };

  return <span aria-hidden className={cn("skeleton block", VARIANT_RADIUS[variant], className)} style={style} />;
}

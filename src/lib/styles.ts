import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

/**
 * Canonical Tailwind gradient stops for tinted app surfaces (page heroes, account menu identity strip,
 * modal title accents, etc.). Pair with `bg-linear-to-br`, `bg-linear-to-r`, or another `bg-linear-*` direction.
 */
export const TINTED_SURFACE_GRADIENT_STOPS = "from-primary/20 via-highlight/12 to-info/20" as const;

/**
 * Same primary/highlight entry as {@link TINTED_SURFACE_GRADIENT_STOPS}, fading to transparent.
 * Use with `bg-linear-to-b` for section overlays and modal header washes.
 */
export const TINTED_SURFACE_GRADIENT_TOP_WASH = "from-primary/20 via-highlight/12 to-transparent" as const;

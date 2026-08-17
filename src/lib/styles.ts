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

/**
 * Primary elevated section panel for authenticated collector routes (settings blocks, store form steps, etc.).
 * Matches `visual-foundations.md` level-1 containers: translucent fill, inset ring, soft shadow.
 */
export const COLLECTOR_PRIMARY_SECTION_CLASSNAME =
  "border-border/70 bg-background/80 shadow-sm ring-primary/10 rounded-2xl border p-4 ring-1 ring-inset sm:p-6" as const;

/**
 * Muted inset block for secondary content inside a section (email row, placeholders, compact card summaries).
 */
export const COLLECTOR_MUTED_INSET_CLASSNAME = "border-border/55 bg-muted/32 rounded-xl border p-4" as const;

/**
 * Read-only summary panel inside the final "Confirmar" step of create wizards
 * (orders, deliveries). One source for the recipe so the confirm review reads
 * identically across modules.
 */
export const WIZARD_CONFIRM_PANEL_CLASSNAME =
  "rounded-[10px] p-4 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]" as const;


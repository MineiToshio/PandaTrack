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
 * Shared section panel for collector creation/edit forms (orders, stores, deliveries).
 * Solid `bg-card` keeps form steps visually consistent across the private app.
 */
export const COLLECTOR_FORM_SECTION_CLASSNAME =
  "border-border bg-card rounded-2xl border p-4 shadow-sm sm:p-5" as const;

/**
 * Muted inset block for secondary content inside a section (email row, placeholders, compact card summaries).
 */
export const COLLECTOR_MUTED_INSET_CLASSNAME = "border-border/55 bg-muted/32 rounded-xl border p-4" as const;

/**
 * Shared elevated card surface for collector detail panels, listing cards, and active-filter shells.
 * Keeps the base fill, border, radius, and shadow aligned across the private app.
 */
export const COLLECTOR_CARD_SURFACE_CLASSNAME = "border-border bg-surface-2 rounded-2xl border shadow-sm" as const;

/**
 * Read-only summary panel inside the final "Confirmar" step of create wizards
 * (orders, deliveries). One source for the recipe so the confirm review reads
 * identically across modules.
 */
export const WIZARD_CONFIRM_PANEL_CLASSNAME =
  "rounded-[10px] p-4 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]" as const;

/**
 * Shared responsive layout for action clusters inside detail heroes.
 * Mobile stacks actions vertically at full width; larger screens collapse to an inline row.
 */
export const DETAIL_HERO_ACTIONS_CLASSNAME =
  "flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-end" as const;

/**
 * Shared button chrome for hero actions on tinted detail surfaces.
 * Keeps tap targets comfortable on mobile and adds elevation separation from the gradient background.
 */
export const DETAIL_HERO_ACTION_BUTTON_CLASSNAME =
  "min-h-11 w-full justify-center gap-1.5 shadow-md hover:shadow-lg lg:w-auto" as const;

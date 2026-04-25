import { cn } from "@/lib/styles";

const ACCENT_BAR_DIMENSIONS = "h-3.5 w-1 shrink-0 rounded-full";
/** Default vertical gradient: primary → highlight (app shell). */
export const SECTION_ACCENT_BAR_DEFAULT_COLOR = "from-primary to-highlight bg-linear-to-b";

export type SectionAccentBarProps = {
  className?: string;
};

/**
 * Vertical accent bar for section titles and compact panel headers.
 * Pass `className` to override color/gradient; dimensions stay consistent.
 */
export function SectionAccentBar({ className }: SectionAccentBarProps) {
  return <span className={cn(ACCENT_BAR_DIMENSIONS, className ?? SECTION_ACCENT_BAR_DEFAULT_COLOR)} aria-hidden />;
}

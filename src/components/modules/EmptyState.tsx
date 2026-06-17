import type { ReactNode } from "react";
import { cn } from "@/lib/styles";

export type EmptyStateIconTone = "neutral" | "accent" | "warning" | "destructive";

/**
 * `plain`: centered block without chrome (default, legacy consumers).
 * `card`: canonical listing empty state — dashed `--surface-elevated` card with a circular icon well.
 * `page`: full-page centered state (route error, 404, offline) — bigger icon well + optional eyebrow.
 */
export type EmptyStateAppearance = "plain" | "card" | "page";

// Neutral wells use `in oklab` (L074: oklch drifts low-chroma tokens toward pink); chromatic
// tones stay in oklch to match the Eyebrow chip vocabulary.
const ICON_TONE_CLASSNAMES: Record<EmptyStateIconTone, string> = {
  neutral: "[color:var(--text-secondary)] [background:color-mix(in_oklab,var(--text-primary)_5%,transparent)]",
  accent: "[color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_10%,transparent)]",
  warning: "[color:var(--warning)] [background:color-mix(in_oklch,var(--warning)_13%,transparent)]",
  destructive: "[color:var(--destructive)] [background:color-mix(in_oklch,var(--destructive)_12%,transparent)]",
};

export type EmptyStateProps = {
  appearance?: EmptyStateAppearance;
  /** Optional decorative slot rendered above the title (mascot, icon, illustration). */
  visual?: ReactNode;
  /**
   * Pre-sized Lucide icon rendered inside the circular icon well. Canonical sizes:
   * `card` → 28px, `page` → 32px. Ignored when `visual` is provided.
   */
  icon?: ReactNode;
  /** Icon well tone — `neutral`/`accent` for empties, `warning`/`destructive` for error states. */
  iconTone?: EmptyStateIconTone;
  /** Optional mono eyebrow above the title (used by `page` states, e.g. "Error 404"). */
  eyebrow?: ReactNode;
  /** Title — short and direct. */
  title: string;
  /** Optional subtitle / supporting copy. */
  subtitle?: ReactNode;
  /** Optional CTAs (Buttons). */
  actions?: ReactNode;
  /** Heading level for the title; match the page outline (list pages under an `h1` use `h2`;
   * full-page `page` states own the `h1`). */
  headingAs?: "h1" | "h2" | "h3";
  /** ARIA role for the root (e.g. `alert` for route errors, `status` for offline). */
  role?: string;
  className?: string;
};

/**
 * Canonical centered-state primitive (ADR 0013). Renders empty states (`card`/`plain`)
 * and full-page error/404/offline states (`page`). Composable with a decorative `visual` slot.
 */
export default function EmptyState({
  appearance = "plain",
  visual,
  icon,
  iconTone = "neutral",
  eyebrow,
  title,
  subtitle,
  actions,
  headingAs: HeadingTag = "h3",
  role,
  className,
}: EmptyStateProps) {
  if (appearance === "card") {
    return (
      <div
        role={role}
        className={cn(
          "flex flex-col items-center gap-1.5 rounded-[var(--radius-2xl)] px-6 py-12 text-center [background:var(--surface-elevated)] [border:1px_dashed_var(--border)]",
          className,
        )}
      >
        {visual ? (
          <div aria-hidden="true" className="mb-2">
            {visual}
          </div>
        ) : icon ? (
          <span
            aria-hidden
            className={cn(
              "mb-2 inline-flex h-16 w-16 items-center justify-center rounded-full",
              ICON_TONE_CLASSNAMES[iconTone],
            )}
          >
            {icon}
          </span>
        ) : null}
        <HeadingTag className="[font-size:var(--text-subtitle)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
          {title}
        </HeadingTag>
        {subtitle && (
          <p className="max-w-[46ch] [font-size:var(--text-body)] [line-height:1.5] [color:var(--text-secondary)]">
            {subtitle}
          </p>
        )}
        {actions && <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">{actions}</div>}
      </div>
    );
  }

  if (appearance === "page") {
    return (
      <div
        role={role}
        className={cn("flex min-h-[58vh] flex-col items-center justify-center px-6 py-16 text-center", className)}
      >
        {visual ? (
          <div aria-hidden="true" className="mb-[18px]">
            {visual}
          </div>
        ) : icon ? (
          <span
            aria-hidden
            className={cn(
              "mb-[18px] inline-flex h-[72px] w-[72px] items-center justify-center rounded-full",
              ICON_TONE_CLASSNAMES[iconTone],
            )}
          >
            {icon}
          </span>
        ) : null}
        {eyebrow && (
          <span className="mb-3 [font-family:var(--font-mono)] [font-size:var(--text-eyebrow)] [letter-spacing:0.16em] [color:var(--text-muted)] uppercase">
            {eyebrow}
          </span>
        )}
        <HeadingTag className="mb-2 [font-size:var(--text-title)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
          {title}
        </HeadingTag>
        {subtitle && (
          <p className="mb-6 max-w-[440px] [font-size:var(--text-body)] [line-height:1.55] [color:var(--text-secondary)]">
            {subtitle}
          </p>
        )}
        {actions && <div className="flex flex-wrap items-center justify-center gap-2.5">{actions}</div>}
      </div>
    );
  }

  return (
    <div
      role={role}
      className={cn(
        "mx-auto flex w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-10 text-center",
        className,
      )}
    >
      {visual && <div aria-hidden="true">{visual}</div>}
      <div className="flex flex-col gap-1">
        <HeadingTag className="[font-size:var(--text-subtitle)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
          {title}
        </HeadingTag>
        {subtitle && (
          <p className="[font-size:var(--text-body)] [line-height:1.5] [color:var(--text-secondary)]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}

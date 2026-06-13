import type { ReactNode } from "react";
import { cn } from "@/lib/styles";

export type EmptyStateIconTone = "neutral" | "accent";

const CARD_ICON_TONE_CLASSNAMES: Record<EmptyStateIconTone, string> = {
  neutral: "[color:var(--text-secondary)] [background:color-mix(in_oklch,var(--text-primary)_5%,transparent)]",
  accent: "[color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_10%,transparent)]",
};

export type EmptyStateProps = {
  /**
   * `plain`: centered block without chrome (default, legacy consumers).
   * `card`: canonical listing empty state — dashed `--surface-elevated` card with a
   * circular icon well. Use this for list pages and gated flows so empty states read
   * identically across modules.
   */
  appearance?: "plain" | "card";
  /** Optional decorative slot rendered above the title (mascot, icon, illustration). */
  visual?: ReactNode;
  /**
   * Card appearance: pre-sized Lucide icon (canonical `width={28} height={28}`) rendered
   * inside the circular icon well. Ignored when `visual` is provided.
   */
  icon?: ReactNode;
  /** Icon well tone — `neutral` for no-results states, `accent` for inviting first-run states. */
  iconTone?: EmptyStateIconTone;
  /** Title — short and direct. */
  title: string;
  /** Optional subtitle / supporting copy. */
  subtitle?: ReactNode;
  /** Optional CTAs (Buttons). */
  actions?: ReactNode;
  /** Heading level for the title; match the page outline (list pages under an `h1` use `h2`). */
  headingAs?: "h2" | "h3";
  className?: string;
};

/**
 * Centered empty state used in lists and forms when no data matches the active filters.
 * Composable with `<MascotBubble>` or any decorative `visual` slot. The `card`
 * appearance is the canonical cross-module chrome for listing empty states.
 */
export default function EmptyState({
  appearance = "plain",
  visual,
  icon,
  iconTone = "neutral",
  title,
  subtitle,
  actions,
  headingAs: HeadingTag = "h3",
  className,
}: EmptyStateProps) {
  if (appearance === "card") {
    return (
      <div
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
              CARD_ICON_TONE_CLASSNAMES[iconTone],
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

  return (
    <div
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

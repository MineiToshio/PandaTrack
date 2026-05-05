import { cn } from "@/lib/styles";
import type { ReactNode } from "react";

export type MicroStatProps = {
  /** Short label above the value (e.g. "Total"). */
  label: string;
  /** Stat value. Plain string when numeric, ReactNode for richer slots (icon + text). */
  value: ReactNode;
  /**
   * Optional Lucide icon rendered in a tonal tile (44px). When present, layout shifts to icon + text rows.
   */
  icon?: ReactNode;
  /**
   * Tonal accent for icon tile. Aligns with semantic tokens.
   * Default: `accent`.
   */
  tone?: "accent" | "success" | "warning" | "info";
  /** Use tabular-nums for the value (currency, percentages). Default `false`. */
  mono?: boolean;
  className?: string;
};

const TONE_BACKGROUNDS: Record<NonNullable<MicroStatProps["tone"]>, string> = {
  accent: "[background:color-mix(in_oklch,var(--accent)_14%,var(--surface-elevated))] [color:var(--accent)]",
  success: "[background:color-mix(in_oklch,var(--success)_14%,var(--surface-elevated))] [color:var(--success)]",
  warning: "[background:color-mix(in_oklch,var(--warning)_14%,var(--surface-elevated))] [color:var(--warning)]",
  info: "[background:color-mix(in_oklch,var(--info)_14%,var(--surface-elevated))] [color:var(--info)]",
};

export default function MicroStat({ label, value, icon, tone = "accent", mono = false, className }: MicroStatProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {icon && (
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex h-11 w-11 flex-shrink-0 items-center justify-center [border-radius:12px]",
            TONE_BACKGROUNDS[tone],
          )}
        >
          {icon}
        </span>
      )}
      <div className="flex min-w-0 flex-col">
        <span className="[font-size:var(--text-caption)] [letter-spacing:0.04em] [color:var(--text-muted)] uppercase">
          {label}
        </span>
        <span
          className={cn(
            "[font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]",
            mono && "[font-variant-numeric:tabular-nums]",
          )}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

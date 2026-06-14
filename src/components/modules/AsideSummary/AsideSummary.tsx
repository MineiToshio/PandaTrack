"use client";

import type { ReactNode } from "react";
import Eyebrow from "@/components/core/Eyebrow";
import { cn } from "@/lib/styles";

export type AsideSummaryProps = {
  /** Eyebrow label rendered at the top of the card (mono uppercase). */
  eyebrow: string;
  /** Accessible name for the `<aside>` landmark. */
  ariaLabel?: string;
  /** Row content — typically `<AsideSummaryRow>` siblings. */
  children: ReactNode;
  /** Optional footer node placed below the rows (e.g. a status chip row). */
  footer?: ReactNode;
  className?: string;
};

/**
 * Canonical right-rail "Resumen" container shared across form pages.
 * Origin: stores/_components/share/StoreForm aside. Extracted here so the
 * order-create wizard and any future form-grid pages render an identical card.
 */
export default function AsideSummary({ eyebrow, ariaLabel, children, footer, className }: AsideSummaryProps) {
  return (
    <aside
      aria-label={ariaLabel ?? eyebrow}
      className={cn(
        "lg:[position:sticky] lg:self-start",
        "lg:[top:calc(var(--app-banner-offset,0px)_+_var(--header-h-desktop,4rem)_+_var(--space-4,1rem))]",
        className,
      )}
    >
      <div className="rounded-[var(--radius-xl)] p-4 [box-shadow:var(--shadow-2)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)] md:p-5">
        <Eyebrow as="p">{eyebrow}</Eyebrow>
        <dl className="mt-3 flex flex-col">
          {children}
          {footer}
        </dl>
      </div>
    </aside>
  );
}

export type AsideSummaryRowProps = {
  label: string;
  /** A single value, or a list rendered one item per line (right-aligned). */
  value: string | string[];
  /** When true, value renders in `--text-muted` (placeholder state). */
  muted?: boolean;
  /** When true, value renders in `--warning` (edit-mode diff highlight). */
  changed?: boolean;
  /** When true, the value renders bold (typically the total row). */
  strong?: boolean;
};

export function AsideSummaryRow({ label, value, muted, changed, strong }: AsideSummaryRowProps) {
  const stacked = Array.isArray(value);
  return (
    <div
      className={cn(
        "flex justify-between gap-3 py-2 [border-top:1px_solid_var(--border)] first:[border-top:0]",
        stacked ? "items-start" : "items-center",
      )}
    >
      <dt className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">{label}</dt>
      <dd
        className={cn(
          "text-right [font-size:var(--text-caption)] [font-weight:var(--font-weight-medium)]",
          strong && "[font-weight:var(--font-weight-semibold)]",
          changed ? "[color:var(--warning)]" : muted ? "[color:var(--text-muted)]" : "[color:var(--text-primary)]",
        )}
      >
        {stacked
          ? value.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))
          : value}
      </dd>
    </div>
  );
}

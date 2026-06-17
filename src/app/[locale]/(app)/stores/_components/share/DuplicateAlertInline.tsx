"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import Eyebrow from "@/components/core/Eyebrow";
import StoreAvatar from "@/components/core/StoreAvatar";
import { cn } from "@/lib/styles";
import type { DuplicateCandidate } from "@/queries/store";

export type DuplicateAlertInlineLabels = {
  eyebrow: string;
  title: string;
  viewStore: string;
  countryName: (code: string) => string;
};

export type DuplicateAlertInlineProps = {
  candidates: DuplicateCandidate[];
  labels: DuplicateAlertInlineLabels;
  /** Locale segment for "Ver tienda" links (`/{locale}/stores/{slug}`). */
  locale: string;
  className?: string;
};

/**
 * Inline alert under the Name field once a blur detects similar stores.
 * `role="alert"` so SR users hear the suggestion automatically.
 */
export default function DuplicateAlertInline({ candidates, labels, locale, className }: DuplicateAlertInlineProps) {
  if (candidates.length === 0) return null;

  return (
    <div
      role="alert"
      className={cn(
        "rounded-[var(--radius-lg)] p-3",
        "[background:color-mix(in_oklch,var(--warning)_8%,transparent)]",
        "[border:1px_solid_color-mix(in_oklch,var(--warning)_22%,transparent)]",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <AlertCircle size={14} aria-hidden="true" className="[color:var(--warning)]" />
        <Eyebrow className="[color:var(--warning)]">{labels.eyebrow}</Eyebrow>
      </div>
      <p className="mt-1 [font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
        {labels.title}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {candidates.map((candidate) => (
          <li
            key={candidate.id}
            className="flex items-center gap-3 rounded-[var(--radius-md)] p-2 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]"
          >
            <StoreAvatar store={{ name: candidate.name }} size={32} />
            <div className="min-w-0 flex-1">
              <span className="block truncate [font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
                {candidate.name}
              </span>
              <span className="block [font-size:var(--text-caption)] [color:var(--text-muted)]">
                {labels.countryName(candidate.countryCode)}
              </span>
            </div>
            <Link
              href={`/${locale}/stores/${candidate.slug}`}
              className="[font-size:var(--text-caption)] [font-weight:var(--font-weight-semibold)] [color:var(--accent)] hover:underline"
            >
              {labels.viewStore}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

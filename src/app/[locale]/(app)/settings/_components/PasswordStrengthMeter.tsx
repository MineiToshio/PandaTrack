"use client";

import { cn } from "@/lib/styles";

export type PasswordStrengthLevel = 0 | 1 | 2 | 3 | 4;

const SEGMENT_TOKENS: Record<Exclude<PasswordStrengthLevel, 0>, string> = {
  1: "var(--destructive)",
  2: "var(--warning)",
  3: "var(--accent)",
  4: "var(--success)",
};

export type PasswordStrengthMeterProps = {
  /** Strength level 0..4 derived from `scorePasswordStrength`. */
  level: PasswordStrengthLevel;
  /** Localized label for the current level (empty string when level === 0). */
  label: string;
  /** Localized "Fortaleza" / "Strength" prefix shown next to the label. */
  meterLabel: string;
  className?: string;
};

/**
 * Informational password strength meter (4 segments). Purely advisory — does not
 * gate submission. Aligned with NIST SP 800-63B-4 (2024) which discourages
 * composition rules in favor of length + meter-based feedback.
 */
export default function PasswordStrengthMeter({ level, label, meterLabel, className }: PasswordStrengthMeterProps) {
  return (
    <div className={cn("space-y-1.5", className)} aria-hidden={level === 0}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] [color:var(--text-muted)]">{meterLabel}</span>
        {label ? (
          <span
            className="text-[11px] [font-weight:var(--font-weight-medium)]"
            style={{
              color: level > 0 ? SEGMENT_TOKENS[level as Exclude<PasswordStrengthLevel, 0>] : "var(--text-muted)",
            }}
          >
            {label}
          </span>
        ) : null}
      </div>
      <div className="flex gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={level}>
        {[1, 2, 3, 4].map((segment) => {
          const filled = segment <= level;
          return (
            <span
              key={segment}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{
                background: filled ? SEGMENT_TOKENS[level as Exclude<PasswordStrengthLevel, 0>] : "var(--border)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Score a candidate password into 0..4 based on length + character variety.
 * Length is weighted highest (per NIST 2024 / OWASP guidance); character
 * classes contribute incrementally without ever blocking the user.
 */
export function scorePasswordStrength(candidate: string): PasswordStrengthLevel {
  if (candidate.length === 0) return 0;
  if (candidate.length < 8) return 1;

  let score = 1;
  if (candidate.length >= 12) score += 1;
  if (candidate.length >= 16) score += 1;

  const variety =
    Number(/[a-z]/.test(candidate)) +
    Number(/[A-Z]/.test(candidate)) +
    Number(/\d/.test(candidate)) +
    Number(/[^A-Za-z0-9]/.test(candidate));

  if (variety >= 3) score += 1;

  return Math.min(score, 4) as PasswordStrengthLevel;
}

"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/styles";

export const MIN_PASSWORD_LENGTH = 8;

export type PasswordRule = {
  id: string;
  label: string;
  /** Predicate evaluated against the current candidate password. */
  satisfied: boolean;
};

export type PasswordRulesProps = {
  rules: PasswordRule[];
  /** When true, unsatisfied rules render in muted color; when false (post-blur, etc.), unsatisfied use destructive. */
  pristine?: boolean;
  className?: string;
};

export default function PasswordRules({ rules, pristine = true, className }: PasswordRulesProps) {
  if (rules.length === 0) return null;

  return (
    <ul className={cn("flex flex-col gap-1.5", className)} aria-live="polite">
      {rules.map((rule) => {
        const ok = rule.satisfied;
        const Icon = ok ? Check : X;
        return (
          <li
            key={rule.id}
            className={cn(
              "flex items-center gap-1.5 text-[12px]",
              ok && "[color:var(--success)]",
              !ok && pristine && "[color:var(--text-muted)]",
              !ok && !pristine && "[color:var(--destructive)]",
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{rule.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function evaluatePasswordRules(candidate: string, copy: { minLength: string }): PasswordRule[] {
  return [
    {
      id: "minLength",
      label: copy.minLength,
      satisfied: candidate.length >= MIN_PASSWORD_LENGTH,
    },
  ];
}

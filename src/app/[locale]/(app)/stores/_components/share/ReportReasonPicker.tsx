"use client";

import { AlertTriangle, Ban, Copy, FileWarning, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/styles";

export type ReportReasonOption = {
  value: string;
  label: string;
  icon?: ReactNode;
};

export const DEFAULT_REPORT_REASON_ICONS: Record<string, ReactNode> = {
  INCORRECT_INFO: <FileWarning size={16} aria-hidden="true" />,
  SPAM: <ShieldAlert size={16} aria-hidden="true" />,
  INAPPROPRIATE: <AlertTriangle size={16} aria-hidden="true" />,
  DUPLICATE: <Copy size={16} aria-hidden="true" />,
  DOES_NOT_EXIST: <Ban size={16} aria-hidden="true" />,
};

export type ReportReasonPickerProps = {
  value: string | null;
  onChange: (value: string) => void;
  options: ReportReasonOption[];
  ariaLabel: string;
  name?: string;
  className?: string;
};

/**
 * Vertical list of report reasons (radio-style — only one selectable).
 * Each row is icon + label. Tap target ≥44px.
 */
export default function ReportReasonPicker({
  value,
  onChange,
  options,
  ariaLabel,
  name = "reason",
  className,
}: ReportReasonPickerProps) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("flex flex-col gap-2", className)}>
      {options.map((option) => {
        const isSelected = value === option.value;
        const icon = option.icon ?? DEFAULT_REPORT_REASON_ICONS[option.value];
        return (
          <label
            key={option.value}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 transition-colors",
              // Use longhands instead of the `border` shorthand: Tailwind v4
              // can emit shorthand rules AFTER longhand rules, which silently
              // resets border-color to currentColor (= text color). Splitting
              // into width + style keeps border-color owned by our conditional
              // utility below.
              "[border-width:1px] [border-style:solid]",
              isSelected
                ? "[border-color:var(--accent)] [color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_8%,transparent)]"
                : "[border-color:var(--border)] [color:var(--text-secondary)] [background:var(--surface)] hover:[border-color:var(--border-strong)]",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={isSelected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {icon && (
              <span className={cn("flex-shrink-0", isSelected ? "[color:var(--accent)]" : "[color:var(--text-muted)]")}>
                {icon}
              </span>
            )}
            <span className="[font-size:var(--text-body)]">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

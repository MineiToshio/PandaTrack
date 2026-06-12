"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/styles";

export type SegmentedToggleOption<T extends string> = {
  value: T;
  label: ReactNode;
  ariaLabel?: string;
};

export type SegmentedToggleProps<T extends string> = {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<SegmentedToggleOption<T>>;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

export default function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
  disabled = false,
  ariaLabel,
  className,
}: SegmentedToggleProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-[3px] rounded-[10px] p-[3px]",
        "[background:var(--surface-elevated)] [border:1px_solid_var(--border)]",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.ariaLabel}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-[7px] px-3 py-1.5 text-[12.5px] [font-weight:var(--font-weight-medium)]",
              "[color:var(--text-secondary)] transition-colors",
              "focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:-2px]",
              active && [
                "[background:color-mix(in_oklch,var(--accent)_12%,var(--surface))]",
                "[color:var(--accent)]",
                "[box-shadow:0_1px_3px_color-mix(in_oklch,var(--text-primary)_10%,transparent)]",
              ],
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/styles";

export type PillProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Visual selected state. Drives accent border + accent text + 12% accent background. */
  selected?: boolean;
  /** Optional leading icon (Lucide). Rendered at 13×13 px to match the demo `.filter-pill svg` rule. */
  icon?: ReactNode;
  children: ReactNode;
};

const PILL_BASE_CLASS = cn(
  "inline-flex items-center gap-[6px] rounded-full [outline:none] cursor-pointer",
  "[transition:background_150ms_cubic-bezier(0.2,0,0,1),border-color_150ms_cubic-bezier(0.2,0,0,1),color_150ms_cubic-bezier(0.2,0,0,1)]",
  "focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:2px]",
  "[font-size:var(--text-caption)] [font-family:var(--font-sans)] [font-weight:400]",
  "py-[5px] px-[10px]",
  "[&_svg]:w-[13px] [&_svg]:h-[13px]",
);

const PILL_IDLE_CLASS =
  "[border:1px_solid_var(--border-strong)] [color:var(--text-secondary)] [background:var(--surface-elevated)] hover:[color:var(--text-primary)]";

const PILL_SELECTED_CLASS =
  "[border:1px_solid_var(--accent)] [color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_12%,transparent)]";

/**
 * Atomic toggle pill. Visual contract aligned with `_notes/demo-screens.html § .filter-pill`.
 *
 * Caller controls semantics via standard button attributes:
 *   - role="checkbox" + aria-checked for multi-select filter pills
 *   - role="radio" + aria-checked for single-select pills
 *   - default button semantics for momentary actions
 *
 * Use `<StatusChip>` for status enums and `<Chip>` for tonal labels.
 */
export default function Pill({ selected, icon, children, className, type = "button", ...rest }: PillProps) {
  return (
    <button
      type={type}
      className={cn(PILL_BASE_CLASS, selected ? PILL_SELECTED_CLASS : PILL_IDLE_CLASS, className)}
      {...rest}
    >
      {icon != null && (
        <span
          aria-hidden="true"
          className={cn("flex items-center", selected ? "[color:var(--accent)]" : "[color:var(--accent-cool)]")}
        >
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}

"use client";

import { SlidersHorizontal } from "lucide-react";
import Button from "@/components/core/Button/Button";
import { cn } from "@/lib/styles";

export interface FilterTriggerButtonProps {
  /** Number of drawer filters currently applied (excludes search query). */
  appliedCount: number;
  onClick: () => void;
  /**
   * "label"     — full ghost button with label text + inline badge count.
   * "icon-only" — compact icon button for topbar use; requires aria-label.
   */
  variant?: "label" | "icon-only";
  /** Translated button label shown in the label variant. */
  label?: string;
  /** Required when variant="icon-only". */
  "aria-label"?: string;
  disabled?: boolean;
  className?: string;
}

const ACTIVE_STYLE = {
  background: "color-mix(in oklch, var(--accent) 10%, transparent)",
  color: "var(--accent)",
  borderColor: "color-mix(in oklch, var(--accent) 28%, transparent)",
} as const;

export default function FilterTriggerButton({
  appliedCount,
  onClick,
  variant = "label",
  label,
  "aria-label": ariaLabel,
  disabled,
  className,
}: FilterTriggerButtonProps) {
  const isActive = appliedCount > 0;

  if (variant === "icon-only") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        className={cn(
          "relative inline-flex min-h-11 w-11 cursor-pointer items-center justify-center",
          "rounded-[var(--radius-md)] [color:var(--text-primary)]",
          "transition-[background-color,color] [transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease-emphasis)]",
          "hover:[background:color-mix(in_oklch,var(--text-primary)_var(--state-hover-mix),transparent)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]",
          "disabled:pointer-events-none disabled:[color:var(--text-muted)]",
          // Active tint when filters applied
          isActive && "[color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_10%,transparent)]",
          className,
        )}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        {isActive && (
          <span
            aria-hidden="true"
            className="absolute top-0.5 right-0.5 inline-flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-[2px] text-[9px] leading-none font-bold [color:var(--text-on-accent)] [background:var(--accent)]"
          >
            {appliedCount > 9 ? "9+" : appliedCount}
          </span>
        )}
      </button>
    );
  }

  // label variant — wraps Button ghost with inline style overrides for active state
  return (
    <Button
      variant="ghost"
      size="md"
      leadingIcon={<SlidersHorizontal size={16} aria-hidden="true" />}
      onClick={onClick}
      disabled={disabled}
      // Inline style wins over CVA classes — same pattern used in demo HTML
      style={isActive ? ACTIVE_STYLE : undefined}
      className={className}
    >
      {label}
      {isActive && (
        <span
          aria-hidden="true"
          className="ml-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[3px] text-[10px] font-bold [color:var(--text-on-accent)] [background:var(--accent)]"
        >
          {appliedCount > 9 ? "9+" : appliedCount}
        </span>
      )}
    </Button>
  );
}

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/styles";

export type ChipVariant = "success" | "warning" | "destructive" | "info" | "accent" | "neutral";
export type ChipSize = "sm" | "md";

export type ChipProps = {
  variant?: ChipVariant;
  /** Leading icon — caller controls size (12px recommended). */
  icon?: ReactNode;
  size?: ChipSize;
  className?: string;
  children: ReactNode;
};

function getVariantStyle(variant: ChipVariant): CSSProperties {
  switch (variant) {
    case "success":
      return {
        background: "color-mix(in oklch, var(--success) 10%, transparent)",
        border: "1px solid color-mix(in oklch, var(--success) 22%, transparent)",
        color: "var(--success-chip-text)",
      };
    case "warning":
      return {
        background: "color-mix(in oklch, var(--warning) 10%, transparent)",
        border: "1px solid color-mix(in oklch, var(--warning) 22%, transparent)",
        color: "var(--warning-chip-text)",
      };
    case "destructive":
      return {
        background: "color-mix(in oklch, var(--destructive) 10%, transparent)",
        border: "1px solid color-mix(in oklch, var(--destructive) 22%, transparent)",
        color: "var(--destructive-chip-text)",
      };
    case "info":
      return {
        background: "color-mix(in oklch, var(--info) 10%, transparent)",
        border: "1px solid color-mix(in oklch, var(--info) 22%, transparent)",
        color: "var(--info-chip-text)",
      };
    case "accent":
      return {
        background: "color-mix(in oklch, var(--accent) 10%, transparent)",
        border: "1px solid color-mix(in oklch, var(--accent) 22%, transparent)",
        color: "var(--accent)",
      };
    case "neutral":
      return {
        background: "var(--surface-elevated)",
        border: "1px solid var(--border-strong)",
        color: "var(--text-secondary)",
      };
  }
}

/**
 * Generic pill chip with semantic color variants and optional leading icon.
 * For domain-specific status chips (order, delivery, payment states) use StatusChip instead.
 */
export default function Chip({ variant = "neutral", icon, size = "md", className, children }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[var(--space-1_5)] whitespace-nowrap",
        "rounded-[var(--radius-pill)]",
        "[font-family:var(--font-sans)] [font-weight:var(--font-weight-medium)]",
        size === "md" && [
          "[font-size:var(--text-caption)] [line-height:var(--text-caption--line-height)]",
          "px-[9px] py-[3px]",
        ],
        size === "sm" && [
          "[font-size:var(--text-mono)] [letter-spacing:var(--text-mono--letter-spacing)]",
          "px-[var(--space-2)] py-[var(--space-0_5)]",
        ],
        className,
      )}
      style={getVariantStyle(variant)}
    >
      {icon && (
        <span className="flex shrink-0 items-center" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}

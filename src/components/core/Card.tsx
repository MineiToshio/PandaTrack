import { cn } from "@/lib/styles";
import type { HTMLAttributes, ReactNode } from "react";

export type CardVariant = "elevated" | "outlined" | "subtle";
export type CardPadding = "none" | "sm" | "md" | "lg";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** Visual treatment: `elevated` (surface-elevated + soft shadow), `outlined` (surface + border), `subtle` (surface, no border). Default `elevated`. */
  variant?: CardVariant;
  /** Internal padding scale. `none` for custom layouts. Default `md`. */
  padding?: CardPadding;
  /** Composable wrapper element. Default `div`. */
  as?: "div" | "section" | "article" | "aside";
};

const VARIANT_CLASSNAMES: Record<CardVariant, string> = {
  elevated:
    "[background:var(--surface-elevated)] [border:1px_solid_var(--border)] [box-shadow:0_1px_2px_oklch(20%_0.020_50/0.04),_0_4px_12px_oklch(20%_0.020_50/0.04)]",
  outlined: "[background:var(--surface)] [border:1px_solid_var(--border)]",
  subtle: "[background:var(--surface)] [border:1px_solid_transparent]",
};

const PADDING_CLASSNAMES: Record<CardPadding, string> = {
  none: "",
  sm: "p-3 md:p-4",
  md: "p-4 md:p-5",
  lg: "p-5 md:p-6",
};

export default function Card({
  children,
  variant = "elevated",
  padding = "md",
  as: Tag = "div",
  className,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={cn(
        "[border-radius:var(--radius-xl)] [color:var(--text-primary)]",
        VARIANT_CLASSNAMES[variant],
        PADDING_CLASSNAMES[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

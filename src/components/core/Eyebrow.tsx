import { cn } from "@/lib/styles";
import type { ComponentType, ReactNode, SVGProps } from "react";

export type EyebrowVariant = "text" | "chip";
export type EyebrowSize = "sm" | "md";
export type EyebrowTone = "muted" | "accent" | "cool" | "warm" | "success" | "warning" | "destructive";
export type EyebrowTag = "span" | "p" | "h2" | "h3" | "h4" | "legend";

export type EyebrowProps = {
  children: ReactNode;
  variant?: EyebrowVariant;
  size?: EyebrowSize;
  tone?: EyebrowTone;
  /** Optional leading icon (lucide-react component). Only rendered in `chip` variant. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  as?: EyebrowTag;
  className?: string;
  /** Stable id (used as `aria-labelledby` target by the enclosing section). */
  id?: string;
};

const TEXT_TONE: Record<EyebrowTone, string> = {
  muted: "[color:var(--text-muted)]",
  accent: "[color:var(--accent)]",
  cool: "[color:var(--accent-cool)]",
  warm: "[color:var(--accent-warm)]",
  success: "[color:var(--success)]",
  warning: "[color:var(--warning)]",
  destructive: "[color:var(--destructive)]",
};

const CHIP_TONE: Record<EyebrowTone, string> = {
  muted:
    "[background:color-mix(in_oklch,var(--text-muted)_9%,transparent)] [color:var(--text-muted)] [border:1px_solid_color-mix(in_oklch,var(--text-muted)_22%,transparent)]",
  accent:
    "[background:color-mix(in_oklch,var(--accent)_9%,transparent)] [color:var(--accent)] [border:1px_solid_color-mix(in_oklch,var(--accent)_18%,transparent)]",
  cool: "[background:color-mix(in_oklch,var(--accent-cool)_10%,transparent)] [color:var(--accent-cool)] [border:1px_solid_color-mix(in_oklch,var(--accent-cool)_22%,transparent)]",
  warm: "[background:color-mix(in_oklch,var(--accent-warm)_12%,transparent)] [color:var(--accent-warm)] [border:1px_solid_color-mix(in_oklch,var(--accent-warm)_22%,transparent)]",
  success:
    "[background:color-mix(in_oklch,var(--success)_12%,transparent)] [color:var(--success)] [border:1px_solid_color-mix(in_oklch,var(--success)_26%,transparent)]",
  warning:
    "[background:color-mix(in_oklch,var(--warning)_14%,transparent)] [color:var(--warning)] [border:1px_solid_color-mix(in_oklch,var(--warning)_28%,transparent)]",
  destructive:
    "[background:color-mix(in_oklch,var(--destructive)_12%,transparent)] [color:var(--destructive)] [border:1px_solid_color-mix(in_oklch,var(--destructive)_26%,transparent)]",
};

export default function Eyebrow({
  children,
  variant = "text",
  size = "md",
  tone = "muted",
  icon: Icon,
  as: Tag = "span",
  className,
  id,
}: EyebrowProps) {
  const base = cn(
    "[font-family:var(--font-mono)] [font-size:var(--text-eyebrow)]",
    "[line-height:var(--text-eyebrow--line-height)] [letter-spacing:var(--text-eyebrow--letter-spacing)]",
    "[font-weight:var(--font-weight-mono)] uppercase",
    "[font-feature-settings:'calt','ss01']",
    size === "sm" && "[font-size:calc(var(--text-eyebrow)*0.9)]",
  );

  if (variant === "chip") {
    return (
      <Tag
        id={id}
        className={cn(
          base,
          "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5",
          CHIP_TONE[tone],
          className,
        )}
      >
        {Icon && <Icon className="size-2.5 shrink-0" aria-hidden="true" />}
        {children}
      </Tag>
    );
  }

  return (
    <Tag id={id} className={cn(base, TEXT_TONE[tone], className)}>
      {children}
    </Tag>
  );
}

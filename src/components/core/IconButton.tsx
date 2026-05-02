"use client";

import { cn } from "@/lib/styles";
import { getPosthogDataAttributes, type PosthogTrackingProps } from "@/lib/analytics/posthogDataAttributes";
import { Loader2, type LucideIcon } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";

export type IconButtonVariant = "primary" | "secondary" | "ghost" | "destructive-ghost" | "outline" | "standard";
export type IconButtonSize = "sm" | "md" | "lg";
export type IconButtonShape = "square" | "pill";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  PosthogTrackingProps & {
    /** Preferred: ReactNode icon (e.g. <Trash2 size={16} />). */
    icon?: ReactNode;
    /** Legacy backward-compat: LucideIcon component reference. Prefer `icon`. */
    Icon?: LucideIcon;
    /** Accessible label — always required for icon-only buttons. */
    "aria-label": string;
    variant?: IconButtonVariant;
    size?: IconButtonSize;
    shape?: IconButtonShape;
    loading?: boolean;
    /** Legacy backward-compat: class forwarded to the icon element when using Icon prop. */
    iconClassName?: string;
  };

const SIZE_MAP: Record<IconButtonSize, { box: string; iconSize: number }> = {
  sm: { box: "h-8 w-8", iconSize: 14 },
  md: { box: "h-10 w-10", iconSize: 16 },
  lg: { box: "h-12 w-12", iconSize: 20 },
};

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  primary:
    "[background:var(--accent)] [color:var(--text-on-accent)] hover:[background:color-mix(in_oklch,var(--accent)_92%,transparent)]",
  secondary:
    "bg-[var(--surface)] [border:1px_solid_var(--border)] [color:var(--text-primary)] hover:[background:color-mix(in_oklch,var(--text-primary)_var(--state-hover-mix),transparent)]",
  ghost:
    "[color:var(--text-primary)] hover:[background:color-mix(in_oklch,var(--text-primary)_var(--state-hover-mix),transparent)]",
  "destructive-ghost":
    "[color:var(--destructive-chip-text)] hover:[background:color-mix(in_oklch,var(--destructive)_var(--state-hover-mix),transparent)]",
  // Legacy aliases kept for backward compatibility
  outline:
    "bg-[var(--surface)] [border:1px_solid_var(--border)] [color:var(--text-primary)] hover:[background:color-mix(in_oklch,var(--text-primary)_var(--state-hover-mix),transparent)]",
  standard:
    "[color:var(--text-primary)] hover:[background:color-mix(in_oklch,var(--text-primary)_var(--state-hover-mix),transparent)]",
};

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      Icon,
      className,
      iconClassName: _iconClassName,
      variant = "ghost",
      size = "md",
      shape = "square",
      loading = false,
      disabled,
      onClick,
      type,
      posthogEvent,
      posthogProps,
      ...rest
    },
    ref,
  ) => {
    const { box, iconSize } = SIZE_MAP[size];
    const posthogDataAttributes = getPosthogDataAttributes(posthogEvent, posthogProps);

    const resolvedIcon = loading ? (
      <Loader2
        size={iconSize}
        aria-hidden="true"
        className="animate-spin"
        style={{ animationDuration: "calc(var(--motion-base) * 4)", animationTimingFunction: "linear" }}
      />
    ) : icon ? (
      icon
    ) : Icon ? (
      <Icon size={iconSize} aria-hidden="true" />
    ) : null;

    function handleClick(e: MouseEvent<HTMLButtonElement>) {
      e.stopPropagation();
      onClick?.(e);
    }

    return (
      <button
        ref={ref}
        type={type ?? "button"}
        disabled={disabled || loading}
        aria-busy={loading ? "true" : undefined}
        onClick={handleClick}
        className={cn(
          "relative inline-flex flex-shrink-0 cursor-pointer items-center justify-center",
          "transition-[background-color,color] [transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease-emphasis)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          "focus-visible:[outline-color:var(--focus-ring)]",
          // tap target ≥44×44 on mobile via ::before pseudo
          "before:absolute before:[inset:-6px] before:content-['']",
          shape === "square" ? "rounded-[var(--radius-md)]" : "rounded-[var(--radius-pill)]",
          box,
          VARIANT_CLASSES[variant],
          // Disabled — no opacity (ADR 0001 D3)
          (disabled || loading) && "pointer-events-none [color:var(--text-muted)]",
          className,
        )}
        {...rest}
        {...posthogDataAttributes}
      >
        {resolvedIcon}
      </button>
    );
  },
);

IconButton.displayName = "IconButton";

export default IconButton;

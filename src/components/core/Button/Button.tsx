"use client";

import { buttonVariants } from "@/components/core/Button/buttonVariants";
import { cn } from "@/lib/styles";
import { getPosthogDataAttributes, type PosthogTrackingProps } from "@/lib/analytics/posthogDataAttributes";
import { type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

type ButtonCommonProps = ButtonVariantProps &
  PosthogTrackingProps & {
    children: ReactNode;
    /** Lucide icon rendered in the leading slot. Replaces with Loader2 when `loading`. */
    leadingIcon?: ReactNode;
    /** Lucide icon rendered in the trailing slot. Decorative — pair with label text. */
    trailingIcon?: ReactNode;
    /**
     * Keyboard shortcut displayed to the right of the label.
     * Visible only on ≥ md breakpoints; hidden in mobile but kept in DOM for SR.
     * Pass a single key ("Z") or array of keys (["⌘", "Enter"]).
     */
    kbd?: string | string[];
    /** Loading state — shows Loader2 spinner in leading slot and sets aria-busy. */
    loading?: boolean;
    className?: string;
  };

type ButtonAsButton = ButtonCommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    as?: "button";
    type?: "button" | "submit" | "reset";
  };

type ButtonAsAnchor = ButtonCommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children"> & {
    as: "a";
    href: string;
    /** When true, renders aria-disabled and strips href. <a> has no native disabled. */
    disabled?: boolean;
  };

export type ButtonProps = ButtonAsButton | ButtonAsAnchor;

// ─── Component ────────────────────────────────────────────────────────────────

const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (
    {
      children,
      className,
      variant = "primary",
      size,
      fullWidth,
      leadingIcon,
      trailingIcon,
      kbd,
      loading = false,
      posthogEvent,
      posthogProps,
      ...rest
    },
    ref,
  ) => {
    const effectiveSize = variant === "link" ? "link" : size;
    const posthogDataAttributes = getPosthogDataAttributes(posthogEvent, posthogProps);

    const resolvedLeadingIcon = loading ? (
      <Loader2
        size={16}
        aria-hidden="true"
        className="flex-shrink-0 animate-spin"
        style={{ animationDuration: "calc(var(--motion-base) * 4)", animationTimingFunction: "linear" }}
      />
    ) : (
      leadingIcon
    );

    const kbdNode = kbd != null && (
      <span className="ml-auto hidden items-center gap-0.5 md:flex" aria-hidden="true">
        {(Array.isArray(kbd) ? kbd : [kbd]).map((key) => (
          <kbd
            key={key}
            className={cn(
              "inline-flex items-center justify-center",
              "min-w-[1.25rem] rounded px-[0.25rem] py-[0.125rem]",
              "[font-family:var(--font-mono)] [font-size:0.6875rem] [line-height:1]",
              "[background:color-mix(in_oklch,currentColor_10%,transparent)]",
              "[border:1px_solid_color-mix(in_oklch,currentColor_20%,transparent)]",
            )}
          >
            {key}
          </kbd>
        ))}
      </span>
    );

    const buttonClass = cn(
      buttonVariants({ variant, size: effectiveSize, fullWidth }),
      loading && "pointer-events-none",
      className,
    );

    const sharedContent = (
      <>
        {resolvedLeadingIcon && (
          <span className="flex flex-shrink-0 items-center" aria-hidden="true">
            {resolvedLeadingIcon}
          </span>
        )}
        {children}
        {trailingIcon && (
          <span className="flex flex-shrink-0 items-center" aria-hidden="true">
            {trailingIcon}
          </span>
        )}
        {kbdNode}
      </>
    );

    if (rest.as === "a") {
      const { as: _as, disabled, href, ...anchorRest } = rest as ButtonAsAnchor & { disabled?: boolean };
      const isDisabled = Boolean(disabled);
      return (
        <a
          ref={ref as unknown as React.Ref<HTMLAnchorElement>}
          className={buttonClass}
          href={isDisabled ? undefined : href}
          aria-disabled={isDisabled ? "true" : undefined}
          tabIndex={isDisabled ? -1 : undefined}
          {...anchorRest}
          {...posthogDataAttributes}
        >
          {sharedContent}
        </a>
      );
    }

    const { as: _as, type = "button", disabled, ...buttonRest } = rest as ButtonAsButton;
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={buttonClass}
        type={type}
        disabled={disabled}
        aria-busy={loading ? "true" : undefined}
        {...buttonRest}
        {...posthogDataAttributes}
      >
        {sharedContent}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;

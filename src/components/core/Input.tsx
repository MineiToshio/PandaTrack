"use client";

import { cn } from "@/lib/styles";
import { Loader2 } from "lucide-react";
import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /**
   * Error state.
   * - `boolean`: legacy — shows destructive border only.
   * - `string`: new S4 — shows destructive border + message text below.
   */
  error?: boolean | string;
  /** Neutral helper text rendered below the input when no error is present. */
  helperText?: string;
  /** Lucide icon in the leading slot. Decorative — pair with a visible <Label>. */
  leadingIcon?: ReactNode;
  /**
   * Lucide icon in the trailing slot. When `loading` is true, the spinner replaces this.
   * If the icon is interactive (e.g. eye-off), wrap it in a <button> with aria-label.
   */
  trailingIcon?: ReactNode;
  /** Static text prefix shown to the left of the input value (e.g. "$", "@"). */
  prefix?: string;
  /** Static text suffix shown to the right of the input value (e.g. "USD"). */
  suffix?: string;
  /** Loading state — shows Loader2 spinner in the trailing slot. */
  loading?: boolean;
  /**
   * Outer wrapper className. Applied to the root <div> container.
   * Use `inputClassName` to style the inner <input> element directly.
   */
  className?: string;
  /** className forwarded to the inner <input> element. */
  inputClassName?: string;
};

/**
 * Single-line text input. Extends native <input> with visual slots and helper/error text.
 * Keeps legacy API (forwardRef, boolean `error`, React.ChangeEvent onChange).
 * ADR 0001 D3 — disabled state uses token colors, never opacity.
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      inputClassName,
      error,
      helperText,
      leadingIcon,
      trailingIcon,
      prefix,
      suffix,
      loading,
      disabled,
      id,
      maxLength,
      value,
      ...props
    },
    ref,
  ) => {
    const hasError = Boolean(error);
    const errorMessage = typeof error === "string" ? error : undefined;

    const helperId = id ? `${id}-helper` : undefined;
    const errorId = id ? `${id}-error` : undefined;

    const charCount = typeof value === "string" ? value.length : undefined;
    const showCounter = maxLength != null && charCount != null;
    const counterExceeded = showCounter && charCount > maxLength;

    const trailingContent = loading ? (
      <Loader2
        size={16}
        aria-hidden="true"
        className="flex-shrink-0 animate-spin [color:var(--text-muted)]"
        style={{ animationDuration: "calc(var(--motion-base) * 4)", animationTimingFunction: "linear" }}
      />
    ) : (
      trailingIcon
    );

    return (
      <div className={cn("w-full", className)}>
        {/* Visual input container */}
        <div
          className={cn(
            "flex items-center gap-[var(--space-2)]",
            "h-[2.875rem] w-full",
            "px-[var(--space-4)] py-[var(--space-3)]",
            "rounded-[var(--radius-md)]",
            "[border-width:1px] [border-style:solid]",
            // Focus ring — the inner input triggers `:has(:focus-visible)`
            "has-[:focus-visible]:outline has-[:focus-visible]:outline-2",
            "has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:[outline-color:var(--focus-ring)]",
            // Border + background depend on error state. Emit only one rule so there is no conflict to resolve.
            !hasError && "[border-color:var(--border-strong)] bg-[var(--surface-elevated)]",
            hasError &&
              "[border-color:var(--destructive)] [background:color-mix(in_oklch,var(--destructive)_5%,var(--surface-elevated))]",
            // Disabled — no opacity (ADR 0001 D3)
            disabled && "pointer-events-none [border-color:var(--border)] [color:var(--text-muted)]",
          )}
          aria-busy={loading ? "true" : undefined}
        >
          {/* Leading icon */}
          {leadingIcon && (
            <span className="flex flex-shrink-0 items-center [color:var(--text-muted)]" aria-hidden="true">
              {leadingIcon}
            </span>
          )}

          {/* Prefix text */}
          {prefix && (
            <span className="flex-shrink-0 [font-size:var(--text-body)] [color:var(--text-muted)] select-none">
              {prefix}
            </span>
          )}

          {/* Native input — borderless, fills container */}
          <input
            ref={ref}
            id={id}
            disabled={disabled}
            maxLength={maxLength}
            value={value}
            className={cn(
              "min-w-0 flex-1 border-0 bg-transparent p-0 outline-none",
              "[font-family:var(--font-sans)] [font-size:var(--text-body)] [color:var(--text-primary)]",
              "[caret-color:var(--accent)]",
              "placeholder:[color:var(--text-muted)]",
              "disabled:[color:var(--text-muted)]",
              // Tabular nums for number inputs
              props.type === "number" && "[font-variant-numeric:tabular-nums] [font-feature-settings:'tnum']",
              inputClassName,
            )}
            aria-invalid={hasError ? "true" : undefined}
            aria-describedby={errorMessage ? errorId : helperText ? helperId : undefined}
            aria-required={props.required ? "true" : undefined}
            {...props}
          />

          {/* Character counter */}
          {showCounter && (
            <span
              className={cn(
                "flex-shrink-0 tabular-nums select-none",
                "[font-size:var(--text-caption)] [line-height:1]",
                counterExceeded ? "[color:var(--destructive-chip-text)]" : "[color:var(--text-muted)]",
              )}
              aria-hidden="true"
            >
              {charCount} / {maxLength}
            </span>
          )}

          {/* Suffix text */}
          {suffix && (
            <span className="flex-shrink-0 [font-size:var(--text-body)] [color:var(--text-muted)] select-none">
              {suffix}
            </span>
          )}

          {/* Trailing icon / spinner */}
          {trailingContent && (
            <span className="flex flex-shrink-0 items-center [color:var(--text-muted)]">{trailingContent}</span>
          )}
        </div>

        {/* Error message */}
        {errorMessage && (
          <p
            id={errorId}
            role="alert"
            aria-live="polite"
            className="mt-[var(--space-1)] [font-size:var(--text-caption)] [color:var(--destructive-chip-text)]"
          >
            {errorMessage}
          </p>
        )}

        {/* Helper text — only when no error */}
        {helperText && !hasError && (
          <p id={helperId} className="mt-[var(--space-1)] [font-size:var(--text-caption)] [color:var(--text-muted)]">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export default Input;

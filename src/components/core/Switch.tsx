"use client";

import { cn } from "@/lib/styles";
import { Loader2 } from "lucide-react";
import { forwardRef } from "react";

export type SwitchSize = "sm" | "md";

export type SwitchProps = {
  id?: string;
  name?: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  helperText?: string;
  error?: string;
  size?: SwitchSize;
  className?: string;
};

const SIZE_MAP: Record<SwitchSize, { track: string; thumb: string; translateOn: string; iconSize: number }> = {
  sm: {
    track: "h-4 w-7",
    thumb: "h-3 w-3",
    translateOn: "translate-x-3",
    iconSize: 8,
  },
  md: {
    track: "h-5 w-9",
    thumb: "h-4 w-4",
    translateOn: "translate-x-4",
    iconSize: 10,
  },
};

const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ id, name, checked, onChange, disabled, loading, label, helperText, error, size = "md", className }, ref) => {
    const { track, thumb, translateOn, iconSize } = SIZE_MAP[size];
    const isDisabled = disabled || loading;
    const errorId = id ? `${id}-error` : undefined;
    const helperId = id ? `${id}-helper` : undefined;

    return (
      <div className={cn("flex flex-col gap-[var(--space-1)]", className)}>
        <label
          className={cn(
            "inline-flex cursor-pointer items-center gap-[var(--space-3)] select-none",
            isDisabled && "cursor-not-allowed",
          )}
        >
          <span className="relative inline-flex flex-shrink-0 items-center">
            <input
              ref={ref}
              id={id}
              name={name}
              type="checkbox"
              role="switch"
              checked={checked}
              onChange={(e) => onChange?.(e.target.checked)}
              disabled={isDisabled}
              aria-checked={checked}
              aria-busy={loading ? "true" : undefined}
              aria-invalid={error ? "true" : undefined}
              aria-describedby={error ? errorId : helperText ? helperId : undefined}
              className="sr-only"
            />
            {/* Track */}
            <span
              aria-hidden="true"
              className={cn(
                "block rounded-[var(--radius-pill)]",
                "transition-[background-color] [transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease-emphasis)] motion-reduce:transition-none",
                track,
                checked && !isDisabled
                  ? "[background:var(--accent)]"
                  : isDisabled
                    ? "[background:color-mix(in_oklab,var(--text-primary)_10%,var(--surface))]"
                    : "[background:color-mix(in_oklch,var(--text-primary)_16%,transparent)]",
                // Focus ring on the track via sibling selector
                "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
                "peer-focus-visible:[outline-color:var(--focus-ring)]",
              )}
            />
            {/* Thumb */}
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-0.5 inline-flex items-center justify-center rounded-[var(--radius-pill)]",
                "[box-shadow:var(--elevation-1,0_1px_2px_rgba(0,0,0,0.15))] [background:var(--surface)]",
                "transition-transform [transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease-emphasis)]",
                "motion-reduce:transition-none",
                thumb,
                checked && !loading ? translateOn : "translate-x-0",
              )}
            >
              {loading && (
                <Loader2
                  size={iconSize}
                  aria-hidden="true"
                  className="animate-spin [color:var(--text-muted)]"
                  style={{ animationDuration: "calc(var(--motion-base) * 4)", animationTimingFunction: "linear" }}
                />
              )}
            </span>
          </span>
          {label && (
            <span
              className={cn(
                "[font-family:var(--font-sans)] [font-size:var(--text-body)] [color:var(--text-primary)]",
                isDisabled && "[color:var(--text-muted)]",
              )}
            >
              {label}
            </span>
          )}
        </label>
        {error && (
          <p
            id={errorId}
            role="alert"
            aria-live="polite"
            className="[font-size:var(--text-caption)] [color:var(--destructive-chip-text)]"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="[font-size:var(--text-caption)] [color:var(--text-muted)]">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Switch.displayName = "Switch";

export default Switch;

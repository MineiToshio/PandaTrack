"use client";

import { cn } from "@/lib/styles";
import { Check, Loader2, Minus } from "lucide-react";
import { forwardRef, type ChangeEvent } from "react";

export type CheckboxChecked = boolean | "indeterminate";
export type CheckboxSize = "sm" | "md";

export type CheckboxProps = {
  id?: string;
  name?: string;
  checked: CheckboxChecked;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  /** Visible label rendered next to the checkbox. */
  label?: string;
  size?: CheckboxSize;
  className?: string;
};

const SIZE_MAP: Record<CheckboxSize, { box: string; iconSize: number; text: string }> = {
  sm: { box: "h-4 w-4", iconSize: 10, text: "[font-size:var(--text-caption)]" },
  md: { box: "h-5 w-5", iconSize: 12, text: "[font-size:var(--text-body)]" },
};

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ id, name, checked, onChange, disabled, loading, label, size = "md", className }, ref) => {
    const { box, iconSize, text } = SIZE_MAP[size];
    const isIndeterminate = checked === "indeterminate";
    const isChecked = checked === true;
    const isActive = isChecked || isIndeterminate;

    function handleChange(e: ChangeEvent<HTMLInputElement>) {
      onChange?.(e.target.checked);
    }

    return (
      <label
        className={cn(
          "inline-flex cursor-pointer items-center gap-[var(--space-2)] select-none",
          (disabled || loading) && "cursor-not-allowed",
          className,
        )}
      >
        <span className={cn("relative inline-flex flex-shrink-0 items-center justify-center", box)}>
          <input
            ref={(node) => {
              if (node) node.indeterminate = isIndeterminate;
              if (typeof ref === "function") ref(node);
              else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
            }}
            id={id}
            name={name}
            type="checkbox"
            checked={isChecked}
            onChange={handleChange}
            disabled={disabled || loading}
            aria-checked={isIndeterminate ? "mixed" : isChecked}
            aria-busy={loading ? "true" : undefined}
            className="sr-only"
          />
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex items-center justify-center rounded-[var(--radius-sm)]",
              "transition-[background-color,border-color]",
              "[transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease-emphasis)]",
              box,
              isActive
                ? "[background:var(--accent)] [border:1.5px_solid_var(--accent)]"
                : "[background:transparent] [border:1.5px_solid_var(--border-strong)]",
              (disabled || loading) &&
                "[border-color:var(--text-muted)] [color:var(--text-muted)] [background:transparent]",
            )}
          >
            {loading ? (
              <Loader2
                size={iconSize}
                aria-hidden="true"
                className="animate-spin [color:var(--text-muted)]"
                style={{ animationDuration: "calc(var(--motion-base) * 4)", animationTimingFunction: "linear" }}
              />
            ) : isIndeterminate ? (
              <Minus
                size={iconSize}
                aria-hidden="true"
                className={cn(
                  "animate-check-zoom [color:var(--text-on-accent)]",
                  disabled && "[color:var(--text-muted)]",
                )}
              />
            ) : isChecked ? (
              <Check
                size={iconSize}
                aria-hidden="true"
                className={cn(
                  "animate-check-zoom [color:var(--text-on-accent)]",
                  disabled && "[color:var(--text-muted)]",
                )}
              />
            ) : null}
          </span>
        </span>
        {label && (
          <span
            className={cn(
              text,
              "[font-family:var(--font-sans)] [color:var(--text-primary)]",
              (disabled || loading) && "[color:var(--text-muted)]",
            )}
          >
            {label}
          </span>
        )}
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";

export default Checkbox;

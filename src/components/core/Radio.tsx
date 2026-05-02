"use client";

import { cn } from "@/lib/styles";
import { useId, useRef } from "react";

export type RadioOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
};

export type RadioSize = "sm" | "md";
export type RadioOrientation = "vertical" | "horizontal";

export type RadioProps<T extends string = string> = {
  id?: string;
  name: string;
  value: T | null;
  onChange: (value: T) => void;
  options: RadioOption<T>[];
  helperText?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  size?: RadioSize;
  orientation?: RadioOrientation;
  className?: string;
};

const SIZE_MAP: Record<RadioSize, { circle: string; dot: string; text: string }> = {
  sm: { circle: "h-[1rem] w-[1rem]", dot: "h-[0.375rem] w-[0.375rem]", text: "[font-size:var(--text-caption)]" },
  md: { circle: "h-[1.25rem] w-[1.25rem]", dot: "h-[0.5rem] w-[0.5rem]", text: "[font-size:var(--text-body)]" },
};

export default function Radio<T extends string = string>({
  id,
  name,
  value,
  onChange,
  options,
  helperText,
  error,
  disabled,
  required,
  size = "md",
  orientation = "vertical",
  className,
}: RadioProps<T>) {
  const uid = useId();
  const groupId = id ?? uid;
  const errorId = `${groupId}-error`;
  const helperId = `${groupId}-helper`;
  const { circle, dot, text } = SIZE_MAP[size];
  const itemRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    const enabledIndices = options.map((o, i) => (o.disabled || disabled ? -1 : i)).filter((i) => i >= 0);
    const currentPos = enabledIndices.indexOf(idx);

    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const nextIdx = enabledIndices[(currentPos + 1) % enabledIndices.length];
      if (nextIdx !== undefined) {
        itemRefs.current[nextIdx]?.focus();
        onChange(options[nextIdx].value);
      }
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIdx = enabledIndices[(currentPos - 1 + enabledIndices.length) % enabledIndices.length];
      if (prevIdx !== undefined) {
        itemRefs.current[prevIdx]?.focus();
        onChange(options[prevIdx].value);
      }
    }
  }

  return (
    <div className={cn("flex flex-col gap-[var(--space-1)]", className)}>
      <div
        role="radiogroup"
        aria-required={required ? "true" : undefined}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        className={cn("flex gap-[var(--space-3)]", orientation === "vertical" ? "flex-col" : "flex-row flex-wrap")}
      >
        {options.map((option, idx) => {
          const isChecked = option.value === value;
          const isDisabled = disabled || option.disabled;
          const inputId = `${groupId}-${option.value}`;

          return (
            <label
              key={option.value}
              htmlFor={inputId}
              className={cn(
                "inline-flex cursor-pointer items-start gap-[var(--space-2)] select-none",
                isDisabled && "cursor-not-allowed",
              )}
            >
              <span
                className={cn("relative mt-[0.125rem] inline-flex flex-shrink-0 items-center justify-center", circle)}
              >
                <input
                  ref={(node) => {
                    itemRefs.current[idx] = node;
                  }}
                  id={inputId}
                  type="radio"
                  name={name}
                  value={option.value}
                  checked={isChecked}
                  disabled={isDisabled}
                  onChange={() => !isDisabled && onChange(option.value)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  tabIndex={isChecked || (!value && idx === 0) ? 0 : -1}
                  aria-checked={isChecked}
                  aria-disabled={isDisabled ? "true" : undefined}
                  className="sr-only"
                />
                {/* Circle */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex items-center justify-center rounded-[var(--radius-pill)]",
                    "transition-[border-color,background-color]",
                    "[transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease-emphasis)]",
                    circle,
                    isChecked && !isDisabled
                      ? "[background:color-mix(in_oklch,var(--accent)_10%,var(--surface))] [border:1.5px_solid_var(--accent)]"
                      : "[background:transparent] [border:1.5px_solid_var(--border-strong)]",
                    isDisabled && "[border-color:var(--text-muted)]",
                  )}
                >
                  {isChecked && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "rounded-[var(--radius-pill)]",
                        "motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:[animation-duration:var(--motion-fast)]",
                        dot,
                        isDisabled ? "[background:var(--text-muted)]" : "[background:var(--accent)]",
                      )}
                    />
                  )}
                </span>
              </span>
              <span className="flex flex-col gap-[var(--space-0_5)]">
                <span
                  className={cn(
                    text,
                    "[font-family:var(--font-sans)] [color:var(--text-primary)]",
                    isDisabled && "[color:var(--text-muted)]",
                  )}
                >
                  {option.label}
                </span>
                {option.description && (
                  <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">
                    {option.description}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
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
}

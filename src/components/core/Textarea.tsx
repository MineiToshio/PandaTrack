"use client";

import { cn } from "@/lib/styles";
import { Loader2 } from "lucide-react";
import { forwardRef, useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /**
   * Error state.
   * - `boolean`: legacy — shows destructive border only.
   * - `string`: shows destructive border + message text below.
   */
  error?: boolean | string;
  helperText?: string;
  /** Shows Loader2 spinner overlay and sets aria-busy. */
  loading?: boolean;
  /** Minimum visible rows. Default 3. */
  minRows?: number;
  /** Maximum rows before scrolling. Default 8. */
  maxRows?: number;
  /** Grows to fit content automatically. Default true. */
  autosize?: boolean;
  className?: string;
};

const LINE_HEIGHT_PX = 24;
const PADDING_PX = 20;

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      error,
      helperText,
      loading,
      disabled,
      id,
      minRows = 3,
      maxRows = 8,
      autosize = true,
      value,
      onChange,
      maxLength,
      ...props
    },
    ref,
  ) => {
    const hasError = Boolean(error);
    const errorMessage = typeof error === "string" ? error : undefined;
    const errorId = id ? `${id}-error` : undefined;
    const helperId = id ? `${id}-helper` : undefined;
    const counterId = id ? `${id}-counter` : undefined;

    const internalRef = useRef<HTMLTextAreaElement | null>(null);
    const charCount = typeof value === "string" ? value.length : undefined;
    const showCounter = maxLength != null && charCount != null;
    const counterExceeded = showCounter && charCount > maxLength;

    const minHeight = minRows * LINE_HEIGHT_PX + PADDING_PX;
    const maxHeight = maxRows * LINE_HEIGHT_PX + PADDING_PX;

    useLayoutEffect(() => {
      if (!autosize) return;
      const el = (ref as React.RefObject<HTMLTextAreaElement>)?.current ?? internalRef.current;
      if (!el) return;
      el.style.height = "auto";
      const next = Math.min(el.scrollHeight, maxHeight);
      el.style.height = `${Math.max(next, minHeight)}px`;
    }, [value, autosize, minHeight, maxHeight, ref]);

    function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
      e.target.value = e.target.value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      onChange?.(e);
    }

    const describedBy = [
      errorMessage ? errorId : helperText ? helperId : undefined,
      showCounter ? counterId : undefined,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={cn("relative w-full", className)}>
        <textarea
          ref={(node) => {
            internalRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
          }}
          id={id}
          disabled={disabled}
          value={value}
          maxLength={maxLength}
          onChange={handleChange}
          className={cn(
            "w-full rounded-[var(--radius-md)]",
            "[border-width:1px] [border-style:solid] [font-family:var(--font-sans)]",
            "[font-size:var(--text-body)] [line-height:var(--text-body--line-height)]",
            "[color:var(--text-primary)] [caret-color:var(--accent)]",
            "px-[var(--space-4)] py-[var(--space-3)]",
            "outline-none",
            "placeholder:[color:var(--text-muted)]",
            "focus-visible:outline focus-visible:outline-2",
            "focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]",
            // Border + background depend on error state. Emit only one rule so there is no conflict to resolve.
            !hasError && "[border-color:var(--border-strong)] bg-[var(--surface-elevated)]",
            hasError &&
              "[border-color:var(--destructive)] [background:color-mix(in_oklch,var(--destructive)_5%,var(--surface-elevated))]",
            disabled && "pointer-events-none [border-color:var(--border)] [color:var(--text-muted)]",
            "@md:resize-vertical resize-none",
            loading && "pointer-events-none",
          )}
          style={{ minHeight, maxHeight: autosize ? undefined : maxHeight }}
          aria-invalid={hasError ? "true" : undefined}
          aria-describedby={describedBy || undefined}
          aria-required={props.required ? "true" : undefined}
          aria-busy={loading ? "true" : undefined}
          {...props}
        />

        {loading && (
          <span className="pointer-events-none absolute top-[var(--space-3)] right-[var(--space-3)]">
            <Loader2
              size={16}
              aria-hidden="true"
              className="animate-spin [color:var(--text-muted)]"
              style={{ animationDuration: "calc(var(--motion-base) * 4)", animationTimingFunction: "linear" }}
            />
          </span>
        )}

        <div className="flex items-start justify-between gap-[var(--space-2)]">
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
          {helperText && !hasError && (
            <p id={helperId} className="mt-[var(--space-1)] [font-size:var(--text-caption)] [color:var(--text-muted)]">
              {helperText}
            </p>
          )}
          {showCounter && (
            <p
              id={counterId}
              aria-live="polite"
              className={cn(
                "mt-[var(--space-1)] ml-auto flex-shrink-0 tabular-nums select-none",
                "[font-size:var(--text-caption)] [line-height:1]",
                counterExceeded ? "[color:var(--destructive-chip-text)]" : "[color:var(--text-muted)]",
              )}
            >
              {charCount} / {maxLength}
            </p>
          )}
        </div>
      </div>
    );
  },
);

Textarea.displayName = "Textarea";

export default Textarea;

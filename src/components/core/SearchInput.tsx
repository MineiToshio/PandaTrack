"use client";

import { cn } from "@/lib/styles";
import { Loader2, Search } from "lucide-react";
import { useRef, type KeyboardEvent, type ChangeEvent } from "react";

export type SearchInputProps = {
  /** Controlled value. */
  value: string;
  /** Change handler — called on every keystroke. */
  onChange: (value: string) => void;
  /** Fired on submit button click and on Enter key. */
  onSubmit: (value: string) => void;
  /** Shows spinner in the submit button slot instead of the search icon. */
  isLoading?: boolean;
  placeholder?: string;
  /** aria-label for the wrapping search landmark. */
  searchLabel?: string;
  disabled?: boolean;
  className?: string;
  /** className applied to the inner <input> element. */
  inputClassName?: string;
  /** Size variant. Default `md`. */
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASSES = {
  sm: {
    wrapper: "min-h-[2rem] px-[var(--space-3)]",
    input: "[font-size:var(--text-caption)] [line-height:var(--text-caption--line-height)]",
    btn: "min-h-[2rem] w-8",
  },
  md: {
    wrapper: "min-h-11 px-[var(--space-4)] md:min-h-10",
    input: "[font-size:var(--text-body)] [line-height:var(--text-body--line-height)]",
    btn: "min-h-11 w-10 md:min-h-10",
  },
  lg: {
    wrapper: "min-h-[2.75rem] px-[var(--space-4)]",
    input: "[font-size:var(--text-body-lg)] [line-height:var(--text-body-lg--line-height)]",
    btn: "min-h-[2.75rem] w-11",
  },
} as const;

/**
 * Search field with an integrated submit button (Search icon) and loading state.
 * Submits on button click or Enter. Aligns with the Input component spec (`docs/design/components.md`).
 */
export default function SearchInput({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  placeholder,
  searchLabel = "Buscar",
  disabled = false,
  className,
  inputClassName,
  size = "md",
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const sizes = SIZE_CLASSES[size];

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit(value);
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
  }

  function handleSubmit() {
    onSubmit(value);
    inputRef.current?.focus();
  }

  return (
    <div
      role="search"
      aria-label={searchLabel}
      className={cn(
        "group relative flex w-full items-stretch rounded-[var(--radius-md)]",
        "has-[input:focus-visible]:[box-shadow:0_0_0_3px_color-mix(in_oklch,var(--accent)_18%,transparent)]",
        className,
      )}
    >
      {/* Input container */}
      <div
        className={cn(
          "flex flex-1 items-center gap-[var(--space-2)]",
          "w-full",
          "rounded-l-[var(--radius-md)] rounded-r-none bg-[var(--surface-elevated)]",
          "border-r-0 [border:1px_solid_var(--border-strong)]",
          "transition-[border-color] [transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease-emphasis)]",
          "has-[:focus-visible]:[border-color:var(--accent)]",
          disabled && "pointer-events-none [border-color:var(--border)] [color:var(--text-muted)]",
          sizes.wrapper,
        )}
        aria-busy={isLoading ? "true" : undefined}
      >
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={cn(
            "min-w-0 flex-1 border-0 bg-transparent p-0 outline-none",
            "[font-family:var(--font-sans)] [color:var(--text-primary)]",
            "[caret-color:var(--accent)]",
            "placeholder:[color:var(--text-muted)]",
            "disabled:[color:var(--text-muted)]",
            // Remove native search cancel button (webkit)
            "[&::-webkit-search-cancel-button]:hidden",
            sizes.input,
            inputClassName,
          )}
          aria-label={searchLabel}
        />
      </div>

      {/* Submit button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || isLoading}
        aria-label={searchLabel}
        aria-busy={isLoading ? "true" : undefined}
        className={cn(
          "flex flex-shrink-0 items-center justify-center",
          // Minimum 44×44 on mobile for tap target
          "min-w-[2.75rem] @md:min-w-[2.5rem]",
          sizes.btn,
          "rounded-l-none rounded-r-[var(--radius-md)]",
          "[color:var(--text-on-accent)] [background:var(--accent)]",
          "[border:1px_solid_var(--accent)]",
          "cursor-pointer",
          "transition-[background-color,box-shadow,transform]",
          "[transition-duration:var(--motion-fast)] [transition-timing-function:var(--ease-emphasis)]",
          "hover:[background:color-mix(in_oklch,var(--accent)_88%,var(--text-primary))]",
          "hover:-translate-y-px hover:shadow-[var(--elevation-2)]",
          "motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none",
          "group-has-[input:focus-visible]:[border-color:var(--accent)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          "focus-visible:[outline-color:var(--focus-ring)]",
          "disabled:pointer-events-none disabled:[background:var(--surface-elevated)]",
          "disabled:[border-color:var(--border)] disabled:[color:var(--text-muted)]",
          "disabled:shadow-none",
        )}
      >
        {isLoading ? (
          <Loader2
            size={size === "sm" ? 14 : 16}
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
            style={{ animationDuration: "calc(var(--motion-base) * 4)", animationTimingFunction: "linear" }}
          />
        ) : (
          <Search size={size === "sm" ? 14 : 16} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

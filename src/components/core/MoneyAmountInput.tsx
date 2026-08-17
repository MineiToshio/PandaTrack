"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/styles";

export type MoneyAmountInputProps = {
  value: string;
  onChange: (raw: string) => void;
  /** Fires when the field loses focus. Used by callers whose "empty means released" rule may only
      settle once the caret has left: re-running it on every keystroke rewrites the field under it. */
  onBlur?: () => void;
  error?: boolean;
  /** Locks the field against new text while keeping it focusable. See the note in the component. */
  readOnly?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  /** Id(s) of the row's message node(s), wired as `aria-describedby`. */
  describedById?: string;
  placeholder?: string;
};

/**
 * Compact amount field for one money line in a list: 40px on desktop, 44px on mobile (the minimum
 * touch target). Replicates `Input`'s visual and a11y contract literally (token border, elevated
 * surface, `:has(:focus-visible)` ring, destructive error skin, opacity-free locked skin per ADR
 * 0001 D3) at a density a list of dozens of rows can carry.
 *
 * The locked state is `readOnly`, NOT `disabled`, and that is a focus decision rather than a
 * cosmetic one. A row can lock itself from data the server owns while the collector's cursor is
 * inside it (a line comes back settled, and emptying the field is what re-locks it), and a field
 * that turns `disabled` under the caret drops the focus onto `<body>`. `ModalDialog`'s trap only
 * intercepts `Tab` on the first and last focusable and the modal is not portalled, so from `<body>`
 * the next `Tab` walks into the page BEHIND the modal. `readOnly` keeps the focus where it is and
 * still refuses every keystroke. `disabled` is offered separately for the one case where it is the
 * right answer: the whole surface is submitting and nothing in it should be reachable at all.
 *
 * `tabIndex={-1}` while locked keeps the tab order exactly as `disabled` left it: a settled line's
 * field holds nothing to read or copy, and a long list of them would otherwise add one dead stop
 * per row. Focus can still land there the only way it needs to, by staying put when the row locks.
 *
 * Deliberately NOT a `size` prop on the shared `Input` primitive, and the argument survives the
 * move into `core/`: `InputHTMLAttributes` already defines a native numeric `size`, so the union
 * collapses (TS2322) and fixing it means `Omit`-ing a native attribute from a primitive the whole
 * app consumes; and the height and horizontal padding live on an intermediate `<div>` that takes no
 * className, so the prop would not reach them anyway. Same precedent as `OrderInlinePaymentForm`'s
 * local `inputClass`.
 *
 * It lives here rather than beside its first consumer because it now has two, on two different
 * surfaces (the store payment sheet's allocation rows and the order detail's breakdown rows), and a
 * route-level component reaching into `modules/StorePaymentSheet/` for a field is the import smell
 * PLAYBOOK §5.1 exists to prevent.
 */
const MoneyAmountInput = forwardRef<HTMLInputElement, MoneyAmountInputProps>(function MoneyAmountInput(
  {
    value,
    onChange,
    onBlur,
    error = false,
    readOnly = false,
    disabled = false,
    ariaLabel,
    describedById,
    placeholder = "0.00",
  },
  ref,
) {
  return (
    <div
      className={cn(
        "flex h-11 w-full items-center rounded-[var(--radius-md)] px-2.5 md:h-10",
        "[border-width:1px] [border-style:solid]",
        "has-[:focus-visible]:outline has-[:focus-visible]:outline-2",
        "has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:[outline-color:var(--focus-ring)]",
        !error && "[border-color:var(--border-strong)] [background:var(--surface-elevated)]",
        error &&
          "[border-color:var(--destructive)] [background:color-mix(in_oklch,var(--destructive)_5%,var(--surface-elevated))]",
        readOnly && "pointer-events-none [border-color:var(--border)] [color:var(--text-muted)]",
        disabled && "[border-color:var(--border)] [color:var(--text-muted)] opacity-60",
      )}
    >
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={value}
        readOnly={readOnly}
        disabled={disabled}
        tabIndex={readOnly ? -1 : undefined}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedById}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={cn(
          "min-w-0 flex-1 border-0 bg-transparent p-0 text-right outline-none",
          "[font-family:var(--font-sans)] [font-size:var(--text-body)] [color:var(--text-primary)] tabular-nums",
          "[caret-color:var(--accent)] placeholder:[color:var(--text-muted)]",
          "read-only:[color:var(--text-muted)] disabled:cursor-not-allowed",
        )}
      />
    </div>
  );
});

export default MoneyAmountInput;

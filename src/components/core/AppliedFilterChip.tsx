import { X } from "lucide-react";

export type AppliedFilterChipProps = {
  label: string;
  /** Accessible name for the remove action (the visible label only states the filter). */
  removeAriaLabel: string;
  onRemove: () => void;
};

/**
 * Canonical applied-filter chip rendered above listings (orders, deliveries, stores).
 * Accent-tinted pill with a one-click remove affordance; the whole chip is the remove
 * button. Consumers own label building and URL/state updates.
 */
export default function AppliedFilterChip({ label, removeAriaLabel, onRemove }: AppliedFilterChipProps) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-[12px] [color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_10%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--accent)_28%,transparent)] hover:[background:color-mix(in_oklch,var(--accent)_18%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]"
      aria-label={removeAriaLabel}
    >
      <span className="whitespace-nowrap">{label}</span>
      <X size={12} aria-hidden />
    </button>
  );
}

"use client";

import { PackageCheck } from "lucide-react";
import Button from "@/components/core/Button/Button";

export type StoreGroupSelectionBarProps = {
  /** "3 productos de 2 pedidos". Never an amount: 43% of the pending products have no price. */
  summary: string;
  ariaLabel: string;
  confirmLabel: string;
  confirmAriaLabel: string;
  clearLabel: string;
  onConfirm: () => void;
  onClear: () => void;
};

/**
 * Batch actions for the products selected inside ONE store group.
 *
 * It is `sticky` at the foot of the group's own card, in flow, rather than `fixed` to the viewport:
 * a bar pinned to the window could not say which store it belongs to, and the "mobile-only, with a
 * desktop counterpart" rule of `docs/design/interface-patterns.md` §1 exists for viewport-fixed
 * bars precisely because they read as detached from their column. This one never leaves its card,
 * so it is the same control at every width.
 *
 * On touch it is lifted clear of the "Nuevo pedido" FAB with the same offset contract the toast
 * container already uses (`--fab-offset` + `--fab-h`), instead of inventing a second one.
 *
 * The count is the only thing this bar says, so it is never clipped: it carries a width floor and
 * the row wraps rather than truncating. On a phone the two buttons alone are wider than the space
 * a count would need beside them (210px of the 228px a 320px viewport leaves inside the card), so
 * the single row is not a layout that exists at that width, whatever the copy says.
 *
 * A single action, and it is the arrival. The delivery wizard is deliberately not offered here:
 * its first two steps are exactly what the selection just did, so wiring it would need a URL
 * preload contract that does not exist, and `FR-08-36` already demoted it to a secondary action
 * everywhere else.
 */
export default function StoreGroupSelectionBar({
  summary,
  ariaLabel,
  confirmLabel,
  confirmAriaLabel,
  clearLabel,
  onConfirm,
  onClear,
}: StoreGroupSelectionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      className="animate-selection-bar-in sticky bottom-0 z-[var(--z-sticky)] mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[var(--radius-xl)] px-3 py-2 backdrop-blur [background:color-mix(in_oklch,var(--surface-elevated)_92%,transparent)] [border:1px_solid_var(--border)] max-lg:bottom-[calc(var(--fab-offset)+var(--fab-h)+var(--space-3))]"
    >
      {/*
        `flex-[1_1_13rem]` is the whole mechanism. 208px clears the widest summary the ICU message
        can produce (Inter 400 at `--text-caption`: "1024 productos de 999 pedidos" = 196px), and
        flex line-breaking measures the basis, not the shrunk width, so the count only shares a
        line with the buttons when it would be fully readable there. Below that the buttons wrap to
        their own line and the count takes the bar's full width. No breakpoint decides it, because
        what runs out of room is the text, not the viewport.
      */}
      <p className="min-w-0 flex-[1_1_13rem] [font-size:var(--text-caption)] [line-height:var(--text-caption--line-height)] [color:var(--text-secondary)]">
        {summary}
      </p>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          {clearLabel}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          leadingIcon={<PackageCheck size={14} aria-hidden />}
          onClick={onConfirm}
          aria-label={confirmAriaLabel}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

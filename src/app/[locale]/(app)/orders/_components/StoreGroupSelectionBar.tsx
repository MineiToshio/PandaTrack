"use client";

import { useLayoutEffect, useRef } from "react";
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
  onHeightChange: (height: number) => void;
};

/**
 * One store's batch actions. Floats in the mobile bottom action slot and stays inside its
 * group on desktop. Report the actual height so wrapped summaries never cover list content.
 */
export default function StoreGroupSelectionBar({
  summary,
  ariaLabel,
  confirmLabel,
  confirmAriaLabel,
  clearLabel,
  onConfirm,
  onClear,
  onHeightChange,
}: StoreGroupSelectionBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => onHeightChange(bar.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [onHeightChange]);

  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label={ariaLabel}
      className="animate-selection-bar-in fixed inset-x-[var(--fab-offset)] bottom-[calc(env(safe-area-inset-bottom,0px)+var(--fab-offset))] z-[var(--z-sticky)] flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[var(--radius-xl)] px-3 py-2 [box-shadow:var(--elevation-2)] [background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)] lg:sticky lg:inset-x-auto lg:bottom-0 lg:mt-2"
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
        <Button type="button" variant="ghost" size="sm" className="max-lg:min-h-11" onClick={onClear}>
          {clearLabel}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="max-lg:min-h-11"
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

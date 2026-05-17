"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/styles";

type CollapsibleSubcardProps = {
  eyebrow: string;
  meta?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

/**
 * Demo `.subcard` (CSS lines 986-1016 of `demo-screens.html`):
 *   - bg `--surface-elevated`, border 1px `--border`, radius **12px**, shadow-2, overflow hidden
 *   - `.subcard-toggle`: padding 14px 16px, gap 12px, chevron 18px right
 *   - `.subcard-body-inner`: padding 0 16px 16px (NO top — toggle's bottom-padding already spaces it)
 *   - Open animation: max-height 0 → 1200px, 280ms ease
 *
 * The body honors that exact spec: 16px horizontal + 16px bottom + 0 top so the content sits
 * tight against the toggle row instead of getting double-padded.
 */
export default function CollapsibleSubcard({
  eyebrow,
  meta,
  defaultOpen = false,
  children,
  className,
  bodyClassName,
}: CollapsibleSubcardProps) {
  const bodyId = useId();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className={cn(
        "bg-surface-elevated border-border overflow-hidden rounded-xl border",
        "[box-shadow:var(--elevation-2)] transition-shadow",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="hover:bg-muted/20 flex w-full items-center gap-3 px-4 py-[14px] text-left transition-colors"
      >
        <span className="text-text-muted font-mono text-[11px] font-medium tracking-[0.08em] uppercase">{eyebrow}</span>
        {meta != null && <span className="text-text-muted ml-1 text-[12px]">{meta}</span>}
        <ChevronDown
          className={cn(
            "text-text-muted ml-auto size-[18px] shrink-0 transition-transform duration-150",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div id={bodyId} hidden={!open} className={cn("px-4 pb-4", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}

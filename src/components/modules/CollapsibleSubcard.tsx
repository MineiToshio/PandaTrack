"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { type EyebrowTone } from "@/components/core/Eyebrow";
import { cn } from "@/lib/styles";

type CollapsibleSubcardProps = {
  /**
   * Eyebrow content. Pass a string for the default mono uppercase text or a pre-rendered
   * `<Eyebrow variant="chip" .../>` element when this Client Component is consumed from a
   * Server Component (lucide icons can't cross the RSC boundary as bare props).
   */
  eyebrow: ReactNode;
  meta?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Top accent border (2px) coordinated with the eyebrow tone. */
  topAccent?: EyebrowTone;
};

const TOP_ACCENT_VAR: Record<EyebrowTone, string> = {
  muted: "var(--text-muted)",
  accent: "var(--accent)",
  cool: "var(--accent-cool)",
  warm: "var(--accent-warm)",
  success: "var(--success)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
};

/**
 * `.subcard` treatment (see the Velvet design system at `docs/design/`, `interface-patterns.md`):
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
  topAccent,
}: CollapsibleSubcardProps) {
  const bodyId = useId();
  const [open, setOpen] = useState(defaultOpen);

  const topAccentStyle = topAccent
    ? { borderTop: `2px solid color-mix(in oklch, ${TOP_ACCENT_VAR[topAccent]} 55%, transparent)` }
    : undefined;

  return (
    <section
      className={cn(
        "bg-surface-elevated border-border overflow-hidden rounded-xl border",
        "[box-shadow:var(--elevation-2)] transition-shadow",
        className,
      )}
      style={topAccentStyle}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="hover:bg-muted/20 flex w-full items-center gap-3 px-4 py-[14px] text-left transition-colors"
      >
        {typeof eyebrow === "string" ? (
          <span className="text-text-muted font-mono text-[11px] font-medium tracking-[0.08em] uppercase">
            {eyebrow}
          </span>
        ) : (
          eyebrow
        )}
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

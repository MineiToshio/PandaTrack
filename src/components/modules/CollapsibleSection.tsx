"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import Eyebrow from "@/components/core/Eyebrow";
import { cn } from "@/lib/styles";

export type CollapsibleSectionProps = {
  /** Eyebrow text (uppercase mono). */
  eyebrow: string;
  /** Optional small count shown next to the eyebrow (e.g. "3" channels). */
  count?: number | string;
  children: ReactNode;
  /** Default open state. Default `true`. */
  defaultOpen?: boolean;
  className?: string;
};

/**
 * Collapsible card section with eyebrow + optional count + chevron toggle.
 * Visual contract aligned with `_notes/demo-screens.html § .subcard`.
 *
 * Use for grouping detail-page content (Categorías, Canales, Direcciones, Reseñas).
 * Animation uses the `grid-template-rows: 1fr → 0fr` trick for height transitions
 * without a fixed `max-height` sentinel.
 */
export default function CollapsibleSection({
  eyebrow,
  count,
  children,
  defaultOpen = true,
  className,
}: CollapsibleSectionProps) {
  const generatedId = useId();
  const bodyId = `${generatedId}-body`;
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section
      className={cn(
        "overflow-hidden [border-radius:var(--radius-xl)]",
        "[background:var(--surface-elevated)] [border:1px_solid_var(--border)]",
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-left md:px-5",
          "[outline:none] focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:-2px]",
          "hover:[background:color-mix(in_oklch,var(--text-primary)_3%,transparent)]",
        )}
      >
        <Eyebrow className="flex-1">{eyebrow}</Eyebrow>
        {count != null && <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">{count}</span>}
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn("flex-shrink-0 [color:var(--text-secondary)] transition-transform", isOpen && "rotate-180")}
          style={{ transitionDuration: "var(--motion-fast)" }}
        />
      </button>
      {/* grid-template-rows 1fr→0fr animates height without a fixed max-height sentinel */}
      <div
        id={bodyId}
        aria-hidden={!isOpen}
        style={{
          display: "grid",
          gridTemplateRows: isOpen ? "1fr" : "0fr",
          transition: "grid-template-rows 200ms ease",
        }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 md:px-5 md:pb-5">{children}</div>
        </div>
      </div>
    </section>
  );
}

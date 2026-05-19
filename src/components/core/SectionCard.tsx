"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/styles";

export type SectionCardState = "default" | "active" | "gated";
export type SectionCardTone = "default" | "warning" | "destructive";
export type SectionCardTopAccent = "accent" | "cool" | "warm" | "success" | "warning" | "destructive";

export type SectionCardProps = {
  /** Eyebrow shown above the title (mono uppercase). */
  eyebrow?: string;
  /** Title rendered as h3 by default. */
  title?: ReactNode;
  /** Optional summary text shown to the right of the title in collapsed mode. */
  summary?: ReactNode;
  /** Trailing slot for badges, counters, or actions in the header. */
  trailing?: ReactNode;
  /** Body content. */
  children?: ReactNode;
  /**
   * When true, body collapses to a clickable header. Click toggles open/closed.
   * Default `false` (always-visible body).
   */
  collapsible?: boolean;
  /** Initial open state when collapsible. Default `true`. */
  defaultOpen?: boolean;
  /** Controlled open state (with `onOpenChange`). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Visual emphasis:
   * - `default` — neutral surface with border.
   * - `active` — outlined with stronger border + soft elevation (used by wizard active step).
   * - `gated` — disabled-feeling card without opacity (ADR 0001 D3).
   */
  state?: SectionCardState;
  /** Tonal accent for left border (warning/destructive states without changing background). */
  tone?: SectionCardTone;
  /**
   * Top-border accent (2px) coordinated with a chip Eyebrow. Independent of `tone` so
   * cards can carry both a left destructive indicator and a top accent if needed.
   */
  topAccent?: SectionCardTopAccent;
  /** Heading level for the title. Default `h3`. */
  headingLevel?: "h2" | "h3" | "h4";
  className?: string;
  bodyClassName?: string;
  /** Stable id for the wrapping `<section>` (used as labelledby target). */
  id?: string;
};

const STATE_CLASSNAMES: Record<SectionCardState, string> = {
  default: "[background:var(--surface-elevated)] [border:1px_solid_var(--border)]",
  active:
    "[background:var(--surface-elevated)] [border:1px_solid_var(--border-strong)] [box-shadow:0_1px_2px_oklch(20%_0.020_50/0.05),_0_8px_18px_oklch(20%_0.020_50/0.05)]",
  gated: "[background:var(--surface)] [border:1px_solid_var(--border)] [color:var(--text-muted)] pointer-events-none",
};

const TONE_BORDERS: Record<SectionCardTone, string> = {
  default: "",
  warning: "[border-left:3px_solid_var(--warning)]",
  destructive: "[border-left:3px_solid_var(--destructive)]",
};

const TOP_ACCENT_BORDERS: Record<SectionCardTopAccent, string> = {
  accent: "[border-top:2px_solid_color-mix(in_oklch,var(--accent)_55%,transparent)]",
  cool: "[border-top:2px_solid_color-mix(in_oklch,var(--accent-cool)_55%,transparent)]",
  warm: "[border-top:2px_solid_color-mix(in_oklch,var(--accent-warm)_55%,transparent)]",
  success: "[border-top:2px_solid_color-mix(in_oklch,var(--success)_55%,transparent)]",
  warning: "[border-top:2px_solid_color-mix(in_oklch,var(--warning)_55%,transparent)]",
  destructive: "[border-top:2px_solid_color-mix(in_oklch,var(--destructive)_55%,transparent)]",
};

export default function SectionCard({
  eyebrow,
  title,
  summary,
  trailing,
  children,
  collapsible = false,
  defaultOpen = true,
  open,
  onOpenChange,
  state = "default",
  tone = "default",
  topAccent,
  headingLevel = "h3",
  className,
  bodyClassName,
  id,
}: SectionCardProps) {
  const generatedId = useId();
  const sectionId = id ?? generatedId;
  const headingId = `${sectionId}-title`;
  const bodyId = `${sectionId}-body`;
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = isControlled ? open : internalOpen;
  const HeadingTag = headingLevel;

  const handleToggle = () => {
    const next = !isOpen;
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };

  const headerContent = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {eyebrow && (
          <span
            className={cn(
              "[font-family:var(--font-mono)] [font-size:var(--text-eyebrow)]",
              "[font-weight:var(--font-weight-mono)] uppercase",
              "[letter-spacing:var(--text-eyebrow--letter-spacing)] [color:var(--text-muted)]",
            )}
          >
            {eyebrow}
          </span>
        )}
        {title && (
          <HeadingTag
            id={headingId}
            className="[font-size:var(--text-subtitle)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]"
          >
            {title}
          </HeadingTag>
        )}
        {summary && !isOpen && (
          <span className="truncate [font-size:var(--text-body)] [color:var(--text-secondary)]">{summary}</span>
        )}
      </div>
      {trailing && <div className="flex flex-shrink-0 items-center gap-2">{trailing}</div>}
      {collapsible && (
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={cn("flex-shrink-0 [color:var(--text-secondary)] transition-transform", isOpen && "rotate-180")}
          style={{ transitionDuration: "var(--motion-fast)" }}
        />
      )}
    </>
  );

  return (
    <section
      id={sectionId}
      aria-labelledby={title ? headingId : undefined}
      className={cn(
        "overflow-hidden [border-radius:var(--radius-xl)]",
        STATE_CLASSNAMES[state],
        TONE_BORDERS[tone],
        topAccent && TOP_ACCENT_BORDERS[topAccent],
        className,
      )}
    >
      {(eyebrow || title || trailing) &&
        (collapsible ? (
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={bodyId}
            onClick={handleToggle}
            className={cn(
              "flex w-full items-start gap-3 p-4 text-left md:p-5",
              "[outline:none] focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:-2px]",
            )}
          >
            {headerContent}
          </button>
        ) : (
          <header className="flex items-start gap-3 p-4 md:p-5">{headerContent}</header>
        ))}
      {(!collapsible || isOpen) && children && (
        <div
          id={bodyId}
          className={cn(
            "px-4 pb-4 md:px-5 md:pb-5",
            (eyebrow || title || trailing) && "pt-0",
            !(eyebrow || title || trailing) && "pt-4 md:pt-5",
            bodyClassName,
          )}
        >
          {children}
        </div>
      )}
    </section>
  );
}

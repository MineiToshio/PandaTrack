import type { ComponentType, ReactNode, SVGProps } from "react";
import Eyebrow, { type EyebrowTone } from "@/components/core/Eyebrow";
import Heading from "@/components/core/Heading";
import { cn } from "@/lib/styles";

/** Semantic token for the 3px section-identity top edge, keyed by the card's eyebrow tone. */
const TOP_ACCENT_TOKEN: Record<EyebrowTone, string> = {
  muted: "var(--text-muted)",
  accent: "var(--accent)",
  cool: "var(--accent-cool)",
  warm: "var(--accent-warm)",
  success: "var(--success)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
};

export type DashboardZoneCardProps = {
  /** Stable id for the card heading, used as the section's `aria-labelledby` target. */
  titleId: string;
  eyebrow: string;
  eyebrowIcon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  /** Optional supporting line under the title (e.g. naming a control's scope). */
  description?: string;
  /** Drives both the eyebrow chip and the top-accent edge. */
  tone: EyebrowTone;
  /** Optional trailing element in the header (e.g. a "see orders" link). */
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Shared surface for a dashboard zone: border-led card with a section-identity top edge,
 * a chip eyebrow, and a title (Chip-Eyebrow + Top-Accent language, PLAYBOOK §9.17).
 */
export default function DashboardZoneCard({
  titleId,
  eyebrow,
  eyebrowIcon,
  title,
  description,
  tone,
  trailing,
  children,
  className,
}: DashboardZoneCardProps) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "flex h-full flex-col rounded-[var(--radius-xl)] p-[18px] md:p-[22px]",
        "[background:var(--surface)] [border:1px_solid_var(--border)]",
        className,
      )}
      style={{ borderTop: `3px solid color-mix(in oklch, ${TOP_ACCENT_TOKEN[tone]} 55%, transparent)` }}
    >
      <div className="mb-[14px] flex items-start justify-between gap-3">
        <div className="flex flex-col items-start gap-1.5">
          <Eyebrow variant="chip" tone={tone} icon={eyebrowIcon}>
            {eyebrow}
          </Eyebrow>
          <Heading as="h2" size="xs" id={titleId} className="[font-size:16px] [letter-spacing:-0.01em]">
            {title}
          </Heading>
          {description && <p className="[font-size:12.5px] [color:var(--text-secondary)]">{description}</p>}
        </div>
        {trailing}
      </div>
      {children}
    </section>
  );
}

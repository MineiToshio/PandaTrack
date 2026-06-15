import type { ReactNode } from "react";
import { cn } from "@/lib/styles";

type SectionProps = {
  id: string;
  headingId: string;
  eyebrow: string;
  /** Lucide icon for the eyebrow chip (sized by `.mk-eyebrow svg`). */
  eyebrowIcon: ReactNode;
  title: string;
  subtitle?: string;
  /** Tinted accent-wash background + top/bottom border (`.mk-section.tinted`). */
  tinted?: boolean;
  children: ReactNode;
};

/**
 * Marketing section scaffold (`.mk-section`): centered head with eyebrow chip +
 * h2 + optional subtitle, then content. Shared by user-fit, features and FAQ.
 */
export default function Section({
  id,
  headingId,
  eyebrow,
  eyebrowIcon,
  title,
  subtitle,
  tinted,
  children,
}: SectionProps) {
  return (
    <section id={id} aria-labelledby={headingId} className={cn("mk-section", tinted && "tinted")}>
      <div className="mk-container">
        <div className="mk-section-head">
          <span className="mk-eyebrow">
            {eyebrowIcon} {eyebrow}
          </span>
          <h2 id={headingId}>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

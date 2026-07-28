import type { ComponentType, ReactNode, SVGProps } from "react";
import Eyebrow, { type EyebrowTone } from "@/components/core/Eyebrow";
import Heading from "@/components/core/Heading";
import { cn } from "@/lib/styles";

/** The review-panel card: matches the prototype `.mod-detail` surface. */
export function ReviewCard({ children, ariaLabel }: { children: ReactNode; ariaLabel: string }) {
  return (
    <article
      aria-label={ariaLabel}
      className="border-border bg-surface overflow-hidden rounded-[var(--radius-lg)] border"
    >
      {children}
    </article>
  );
}

/** Review header: category eyebrow, entity title, and a wrapping row of metadata chips. */
export function ReviewHeader({
  eyebrowIcon,
  eyebrowTone,
  eyebrowLabel,
  title,
  meta,
}: {
  eyebrowIcon: ComponentType<SVGProps<SVGSVGElement>>;
  eyebrowTone: EyebrowTone;
  eyebrowLabel: string;
  title: string;
  meta?: ReactNode;
}) {
  return (
    <header className="border-border bg-surface-elevated flex flex-col gap-2 border-b px-5 py-4">
      <Eyebrow variant="chip" tone={eyebrowTone} icon={eyebrowIcon}>
        {eyebrowLabel}
      </Eyebrow>
      <Heading as="h2" size="xs">
        {title}
      </Heading>
      {meta && <div className="flex flex-wrap items-center gap-1.5">{meta}</div>}
    </header>
  );
}

/** A content section with an uppercase mono title, mirroring the prototype `.mod-sec`. */
export function ReviewSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  children: ReactNode;
}) {
  return (
    <section className="border-border flex flex-col gap-3 border-b px-5 py-4">
      <p className="flex items-center gap-1.5 [font-family:var(--font-mono)] [font-size:var(--text-eyebrow)] [color:var(--text-muted)] uppercase">
        <Icon className="size-3 shrink-0" aria-hidden="true" />
        {title}
      </p>
      {children}
    </section>
  );
}

/** A muted helper line placed near a review's actions. */
export function ReviewHint({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("px-5 py-3 text-xs [color:var(--text-muted)]", className)}>{children}</p>;
}

/** The actions footer of a review, on the elevated surface, wrapping on narrow viewports. */
export function ReviewActions({ children }: { children: ReactNode }) {
  return (
    <footer className="border-border bg-surface-elevated flex flex-wrap items-center gap-2 border-t px-5 py-4">
      {children}
    </footer>
  );
}

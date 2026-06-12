import type { ComponentType, ReactNode, SVGProps } from "react";

type AppComingSoonCardProps = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
  /** CTA buttons pointing the user to a flow they can use today. */
  actions?: ReactNode;
};

/**
 * Friendly placeholder card for app sections that are not built yet.
 * Mirrors the empty-state surface family (dashed border, icon circle, centered copy)
 * so placeholders read as part of the product instead of a dead end.
 */
export default function AppComingSoonCard({ icon: Icon, title, description, actions }: AppComingSoonCardProps) {
  return (
    <div className="mt-6 flex flex-col items-center gap-4 rounded-[var(--radius-2xl)] px-6 py-10 text-center [background:var(--surface-elevated)] [border:1px_dashed_var(--border)]">
      <span
        aria-hidden
        className="inline-flex h-16 w-16 items-center justify-center rounded-full [color:var(--text-secondary)] [background:color-mix(in_oklch,var(--text-primary)_5%,transparent)]"
      >
        <Icon width={28} height={28} />
      </span>
      <h2 className="[font-size:var(--text-subtitle)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
        {title}
      </h2>
      <p className="max-w-[44ch] [font-size:var(--text-body)] [color:var(--text-secondary)]">{description}</p>
      {actions && <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}

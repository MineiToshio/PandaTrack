import type { ReactNode } from "react";
import { cn } from "@/lib/styles";

export type EmptyStateProps = {
  /** Optional decorative slot rendered above the title (mascot, icon, illustration). */
  visual?: ReactNode;
  /** Title — short and direct. */
  title: string;
  /** Optional subtitle. */
  subtitle?: string;
  /** Optional CTAs (Buttons). */
  actions?: ReactNode;
  className?: string;
};

/**
 * Centered empty state used in lists and forms when no data matches the active filters.
 * Composable with `<MascotBubble>` or any decorative `visual` slot.
 */
export default function EmptyState({ visual, title, subtitle, actions, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-10 text-center",
        className,
      )}
    >
      {visual && <div aria-hidden="true">{visual}</div>}
      <div className="flex flex-col gap-1">
        <h3 className="[font-size:var(--text-subtitle)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
          {title}
        </h3>
        {subtitle && (
          <p className="[font-size:var(--text-body)] [line-height:1.5] [color:var(--text-secondary)]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}

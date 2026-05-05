import type { ReactNode } from "react";
import { cn } from "@/lib/styles";

export type AlertBannerTone = "info" | "warning" | "destructive" | "success";

export type AlertBannerProps = {
  tone: AlertBannerTone;
  /** Optional leading icon (Lucide). Caller controls size; 14–16 px recommended. */
  icon?: ReactNode;
  /** Optional bold title rendered above the body. */
  title?: ReactNode;
  /** Body content — string or rich nodes. */
  children?: ReactNode;
  /**
   * Optional trailing slot rendered to the right (CTA, link, dismiss button).
   * On narrow widths it wraps below the body.
   */
  action?: ReactNode;
  /** ARIA role override. Defaults: `alert` for destructive, `note` otherwise. */
  role?: "alert" | "note" | "status";
  className?: string;
};

const TONE_VAR: Record<AlertBannerTone, string> = {
  info: "var(--info)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
  success: "var(--success)",
};

/**
 * Tonal alert banner with color-mix tinted background, border, and icon.
 * Visual contract aligned with `_notes/demo-screens.html § .store-banner` and the inline
 * private/pending/inactive alerts used across detail pages.
 *
 * For dense status enums use `<StatusChip>`. For brand banners use a custom card.
 */
export default function AlertBanner({ tone, icon, title, children, action, role, className }: AlertBannerProps) {
  const toneVar = TONE_VAR[tone];
  const resolvedRole = role ?? (tone === "destructive" ? "alert" : "note");

  return (
    <div
      role={resolvedRole}
      className={cn(
        "flex flex-wrap items-start gap-3 rounded-[var(--radius-lg)] p-3.5",
        "[font-size:var(--text-body)] [color:var(--text-primary)]",
        className,
      )}
      style={{
        background: `color-mix(in oklch, ${toneVar} 9%, transparent)`,
        border: `1px solid color-mix(in oklch, ${toneVar} 22%, transparent)`,
      }}
    >
      {icon != null && (
        <span aria-hidden="true" className="mt-0.5 flex flex-shrink-0 items-center" style={{ color: toneVar }}>
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {title != null && (
          <p className="[font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
            {title}
          </p>
        )}
        {children != null && (
          <div
            className={cn(
              "[font-size:var(--text-body)] [line-height:1.45] [color:var(--text-secondary)]",
              title != null && "mt-1",
            )}
          >
            {children}
          </div>
        )}
      </div>
      {action != null && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

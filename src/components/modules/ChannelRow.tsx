import type { ReactNode } from "react";
import { cn } from "@/lib/styles";

export type ChannelRowProps = {
  /** Leading icon — rendered inside an accent-cool tinted square tile. */
  icon: ReactNode;
  /** Small label above the value (e.g. "Sitio web", "Instagram"). */
  label: string;
  /**
   * Single-line value (URL handle, email, etc.). Truncates with ellipsis when too long
   * — long URLs are more readable that way than wrapped at arbitrary points.
   * Mutually exclusive with `valueLines`.
   */
  value?: string;
  /**
   * Multi-line value (addresses, formatted blocks). Each entry renders on its own line
   * and wraps independently (postal-style). Use this when the field has natural
   * sub-parts the reader needs to see in full — e.g. street / reference / city.
   * Mutually exclusive with `value`.
   */
  valueLines?: string[];
  /** Optional trailing slot (copy button, external link, action menu). */
  trailing?: ReactNode;
};

/**
 * Generic icon-tile + label + value + trailing-action row.
 * Visual contract aligned with `_notes/demo-screens.html § .channel-row` — used for
 * contact channels, addresses, and similar list-of-key-value-with-icon patterns.
 *
 * Layout switches to `items-start` when `valueLines` is provided so the icon aligns
 * with the label even when the address spans multiple lines.
 */
export default function ChannelRow({ icon, label, value, valueLines, trailing }: ChannelRowProps) {
  const lines = valueLines && valueLines.length > 0 ? valueLines.filter((line) => line.trim().length > 0) : null;
  const isMultiLine = lines != null;

  return (
    <div
      className={cn(
        "flex gap-3 py-2.5 [border-bottom:1px_solid_var(--border)] first:pt-0 last:pb-0 last:[border-bottom:0]",
        isMultiLine ? "items-start" : "items-center",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex h-8 w-8 flex-shrink-0 items-center justify-center [border-radius:8px]",
          "[color:var(--accent-cool)] [background:color-mix(in_oklch,var(--accent-cool)_12%,var(--surface-elevated))]",
          // Nudge the icon down slightly so it visually aligns with the label baseline
          // when the value spans multiple lines.
          isMultiLine && "mt-0.5",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <span className="block [font-size:var(--text-caption)] [color:var(--text-muted)]">{label}</span>
        {isMultiLine ? (
          <div className="[font-size:var(--text-body)] [overflow-wrap:anywhere] [color:var(--text-primary)]">
            {lines.map((line, index) => (
              <span key={index} className="block leading-snug">
                {line}
              </span>
            ))}
          </div>
        ) : (
          <span className="block truncate [font-size:var(--text-body)] [color:var(--text-primary)]">{value}</span>
        )}
      </div>
      {trailing}
    </div>
  );
}

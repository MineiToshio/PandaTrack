import type { ReactNode } from "react";

export type ChannelRowProps = {
  /** Leading icon — rendered inside an accent-cool tinted square tile. */
  icon: ReactNode;
  /** Small label above the value (e.g. "Sitio web", "Instagram"). */
  label: string;
  /** Primary value (URL handle, address, email, etc.). */
  value: string;
  /** Optional trailing slot (copy button, external link, action menu). */
  trailing?: ReactNode;
};

/**
 * Generic icon-tile + label + value + trailing-action row.
 * Visual contract aligned with `_notes/demo-screens.html § .channel-row` — used for
 * contact channels, addresses, and similar list-of-key-value-with-icon patterns.
 *
 * Rows stack vertically with a subtle separator between siblings (handled by
 * the row's own `border-bottom` so list containers don't need to draw it).
 */
export default function ChannelRow({ icon, label, value, trailing }: ChannelRowProps) {
  return (
    <div className="flex items-center gap-3 py-2.5 [border-bottom:1px_solid_var(--border)] first:pt-0 last:pb-0 last:[border-bottom:0]">
      <span
        aria-hidden="true"
        className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center [border-radius:8px] [color:var(--accent-cool)] [background:color-mix(in_oklch,var(--accent-cool)_12%,var(--surface-elevated))]"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <span className="block [font-size:var(--text-caption)] [color:var(--text-muted)]">{label}</span>
        <span className="block truncate [font-size:var(--text-body)] [color:var(--text-primary)]">{value}</span>
      </div>
      {trailing}
    </div>
  );
}

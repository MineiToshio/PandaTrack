import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { POSTHOG_EVENTS } from "@/lib/constants";

export type DashboardFxPartialNoticeProps = {
  message: string;
  reconcileLabel: string;
  reconcileHref: string;
};

/** Warning banner shown when FX-unreconciled orders make the money totals partial. */
export default function DashboardFxPartialNotice({
  message,
  reconcileLabel,
  reconcileHref,
}: DashboardFxPartialNoticeProps) {
  return (
    <div
      role="status"
      className="mt-[14px] flex items-start gap-2.5 rounded-[var(--radius-lg)] px-3.5 py-3 [font-size:12.5px] [line-height:1.5] [color:var(--text-primary)]"
      style={{
        background: "color-mix(in oklch, var(--warning) 12%, transparent)",
        border: "1px solid color-mix(in oklch, var(--warning) 28%, transparent)",
      }}
    >
      <AlertTriangle className="mt-px size-4 shrink-0 [color:var(--warning)]" aria-hidden="true" />
      <span>
        {message}{" "}
        <Link
          href={reconcileHref}
          data-ph-event={POSTHOG_EVENTS.DASHBOARD.RECONCILE_CTA_CLICKED}
          className="[font-weight:var(--font-weight-semibold)] whitespace-nowrap [color:var(--accent)] hover:underline"
        >
          {reconcileLabel}
        </Link>
      </span>
    </div>
  );
}

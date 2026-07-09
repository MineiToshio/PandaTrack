import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/styles";

export type DashboardZoneLinkProps = {
  href: string;
  label: string;
  /** Optional PostHog event fired on click (declarative, via the global click listener). */
  posthogEvent?: string;
  posthogProps?: Record<string, unknown>;
  className?: string;
};

/** Small "see more" affordance linking a zone into its owning surface (e.g. orders). */
export default function DashboardZoneLink({
  href,
  label,
  posthogEvent,
  posthogProps,
  className,
}: DashboardZoneLinkProps) {
  return (
    <Link
      href={href}
      data-ph-event={posthogEvent}
      data-ph-props={posthogProps ? JSON.stringify(posthogProps) : undefined}
      className={cn(
        "inline-flex items-center gap-1 underline-offset-4 hover:underline",
        "[font-size:var(--text-caption)] [font-weight:var(--font-weight-medium)] [color:var(--accent)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]",
        className,
      )}
    >
      {label}
      <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
    </Link>
  );
}

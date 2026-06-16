import { Ban } from "lucide-react";
import { getTranslations } from "next-intl/server";

type CancellationReasonCalloutProps = {
  reason: string;
  locale: string;
};

/**
 * Cancellation reason callout. Mirrors demo `.cancel-reason-callout` (CSS lines 2428–2438):
 *  - gap 10px, padding 12px 14px, radius 10px, margin-top 14px
 *  - background: very subtle 5% tint of text-primary (NOT `bg-muted/30` which is too opaque)
 *  - regular border + 3px LEFT accent in `--text-muted` (the visual signature of the callout)
 *  - icon 15px, label 11px / 600 / uppercase / 0.06em, text 13px / 1.45 / text-secondary
 *
 * The accent stripe + subtle bg combo is what distinguishes this from a generic
 * info callout — keep both intact.
 */
export default async function CancellationReasonCallout({ reason, locale }: CancellationReasonCalloutProps) {
  const t = await getTranslations({ locale, namespace: "orders" });
  const label = t("detail.cancellationCallout.label");

  return (
    <div
      role="note"
      aria-label={label}
      className="border-border mt-3.5 flex items-start gap-2.5 rounded-[10px] border py-3 pr-3.5 pl-[11px]"
      style={{
        background: "color-mix(in oklab, var(--text-primary) 5%, transparent)",
        borderLeft: "3px solid var(--text-muted)",
      }}
    >
      <Ban className="text-text-muted mt-0.5 size-[15px] shrink-0" aria-hidden />
      <div className="min-w-0">
        <div className="text-text-muted text-[11px] font-semibold tracking-[0.06em] uppercase">{label}</div>
        <p className="text-text-secondary mt-[3px] text-[13px] leading-[1.45] whitespace-pre-wrap">{reason}</p>
      </div>
    </div>
  );
}

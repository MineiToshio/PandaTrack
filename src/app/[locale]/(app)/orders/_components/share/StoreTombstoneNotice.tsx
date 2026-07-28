"use client";

import { Ban, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import Tooltip from "@/components/core/Tooltip";
import { cn } from "@/lib/styles";
import type { StoreTombstoneTone } from "@/lib/store/storeTombstone";

type StoreTombstoneNoticeProps = {
  /** Neutral by default; sanction only for the abuse removal reason (resolved upstream). */
  tone: StoreTombstoneTone;
  /**
   * `compact` renders a small labeled icon with the full message in a tooltip, for the dense list
   * surfaces. `full` renders an inline line with the message as visible, announceable text, for the
   * order detail hero.
   */
  variant: "compact" | "full";
  className?: string;
};

/** Distinct icons per tone so the state is never conveyed by color alone (ADR 0006). */
const TONE_ICON = { neutral: Ban, sanction: ShieldAlert } as const;

/**
 * Passive tombstone marker shown next to a removed store's name on order surfaces. It accompanies
 * the historical store name (never replaces it) and reuses the store-namespace copy so the order
 * list, order detail, and future delivery/dashboard surfaces stay in lockstep.
 */
export default function StoreTombstoneNotice({ tone, variant, className }: StoreTombstoneNoticeProps) {
  const t = useTranslations("stores");
  const message = t(`orderTombstone.${tone}`);
  const Icon = TONE_ICON[tone];
  const isSanction = tone === "sanction";

  if (variant === "compact") {
    // The icon carries the message as its accessible name (announced to screen readers) and the
    // core Tooltip surfaces the same message on hover/focus for sighted users. `liftAboveCardOverlay`
    // restores pointer events over the full-bleed row/card link.
    return (
      <Tooltip
        content={message}
        liftAboveCardOverlay
        alignSelfInFlexRow="center"
        className={cn("shrink-0", className)}
        triggerClassName={isSanction ? "text-warning" : "text-text-muted"}
      >
        <Icon className="size-3.5" role="img" aria-label={message} />
      </Tooltip>
    );
  }

  return (
    <p
      className={cn(
        "mt-1 inline-flex items-center gap-1.5 text-[13px] leading-snug",
        isSanction ? "text-warning" : "text-text-muted",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

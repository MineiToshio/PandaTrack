"use client";

import { ImageOff } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import EmptyState from "@/components/modules/EmptyState";

export type IntakeQuotaExhaustedProps = {
  /** The bag's size, so the message names the number the collector actually had. */
  limit: number;
  /** ISO instant the bag refills on, formatted here in the reader's own locale. */
  renewalAtIso: string;
  onManualClick: () => void;
};

/**
 * What the upload surface becomes when the bag is empty: an honest statement of what ran out, when
 * it comes back, and the route that is never restricted.
 *
 * It replaces the attach control rather than sitting above it, because an attach control that can
 * only end in a refusal is worse than no attach control at all. The manual method is offered as
 * the primary action, not as a consolation link.
 */
export default function IntakeQuotaExhausted({ limit, renewalAtIso, onManualClick }: IntakeQuotaExhaustedProps) {
  const t = useTranslations("imageIntake.quota");
  const format = useFormatter();
  const renewalDate = format.dateTime(new Date(renewalAtIso), { day: "numeric", month: "long" });

  return (
    <EmptyState
      appearance="card"
      headingAs="h2"
      icon={<ImageOff width={28} height={28} />}
      iconTone="neutral"
      title={t("exhaustedTitle", { limit })}
      subtitle={t("exhausted", { renewalDate })}
      actions={
        <Button type="button" variant="primary" size="md" onClick={onManualClick}>
          {t("exhaustedCta")}
        </Button>
      }
    />
  );
}

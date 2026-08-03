"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import { setImageIntakeQuotaOverrideAction } from "@/app/[locale]/(app)/admin/_actions/setImageIntakeQuotaOverride";
import { OVERRIDE_REASON_MAX_LENGTH } from "@/app/[locale]/(app)/admin/_schemas/imageIntakeQuotaOverrideSchema";
import { useModerationAction } from "../../_hooks/useModerationAction";

export type QuotaOverrideFormProps = {
  targetUserId: string;
  /** Override as stored; empty means the account is on the product default. */
  currentLimit: number | null;
};

/**
 * Sets or clears one account's monthly photo allowance.
 *
 * Two controls and one required reason, because that is the entire decision: how many photos, and
 * why. An empty limit field is the explicit "back to the default" case rather than a separate
 * control, so there is no state where the two disagree.
 */
export default function QuotaOverrideForm({ targetUserId, currentLimit }: QuotaOverrideFormProps) {
  const t = useTranslations("admin.imageIntake");
  const { isPending, run } = useModerationAction();
  const [limitValue, setLimitValue] = useState(currentLimit === null ? "" : String(currentLimit));
  const [reason, setReason] = useState("");
  const [showReasonError, setShowReasonError] = useState(false);

  const limitFieldId = `quota-limit-${targetUserId}`;
  const reasonFieldId = `quota-reason-${targetUserId}`;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedReason = reason.trim();
    if (trimmedReason.length === 0) {
      setShowReasonError(true);
      return;
    }
    setShowReasonError(false);

    const trimmedLimit = limitValue.trim();
    const limit = trimmedLimit.length === 0 ? null : Number.parseInt(trimmedLimit, 10);
    if (limit !== null && !Number.isInteger(limit)) {
      return;
    }

    void run(
      () => setImageIntakeQuotaOverrideAction({ targetUserId, limit, reason: trimmedReason }),
      () => t("toast.overrideSaved"),
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-3)] sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1 sm:w-32">
        <Label htmlFor={limitFieldId}>{t("form.limitLabel")}</Label>
        <Input
          id={limitFieldId}
          type="number"
          inputMode="numeric"
          min={0}
          value={limitValue}
          onChange={(event) => setLimitValue(event.target.value)}
          placeholder={t("form.limitPlaceholder")}
          helperText={t("form.limitHelp")}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Label htmlFor={reasonFieldId}>{t("form.reasonLabel")}</Label>
        <Input
          id={reasonFieldId}
          value={reason}
          maxLength={OVERRIDE_REASON_MAX_LENGTH}
          onChange={(event) => setReason(event.target.value)}
          error={showReasonError ? t("form.reasonRequired") : undefined}
        />
      </div>

      <Button type="submit" variant="primary" size="md" disabled={isPending}>
        {t("form.submit")}
      </Button>
    </form>
  );
}

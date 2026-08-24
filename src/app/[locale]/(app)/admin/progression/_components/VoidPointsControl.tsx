"use client";

import { Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import Button from "@/components/core/Button/Button";
import Label from "@/components/core/Label";
import Textarea from "@/components/core/Textarea";
import Modal from "@/components/modules/Modal/Modal";
import { voidProgressionPointsAction } from "@/app/[locale]/(app)/admin/_actions/voidProgressionPoints";
import { VOID_REASON_MAX_LENGTH } from "@/app/[locale]/(app)/admin/_schemas/voidProgressionPointsSchema";
import { useModerationAction } from "../../_hooks/useModerationAction";

export type VoidPointsControlProps = {
  targetUserId: string;
  /** Username of the collector whose points would be voided, named in the confirmation copy. */
  targetUsername: string;
  /** Live entries the void would reverse. The control disables itself when there are none. */
  liveEntryCount: number;
};

const REASON_FIELD_ID = "void-points-reason";

/**
 * The administrative point void, behind the canonical confirmation modal.
 *
 * Deliberately NOT optimistic, and the documented exception to the repository default: the figures
 * the reversal produces are derived by a server-side recompute, so there is no honest local guess to
 * paint, and the action is irreversible. The modal therefore stays open with a pending primary
 * action until the server answers, and closes only once it has: the shared `useModerationAction`
 * coordinator raises the toast and re-reads the console, so the recomputed summary and the newly
 * voided rows arrive together rather than as a half-updated screen.
 *
 * The copy states that every live entry is covered, because that is exactly what the mutation does.
 * It takes no entry selection and no date range, so offering either here would be a control that
 * lies about its own effect.
 */
export default function VoidPointsControl({ targetUserId, targetUsername, liveEntryCount }: VoidPointsControlProps) {
  const t = useTranslations("admin.progression.void");
  const { isPending, run } = useModerationAction();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [showReasonError, setShowReasonError] = useState(false);

  const hasLiveEntries = liveEntryCount > 0;

  const handleOpen = () => {
    setReason("");
    setShowReasonError(false);
    setIsOpen(true);
  };

  const handleClose = () => {
    if (isPending) return;
    setIsOpen(false);
  };

  const handleConfirm = async () => {
    const trimmedReason = reason.trim();
    if (trimmedReason.length === 0) {
      setShowReasonError(true);
      return;
    }
    setShowReasonError(false);

    await run(
      () => voidProgressionPointsAction({ targetUserId, reason: trimmedReason }),
      (result) => t("toast.voided", { count: result.voidedEntryCount }),
    );
    setIsOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="md"
        onClick={handleOpen}
        disabled={!hasLiveEntries}
        leadingIcon={<Undo2 className="h-4 w-4" aria-hidden />}
      >
        {t("trigger")}
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        role="alertdialog"
        tone="destructive"
        icon={<Undo2 />}
        title={t("title")}
        subtitle={t("subtitle", { username: targetUsername, count: liveEntryCount })}
        dismissible={!isPending}
        primaryAction={{
          label: t("confirm"),
          onClick: () => {
            void handleConfirm();
          },
          variant: "destructive",
          loading: isPending,
          disabled: isPending,
        }}
        secondaryAction={{ label: t("cancel"), onClick: handleClose, disabled: isPending }}
      >
        <div className="flex flex-col gap-[var(--space-3)]">
          <p className="[font-size:var(--text-body)] [color:var(--text-secondary)]">{t("explainer")}</p>

          <div className="flex flex-col gap-1">
            <Label htmlFor={REASON_FIELD_ID}>{t("reasonLabel")}</Label>
            <Textarea
              id={REASON_FIELD_ID}
              value={reason}
              maxLength={VOID_REASON_MAX_LENGTH}
              minRows={3}
              disabled={isPending}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("reasonPlaceholder")}
              helperText={t("reasonHelp")}
              error={showReasonError ? t("reasonRequired") : undefined}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}

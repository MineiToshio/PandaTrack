"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Ban } from "lucide-react";
import Label from "@/components/core/Label";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import Modal from "@/components/modules/Modal/Modal";
import {
  NEUTRAL_STORE_REMOVAL_REASONS,
  SANCTION_STORE_REMOVAL_REASONS,
  type StoreRemovalReasonValue,
} from "@/lib/store/removalReason";
import ReportReasonPicker from "../../_components/share/ReportReasonPicker";

const NOTE_MAX_LENGTH = 500;

type StoreRemovalModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Rendered as the modal subtitle so the admin sees which store they are removing. */
  storeName: string;
  isPending: boolean;
  /** Called with the chosen reason and optional internal note once a reason is selected. */
  onConfirm: (reason: StoreRemovalReasonValue, note: string | null) => void;
};

/**
 * Canonical removal modal (ADR 0008). Two labeled `radiogroup`s share a single selection — the
 * neutral reasons and the single sanction reason — plus an optional internal note that feeds the
 * audit entry. Presentational: it validates that a reason is chosen and delegates the transition to
 * the parent, which owns Optimistic Confirmation (synchronous close + rollback/toast).
 */
export default function StoreRemovalModal({
  isOpen,
  onClose,
  storeName,
  isPending,
  onConfirm,
}: StoreRemovalModalProps) {
  const t = useTranslations("stores.moderation.removeModal");
  const tErrors = useTranslations("stores.moderation.errors");
  // The parent remounts this modal (keyed on its open state) so each open starts with a clean form,
  // avoiding a prop-sync effect.
  const [reason, setReason] = useState<StoreRemovalReasonValue | null>(null);
  const [note, setNote] = useState("");
  const [showReasonError, setShowReasonError] = useState(false);

  const handleReasonChange = (nextValue: string) => {
    setReason(nextValue as StoreRemovalReasonValue);
    setShowReasonError(false);
  };

  const handleConfirm = () => {
    if (reason == null) {
      setShowReasonError(true);
      return;
    }
    onConfirm(reason, note.trim() || null);
  };

  const neutralOptions = NEUTRAL_STORE_REMOVAL_REASONS.map((value) => ({
    value,
    label: t(`reasons.${value}`),
  }));
  const sanctionOptions = SANCTION_STORE_REMOVAL_REASONS.map((value) => ({
    value,
    label: t(`reasons.${value}`),
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("title")}
      subtitle={storeName}
      icon={<Ban size={20} aria-hidden="true" />}
      tone="destructive"
      role="alertdialog"
      closeButtonLabel={t("cancelCta")}
      primaryAction={{
        label: t("confirmCta"),
        onClick: handleConfirm,
        loading: isPending,
        disabled: isPending,
      }}
      secondaryAction={{
        label: t("cancelCta"),
        onClick: onClose,
        disabled: isPending,
      }}
    >
      <div className="space-y-5">
        <Typography size="xs" className="text-text-secondary">
          {t("description")}
        </Typography>

        <div className="space-y-2">
          <Label className="text-text-title">{t("neutralGroupLabel")}</Label>
          <ReportReasonPicker
            value={reason}
            onChange={handleReasonChange}
            options={neutralOptions}
            ariaLabel={t("neutralGroupLabel")}
            name="removalReason"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-text-title">{t("sanctionGroupLabel")}</Label>
          <ReportReasonPicker
            value={reason}
            onChange={handleReasonChange}
            options={sanctionOptions}
            ariaLabel={t("sanctionGroupLabel")}
            name="removalReason"
          />
        </div>

        {showReasonError && (
          <Typography size="xs" className="text-destructive" role="alert">
            {tErrors("removalReasonRequired")}
          </Typography>
        )}

        <div className="space-y-2">
          <Label htmlFor="store-removal-note" className="text-text-title">
            {t("noteLabel")}
          </Label>
          <Typography size="xs" className="text-text-muted">
            {t("noteHelper")}
          </Typography>
          <Textarea
            id="store-removal-note"
            name="note"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={NOTE_MAX_LENGTH}
          />
        </div>
      </div>
    </Modal>
  );
}

"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/modules/Modal";

type DiscrepancyModalProps = {
  isOpen: boolean;
  enteredTotal: number;
  calculatedTotal: number;
  formatAmount: (cents: number) => string;
  onGoBack: () => void;
  onSaveAnyway: () => void;
};

export default function DiscrepancyModal({
  isOpen,
  enteredTotal,
  calculatedTotal,
  formatAmount,
  onGoBack,
  onSaveAnyway,
}: DiscrepancyModalProps) {
  const t = useTranslations("orders.discrepancyModal");
  const entered = formatAmount(enteredTotal);
  const calculated = formatAmount(calculatedTotal);
  const diff = enteredTotal - calculatedTotal;
  const diffSign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  const diffAbs = formatAmount(Math.abs(diff));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onGoBack}
      role="alertdialog"
      tone="warning"
      icon={<AlertTriangle size={20} aria-hidden />}
      title={t("title")}
      subtitle={t("subtitle")}
      primaryAction={{ label: t("saveAnyway"), onClick: onSaveAnyway, variant: "primary" }}
      secondaryAction={{ label: t("goBack"), onClick: onGoBack }}
    >
      <p className="mb-3.5 text-[13px] leading-[1.5] [color:var(--text-secondary)]">
        {t.rich("description", {
          entered,
          calculated,
          strong: (chunks) => <strong className="[color:var(--text-primary)]">{chunks}</strong>,
        })}
      </p>
      <div className="rounded-lg p-3 text-[13px] [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="[color:var(--text-muted)]">{t("tableCalculatedLabel")}</span>
          <span className="num [font-variant-numeric:tabular-nums]">{calculated}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="[color:var(--text-muted)]">{t("tableEnteredLabel")}</span>
          <span className="num font-semibold [font-variant-numeric:tabular-nums]">{entered}</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between pt-2 font-semibold [color:var(--warning)] [border-top:1px_solid_var(--border)]">
          <span>{t("tableDifferenceLabel")}</span>
          <span className="num [font-variant-numeric:tabular-nums]">
            {diffSign}
            {diffAbs}
          </span>
        </div>
      </div>
      <div className="mt-3 rounded-lg px-3 py-2.5 text-[12px] leading-[1.5] [color:var(--text-secondary)] [background:color-mix(in_oklch,var(--info)_6%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--info)_22%,transparent)]">
        <strong className="mb-1 block [color:var(--text-primary)]">{t("whyTitle")}</strong>
        {t("whyBody")}
      </div>
    </Modal>
  );
}

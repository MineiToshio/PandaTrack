"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import Typography from "@/components/core/Typography";
import Button from "@/components/core/Button/Button";

type DiscrepancyModalProps = {
  enteredTotal: number;
  calculatedTotal: number;
  formatAmount: (cents: number) => string;
  onKeepEntered: () => void;
  onUseCalculated: () => void;
  onGoBack: () => void;
};

export default function DiscrepancyModal({
  enteredTotal,
  calculatedTotal,
  formatAmount,
  onKeepEntered,
  onUseCalculated,
  onGoBack,
}: DiscrepancyModalProps) {
  const t = useTranslations("orders.discrepancyModal");
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onGoBack();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onGoBack]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="discrepancy-dialog-title"
      aria-describedby="discrepancy-dialog-desc"
    >
      <button
        type="button"
        className="bg-background/70 absolute inset-0 backdrop-blur-sm"
        onClick={onGoBack}
        aria-hidden
        tabIndex={-1}
      />
      <div className="border-border bg-background relative z-10 w-full max-w-md rounded-xl border p-6 shadow-xl">
        <h2 id="discrepancy-dialog-title" className="text-text-title mb-2 text-base font-semibold">
          {t("title")}
        </h2>
        <Typography id="discrepancy-dialog-desc" size="sm" className="text-text-body mb-6">
          {t("description", {
            entered: formatAmount(enteredTotal),
            calculated: formatAmount(calculatedTotal),
          })}
        </Typography>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" onClick={onKeepEntered} type="button">
            {t("keepEntered")}
          </Button>
          <Button variant="secondary" onClick={onUseCalculated} type="button">
            {t("useCalculated", { amount: formatAmount(calculatedTotal) })}
          </Button>
          <Button ref={cancelRef} variant="ghost" onClick={onGoBack} type="button">
            {t("goBack")}
          </Button>
        </div>
      </div>
    </div>
  );
}

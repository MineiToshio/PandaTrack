"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Scale } from "lucide-react";
import Button from "@/components/core/Button/Button";
import Label from "@/components/core/Label";
import Textarea from "@/components/core/Textarea";
import Modal from "@/components/modules/Modal/Modal";
import { formatAmountSymbolOnly, getCurrencyDecimals, MINOR_UNITS_PER_MAJOR } from "@/lib/currency";
import { parseDecimalToMinorUnits } from "@/lib/money/parseDecimalToMinorUnits";
import {
  buildReconciliationLines,
  canSubmitReconciliation,
  computeReconciliationReadOutMinor,
  hasInvalidRemainingMark,
  markAllSettled,
  type ReconciliationMarks,
} from "@/lib/orders/storeReconciliationSheetState";
import StoreReconciliationOrderList from "./StoreReconciliationOrderList";
import type {
  StoreReconciliationOrderRow,
  StoreReconciliationSubmitInput,
  StoreReconciliationSubmitOutcome,
} from "./StoreReconciliationSheet.types";

export type { StoreReconciliationSubmitInput, StoreReconciliationSubmitOutcome };

export type StoreReconciliationSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  storeName: string;
  currencyCode: string;
  /** The store's own current "Pendiente en pedidos abiertos" figure (`openOrderDebtMinor`,
      `FR-05-61`), the baseline the read-out is computed from. */
  openOrderDebtMinor: number;
  openOrders: StoreReconciliationOrderRow[];
  deliveredOrders: StoreReconciliationOrderRow[];
  /** The store's own parked pool in this currency (`FR-05-69`). While positive the write is
      unreachable and the sheet offers the assignment instead (`ADR 0034` §6). */
  unassignedMinor: number;
  previewLoading: boolean;
  previewError: boolean;
  onRetryPreview: () => void;
  locale: string;
  /** Closes this sheet and opens the store payment sheet, so the collector can assign the parked
      money named above. */
  onGoToAssignPayment: () => void;
  /**
   * Resolves once the coordinator has fired the mutation. Optimistic Confirmation (`ADR 0034`'s own
   * UI Notes, `modal-canonical-pattern.mdc`): this sheet never awaits it before closing, so a
   * refusal is rolled back and toasted by the coordinator, never re-surfaced inside this sheet.
   */
  onSubmit: (input: StoreReconciliationSubmitInput) => Promise<StoreReconciliationSubmitOutcome> | void;
};

function minorUnitsToInputString(minor: number, currencyCode: string): string {
  return (minor / MINOR_UNITS_PER_MAJOR).toFixed(getCurrencyDecimals(currencyCode));
}

/**
 * "Cuadrar cuenta": the reconciliation sheet (WO-11, `ADR 0034`).
 *
 * Three shapes, decided by the preview `getStoreReconciliationPreviewAction` loaded when the sheet
 * opened:
 *
 *  1. **Parked money blocks the form** (`unassignedMinor > 0`, `FR-05-69`, `ADR 0034` §6): the
 *     adjustment form is unreachable behind a message naming the amount, with the existing store
 *     payment sheet offered as the way forward.
 *  2. **Nothing to adjust**: every order is already square and nothing is parked, so the sheet says
 *     so rather than offering a write over nothing.
 *  3. **The form**: two labelled groups the collector marks, a store-level read-out (never an
 *     input), and a required reason. Submitting is Optimistic Confirmation: the sheet closes the
 *     moment the collector confirms, and the parent coordinator owns the rollback and the toast.
 */
export default function StoreReconciliationSheet({
  isOpen,
  onClose,
  storeName,
  currencyCode,
  openOrderDebtMinor,
  openOrders,
  deliveredOrders,
  unassignedMinor,
  previewLoading,
  previewError,
  onRetryPreview,
  locale,
  onGoToAssignPayment,
  onSubmit,
}: StoreReconciliationSheetProps) {
  const t = useTranslations("stores.redesign.detail.reconciliation");

  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");

  const allRows = useMemo(() => [...openOrders, ...deliveredOrders], [openOrders, deliveredOrders]);

  const marks: ReconciliationMarks = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [orderId, raw] of Object.entries(rawInputs)) {
      if (raw.trim() === "") continue;
      const minor = parseDecimalToMinorUnits(raw, currencyCode);
      if (minor != null) result[orderId] = minor;
    }
    return result;
  }, [rawInputs, currencyCode]);

  const lines = useMemo(() => buildReconciliationLines(allRows, marks), [allRows, marks]);
  const readOutMinor = useMemo(
    () => computeReconciliationReadOutMinor(openOrderDebtMinor, openOrders, marks),
    [openOrderDebtMinor, openOrders, marks],
  );
  // `resolveLineAmountMinor` simply drops an out-of-range row from `lines`, so a gate computed only
  // from the surviving lines would submit while one row on screen still shows a red field (`MINOR-7`,
  // WO-11 review): the invalid row vanishes from the declaration instead of blocking it.
  const hasInvalidRow = useMemo(() => hasInvalidRemainingMark(allRows, marks), [allRows, marks]);
  const canSubmit = canSubmitReconciliation(lines, reason) && !hasInvalidRow;
  const hasAnyRow = allRows.length > 0;
  const isBlockedByUnassignedMoney = unassignedMinor > 0;

  const resetState = useCallback(() => {
    setRawInputs({});
    setReason("");
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const handleRemainingChange = useCallback((orderId: string, raw: string) => {
    setRawInputs((prev) => {
      if (raw.trim() === "") {
        const { [orderId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [orderId]: raw };
    });
  }, []);

  const handleMarkSettled = useCallback(
    (orderId: string) => {
      setRawInputs((prev) => ({ ...prev, [orderId]: minorUnitsToInputString(0, currencyCode) }));
    },
    [currencyCode],
  );

  const handleMarkAllSettled = useCallback(() => {
    const allMarks = markAllSettled(allRows);
    setRawInputs(
      Object.fromEntries(Object.keys(allMarks).map((orderId) => [orderId, minorUnitsToInputString(0, currencyCode)])),
    );
  }, [allRows, currencyCode]);

  const handleGoToAssignPayment = useCallback(() => {
    handleClose();
    onGoToAssignPayment();
  }, [handleClose, onGoToAssignPayment]);

  /**
   * Optimistic Confirmation (`modal-canonical-pattern.mdc`): fires the mutation and closes
   * synchronously, without awaiting the server's answer. The parent coordinator
   * (`StoreReconciliationProvider`) owns the optimistic patch, the rollback and the failure toast, so
   * this sheet has nothing left to reconcile once it has closed.
   */
  const handleConfirm = useCallback(() => {
    if (!canSubmit) return;
    void onSubmit({ reason: reason.trim(), lines });
    handleClose();
  }, [canSubmit, handleClose, lines, onSubmit, reason]);

  const readOutLabel = formatAmountSymbolOnly(readOutMinor, currencyCode, locale);
  const unassignedLabel = formatAmountSymbolOnly(unassignedMinor, currencyCode, locale);

  let body: React.ReactNode;
  let primaryAction: { label: string; onClick: () => void; disabled?: boolean } | undefined;

  if (previewLoading) {
    body = (
      <p role="status" className="[font-size:var(--text-body)] [color:var(--text-secondary)]">
        {t("previewLoading")}
      </p>
    );
  } else if (previewError) {
    body = (
      <div className="flex flex-col items-start gap-2">
        <p role="alert" className="[font-size:var(--text-body)] [color:var(--destructive-chip-text)]">
          {t("previewError")}
        </p>
        <Button variant="ghost" size="sm" onClick={onRetryPreview}>
          {t("previewRetry")}
        </Button>
      </div>
    );
  } else if (isBlockedByUnassignedMoney) {
    body = (
      <p role="alert" className="[font-size:var(--text-body)] [color:var(--text-primary)]">
        {t("unassignedMoneyBlocksWrite", { store: storeName, amount: unassignedLabel })}
      </p>
    );
    primaryAction = { label: t("goToAssignPayment"), onClick: handleGoToAssignPayment };
  } else if (!hasAnyRow) {
    body = <p className="[font-size:var(--text-body)] [color:var(--text-secondary)]">{t("nothingToAdjust")}</p>;
  } else {
    body = (
      <div className="flex flex-col gap-4">
        {/* One clarifying line, above the read-out (`MINOR-10`, WO-11 review): a collector reaching
            this sheet from the debt block could otherwise read the write-off as paying the order
            down, when it only settles the STORE's account and leaves each order's own balance as is. */}
        <p className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">
          {t("formClarifier", { store: storeName })}
        </p>
        <div className="flex items-center justify-between gap-3">
          <p className="[font-size:var(--text-body)] font-medium [color:var(--text-primary)]">
            {t("readOut", { amount: readOutLabel })}
          </p>
          <Button variant="ghost" size="sm" onClick={handleMarkAllSettled}>
            {t("markAllSettled")}
          </Button>
        </div>

        <StoreReconciliationOrderList
          openOrders={openOrders}
          deliveredOrders={deliveredOrders}
          rawInputs={rawInputs}
          currencyCode={currencyCode}
          locale={locale}
          disabled={false}
          storeName={storeName}
          onRemainingChange={handleRemainingChange}
          onMarkSettled={handleMarkSettled}
        />

        <div>
          <Label htmlFor="store-reconciliation-reason" required>
            {t("reasonLabel")}
          </Label>
          <Textarea
            id="store-reconciliation-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minRows={2}
            maxRows={4}
          />
        </div>
      </div>
    );
    primaryAction = { label: t("submit"), onClick: handleConfirm, disabled: !canSubmit };
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("title", { store: storeName })}
      subtitle={t("subtitle")}
      icon={<Scale />}
      tone="default"
      size="lg"
      dismissible
      primaryAction={primaryAction}
      secondaryAction={{ label: t("cancel"), onClick: handleClose }}
    >
      {body}
    </Modal>
  );
}

"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { useToast } from "@/contexts/ToastContext";
import { POSTHOG_EVENTS } from "@/lib/constants";
import {
  createStoreAccountAdjustmentAction,
  deleteStoreAccountAdjustmentAction,
  getStoreReconciliationPreviewAction,
} from "@/app/[locale]/(app)/_actions/storeAccountAdjustmentActions";
import type {
  StoreAccountAdjustmentListRow,
  StoreReconciliationPreview,
} from "@/lib/data/orders/storeAccountAdjustmentQueries";
import {
  StoreReconciliationSheet,
  type StoreReconciliationSubmitInput,
  type StoreReconciliationSubmitOutcome,
} from "@/components/modules/StoreReconciliationSheet";
import { sumOpenGroupLinesMinor } from "@/lib/orders/storeReconciliationSheetState";
import { useStorePaymentState } from "./StorePaymentStateProvider";

/** One adjustment history entry, with the currency it belongs to attached (`listStoreAccountAdjustments`
 *  is scoped per currency at read time; the store detail merges every currency's history into one list). */
export type StoreReconciliationAdjustmentRow = StoreAccountAdjustmentListRow & { currencyCode: string };

type StoreReconciliationStateContextValue = {
  /** Every reconciliation adjustment for this store, across every currency, newest first. */
  adjustments: StoreReconciliationAdjustmentRow[];
  /** Opens the "cuadrar cuenta" sheet scoped to one (store, currency) pair. */
  openReconciliationSheet: (currencyCode: string) => void;
  deleteAdjustment: (adjustmentId: string) => Promise<{ ok: boolean; error?: string }>;
};

const StoreReconciliationStateContext = createContext<StoreReconciliationStateContextValue | null>(null);

/** Reads the store's adjustment history and the sheet opener. Throws outside {@link StoreReconciliationProvider}. */
export function useStoreReconciliationState(): StoreReconciliationStateContextValue {
  const value = useContext(StoreReconciliationStateContext);
  if (!value) {
    throw new Error("useStoreReconciliationState must be used within a StoreReconciliationProvider");
  }
  return value;
}

type StoreReconciliationProviderProps = {
  storeId: string;
  storeName: string;
  locale: string;
  adjustments: StoreReconciliationAdjustmentRow[];
  children: ReactNode;
};

/**
 * Inserts an adjustment at its sorted position (newest first, `adjustmentDate` DESC), mirroring
 * `listStoreAccountAdjustments`'s own order so an optimistic add or a rollback re-insert lands where
 * a server refetch would put it.
 */
function insertAdjustmentSortedByDateDesc(
  list: StoreReconciliationAdjustmentRow[],
  adjustment: StoreReconciliationAdjustmentRow,
): StoreReconciliationAdjustmentRow[] {
  const index = list.findIndex((existing) => existing.adjustmentDate.getTime() <= adjustment.adjustmentDate.getTime());
  if (index === -1) return [...list, adjustment];
  return [...list.slice(0, index), adjustment, ...list.slice(index)];
}

/**
 * The id prefix an optimistically added adjustment carries until the server answers with the real
 * one, mirroring `StorePaymentStateProvider`'s own `OPTIMISTIC_PAYMENT_ID_PREFIX` convention.
 * Exported (`MINOR-6`, WO-11 review) so `StoreAccountAdjustmentRow` can disable its own delete
 * control the same way `StorePaymentRow` disables its: a row the server has not answered for yet has
 * no real id to delete by, so a fast collector could otherwise remove it mid-flight and get a
 * NOT_FOUND error toast for an adjustment that WAS in fact recorded.
 */
const OPTIMISTIC_ADJUSTMENT_ID_PREFIX = "temp-adjustment-";

function buildOptimisticAdjustmentId(now: number): string {
  return `${OPTIMISTIC_ADJUSTMENT_ID_PREFIX}${now}`;
}

/** True while a row is a local stand-in with no server row behind it yet. */
export function isOptimisticAdjustmentId(adjustmentId: string): boolean {
  return adjustmentId.startsWith(OPTIMISTIC_ADJUSTMENT_ID_PREFIX);
}

/**
 * Sibling of `StorePaymentStateProvider`, deliberately not an extension of it (WO-11): the
 * reconciliation write shares no allocation arithmetic with a payment (`ADR 0034` §2), so it owns its
 * own state instead of widening a coordinator built for a different mutation shape.
 *
 * Must be mounted INSIDE `StorePaymentStateProvider` (see `StoreDetailContent`): the sheet reads that
 * provider's live `storeDebtByCurrency` for the read-out baseline and the parked-money block, and the
 * "assign this instead" hand-off calls that provider's own `openPaymentSheet`.
 *
 * **Optimistic money figures (`FIX 1`, WO-11 review — previously a documented gap, now closed).** A
 * create or delete moves the sidebar's `openOrderDebtMinor` and lifetime `debtMinor` the INSTANT it
 * happens on screen, via `StorePaymentStateProvider.applyAdjustmentDeltas`: that provider owns the
 * ONLY `storeDebtByCurrency` state this page renders (by design, it is not this work order's file to
 * widen), so it exposes a setter this provider calls rather than reaching into its state directly.
 * `openGroupWriteOffMinor` (the slice of the declaration against OPEN orders, computed with
 * `sumOpenGroupLinesMinor` against the preview's own `openOrders`) moves `openOrderDebtMinor`;
 * `totalWriteOffMinor` (every line, open or delivered) moves `debtMinor`. Both are negated for a
 * rollback (an optimistic create's own failure) or applied negated up front (an optimistic delete,
 * restoring the money the deleted write-off had taken off), so the same two-field patch covers every
 * direction. `router.refresh()` still runs on success, but now only for the ONE figure that stays out
 * of scope here: the dashboard's own `unrecordedPaymentsMinor` diagnostic for a delivered order
 * (`FRD-06 · WO-07`), which this provider does not track locally at all. The adjustment history block
 * owned here, and the "cuadrar cuenta" sheet's own read-out (which reads the now-optimistic
 * `openOrderDebtMinor` straight from `StorePaymentStateProvider`), are fully optimistic too.
 */
export default function StoreReconciliationProvider({
  storeId,
  storeName,
  locale,
  adjustments: initialAdjustments,
  children,
}: StoreReconciliationProviderProps) {
  const router = useRouter();
  const t = useTranslations("stores.redesign.detail.reconciliation");
  const { addToast } = useToast();
  const { storeDebtByCurrency, openPaymentSheet, applyAdjustmentDeltas } = useStorePaymentState();

  const [adjustments, setAdjustments] = useState<StoreReconciliationAdjustmentRow[]>(initialAdjustments);
  const [openCurrencyCode, setOpenCurrencyCode] = useState<string | null>(null);
  const [preview, setPreview] = useState<StoreReconciliationPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const loadPreview = useCallback(
    (currencyCode: string) => {
      setPreviewLoading(true);
      setPreviewError(false);
      getStoreReconciliationPreviewAction(storeId, currencyCode).then(
        (result) => {
          setPreviewLoading(false);
          if (!result.ok) {
            setPreviewError(true);
            return;
          }
          setPreview(result.preview);
        },
        () => {
          setPreviewLoading(false);
          setPreviewError(true);
        },
      );
    },
    [storeId],
  );

  const openReconciliationSheet = useCallback(
    (currencyCode: string) => {
      posthog.capture(POSTHOG_EVENTS.STORE.RECONCILIATION_SHEET_OPENED, {
        store_id: storeId,
        currency_code: currencyCode,
      });
      setOpenCurrencyCode(currencyCode);
      setPreview(null);
      loadPreview(currencyCode);
    },
    [loadPreview, storeId],
  );

  const closeReconciliationSheet = useCallback(() => setOpenCurrencyCode(null), []);
  const retryPreview = useCallback(() => {
    if (openCurrencyCode) loadPreview(openCurrencyCode);
  }, [loadPreview, openCurrencyCode]);

  const handleGoToAssignPayment = useCallback(() => {
    openPaymentSheet();
  }, [openPaymentSheet]);

  const handleSubmitAdjustment = useCallback(
    async (input: StoreReconciliationSubmitInput): Promise<StoreReconciliationSubmitOutcome> => {
      const currencyCode = openCurrencyCode;
      if (!currencyCode) return { ok: false, error: "server_error" };

      const openOrderIds = new Set((preview?.openOrders ?? []).map((row) => row.orderId));
      const rowsById = new Map(
        [...(preview?.openOrders ?? []), ...(preview?.deliveredOrders ?? [])].map((row) => [row.orderId, row]),
      );
      const tempId = buildOptimisticAdjustmentId(Date.now());
      const optimisticAdjustment: StoreReconciliationAdjustmentRow = {
        id: tempId,
        adjustmentDate: new Date(),
        reason: input.reason,
        magnitudeMinor: input.lines.reduce((sum, line) => sum + line.amountMinor, 0),
        currencyCode,
        lines: input.lines.map((line) => ({
          orderId: line.orderId,
          amountMinor: line.amountMinor,
          orderDate: rowsById.get(line.orderId)?.orderDate ?? new Date(),
          orderHumanReadableId: rowsById.get(line.orderId)?.humanReadableId ?? line.orderId,
          orderActive: openOrderIds.has(line.orderId),
        })),
      };
      setAdjustments((prev) => insertAdjustmentSortedByDateDesc(prev, optimisticAdjustment));

      // FIX 1 (WO-11 review): the two deltas this write-off moves. `openGroupWriteOffMinor` is the
      // slice against OPEN orders (moves `openOrderDebtMinor`); `totalWriteOffMinor` is every line,
      // open or delivered (moves the lifetime `debtMinor` ceiling, `ADR 0034` §1 — the ceiling
      // subtracts ALL lines, not only the ones the headline currently counts).
      const openGroupWriteOffMinor = sumOpenGroupLinesMinor(input.lines, openOrderIds);
      const totalWriteOffMinor = optimisticAdjustment.magnitudeMinor;
      applyAdjustmentDeltas({ currencyCode, openGroupWriteOffMinor, totalWriteOffMinor });

      const rollback = () => {
        setAdjustments((prev) => prev.filter((adjustment) => adjustment.id !== tempId));
        // Negated: the same two-field patch adds the money back, undoing the optimistic write-off.
        applyAdjustmentDeltas({
          currencyCode,
          openGroupWriteOffMinor: -openGroupWriteOffMinor,
          totalWriteOffMinor: -totalWriteOffMinor,
        });
      };

      let result: Awaited<ReturnType<typeof createStoreAccountAdjustmentAction>>;
      try {
        result = await createStoreAccountAdjustmentAction({
          storeId,
          currencyCode,
          reason: input.reason,
          lines: input.lines,
        });
      } catch {
        rollback();
        addToast(t("error.server_error"), { variant: "error" });
        return { ok: false, error: "server_error", unanswered: true };
      }

      if (!result.ok) {
        rollback();
        const key = `error.${result.error}` as const;
        addToast(t.has(key as never) ? t(key as never) : t("error.server_error"), { variant: "error" });
        return { ok: false, error: result.error, orderId: result.orderId };
      }

      // Reconcile the temp id with the server's own. The debt figures are already correct from the
      // optimistic patch above (the server accepts exactly the lines it was sent, or refuses the
      // whole declaration per ADR 0022 — there is no server-recomputed drift to reconcile here the
      // way a payment's `orderActive` race needs). `router.refresh()` still runs for the one figure
      // this provider does not track locally at all (see this component's own doc).
      setAdjustments((prev) =>
        prev.map((adjustment) => (adjustment.id === tempId ? { ...adjustment, id: result.adjustmentId } : adjustment)),
      );
      router.refresh();
      return { ok: true };
    },
    [addToast, applyAdjustmentDeltas, openCurrencyCode, preview, router, storeId, t],
  );

  const deleteAdjustment = useCallback(
    async (adjustmentId: string): Promise<{ ok: boolean; error?: string }> => {
      const target = adjustments.find((adjustment) => adjustment.id === adjustmentId);
      if (!target) return { ok: false, error: "NOT_FOUND" };

      // FIX 1 (WO-11 review): the deleted adjustment's own two deltas, read straight off its
      // `lines` (each already carries `orderActive`, `listStoreAccountAdjustments`'s own read) —
      // no second query needed. Deleting an adjustment REMOVES a write-off, so it restores money to
      // both figures: the opposite direction of a create, hence the deltas are negated below rather
      // than a second, differently-signed code path.
      const openGroupWriteOffMinor = target.lines
        .filter((line) => line.orderActive)
        .reduce((sum, line) => sum + line.amountMinor, 0);
      const totalWriteOffMinor = target.lines.reduce((sum, line) => sum + line.amountMinor, 0);

      setAdjustments((prev) => prev.filter((adjustment) => adjustment.id !== adjustmentId));
      applyAdjustmentDeltas({
        currencyCode: target.currencyCode,
        openGroupWriteOffMinor: -openGroupWriteOffMinor,
        totalWriteOffMinor: -totalWriteOffMinor,
      });

      let result: { ok: boolean; error?: string };
      try {
        result = await deleteStoreAccountAdjustmentAction(adjustmentId);
      } catch {
        result = { ok: false, error: "server_error" };
      }

      if (!result.ok) {
        setAdjustments((prev) => insertAdjustmentSortedByDateDesc(prev, target));
        applyAdjustmentDeltas({ currencyCode: target.currencyCode, openGroupWriteOffMinor, totalWriteOffMinor });
        // A toast, not only the row's own inline message (`MINOR-6`, WO-11 review): the row that
        // failed is the one the collector was just looking at, but the FIRST thing they see once the
        // modal closes on the optimistic removal is the list, not that row's own confirm dialog. The
        // toast is what carries the failure there, exactly as a payment delete's own failure does.
        const key = `error.${result.error}` as const;
        addToast(t.has(key as never) ? t(key as never) : t("error.server_error"), { variant: "error" });
        return result;
      }

      router.refresh();
      return { ok: true };
    },
    [addToast, adjustments, applyAdjustmentDeltas, router, t],
  );

  const value = useMemo<StoreReconciliationStateContextValue>(
    () => ({ adjustments, openReconciliationSheet, deleteAdjustment }),
    [adjustments, openReconciliationSheet, deleteAdjustment],
  );

  const debtForOpenCurrency = openCurrencyCode
    ? storeDebtByCurrency.find((debt) => debt.currencyCode === openCurrencyCode)
    : undefined;

  return (
    <StoreReconciliationStateContext.Provider value={value}>
      {children}
      <StoreReconciliationSheet
        isOpen={openCurrencyCode != null}
        onClose={closeReconciliationSheet}
        storeId={storeId}
        storeName={storeName}
        currencyCode={openCurrencyCode ?? ""}
        openOrderDebtMinor={debtForOpenCurrency?.openOrderDebtMinor ?? 0}
        openOrders={preview?.openOrders ?? []}
        deliveredOrders={preview?.deliveredOrders ?? []}
        unassignedMinor={preview?.unassignedMinor ?? 0}
        previewLoading={previewLoading}
        previewError={previewError}
        onRetryPreview={retryPreview}
        locale={locale}
        onGoToAssignPayment={handleGoToAssignPayment}
        onSubmit={handleSubmitAdjustment}
      />
    </StoreReconciliationStateContext.Provider>
  );
}

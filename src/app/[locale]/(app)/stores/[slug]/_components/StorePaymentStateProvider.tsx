"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/contexts/ToastContext";
import { createStorePaymentAction, deleteStorePaymentAction } from "@/app/[locale]/(app)/_actions/storePaymentActions";
import type { StoreDebtRow, StorePaymentListRow } from "@/lib/data/orders/storePaymentQueries";
import {
  StorePaymentSheet,
  useStorePaymentSheetOrders,
  type StorePaymentSheetSubmitInput,
} from "@/components/modules/StorePaymentSheet";

type StorePaymentStateContextValue = {
  storeDebtByCurrency: StoreDebtRow[];
  openPaymentSheet: () => void;
  /** Every payment to this store, for the "Pagos a esta tienda" card. See `StorePaymentsSection`. */
  storePayments: StorePaymentListRow[];
  /** True total behind `storePayments`, independent of the query's display cap. */
  storePaymentsTotalCount: number;
  deleteStorePayment: (paymentId: string) => Promise<{ ok: boolean; error?: string }>;
};

const StorePaymentStateContext = createContext<StorePaymentStateContextValue | null>(null);

/** Reads the store detail's live debt figure and the sheet opener. Throws outside {@link StorePaymentStateProvider}. */
export function useStorePaymentState(): StorePaymentStateContextValue {
  const value = useContext(StorePaymentStateContext);
  if (!value) {
    throw new Error("useStorePaymentState must be used within a StorePaymentStateProvider");
  }
  return value;
}

type StorePaymentStateProviderProps = {
  storeId: string;
  storeName: string;
  storeDebtByCurrency: StoreDebtRow[];
  storePayments: StorePaymentListRow[];
  storePaymentsTotalCount: number;
  locale: string;
  children: ReactNode;
};

/**
 * Holds the store detail's live debt-by-currency state so the sidebar's "Debes" rows and the
 * "Registrar pago" action share one number, and renders the store payment sheet itself. Also owns
 * the "Pagos a esta tienda" list (`StorePaymentsSection`) so deleting a payment there updates the
 * same debt figure the sheet and sidebar read. Mirrors `StoreReportNoticeProvider`'s shape (§ store
 * detail cross-slot state).
 *
 * On success this patches only the debt figure and the payments list — nothing else server-rendered
 * on this page (order counts, spend totals, reviews, governance) is derived from payment state, so a
 * `router.refresh()` would cost a round trip to redraw content that has not changed. The orders list
 * and order detail pages, which DO show payment-derived figures, are covered separately by
 * `revalidateCollectionSurfaces` inside the store payment actions and pick up the change on their
 * own next visit.
 */
export default function StorePaymentStateProvider({
  storeId,
  storeName,
  storeDebtByCurrency,
  storePayments,
  storePaymentsTotalCount,
  locale,
  children,
}: StorePaymentStateProviderProps) {
  const tPayment = useTranslations("orders.detail.storePayment");
  const { addToast } = useToast();
  const [debts, setDebts] = useState<StoreDebtRow[]>(storeDebtByCurrency);
  const [payments, setPayments] = useState<StorePaymentListRow[]>(storePayments);
  const [paymentsTotalCount, setPaymentsTotalCount] = useState(storePaymentsTotalCount);
  const sheet = useStorePaymentSheetOrders();

  const openPaymentSheet = useCallback(() => sheet.open(storeId, "store_detail"), [sheet, storeId]);

  const handleSubmitPayment = useCallback(
    (input: StorePaymentSheetSubmitInput) => {
      const previous = debts;
      setDebts((prev) =>
        prev.map((debt) =>
          debt.currencyCode === input.currencyCode ? { ...debt, debtMinor: debt.debtMinor - input.amount } : debt,
        ),
      );

      void createStorePaymentAction({
        storeId,
        amount: input.amount,
        paymentDate: input.paymentDate,
        currencyCode: input.currencyCode,
        note: input.note,
        allocations: input.allocations,
      }).then((result) => {
        if (!result.ok) {
          setDebts(previous);
          const key = `error.${result.error}` as const;
          addToast(tPayment.has(key as never) ? tPayment(key as never) : tPayment("error.server_error"), {
            variant: "error",
          });
          return;
        }
        addToast(tPayment("toastSuccess"), { variant: "success" });
      });
    },
    [addToast, debts, storeId, tPayment],
  );

  const handleDeleteStorePayment = useCallback(
    async (paymentId: string): Promise<{ ok: boolean; error?: string }> => {
      const target = payments.find((payment) => payment.id === paymentId);
      if (!target) return { ok: false, error: "NOT_FOUND" };

      const previousPayments = payments;
      const previousTotalCount = paymentsTotalCount;
      const previousDebts = debts;

      // Optimistic patch: the row disappears and the debt grows back by the payment's amount (the
      // money is no longer counted as paid) in parallel with the server call.
      setPayments((prev) => prev.filter((payment) => payment.id !== paymentId));
      setPaymentsTotalCount((prev) => Math.max(0, prev - 1));
      setDebts((prev) =>
        prev.map((debt) =>
          debt.currencyCode === target.currencyCode ? { ...debt, debtMinor: debt.debtMinor + target.amount } : debt,
        ),
      );

      const result = await deleteStorePaymentAction(paymentId);
      if (!result.ok) {
        setPayments(previousPayments);
        setPaymentsTotalCount(previousTotalCount);
        setDebts(previousDebts);
        return result;
      }
      return { ok: true };
    },
    [debts, payments, paymentsTotalCount],
  );

  const value = useMemo<StorePaymentStateContextValue>(
    () => ({
      storeDebtByCurrency: debts,
      openPaymentSheet,
      storePayments: payments,
      storePaymentsTotalCount: paymentsTotalCount,
      deleteStorePayment: handleDeleteStorePayment,
    }),
    [debts, openPaymentSheet, payments, paymentsTotalCount, handleDeleteStorePayment],
  );

  return (
    <StorePaymentStateContext.Provider value={value}>
      {children}
      <StorePaymentSheet
        isOpen={sheet.isOpen}
        onClose={sheet.close}
        storeName={storeName}
        debts={debts}
        orders={sheet.orders}
        ordersLoading={sheet.isLoading}
        locale={locale}
        onSubmit={handleSubmitPayment}
      />
    </StorePaymentStateContext.Provider>
  );
}

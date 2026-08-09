"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/contexts/ToastContext";
import { createStorePaymentAction } from "@/app/[locale]/(app)/_actions/storePaymentActions";
import type { StoreDebtRow } from "@/lib/data/orders/storePaymentQueries";
import {
  StorePaymentSheet,
  useStorePaymentSheetOrders,
  type StorePaymentSheetSubmitInput,
} from "@/components/modules/StorePaymentSheet";

type StorePaymentStateContextValue = {
  storeDebtByCurrency: StoreDebtRow[];
  openPaymentSheet: () => void;
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
  locale: string;
  children: ReactNode;
};

/**
 * Holds the store detail's live debt-by-currency state so the sidebar's "Debes" rows and the
 * "Registrar pago" action share one number, and renders the store payment sheet itself. Mirrors
 * `StoreReportNoticeProvider`'s shape (§ store detail cross-slot state).
 *
 * On success this patches only the debt figure — nothing else server-rendered on this page (order
 * counts, spend totals, reviews, governance) is derived from payment state, so a `router.refresh()`
 * would cost a round trip to redraw content that has not changed. The orders list and order detail
 * pages, which DO show payment-derived figures, are covered separately by `revalidateCollectionSurfaces`
 * inside `createStorePaymentAction` and pick up the change on their own next visit.
 */
export default function StorePaymentStateProvider({
  storeId,
  storeName,
  storeDebtByCurrency,
  locale,
  children,
}: StorePaymentStateProviderProps) {
  const tPayment = useTranslations("orders.detail.storePayment");
  const { addToast } = useToast();
  const [debts, setDebts] = useState<StoreDebtRow[]>(storeDebtByCurrency);
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

  const value = useMemo<StorePaymentStateContextValue>(
    () => ({ storeDebtByCurrency: debts, openPaymentSheet }),
    [debts, openPaymentSheet],
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

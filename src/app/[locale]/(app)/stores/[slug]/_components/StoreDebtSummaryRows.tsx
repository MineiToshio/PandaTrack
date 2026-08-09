"use client";

import { useTranslations } from "next-intl";
import SummaryStatRow from "@/components/modules/SummaryStatRow";
import { formatAmount } from "@/lib/currency";
import { useStorePaymentState } from "./StorePaymentStateProvider";

/** The sidebar's "Debes" rows, one per currency, reading the live (optimistically patched) debt. */
export default function StoreDebtSummaryRows() {
  const tStores = useTranslations("stores");
  const { storeDebtByCurrency } = useStorePaymentState();

  return (
    <>
      {storeDebtByCurrency.map((debt) => (
        <SummaryStatRow
          key={debt.currencyCode}
          label={tStores("redesign.detail.aside.debtLabel")}
          value={
            debt.debtMinor < 0 ? (
              <span className="text-success">
                {tStores("redesign.detail.aside.debtCredit", {
                  amount: formatAmount(Math.abs(debt.debtMinor), debt.currencyCode),
                })}
              </span>
            ) : (
              formatAmount(debt.debtMinor, debt.currencyCode)
            )
          }
        />
      ))}
    </>
  );
}

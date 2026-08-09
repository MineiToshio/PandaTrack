"use client";

import { CircleDollarSign } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import Tooltip from "@/components/core/Tooltip";
import { useStorePaymentState } from "./StorePaymentStateProvider";

/**
 * The sidebar's "Registrar pago" action. Disabled unless the viewer actually owes this store money
 * in at least one currency — a debt row with `debtMinor <= 0` (nothing owed, or a credit) still has
 * nothing to register a NEW payment against.
 */
export default function StoreRegisterPaymentButton() {
  const tStores = useTranslations("stores");
  const { storeDebtByCurrency, openPaymentSheet } = useStorePaymentState();
  const canRegisterPayment = storeDebtByCurrency.some((debt) => debt.debtMinor > 0);

  const button = (
    <Button
      type="button"
      variant="ghost"
      leadingIcon={<CircleDollarSign size={16} aria-hidden="true" />}
      fullWidth
      disabled={!canRegisterPayment}
      onClick={canRegisterPayment ? openPaymentSheet : undefined}
      className="justify-start"
    >
      {tStores("redesign.detail.actions.registerPayment")}
    </Button>
  );

  if (canRegisterPayment) return button;

  return (
    <Tooltip
      content={tStores("redesign.detail.actions.registerPaymentHint")}
      asDiv
      className="w-full"
      triggerClassName="w-full"
    >
      {button}
    </Tooltip>
  );
}

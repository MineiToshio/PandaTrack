"use client";

import DeliveryCreateWizard, { type DeliveryCreateWizardProps } from "./DeliveryCreateWizard";
import DeliveryEditForm, { type DeliveryEditFormProps } from "./DeliveryEditForm";

export type DeliveryFormProps =
  | ({ mode: "create" } & DeliveryCreateWizardProps)
  | ({ mode: "edit" } & DeliveryEditFormProps);

/**
 * Mode dispatcher for the delivery form (OrderForm parity): create renders the
 * 4-step wizard, edit renders the always-open section cards.
 */
export default function DeliveryForm(props: DeliveryFormProps) {
  if (props.mode === "create") {
    return (
      <DeliveryCreateWizard
        action={props.action}
        stores={props.stores}
        productsByStore={props.productsByStore}
        baseCurrencyCode={props.baseCurrencyCode}
        sourceOrder={props.sourceOrder}
      />
    );
  }
  return (
    <DeliveryEditForm
      action={props.action}
      initialDelivery={props.initialDelivery}
      products={props.products}
      baseCurrencyCode={props.baseCurrencyCode}
    />
  );
}

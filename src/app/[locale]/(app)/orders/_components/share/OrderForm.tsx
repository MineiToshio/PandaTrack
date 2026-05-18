"use client";

import type { OrderActionResult } from "../../_actions/orderActions";
import OrderCreateForm from "./OrderCreateForm";
import OrderEditForm, { type InitialOrderData } from "./OrderEditForm";

type StoreOption = { id: string; name: string; countryCode: string };

export type OrderFormProps =
  | {
      mode: "create";
      stores: StoreOption[];
      productTypeKeys: string[];
      baseCurrencyCode: string | null;
      action: (prev: OrderActionResult | null, formData: FormData) => Promise<OrderActionResult>;
      initialOrder?: never;
    }
  | {
      mode: "edit";
      stores: StoreOption[];
      productTypeKeys: string[];
      baseCurrencyCode: string | null;
      action: (prev: OrderActionResult | null, formData: FormData) => Promise<OrderActionResult>;
      initialOrder: InitialOrderData;
    };

export default function OrderForm(props: OrderFormProps) {
  if (props.mode === "create") {
    return (
      <OrderCreateForm
        stores={props.stores}
        productTypeKeys={props.productTypeKeys}
        baseCurrencyCode={props.baseCurrencyCode}
        action={props.action}
      />
    );
  }
  return (
    <OrderEditForm
      stores={props.stores}
      productTypeKeys={props.productTypeKeys}
      baseCurrencyCode={props.baseCurrencyCode}
      action={props.action}
      initialOrder={props.initialOrder}
    />
  );
}

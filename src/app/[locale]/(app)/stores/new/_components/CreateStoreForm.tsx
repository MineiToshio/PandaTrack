"use client";

import StoreForm from "../../_components/share/StoreForm/StoreForm";
import { createStore } from "../_actions/createStore";

export type CreateStoreFormProps = {
  countries: { code: string }[];
  productTypes: { key: string }[];
  returnTo?: string;
};

export default function CreateStoreForm({ countries, productTypes, returnTo }: CreateStoreFormProps) {
  return (
    <StoreForm
      countries={countries}
      productTypes={productTypes}
      mode={{ kind: "create", returnTo: returnTo ?? null }}
      submit={createStore}
    />
  );
}

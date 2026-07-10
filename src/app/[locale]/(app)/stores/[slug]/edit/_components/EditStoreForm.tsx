"use client";

import type { EditableStore, EditableStoreInput, StoreGovernanceViewerContext } from "@/lib/data/stores/storeGovernanceQueries";
import StoreForm, { type StoreFormMode } from "../../../_components/share/StoreForm/StoreForm";
import { saveStoreEdit } from "../_actions/saveStoreEdit";

type EditStoreFormProps = {
  /** Provided by the page; the shared form derives locale via next-intl. */
  locale: string;
  store: EditableStore;
  countries: { code: string }[];
  productTypes: { key: string }[];
  initialValues: EditableStoreInput;
  canDirectlyEdit: boolean;
  existingChangeRequest: StoreGovernanceViewerContext["openChangeRequest"];
};

export default function EditStoreForm({
  store,
  countries,
  productTypes,
  initialValues,
  canDirectlyEdit,
  existingChangeRequest,
}: EditStoreFormProps) {
  const mode: StoreFormMode = canDirectlyEdit
    ? { kind: "directEdit", store, initialValues }
    : { kind: "changeRequest", store, initialValues, existingChangeRequest };

  return <StoreForm countries={countries} productTypes={productTypes} mode={mode} submit={saveStoreEdit} />;
}

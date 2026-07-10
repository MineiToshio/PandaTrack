import type { ReactNode } from "react";
import type { EditableStore, EditableStoreInput, StoreGovernanceViewerContext } from "@/queries/storeGovernance";
import type { StoreContactChannelType } from "../StoreContactChannelList";

/**
 * Generic shape that matches both `CreateStoreResult` (success/failure) and
 * `SaveStoreEditResult` (failure-only). The form only needs to read
 * `success`, `error`, `fieldErrors`, and (for create) `slug`/`storeId`.
 */
export type StoreFormSubmitResult =
  | {
      success: true;
      storeId?: string;
      slug?: string;
      // Allow extra optional fields that the create flow returns.
      [key: string]: unknown;
    }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Submit signature accepted by the form. Declared as a method-shorthand type (the
 * standard TypeScript "bivariance hack") so both `createStore` (`prev: CreateStoreResult
 * | null`) and `saveStoreEdit` (`prev: SaveStoreEditResult | null`) remain assignable,
 * even though their `prev` parameter is narrower than the `StoreFormSubmitResult | null`
 * union the form threads through `useActionState`. The form never reads back the prev
 * value inside the submit callback (it is the server action's own previous state), so
 * the looser parameter check is safe here.
 */
export type StoreFormSubmit = {
  submit(prev: StoreFormSubmitResult | null, formData: FormData): Promise<StoreFormSubmitResult>;
}["submit"];

export type EditableStoreFormValues = EditableStoreInput;

export type StoreFormMode =
  | { kind: "create"; returnTo?: string | null }
  | { kind: "directEdit"; store: EditableStore; initialValues: EditableStoreFormValues }
  | {
      kind: "changeRequest";
      store: EditableStore;
      initialValues: EditableStoreFormValues;
      existingChangeRequest?: StoreGovernanceViewerContext["openChangeRequest"];
    };

export type StoreFormProps = {
  countries: { code: string }[];
  productTypes: { key: string }[];
  mode: StoreFormMode;
  submit: StoreFormSubmit;
};

export type StoreTypeValue = "BUSINESS" | "PERSON";

export type StorePresenceType = "ONLINE" | "PHYSICAL";

export type StoreFormFieldErrors = Record<string, string[]>;

export type StoreContactChannelEntry = { id: number; type: StoreContactChannelType; value: string };

export type StoreAddressEntry = { id: number; city: string; addressLine: string; reference: string };

export type StoreCountryOption = {
  value: string;
  label: string;
  leadingDecoration: ReactNode;
};

/** Current form values consumed by the review step and the desktop aside. */
export type StoreFormValuesSnapshot = {
  storeType: StoreTypeValue;
  isPrivate: boolean;
  name: string;
  countryCode: string;
  productTypeKeys: string[];
  presenceTypes: StorePresenceType[];
  importCountries: string[];
  contactChannels: StoreContactChannelEntry[];
  addresses: StoreAddressEntry[];
};

/** Initial values the desktop aside compares against to flag changed rows in edit modes. */
export type StoreFormInitialSnapshot = {
  name: string;
  countryCode: string;
  productTypeKeys: string[];
  contactChannelCount: number;
  addressCount: number;
};

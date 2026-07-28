/**
 * Client-side validation helpers for the shared store form (create/edit).
 *
 * Step validators are pure: they receive the current values and return the
 * step's field errors keyed by field name, with the matching
 * `stores.validation` translation key as the value.
 */

export type StoreFormClientErrors = Record<string, string>;

const COUNTRY_CODE_LENGTH = 2;

export const IDENTITY_STEP_FIELDS = ["name", "countryCode"];
export const CATALOG_STEP_FIELDS = ["productTypeKeys", "presenceTypes"];
export const CHANNELS_STEP_FIELDS = ["channelFormOpen", "addressFormOpen"];

export function validateIdentityStep(values: {
  name: string;
  countryCode: string;
  requireCountry: boolean;
}): StoreFormClientErrors {
  const errors: StoreFormClientErrors = {};
  if (!values.name.trim()) errors.name = "nameRequired";
  if (values.requireCountry && values.countryCode.length !== COUNTRY_CODE_LENGTH) {
    errors.countryCode = "countryInvalid";
  }
  return errors;
}

export function validateCatalogStep(values: {
  productTypeKeys: string[];
  presenceTypes: string[];
  /** PROXY sellers have no catalog, so at least one product type is not required for them. Defaults to true. */
  requireProductTypes?: boolean;
}): StoreFormClientErrors {
  const errors: StoreFormClientErrors = {};
  if ((values.requireProductTypes ?? true) && values.productTypeKeys.length === 0) {
    errors.productTypeKeys = "productTypeRequired";
  }
  if (values.presenceTypes.length === 0) errors.presenceTypes = "presenceRequired";
  return errors;
}

export function validateChannelsStep(values: {
  isChannelFormOpen: boolean;
  isAddressFormOpen: boolean;
}): StoreFormClientErrors {
  const errors: StoreFormClientErrors = {};
  if (values.isChannelFormOpen) errors.channelFormOpen = "channelFormOpen";
  if (values.isAddressFormOpen) errors.addressFormOpen = "addressFormOpen";
  return errors;
}

/**
 * Replaces a step's previous errors with its freshly computed ones while
 * preserving the errors owned by other steps.
 */
export function mergeStepClientErrors(
  previous: StoreFormClientErrors,
  stepFields: string[],
  stepErrors: StoreFormClientErrors,
): StoreFormClientErrors {
  const preserved = Object.fromEntries(Object.entries(previous).filter(([key]) => !stepFields.includes(key)));
  return { ...preserved, ...stepErrors };
}

/**
 * Maps a server `fieldErrors` key to the form element that should receive
 * focus and be scrolled into view after a failed submit.
 */
export function resolveFirstErrorElement(form: HTMLFormElement, fieldKey: string): HTMLElement | null {
  if (fieldKey === "name") return form.querySelector("#store-name");
  if (fieldKey === "description") return form.querySelector("#store-description");
  if (fieldKey === "logo") return form.querySelector('[data-field="logo"] button, [data-field="logo"] input');
  if (fieldKey === "countryCode") return form.querySelector("#store-country");
  if (fieldKey === "presenceTypes") return form.querySelector('[data-field="presenceTypes"] button');
  if (fieldKey === "productTypeKeys") return form.querySelector('[data-field="productTypeKeys"] button');
  if (fieldKey === "importCountries") return form.querySelector("#import-countries-input");

  if (fieldKey.startsWith("contactChannels.")) {
    const [, indexRaw, property] = fieldKey.split(".");
    const index = Number(indexRaw);
    if (!Number.isInteger(index)) return form.querySelector('[name="contactChannelValue"]');

    if (property === "type") {
      const typeElements = form.querySelectorAll('[name="contactChannelType"]');
      return (typeElements[index] as HTMLElement | undefined) ?? null;
    }

    const valueElements = form.querySelectorAll('[name="contactChannelValue"]');
    return (valueElements[index] as HTMLElement | undefined) ?? null;
  }

  if (fieldKey.startsWith("addresses.")) {
    const [, indexRaw, property] = fieldKey.split(".");
    const index = Number(indexRaw);
    if (!Number.isInteger(index)) return form.querySelector('[name="addressAddressLine"]');

    if (property === "city") {
      const cityElements = form.querySelectorAll('[name="addressCity"]');
      return (cityElements[index] as HTMLElement | undefined) ?? null;
    }

    if (property === "reference") {
      const referenceElements = form.querySelectorAll('[name="addressReference"]');
      return (referenceElements[index] as HTMLElement | undefined) ?? null;
    }

    const addressLineElements = form.querySelectorAll('[name="addressAddressLine"]');
    return (addressLineElements[index] as HTMLElement | undefined) ?? null;
  }

  return null;
}

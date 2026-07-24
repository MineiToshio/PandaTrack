"use client";

import { Globe, Store } from "lucide-react";
import { useMemo, type Dispatch, type SetStateAction } from "react";
import { useLocale, useTranslations } from "next-intl";
import Label from "@/components/core/Label";
import MultiTagAutocomplete from "@/components/core/MultiTagAutocomplete";
import ToggleChoiceGroup from "@/components/core/ToggleChoiceGroup";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";
import { WizardStep } from "@/components/modules/WizardAccordion";
import { getStoreProductTypeIcon } from "@/lib/catalog/storeProductTypeIcons";
import { useStoreProductTypeName } from "@/app/[locale]/(app)/_components/StoreProductTypeNamesProvider";
import {
  CATALOG_STEP_FIELDS,
  mergeStepClientErrors,
  validateCatalogStep,
  type StoreFormClientErrors,
} from "../../../_utils/storeFormValidation";
import InlineSwitch from "../InlineSwitch";
import StoreProductTypeRequestModal from "../StoreProductTypeRequestModal";
import FieldErrorMsg from "./FieldErrorMsg";
import type { SellerTypeValue, StoreCountryOption, StoreFormFieldErrors, StorePresenceType } from "./types";

type StoreFormStepCatalogProps = {
  isEditMode: boolean;
  sellerType: SellerTypeValue;
  requestModalSource: "create" | "edit";
  productTypes: { key: string }[];
  countryOptions: StoreCountryOption[];
  selectedProductTypeKeys: string[];
  onProductTypeKeysChange: (next: string[]) => void;
  presenceTypes: StorePresenceType[];
  onPresenceTypesChange: (next: string[]) => void;
  selectedImportCountries: string[];
  onImportCountriesChange: (next: string[]) => void;
  hasStock: boolean;
  onHasStockChange: (next: boolean) => void;
  receivesOrders: boolean;
  onReceivesOrdersChange: (next: boolean) => void;
  fieldErrors: StoreFormFieldErrors;
  clientErrors: StoreFormClientErrors;
  onClientErrorsChange: Dispatch<SetStateAction<StoreFormClientErrors>>;
};

export default function StoreFormStepCatalog({
  isEditMode,
  sellerType,
  requestModalSource,
  productTypes,
  countryOptions,
  selectedProductTypeKeys,
  onProductTypeKeysChange,
  presenceTypes,
  onPresenceTypesChange,
  selectedImportCountries,
  onImportCountriesChange,
  hasStock,
  onHasStockChange,
  receivesOrders,
  onReceivesOrdersChange,
  fieldErrors,
  clientErrors,
  onClientErrorsChange,
}: StoreFormStepCatalogProps) {
  const locale = useLocale();
  const tCreate = useTranslations("stores.create");
  const tCreateRedesign = useTranslations("stores.redesign.create");
  const tValidation = useTranslations("stores.validation");
  const productTypeName = useStoreProductTypeName();

  // A PROXY is an intermediary with no catalog: no categories, stock, or pre-order signal.
  const isProxy = sellerType === "PROXY";
  const hasPresenceError = !!fieldErrors.presenceTypes?.length;
  const hasProductTypeError = !!fieldErrors.productTypeKeys?.length;

  const presenceOptions = useMemo(
    () => [
      { value: "PHYSICAL", label: tCreate("presencePhysical"), icon: <Store aria-hidden /> },
      { value: "ONLINE", label: tCreate("presenceOnline"), icon: <Globe aria-hidden /> },
    ],
    [tCreate],
  );

  const productTypeOptions = useMemo(
    () =>
      productTypes.map((productType) => {
        const Icon = getStoreProductTypeIcon(productType.key);
        return {
          value: productType.key,
          label: productTypeName(productType.key),
          icon: <Icon aria-hidden />,
        };
      }),
    [productTypes, productTypeName],
  );

  const handleValidate = () => {
    const stepErrors = validateCatalogStep({
      productTypeKeys: selectedProductTypeKeys,
      presenceTypes,
      requireProductTypes: !isProxy,
    });
    onClientErrorsChange((prev) => mergeStepClientErrors(prev, CATALOG_STEP_FIELDS, stepErrors));
    return Object.keys(stepErrors).length === 0;
  };

  return (
    <WizardStep
      n={3}
      eyebrow={tCreateRedesign("step3.eyebrow")}
      title={tCreateRedesign("step3.title")}
      primaryAction={{ label: tCreateRedesign("continue") }}
      secondaryAction={{ label: tCreateRedesign("back") }}
      summary={
        selectedProductTypeKeys.length > 0
          ? selectedProductTypeKeys.length === 1
            ? productTypeName(selectedProductTypeKeys[0])
            : `${selectedProductTypeKeys.length}`
          : undefined
      }
      actionsLayout={isEditMode ? "inline" : "sticky-on-mobile"}
      hasError={Boolean(clientErrors.productTypeKeys || clientErrors.presenceTypes)}
      validate={handleValidate}
    >
      <div className="space-y-5">
        {/* A PROXY has no catalog of its own, so the categories selection is hidden for it. */}
        {!isProxy && (
          <div className="space-y-3">
            <Label
              className={cn((hasProductTypeError || clientErrors.productTypeKeys) && "[color:var(--destructive)]")}
            >
              {tCreate("productTypesLabel")}
            </Label>
            <Typography size="sm" className="[color:var(--text-muted)]">
              {tCreateRedesign("step3.productTypesHelper")}
            </Typography>
            <div
              data-field="productTypeKeys"
              className={cn(
                (hasProductTypeError || clientErrors.productTypeKeys) &&
                  "rounded-lg p-2 [border:1px_solid_var(--destructive)]",
              )}
            >
              <ToggleChoiceGroup
                mode="multiple"
                options={productTypeOptions}
                selectedValues={selectedProductTypeKeys}
                onChange={onProductTypeKeysChange}
                formName="productTypeKeys"
                trailingSlot={
                  <StoreProductTypeRequestModal locale={locale} source={requestModalSource} triggerVariant="chip" />
                }
              />
            </div>
            {(fieldErrors.productTypeKeys?.[0] || clientErrors.productTypeKeys) && (
              <FieldErrorMsg>
                {tValidation(
                  (fieldErrors.productTypeKeys?.[0] ?? clientErrors.productTypeKeys) as
                    "productTypeRequired" | "productTypeInvalid",
                )}
              </FieldErrorMsg>
            )}
          </div>
        )}

        <div className="space-y-3">
          <Label className={cn((hasPresenceError || clientErrors.presenceTypes) && "[color:var(--destructive)]")}>
            {tCreateRedesign("step3.presenceLabel")}
          </Label>
          <Typography size="sm" className="[color:var(--text-muted)]">
            {tCreateRedesign("step3.presenceHelper")}
          </Typography>
          <div
            data-field="presenceTypes"
            className={cn(
              (hasPresenceError || clientErrors.presenceTypes) &&
                "rounded-lg p-2 [border:1px_solid_var(--destructive)]",
            )}
          >
            <ToggleChoiceGroup
              mode="multiple"
              options={presenceOptions}
              selectedValues={presenceTypes}
              onChange={onPresenceTypesChange}
              formName="presenceTypes"
            />
          </div>
          {(fieldErrors.presenceTypes?.[0] || clientErrors.presenceTypes) && (
            <FieldErrorMsg>{tValidation("presenceRequired")}</FieldErrorMsg>
          )}
        </div>

        <div className="space-y-3">
          <Label htmlFor="import-countries-input">{tCreate("importCountriesLabel")}</Label>
          <Typography size="sm" className="[color:var(--text-muted)]">
            {tCreateRedesign("step3.importHelper")}
          </Typography>
          <MultiTagAutocomplete
            id="import-countries-input"
            options={countryOptions}
            selectedValues={selectedImportCountries}
            onChange={onImportCountriesChange}
            placeholder={tCreate("importCountriesPlaceholder")}
            inputName="importCountries"
            helperText={tCreate("importCountriesHelper")}
            removeItemAriaLabel={(itemLabel) => `${tCreate("remove")} ${itemLabel}`}
          />
        </div>

        {/* Stock / pre-order signal does not apply to a PROXY, which sells no products of its own. */}
        {!isProxy && (
          <div className="space-y-3">
            <Label>{tCreateRedesign("step3.stockSectionLabel")}</Label>
            <div className="flex flex-wrap gap-6">
              <InlineSwitch
                label={tCreateRedesign("step3.hasStockLabel")}
                checked={hasStock}
                onChange={onHasStockChange}
              />
              <InlineSwitch
                label={tCreateRedesign("step3.receivesOrdersLabel")}
                checked={receivesOrders}
                onChange={onReceivesOrdersChange}
              />
            </div>
          </div>
        )}
      </div>
    </WizardStep>
  );
}

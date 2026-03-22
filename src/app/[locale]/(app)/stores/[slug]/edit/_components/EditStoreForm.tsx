"use client";

import { Box, Globe, Plus } from "lucide-react";
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import Button from "@/components/core/Button/Button";
import FieldCharacterCount from "@/components/core/FieldCharacterCount";
import Heading from "@/components/core/Heading";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import type { EditableStore, EditableStoreInput, StoreGovernanceViewerContext } from "@/queries/storeGovernance";
import BackNavLink from "@/components/core/BackNavLink";
import StoreAddressList from "../../../_components/share/StoreAddressList";
import StoreContactChannelList, {
  STORE_CONTACT_CHANNEL_TYPES,
  type StoreContactChannelType,
} from "../../../_components/share/StoreContactChannelList";
import StoreEmptyStateBox from "../../../_components/share/StoreEmptyStateBox";
import StoreFormSectionCard from "../../../_components/share/StoreFormSectionCard";
import StoreMultiTagAutocomplete from "../../../_components/share/StoreMultiTagAutocomplete";
import StoreProductTypeRequestModal from "../../../_components/share/StoreProductTypeRequestModal";
import StoreSelectableTagGroup from "../../../_components/share/StoreSelectableTagGroup";
import StoreToggleSwitch from "../../../_components/share/StoreToggleSwitch";
import { saveStoreEdit, type SaveStoreEditResult } from "../_actions/saveStoreEdit";

type EditStoreFormProps = {
  locale: string;
  store: EditableStore;
  countries: { code: string }[];
  productTypes: { key: string }[];
  initialValues: EditableStoreInput;
  canDirectlyEdit: boolean;
  existingChangeRequest: StoreGovernanceViewerContext["openChangeRequest"];
};

export default function EditStoreForm({
  locale,
  store,
  countries,
  productTypes,
  initialValues,
  canDirectlyEdit,
  existingChangeRequest,
}: EditStoreFormProps) {
  const t = useTranslations("stores");
  const tCountries = useTranslations("countries");
  const tProductTypes = useTranslations("storeProductTypes");
  const tChannelTypes = useTranslations("stores.contactChannelTypes");
  const tValidation = useTranslations("stores.validation");

  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(initialValues.description ?? "");
  const [presenceTypes, setPresenceTypes] = useState<Array<"ONLINE" | "PHYSICAL">>(
    initialValues.presenceTypes as Array<"ONLINE" | "PHYSICAL">,
  );
  const [selectedProductTypeKeys, setSelectedProductTypeKeys] = useState(initialValues.productTypeKeys);
  const [selectedImportCountries, setSelectedImportCountries] = useState(initialValues.importCountries ?? []);
  const [hasStock, setHasStock] = useState(Boolean(initialValues.hasStock));
  const [receivesOrders, setReceivesOrders] = useState(Boolean(initialValues.receivesOrders));
  const [comment, setComment] = useState(existingChangeRequest?.comment ?? "");
  const [contactChannelRows, setContactChannelRows] = useState<number[]>(
    initialValues.contactChannels?.map((_, index) => index + 1) ?? [],
  );
  const [contactChannelTypeByRowId, setContactChannelTypeByRowId] = useState<
    Partial<Record<number, StoreContactChannelType>>
  >(
    Object.fromEntries(
      (initialValues.contactChannels ?? []).map((channel, index) => [
        index + 1,
        channel.type as StoreContactChannelType,
      ]),
    ),
  );
  const [contactChannelValuesByRowId, setContactChannelValuesByRowId] = useState<Record<number, string>>(
    Object.fromEntries((initialValues.contactChannels ?? []).map((channel, index) => [index + 1, channel.value])),
  );
  const [contactChannelLabelsByRowId, setContactChannelLabelsByRowId] = useState<Record<number, string>>(
    Object.fromEntries((initialValues.contactChannels ?? []).map((channel, index) => [index + 1, channel.label ?? ""])),
  );
  const [addressRows, setAddressRows] = useState<number[]>(initialValues.addresses?.map((_, index) => index + 1) ?? []);
  const [addressCountryByRowId, setAddressCountryByRowId] = useState<Record<number, string>>(
    Object.fromEntries((initialValues.addresses ?? []).map((address, index) => [index + 1, address.countryCode])),
  );
  const [addressCityByRowId, setAddressCityByRowId] = useState<Record<number, string>>(
    Object.fromEntries((initialValues.addresses ?? []).map((address, index) => [index + 1, address.city ?? ""])),
  );
  const [addressLineByRowId, setAddressLineByRowId] = useState<Record<number, string>>(
    Object.fromEntries((initialValues.addresses ?? []).map((address, index) => [index + 1, address.addressLine])),
  );
  const [addressReferenceByRowId, setAddressReferenceByRowId] = useState<Record<number, string>>(
    Object.fromEntries((initialValues.addresses ?? []).map((address, index) => [index + 1, address.reference ?? ""])),
  );

  const nextContactRowIdRef = useRef(contactChannelRows.length + 1);
  const nextAddressRowIdRef = useRef(addressRows.length + 1);

  const [state, formAction, isPending] = useActionState(
    async (_prev: SaveStoreEditResult | null, formData: FormData) => saveStoreEdit(_prev, formData),
    null,
  );

  useEffect(() => {
    if (!canDirectlyEdit) {
      posthog.capture(POSTHOG_EVENTS.STORE.CHANGE_REQUEST_EDIT_ENTERED, {
        store_slug: store.slug,
        has_existing_change_request: existingChangeRequest != null,
      });
    }
  }, [canDirectlyEdit, existingChangeRequest, store.slug]);

  const countryOptions = useMemo(
    () =>
      countries.map((country) => ({
        value: country.code,
        label: tCountries(country.code),
      })),
    [countries, tCountries],
  );

  const productTypeOptions = useMemo(
    () =>
      productTypes.map((productType) => ({
        value: productType.key,
        label: tProductTypes(productType.key),
        icon: <Box aria-hidden />,
      })),
    [productTypes, tProductTypes],
  );

  const presenceOptions = useMemo(
    () => [
      { value: "ONLINE", label: t("create.presenceOnline"), icon: <Globe aria-hidden /> },
      { value: "PHYSICAL", label: t("create.presencePhysical"), icon: <Globe aria-hidden /> },
    ],
    [t],
  );

  const fieldErrors = state?.success === false ? (state.fieldErrors ?? {}) : {};
  const serverError = state?.success === false ? state.error : null;
  const modeKey = canDirectlyEdit ? "edit.direct" : "edit.changeRequest";

  const handleAddContactChannel = () => {
    const nextId = nextContactRowIdRef.current;
    nextContactRowIdRef.current += 1;
    setContactChannelRows((previous) => [...previous, nextId]);
    setContactChannelTypeByRowId((previous) => ({ ...previous, [nextId]: STORE_CONTACT_CHANNEL_TYPES[0] }));
    setContactChannelValuesByRowId((previous) => ({ ...previous, [nextId]: "" }));
    setContactChannelLabelsByRowId((previous) => ({ ...previous, [nextId]: "" }));
  };

  const handleAddAddress = () => {
    const nextId = nextAddressRowIdRef.current;
    nextAddressRowIdRef.current += 1;
    setAddressRows((previous) => [...previous, nextId]);
  };

  const handleRemoveContactChannel = (rowId: number) => {
    setContactChannelRows((previous) => previous.filter((item) => item !== rowId));
    setContactChannelTypeByRowId((previous) => {
      const next = { ...previous };
      delete next[rowId];
      return next;
    });
    setContactChannelValuesByRowId((previous) => {
      const next = { ...previous };
      delete next[rowId];
      return next;
    });
    setContactChannelLabelsByRowId((previous) => {
      const next = { ...previous };
      delete next[rowId];
      return next;
    });
  };

  const handleRemoveAddress = (rowId: number) => {
    setAddressRows((previous) => previous.filter((item) => item !== rowId));
    setAddressCountryByRowId((previous) => {
      const next = { ...previous };
      delete next[rowId];
      return next;
    });
    setAddressCityByRowId((previous) => {
      const next = { ...previous };
      delete next[rowId];
      return next;
    });
    setAddressLineByRowId((previous) => {
      const next = { ...previous };
      delete next[rowId];
      return next;
    });
    setAddressReferenceByRowId((previous) => {
      const next = { ...previous };
      delete next[rowId];
      return next;
    });
  };

  const getContactChannelTypeForRow = (rowId: number) =>
    contactChannelTypeByRowId[rowId] ?? STORE_CONTACT_CHANNEL_TYPES[0];

  const getContactChannelValueError = (rowIndex: number) =>
    fieldErrors[`contactChannels.${rowIndex}.value`]?.[0] ?? fieldErrors[`contactChannels.${rowIndex}`]?.[0] ?? null;
  const getContactChannelLabelError = (rowIndex: number) =>
    fieldErrors[`contactChannels.${rowIndex}.label`]?.[0] ?? null;

  const handleSubmit = (formData: FormData) => {
    startTransition(() => {
      formAction(formData);
    });
  };

  const renderError = (errorKey: string) =>
    tValidation.has(errorKey)
      ? tValidation(errorKey as never)
      : t.has(`governance.edit.errors.${errorKey}`)
        ? t(`governance.edit.errors.${errorKey}` as never)
        : t("error.validation_failed");

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <BackNavLink href={`/${locale}${ROUTES.stores}/${store.slug}`}>{t("edit.backToDetail")}</BackNavLink>
        <Heading as="h1" size="sm" className="text-text-title">
          {t(`${modeKey}.title`, {
            storeName: name.trim() || store.name,
          })}
        </Heading>
        <Typography size="sm" className="text-text-muted">
          {t(`${modeKey}.description`)}
        </Typography>
      </div>

      {serverError && (
        <Typography size="sm" className="text-destructive" role="alert">
          {renderError(serverError)}
        </Typography>
      )}

      {state?.success && (
        <Typography size="sm" className="text-text-body" role="status">
          {t(`edit.success.${state.mode}`)}
        </Typography>
      )}

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit(new FormData(event.currentTarget));
        }}
      >
        <input type="hidden" name="slug" value={store.slug} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="storeType" value={store.storeType} />
        <input type="hidden" name="countryCode" value={store.countryCode} />

        <StoreFormSectionCard eyebrow={t("edit.identityEyebrow")} title={t("edit.identityTitle")}>
          <div>
            <Label htmlFor="edit-store-name">{t("create.nameLabel")}</Label>
            <Input
              id="edit-store-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={200}
              error={Boolean(fieldErrors.name?.[0])}
              aria-invalid={Boolean(fieldErrors.name?.[0])}
            />
            <div className="mt-1 flex items-center justify-between gap-3">
              <Typography size="xs" className="text-text-muted">
                {t("edit.immutableFieldsHelper", {
                  storeType:
                    store.storeType === "BUSINESS" ? t("create.storeTypeBusiness") : t("create.storeTypePerson"),
                  country: tCountries(store.countryCode),
                })}
              </Typography>
              <Typography size="xs" className="text-text-muted">
                <FieldCharacterCount currentLength={name.length} maxLength={200} />
              </Typography>
            </div>
            {fieldErrors.name?.[0] && (
              <Typography size="xs" className="text-destructive mt-1" role="alert">
                {renderError(fieldErrors.name[0])}
              </Typography>
            )}
          </div>

          <div>
            <Label htmlFor="edit-store-description">{t("create.descriptionLabel")}</Label>
            <Textarea
              id="edit-store-description"
              name="description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              className="resize-y"
            />
            <div className="mt-1 flex justify-end">
              <Typography size="xs" className="text-text-muted">
                <FieldCharacterCount currentLength={description.length} maxLength={2000} />
              </Typography>
            </div>
          </div>
        </StoreFormSectionCard>

        <StoreFormSectionCard
          eyebrow={t("edit.catalogEyebrow")}
          title={t("edit.catalogTitle")}
          action={<StoreProductTypeRequestModal locale={locale} source="edit" />}
        >
          <div className="space-y-3">
            <Label>{t("create.presenceLabel")}</Label>
            <StoreSelectableTagGroup
              options={presenceOptions}
              selectedValues={presenceTypes}
              onChange={(values) => setPresenceTypes(values as Array<"ONLINE" | "PHYSICAL">)}
              inputName="presenceTypes"
            />
            {fieldErrors.presenceTypes?.[0] && (
              <Typography size="xs" className="text-destructive" role="alert">
                {renderError(fieldErrors.presenceTypes[0])}
              </Typography>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StoreToggleSwitch
              label={t("create.hasStockLabel")}
              checked={hasStock}
              onChange={setHasStock}
              name="hasStock"
            />
            <StoreToggleSwitch
              label={t("create.receivesOrdersLabel")}
              checked={receivesOrders}
              onChange={setReceivesOrders}
              name="receivesOrders"
            />
          </div>

          <div className="space-y-3">
            <Label>{t("create.productTypesLabel")}</Label>
            <StoreSelectableTagGroup
              options={productTypeOptions}
              selectedValues={selectedProductTypeKeys}
              onChange={setSelectedProductTypeKeys}
              inputName="productTypeKeys"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="edit-import-countries">{t("create.importCountriesLabel")}</Label>
            <StoreMultiTagAutocomplete
              id="edit-import-countries"
              options={countryOptions}
              selectedValues={selectedImportCountries}
              onChange={setSelectedImportCountries}
              placeholder={t("create.importCountriesPlaceholder")}
              inputName="importCountries"
              helperText={t("create.importCountriesHelper")}
              removeItemAriaLabel={(itemLabel) => `${t("create.remove")} ${itemLabel}`}
            />
          </div>
        </StoreFormSectionCard>

        {store.storeType === "BUSINESS" && (
          <section className="space-y-5">
            <StoreFormSectionCard
              eyebrow={t("edit.contactEyebrow")}
              title={t("create.contactChannelsLabel")}
              action={
                <Button type="button" variant="secondary" size="sm" onClick={handleAddContactChannel}>
                  <Plus size={16} className="mr-1" aria-hidden />
                  {t("create.addContactChannel")}
                </Button>
              }
            >
              {contactChannelRows.length === 0 ? (
                <StoreEmptyStateBox message={t("create.noContactChannels")} />
              ) : (
                <StoreContactChannelList
                  idPrefix="edit-contact-channel"
                  rows={contactChannelRows.map((rowId, rowIndex) => ({
                    rowId,
                    rowIndex,
                    type: getContactChannelTypeForRow(rowId),
                    value: contactChannelValuesByRowId[rowId] ?? "",
                    label: contactChannelLabelsByRowId[rowId] ?? "",
                    typeError: fieldErrors[`contactChannels.${rowIndex}.type`]?.[0] ?? undefined,
                    valueError: getContactChannelValueError(rowIndex) ?? undefined,
                    labelError: getContactChannelLabelError(rowIndex) ?? undefined,
                  }))}
                  typeInputName="contactChannelType"
                  valueInputName="contactChannelValue"
                  labelInputName="contactChannelLabel"
                  typeLabel={t("create.contactChannelType")}
                  valueLabel={t("create.contactChannelValue")}
                  labelLabel={t("create.contactChannelLabel")}
                  removeLabel={t("create.remove")}
                  optionLabel={(type) => tChannelTypes(type)}
                  valuePlaceholder={(type) => t(`create.contactChannelPlaceholder.${type}` as never)}
                  onTypeChange={(rowId, nextType) => {
                    setContactChannelTypeByRowId((previous) => ({
                      ...previous,
                      [rowId]: nextType,
                    }));
                  }}
                  onValueChange={(rowId, nextValue) => {
                    setContactChannelValuesByRowId((previous) => ({
                      ...previous,
                      [rowId]: nextValue,
                    }));
                  }}
                  onLabelChange={(rowId, nextValue) => {
                    setContactChannelLabelsByRowId((previous) => ({
                      ...previous,
                      [rowId]: nextValue,
                    }));
                  }}
                  onRemove={handleRemoveContactChannel}
                  renderValueError={renderError}
                  renderLabelError={renderError}
                />
              )}
            </StoreFormSectionCard>

            <StoreFormSectionCard
              eyebrow={t("edit.addressEyebrow")}
              title={t("create.addressesLabel")}
              action={
                <Button type="button" variant="secondary" size="sm" onClick={handleAddAddress}>
                  <Plus size={16} className="mr-1" aria-hidden />
                  {t("create.addAddress")}
                </Button>
              }
            >
              {addressRows.length === 0 ? (
                <StoreEmptyStateBox message={t("create.noAddresses")} />
              ) : (
                <StoreAddressList
                  idPrefix="edit-address"
                  rows={addressRows.map((rowId, rowIndex) => ({
                    rowId,
                    rowIndex,
                    countryCode: addressCountryByRowId[rowId] ?? "",
                    city: addressCityByRowId[rowId] ?? "",
                    addressLine: addressLineByRowId[rowId] ?? "",
                    reference: addressReferenceByRowId[rowId] ?? "",
                    countryError: fieldErrors[`addresses.${rowIndex}.countryCode`]?.[0] ?? undefined,
                    cityError: fieldErrors[`addresses.${rowIndex}.city`]?.[0] ?? undefined,
                    addressLineError: fieldErrors[`addresses.${rowIndex}.addressLine`]?.[0] ?? undefined,
                    referenceError: fieldErrors[`addresses.${rowIndex}.reference`]?.[0] ?? undefined,
                  }))}
                  countryOptions={countryOptions}
                  emptyCountryLabel="-"
                  countryLabel={t("create.addressCountry")}
                  cityLabel={t("create.addressCity")}
                  addressLineLabel={t("create.addressLine")}
                  referenceLabel={t("create.addressReference")}
                  countryInputName="addressCountryCode"
                  cityInputName="addressCity"
                  addressLineInputName="addressAddressLine"
                  referenceInputName="addressReference"
                  removeLabel={t("create.remove")}
                  rowLabel={(index) => t("create.addressItemLabel", { index: index + 1 })}
                  onCountryChange={(rowId, nextValue) => {
                    setAddressCountryByRowId((previous) => ({ ...previous, [rowId]: nextValue }));
                  }}
                  onCityChange={(rowId, nextValue) => {
                    setAddressCityByRowId((previous) => ({ ...previous, [rowId]: nextValue }));
                  }}
                  onAddressLineChange={(rowId, nextValue) => {
                    setAddressLineByRowId((previous) => ({ ...previous, [rowId]: nextValue }));
                  }}
                  onReferenceChange={(rowId, nextValue) => {
                    setAddressReferenceByRowId((previous) => ({ ...previous, [rowId]: nextValue }));
                  }}
                  onRemove={handleRemoveAddress}
                  renderCountryError={renderError}
                  renderCityError={renderError}
                  renderAddressLineError={renderError}
                  renderReferenceError={renderError}
                />
              )}
            </StoreFormSectionCard>
          </section>
        )}

        {!canDirectlyEdit && (
          <StoreFormSectionCard eyebrow={t("edit.commentEyebrow")} title={t("edit.commentTitle")}>
            <div>
              <Label htmlFor="edit-change-request-comment">{t("edit.commentLabel")}</Label>
              <Textarea
                id="edit-change-request-comment"
                name="comment"
                rows={4}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={500}
                className="mt-1 resize-y"
              />
              <div className="mt-1 flex items-center justify-between gap-3">
                <Typography size="xs" className="text-text-muted">
                  {t("edit.commentHelper")}
                </Typography>
                <Typography size="xs" className="text-text-muted">
                  <FieldCharacterCount currentLength={comment.length} maxLength={500} />
                </Typography>
              </div>
            </div>
          </StoreFormSectionCard>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? t(`${modeKey}.submitting`) : t(`${modeKey}.submitCta`)}
          </Button>
          <BackNavLink href={`/${locale}${ROUTES.stores}/${store.slug}`}>{t("edit.cancelCta")}</BackNavLink>
        </div>
      </form>
    </div>
  );
}

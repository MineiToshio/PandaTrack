"use client";

import { Box, Globe, Plus, X } from "lucide-react";
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import posthog from "posthog-js";
import Button from "@/components/core/Button/Button";
import FieldCharacterCount from "@/components/core/FieldCharacterCount";
import Heading from "@/components/core/Heading";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import Select from "@/components/core/Select";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import type { EditableStore, EditableStoreInput, StoreGovernanceViewerContext } from "@/queries/storeGovernance";
import StoreProductTypeRequestModal from "../../../_components/StoreProductTypeRequestModal";
import StoreMultiTagAutocomplete from "../../../_components/StoreMultiTagAutocomplete";
import StoreEmptyStateBox from "../../../new/_components/StoreEmptyStateBox";
import StoreFormSectionCard from "../../../new/_components/StoreFormSectionCard";
import StoreSelectableTagGroup from "../../../new/_components/StoreSelectableTagGroup";
import StoreToggleSwitch from "../../../new/_components/StoreToggleSwitch";
import { saveStoreEdit, type SaveStoreEditResult } from "../_actions/saveStoreEdit";

const CONTACT_CHANNEL_TYPES = [
  "INSTAGRAM",
  "WHATSAPP",
  "EMAIL",
  "PHONE",
  "WEBSITE",
  "FACEBOOK",
  "TIKTOK",
  "OTHER",
] as const;

type ContactChannelType = (typeof CONTACT_CHANNEL_TYPES)[number];

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
    Partial<Record<number, ContactChannelType>>
  >(
    Object.fromEntries(
      (initialValues.contactChannels ?? []).map((channel, index) => [index + 1, channel.type as ContactChannelType]),
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
    setContactChannelTypeByRowId((previous) => ({ ...previous, [nextId]: "INSTAGRAM" }));
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
  };

  const handleRemoveAddress = (rowId: number) => {
    setAddressRows((previous) => previous.filter((item) => item !== rowId));
  };

  const getContactChannelTypeForRow = (rowId: number) => contactChannelTypeByRowId[rowId] ?? "INSTAGRAM";

  const getContactChannelValueError = (rowIndex: number) =>
    fieldErrors[`contactChannels.${rowIndex}.value`]?.[0] ?? fieldErrors[`contactChannels.${rowIndex}`]?.[0] ?? null;

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
        <Link
          href={`/${locale}${ROUTES.stores}/${store.slug}`}
          className={cn(buttonVariants({ variant: "secondary" }))}
        >
          {t("edit.backToDetail")}
        </Link>
        <Heading as="h1" size="sm" className="text-text-title">
          {t(`${modeKey}.title`)}
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
                <div className="space-y-3">
                  {contactChannelRows.map((rowId, rowIndex) => (
                    <div key={rowId} className="border-border bg-background rounded-lg border p-3">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <div>
                          <Label htmlFor={`edit-contact-type-${rowId}`} className="text-xs">
                            {t("create.contactChannelType")}
                          </Label>
                          <Select
                            id={`edit-contact-type-${rowId}`}
                            name="contactChannelType"
                            value={getContactChannelTypeForRow(rowId)}
                            onChange={(event) =>
                              setContactChannelTypeByRowId((previous) => ({
                                ...previous,
                                [rowId]: event.target.value as ContactChannelType,
                              }))
                            }
                            className="px-2 py-1.5"
                          >
                            {CONTACT_CHANNEL_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {tChannelTypes(type)}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor={`edit-contact-value-${rowId}`} className="text-xs">
                            {t("create.contactChannelValue")}
                          </Label>
                          <Input
                            id={`edit-contact-value-${rowId}`}
                            name="contactChannelValue"
                            value={contactChannelValuesByRowId[rowId] ?? ""}
                            onChange={(event) =>
                              setContactChannelValuesByRowId((previous) => ({
                                ...previous,
                                [rowId]: event.target.value,
                              }))
                            }
                            error={Boolean(getContactChannelValueError(rowIndex))}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`edit-contact-label-${rowId}`} className="text-xs">
                            {t("create.contactChannelLabel")}
                          </Label>
                          <Input
                            id={`edit-contact-label-${rowId}`}
                            name="contactChannelLabel"
                            value={contactChannelLabelsByRowId[rowId] ?? ""}
                            onChange={(event) =>
                              setContactChannelLabelsByRowId((previous) => ({
                                ...previous,
                                [rowId]: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveContactChannel(rowId)}
                        >
                          <X size={16} aria-hidden />
                        </Button>
                      </div>
                      {getContactChannelValueError(rowIndex) && (
                        <Typography size="xs" className="text-destructive mt-2" role="alert">
                          {renderError(getContactChannelValueError(rowIndex) as string)}
                        </Typography>
                      )}
                    </div>
                  ))}
                </div>
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
                <div className="space-y-3">
                  {addressRows.map((rowId, rowIndex) => (
                    <div key={rowId} className="border-border bg-background space-y-3 rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Typography size="xs" className="text-text-muted font-medium">
                          {t("create.addressItemLabel", { index: rowIndex + 1 })}
                        </Typography>
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveAddress(rowId)}>
                          <X size={16} aria-hidden />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <Label htmlFor={`edit-address-country-${rowId}`} className="text-xs">
                            {t("create.addressCountry")}
                          </Label>
                          <Select
                            id={`edit-address-country-${rowId}`}
                            name="addressCountryCode"
                            value={addressCountryByRowId[rowId] ?? ""}
                            onChange={(event) =>
                              setAddressCountryByRowId((previous) => ({ ...previous, [rowId]: event.target.value }))
                            }
                            className="px-2 py-1.5"
                          >
                            <option value="">-</option>
                            {countries.map((country) => (
                              <option key={country.code} value={country.code}>
                                {tCountries(country.code)}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor={`edit-address-city-${rowId}`} className="text-xs">
                            {t("create.addressCity")}
                          </Label>
                          <Input
                            id={`edit-address-city-${rowId}`}
                            name="addressCity"
                            value={addressCityByRowId[rowId] ?? ""}
                            onChange={(event) =>
                              setAddressCityByRowId((previous) => ({ ...previous, [rowId]: event.target.value }))
                            }
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <Label htmlFor={`edit-address-line-${rowId}`} className="text-xs">
                            {t("create.addressLine")}
                          </Label>
                          <Input
                            id={`edit-address-line-${rowId}`}
                            name="addressAddressLine"
                            value={addressLineByRowId[rowId] ?? ""}
                            onChange={(event) =>
                              setAddressLineByRowId((previous) => ({ ...previous, [rowId]: event.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`edit-address-reference-${rowId}`} className="text-xs">
                            {t("create.addressReference")}
                          </Label>
                          <Input
                            id={`edit-address-reference-${rowId}`}
                            name="addressReference"
                            value={addressReferenceByRowId[rowId] ?? ""}
                            onChange={(event) =>
                              setAddressReferenceByRowId((previous) => ({ ...previous, [rowId]: event.target.value }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
          <Link
            href={`/${locale}${ROUTES.stores}/${store.slug}`}
            className={cn(buttonVariants({ variant: "secondary" }))}
          >
            {t("edit.cancelCta")}
          </Link>
        </div>
      </form>
    </div>
  );
}

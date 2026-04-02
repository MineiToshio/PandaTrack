"use client";

import { Box, Building2, Globe, Plus, UserRound } from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import Label from "@/components/core/Label";
import Input from "@/components/core/Input";
import Select from "@/components/core/Select";
import Textarea from "@/components/core/Textarea";
import Button from "@/components/core/Button/Button";
import { cn } from "@/lib/styles";
import { ROUTES } from "@/lib/constants";
import { POSTHOG_EVENTS } from "@/lib/constants";
import posthog from "posthog-js";
import { createStore, type CreateStoreResult } from "../_actions/createStore";
import { getDuplicateCandidates, getDuplicateCandidatesForSubmit } from "../_actions/getDuplicateCandidates";
import { SIMILARITY_THRESHOLD_PERCENT } from "@/lib/store/duplicateMatch";
import { STORE_LOGO_MAX_SOURCE_SIZE_MB } from "@/lib/store/logoShared";
import BackNavLink from "@/components/core/BackNavLink";
import StoreAddressList from "../../_components/share/StoreAddressList";
import StoreContactChannelList, {
  STORE_CONTACT_CHANNEL_TYPES,
  type StoreContactChannelType,
} from "../../_components/share/StoreContactChannelList";
import StoreEmptyStateBox from "../../_components/share/StoreEmptyStateBox";
import StoreFormSectionCard from "../../_components/share/StoreFormSectionCard";
import StoreLogoField, { type StoreLogoSubmission } from "../../_components/share/StoreLogoField/StoreLogoField";
import StoreMultiTagAutocomplete from "../../_components/share/StoreMultiTagAutocomplete";
import StoreProductTypeRequestModal from "../../_components/share/StoreProductTypeRequestModal";
import StoreSegmentedControl from "../../_components/share/StoreSegmentedControl";
import StoreSelectableTagGroup from "../../_components/share/StoreSelectableTagGroup";
import StoreToggleSwitch from "../../_components/share/StoreToggleSwitch";

type DuplicateCandidate = { id: string; name: string; slug: string; countryCode: string; logoUrl: string | null };

const MIN_QUERY_LENGTH = 2;

const resolveFirstErrorElement = (form: HTMLFormElement, fieldKey: string): HTMLElement | null => {
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

    if (property === "countryCode") {
      const countryElements = form.querySelectorAll('[name="addressCountryCode"]');
      return (countryElements[index] as HTMLElement | undefined) ?? null;
    }

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
};

type DuplicateCandidatesListProps = {
  candidates: DuplicateCandidate[];
  locale: string;
  tCountries: (key: string) => string;
};

function DuplicateCandidatesList({ candidates, locale, tCountries }: DuplicateCandidatesListProps) {
  return (
    <ul className="space-y-2">
      {candidates.map((candidate) => (
        <li key={candidate.id}>
          <Link
            href={`/${locale}${ROUTES.stores}/${candidate.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border bg-background/70 hover:border-primary/60 hover:bg-background group flex items-center gap-2 rounded-lg border p-2 transition-colors"
          >
            {candidate.logoUrl ? (
              <Image
                src={candidate.logoUrl}
                alt=""
                width={28}
                height={28}
                className="size-7 shrink-0 rounded-md object-cover"
                unoptimized
              />
            ) : (
              <span className="bg-muted text-text-muted group-hover:text-primary inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors">
                <Building2 size={14} aria-hidden />
              </span>
            )}
            <span className="min-w-0">
              <Typography size="xs" className="text-text-body block truncate">
                {candidate.name}
              </Typography>
              <Typography size="2xs" className="text-text-muted block">
                {tCountries(candidate.countryCode)}
              </Typography>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export type CreateStoreFormProps = {
  countries: { code: string }[];
  productTypes: { key: string }[];
};

export default function CreateStoreForm({ countries, productTypes }: CreateStoreFormProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("stores");
  const tCreate = useTranslations("stores.create");
  const tValidation = useTranslations("stores.validation");
  const tCountries = useTranslations("countries");
  const tProductTypes = useTranslations("storeProductTypes");
  const tChannelTypes = useTranslations("stores.contactChannelTypes");

  const [storeType, setStoreType] = useState<"BUSINESS" | "PERSON">("BUSINESS");
  const [hasStock, setHasStock] = useState(false);
  const [receivesOrders, setReceivesOrders] = useState(false);
  const [presenceTypes, setPresenceTypes] = useState<Array<"ONLINE" | "PHYSICAL">>(["ONLINE"]);
  const [selectedProductTypeKeys, setSelectedProductTypeKeys] = useState<string[]>([]);
  const [selectedImportCountries, setSelectedImportCountries] = useState<string[]>([]);
  const [contactChannelRows, setContactChannelRows] = useState<number[]>([]);
  const [contactChannelTypeByRowId, setContactChannelTypeByRowId] = useState<
    Partial<Record<number, StoreContactChannelType>>
  >({});
  const [addressRows, setAddressRows] = useState<number[]>([]);
  const [logoSubmission, setLogoSubmission] = useState<StoreLogoSubmission>({
    action: "keep",
    file: null,
    cropArea: null,
  });
  const nextContactRowIdRef = useRef(1);
  const nextAddressRowIdRef = useRef(1);

  const [state, formAction, isPending] = useActionState(
    async (_prev: CreateStoreResult | null, formData: FormData) => createStore(_prev, formData),
    null,
  );

  const [nameValue, setNameValue] = useState("");
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [showConfirmDuplicate, setShowConfirmDuplicate] = useState(false);
  const pendingFormDataRef = useRef<FormData | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const duplicateModalCancelRef = useRef<HTMLButtonElement | null>(null);

  const fetchCandidates = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      setDuplicateCandidates([]);
      return [];
    }
    const list = await getDuplicateCandidates(trimmedQuery);
    setDuplicateCandidates(list);
    if (list.length > 0) {
      posthog.capture(POSTHOG_EVENTS.STORE.DUPLICATE_SUGGESTIONS_SHOWN, {
        candidate_count: list.length,
        name_query: trimmedQuery,
      });
    }
    return list;
  }, []);

  const handleNameBlur = async () => {
    await fetchCandidates(nameValue);
  };

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setNameValue(event.target.value);
    setDuplicateCandidates([]);
  };

  const countryOptions = useMemo(
    () =>
      countries.map((country) => ({
        value: country.code,
        label: tCountries(country.code),
      })),
    [countries, tCountries],
  );

  const storeTypeOptions = useMemo(
    () => [
      { value: "BUSINESS", label: tCreate("storeTypeBusiness"), icon: <Building2 aria-hidden /> },
      { value: "PERSON", label: tCreate("storeTypePerson"), icon: <UserRound aria-hidden /> },
    ],
    [tCreate],
  );

  const presenceOptions = useMemo(
    () => [
      { value: "ONLINE", label: tCreate("presenceOnline"), icon: <Globe aria-hidden /> },
      { value: "PHYSICAL", label: tCreate("presencePhysical"), icon: <Globe aria-hidden /> },
    ],
    [tCreate],
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

  const handleAddContactChannel = () => {
    const nextId = nextContactRowIdRef.current;
    const defaultType = STORE_CONTACT_CHANNEL_TYPES[contactChannelRows.length % STORE_CONTACT_CHANNEL_TYPES.length];
    nextContactRowIdRef.current += 1;
    setContactChannelRows((previous) => [...previous, nextId]);
    setContactChannelTypeByRowId((previous) => ({
      ...previous,
      [nextId]: defaultType,
    }));
  };

  const handleRemoveContactChannel = (rowId: number) => {
    setContactChannelRows((previous) => previous.filter((item) => item !== rowId));
    setContactChannelTypeByRowId((previous) => {
      const next = { ...previous };
      delete next[rowId];
      return next;
    });
  };

  const getContactChannelTypeForRow = (rowId: number, rowIndex: number): StoreContactChannelType => {
    return (
      contactChannelTypeByRowId[rowId] ?? STORE_CONTACT_CHANNEL_TYPES[rowIndex % STORE_CONTACT_CHANNEL_TYPES.length]
    );
  };

  const getContactChannelPlaceholder = (type: StoreContactChannelType) => {
    return tCreate(`contactChannelPlaceholder.${type}`);
  };

  const handleAddAddress = () => {
    const nextId = nextAddressRowIdRef.current;
    nextAddressRowIdRef.current += 1;
    setAddressRows((previous) => [...previous, nextId]);
  };

  const handleRemoveAddress = (rowId: number) => {
    setAddressRows((previous) => previous.filter((item) => item !== rowId));
  };

  const handleSubmit = async (formData: FormData) => {
    const submittedName = formData.get("name");
    const submittedCountry = formData.get("countryCode");
    const nameToValidate = typeof submittedName === "string" ? submittedName.trim() : "";
    const countryCode = typeof submittedCountry === "string" ? submittedCountry : "";
    const submitCandidates = await getDuplicateCandidatesForSubmit(nameToValidate, countryCode);
    if (submitCandidates.length > 0) {
      setDuplicateCandidates(submitCandidates);
      setShowConfirmDuplicate(true);
      pendingFormDataRef.current = formData;
      posthog.capture(POSTHOG_EVENTS.STORE.DUPLICATE_SUBMIT_MODAL_SHOWN, {
        candidate_count: submitCandidates.length,
        name_query: nameToValidate,
        country_code: countryCode,
      });
      return;
    }
    startTransition(() => {
      formAction(formData);
    });
  };

  const handleConfirmCreateAnyway = () => {
    const data = pendingFormDataRef.current;
    setShowConfirmDuplicate(false);
    pendingFormDataRef.current = null;
    if (data) {
      startTransition(() => {
        formAction(data);
      });
    }
  };

  const handleCancelDuplicateConfirm = () => {
    setShowConfirmDuplicate(false);
    pendingFormDataRef.current = null;
  };

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextFormData = new FormData(event.currentTarget);

    if (storeType === "BUSINESS") {
      nextFormData.set("logoAction", logoSubmission.action);
      if (logoSubmission.action === "set" && logoSubmission.file && logoSubmission.cropArea) {
        nextFormData.set("logoFile", logoSubmission.file, logoSubmission.file.name);
        nextFormData.set("logoCropX", String(logoSubmission.cropArea.x));
        nextFormData.set("logoCropY", String(logoSubmission.cropArea.y));
        nextFormData.set("logoCropWidth", String(logoSubmission.cropArea.width));
        nextFormData.set("logoCropHeight", String(logoSubmission.cropArea.height));
      }
    } else {
      nextFormData.set("logoAction", "keep");
    }

    await handleSubmit(nextFormData);
  };

  const success = state?.success === true;
  const createdStoreSlug = success && "slug" in state ? state.slug : null;
  const fieldErrors = state?.success === false && "fieldErrors" in state ? (state.fieldErrors ?? {}) : {};
  const serverError = state?.success === false && "error" in state ? state.error : null;
  const firstErrorKey = Object.keys(fieldErrors)[0];
  const hasPresenceError = !!fieldErrors.presenceTypes?.length;
  const hasProductTypeError = !!fieldErrors.productTypeKeys?.length;
  const logoError = fieldErrors.logo?.[0] ?? null;

  const getContactChannelValueError = (rowIndex: number) => {
    return (
      fieldErrors[`contactChannels.${rowIndex}.value`]?.[0] ??
      fieldErrors[`contactChannels.${rowIndex}`]?.[0] ??
      fieldErrors.contactChannels?.[0] ??
      null
    );
  };

  const getContactChannelTypeError = (rowIndex: number) => {
    return fieldErrors[`contactChannels.${rowIndex}.type`]?.[0] ?? null;
  };

  useEffect(() => {
    if (state?.success !== false || !firstErrorKey || !formRef.current) {
      return;
    }

    const firstErrorElement = resolveFirstErrorElement(formRef.current, firstErrorKey);
    if (!firstErrorElement) {
      return;
    }

    firstErrorElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    if (typeof firstErrorElement.focus === "function") {
      firstErrorElement.focus({ preventScroll: true });
    }
  }, [firstErrorKey, state]);

  useEffect(() => {
    if (!createdStoreSlug) {
      return;
    }

    router.replace(`/${locale}${ROUTES.stores}/${createdStoreSlug}`);
  }, [createdStoreSlug, locale, router]);

  useEffect(() => {
    if (showConfirmDuplicate && duplicateModalCancelRef.current) {
      duplicateModalCancelRef.current.focus();
    }
  }, [showConfirmDuplicate]);

  const renderLogoError = (errorKey: string) => {
    return tValidation.has(errorKey)
      ? tValidation(errorKey as never)
      : t.has(`error.${errorKey}`)
        ? t(`error.${errorKey}` as never)
        : t("error.create_failed");
  };

  if (success) {
    return (
      <div className="space-y-6">
        <Typography size="sm" className="text-text-body" role="status" aria-live="polite">
          {t("success.redirectingToStore")}
        </Typography>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Heading as="h2" size="sm" className="text-text-title">
        {tCreate("title")}
      </Heading>

      {showConfirmDuplicate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="duplicate-dialog-title"
          aria-describedby="duplicate-dialog-desc"
        >
          <button
            type="button"
            className="bg-background/70 absolute inset-0 backdrop-blur-sm"
            onClick={handleCancelDuplicateConfirm}
            aria-hidden
            tabIndex={-1}
          />
          <div className="border-border bg-background relative z-10 w-full max-w-lg rounded-xl border p-6 shadow-xl">
            <Heading as="h3" id="duplicate-dialog-title" size="sm" className="text-text-title mb-2">
              {t("duplicate.submitModalTitle")}
            </Heading>
            <Typography id="duplicate-dialog-desc" size="sm" className="text-text-body mb-4">
              {t("duplicate.submitModalDescription", { percent: SIMILARITY_THRESHOLD_PERCENT })}
            </Typography>
            <div className="mb-6">
              <DuplicateCandidatesList candidates={duplicateCandidates} locale={locale} tCountries={tCountries} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={handleConfirmCreateAnyway} type="button">
                {t("duplicate.confirmCreate")}
              </Button>
              <Button
                ref={duplicateModalCancelRef}
                variant="secondary"
                onClick={handleCancelDuplicateConfirm}
                type="button"
              >
                {t("duplicate.cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {serverError && (
        <Typography size="sm" className="text-destructive" role="alert">
          {t.has(`error.${serverError}` as never) ? t(`error.${serverError}` as never) : t("error.create_failed")}
        </Typography>
      )}

      <form ref={formRef} className="space-y-5" onSubmit={handleFormSubmit}>
        <StoreFormSectionCard eyebrow={tCreate("basicsEyebrow")} title={tCreate("basicsTitle")}>
          <div className="space-y-3">
            <Label>{tCreate("storeTypeLabel")}</Label>
            <StoreSegmentedControl
              name="storeType"
              options={storeTypeOptions}
              value={storeType}
              onChange={(value) => {
                const nextStoreType = value as "BUSINESS" | "PERSON";
                setStoreType(nextStoreType);
                if (nextStoreType === "PERSON") {
                  setLogoSubmission({
                    action: "keep",
                    file: null,
                    cropArea: null,
                  });
                }
              }}
            />
          </div>

          <div>
            <Label htmlFor="store-name">{tCreate("nameLabel")}</Label>
            <Input
              id="store-name"
              name="name"
              type="text"
              value={nameValue}
              onChange={handleNameChange}
              onBlur={handleNameBlur}
              placeholder={tCreate("namePlaceholder")}
              required
              maxLength={200}
              error={!!fieldErrors.name?.length}
              aria-invalid={!!fieldErrors.name?.length}
              aria-describedby={duplicateCandidates.length > 0 ? "duplicate-suggestions" : undefined}
            />
            {fieldErrors.name?.[0] && (
              <Typography size="xs" className="text-destructive mt-1" role="alert">
                {tValidation(fieldErrors.name[0] as "nameRequired" | "nameTooLong")}
              </Typography>
            )}
            {duplicateCandidates.length > 0 && !showConfirmDuplicate && (
              <div
                id="duplicate-suggestions"
                className="border-primary/35 bg-primary/8 ring-primary/20 mt-2 rounded-xl border p-3.5 shadow-sm ring-1"
                role="status"
              >
                <Typography size="xs" className="text-text-title mb-1.5 font-semibold">
                  {t("duplicate.suggestionsTitle")}
                </Typography>
                <Typography size="2xs" className="text-text-muted mb-2">
                  {t("duplicate.suggestionsDescription")}
                </Typography>
                <DuplicateCandidatesList candidates={duplicateCandidates} locale={locale} tCountries={tCountries} />
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="store-description">{tCreate("descriptionLabel")}</Label>
            <Textarea
              id="store-description"
              name="description"
              placeholder={tCreate("descriptionPlaceholder")}
              rows={3}
              maxLength={2000}
            />
          </div>

          {storeType === "BUSINESS" ? (
            <StoreLogoField
              id="store-logo"
              copy={{
                label: t("logo.label"),
                helper: t("logo.helper"),
                emptyTitle: t("logo.emptyTitle"),
                emptyDescription: t("logo.emptyDescription"),
                uploadCta: t("logo.uploadCta"),
                editCta: t("logo.editCta"),
                replaceCta: t("logo.replaceCta"),
                removeCta: t("logo.removeCta"),
                editorTitle: t("logo.editorTitle"),
                editorDescription: t("logo.editorDescription"),
                zoomLabel: t("logo.zoomLabel"),
                editorCancel: t("logo.editorCancel"),
                editorConfirm: t("logo.editorConfirm"),
                acceptedFormats: t("logo.acceptedFormats"),
                maxSize: t("logo.maxSize", { size: STORE_LOGO_MAX_SOURCE_SIZE_MB }),
              }}
              error={logoError}
              renderError={renderLogoError}
              onChange={setLogoSubmission}
              onRemove={() =>
                posthog.capture(POSTHOG_EVENTS.STORE.LOGO_REMOVED, {
                  flow: "create",
                })
              }
            />
          ) : null}

          <div className="space-y-3">
            <Label>{tCreate("countryLabel")}</Label>
            <Select
              id="store-country"
              name="countryCode"
              required
              aria-invalid={!!fieldErrors.countryCode?.length}
              error={!!fieldErrors.countryCode?.length}
            >
              <option value="">{tCreate("countryPlaceholder")}</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {tCountries(country.code)}
                </option>
              ))}
            </Select>
            {fieldErrors.countryCode?.[0] && (
              <Typography size="xs" className="text-destructive mt-1" role="alert">
                {tValidation("countryInvalid")}
              </Typography>
            )}
          </div>
        </StoreFormSectionCard>

        <StoreFormSectionCard
          eyebrow={tCreate("commercialEyebrow")}
          title={tCreate("commercialTitle")}
          action={<StoreProductTypeRequestModal locale={locale} source="create" />}
        >
          <div className="space-y-3">
            <Label>{tCreate("presenceLabel")}</Label>
            <div
              data-field="presenceTypes"
              className={cn(hasPresenceError && "border-destructive rounded-lg border p-2")}
            >
              <StoreSelectableTagGroup
                options={presenceOptions}
                selectedValues={presenceTypes}
                onChange={(values) => setPresenceTypes(values as Array<"ONLINE" | "PHYSICAL">)}
                inputName="presenceTypes"
                tagClassName="min-h-11"
              />
            </div>
            {fieldErrors.presenceTypes?.[0] && (
              <Typography size="xs" className="text-destructive mt-1" role="alert">
                {tValidation("presenceRequired")}
              </Typography>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StoreToggleSwitch
              label={tCreate("hasStockLabel")}
              checked={hasStock}
              onChange={setHasStock}
              name="hasStock"
            />
            <StoreToggleSwitch
              label={tCreate("receivesOrdersLabel")}
              checked={receivesOrders}
              onChange={setReceivesOrders}
              name="receivesOrders"
            />
          </div>

          <div className="space-y-3">
            <Label>{tCreate("productTypesLabel")}</Label>
            <div
              data-field="productTypeKeys"
              className={cn(hasProductTypeError && "border-destructive rounded-lg border p-2")}
            >
              <StoreSelectableTagGroup
                options={productTypeOptions}
                selectedValues={selectedProductTypeKeys}
                onChange={setSelectedProductTypeKeys}
                inputName="productTypeKeys"
              />
            </div>
            {fieldErrors.productTypeKeys?.[0] && (
              <Typography size="xs" className="text-destructive mt-1" role="alert">
                {tValidation(fieldErrors.productTypeKeys[0] as "productTypeRequired" | "productTypeInvalid")}
              </Typography>
            )}
          </div>

          <div className="space-y-3">
            <Label htmlFor="import-countries-input">{tCreate("importCountriesLabel")}</Label>
            <StoreMultiTagAutocomplete
              id="import-countries-input"
              options={countryOptions}
              selectedValues={selectedImportCountries}
              onChange={setSelectedImportCountries}
              placeholder={tCreate("importCountriesPlaceholder")}
              inputName="importCountries"
              helperText={tCreate("importCountriesHelper")}
              removeItemAriaLabel={(itemLabel) => `${tCreate("remove")} ${itemLabel}`}
            />
          </div>
        </StoreFormSectionCard>

        {storeType === "BUSINESS" && (
          <section className="space-y-5">
            <StoreFormSectionCard
              eyebrow={tCreate("businessEyebrow")}
              title={tCreate("contactChannelsLabel")}
              action={
                <Button type="button" variant="secondary" size="sm" onClick={handleAddContactChannel}>
                  <Plus size={16} className="mr-1" aria-hidden />
                  {tCreate("addContactChannel")}
                </Button>
              }
            >
              {contactChannelRows.length === 0 ? (
                <StoreEmptyStateBox message={tCreate("noContactChannels")} />
              ) : (
                <StoreContactChannelList
                  idPrefix="contact-channel"
                  rows={contactChannelRows.map((rowId, rowIndex) => ({
                    rowId,
                    rowIndex,
                    type: getContactChannelTypeForRow(rowId, rowIndex),
                    typeError: getContactChannelTypeError(rowIndex) ?? undefined,
                    valueError: getContactChannelValueError(rowIndex) ?? undefined,
                  }))}
                  typeInputName="contactChannelType"
                  valueInputName="contactChannelValue"
                  typeLabel={tCreate("contactChannelType")}
                  valueLabel={tCreate("contactChannelValue")}
                  removeLabel={tCreate("remove")}
                  optionLabel={(type) => tChannelTypes(type)}
                  valuePlaceholder={getContactChannelPlaceholder}
                  onTypeChange={(rowId, nextType) => {
                    setContactChannelTypeByRowId((previous) => ({
                      ...previous,
                      [rowId]: nextType,
                    }));
                  }}
                  onRemove={handleRemoveContactChannel}
                  renderValueError={(errorKey) =>
                    tValidation(
                      errorKey as
                        | "contactValueRequired"
                        | "contactValueInvalidWebsite"
                        | "contactValueInvalidWhatsApp"
                        | "contactValueInvalidInstagram"
                        | "contactValueInvalidFacebook"
                        | "contactValueInvalidTikTok"
                        | "contactValueInvalidEmail"
                        | "contactValueInvalidPhone",
                    )
                  }
                />
              )}
            </StoreFormSectionCard>

            <StoreFormSectionCard
              eyebrow={tCreate("businessEyebrow")}
              title={tCreate("addressesLabel")}
              action={
                <Button type="button" variant="secondary" size="sm" onClick={handleAddAddress}>
                  <Plus size={16} className="mr-1" aria-hidden />
                  {tCreate("addAddress")}
                </Button>
              }
            >
              {addressRows.length === 0 ? (
                <StoreEmptyStateBox message={tCreate("noAddresses")} />
              ) : (
                <StoreAddressList
                  idPrefix="address"
                  rows={addressRows.map((rowId, rowIndex) => ({
                    rowId,
                    rowIndex,
                  }))}
                  countryOptions={countryOptions}
                  emptyCountryLabel={tCreate("countryPlaceholder")}
                  countryLabel={tCreate("addressCountry")}
                  cityLabel={tCreate("addressCity")}
                  addressLineLabel={tCreate("addressLine")}
                  referenceLabel={tCreate("addressReference")}
                  countryInputName="addressCountryCode"
                  cityInputName="addressCity"
                  addressLineInputName="addressAddressLine"
                  referenceInputName="addressReference"
                  removeLabel={tCreate("remove")}
                  onRemove={handleRemoveAddress}
                />
              )}
            </StoreFormSectionCard>
          </section>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? tCreate("submitting") : tCreate("submit")}
          </Button>
          <BackNavLink href={`/${locale}${ROUTES.stores}`}>{tCreate("backToList")}</BackNavLink>
        </div>
      </form>
    </div>
  );
}

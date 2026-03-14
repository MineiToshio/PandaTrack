"use client";

import { Plus, X } from "lucide-react";
import { startTransition, useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import Label from "@/components/core/Label";
import Input from "@/components/core/Input";
import Textarea from "@/components/core/Textarea";
import Button from "@/components/core/Button/Button";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import { cn } from "@/lib/styles";
import { ROUTES } from "@/lib/constants";
import { POSTHOG_EVENTS } from "@/lib/constants";
import posthog from "posthog-js";
import { createStore, type CreateStoreResult } from "../_actions/createStore";
import { getDuplicateCandidates } from "../_actions/getDuplicateCandidates";
import StoreSelect from "./StoreSelect";
import StoreSegmentedControl from "./StoreSegmentedControl";
import StoreSelectableTagGroup from "./StoreSelectableTagGroup";
import StoreToggleSwitch from "./StoreToggleSwitch";
import StoreMultiTagAutocomplete from "./StoreMultiTagAutocomplete";
import StoreFormSectionCard from "./StoreFormSectionCard";
import StoreEmptyStateBox from "./StoreEmptyStateBox";

type DuplicateCandidate = { id: string; name: string; slug: string };

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;
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

const resolveFirstErrorElement = (form: HTMLFormElement, fieldKey: string): HTMLElement | null => {
  if (fieldKey === "name") return form.querySelector("#store-name");
  if (fieldKey === "description") return form.querySelector("#store-description");
  if (fieldKey === "countryCode") return form.querySelector("#store-country");
  if (fieldKey === "presenceTypes") return form.querySelector('[data-field="presenceTypes"] button');
  if (fieldKey === "categoryKeys") return form.querySelector('[data-field="categoryKeys"] button');
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

export type CreateStoreFormProps = {
  countries: { code: string }[];
  categories: { key: string }[];
};

export default function CreateStoreForm({ countries, categories }: CreateStoreFormProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("stores");
  const tCreate = useTranslations("stores.create");
  const tValidation = useTranslations("stores.validation");
  const tCountries = useTranslations("countries");
  const tCategories = useTranslations("storeCategories");
  const tChannelTypes = useTranslations("stores.contactChannelTypes");

  const [storeType, setStoreType] = useState<"BUSINESS" | "PERSON">("BUSINESS");
  const [hasStock, setHasStock] = useState(false);
  const [receivesOrders, setReceivesOrders] = useState(false);
  const [presenceTypes, setPresenceTypes] = useState<Array<"ONLINE" | "PHYSICAL">>(["ONLINE"]);
  const [selectedCategoryKeys, setSelectedCategoryKeys] = useState<string[]>([]);
  const [selectedImportCountries, setSelectedImportCountries] = useState<string[]>([]);
  const [contactChannelRows, setContactChannelRows] = useState<number[]>([]);
  const [addressRows, setAddressRows] = useState<number[]>([]);
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const fetchCandidates = useCallback((query: string) => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setDuplicateCandidates([]);
      return;
    }
    getDuplicateCandidates(query).then((list) => {
      setDuplicateCandidates(list);
      if (list.length > 0) {
        posthog.capture(POSTHOG_EVENTS.STORE.DUPLICATE_SUGGESTIONS_SHOWN, {
          candidate_count: list.length,
          name_query: query,
        });
      }
    });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchCandidates(nameValue), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [nameValue, fetchCandidates]);

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
      { value: "BUSINESS", label: tCreate("storeTypeBusiness") },
      { value: "PERSON", label: tCreate("storeTypePerson") },
    ],
    [tCreate],
  );

  const presenceOptions = useMemo(
    () => [
      { value: "ONLINE", label: tCreate("presenceOnline") },
      { value: "PHYSICAL", label: tCreate("presencePhysical") },
    ],
    [tCreate],
  );

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.key,
        label: tCategories(category.key),
      })),
    [categories, tCategories],
  );

  const handleAddContactChannel = () => {
    const nextId = nextContactRowIdRef.current;
    nextContactRowIdRef.current += 1;
    setContactChannelRows((previous) => [...previous, nextId]);
  };

  const handleRemoveContactChannel = (rowId: number) => {
    setContactChannelRows((previous) => previous.filter((item) => item !== rowId));
  };

  const handleAddAddress = () => {
    const nextId = nextAddressRowIdRef.current;
    nextAddressRowIdRef.current += 1;
    setAddressRows((previous) => [...previous, nextId]);
  };

  const handleRemoveAddress = (rowId: number) => {
    setAddressRows((previous) => previous.filter((item) => item !== rowId));
  };

  const handleSubmit = (formData: FormData) => {
    if (duplicateCandidates.length > 0) {
      setShowConfirmDuplicate(true);
      pendingFormDataRef.current = formData;
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

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSubmit(new FormData(event.currentTarget));
  };

  const success = state?.success === true;
  const createdStoreSlug = success && "slug" in state ? state.slug : null;
  const fieldErrors = state?.success === false && "fieldErrors" in state ? (state.fieldErrors ?? {}) : {};
  const serverError = state?.success === false && "error" in state ? state.error : null;
  const firstErrorKey = Object.keys(fieldErrors)[0];
  const hasPresenceError = !!fieldErrors.presenceTypes?.length;
  const hasCategoryError = !!fieldErrors.categoryKeys?.length;

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

    router.replace(`/${locale}/store/${createdStoreSlug}`);
  }, [createdStoreSlug, locale, router]);

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
          className="border-border bg-muted/30 rounded-lg border p-4"
          role="alertdialog"
          aria-labelledby="duplicate-dialog-title"
          aria-describedby="duplicate-dialog-desc"
        >
          <Heading as="h3" id="duplicate-dialog-title" size="xs" className="text-text-title mb-2">
            {t("duplicate.suggestionsTitle")}
          </Heading>
          <Typography id="duplicate-dialog-desc" size="sm" className="text-text-body mb-4">
            {t("duplicate.suggestionsDescription")}
          </Typography>
          <ul className="text-text-body mb-4 list-disc space-y-1 pl-5 text-sm">
            {duplicateCandidates.map((c) => (
              <li key={c.id}>
                {c.name} <span className="text-text-muted">({c.slug})</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={handleConfirmCreateAnyway} type="button">
              {t("duplicate.confirmCreate")}
            </Button>
            <Button variant="secondary" onClick={handleCancelDuplicateConfirm} type="button">
              {t("duplicate.cancel")}
            </Button>
          </div>
        </div>
      )}

      {serverError && (
        <Typography size="sm" className="text-destructive" role="alert">
          {t(`error.${serverError as "unauthorized" | "validation_failed" | "create_failed"}`)}
        </Typography>
      )}

      <form ref={formRef} className="space-y-5" onSubmit={handleFormSubmit}>
        <StoreFormSectionCard eyebrow={tCreate("basicsEyebrow")} title={tCreate("basicsTitle")}>
          <div>
            <Label htmlFor="store-name">{tCreate("nameLabel")}</Label>
            <Input
              id="store-name"
              name="name"
              type="text"
              value={nameValue}
              onChange={(event) => setNameValue(event.target.value)}
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
                className="border-border bg-muted/20 mt-2 rounded border p-3"
                role="status"
              >
                <Typography size="xs" className="text-text-title mb-1 font-medium">
                  {t("duplicate.suggestionsTitle")}
                </Typography>
                <ul className="text-text-body list-disc space-y-0.5 pl-4 text-xs">
                  {duplicateCandidates.map((candidate) => (
                    <li key={candidate.id}>
                      {candidate.name} <span className="text-text-muted">({candidate.slug})</span>
                    </li>
                  ))}
                </ul>
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

          <div className="space-y-3">
            <Label>{tCreate("storeTypeLabel")}</Label>
            <StoreSegmentedControl
              name="storeType"
              options={storeTypeOptions}
              value={storeType}
              onChange={(value) => setStoreType(value as "BUSINESS" | "PERSON")}
            />
          </div>

          <div className="space-y-3">
            <Label>{tCreate("countryLabel")}</Label>
            <StoreSelect
              id="store-country"
              name="countryCode"
              required
              aria-invalid={!!fieldErrors.countryCode?.length}
              className={cn(fieldErrors.countryCode?.length && "border-destructive focus-visible:ring-destructive")}
            >
              <option value="">{locale === "es" ? "Selecciona país" : "Select country"}</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {tCountries(country.code)}
                </option>
              ))}
            </StoreSelect>
            {fieldErrors.countryCode?.[0] && (
              <Typography size="xs" className="text-destructive mt-1" role="alert">
                {tValidation("countryInvalid")}
              </Typography>
            )}
          </div>
        </StoreFormSectionCard>

        <StoreFormSectionCard eyebrow={tCreate("commercialEyebrow")} title={tCreate("commercialTitle")}>
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
            <Label>{tCreate("categoriesLabel")}</Label>
            <div
              data-field="categoryKeys"
              className={cn(hasCategoryError && "border-destructive rounded-lg border p-2")}
            >
              <StoreSelectableTagGroup
                options={categoryOptions}
                selectedValues={selectedCategoryKeys}
                onChange={setSelectedCategoryKeys}
                inputName="categoryKeys"
              />
            </div>
            {fieldErrors.categoryKeys?.[0] && (
              <Typography size="xs" className="text-destructive mt-1" role="alert">
                {tValidation("categoryInvalid")}
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
                <div className="space-y-3">
                  {contactChannelRows.map((rowId, rowIndex) => (
                    <div
                      key={rowId}
                      className={cn(
                        "border-border bg-background rounded-lg border p-3",
                        (getContactChannelTypeError(rowIndex) || getContactChannelValueError(rowIndex)) &&
                          "border-destructive",
                      )}
                    >
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[140px_minmax(0,1fr)_auto]">
                        <div className="min-w-0 md:max-w-[140px]">
                          <Label htmlFor={`contact-channel-type-${rowId}`} className="text-xs">
                            {tCreate("contactChannelType")}
                          </Label>
                          <StoreSelect
                            id={`contact-channel-type-${rowId}`}
                            name="contactChannelType"
                            className={cn(
                              "px-2 py-1.5",
                              getContactChannelTypeError(rowIndex) &&
                                "border-destructive focus-visible:ring-destructive",
                            )}
                            defaultValue={CONTACT_CHANNEL_TYPES[rowIndex % CONTACT_CHANNEL_TYPES.length]}
                            aria-invalid={!!getContactChannelTypeError(rowIndex)}
                          >
                            {CONTACT_CHANNEL_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {tChannelTypes(type)}
                              </option>
                            ))}
                          </StoreSelect>
                        </div>
                        <div className="min-w-0">
                          <Label htmlFor={`contact-channel-value-${rowId}`} className="text-xs">
                            {tCreate("contactChannelValue")}
                          </Label>
                          <Input
                            id={`contact-channel-value-${rowId}`}
                            name="contactChannelValue"
                            type="text"
                            placeholder="https://..."
                            error={!!getContactChannelValueError(rowIndex)}
                            aria-invalid={!!getContactChannelValueError(rowIndex)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveContactChannel(rowId)}
                          aria-label={tCreate("remove")}
                          className="h-10 justify-center self-end"
                        >
                          <X size={16} aria-hidden />
                        </Button>
                      </div>
                      {getContactChannelValueError(rowIndex) && (
                        <Typography size="xs" className="text-destructive mt-2" role="alert">
                          {tValidation(
                            getContactChannelValueError(rowIndex) as
                              | "contactValueRequired"
                              | "contactValueInvalidWebsite"
                              | "contactValueInvalidWhatsApp"
                              | "contactValueInvalidInstagram"
                              | "contactValueInvalidFacebook"
                              | "contactValueInvalidTikTok"
                              | "contactValueInvalidEmail"
                              | "contactValueInvalidPhone",
                          )}
                        </Typography>
                      )}
                    </div>
                  ))}
                </div>
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
                <div className="space-y-3">
                  {addressRows.map((rowId, rowIndex) => (
                    <div key={rowId} className="border-border bg-background space-y-3 rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Typography size="xs" className="text-text-muted font-medium">
                          {tCreate("addressItemLabel", { index: rowIndex + 1 })}
                        </Typography>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAddress(rowId)}
                          aria-label={tCreate("remove")}
                        >
                          <X size={16} aria-hidden />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="min-w-0">
                          <Label htmlFor={`address-country-${rowId}`} className="text-xs">
                            {tCreate("addressCountry")}
                          </Label>
                          <StoreSelect
                            id={`address-country-${rowId}`}
                            name="addressCountryCode"
                            className="px-2 py-1.5"
                          >
                            <option value="">-</option>
                            {countries.map((country) => (
                              <option key={country.code} value={country.code}>
                                {tCountries(country.code)}
                              </option>
                            ))}
                          </StoreSelect>
                        </div>
                        <div className="min-w-0">
                          <Label htmlFor={`address-city-${rowId}`} className="text-xs">
                            {tCreate("addressCity")}
                          </Label>
                          <Input id={`address-city-${rowId}`} name="addressCity" type="text" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="min-w-0">
                          <Label htmlFor={`address-line-${rowId}`} className="text-xs">
                            {tCreate("addressLine")}
                          </Label>
                          <Input
                            id={`address-line-${rowId}`}
                            name="addressAddressLine"
                            type="text"
                            required={rowIndex === 0}
                          />
                        </div>
                        <div className="min-w-0">
                          <Label htmlFor={`address-reference-${rowId}`} className="text-xs">
                            {tCreate("addressReference")}
                          </Label>
                          <Input id={`address-reference-${rowId}`} name="addressReference" type="text" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </StoreFormSectionCard>
          </section>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? tCreate("submitting") : tCreate("submit")}
          </Button>
          <Link href={`/${locale}${ROUTES.stores}`} className={cn(buttonVariants({ variant: "secondary" }))}>
            {tCreate("backToList")}
          </Link>
        </div>
      </form>
    </div>
  );
}

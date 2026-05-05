"use client";

import { AlertTriangle, Box, Building2, Check, Globe, Plus, UserRound } from "lucide-react";
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
import Typography from "@/components/core/Typography";
import Eyebrow from "@/components/core/Eyebrow";
import Label from "@/components/core/Label";
import Input from "@/components/core/Input";
import Select from "@/components/core/Select";
import Textarea from "@/components/core/Textarea";
import Button from "@/components/core/Button/Button";
import Modal from "@/components/modules/Modal/Modal";
import { WizardAccordion, WizardStep } from "@/components/modules/WizardAccordion";
import type { StepperStep } from "@/components/core/Stepper";
import BackNavLink from "@/components/core/BackNavLink";
import { cn } from "@/lib/styles";
import { POSTHOG_EVENTS, RETURN_TO_ORDER_CREATE, ROUTES } from "@/lib/constants";
import posthog from "posthog-js";
import { createStore, type CreateStoreResult } from "../_actions/createStore";
import { getDuplicateCandidates, getDuplicateCandidatesForSubmit } from "../_actions/getDuplicateCandidates";
import { SIMILARITY_THRESHOLD_PERCENT } from "@/lib/store/duplicateMatch";
import { STORE_LOGO_MAX_SOURCE_SIZE_MB } from "@/lib/store/logoShared";
import StoreAddressList from "../../_components/share/StoreAddressList";
import StoreContactChannelList, {
  STORE_CONTACT_CHANNEL_TYPES,
  type StoreContactChannelType,
} from "../../_components/share/StoreContactChannelList";
import StoreEmptyStateBox from "../../_components/share/StoreEmptyStateBox";
import StoreLogoField, { type StoreLogoSubmission } from "../../_components/share/StoreLogoField/StoreLogoField";
import CollectorCountryFlagEmoji from "../../_components/share/CollectorCountryFlagEmoji";
import MultiTagAutocomplete from "@/components/core/MultiTagAutocomplete";
import StoreProductTypeRequestModal from "../../_components/share/StoreProductTypeRequestModal";
import StoreToggleSwitch from "../../_components/share/StoreToggleSwitch";
import DuplicateAlertInline from "../../_components/share/DuplicateAlertInline";
import ToggleChoiceGroup from "@/components/core/ToggleChoiceGroup";

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
  returnTo?: string;
};

export default function CreateStoreForm({ countries, productTypes, returnTo }: CreateStoreFormProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("stores");
  const tCreate = useTranslations("stores.create");
  const tCreateRedesign = useTranslations("stores.redesign.create");
  const tValidation = useTranslations("stores.validation");
  const tCountries = useTranslations("countries");
  const tProductTypes = useTranslations("storeProductTypes");
  const tChannelTypes = useTranslations("stores.contactChannelTypes");

  const [storeType, setStoreType] = useState<"BUSINESS" | "PERSON">("BUSINESS");
  const [isPrivate, setIsPrivate] = useState(false);
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
  const [descriptionValue, setDescriptionValue] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [showConfirmDuplicate, setShowConfirmDuplicate] = useState(false);
  const pendingFormDataRef = useRef<FormData | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

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
        leadingDecoration: <CollectorCountryFlagEmoji countryCode={country.code} />,
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
    const submittedCountryCode = typeof submittedCountry === "string" ? submittedCountry : "";
    const submitCandidates = await getDuplicateCandidatesForSubmit(nameToValidate, submittedCountryCode);
    if (submitCandidates.length > 0) {
      setDuplicateCandidates(submitCandidates);
      setShowConfirmDuplicate(true);
      pendingFormDataRef.current = formData;
      posthog.capture(POSTHOG_EVENTS.STORE.DUPLICATE_SUBMIT_MODAL_SHOWN, {
        candidate_count: submitCandidates.length,
        name_query: nameToValidate,
        country_code: submittedCountryCode,
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

  const triggerSubmit = () => {
    formRef.current?.requestSubmit();
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

    if (returnTo === RETURN_TO_ORDER_CREATE && state?.success === true && "storeId" in state) {
      router.replace(`/${locale}${ROUTES.ordersNew}?store=${state.storeId}`);
    } else {
      router.replace(`/${locale}${ROUTES.stores}/${createdStoreSlug}`);
    }
  }, [createdStoreSlug, locale, router, returnTo, state]);

  const renderLogoError = (errorKey: string) => {
    return tValidation.has(errorKey)
      ? tValidation(errorKey as never)
      : t.has(`error.${errorKey}`)
        ? t(`error.${errorKey}` as never)
        : t("error.create_failed");
  };

  // Wizard step list. For PERSON the "Channels" step is omitted (no contact channels / addresses).
  const stepperSteps: StepperStep[] = useMemo(() => {
    if (storeType === "BUSINESS") {
      return [
        { n: 1, label: tCreateRedesign("step1.eyebrow") },
        { n: 2, label: tCreateRedesign("step2.eyebrow") },
        { n: 3, label: tCreateRedesign("step3.eyebrow") },
        { n: 4, label: tCreateRedesign("step4.eyebrow") },
        { n: 5, label: tCreateRedesign("step5.eyebrow") },
      ];
    }
    return [
      { n: 1, label: tCreateRedesign("step1.eyebrow") },
      { n: 2, label: tCreateRedesign("step2.eyebrow") },
      { n: 3, label: tCreateRedesign("step3.eyebrow") },
      { n: 4, label: tCreateRedesign("step5.eyebrow") },
    ];
  }, [storeType, tCreateRedesign]);

  if (success) {
    return (
      <div className="space-y-6">
        <Typography size="sm" className="text-text-body" role="status" aria-live="polite">
          {t("success.redirectingToStore")}
        </Typography>
      </div>
    );
  }

  // Step 2 needs a non-empty trimmed name and a country.
  const step2Valid = nameValue.trim().length > 0 && countryCode.length === 2;
  // Step 3 needs at least one product type and at least one presence type.
  const step3Valid = selectedProductTypeKeys.length > 0 && presenceTypes.length > 0;
  const reviewStepN = storeType === "BUSINESS" ? 5 : 4;

  const renderReviewSummary = () => (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <SummaryRow
        label={tCreate("storeTypeLabel")}
        value={storeType === "BUSINESS" ? tCreate("storeTypeBusiness") : tCreate("storeTypePerson")}
      />
      {storeType === "PERSON" && isPrivate && <SummaryRow label={tCreateRedesign("step1.privateLabel")} value="✓" />}
      <SummaryRow label={tCreate("nameLabel")} value={nameValue || "—"} />
      <SummaryRow label={tCreate("countryLabel")} value={countryCode ? tCountries(countryCode) : "—"} />
      <SummaryRow
        label={tCreate("presenceLabel")}
        value={
          presenceTypes
            .map((p) =>
              tCreate(`presence${p === "ONLINE" ? "Online" : "Physical"}` as "presenceOnline" | "presencePhysical"),
            )
            .join(" · ") || "—"
        }
      />
      <SummaryRow
        label={tCreate("productTypesLabel")}
        value={selectedProductTypeKeys.map((k) => tProductTypes(k)).join(" · ") || "—"}
      />
      {selectedImportCountries.length > 0 && (
        <SummaryRow
          label={tCreate("importCountriesLabel")}
          value={selectedImportCountries.map((code) => tCountries(code)).join(" · ")}
        />
      )}
      {storeType === "BUSINESS" && contactChannelRows.length > 0 && (
        <SummaryRow label={tCreate("contactChannelsLabel")} value={`${contactChannelRows.length}`} />
      )}
      {storeType === "BUSINESS" && addressRows.length > 0 && (
        <SummaryRow label={tCreate("addressesLabel")} value={`${addressRows.length}`} />
      )}
    </dl>
  );

  return (
    <div className="space-y-4">
      <BackNavLink href={`/${locale}${ROUTES.stores}`}>{tCreate("backToList")}</BackNavLink>

      <Modal
        isOpen={showConfirmDuplicate}
        onClose={handleCancelDuplicateConfirm}
        title={t("duplicate.submitModalTitle")}
        subtitle={t("duplicate.submitModalDescription", { percent: SIMILARITY_THRESHOLD_PERCENT })}
        icon={<AlertTriangle size={20} aria-hidden="true" />}
        tone="warning"
        primaryAction={{
          label: t("duplicate.confirmCreate"),
          onClick: handleConfirmCreateAnyway,
        }}
        secondaryAction={{
          label: t("duplicate.cancel"),
          onClick: handleCancelDuplicateConfirm,
        }}
      >
        <DuplicateCandidatesList candidates={duplicateCandidates} locale={locale} tCountries={tCountries} />
      </Modal>

      {serverError && (
        <Typography size="sm" className="text-destructive" role="alert">
          {t.has(`error.${serverError}` as never) ? t(`error.${serverError}` as never) : t("error.create_failed")}
        </Typography>
      )}

      <form ref={formRef} onSubmit={handleFormSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {/* Hidden inputs for fields not always present in the active step's DOM */}
        <input type="hidden" name="storeType" value={storeType} />
        {storeType === "PERSON" && isPrivate && <input type="hidden" name="isPrivate" value="on" />}
        {hasStock && <input type="hidden" name="hasStock" value="on" />}
        {receivesOrders && <input type="hidden" name="receivesOrders" value="on" />}

        <div className="min-w-0">
          <WizardAccordion startStep={1} steps={stepperSteps} stepperAriaLabel={tCreateRedesign("stepperLabel")}>
            {/* ── Step 1: Tipo ── */}
            <WizardStep
              n={1}
              eyebrow={tCreateRedesign("step1.eyebrow")}
              title={tCreateRedesign("step1.title")}
              primaryAction={{ label: tCreateRedesign("continue") }}
              summary={storeType === "BUSINESS" ? tCreate("storeTypeBusiness") : tCreate("storeTypePerson")}
            >
              <div className="space-y-4">
                <Typography size="xs" className="text-text-muted">
                  {tCreateRedesign("step1.helper")}
                </Typography>
                <div className="space-y-3">
                  <Label>{tCreate("storeTypeLabel")}</Label>
                  <ToggleChoiceGroup
                    mode="single"
                    appearance="tile"
                    options={storeTypeOptions}
                    value={storeType}
                    onChange={(value) => {
                      const nextStoreType = value as "BUSINESS" | "PERSON";
                      setStoreType(nextStoreType);
                      if (nextStoreType === "PERSON") {
                        setLogoSubmission({ action: "keep", file: null, cropArea: null });
                      } else {
                        setIsPrivate(false);
                      }
                    }}
                  />
                </div>

                {storeType === "PERSON" && (
                  <div className="space-y-2 pt-4 [border-top:1px_solid_var(--border)]">
                    <StoreToggleSwitch
                      label={tCreateRedesign("step1.privateLabel")}
                      checked={isPrivate}
                      onChange={setIsPrivate}
                    />
                    <Typography size="xs" className="text-text-muted [line-height:1.5]">
                      {tCreateRedesign("step1.privateHelper")}
                    </Typography>
                  </div>
                )}
              </div>
            </WizardStep>

            {/* ── Step 2: Identidad ── */}
            <WizardStep
              n={2}
              eyebrow={tCreateRedesign("step2.eyebrow")}
              title={tCreateRedesign("step2.title")}
              primaryAction={{ label: tCreateRedesign("continue"), disabled: !step2Valid }}
              secondaryAction={{ label: tCreateRedesign("back") }}
              summary={nameValue && countryCode ? `${nameValue} · ${tCountries(countryCode)}` : undefined}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
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
                  />
                  {fieldErrors.name?.[0] && (
                    <Typography size="xs" className="text-destructive mt-1" role="alert">
                      {tValidation(fieldErrors.name[0] as "nameRequired" | "nameTooLong")}
                    </Typography>
                  )}
                  {!showConfirmDuplicate && (
                    <DuplicateAlertInline
                      candidates={duplicateCandidates}
                      locale={locale}
                      labels={{
                        eyebrow: tCreateRedesign("duplicate.eyebrow"),
                        title: tCreateRedesign("duplicate.title"),
                        viewStore: tCreateRedesign("duplicate.viewStore"),
                        countryName: (code) => tCountries(code),
                      }}
                      className="mt-2"
                    />
                  )}
                </div>

                <div>
                  <Label htmlFor="store-country">{tCreate("countryLabel")}</Label>
                  <Select
                    id="store-country"
                    name="countryCode"
                    required
                    value={countryCode}
                    onChange={(event) => setCountryCode(event.target.value)}
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

                <div className="md:col-span-2">
                  <Label htmlFor="store-description">{tCreate("descriptionLabel")}</Label>
                  <Textarea
                    id="store-description"
                    name="description"
                    value={descriptionValue}
                    onChange={(event) => setDescriptionValue(event.target.value)}
                    placeholder={tCreate("descriptionPlaceholder")}
                    rows={3}
                    maxLength={2000}
                  />
                </div>

                {storeType === "BUSINESS" && (
                  <div className="md:col-span-2">
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
                  </div>
                )}
              </div>
            </WizardStep>

            {/* ── Step 3: Categorías y presencia ── */}
            <WizardStep
              n={3}
              eyebrow={tCreateRedesign("step3.eyebrow")}
              title={tCreateRedesign("step3.title")}
              primaryAction={{ label: tCreateRedesign("continue"), disabled: !step3Valid }}
              secondaryAction={{ label: tCreateRedesign("back") }}
              summary={
                selectedProductTypeKeys.length > 0
                  ? selectedProductTypeKeys.length === 1
                    ? tProductTypes(selectedProductTypeKeys[0])
                    : `${selectedProductTypeKeys.length}`
                  : undefined
              }
            >
              <div className="space-y-5">
                <div className="space-y-3">
                  <Label>{tCreate("productTypesLabel")}</Label>
                  <div
                    data-field="productTypeKeys"
                    className={cn(hasProductTypeError && "border-destructive rounded-lg border p-2")}
                  >
                    <ToggleChoiceGroup
                      mode="multiple"
                      options={productTypeOptions}
                      selectedValues={selectedProductTypeKeys}
                      onChange={setSelectedProductTypeKeys}
                      formName="productTypeKeys"
                      trailingSlot={
                        <StoreProductTypeRequestModal locale={locale} source="create" triggerVariant="chip" />
                      }
                    />
                  </div>
                  {fieldErrors.productTypeKeys?.[0] && (
                    <Typography size="xs" className="text-destructive mt-1" role="alert">
                      {tValidation(fieldErrors.productTypeKeys[0] as "productTypeRequired" | "productTypeInvalid")}
                    </Typography>
                  )}
                </div>

                <div className="space-y-3">
                  <Label>{tCreate("presenceLabel")}</Label>
                  <div
                    data-field="presenceTypes"
                    className={cn(hasPresenceError && "border-destructive rounded-lg border p-2")}
                  >
                    <ToggleChoiceGroup
                      mode="multiple"
                      options={presenceOptions}
                      selectedValues={presenceTypes}
                      onChange={(values) => setPresenceTypes(values as Array<"ONLINE" | "PHYSICAL">)}
                      formName="presenceTypes"
                      itemClassName="min-h-11"
                    />
                  </div>
                  {fieldErrors.presenceTypes?.[0] && (
                    <Typography size="xs" className="text-destructive mt-1" role="alert">
                      {tValidation("presenceRequired")}
                    </Typography>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <StoreToggleSwitch label={tCreate("hasStockLabel")} checked={hasStock} onChange={setHasStock} />
                  <StoreToggleSwitch
                    label={tCreate("receivesOrdersLabel")}
                    checked={receivesOrders}
                    onChange={setReceivesOrders}
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="import-countries-input">{tCreate("importCountriesLabel")}</Label>
                  <MultiTagAutocomplete
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
              </div>
            </WizardStep>

            {/* ── Step 4: Canales (BUSINESS only) ── */}
            {storeType === "BUSINESS" && (
              <WizardStep
                n={4}
                eyebrow={tCreateRedesign("step4.eyebrow")}
                title={tCreateRedesign("step4.title")}
                primaryAction={{ label: tCreateRedesign("continue") }}
                secondaryAction={{ label: tCreateRedesign("back") }}
                summary={
                  contactChannelRows.length + addressRows.length > 0
                    ? `${contactChannelRows.length + addressRows.length}`
                    : undefined
                }
              >
                <div className="space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>{tCreate("contactChannelsLabel")}</Label>
                      <Button type="button" variant="secondary" size="sm" onClick={handleAddContactChannel}>
                        <Plus size={16} className="mr-1" aria-hidden />
                        {tCreate("addContactChannel")}
                      </Button>
                    </div>
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
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>{tCreate("addressesLabel")}</Label>
                      <Button type="button" variant="secondary" size="sm" onClick={handleAddAddress}>
                        <Plus size={16} className="mr-1" aria-hidden />
                        {tCreate("addAddress")}
                      </Button>
                    </div>
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
                  </div>
                </div>
              </WizardStep>
            )}

            {/* ── Step 5 (BUSINESS) / Step 4 (PERSON): Listo ── */}
            <WizardStep
              n={reviewStepN}
              eyebrow={tCreateRedesign("step5.eyebrow")}
              title={tCreateRedesign("step5.title")}
              primaryAction={{
                label: isPending ? tCreate("submitting") : tCreateRedesign("submit"),
                onClick: triggerSubmit,
                loading: isPending,
              }}
              secondaryAction={{ label: tCreateRedesign("back") }}
              autoAdvance={false}
            >
              <div className="space-y-4">
                <Eyebrow as="p">{tCreateRedesign("summaryEyebrow")}</Eyebrow>
                {renderReviewSummary()}
              </div>
            </WizardStep>
          </WizardAccordion>
          <div className="mt-4 flex items-center gap-1.5 [font-size:var(--text-caption)] [color:var(--text-muted)]">
            <Check size={12} aria-hidden="true" className="[color:var(--success)]" />
            <span>{tCreateRedesign("autosave")}</span>
          </div>
        </div>

        {/* ── Aside Resumen sticky ── */}
        <aside className="lg:[position:sticky] lg:[top:calc(var(--header-h-desktop,4rem)_+_var(--space-4,1rem))] lg:self-start">
          <div className="rounded-[var(--radius-xl)] p-4 [background:var(--surface-elevated)] [border:1px_solid_var(--border)] md:p-5">
            <Eyebrow as="p">{tCreateRedesign("summaryEyebrow")}</Eyebrow>
            <dl className="mt-3 flex flex-col">
              <AsideSummaryRow
                label={tCreate("storeTypeLabel")}
                value={storeType === "BUSINESS" ? tCreate("storeTypeBusiness") : tCreate("storeTypePerson")}
              />
              <AsideSummaryRow label={tCreate("nameLabel")} value={nameValue || "—"} muted={!nameValue} />
              <AsideSummaryRow
                label={tCreate("countryLabel")}
                value={countryCode ? tCountries(countryCode) : "—"}
                muted={!countryCode}
              />
              <AsideSummaryRow
                label={tCreate("productTypesLabel")}
                value={selectedProductTypeKeys.length > 0 ? `${selectedProductTypeKeys.length}` : "—"}
                muted={selectedProductTypeKeys.length === 0}
              />
              {storeType === "PERSON" && isPrivate && (
                <AsideSummaryRow label={tCreateRedesign("step1.privateLabel")} value="✓" />
              )}
            </dl>
          </div>
        </aside>
      </form>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[var(--radius-md)] p-3 [background:var(--surface)] [border:1px_solid_var(--border)]">
      <dt>
        <Eyebrow as="span">{label}</Eyebrow>
      </dt>
      <dd className="[font-size:var(--text-body)] [color:var(--text-primary)]">{value}</dd>
    </div>
  );
}

function AsideSummaryRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 [border-bottom:1px_dashed_var(--border)] last:[border-bottom:0]">
      <dt className="[font-size:var(--text-caption)] [color:var(--text-muted)]">{label}</dt>
      <dd
        className={cn(
          "[font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)]",
          muted ? "[color:var(--text-muted)]" : "[color:var(--text-primary)]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

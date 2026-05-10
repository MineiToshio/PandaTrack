"use client";

import { AlertCircle, AlertTriangle, Building2, Check, Clock, Globe, Plus, Store, User } from "lucide-react";
import { getStoreProductTypeIcon } from "@/lib/catalog/storeProductTypeIcons";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
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
import SearchableSelect from "@/components/core/SearchableSelect";
import Textarea from "@/components/core/Textarea";
import Button from "@/components/core/Button/Button";
import Modal from "@/components/modules/Modal/Modal";
import { WizardAccordion, WizardStep, type WizardAccordionHandle } from "@/components/modules/WizardAccordion";
import Stepper, { type StepperStep } from "@/components/core/Stepper";
import BackNavLink from "@/components/core/BackNavLink";
import { cn } from "@/lib/styles";
import { POSTHOG_EVENTS, RETURN_TO_ORDER_CREATE, ROUTES } from "@/lib/constants";
import posthog from "posthog-js";
import { getDuplicateCandidates, getDuplicateCandidatesForSubmit } from "../../../new/_actions/getDuplicateCandidates";
import { SIMILARITY_THRESHOLD_PERCENT } from "@/lib/store/duplicateMatch";
import { STORE_LOGO_MAX_SOURCE_SIZE_MB } from "@/lib/store/logoShared";
import StoreAddressEditor, { type StoreAddressEditorHandle } from "../StoreAddressEditor";
import { type StoreContactChannelType } from "../StoreContactChannelList";
import StoreContactChannelEditor, { type StoreContactChannelEditorHandle } from "../StoreContactChannelEditor";
import InlineSwitch from "../InlineSwitch";
import StoreLogoField, { type StoreLogoSubmission } from "../StoreLogoField/StoreLogoField";
import CollectorCountryFlagEmoji from "../CollectorCountryFlagEmoji";
import MultiTagAutocomplete from "@/components/core/MultiTagAutocomplete";
import StoreProductTypeRequestModal from "../StoreProductTypeRequestModal";
import DuplicateAlertInline from "../DuplicateAlertInline";
import ToggleChoiceGroup from "@/components/core/ToggleChoiceGroup";
import Chip from "@/components/core/Chip";
import type { EditableStore, EditableStoreInput, StoreGovernanceViewerContext } from "@/queries/storeGovernance";

type DuplicateCandidate = { id: string; name: string; slug: string; countryCode: string; logoUrl: string | null };

const MIN_QUERY_LENGTH = 2;

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
 * Submit signature accepted by the form. We use `any` for the prev parameter so the
 * form can pass either `CreateStoreResult | null` or `SaveStoreEditResult | null`
 * without TypeScript narrowing issues — the form never reads back the prev value
 * inside the submit callback (it is the server action's own previous state).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StoreFormSubmit = (prev: any, formData: FormData) => Promise<StoreFormSubmitResult>;

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

type StoreTypeValue = "BUSINESS" | "PERSON";

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

export default function StoreForm({ countries, productTypes, mode, submit }: StoreFormProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("stores");
  const tCreate = useTranslations("stores.create");
  const tCreateRedesign = useTranslations("stores.redesign.create");
  const tValidation = useTranslations("stores.validation");
  const tEdit = useTranslations("stores.edit");
  const tCountries = useTranslations("countries");
  const tProductTypes = useTranslations("storeProductTypes");
  const tChannelTypes = useTranslations("stores.contactChannelTypes");

  const isEditMode = mode.kind !== "create";
  const isChangeRequestMode = mode.kind === "changeRequest";
  const editStore = isEditMode ? mode.store : null;
  const editInitial = isEditMode ? mode.initialValues : null;
  const existingChangeRequest = mode.kind === "changeRequest" ? (mode.existingChangeRequest ?? null) : null;

  // Initial values derived from edit mode (or empty defaults for create).
  const initialStoreType: StoreTypeValue = (editStore?.storeType as StoreTypeValue | undefined) ?? "BUSINESS";
  const initialIsPrivate = editInitial?.isPrivate ?? false;
  const initialHasStock = Boolean(editInitial?.hasStock);
  const initialReceivesOrders = Boolean(editInitial?.receivesOrders);
  const initialPresence = (editInitial?.presenceTypes as Array<"ONLINE" | "PHYSICAL"> | undefined) ?? [];
  const initialProductTypeKeys = editInitial?.productTypeKeys ?? [];
  const initialImportCountries = editInitial?.importCountries ?? [];
  const initialName = editInitial?.name ?? "";
  const initialDescription = editInitial?.description ?? "";
  const initialCountryCode = editStore?.countryCode ?? "";
  const initialContactChannelEntries = useMemo(
    () =>
      (editInitial?.contactChannels ?? []).map((channel, index) => ({
        id: index + 1,
        type: channel.type as StoreContactChannelType,
        value: channel.value,
      })),
    [editInitial],
  );
  const initialAddressEntries = useMemo(
    () =>
      (editInitial?.addresses ?? []).map((address, index) => ({
        id: index + 1,
        city: address.city ?? "",
        addressLine: address.addressLine,
        reference: address.reference ?? "",
      })),
    [editInitial],
  );

  const [storeType, setStoreType] = useState<StoreTypeValue>(initialStoreType);
  const [isPrivate, setIsPrivate] = useState<boolean>(initialIsPrivate);
  const [hasStock, setHasStock] = useState<boolean>(initialHasStock);
  const [receivesOrders, setReceivesOrders] = useState<boolean>(initialReceivesOrders);
  const [presenceTypes, setPresenceTypes] = useState<Array<"ONLINE" | "PHYSICAL">>(initialPresence);
  const [selectedProductTypeKeys, setSelectedProductTypeKeys] = useState<string[]>(initialProductTypeKeys);
  const [selectedImportCountries, setSelectedImportCountries] = useState<string[]>(initialImportCountries);
  const [contactChannelEntries, setContactChannelEntries] =
    useState<Array<{ id: number; type: StoreContactChannelType; value: string }>>(initialContactChannelEntries);
  const [isChannelFormOpen, setIsChannelFormOpen] = useState(false);
  const [addressData, setAddressData] =
    useState<Array<{ id: number; city: string; addressLine: string; reference: string }>>(initialAddressEntries);
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  const [logoSubmission, setLogoSubmission] = useState<StoreLogoSubmission>({
    action: "keep",
    file: null,
    cropArea: null,
  });
  const [comment, setComment] = useState<string>(existingChangeRequest?.comment ?? "");

  const channelEditorRef = useRef<StoreContactChannelEditorHandle | null>(null);
  const addressEditorRef = useRef<StoreAddressEditorHandle | null>(null);
  const nextContactRowIdRef = useRef(initialContactChannelEntries.length + 1);
  const nextAddressRowIdRef = useRef(initialAddressEntries.length + 1);

  const [state, formAction, isPending] = useActionState<StoreFormSubmitResult | null, FormData>(
    async (prev, formData) => submit(prev, formData),
    null,
  );

  const [nameValue, setNameValue] = useState(initialName);
  const [descriptionValue, setDescriptionValue] = useState(initialDescription);
  const [countryCode, setCountryCode] = useState(initialCountryCode);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [showConfirmDuplicate, setShowConfirmDuplicate] = useState(false);
  const pendingFormDataRef = useRef<FormData | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const wizardRef = useRef<WizardAccordionHandle | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [doneStepsArr, setDoneStepsArr] = useState<number[]>([]);
  const [erroredStepsArr, setErroredStepsArr] = useState<number[]>([]);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  // Track entry into change-request mode for analytics (parity with previous EditStoreForm).
  useEffect(() => {
    if (mode.kind === "changeRequest" && editStore) {
      posthog.capture(POSTHOG_EVENTS.STORE.CHANGE_REQUEST_EDIT_ENTERED, {
        store_slug: editStore.slug,
        has_existing_change_request: existingChangeRequest != null,
      });
    }
    // We intentionally only fire this once per mount per store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearClientError = useCallback((field: string) => {
    setClientErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const fetchCandidates = useCallback(
    async (query: string) => {
      if (mode.kind !== "create") return [];
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
    },
    [mode.kind],
  );

  const handleNameBlur = async () => {
    if (mode.kind !== "create") return;
    await fetchCandidates(nameValue);
  };

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setNameValue(event.target.value);
    if (mode.kind === "create") {
      setDuplicateCandidates([]);
    }
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
      {
        value: "BUSINESS",
        label: tCreateRedesign("step1.businessLabel"),
        description: tCreateRedesign("step1.businessDesc"),
        icon: <Store aria-hidden />,
      },
      {
        value: "PERSON",
        label: tCreateRedesign("step1.personLabel"),
        description: tCreateRedesign("step1.personDesc"),
        icon: <User aria-hidden />,
      },
    ],
    [tCreateRedesign],
  );

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
          label: tProductTypes(productType.key),
          icon: <Icon aria-hidden />,
        };
      }),
    [productTypes, tProductTypes],
  );

  const handleRemoveContactChannel = (id: number) => {
    setContactChannelEntries((previous) => previous.filter((entry) => entry.id !== id));
  };

  const getContactChannelPlaceholder = (type: StoreContactChannelType) => {
    return tCreate(`contactChannelPlaceholder.${type}`);
  };

  const handleAddAddress = (entry: { city: string; addressLine: string; reference: string }) => {
    const nextId = nextAddressRowIdRef.current;
    nextAddressRowIdRef.current += 1;
    setAddressData((prev) => [...prev, { id: nextId, ...entry }]);
  };

  const handleUpdateAddress = (rowId: number, next: { city: string; addressLine: string; reference: string }) => {
    setAddressData((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...next } : row)));
  };

  const handleRemoveAddress = (rowId: number) => {
    setAddressData((prev) => prev.filter((row) => row.id !== rowId));
  };

  const handleSubmit = async (formData: FormData) => {
    if (mode.kind === "create") {
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
  const createdStoreSlug = success && state && "slug" in state ? (state.slug as string | undefined) : null;
  const fieldErrors = useMemo(
    () => (state?.success === false && "fieldErrors" in state ? (state.fieldErrors ?? {}) : {}),
    [state],
  );
  const serverError = state?.success === false && "error" in state ? state.error : null;
  const firstErrorKey = Object.keys(fieldErrors)[0];
  const hasPresenceError = !!fieldErrors.presenceTypes?.length;
  const hasProductTypeError = !!fieldErrors.productTypeKeys?.length;
  const logoError = fieldErrors.logo?.[0] ?? null;

  const contactChannelGenericError = useMemo(() => {
    if (fieldErrors.contactChannels?.[0]) return fieldErrors.contactChannels[0];
    const firstKey = Object.keys(fieldErrors).find((key) => key.startsWith("contactChannels."));
    return firstKey ? (fieldErrors[firstKey]?.[0] ?? null) : null;
  }, [fieldErrors]);

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
    if (mode.kind !== "create" || !createdStoreSlug || !state || state.success !== true) {
      return;
    }

    const returnTo = mode.returnTo;
    const storeId = "storeId" in state ? (state.storeId as string | undefined) : undefined;
    if (returnTo === RETURN_TO_ORDER_CREATE && storeId) {
      router.replace(`/${locale}${ROUTES.ordersNew}?store=${storeId}`);
    } else {
      router.replace(`/${locale}${ROUTES.stores}/${createdStoreSlug}`);
    }
  }, [createdStoreSlug, locale, router, mode, state]);

  // For edit modes, errors come from a non-validation server path through the same `error` key.
  // Reuse the create renderer plus governance-aware fallback.
  const renderTopLevelError = (errorKey: string) =>
    t.has(`error.${errorKey}` as never)
      ? t(`error.${errorKey}` as never)
      : t.has(`governance.edit.errors.${errorKey}` as never)
        ? t(`governance.edit.errors.${errorKey}` as never)
        : isEditMode
          ? t("error.validation_failed")
          : t("error.create_failed");

  const renderLogoError = (errorKey: string) => {
    return tValidation.has(errorKey)
      ? tValidation(errorKey as never)
      : t.has(`error.${errorKey}` as never)
        ? t(`error.${errorKey}` as never)
        : t.has(`governance.edit.errors.${errorKey}` as never)
          ? t(`governance.edit.errors.${errorKey}` as never)
          : t("error.create_failed");
  };

  // Wizard step list. For PERSON the "Channels" step is omitted (no contact channels / addresses).
  const stepperSteps: StepperStep[] = useMemo(() => {
    if (storeType === "BUSINESS") {
      return [
        { n: 1, label: tCreateRedesign("step1.shortLabel") },
        { n: 2, label: tCreateRedesign("step2.shortLabel") },
        { n: 3, label: tCreateRedesign("step3.shortLabel") },
        { n: 4, label: tCreateRedesign("step4.shortLabel") },
        { n: 5, label: tCreateRedesign("step5.shortLabel") },
      ];
    }
    return [
      { n: 1, label: tCreateRedesign("step1.shortLabel") },
      { n: 2, label: tCreateRedesign("step2.shortLabel") },
      { n: 3, label: tCreateRedesign("step3.shortLabel") },
      { n: 4, label: tCreateRedesign("step5.shortLabel") },
    ];
  }, [storeType, tCreateRedesign]);

  const totalSteps = stepperSteps.length;
  const maxAllowedStep = useMemo(() => {
    if (doneStepsArr.length === 0) return 1;
    let maxDone = 0;
    for (const s of doneStepsArr) if (s > maxDone) maxDone = s;
    return Math.min(maxDone + 1, totalSteps);
  }, [doneStepsArr, totalSteps]);

  if (mode.kind === "create" && success) {
    return (
      <div className="space-y-6">
        <Typography size="sm" className="text-text-body" role="status" aria-live="polite">
          {t("success.redirectingToStore")}
        </Typography>
      </div>
    );
  }

  const reviewStepN = storeType === "BUSINESS" ? 5 : 4;
  const handleStepperClick = (n: number) => wizardRef.current?.activate(n);

  // Submit button copy depends on mode.
  const submitLabel: string = (() => {
    if (mode.kind === "create") {
      return isPending ? tCreate("submitting") : tCreateRedesign("submit");
    }
    if (mode.kind === "directEdit") {
      return isPending ? tEdit("direct.submitting") : tEdit("direct.submitCta");
    }
    return isPending ? tEdit("changeRequest.submitting") : tEdit("changeRequest.submitCta");
  })();

  // Back link label and href depend on mode.
  const backHref =
    mode.kind === "create" ? `/${locale}${ROUTES.stores}` : `/${locale}${ROUTES.stores}/${editStore?.slug ?? ""}`;
  const backLabel = mode.kind === "create" ? tCreate("backToList") : tEdit("backToDetail");

  const lockedCaption = isEditMode
    ? tEdit("immutableFieldsHelper", {
        storeType: storeType === "BUSINESS" ? tCreate("storeTypeBusiness") : tCreate("storeTypePerson"),
        country: countryCode ? tCountries(countryCode) : "",
      })
    : null;

  const renderReviewSummary = () => (
    <div className="rounded-[var(--radius-lg)] p-4 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
      <dl className="grid [grid-template-columns:auto_1fr] items-baseline [gap:6px_16px] [font-size:var(--text-body)]">
        <ReviewRow
          label={tCreateRedesign("aside.typeLabel")}
          value={storeType === "BUSINESS" ? tCreate("storeTypeBusiness") : tCreate("storeTypePerson")}
        />
        {storeType === "PERSON" && isPrivate && <ReviewRow label={tCreateRedesign("step1.privateLabel")} value="✓" />}
        <ReviewRow label={tCreateRedesign("aside.nameLabel")} value={nameValue || "—"} />
        <ReviewRow label={tCreateRedesign("aside.countryLabel")} value={countryCode ? tCountries(countryCode) : "—"} />
        <ReviewSeparator />
        <ReviewRow
          label={tCreateRedesign("aside.categoriesLabel")}
          value={selectedProductTypeKeys.map((k) => tProductTypes(k)).join(", ") || "—"}
        />
        <ReviewRow
          label={tCreateRedesign("aside.presenceLabel")}
          value={
            presenceTypes
              .map((p) =>
                tCreate(`presence${p === "ONLINE" ? "Online" : "Physical"}` as "presenceOnline" | "presencePhysical"),
              )
              .join(", ") || "—"
          }
        />
        {selectedImportCountries.length > 0 && (
          <ReviewRow
            label={tCreateRedesign("aside.importLabel")}
            value={selectedImportCountries.map((code) => tCountries(code)).join(", ")}
          />
        )}
        {storeType === "BUSINESS" && (contactChannelEntries.length > 0 || addressData.length > 0) && (
          <ReviewSeparator />
        )}
        {storeType === "BUSINESS" && contactChannelEntries.length > 0 && (
          <>
            <dt className="pt-0.5 [font-size:var(--text-caption)] [color:var(--text-muted)]">
              {tCreateRedesign("aside.channelsLabel")}
            </dt>
            <dd className="space-y-2">
              {contactChannelEntries.map((entry) => (
                <div key={entry.id}>
                  <div className="[font-size:var(--text-caption)] [color:var(--text-muted)]">
                    {tChannelTypes(entry.type)}
                  </div>
                  <div className="[font-size:var(--text-caption)] [font-weight:var(--font-weight-medium)] break-all [color:var(--text-primary)]">
                    {entry.value}
                  </div>
                </div>
              ))}
            </dd>
          </>
        )}
        {storeType === "BUSINESS" && addressData.length > 0 && (
          <>
            <dt className="pt-0.5 [font-size:var(--text-caption)] [color:var(--text-muted)]">
              {tCreateRedesign("aside.addressesLabel")}
            </dt>
            <dd className="space-y-2">
              {addressData.map((addr) => (
                <div
                  key={addr.id}
                  className="[font-size:var(--text-caption)] [font-weight:var(--font-weight-medium)] [color:var(--text-primary)]"
                >
                  {addr.city && <div className="[color:var(--text-muted)]">{addr.city}</div>}
                  <div>{addr.reference ? `${addr.addressLine} · ${addr.reference}` : addr.addressLine}</div>
                </div>
              ))}
            </dd>
          </>
        )}
      </dl>
    </div>
  );

  // Country-locked display for edit modes.
  const renderLockedCountry = (): ReactNode => (
    <div className="flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2.5 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
      <CollectorCountryFlagEmoji countryCode={countryCode} />
      <Typography size="sm" className="[color:var(--text-primary)]">
        {countryCode ? tCountries(countryCode) : "—"}
      </Typography>
    </div>
  );

  return (
    <div className="space-y-4">
      <BackNavLink href={backHref}>{backLabel}</BackNavLink>

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
          {renderTopLevelError(serverError)}
        </Typography>
      )}

      <form ref={formRef} onSubmit={handleFormSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {/* Hidden inputs that the server actions read regardless of which step renders them */}
        <input type="hidden" name="storeType" value={storeType} />
        {storeType === "PERSON" && isPrivate && <input type="hidden" name="isPrivate" value="on" />}
        {hasStock && <input type="hidden" name="hasStock" value="on" />}
        {receivesOrders && <input type="hidden" name="receivesOrders" value="on" />}
        {isEditMode && (
          <>
            <input type="hidden" name="slug" value={editStore?.slug ?? ""} />
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="countryCode" value={countryCode} />
          </>
        )}

        {/* Stepper spans the full grid width so the dots align across both columns.
            Hidden in edit modes — they use the all-open layout where there is no notion
            of an active step to highlight. */}
        {!isEditMode && (
          <div className="lg:col-span-2">
            <Stepper
              steps={stepperSteps}
              activeStep={activeStep}
              doneSteps={doneStepsArr}
              erroredSteps={erroredStepsArr}
              onStepClick={handleStepperClick}
              ariaLabel={tCreateRedesign("stepperLabel")}
            />
          </div>
        )}

        <div className="min-w-0">
          <WizardAccordion
            ref={wizardRef}
            startStep={1}
            showStepper={false}
            // Edit modes use `all-open` so users can scan and edit any field directly,
            // without progressive disclosure that's only useful for first-time creation.
            layout={isEditMode ? "all-open" : "wizard"}
            gated={!isEditMode}
            scrollOnAdvance={!isEditMode}
            onStepChange={setActiveStep}
            onDoneStepsChange={setDoneStepsArr}
            onErroredStepsChange={setErroredStepsArr}
          >
            {/* ── Step 1: Tipo ── */}
            <WizardStep
              n={1}
              eyebrow={tCreateRedesign("step1.eyebrow")}
              title={tCreateRedesign("step1.title")}
              primaryAction={{ label: tCreateRedesign("continue") }}
              summary={storeType === "BUSINESS" ? tCreate("storeTypeBusiness") : tCreate("storeTypePerson")}
              disabled={1 > maxAllowedStep}
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
                    disabled={isEditMode}
                    onChange={(value) => {
                      if (isEditMode) return;
                      const nextStoreType = value as StoreTypeValue;
                      setStoreType(nextStoreType);
                      if (nextStoreType === "PERSON") {
                        setLogoSubmission({ action: "keep", file: null, cropArea: null });
                      } else {
                        setIsPrivate(false);
                      }
                    }}
                  />
                  {isEditMode && lockedCaption && (
                    <Typography size="xs" className="text-text-muted">
                      {lockedCaption}
                    </Typography>
                  )}
                </div>

                {storeType === "PERSON" && (
                  <div className="pt-4 [border-top:1px_solid_var(--border)]">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isPrivate}
                        aria-labelledby="store-private-label"
                        onClick={() => setIsPrivate(!isPrivate)}
                        className={cn(
                          "relative mt-0.5 h-[22px] w-[38px] flex-shrink-0 cursor-pointer rounded-full transition-colors",
                          "focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:2px]",
                          isPrivate ? "[background:var(--accent)]" : "[background:var(--border-strong)]",
                        )}
                      >
                        <span
                          aria-hidden="true"
                          style={{ transform: isPrivate ? "translateX(16px)" : undefined }}
                          className={cn(
                            "absolute top-[2px] left-[2px] h-[18px] w-[18px] rounded-full transition-transform",
                            "[box-shadow:0_1px_3px_rgba(0,0,0,0.15)] [background:var(--surface)]",
                          )}
                        />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div
                          id="store-private-label"
                          className="[font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]"
                        >
                          {tCreateRedesign("step1.privateLabel")}{" "}
                          <span className="[font-size:var(--text-caption)] [font-weight:var(--font-weight-regular)] [color:var(--text-muted)]">
                            {tCreateRedesign("step1.privateBadge")}
                          </span>
                        </div>
                        <Typography size="xs" className="mt-1 [line-height:1.5] [color:var(--text-muted)]">
                          {tCreateRedesign("step1.privateHelper")}
                        </Typography>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </WizardStep>

            {/* ── Step 2: Identidad ── */}
            <WizardStep
              n={2}
              eyebrow={tCreateRedesign("step2.eyebrow")}
              title={tCreateRedesign("step2.title")}
              primaryAction={{ label: tCreateRedesign("continue") }}
              secondaryAction={{ label: tCreateRedesign("back") }}
              summary={nameValue && countryCode ? `${nameValue} · ${tCountries(countryCode)}` : undefined}
              disabled={2 > maxAllowedStep}
              hasError={Boolean(clientErrors.name || clientErrors.countryCode)}
              validate={() => {
                const next: Record<string, string> = {};
                if (!nameValue.trim()) next.name = "nameRequired";
                if (!isEditMode && countryCode.length !== 2) next.countryCode = "countryInvalid";
                setClientErrors((prev) => ({
                  ...Object.fromEntries(Object.entries(prev).filter(([k]) => !["name", "countryCode"].includes(k))),
                  ...next,
                }));
                return Object.keys(next).length === 0;
              }}
            >
              <Typography size="xs" className="text-text-muted mb-4">
                {tCreateRedesign("step2.helper")}
              </Typography>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label
                    htmlFor="store-name"
                    className={cn((fieldErrors.name?.length || clientErrors.name) && "[color:var(--destructive)]")}
                  >
                    {tCreate("nameLabel")}
                  </Label>
                  <Input
                    id="store-name"
                    name="name"
                    type="text"
                    value={nameValue}
                    onChange={(event) => {
                      handleNameChange(event);
                      clearClientError("name");
                    }}
                    onBlur={handleNameBlur}
                    placeholder={tCreate("namePlaceholder")}
                    required
                    maxLength={200}
                    error={!!fieldErrors.name?.length || !!clientErrors.name}
                    aria-invalid={!!fieldErrors.name?.length || !!clientErrors.name}
                  />
                  {(fieldErrors.name?.[0] || clientErrors.name) && (
                    <FieldErrorMsg>
                      {fieldErrors.name?.[0]
                        ? tValidation(fieldErrors.name[0] as "nameRequired" | "nameTooLong")
                        : tValidation(clientErrors.name as "nameRequired" | "nameTooLong")}
                    </FieldErrorMsg>
                  )}
                </div>

                <div>
                  <Label
                    htmlFor="store-country"
                    className={cn(
                      (fieldErrors.countryCode?.length || clientErrors.countryCode) && "[color:var(--destructive)]",
                    )}
                  >
                    {tCreate("countryLabel")}
                  </Label>
                  {isEditMode ? (
                    <>
                      {renderLockedCountry()}
                      {lockedCaption && (
                        <Typography size="xs" className="text-text-muted mt-1">
                          {lockedCaption}
                        </Typography>
                      )}
                    </>
                  ) : (
                    <>
                      <SearchableSelect
                        id="store-country"
                        name="countryCode"
                        required
                        options={countryOptions}
                        value={countryCode}
                        onChange={(value) => {
                          setCountryCode(value);
                          clearClientError("countryCode");
                        }}
                        placeholder={tCreate("countryPlaceholder")}
                        clearLabel={tCreate("remove")}
                        noResultsLabel={tCreateRedesign("countryNoResults")}
                        aria-invalid={!!fieldErrors.countryCode?.length || !!clientErrors.countryCode}
                        error={!!fieldErrors.countryCode?.length || !!clientErrors.countryCode}
                      />
                      {(fieldErrors.countryCode?.[0] || clientErrors.countryCode) && (
                        <FieldErrorMsg>{tValidation("countryInvalid")}</FieldErrorMsg>
                      )}
                    </>
                  )}
                </div>

                {!showConfirmDuplicate && mode.kind === "create" && duplicateCandidates.length > 0 && (
                  <div className="md:col-span-2">
                    <DuplicateAlertInline
                      candidates={duplicateCandidates}
                      locale={locale}
                      labels={{
                        eyebrow: tCreateRedesign("duplicate.eyebrow"),
                        title: tCreateRedesign("duplicate.title"),
                        viewStore: tCreateRedesign("duplicate.viewStore"),
                        countryName: (code) => tCountries(code),
                      }}
                    />
                  </div>
                )}

                {storeType === "BUSINESS" && (
                  <div className="md:col-span-2">
                    <StoreLogoField
                      id="store-logo"
                      initialLogoUrl={editInitial?.logoUrl ?? null}
                      copy={{
                        label: t("logo.label"),
                        helper: t("logo.helper"),
                        emptyTitle: t("logo.emptyTitle"),
                        emptyDescription: t("logo.emptyDescription"),
                        uploadCta: t("logo.uploadCta"),
                        editCta: t("logo.editCta"),
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
                          flow: mode.kind,
                          ...(editStore ? { store_slug: editStore.slug } : {}),
                        })
                      }
                    />
                  </div>
                )}

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
              </div>
            </WizardStep>

            {/* ── Step 3: Categorías y presencia ── */}
            <WizardStep
              n={3}
              eyebrow={tCreateRedesign("step3.eyebrow")}
              title={tCreateRedesign("step3.title")}
              primaryAction={{ label: tCreateRedesign("continue") }}
              secondaryAction={{ label: tCreateRedesign("back") }}
              summary={
                selectedProductTypeKeys.length > 0
                  ? selectedProductTypeKeys.length === 1
                    ? tProductTypes(selectedProductTypeKeys[0])
                    : `${selectedProductTypeKeys.length}`
                  : undefined
              }
              disabled={3 > maxAllowedStep}
              hasError={Boolean(clientErrors.productTypeKeys || clientErrors.presenceTypes)}
              validate={() => {
                const next: Record<string, string> = {};
                if (selectedProductTypeKeys.length === 0) next.productTypeKeys = "productTypeRequired";
                if (presenceTypes.length === 0) next.presenceTypes = "presenceRequired";
                setClientErrors((prev) => ({
                  ...Object.fromEntries(
                    Object.entries(prev).filter(([k]) => !["productTypeKeys", "presenceTypes"].includes(k)),
                  ),
                  ...next,
                }));
                return Object.keys(next).length === 0;
              }}
            >
              <div className="space-y-5">
                <div className="space-y-3">
                  <Label
                    className={cn(
                      (hasProductTypeError || clientErrors.productTypeKeys) && "[color:var(--destructive)]",
                    )}
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
                      onChange={(next) => {
                        setSelectedProductTypeKeys(next);
                        if (next.length > 0) clearClientError("productTypeKeys");
                      }}
                      formName="productTypeKeys"
                      trailingSlot={
                        <StoreProductTypeRequestModal
                          locale={locale}
                          source={mode.kind === "create" ? "create" : "edit"}
                          triggerVariant="chip"
                        />
                      }
                    />
                  </div>
                  {(fieldErrors.productTypeKeys?.[0] || clientErrors.productTypeKeys) && (
                    <FieldErrorMsg>
                      {tValidation(
                        (fieldErrors.productTypeKeys?.[0] ?? clientErrors.productTypeKeys) as
                          | "productTypeRequired"
                          | "productTypeInvalid",
                      )}
                    </FieldErrorMsg>
                  )}
                </div>

                <div className="space-y-3">
                  <Label
                    className={cn((hasPresenceError || clientErrors.presenceTypes) && "[color:var(--destructive)]")}
                  >
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
                      onChange={(values) => {
                        const next = values as Array<"ONLINE" | "PHYSICAL">;
                        setPresenceTypes(next);
                        if (next.length > 0) clearClientError("presenceTypes");
                      }}
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
                    onChange={setSelectedImportCountries}
                    placeholder={tCreate("importCountriesPlaceholder")}
                    inputName="importCountries"
                    helperText={tCreate("importCountriesHelper")}
                    removeItemAriaLabel={(itemLabel) => `${tCreate("remove")} ${itemLabel}`}
                  />
                </div>

                <div className="space-y-3">
                  <Label>{tCreateRedesign("step3.stockSectionLabel")}</Label>
                  <div className="flex flex-wrap gap-6">
                    <InlineSwitch
                      label={tCreateRedesign("step3.hasStockLabel")}
                      checked={hasStock}
                      onChange={setHasStock}
                    />
                    <InlineSwitch
                      label={tCreateRedesign("step3.receivesOrdersLabel")}
                      checked={receivesOrders}
                      onChange={setReceivesOrders}
                    />
                  </div>
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
                  contactChannelEntries.length + addressData.length > 0
                    ? `${contactChannelEntries.length + addressData.length}`
                    : undefined
                }
                disabled={4 > maxAllowedStep}
                validate={() => {
                  const next: Record<string, string> = {};
                  if (isChannelFormOpen) next.channelFormOpen = "channelFormOpen";
                  if (isAddressFormOpen) next.addressFormOpen = "addressFormOpen";
                  setClientErrors((prev) => ({
                    ...Object.fromEntries(
                      Object.entries(prev).filter(([k]) => !["channelFormOpen", "addressFormOpen"].includes(k)),
                    ),
                    ...next,
                  }));
                  return Object.keys(next).length === 0;
                }}
              >
                <Typography size="xs" className="text-text-muted mb-4">
                  {tCreateRedesign("step4.helper")}
                </Typography>
                <div className="space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label>{tCreate("contactChannelsLabel")}</Label>
                      {!isChannelFormOpen && (
                        <Button
                          type="button"
                          variant="tonal"
                          size="sm"
                          onClick={() => channelEditorRef.current?.openForm()}
                          leadingIcon={<Plus size={13} aria-hidden />}
                        >
                          {tCreateRedesign("channels.addChannel")}
                        </Button>
                      )}
                    </div>
                    <StoreContactChannelEditor
                      ref={channelEditorRef}
                      hideTrigger
                      entries={contactChannelEntries}
                      onAdd={({ type, value }) => {
                        const nextId = nextContactRowIdRef.current;
                        nextContactRowIdRef.current += 1;
                        setContactChannelEntries((previous) => [...previous, { id: nextId, type, value }]);
                      }}
                      onUpdate={(id, next) =>
                        setContactChannelEntries((previous) =>
                          previous.map((entry) => (entry.id === id ? { ...entry, ...next } : entry)),
                        )
                      }
                      onRemove={handleRemoveContactChannel}
                      typeInputName="contactChannelType"
                      valueInputName="contactChannelValue"
                      onFormOpenChange={setIsChannelFormOpen}
                      labels={{
                        typeLabel: tCreate("contactChannelType"),
                        valueLabel: tCreate("contactChannelValue"),
                        helper: tCreateRedesign("channels.helper"),
                        addButton: tCreateRedesign("channels.addButton"),
                        addChannel: tCreateRedesign("channels.addChannel"),
                        empty: tCreateRedesign("channels.empty"),
                        edit: tCreateRedesign("channels.edit"),
                        save: tCreateRedesign("channels.save"),
                        cancel: tCreateRedesign("channels.cancel"),
                        remove: tCreate("remove"),
                        optionLabel: (type) => tChannelTypes(type),
                        valuePlaceholder: getContactChannelPlaceholder,
                        validationError: (key) => tCreateRedesign(`channels.validationError.${key}` as never) ?? key,
                      }}
                    />
                    {contactChannelGenericError && (
                      <Typography size="xs" className="text-destructive mt-1" role="alert">
                        {contactChannelGenericError}
                      </Typography>
                    )}
                    {clientErrors.channelFormOpen && (
                      <FieldErrorMsg>{tCreateRedesign("channels.formOpenWarning")}</FieldErrorMsg>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label>{tCreate("addressesLabel")}</Label>
                      {!isAddressFormOpen && (
                        <Button
                          type="button"
                          variant="tonal"
                          size="sm"
                          onClick={() => addressEditorRef.current?.openForm()}
                          leadingIcon={<Plus size={13} aria-hidden />}
                        >
                          {tCreate("addAddress")}
                        </Button>
                      )}
                    </div>
                    <StoreAddressEditor
                      ref={addressEditorRef}
                      hideTrigger
                      entries={addressData}
                      onAdd={handleAddAddress}
                      onUpdate={handleUpdateAddress}
                      onRemove={handleRemoveAddress}
                      cityInputName="addressCity"
                      addressLineInputName="addressAddressLine"
                      referenceInputName="addressReference"
                      onFormOpenChange={setIsAddressFormOpen}
                      labels={{
                        cityLabel: tCreate("addressCity"),
                        addressLineLabel: tCreate("addressLine"),
                        referenceLabel: tCreate("addressReference"),
                        helper: tCreateRedesign("addresses.helper"),
                        addButton: tCreateRedesign("channels.addButton"),
                        addAddress: tCreate("addAddress"),
                        empty: tCreateRedesign("addresses.empty"),
                        edit: tCreateRedesign("channels.edit"),
                        save: tCreateRedesign("channels.save"),
                        cancel: tCreateRedesign("channels.cancel"),
                        remove: tCreateRedesign("channels.remove"),
                      }}
                    />
                    {clientErrors.addressFormOpen && (
                      <FieldErrorMsg>{tCreateRedesign("addresses.formOpenWarning")}</FieldErrorMsg>
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
                label: submitLabel,
                onClick: triggerSubmit,
                loading: isPending,
                leadingIcon: <Check size={14} aria-hidden="true" />,
                trailingIcon: null,
              }}
              secondaryAction={{ label: tCreateRedesign("back") }}
              autoAdvance={false}
              disabled={reviewStepN > maxAllowedStep}
            >
              <Typography size="xs" className="text-text-muted">
                {tCreateRedesign("step5.helper")}
              </Typography>
              {mode.kind === "create" && (
                <Typography size="xs" className="text-text-muted mt-1 mb-4">
                  {tCreateRedesign("step5.subhelper")}
                </Typography>
              )}
              <div className="space-y-4">
                <Eyebrow as="p">{tCreateRedesign("summaryEyebrow")}</Eyebrow>
                {renderReviewSummary()}
                {isChangeRequestMode && (
                  <div>
                    <Label htmlFor="store-change-request-comment">{tEdit("commentLabel")}</Label>
                    <Typography size="xs" className="text-text-muted mt-1">
                      {tEdit("commentHelper")}
                    </Typography>
                    <Textarea
                      id="store-change-request-comment"
                      name="comment"
                      rows={4}
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      maxLength={500}
                      className="mt-2 resize-y"
                    />
                  </div>
                )}
              </div>
            </WizardStep>
          </WizardAccordion>

          {/* Edit-mode submit footer — replaces the per-step primary/secondary buttons
              that the all-open layout intentionally hides. Lives after all step bodies
              so users can scan/edit anything before committing. Uses `md` size since
              these are the form's primary CTA controls and deserve more visual weight
              than per-step navigation buttons. */}
          {isEditMode && (
            <div className="mt-6 flex flex-col-reverse gap-2 md:flex-row md:items-center md:justify-end md:gap-3">
              <Button as="a" href={backHref} variant="ghost" size="md" className="md:w-auto" fullWidth>
                {backLabel}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={triggerSubmit}
                loading={isPending}
                leadingIcon={<Check size={16} aria-hidden="true" />}
                fullWidth
                className="md:w-auto"
              >
                {submitLabel}
              </Button>
            </div>
          )}
        </div>

        {/* ── Aside Resumen sticky ── */}
        <aside className="lg:[position:sticky] lg:[top:calc(var(--app-banner-offset,0px)_+_var(--header-h-desktop,4rem)_+_var(--space-4,1rem))] lg:self-start">
          <div className="rounded-[var(--radius-xl)] p-4 [box-shadow:var(--shadow-2)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)] md:p-5">
            <Eyebrow as="p">{tCreateRedesign("summaryEyebrow")}</Eyebrow>
            <dl className="mt-3 flex flex-col">
              <AsideSummaryRow
                label={tCreateRedesign("aside.typeLabel")}
                value={storeType === "BUSINESS" ? tCreate("storeTypeBusiness") : tCreate("storeTypePerson")}
              />
              <AsideSummaryRow
                label={tCreateRedesign("aside.nameLabel")}
                value={nameValue || "—"}
                muted={!nameValue}
                changed={isEditMode && nameValue !== initialName}
              />
              <AsideSummaryRow
                label={tCreateRedesign("aside.countryLabel")}
                value={countryCode || "—"}
                muted={!countryCode}
                changed={isEditMode && countryCode !== initialCountryCode}
              />
              <AsideSummaryRow
                label={tCreateRedesign("aside.categoriesLabel")}
                value={selectedProductTypeKeys.length > 0 ? `${selectedProductTypeKeys.length}` : "—"}
                muted={selectedProductTypeKeys.length === 0}
                changed={
                  isEditMode &&
                  (selectedProductTypeKeys.length !== initialProductTypeKeys.length ||
                    selectedProductTypeKeys.some((k) => !initialProductTypeKeys.includes(k)))
                }
              />
              {storeType === "BUSINESS" && (
                <AsideSummaryRow
                  label={tCreateRedesign("aside.channelsLabel")}
                  value={`${contactChannelEntries.length}`}
                  muted={contactChannelEntries.length === 0}
                  changed={isEditMode && contactChannelEntries.length !== initialContactChannelEntries.length}
                />
              )}
              {storeType === "BUSINESS" && (
                <AsideSummaryRow
                  label={tCreateRedesign("aside.addressesLabel")}
                  value={`${addressData.length}`}
                  muted={addressData.length === 0}
                  changed={isEditMode && addressData.length !== initialAddressEntries.length}
                />
              )}
              {storeType === "PERSON" && isPrivate && (
                <AsideSummaryRow label={tCreateRedesign("step1.privateLabel")} value="✓" />
              )}
              <div className="flex items-center justify-between gap-3 py-2 [border-top:1px_solid_var(--border)]">
                <dt className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">
                  {tCreateRedesign("aside.statusLabel")}
                </dt>
                <dd>
                  <Chip variant="info" icon={<Clock size={11} aria-hidden="true" />} size="sm">
                    {tCreateRedesign("aside.statusPending")}
                  </Chip>
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </form>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="[font-size:var(--text-caption)] [color:var(--text-muted)]">{label}</dt>
      <dd className="[font-weight:var(--font-weight-medium)] [color:var(--text-primary)]">{value}</dd>
    </>
  );
}

function FieldErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] [color:var(--destructive)]" role="alert">
      <AlertCircle size={13} aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function ReviewSeparator() {
  return <div aria-hidden="true" className="[grid-column:1/-1] my-1 h-px [background:var(--border)]" />;
}

function AsideSummaryRow({
  label,
  value,
  muted,
  changed,
}: {
  label: string;
  value: string;
  muted?: boolean;
  changed?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 [border-top:1px_solid_var(--border)] first:[border-top:0]">
      <dt className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">{label}</dt>
      <dd
        className={cn(
          "text-right [font-size:var(--text-caption)] [font-weight:var(--font-weight-medium)]",
          changed ? "[color:var(--warning)]" : muted ? "[color:var(--text-muted)]" : "[color:var(--text-primary)]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

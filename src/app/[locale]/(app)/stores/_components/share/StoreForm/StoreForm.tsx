"use client";

import { AlertTriangle, Check } from "lucide-react";
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
import { useIsMobile } from "@/hooks/useIsMobile";
import Typography from "@/components/core/Typography";
import Button from "@/components/core/Button/Button";
import Modal from "@/components/modules/Modal/Modal";
import { WizardAccordion, type WizardAccordionHandle } from "@/components/modules/WizardAccordion";
import Stepper, { type StepperStep } from "@/components/core/Stepper";
import BackNavLink from "@/components/core/BackNavLink";
import { cn } from "@/lib/styles";
import { POSTHOG_EVENTS, RETURN_TO_ORDER_CREATE, ROUTES } from "@/lib/constants";
import posthog from "posthog-js";
import { SIMILARITY_THRESHOLD_PERCENT } from "@/lib/store/duplicateMatch";
import type { DuplicateCandidate } from "@/lib/data/stores/storeQueries";
import {
  checkDuplicateCandidatesOnSubmit,
  fetchDuplicateCandidatesForQuery,
} from "../../../_utils/storeFormDuplicates";
import { resolveFirstErrorElement, type StoreFormClientErrors } from "../../../_utils/storeFormValidation";
import { type StoreContactChannelType } from "../StoreContactChannelList";
import { type StoreLogoSubmission } from "../StoreLogoField/StoreLogoField";
import CollectorCountryFlagEmoji from "../CollectorCountryFlagEmoji";
import DuplicateCandidatesList from "./DuplicateCandidatesList";
import StoreFormAside from "./StoreFormAside";
import StoreFormStepCatalog from "./StoreFormStepCatalog";
import StoreFormStepChannels from "./StoreFormStepChannels";
import StoreFormStepIdentity from "./StoreFormStepIdentity";
import StoreFormStepReview from "./StoreFormStepReview";
import StoreFormStepType from "./StoreFormStepType";
import type {
  StoreFormInitialSnapshot,
  StoreFormProps,
  StoreFormSubmitResult,
  StoreFormValuesSnapshot,
  StorePresenceType,
  SellerTypeValue,
} from "./types";
import { sellerTypeLabelKey } from "./types";

export type {
  EditableStoreFormValues,
  StoreFormMode,
  StoreFormProps,
  StoreFormSubmit,
  StoreFormSubmitResult,
} from "./types";

export default function StoreForm({ countries, productTypes, mode, submit }: StoreFormProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("stores");
  const tCreate = useTranslations("stores.create");
  const tCreateRedesign = useTranslations("stores.redesign.create");
  const tValidation = useTranslations("stores.validation");
  const tEdit = useTranslations("stores.edit");
  const tCountries = useTranslations("countries");
  const isMobile = useIsMobile();

  const isEditMode = mode.kind !== "create";
  const isChangeRequestMode = mode.kind === "changeRequest";
  const editStore = isEditMode ? mode.store : null;
  const editInitial = isEditMode ? mode.initialValues : null;
  const existingChangeRequest = mode.kind === "changeRequest" ? (mode.existingChangeRequest ?? null) : null;

  // Initial values derived from edit mode (or empty defaults for create).
  const initialSellerType: SellerTypeValue = (editStore?.sellerType as SellerTypeValue | undefined) ?? "RETAILER";
  const initialIsPrivate = editInitial?.isPrivate ?? false;
  const initialHasStock = Boolean(editInitial?.hasStock);
  const initialReceivesOrders = Boolean(editInitial?.receivesOrders);
  // A store is closed when its persisted (or pending) activity state is explicitly inactive.
  const initialIsClosed = isEditMode ? editInitial?.isActive === false : false;
  const initialPresence = (editInitial?.presenceTypes as StorePresenceType[] | undefined) ?? [];
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

  const [sellerType, setSellerType] = useState<SellerTypeValue>(initialSellerType);
  const [isPrivate, setIsPrivate] = useState<boolean>(initialIsPrivate);
  const [hasStock, setHasStock] = useState<boolean>(initialHasStock);
  const [receivesOrders, setReceivesOrders] = useState<boolean>(initialReceivesOrders);
  const [isClosed, setIsClosed] = useState<boolean>(initialIsClosed);
  const [presenceTypes, setPresenceTypes] = useState<StorePresenceType[]>(initialPresence);
  const [selectedProductTypeKeys, setSelectedProductTypeKeys] = useState<string[]>(initialProductTypeKeys);
  const [selectedImportCountries, setSelectedImportCountries] = useState<string[]>(initialImportCountries);
  const [contactChannelEntries, setContactChannelEntries] = useState(initialContactChannelEntries);
  const [addressData, setAddressData] = useState(initialAddressEntries);
  const [logoSubmission, setLogoSubmission] = useState<StoreLogoSubmission>({
    action: "keep",
    file: null,
  });
  const [comment, setComment] = useState<string>(existingChangeRequest?.comment ?? "");

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
  const [clientErrors, setClientErrors] = useState<StoreFormClientErrors>({});

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

  const handleNameBlur = async () => {
    if (mode.kind !== "create") return;
    const candidates = await fetchDuplicateCandidatesForQuery(nameValue);
    setDuplicateCandidates(candidates);
  };

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setNameValue(event.target.value);
    if (mode.kind === "create") {
      setDuplicateCandidates([]);
    }
    clearClientError("name");
  };

  const handleCountryCodeChange = (value: string) => {
    setCountryCode(value);
    clearClientError("countryCode");
  };

  const handleDescriptionChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setDescriptionValue(event.target.value);
  };

  const handleCommentChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setComment(event.target.value);
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

  // RETAILER and PROXY sellers expose contact channels + addresses; PERSON does not.
  const showChannels = sellerType !== "PERSON";

  const handleSellerTypeChange = (nextSellerType: SellerTypeValue) => {
    if (isEditMode) return;
    setSellerType(nextSellerType);
    if (nextSellerType === "PERSON") {
      // PERSON stores have no logo; drop any pending upload.
      setLogoSubmission({ action: "keep", file: null });
    } else {
      // Only PERSON can be private; RETAILER and PROXY default to public.
      setIsPrivate(false);
    }
    if (nextSellerType === "PROXY") {
      // A PROXY has no catalog; clear categories/stock so a stale selection is not submitted.
      setSelectedProductTypeKeys([]);
      setHasStock(false);
      setReceivesOrders(false);
    }
  };

  const handleProductTypeKeysChange = (next: string[]) => {
    setSelectedProductTypeKeys(next);
    if (next.length > 0) clearClientError("productTypeKeys");
  };

  const handlePresenceTypesChange = (values: string[]) => {
    const next = values as StorePresenceType[];
    setPresenceTypes(next);
    if (next.length > 0) clearClientError("presenceTypes");
  };

  const handleAddContactChannel = ({ type, value }: { type: StoreContactChannelType; value: string }) => {
    const nextId = nextContactRowIdRef.current;
    nextContactRowIdRef.current += 1;
    setContactChannelEntries((previous) => [...previous, { id: nextId, type, value }]);
  };

  const handleUpdateContactChannel = (id: number, next: { type: StoreContactChannelType; value: string }) => {
    setContactChannelEntries((previous) => previous.map((entry) => (entry.id === id ? { ...entry, ...next } : entry)));
  };

  const handleRemoveContactChannel = (id: number) => {
    setContactChannelEntries((previous) => previous.filter((entry) => entry.id !== id));
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

  const handleLogoRemove = () => {
    posthog.capture(POSTHOG_EVENTS.STORE.LOGO_REMOVED, {
      flow: mode.kind,
      ...(editStore ? { store_slug: editStore.slug } : {}),
    });
  };

  const handleSubmit = async (formData: FormData) => {
    if (mode.kind === "create") {
      const submitCandidates = await checkDuplicateCandidatesOnSubmit(formData);
      if (submitCandidates.length > 0) {
        setDuplicateCandidates(submitCandidates);
        setShowConfirmDuplicate(true);
        pendingFormDataRef.current = formData;
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

    if (showChannels) {
      nextFormData.set("logoAction", logoSubmission.action);
      if (logoSubmission.action === "set" && logoSubmission.file) {
        nextFormData.set("logoFile", logoSubmission.file, logoSubmission.file.name);
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
  const logoError = fieldErrors.logo?.[0] ?? null;

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
    if (showChannels) {
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
  }, [showChannels, tCreateRedesign]);

  if (mode.kind === "create" && success) {
    return (
      <div className="space-y-6">
        <Typography size="sm" className="text-text-body" role="status" aria-live="polite">
          {t("success.redirectingToStore")}
        </Typography>
      </div>
    );
  }

  const reviewStepN = showChannels ? 5 : 4;
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
        sellerType: tCreate(sellerTypeLabelKey(sellerType)),
        country: countryCode ? tCountries(countryCode) : "",
      })
    : null;

  const inlineDuplicateCandidates =
    !showConfirmDuplicate && mode.kind === "create" && duplicateCandidates.length > 0 ? duplicateCandidates : [];

  const valuesSnapshot: StoreFormValuesSnapshot = {
    sellerType,
    isPrivate,
    name: nameValue,
    countryCode,
    productTypeKeys: selectedProductTypeKeys,
    presenceTypes,
    importCountries: selectedImportCountries,
    contactChannels: contactChannelEntries,
    addresses: addressData,
  };

  const initialSnapshot: StoreFormInitialSnapshot = {
    name: initialName,
    countryCode: initialCountryCode,
    productTypeKeys: initialProductTypeKeys,
    contactChannelCount: initialContactChannelEntries.length,
    addressCount: initialAddressEntries.length,
  };

  return (
    <div
      className={cn(
        "space-y-4",
        // Reserve space for the mobile sticky action bar so content doesn't sit
        // behind it. Desktop has no sticky bar → no extra padding needed.
        !isEditMode && "pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0",
      )}
    >
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
        <DuplicateCandidatesList candidates={duplicateCandidates} />
      </Modal>

      {serverError && (
        <Typography size="sm" className="text-destructive" role="alert">
          {renderTopLevelError(serverError)}
        </Typography>
      )}

      <form ref={formRef} onSubmit={handleFormSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {/* Hidden inputs that the server actions read regardless of which step renders them */}
        <input type="hidden" name="sellerType" value={sellerType} />
        {sellerType === "PERSON" && isPrivate && <input type="hidden" name="isPrivate" value="on" />}
        {hasStock && <input type="hidden" name="hasStock" value="on" />}
        {receivesOrders && <input type="hidden" name="receivesOrders" value="on" />}
        {isEditMode && isClosed && <input type="hidden" name="closed" value="on" />}
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
              variant={isMobile ? "compact" : "default"}
              compactEyebrow={tCreateRedesign("stepperCompactEyebrow", {
                current: activeStep,
                total: stepperSteps.length,
              })}
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
            <StoreFormStepType
              isEditMode={isEditMode}
              lockedCaption={lockedCaption}
              sellerType={sellerType}
              isPrivate={isPrivate}
              onSellerTypeChange={handleSellerTypeChange}
              onIsPrivateChange={setIsPrivate}
            />

            <StoreFormStepIdentity
              isEditMode={isEditMode}
              lockedCaption={lockedCaption}
              sellerType={sellerType}
              nameValue={nameValue}
              onNameChange={handleNameChange}
              onNameBlur={handleNameBlur}
              countryCode={countryCode}
              onCountryCodeChange={handleCountryCodeChange}
              countryOptions={countryOptions}
              descriptionValue={descriptionValue}
              onDescriptionChange={handleDescriptionChange}
              inlineDuplicateCandidates={inlineDuplicateCandidates}
              initialLogoUrl={editInitial?.logoUrl ?? null}
              logoError={logoError}
              renderLogoError={renderLogoError}
              onLogoChange={setLogoSubmission}
              onLogoRemove={handleLogoRemove}
              fieldErrors={fieldErrors}
              clientErrors={clientErrors}
              onClientErrorsChange={setClientErrors}
            />

            <StoreFormStepCatalog
              isEditMode={isEditMode}
              sellerType={sellerType}
              requestModalSource={mode.kind === "create" ? "create" : "edit"}
              productTypes={productTypes}
              countryOptions={countryOptions}
              selectedProductTypeKeys={selectedProductTypeKeys}
              onProductTypeKeysChange={handleProductTypeKeysChange}
              presenceTypes={presenceTypes}
              onPresenceTypesChange={handlePresenceTypesChange}
              selectedImportCountries={selectedImportCountries}
              onImportCountriesChange={setSelectedImportCountries}
              hasStock={hasStock}
              onHasStockChange={setHasStock}
              receivesOrders={receivesOrders}
              onReceivesOrdersChange={setReceivesOrders}
              fieldErrors={fieldErrors}
              clientErrors={clientErrors}
              onClientErrorsChange={setClientErrors}
            />

            {showChannels && (
              <StoreFormStepChannels
                isEditMode={isEditMode}
                contactChannelEntries={contactChannelEntries}
                onAddContactChannel={handleAddContactChannel}
                onUpdateContactChannel={handleUpdateContactChannel}
                onRemoveContactChannel={handleRemoveContactChannel}
                addressEntries={addressData}
                onAddAddress={handleAddAddress}
                onUpdateAddress={handleUpdateAddress}
                onRemoveAddress={handleRemoveAddress}
                fieldErrors={fieldErrors}
                clientErrors={clientErrors}
                onClientErrorsChange={setClientErrors}
              />
            )}

            <StoreFormStepReview
              n={reviewStepN}
              isEditMode={isEditMode}
              isCreateFlow={mode.kind === "create"}
              isChangeRequestMode={isChangeRequestMode}
              values={valuesSnapshot}
              submitLabel={submitLabel}
              isPending={isPending}
              onSubmit={triggerSubmit}
              comment={comment}
              onCommentChange={handleCommentChange}
              isClosed={isClosed}
              onIsClosedChange={setIsClosed}
            />
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

        <StoreFormAside isEditMode={isEditMode} values={valuesSnapshot} initialValues={initialSnapshot} />
      </form>
    </div>
  );
}

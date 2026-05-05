"use client";

import { Globe, Plus, Store } from "lucide-react";
import { getStoreProductTypeIcon } from "@/lib/catalog/storeProductTypeIcons";
import { type FormEvent, startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import Button from "@/components/core/Button/Button";
import Eyebrow from "@/components/core/Eyebrow";
import FieldCharacterCount from "@/components/core/FieldCharacterCount";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import BackNavLink from "@/components/core/BackNavLink";
import type { StepperStep } from "@/components/core/Stepper";
import { WizardAccordion, WizardStep } from "@/components/modules/WizardAccordion";
import { cn } from "@/lib/styles";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { STORE_LOGO_MAX_SOURCE_SIZE_MB } from "@/lib/store/logoShared";
import type { EditableStore, EditableStoreInput, StoreGovernanceViewerContext } from "@/queries/storeGovernance";
import StoreAddressList from "../../../_components/share/StoreAddressList";
import { type StoreContactChannelType } from "../../../_components/share/StoreContactChannelList";
import StoreContactChannelEditor from "../../../_components/share/StoreContactChannelEditor";
import StoreLogoField, { type StoreLogoSubmission } from "../../../_components/share/StoreLogoField/StoreLogoField";
import CollectorCountryFlagEmoji from "../../../_components/share/CollectorCountryFlagEmoji";
import MultiTagAutocomplete from "@/components/core/MultiTagAutocomplete";
import StoreProductTypeRequestModal from "../../../_components/share/StoreProductTypeRequestModal";
import InlineSwitch from "../../../_components/share/InlineSwitch";
import ToggleChoiceGroup from "@/components/core/ToggleChoiceGroup";
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
  const tRedesign = useTranslations("stores.redesign.create");
  const tCountries = useTranslations("countries");
  const tProductTypes = useTranslations("storeProductTypes");
  const tChannelTypes = useTranslations("stores.contactChannelTypes");
  const tValidation = useTranslations("stores.validation");

  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(initialValues.description ?? "");
  const [logoSubmission, setLogoSubmission] = useState<StoreLogoSubmission>({
    action: "keep",
    file: null,
    cropArea: null,
  });
  const [presenceTypes, setPresenceTypes] = useState<Array<"ONLINE" | "PHYSICAL">>(
    initialValues.presenceTypes as Array<"ONLINE" | "PHYSICAL">,
  );
  const [selectedProductTypeKeys, setSelectedProductTypeKeys] = useState(initialValues.productTypeKeys);
  const [selectedImportCountries, setSelectedImportCountries] = useState(initialValues.importCountries ?? []);
  const [hasStock, setHasStock] = useState(Boolean(initialValues.hasStock));
  const [receivesOrders, setReceivesOrders] = useState(Boolean(initialValues.receivesOrders));
  const [isPrivate, setIsPrivate] = useState(Boolean(initialValues.isPrivate));
  const [comment, setComment] = useState(existingChangeRequest?.comment ?? "");
  const [contactChannelEntries, setContactChannelEntries] = useState<
    Array<{ id: number; type: StoreContactChannelType; value: string }>
  >(
    (initialValues.contactChannels ?? []).map((channel, index) => ({
      id: index + 1,
      type: channel.type as StoreContactChannelType,
      value: channel.value,
    })),
  );
  const [addressRows, setAddressRows] = useState<number[]>(initialValues.addresses?.map((_, index) => index + 1) ?? []);
  const [addressCityByRowId, setAddressCityByRowId] = useState<Record<number, string>>(
    Object.fromEntries((initialValues.addresses ?? []).map((address, index) => [index + 1, address.city ?? ""])),
  );
  const [addressLineByRowId, setAddressLineByRowId] = useState<Record<number, string>>(
    Object.fromEntries((initialValues.addresses ?? []).map((address, index) => [index + 1, address.addressLine])),
  );
  const [addressReferenceByRowId, setAddressReferenceByRowId] = useState<Record<number, string>>(
    Object.fromEntries((initialValues.addresses ?? []).map((address, index) => [index + 1, address.reference ?? ""])),
  );

  const nextContactRowIdRef = useRef(contactChannelEntries.length + 1);
  const nextAddressRowIdRef = useRef(addressRows.length + 1);
  const formRef = useRef<HTMLFormElement | null>(null);

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
        leadingDecoration: <CollectorCountryFlagEmoji countryCode={country.code} />,
      })),
    [countries, tCountries],
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

  const presenceOptions = useMemo(
    () => [
      { value: "PHYSICAL", label: t("create.presencePhysical"), icon: <Store aria-hidden /> },
      { value: "ONLINE", label: t("create.presenceOnline"), icon: <Globe aria-hidden /> },
    ],
    [t],
  );

  const fieldErrors = state?.success === false ? (state.fieldErrors ?? {}) : {};
  const serverError = state?.success === false ? state.error : null;
  const modeKey = canDirectlyEdit ? "edit.direct" : "edit.changeRequest";

  const handleAddAddress = () => {
    const nextId = nextAddressRowIdRef.current;
    nextAddressRowIdRef.current += 1;
    setAddressRows((previous) => [...previous, nextId]);
  };

  const handleRemoveContactChannel = (id: number) => {
    setContactChannelEntries((previous) => previous.filter((entry) => entry.id !== id));
  };

  const handleRemoveAddress = (rowId: number) => {
    setAddressRows((previous) => previous.filter((item) => item !== rowId));
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

  const contactChannelGenericError = useMemo(() => {
    if (fieldErrors.contactChannels?.[0]) return fieldErrors.contactChannels[0];
    const firstKey = Object.keys(fieldErrors).find((key) => key.startsWith("contactChannels."));
    return firstKey ? (fieldErrors[firstKey]?.[0] ?? null) : null;
  }, [fieldErrors]);

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

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextFormData = new FormData(event.currentTarget);
    if (store.storeType === "BUSINESS") {
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
    handleSubmit(nextFormData);
  };

  const triggerSubmit = () => formRef.current?.requestSubmit();

  const stepperSteps: StepperStep[] = useMemo(() => {
    const baseSteps: StepperStep[] = [
      { n: 1, label: tRedesign("step2.eyebrow") },
      { n: 2, label: tRedesign("step3.eyebrow") },
    ];
    if (store.storeType === "BUSINESS") {
      baseSteps.push({ n: 3, label: tRedesign("step4.eyebrow") });
    }
    baseSteps.push({ n: store.storeType === "BUSINESS" ? 4 : 3, label: tRedesign("step5.eyebrow") });
    return baseSteps;
  }, [store.storeType, tRedesign]);

  const reviewStepN = store.storeType === "BUSINESS" ? 4 : 3;

  const step1Valid = name.trim().length > 0;
  const step2Valid = selectedProductTypeKeys.length > 0 && presenceTypes.length > 0;

  return (
    <div className="space-y-4">
      <BackNavLink href={`/${locale}${ROUTES.stores}/${store.slug}`}>{t("edit.backToDetail")}</BackNavLink>
      <div>
        <Eyebrow as="p">{t(`${modeKey}.shortLabel` as never)}</Eyebrow>
        <p className="mt-1 [font-size:var(--text-body)] [color:var(--text-secondary)]">
          {t(`${modeKey}.description` as never)}
        </p>
      </div>

      {serverError && (
        <Typography size="sm" className="text-destructive" role="alert">
          {renderError(serverError)}
        </Typography>
      )}

      <form ref={formRef} onSubmit={handleFormSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <input type="hidden" name="slug" value={store.slug} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="storeType" value={store.storeType} />
        <input type="hidden" name="countryCode" value={store.countryCode} />
        {hasStock && <input type="hidden" name="hasStock" value="on" />}
        {receivesOrders && <input type="hidden" name="receivesOrders" value="on" />}
        {store.storeType === "PERSON" && isPrivate && <input type="hidden" name="isPrivate" value="on" />}

        <div className="min-w-0">
          <WizardAccordion startStep={1} steps={stepperSteps} stepperAriaLabel={tRedesign("stepperLabel")}>
            {/* ── Step 1: Identidad ── */}
            <WizardStep
              n={1}
              eyebrow={tRedesign("step2.eyebrow")}
              title={tRedesign("step2.title")}
              primaryAction={{ label: tRedesign("continue"), disabled: !step1Valid }}
              summary={name || undefined}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
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

                <div className="md:col-span-2">
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

                {store.storeType === "BUSINESS" && (
                  <div className="md:col-span-2">
                    <StoreLogoField
                      id="edit-store-logo"
                      initialLogoUrl={initialValues.logoUrl ?? null}
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
                      error={fieldErrors.logo?.[0] ?? null}
                      renderError={renderError}
                      onChange={setLogoSubmission}
                      onRemove={() =>
                        posthog.capture(POSTHOG_EVENTS.STORE.LOGO_REMOVED, {
                          flow: "edit",
                          mode: canDirectlyEdit ? "direct" : "change_request",
                          store_slug: store.slug,
                        })
                      }
                    />
                  </div>
                )}
              </div>
            </WizardStep>

            {/* ── Step 2: Categorías y presencia ── */}
            <WizardStep
              n={2}
              eyebrow={tRedesign("step3.eyebrow")}
              title={tRedesign("step3.title")}
              primaryAction={{ label: tRedesign("continue"), disabled: !step2Valid }}
              secondaryAction={{ label: tRedesign("back") }}
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
                  <Label>{t("create.productTypesLabel")}</Label>
                  <ToggleChoiceGroup
                    mode="multiple"
                    options={productTypeOptions}
                    selectedValues={selectedProductTypeKeys}
                    onChange={setSelectedProductTypeKeys}
                    formName="productTypeKeys"
                    trailingSlot={<StoreProductTypeRequestModal locale={locale} source="edit" triggerVariant="chip" />}
                  />
                </div>

                <div className="space-y-3">
                  <Label>{t("create.presenceLabel")}</Label>
                  <ToggleChoiceGroup
                    mode="multiple"
                    options={presenceOptions}
                    selectedValues={presenceTypes}
                    onChange={(values) => setPresenceTypes(values as Array<"ONLINE" | "PHYSICAL">)}
                    formName="presenceTypes"
                  />
                  {fieldErrors.presenceTypes?.[0] && (
                    <Typography size="xs" className="text-destructive" role="alert">
                      {renderError(fieldErrors.presenceTypes[0])}
                    </Typography>
                  )}
                </div>

                <div className="flex flex-wrap gap-6">
                  <InlineSwitch label={tRedesign("step3.hasStockLabel")} checked={hasStock} onChange={setHasStock} />
                  <InlineSwitch
                    label={tRedesign("step3.receivesOrdersLabel")}
                    checked={receivesOrders}
                    onChange={setReceivesOrders}
                  />
                  {store.storeType === "PERSON" && (
                    <InlineSwitch label={tRedesign("step1.privateLabel")} checked={isPrivate} onChange={setIsPrivate} />
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="edit-import-countries">{t("create.importCountriesLabel")}</Label>
                  <MultiTagAutocomplete
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
              </div>
            </WizardStep>

            {/* ── Step 3: Canales (BUSINESS only) ── */}
            {store.storeType === "BUSINESS" && (
              <WizardStep
                n={3}
                eyebrow={tRedesign("step4.eyebrow")}
                title={tRedesign("step4.title")}
                primaryAction={{ label: tRedesign("continue") }}
                secondaryAction={{ label: tRedesign("back") }}
                summary={
                  contactChannelEntries.length + addressRows.length > 0
                    ? `${contactChannelEntries.length + addressRows.length}`
                    : undefined
                }
              >
                <div className="space-y-5">
                  <div className="space-y-3">
                    <Label>{t("create.contactChannelsLabel")}</Label>
                    <StoreContactChannelEditor
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
                      labels={{
                        typeLabel: t("create.contactChannelType"),
                        valueLabel: t("create.contactChannelValue"),
                        helper: tRedesign("channels.helper"),
                        addButton: tRedesign("channels.addButton"),
                        edit: tRedesign("channels.edit"),
                        save: tRedesign("channels.save"),
                        cancel: tRedesign("channels.cancel"),
                        remove: t("create.remove"),
                        optionLabel: (type) => tChannelTypes(type),
                        valuePlaceholder: (type) => t(`create.contactChannelPlaceholder.${type}` as never),
                      }}
                    />
                    {contactChannelGenericError && (
                      <Typography size="xs" className="text-destructive mt-1" role="alert">
                        {contactChannelGenericError}
                      </Typography>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label>{t("create.addressesLabel")}</Label>
                    {addressRows.length > 0 && (
                      <StoreAddressList
                        idPrefix="edit-address"
                        rows={addressRows.map((rowId, rowIndex) => ({
                          rowId,
                          rowIndex,
                          city: addressCityByRowId[rowId] ?? "",
                          addressLine: addressLineByRowId[rowId] ?? "",
                          reference: addressReferenceByRowId[rowId] ?? "",
                          cityError: fieldErrors[`addresses.${rowIndex}.city`]?.[0] ?? undefined,
                          addressLineError: fieldErrors[`addresses.${rowIndex}.addressLine`]?.[0] ?? undefined,
                          referenceError: fieldErrors[`addresses.${rowIndex}.reference`]?.[0] ?? undefined,
                        }))}
                        cityLabel={t("create.addressCity")}
                        addressLineLabel={t("create.addressLine")}
                        referenceLabel={t("create.addressReference")}
                        cityInputName="addressCity"
                        addressLineInputName="addressAddressLine"
                        referenceInputName="addressReference"
                        removeLabel={t("create.remove")}
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
                        renderCityError={renderError}
                        renderAddressLineError={renderError}
                        renderReferenceError={renderError}
                      />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAddAddress}
                      leadingIcon={<Plus size={13} aria-hidden />}
                    >
                      {t("create.addAddress")}
                    </Button>
                  </div>
                </div>
              </WizardStep>
            )}

            {/* ── Step 4 (BUSINESS) / Step 3 (PERSON): Listo ── */}
            <WizardStep
              n={reviewStepN}
              eyebrow={tRedesign("step5.eyebrow")}
              title={tRedesign("step5.title")}
              primaryAction={{
                label: isPending ? t(`${modeKey}.submitting` as never) : t(`${modeKey}.submitCta` as never),
                onClick: triggerSubmit,
                loading: isPending,
              }}
              secondaryAction={{ label: tRedesign("back") }}
              autoAdvance={false}
            >
              <div className="space-y-4">
                {!canDirectlyEdit && (
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
                )}

                <div className="rounded-[var(--radius-md)] p-3 [background:var(--surface)] [border:1px_solid_var(--border)]">
                  <Eyebrow as="p">{tRedesign("summaryEyebrow")}</Eyebrow>
                  <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <SummaryRow label={t("create.nameLabel")} value={name || "—"} />
                    <SummaryRow
                      label={t("create.presenceLabel")}
                      value={
                        presenceTypes
                          .map((p) =>
                            t(
                              `create.presence${p === "ONLINE" ? "Online" : "Physical"}` as
                                | "create.presenceOnline"
                                | "create.presencePhysical",
                            ),
                          )
                          .join(" · ") || "—"
                      }
                    />
                    <SummaryRow
                      label={t("create.productTypesLabel")}
                      value={selectedProductTypeKeys.map((k) => tProductTypes(k)).join(" · ") || "—"}
                    />
                    {selectedImportCountries.length > 0 && (
                      <SummaryRow
                        label={t("create.importCountriesLabel")}
                        value={selectedImportCountries.map((code) => tCountries(code)).join(" · ")}
                      />
                    )}
                    {store.storeType === "BUSINESS" && contactChannelEntries.length > 0 && (
                      <SummaryRow label={t("create.contactChannelsLabel")} value={`${contactChannelEntries.length}`} />
                    )}
                    {store.storeType === "BUSINESS" && addressRows.length > 0 && (
                      <SummaryRow label={t("create.addressesLabel")} value={`${addressRows.length}`} />
                    )}
                  </dl>
                </div>
              </div>
            </WizardStep>
          </WizardAccordion>
        </div>

        {/* ── Aside Resumen sticky ── */}
        <aside className="lg:[position:sticky] lg:[top:calc(var(--header-h-desktop,4rem)_+_var(--space-4,1rem))] lg:self-start">
          <div className="rounded-[var(--radius-xl)] p-4 [background:var(--surface-elevated)] [border:1px_solid_var(--border)] md:p-5">
            <Eyebrow as="p">{tRedesign("summaryEyebrow")}</Eyebrow>
            <dl className="mt-3 flex flex-col">
              <AsideSummaryRow
                label={t("create.storeTypeLabel")}
                value={store.storeType === "BUSINESS" ? t("create.storeTypeBusiness") : t("create.storeTypePerson")}
              />
              <AsideSummaryRow label={t("create.nameLabel")} value={name || "—"} muted={!name} />
              <AsideSummaryRow label={t("create.countryLabel")} value={tCountries(store.countryCode)} />
              <AsideSummaryRow
                label={t("create.productTypesLabel")}
                value={selectedProductTypeKeys.length > 0 ? `${selectedProductTypeKeys.length}` : "—"}
                muted={selectedProductTypeKeys.length === 0}
              />
              {store.storeType === "PERSON" && isPrivate && (
                <AsideSummaryRow label={tRedesign("step1.privateLabel")} value="✓" />
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
    <div className="flex flex-col gap-0.5">
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

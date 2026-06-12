"use client";

import { type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { useLocale, useTranslations } from "next-intl";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import SearchableSelect from "@/components/core/SearchableSelect";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";
import { WizardStep } from "@/components/modules/WizardAccordion";
import { STORE_LOGO_MAX_SOURCE_SIZE_MB } from "@/lib/store/logoShared";
import type { DuplicateCandidate } from "@/queries/store";
import {
  IDENTITY_STEP_FIELDS,
  mergeStepClientErrors,
  validateIdentityStep,
  type StoreFormClientErrors,
} from "../../../_utils/storeFormValidation";
import CollectorCountryFlagEmoji from "../CollectorCountryFlagEmoji";
import DuplicateAlertInline from "../DuplicateAlertInline";
import StoreLogoField, { type StoreLogoSubmission } from "../StoreLogoField/StoreLogoField";
import FieldErrorMsg from "./FieldErrorMsg";
import type { StoreCountryOption, StoreFormFieldErrors, StoreTypeValue } from "./types";

type StoreFormStepIdentityProps = {
  isEditMode: boolean;
  lockedCaption: string | null;
  storeType: StoreTypeValue;
  nameValue: string;
  onNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onNameBlur: () => void;
  countryCode: string;
  onCountryCodeChange: (value: string) => void;
  countryOptions: StoreCountryOption[];
  descriptionValue: string;
  onDescriptionChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  /** Already gated by the parent: empty unless the inline alert should render. */
  inlineDuplicateCandidates: DuplicateCandidate[];
  initialLogoUrl: string | null;
  logoError: string | null;
  renderLogoError: (errorKey: string) => string;
  onLogoChange: (submission: StoreLogoSubmission) => void;
  onLogoRemove: () => void;
  fieldErrors: StoreFormFieldErrors;
  clientErrors: StoreFormClientErrors;
  onClientErrorsChange: Dispatch<SetStateAction<StoreFormClientErrors>>;
};

export default function StoreFormStepIdentity({
  isEditMode,
  lockedCaption,
  storeType,
  nameValue,
  onNameChange,
  onNameBlur,
  countryCode,
  onCountryCodeChange,
  countryOptions,
  descriptionValue,
  onDescriptionChange,
  inlineDuplicateCandidates,
  initialLogoUrl,
  logoError,
  renderLogoError,
  onLogoChange,
  onLogoRemove,
  fieldErrors,
  clientErrors,
  onClientErrorsChange,
}: StoreFormStepIdentityProps) {
  const locale = useLocale();
  const t = useTranslations("stores");
  const tCreate = useTranslations("stores.create");
  const tCreateRedesign = useTranslations("stores.redesign.create");
  const tValidation = useTranslations("stores.validation");
  const tCountries = useTranslations("countries");

  const handleValidate = () => {
    const stepErrors = validateIdentityStep({
      name: nameValue,
      countryCode,
      requireCountry: !isEditMode,
    });
    onClientErrorsChange((prev) => mergeStepClientErrors(prev, IDENTITY_STEP_FIELDS, stepErrors));
    return Object.keys(stepErrors).length === 0;
  };

  const renderLockedCountry = () => (
    <div className="flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2.5 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
      <CollectorCountryFlagEmoji countryCode={countryCode} />
      <Typography size="sm" className="[color:var(--text-primary)]">
        {countryCode ? tCountries(countryCode) : "—"}
      </Typography>
    </div>
  );

  return (
    <WizardStep
      n={2}
      eyebrow={tCreateRedesign("step2.eyebrow")}
      title={tCreateRedesign("step2.title")}
      primaryAction={{ label: tCreateRedesign("continue") }}
      secondaryAction={{ label: tCreateRedesign("back") }}
      summary={nameValue && countryCode ? `${nameValue} · ${tCountries(countryCode)}` : undefined}
      actionsLayout={isEditMode ? "inline" : "sticky-on-mobile"}
      hasError={Boolean(clientErrors.name || clientErrors.countryCode)}
      validate={handleValidate}
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
            onChange={onNameChange}
            onBlur={onNameBlur}
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
                onChange={(value) => onCountryCodeChange(value ?? "")}
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

        {inlineDuplicateCandidates.length > 0 && (
          <div className="md:col-span-2">
            <DuplicateAlertInline
              candidates={inlineDuplicateCandidates}
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
              initialLogoUrl={initialLogoUrl}
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
              onChange={onLogoChange}
              onRemove={onLogoRemove}
            />
          </div>
        )}

        <div className="md:col-span-2">
          <Label htmlFor="store-description">{tCreate("descriptionLabel")}</Label>
          <Textarea
            id="store-description"
            name="description"
            value={descriptionValue}
            onChange={onDescriptionChange}
            placeholder={tCreate("descriptionPlaceholder")}
            rows={3}
            maxLength={2000}
          />
        </div>
      </div>
    </WizardStep>
  );
}

"use client";

import { Plus } from "lucide-react";
import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import Label from "@/components/core/Label";
import Typography from "@/components/core/Typography";
import { WizardStep } from "@/components/modules/WizardAccordion";
import {
  CHANNELS_STEP_FIELDS,
  mergeStepClientErrors,
  validateChannelsStep,
  type StoreFormClientErrors,
} from "../../../_utils/storeFormValidation";
import StoreAddressEditor, { type StoreAddressEditorHandle } from "../StoreAddressEditor";
import StoreContactChannelEditor, { type StoreContactChannelEditorHandle } from "../StoreContactChannelEditor";
import { type StoreContactChannelType } from "../StoreContactChannelList";
import FieldErrorMsg from "./FieldErrorMsg";
import type { StoreAddressEntry, StoreContactChannelEntry, StoreFormFieldErrors } from "./types";

type StoreFormStepChannelsProps = {
  isEditMode: boolean;
  contactChannelEntries: StoreContactChannelEntry[];
  onAddContactChannel: (entry: { type: StoreContactChannelType; value: string }) => void;
  onUpdateContactChannel: (id: number, next: { type: StoreContactChannelType; value: string }) => void;
  onRemoveContactChannel: (id: number) => void;
  addressEntries: StoreAddressEntry[];
  onAddAddress: (entry: { city: string; addressLine: string; reference: string }) => void;
  onUpdateAddress: (id: number, next: { city: string; addressLine: string; reference: string }) => void;
  onRemoveAddress: (id: number) => void;
  fieldErrors: StoreFormFieldErrors;
  clientErrors: StoreFormClientErrors;
  onClientErrorsChange: Dispatch<SetStateAction<StoreFormClientErrors>>;
};

export default function StoreFormStepChannels({
  isEditMode,
  contactChannelEntries,
  onAddContactChannel,
  onUpdateContactChannel,
  onRemoveContactChannel,
  addressEntries,
  onAddAddress,
  onUpdateAddress,
  onRemoveAddress,
  fieldErrors,
  clientErrors,
  onClientErrorsChange,
}: StoreFormStepChannelsProps) {
  const tCreate = useTranslations("stores.create");
  const tCreateRedesign = useTranslations("stores.redesign.create");
  const tChannelTypes = useTranslations("stores.contactChannelTypes");

  const [isChannelFormOpen, setIsChannelFormOpen] = useState(false);
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  const channelEditorRef = useRef<StoreContactChannelEditorHandle | null>(null);
  const addressEditorRef = useRef<StoreAddressEditorHandle | null>(null);

  const contactChannelGenericError = useMemo(() => {
    if (fieldErrors.contactChannels?.[0]) return fieldErrors.contactChannels[0];
    const firstKey = Object.keys(fieldErrors).find((key) => key.startsWith("contactChannels."));
    return firstKey ? (fieldErrors[firstKey]?.[0] ?? null) : null;
  }, [fieldErrors]);

  const getContactChannelPlaceholder = (type: StoreContactChannelType) => {
    return tCreate(`contactChannelPlaceholder.${type}`);
  };

  const handleValidate = () => {
    const stepErrors = validateChannelsStep({ isChannelFormOpen, isAddressFormOpen });
    onClientErrorsChange((prev) => mergeStepClientErrors(prev, CHANNELS_STEP_FIELDS, stepErrors));
    return Object.keys(stepErrors).length === 0;
  };

  const handleOpenChannelForm = () => {
    channelEditorRef.current?.openForm();
  };

  const handleOpenAddressForm = () => {
    addressEditorRef.current?.openForm();
  };

  return (
    <WizardStep
      n={4}
      eyebrow={tCreateRedesign("step4.eyebrow")}
      title={tCreateRedesign("step4.title")}
      primaryAction={{ label: tCreateRedesign("continue") }}
      secondaryAction={{ label: tCreateRedesign("back") }}
      summary={
        contactChannelEntries.length + addressEntries.length > 0
          ? `${contactChannelEntries.length + addressEntries.length}`
          : undefined
      }
      actionsLayout={isEditMode ? "inline" : "sticky-on-mobile"}
      validate={handleValidate}
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
                onClick={handleOpenChannelForm}
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
            onAdd={onAddContactChannel}
            onUpdate={onUpdateContactChannel}
            onRemove={onRemoveContactChannel}
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
          {clientErrors.channelFormOpen && <FieldErrorMsg>{tCreateRedesign("channels.formOpenWarning")}</FieldErrorMsg>}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label>{tCreate("addressesLabel")}</Label>
            {!isAddressFormOpen && (
              <Button
                type="button"
                variant="tonal"
                size="sm"
                onClick={handleOpenAddressForm}
                leadingIcon={<Plus size={13} aria-hidden />}
              >
                {tCreate("addAddress")}
              </Button>
            )}
          </div>
          <StoreAddressEditor
            ref={addressEditorRef}
            hideTrigger
            entries={addressEntries}
            onAdd={onAddAddress}
            onUpdate={onUpdateAddress}
            onRemove={onRemoveAddress}
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
  );
}

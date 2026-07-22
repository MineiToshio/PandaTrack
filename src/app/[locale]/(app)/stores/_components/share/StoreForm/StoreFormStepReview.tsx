"use client";

import { Check } from "lucide-react";
import { type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import Eyebrow from "@/components/core/Eyebrow";
import Label from "@/components/core/Label";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import { WizardStep } from "@/components/modules/WizardAccordion";
import InlineSwitch from "../InlineSwitch";
import type { StoreFormValuesSnapshot } from "./types";

type StoreFormStepReviewProps = {
  n: number;
  isEditMode: boolean;
  isCreateFlow: boolean;
  isChangeRequestMode: boolean;
  values: StoreFormValuesSnapshot;
  submitLabel: string;
  isPending: boolean;
  onSubmit: () => void;
  comment: string;
  onCommentChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  isClosed: boolean;
  onIsClosedChange: (next: boolean) => void;
};

export default function StoreFormStepReview({
  n,
  isEditMode,
  isCreateFlow,
  isChangeRequestMode,
  values,
  submitLabel,
  isPending,
  onSubmit,
  comment,
  onCommentChange,
  isClosed,
  onIsClosedChange,
}: StoreFormStepReviewProps) {
  const tCreate = useTranslations("stores.create");
  const tCreateRedesign = useTranslations("stores.redesign.create");
  const tEdit = useTranslations("stores.edit");
  const tCountries = useTranslations("countries");
  const tProductTypes = useTranslations("storeProductTypes");
  const tChannelTypes = useTranslations("stores.contactChannelTypes");

  const renderReviewSummary = () => (
    <div className="rounded-[var(--radius-lg)] p-4 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
      <dl className="grid [grid-template-columns:auto_1fr] items-baseline [gap:6px_16px] [font-size:var(--text-body)]">
        <ReviewRow
          label={tCreateRedesign("aside.typeLabel")}
          value={values.storeType === "BUSINESS" ? tCreate("storeTypeBusiness") : tCreate("storeTypePerson")}
        />
        {values.storeType === "PERSON" && values.isPrivate && (
          <ReviewRow label={tCreateRedesign("step1.privateLabel")} value="✓" />
        )}
        <ReviewRow label={tCreateRedesign("aside.nameLabel")} value={values.name || "—"} />
        <ReviewRow
          label={tCreateRedesign("aside.countryLabel")}
          value={values.countryCode ? tCountries(values.countryCode) : "—"}
        />
        <ReviewSeparator />
        <ReviewRow
          label={tCreateRedesign("aside.categoriesLabel")}
          value={values.productTypeKeys.map((k) => tProductTypes(k)).join(", ") || "—"}
        />
        <ReviewRow
          label={tCreateRedesign("aside.presenceLabel")}
          value={
            values.presenceTypes
              .map((p) =>
                tCreate(`presence${p === "ONLINE" ? "Online" : "Physical"}` as "presenceOnline" | "presencePhysical"),
              )
              .join(", ") || "—"
          }
        />
        {values.importCountries.length > 0 && (
          <ReviewRow
            label={tCreateRedesign("aside.importLabel")}
            value={values.importCountries.map((code) => tCountries(code)).join(", ")}
          />
        )}
        {values.storeType === "BUSINESS" && (values.contactChannels.length > 0 || values.addresses.length > 0) && (
          <ReviewSeparator />
        )}
        {values.storeType === "BUSINESS" && values.contactChannels.length > 0 && (
          <>
            <dt className="pt-0.5 [font-size:var(--text-caption)] [color:var(--text-muted)]">
              {tCreateRedesign("aside.channelsLabel")}
            </dt>
            <dd className="space-y-2">
              {values.contactChannels.map((entry) => (
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
        {values.storeType === "BUSINESS" && values.addresses.length > 0 && (
          <>
            <dt className="pt-0.5 [font-size:var(--text-caption)] [color:var(--text-muted)]">
              {tCreateRedesign("aside.addressesLabel")}
            </dt>
            <dd className="space-y-2">
              {values.addresses.map((addr) => (
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

  return (
    <WizardStep
      n={n}
      eyebrow={tCreateRedesign("step5.eyebrow")}
      title={tCreateRedesign("step5.title")}
      primaryAction={{
        label: submitLabel,
        onClick: onSubmit,
        loading: isPending,
        leadingIcon: <Check size={14} aria-hidden="true" />,
        trailingIcon: null,
      }}
      secondaryAction={{ label: tCreateRedesign("back") }}
      autoAdvance={false}
      actionsLayout={isEditMode ? "inline" : "sticky-on-mobile"}
    >
      <Typography size="xs" className="text-text-muted">
        {tCreateRedesign("step5.helper")}
      </Typography>
      {isCreateFlow && (
        <Typography size="xs" className="text-text-muted mt-1 mb-4">
          {tCreateRedesign("step5.subhelper")}
        </Typography>
      )}
      <div className="space-y-4">
        <Eyebrow as="p">{tCreateRedesign("summaryEyebrow")}</Eyebrow>
        {renderReviewSummary()}
        {isEditMode && (
          <div className="space-y-2 rounded-[var(--radius-lg)] p-4 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
            <Label>{tEdit("closure.sectionLabel")}</Label>
            <Typography size="xs" className="text-text-muted">
              {tEdit("closure.help")}
            </Typography>
            <div className="pt-1">
              <InlineSwitch label={tEdit("closure.label")} checked={isClosed} onChange={onIsClosedChange} />
            </div>
          </div>
        )}
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
              onChange={onCommentChange}
              maxLength={500}
              className="mt-2 resize-y"
            />
          </div>
        )}
      </div>
    </WizardStep>
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

function ReviewSeparator() {
  return <div aria-hidden="true" className="[grid-column:1/-1] my-1 h-px [background:var(--border)]" />;
}

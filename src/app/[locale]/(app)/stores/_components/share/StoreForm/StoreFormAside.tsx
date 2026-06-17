"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import Chip from "@/components/core/Chip";
import { AsideSummary, AsideSummaryRow } from "@/components/modules/AsideSummary";
import type { StoreFormInitialSnapshot, StoreFormValuesSnapshot } from "./types";

type StoreFormAsideProps = {
  isEditMode: boolean;
  values: StoreFormValuesSnapshot;
  initialValues: StoreFormInitialSnapshot;
};

export default function StoreFormAside({ isEditMode, values, initialValues }: StoreFormAsideProps) {
  const tCreate = useTranslations("stores.create");
  const tCreateRedesign = useTranslations("stores.redesign.create");

  return (
    <AsideSummary eyebrow={tCreateRedesign("summaryEyebrow")} className="hidden lg:block">
      <AsideSummaryRow
        label={tCreateRedesign("aside.typeLabel")}
        value={values.storeType === "BUSINESS" ? tCreate("storeTypeBusiness") : tCreate("storeTypePerson")}
      />
      <AsideSummaryRow
        label={tCreateRedesign("aside.nameLabel")}
        value={values.name || "—"}
        muted={!values.name}
        changed={isEditMode && values.name !== initialValues.name}
      />
      <AsideSummaryRow
        label={tCreateRedesign("aside.countryLabel")}
        value={values.countryCode || "—"}
        muted={!values.countryCode}
        changed={isEditMode && values.countryCode !== initialValues.countryCode}
      />
      <AsideSummaryRow
        label={tCreateRedesign("aside.categoriesLabel")}
        value={values.productTypeKeys.length > 0 ? `${values.productTypeKeys.length}` : "—"}
        muted={values.productTypeKeys.length === 0}
        changed={
          isEditMode &&
          (values.productTypeKeys.length !== initialValues.productTypeKeys.length ||
            values.productTypeKeys.some((k) => !initialValues.productTypeKeys.includes(k)))
        }
      />
      {values.storeType === "BUSINESS" && (
        <AsideSummaryRow
          label={tCreateRedesign("aside.channelsLabel")}
          value={`${values.contactChannels.length}`}
          muted={values.contactChannels.length === 0}
          changed={isEditMode && values.contactChannels.length !== initialValues.contactChannelCount}
        />
      )}
      {values.storeType === "BUSINESS" && (
        <AsideSummaryRow
          label={tCreateRedesign("aside.addressesLabel")}
          value={`${values.addresses.length}`}
          muted={values.addresses.length === 0}
          changed={isEditMode && values.addresses.length !== initialValues.addressCount}
        />
      )}
      {values.storeType === "PERSON" && values.isPrivate && (
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
    </AsideSummary>
  );
}

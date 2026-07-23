"use client";

import { Store, User, Truck } from "lucide-react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import Label from "@/components/core/Label";
import ToggleChoiceGroup from "@/components/core/ToggleChoiceGroup";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";
import { WizardStep } from "@/components/modules/WizardAccordion";
import { sellerTypeLabelKey, type SellerTypeValue } from "./types";

type StoreFormStepTypeProps = {
  isEditMode: boolean;
  lockedCaption: string | null;
  sellerType: SellerTypeValue;
  isPrivate: boolean;
  onSellerTypeChange: (next: SellerTypeValue) => void;
  onIsPrivateChange: (next: boolean) => void;
};

export default function StoreFormStepType({
  isEditMode,
  lockedCaption,
  sellerType,
  isPrivate,
  onSellerTypeChange,
  onIsPrivateChange,
}: StoreFormStepTypeProps) {
  const tCreate = useTranslations("stores.create");
  const tCreateRedesign = useTranslations("stores.redesign.create");

  const sellerTypeOptions = useMemo(
    () => [
      {
        value: "RETAILER",
        label: tCreateRedesign("step1.retailerLabel"),
        description: tCreateRedesign("step1.retailerDesc"),
        icon: <Store aria-hidden />,
      },
      {
        value: "PERSON",
        label: tCreateRedesign("step1.personLabel"),
        description: tCreateRedesign("step1.personDesc"),
        icon: <User aria-hidden />,
      },
      {
        value: "PROXY",
        label: tCreateRedesign("step1.proxyLabel"),
        description: tCreateRedesign("step1.proxyDesc"),
        icon: <Truck aria-hidden />,
      },
    ],
    [tCreateRedesign],
  );

  const handleTogglePrivate = () => {
    onIsPrivateChange(!isPrivate);
  };

  return (
    <WizardStep
      n={1}
      eyebrow={tCreateRedesign("step1.eyebrow")}
      title={tCreateRedesign("step1.title")}
      primaryAction={{ label: tCreateRedesign("continue") }}
      summary={tCreate(sellerTypeLabelKey(sellerType))}
      actionsLayout={isEditMode ? "inline" : "sticky-on-mobile"}
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
            options={sellerTypeOptions}
            value={sellerType}
            disabled={isEditMode}
            onChange={(value) => onSellerTypeChange(value as SellerTypeValue)}
          />
          {isEditMode && lockedCaption && (
            <Typography size="xs" className="text-text-muted">
              {lockedCaption}
            </Typography>
          )}
        </div>

        {sellerType === "PERSON" && (
          <div className="pt-4 [border-top:1px_solid_var(--border)]">
            <div className="flex items-start gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={isPrivate}
                aria-labelledby="store-private-label"
                onClick={handleTogglePrivate}
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
  );
}

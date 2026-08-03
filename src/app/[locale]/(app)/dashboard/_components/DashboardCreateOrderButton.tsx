"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import Button, { type ButtonProps } from "@/components/core/Button/Button";
import OrderCreateMethodSelector from "@/components/modules/OrderCreateMethodSelector/OrderCreateMethodSelector";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { cn } from "@/lib/styles";

type DashboardCreateOrderButtonProps = {
  locale: string;
  /** Distinguishes the dashboard header CTA from the activity empty-state CTA in analytics. */
  source: "dashboard_header" | "dashboard_empty_state";
  /** Overrides the default "New order" label (e.g. the empty state's "Create your first order"). */
  label?: string;
  /** Extra PostHog props merged alongside `source`, for callers that tracked more context before. */
  posthogProps?: Record<string, unknown>;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  leadingIcon?: ReactNode;
  className?: string;
};

/**
 * Opens the shared `OrderCreateMethodSelector` overlay instead of linking straight to the
 * manual form, so every "new order" CTA on the dashboard goes through the same choice between
 * image intake and manual entry. Used both for the desktop header CTA (the FAB only covers
 * viewports below `1024px`) and the activity zone's empty-state CTA.
 */
export default function DashboardCreateOrderButton({
  locale,
  source,
  label,
  posthogProps,
  variant = "primary",
  size = "md",
  leadingIcon = <Plus className="size-4" aria-hidden="true" />,
  className,
}: DashboardCreateOrderButtonProps) {
  const t = useTranslations("orders.createEntry");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setIsOpen(true)}
        leadingIcon={leadingIcon}
        posthogEvent={POSTHOG_EVENTS.ORDER.CREATE_METHOD_SELECTOR_OPENED}
        posthogProps={{ source, ...posthogProps }}
        className={cn(className)}
      >
        {label ?? t("fabLabel")}
      </Button>
      <OrderCreateMethodSelector
        presentation="overlay"
        locale={locale}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

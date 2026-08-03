"use client";

import { PlusCircle } from "lucide-react";
import { useState } from "react";
import Button from "@/components/core/Button/Button";
import OrderCreateMethodSelector from "@/components/modules/OrderCreateMethodSelector/OrderCreateMethodSelector";
import { POSTHOG_EVENTS } from "@/lib/constants";

type StoreCreateOrderButtonProps = {
  locale: string;
  storeId: string;
  label: string;
};

/**
 * Store detail's "Log order here" action. Opens the shared `OrderCreateMethodSelector` overlay
 * with the store preselected, instead of linking straight to the manual form: every "create
 * order" CTA in the app must go through the same image-vs-manual choice.
 */
export default function StoreCreateOrderButton({ locale, storeId, label }: StoreCreateOrderButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="primary"
        leadingIcon={<PlusCircle size={16} aria-hidden="true" />}
        fullWidth
        className="justify-start"
        onClick={() => setIsOpen(true)}
        posthogEvent={POSTHOG_EVENTS.ORDER.CREATE_METHOD_SELECTOR_OPENED}
        posthogProps={{ source: "store_detail" }}
      >
        {label}
      </Button>
      <OrderCreateMethodSelector
        presentation="overlay"
        locale={locale}
        storeId={storeId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

"use client";

import { Plus, Tag } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import Modal from "@/components/modules/Modal/Modal";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { useToast } from "@/contexts/ToastContext";
import { saveStoreProductTypeRequest } from "../../_actions/saveStoreProductTypeRequest";
import { storeProductTypeRequestSchema } from "../../_schemas/storeProductTypeRequestSchema";
import { cn } from "@/lib/styles";

type StoreProductTypeRequestModalProps = {
  locale: string;
  source: "create" | "edit";
  /** `chip`: dashed tag-style control for use next to product type options. */
  triggerVariant?: "default" | "chip";
};

export function StoreProductTypeRequestChip({ onOpen }: { onOpen: () => void }) {
  const t = useTranslations("stores");

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "inline-flex max-w-full cursor-pointer items-center gap-2 rounded-[var(--radius-pill)] px-3 py-1.5 text-left text-[13px] transition",
        "[color:var(--text-secondary)] [background:var(--surface-elevated)] [border:1.5px_dashed_var(--border-strong)]",
        "hover:[border-color:color-mix(in_oklch,var(--accent)_50%,var(--border-strong))]",
        "focus-visible:[outline:2px_solid_var(--focus-ring)] focus-visible:[outline-offset:2px]",
      )}
    >
      <Plus className="size-3.5 shrink-0 [color:var(--accent-cool)]" aria-hidden />
      <span className="min-w-0 whitespace-normal">{t("governance.productTypeRequest.chipCta")}</span>
    </button>
  );
}

function translateError(t: ReturnType<typeof useTranslations>, errorKey: string) {
  return t.has(`governance.productTypeRequest.errors.${errorKey}`)
    ? t(`governance.productTypeRequest.errors.${errorKey}`)
    : t("error.validation_failed");
}

export default function StoreProductTypeRequestModal({
  locale,
  source,
  triggerVariant = "default",
}: StoreProductTypeRequestModalProps) {
  const t = useTranslations("stores");
  const { addToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [suggestedName, setSuggestedName] = useState("");
  const [reason, setReason] = useState("");

  // Clears the error for a single field when the user starts editing it.
  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const openModal = () => {
    setFieldErrors({});
    setIsOpen(true);
    posthog.capture(POSTHOG_EVENTS.STORE.PRODUCT_TYPE_REQUEST_OPENED, {
      source,
    });
  };

  const closeModal = () => {
    if (isPending) return;
    setIsOpen(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Stop the event from bubbling through the React tree to any outer <form>
    // (e.g. the store-creation wizard). React portals still propagate synthetic
    // submit events through the React component hierarchy, so without this the
    // wizard form action would fire every time this modal form is submitted.
    event.stopPropagation();

    // Client-side validation first — show errors immediately without a round-trip.
    const clientResult = storeProductTypeRequestSchema.safeParse({
      locale,
      source,
      suggestedName,
      reason: reason.trim() || null,
    });

    if (!clientResult.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of clientResult.error.issues) {
        const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "form";
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      setFieldErrors(errors);
      return;
    }

    // Optimistic Confirmation: close the modal synchronously on submit. Client-side validation
    // already ran above, so a server rejection past this point is toast material, not an inline
    // field error the user would never see behind a closed modal.
    setIsOpen(false);
    setSuggestedName("");
    setReason("");
    setFieldErrors({});
    setIsPending(true);
    const formData = new FormData(event.currentTarget);
    const result = await saveStoreProductTypeRequest(null, formData);
    setIsPending(false);

    if (result.success) {
      addToast(t("governance.productTypeRequest.success"), { variant: "success" });
    } else {
      addToast(translateError(t, result.error), { variant: "error" });
    }
  };

  const triggerControl =
    triggerVariant === "chip" ? (
      <StoreProductTypeRequestChip onOpen={openModal} />
    ) : (
      <Button type="button" variant="secondary" size="sm" onClick={openModal}>
        {t("governance.productTypeRequest.openCta")}
      </Button>
    );

  return (
    <>
      {triggerControl}

      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title={t("governance.productTypeRequest.title")}
        icon={<Tag size={20} aria-hidden="true" />}
        closeButtonLabel={t("governance.productTypeRequest.cancelCta")}
        primaryAction={{
          label: t("governance.productTypeRequest.submitCta"),
          onClick: () => formRef.current?.requestSubmit(),
          loading: isPending,
          disabled: isPending,
        }}
        secondaryAction={{
          label: t("governance.productTypeRequest.cancelCta"),
          onClick: closeModal,
          disabled: isPending,
        }}
      >
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="source" value={source} />

          <Typography size="sm" className="[line-height:1.5] [color:var(--text-secondary)]">
            {t("governance.productTypeRequest.description")}
          </Typography>

          <div className="space-y-2">
            <Label
              htmlFor={`product-type-request-name-${source}`}
              className={fieldErrors.suggestedName?.[0] ? "[color:var(--destructive)]" : "text-text-title"}
            >
              {t("governance.productTypeRequest.nameLabel")}
            </Label>
            <Input
              id={`product-type-request-name-${source}`}
              name="suggestedName"
              value={suggestedName}
              onChange={(event) => {
                setSuggestedName(event.target.value);
                clearFieldError("suggestedName");
              }}
              maxLength={50}
              error={Boolean(fieldErrors.suggestedName?.[0])}
              aria-invalid={Boolean(fieldErrors.suggestedName?.[0])}
              className="h-11 rounded-xl"
            />
            {fieldErrors.suggestedName?.[0] ? (
              <Typography size="xs" className="text-destructive" role="alert">
                {translateError(t, fieldErrors.suggestedName[0])}
              </Typography>
            ) : (
              <Typography size="xs" className="text-text-muted">
                {t("governance.productTypeRequest.nameHelper")}
              </Typography>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor={`product-type-request-reason-${source}`}
              className={fieldErrors.reason?.[0] ? "[color:var(--destructive)]" : "text-text-title"}
            >
              {t("governance.productTypeRequest.reasonLabel")}
            </Label>
            <Textarea
              id={`product-type-request-reason-${source}`}
              name="reason"
              minRows={4}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                clearFieldError("reason");
              }}
              maxLength={500}
              error={Boolean(fieldErrors.reason?.[0])}
              aria-invalid={Boolean(fieldErrors.reason?.[0])}
            />
            {fieldErrors.reason?.[0] ? (
              <Typography size="xs" className="text-destructive" role="alert">
                {translateError(t, fieldErrors.reason[0])}
              </Typography>
            ) : (
              <Typography size="xs" className="text-text-muted">
                {t("governance.productTypeRequest.reasonHelper")}
              </Typography>
            )}
          </div>
        </form>
      </Modal>
    </>
  );
}

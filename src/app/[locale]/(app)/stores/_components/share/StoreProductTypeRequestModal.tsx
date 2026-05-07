"use client";

import { Plus, Tag } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import Button from "@/components/core/Button/Button";
import FieldCharacterCount from "@/components/core/FieldCharacterCount";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import Modal from "@/components/modules/Modal/Modal";
import { POSTHOG_EVENTS } from "@/lib/constants";
import {
  saveStoreProductTypeRequest,
  type SaveStoreProductTypeRequestResult,
} from "../../_actions/saveStoreProductTypeRequest";
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
  const formRef = useRef<HTMLFormElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [state, setState] = useState<SaveStoreProductTypeRequestResult | null>(null);
  const [suggestedName, setSuggestedName] = useState("");
  const [reason, setReason] = useState("");

  const fieldErrors = state?.success === false ? state.fieldErrors : undefined;

  const openModal = () => {
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
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const result = await saveStoreProductTypeRequest(null, formData);
    setState(result);
    setIsPending(false);

    if (result.success) {
      setSuggestedName("");
      setReason("");
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
        description={t("governance.productTypeRequest.description")}
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

          <div className="space-y-2">
            <Label htmlFor={`product-type-request-name-${source}`} className="text-text-title">
              {t("governance.productTypeRequest.nameLabel")}
            </Label>
            <Input
              id={`product-type-request-name-${source}`}
              name="suggestedName"
              value={suggestedName}
              onChange={(event) => setSuggestedName(event.target.value)}
              maxLength={50}
              error={Boolean(fieldErrors?.suggestedName?.[0])}
              aria-invalid={Boolean(fieldErrors?.suggestedName?.[0])}
              className="h-11 rounded-xl"
            />
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <Typography size="xs" className="text-text-muted min-w-0 flex-1">
                {t("governance.productTypeRequest.nameHelper")}
              </Typography>
              <Typography size="xs" className="text-text-muted shrink-0 tabular-nums">
                <FieldCharacterCount currentLength={suggestedName.length} maxLength={50} />
              </Typography>
            </div>
            {fieldErrors?.suggestedName?.[0] && (
              <Typography size="xs" className="text-destructive" role="alert">
                {translateError(t, fieldErrors.suggestedName[0])}
              </Typography>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`product-type-request-reason-${source}`} className="text-text-title">
              {t("governance.productTypeRequest.reasonLabel")}
            </Label>
            <Textarea
              id={`product-type-request-reason-${source}`}
              name="reason"
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              error={Boolean(fieldErrors?.reason?.[0])}
              aria-invalid={Boolean(fieldErrors?.reason?.[0])}
              className="min-h-32 resize-y rounded-xl px-4 py-3"
            />
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <Typography size="xs" className="text-text-muted min-w-0 flex-1">
                {t("governance.productTypeRequest.reasonHelper")}
              </Typography>
              <Typography size="xs" className="text-text-muted shrink-0 tabular-nums">
                <FieldCharacterCount currentLength={reason.length} maxLength={500} />
              </Typography>
            </div>
            {fieldErrors?.reason?.[0] && (
              <Typography size="xs" className="text-destructive" role="alert">
                {translateError(t, fieldErrors.reason[0])}
              </Typography>
            )}
          </div>

          {state?.success && (
            <Typography
              size="xs"
              className="bg-primary/8 text-text-body border-primary/12 rounded-xl border px-4 py-3"
              role="status"
            >
              {t("governance.productTypeRequest.success")}
            </Typography>
          )}

          {state?.success === false && state.error && (
            <Typography
              size="xs"
              className="bg-destructive/8 text-destructive border-destructive/20 rounded-xl border px-4 py-3"
              role="alert"
            >
              {translateError(t, state.error)}
            </Typography>
          )}
        </form>
      </Modal>
    </>
  );
}

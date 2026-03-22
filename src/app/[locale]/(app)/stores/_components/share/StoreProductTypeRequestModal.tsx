"use client";

import { useState } from "react";
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

type StoreProductTypeRequestModalProps = {
  locale: string;
  source: "create" | "edit";
};

function translateError(t: ReturnType<typeof useTranslations>, errorKey: string) {
  return t.has(`governance.productTypeRequest.errors.${errorKey}`)
    ? t(`governance.productTypeRequest.errors.${errorKey}`)
    : t("error.validation_failed");
}

export default function StoreProductTypeRequestModal({ locale, source }: StoreProductTypeRequestModalProps) {
  const t = useTranslations("stores");
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

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={openModal}>
        {t("governance.productTypeRequest.openCta")}
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title={t("governance.productTypeRequest.title")}
        description={t("governance.productTypeRequest.description")}
        closeButtonLabel={t("governance.productTypeRequest.cancelCta")}
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="source" value={source} />

          <div className="bg-muted/35 rounded-[24px] border border-border/60 p-4 sm:p-5">
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
              className="mt-2 h-11 rounded-xl bg-background/90"
            />
            <div className="mt-1 flex items-center justify-between gap-3">
              <Typography size="xs" className="text-text-muted">
                {t("governance.productTypeRequest.nameHelper")}
              </Typography>
              <Typography size="xs" className="text-text-muted">
                <FieldCharacterCount currentLength={suggestedName.length} maxLength={50} />
              </Typography>
            </div>
            {fieldErrors?.suggestedName?.[0] && (
              <Typography size="xs" className="text-destructive mt-1" role="alert">
                {translateError(t, fieldErrors.suggestedName[0])}
              </Typography>
            )}
          </div>

          <div className="bg-muted/35 rounded-[24px] border border-border/60 p-4 sm:p-5">
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
              className="mt-2 min-h-32 rounded-xl bg-background/90 px-4 py-3 resize-y"
            />
            <div className="mt-1 flex items-center justify-between gap-3">
              <Typography size="xs" className="text-text-muted">
                {t("governance.productTypeRequest.reasonHelper")}
              </Typography>
              <Typography size="xs" className="text-text-muted">
                <FieldCharacterCount currentLength={reason.length} maxLength={500} />
              </Typography>
            </div>
            {fieldErrors?.reason?.[0] && (
              <Typography size="xs" className="text-destructive mt-1" role="alert">
                {translateError(t, fieldErrors.reason[0])}
              </Typography>
            )}
          </div>

          {state?.success && (
            <Typography size="xs" className="bg-primary/8 text-text-body rounded-2xl border border-primary/12 px-4 py-3" role="status">
              {t("governance.productTypeRequest.success")}
            </Typography>
          )}

          {state?.success === false && state.error && (
            <Typography
              size="xs"
              className="bg-destructive/8 text-destructive rounded-2xl border border-destructive/20 px-4 py-3"
              role="alert"
            >
              {translateError(t, state.error)}
            </Typography>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isPending} onClick={closeModal} className="min-h-11 px-5">
              {t("governance.productTypeRequest.cancelCta")}
            </Button>
            <Button type="submit" variant="primary" disabled={isPending} className="min-h-11 px-5">
              {isPending ? t("governance.productTypeRequest.submitting") : t("governance.productTypeRequest.submitCta")}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

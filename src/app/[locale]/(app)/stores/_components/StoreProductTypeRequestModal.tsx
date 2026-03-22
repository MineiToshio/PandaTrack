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
} from "../_actions/saveStoreProductTypeRequest";

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
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="source" value={source} />

          <div>
            <Label htmlFor={`product-type-request-name-${source}`}>
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
              className="mt-1"
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

          <div>
            <Label htmlFor={`product-type-request-reason-${source}`}>
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
              className="mt-1 resize-y"
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
            <Typography size="xs" className="text-text-body" role="status">
              {t("governance.productTypeRequest.success")}
            </Typography>
          )}

          {state?.success === false && state.error && (
            <Typography size="xs" className="text-destructive" role="alert">
              {translateError(t, state.error)}
            </Typography>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? t("governance.productTypeRequest.submitting") : t("governance.productTypeRequest.submitCta")}
            </Button>
            <Button type="button" variant="secondary" disabled={isPending} onClick={closeModal}>
              {t("governance.productTypeRequest.cancelCta")}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import Typography from "@/components/core/Typography";
import {
  approveProductTypeRequestAction,
  rejectProductTypeRequestAction,
} from "@/app/[locale]/(app)/admin/_actions/moderateProductTypeRequest";
import { PRODUCT_TYPE_NAME_MAX_LENGTH } from "@/app/[locale]/(app)/admin/_schemas/productTypeRequestModerationSchema";
import { useModerationAction } from "../../_hooks/useModerationAction";

type ProductTypeReviewFormProps = {
  requestId: string;
  locale: string;
  suggestedName: string;
  suggestedKeySlug: string;
};

/**
 * Product-type suggestion review: a small form that pre-fills the `es` / `en` catalog names from the
 * single suggested name and the optional key from the generated slug, letting the administrator edit
 * before approving. Approve authors the global catalog entry; reject discards the request.
 */
export default function ProductTypeReviewForm({
  requestId,
  locale,
  suggestedName,
  suggestedKeySlug,
}: ProductTypeReviewFormProps) {
  const t = useTranslations("admin.review");
  const { isPending, run } = useModerationAction();
  const [nameEs, setNameEs] = useState(suggestedName);
  const [nameEn, setNameEn] = useState(suggestedName);
  const [key, setKey] = useState(suggestedKeySlug);
  const [showNameError, setShowNameError] = useState(false);

  const handleApprove = () => {
    const trimmedEs = nameEs.trim();
    const trimmedEn = nameEn.trim();
    if (!trimmedEs || !trimmedEn) {
      setShowNameError(true);
      return;
    }
    const trimmedKey = key.trim();
    void run(
      () =>
        approveProductTypeRequestAction({
          requestId,
          locale,
          nameEs: trimmedEs,
          nameEn: trimmedEn,
          key: trimmedKey.length > 0 ? trimmedKey : undefined,
        }),
      () => t("toast.typeApproved"),
    );
  };

  const handleReject = () => {
    void run(
      () => rejectProductTypeRequestAction({ requestId, locale }),
      () => t("toast.typeRejected"),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-type-name-es">{t("type.nameEs")}</Label>
          <Input
            id="product-type-name-es"
            value={nameEs}
            maxLength={PRODUCT_TYPE_NAME_MAX_LENGTH}
            onChange={(event) => {
              setNameEs(event.target.value);
              setShowNameError(false);
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-type-name-en">{t("type.nameEn")}</Label>
          <Input
            id="product-type-name-en"
            value={nameEn}
            maxLength={PRODUCT_TYPE_NAME_MAX_LENGTH}
            onChange={(event) => {
              setNameEn(event.target.value);
              setShowNameError(false);
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-type-key" optional>
          {t("type.key")}
        </Label>
        <Input
          id="product-type-key"
          value={key}
          helperText={t("type.keyHelper")}
          onChange={(event) => setKey(event.target.value)}
        />
      </div>

      {showNameError && (
        <Typography size="xs" className="text-destructive" role="alert">
          {t("errors.nameRequired")}
        </Typography>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          leadingIcon={<Check className="h-4 w-4" aria-hidden />}
          onClick={handleApprove}
          disabled={isPending}
        >
          {t("type.approve")}
        </Button>
        <Button
          variant="destructive-ghost"
          size="sm"
          leadingIcon={<X className="h-4 w-4" aria-hidden />}
          onClick={handleReject}
          disabled={isPending}
        >
          {t("type.reject")}
        </Button>
      </div>
    </div>
  );
}

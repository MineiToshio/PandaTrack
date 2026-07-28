"use client";

import { useTranslations } from "next-intl";
import { Check, ExternalLink, X } from "lucide-react";
import Button from "@/components/core/Button/Button";
import { ROUTES } from "@/lib/constants";
import {
  applyStoreChangeRequestAction,
  rejectStoreChangeRequestAction,
} from "@/app/[locale]/(app)/stores/[slug]/_actions/moderateStoreChangeRequest";
import { useModerationAction } from "../../_hooks/useModerationAction";

type ChangeRequestReviewActionsProps = {
  slug: string;
  locale: string;
  changeRequestId: string;
};

/**
 * Change-request review actions: apply (re-derives against the current store, so a fully-drifted
 * proposal supersedes with a distinct toast) and reject, plus view store.
 */
export default function ChangeRequestReviewActions({ slug, locale, changeRequestId }: ChangeRequestReviewActionsProps) {
  const t = useTranslations("admin.review");
  const { isPending, run } = useModerationAction();

  const handleApply = () => {
    void run(
      () => applyStoreChangeRequestAction({ slug, locale, changeRequestId }),
      (result) => (result.outcome === "applied" ? t("toast.changeApplied") : t("toast.changeSuperseded")),
    );
  };

  const handleReject = () => {
    void run(
      () => rejectStoreChangeRequestAction({ slug, locale, changeRequestId }),
      () => t("toast.changeRejected"),
    );
  };

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        leadingIcon={<Check className="h-4 w-4" aria-hidden />}
        onClick={handleApply}
        disabled={isPending}
      >
        {t("change.apply")}
      </Button>
      <Button
        variant="destructive-ghost"
        size="sm"
        leadingIcon={<X className="h-4 w-4" aria-hidden />}
        onClick={handleReject}
        disabled={isPending}
      >
        {t("change.reject")}
      </Button>
      <span className="flex-1" />
      <Button
        as="a"
        variant="link"
        size="sm"
        href={`/${locale}${ROUTES.stores}/${slug}`}
        leadingIcon={<ExternalLink className="h-4 w-4" aria-hidden />}
      >
        {t("viewStore")}
      </Button>
    </>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { Check, ExternalLink } from "lucide-react";
import Button from "@/components/core/Button/Button";
import { ROUTES } from "@/lib/constants";
import { approveStoreAction } from "@/app/[locale]/(app)/stores/[slug]/_actions/moderateStore";
import { useModerationAction } from "../../_hooks/useModerationAction";
import StoreRemovalControl from "../StoreRemovalControl";

type PendingStoreReviewActionsProps = {
  slug: string;
  storeName: string;
  locale: string;
};

/** Pending-store review actions: approve, remove (via the shared removal modal), and view store. */
export default function PendingStoreReviewActions({ slug, storeName, locale }: PendingStoreReviewActionsProps) {
  const t = useTranslations("admin.review");
  const { isPending, run } = useModerationAction();

  const handleApprove = () => {
    void run(
      () => approveStoreAction({ slug, locale }),
      () => t("toast.approved"),
    );
  };

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        leadingIcon={<Check className="h-4 w-4" aria-hidden />}
        onClick={handleApprove}
        disabled={isPending}
      >
        {t("store.approve")}
      </Button>
      <StoreRemovalControl slug={slug} storeName={storeName} locale={locale} label={t("store.remove")} />
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

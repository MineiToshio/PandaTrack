"use client";

import { useTranslations } from "next-intl";
import { ExternalLink, Flag, FlagOff } from "lucide-react";
import Button from "@/components/core/Button/Button";
import { ROUTES } from "@/lib/constants";
import { flagStoreAction, unflagStoreAction } from "@/app/[locale]/(app)/stores/[slug]/_actions/moderateStore";
import { useModerationAction } from "../../_hooks/useModerationAction";
import StoreRemovalControl from "../StoreRemovalControl";

type FlagReviewActionsProps = {
  slug: string;
  storeName: string;
  locale: string;
  /** The store's current moderation status; drives the flag / unflag toggle label and action. */
  status: string;
};

/**
 * Suggested-removal (flag candidate) review actions. The flag control is a toggle keyed on the store's
 * current status: a `FLAGGED` store offers "Quitar marca" (unflag), any other status offers "Marcar"
 * (flag). Removal always goes through the shared modal.
 */
export default function FlagReviewActions({ slug, storeName, locale, status }: FlagReviewActionsProps) {
  const t = useTranslations("admin.review");
  const { isPending, run } = useModerationAction();
  const isFlagged = status === "FLAGGED";

  const handleToggleFlag = () => {
    if (isFlagged) {
      void run(
        () => unflagStoreAction({ slug, locale }),
        () => t("toast.unflagged"),
      );
    } else {
      void run(
        () => flagStoreAction({ slug, locale }),
        () => t("toast.flagged"),
      );
    }
  };

  return (
    <>
      <Button
        variant="tonal"
        size="sm"
        leadingIcon={isFlagged ? <FlagOff className="h-4 w-4" aria-hidden /> : <Flag className="h-4 w-4" aria-hidden />}
        onClick={handleToggleFlag}
        disabled={isPending}
      >
        {isFlagged ? t("flag.unflag") : t("flag.flag")}
      </Button>
      <StoreRemovalControl slug={slug} storeName={storeName} locale={locale} label={t("flag.remove")} />
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

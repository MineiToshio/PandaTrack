"use client";

import { useTranslations } from "next-intl";
import { Check, ExternalLink, X } from "lucide-react";
import Button from "@/components/core/Button/Button";
import { ROUTES } from "@/lib/constants";
import {
  dismissStoreReportAction,
  resolveStoreReportAction,
} from "@/app/[locale]/(app)/stores/[slug]/_actions/moderateStoreReport";
import { useModerationAction } from "../../_hooks/useModerationAction";
import StoreRemovalControl from "../StoreRemovalControl";

type ReportReviewActionsProps = {
  slug: string;
  storeName: string;
  locale: string;
  reportId: string;
};

/** Report review actions: resolve, dismiss, a secondary remove path, and view store. */
export default function ReportReviewActions({ slug, storeName, locale, reportId }: ReportReviewActionsProps) {
  const t = useTranslations("admin.review");
  const { isPending, run } = useModerationAction();

  const handleResolve = () => {
    void run(
      () => resolveStoreReportAction({ slug, locale, reportId }),
      () => t("toast.reportResolved"),
    );
  };

  const handleDismiss = () => {
    void run(
      () => dismissStoreReportAction({ slug, locale, reportId }),
      () => t("toast.reportDismissed"),
    );
  };

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        leadingIcon={<Check className="h-4 w-4" aria-hidden />}
        onClick={handleResolve}
        disabled={isPending}
      >
        {t("report.resolve")}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        leadingIcon={<X className="h-4 w-4" aria-hidden />}
        onClick={handleDismiss}
        disabled={isPending}
      >
        {t("report.dismiss")}
      </Button>
      <span className="bg-border mx-1 hidden h-6 w-px self-center sm:block" aria-hidden />
      <StoreRemovalControl slug={slug} storeName={storeName} locale={locale} label={t("report.remove")} />
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

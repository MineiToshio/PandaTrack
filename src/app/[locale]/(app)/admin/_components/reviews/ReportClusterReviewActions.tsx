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

type ClusterReportActionsProps = {
  slug: string;
  locale: string;
  reportId: string;
};

/**
 * Per-report decision inside a report cluster. Each report is resolved or dismissed on its own,
 * reusing the FRD-04 report actions unchanged: the cluster is an escalation view over the same
 * records, not a new mutation surface, and deciding several independent reports with one click is
 * deliberately not offered.
 */
export function ClusterReportActions({ slug, locale, reportId }: ClusterReportActionsProps) {
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
    </>
  );
}

type ReportClusterReviewActionsProps = {
  slug: string;
  storeName: string;
  locale: string;
};

/**
 * Store-level footer of the report-cluster review: take the store down, or open it. There is no flag
 * control, because the public report notice is derived from the open reports themselves and nothing
 * writes it by hand.
 */
export default function ReportClusterReviewActions({ slug, storeName, locale }: ReportClusterReviewActionsProps) {
  const t = useTranslations("admin.review");

  return (
    <>
      <StoreRemovalControl slug={slug} storeName={storeName} locale={locale} label={t("reportCluster.remove")} />
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

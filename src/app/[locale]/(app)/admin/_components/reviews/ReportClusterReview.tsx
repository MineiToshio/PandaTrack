import { getTranslations } from "next-intl/server";
import { Layers } from "lucide-react";
import Chip from "@/components/core/Chip";
import type { AdminOpenStoreReport } from "@/lib/data/admin/adminStoreReportQueries";
import type { ModerationStoreRef } from "@/lib/data/admin/moderationQueueQueries";
import { ReviewActions, ReviewCard, ReviewHeader, ReviewHint, ReviewSection } from "../ReviewShell";
import StoreMetaChips from "../StoreMetaChips";
import ReportCard from "./ReportCard";
import ReportClusterReviewActions, { ClusterReportActions } from "./ReportClusterReviewActions";

type ReportClusterReviewProps = {
  store: ModerationStoreRef;
  reports: AdminOpenStoreReport[];
  locale: string;
};

/**
 * Report-cluster review: several open reports on one store, gathered so the administrator sees them
 * as one situation. It names the fact rather than a recommendation, and it decides nothing on its
 * own: each report is resolved or dismissed individually, and taking the store down is one of the
 * choices, not the suggestion.
 */
export default async function ReportClusterReview({ store, reports, locale }: ReportClusterReviewProps) {
  const t = await getTranslations({ locale, namespace: "admin.review" });
  const tQueue = await getTranslations({ locale, namespace: "admin.queue" });

  return (
    <ReviewCard ariaLabel={`${tQueue("category.report_cluster")}: ${store.name}`}>
      <ReviewHeader
        eyebrowIcon={Layers}
        eyebrowTone="destructive"
        eyebrowLabel={tQueue("category.report_cluster")}
        title={store.name}
        meta={
          <StoreMetaChips
            store={store}
            locale={locale}
            extra={<Chip variant="destructive">{tQueue("openReports", { count: reports.length })}</Chip>}
          />
        }
      />
      <ReviewSection title={t("reportCluster.sectionReports")} icon={Layers}>
        <div className="flex flex-col gap-2">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              locale={locale}
              actions={<ClusterReportActions slug={store.slug} locale={locale} reportId={report.id} />}
            />
          ))}
        </div>
      </ReviewSection>
      <ReviewHint>{t("reportCluster.hint")}</ReviewHint>
      <ReviewActions>
        <ReportClusterReviewActions slug={store.slug} storeName={store.name} locale={locale} />
      </ReviewActions>
    </ReviewCard>
  );
}

import { getTranslations } from "next-intl/server";
import { CornerUpLeft } from "lucide-react";
import { ROUTES } from "@/lib/constants";
import type { ModerationQueueItem } from "@/lib/data/admin/moderationQueueQueries";
import { analyticsItemType } from "../_utils/moderationItemView";
import InboxItemOpenedCapture from "./InboxItemOpenedCapture";
import PendingStoreReview from "./reviews/PendingStoreReview";
import ReportReview from "./reviews/ReportReview";
import FlagReview from "./reviews/FlagReview";
import ChangeRequestReview from "./reviews/ChangeRequestReview";
import ProductTypeReview from "./reviews/ProductTypeReview";

type ReviewPaneProps = {
  item: ModerationQueueItem;
  locale: string;
};

/**
 * Renders the review for the selected item and emits the "inbox item opened" analytics event. On
 * mobile a back link returns to the queue (`FR-02-20`); it is hidden on desktop where the queue stays
 * visible alongside the pane.
 */
export default async function ReviewPane({ item, locale }: ReviewPaneProps) {
  const t = await getTranslations({ locale, namespace: "admin.inbox" });

  return (
    <div className="flex flex-col gap-3">
      <InboxItemOpenedCapture key={`${item.type}:${item.id}`} itemType={analyticsItemType(item.type)} />
      <a
        href={`/${locale}${ROUTES.admin}`}
        className="text-text-secondary hover:text-text-primary inline-flex w-fit items-center gap-1.5 text-sm lg:hidden"
      >
        <CornerUpLeft className="size-4" aria-hidden />
        {t("backToQueue")}
      </a>

      {item.type === "pending_store" && (
        <PendingStoreReview store={item.store} summary={item.summary} locale={locale} />
      )}
      {item.type === "report" && <ReportReview store={item.store} report={item.report} locale={locale} />}
      {item.type === "flag" && <FlagReview store={item.store} reports={item.reports} locale={locale} />}
      {item.type === "change_request" && (
        <ChangeRequestReview store={item.store} request={item.request} locale={locale} />
      )}
      {item.type === "product_type" && <ProductTypeReview request={item.request} locale={locale} />}
    </div>
  );
}

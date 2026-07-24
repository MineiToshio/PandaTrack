import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/styles";
import type {
  ModerationQueue as ModerationQueueModel,
  ModerationQueueItem,
} from "@/lib/data/admin/moderationQueueQueries";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import QueueCounts from "./QueueCounts";
import ModerationQueue from "./ModerationQueue";
import ReviewPane from "./ReviewPane";

type ModerationInboxProps = {
  queue: ModerationQueueModel;
  selectedItem: ModerationQueueItem;
  /** True when an item was explicitly selected via `?item`; drives the mobile queue/detail swap. */
  hasExplicitSelection: boolean;
  locale: string;
};

/**
 * The populated inbox: heading, per-category counters, and the master-detail split. On desktop the
 * queue and the review pane show side by side with the top item auto-previewed (`FR-02-19`). On mobile
 * only one shows at a time: the bare queue by default, or the full-width review once an item is opened
 * (`FR-02-20`).
 */
export default async function ModerationInbox({
  queue,
  selectedItem,
  hasExplicitSelection,
  locale,
}: ModerationInboxProps) {
  const t = await getTranslations({ locale, namespace: "admin.inbox" });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Heading as="h1" size="sm">
          {t("title")}
        </Heading>
        <Typography size="sm" className="[color:var(--text-muted)]">
          {t("subtitle")}
        </Typography>
      </div>

      <QueueCounts counts={queue.counts} locale={locale} />

      <div className="lg:grid lg:grid-cols-[minmax(0,20rem)_1fr] lg:items-start lg:gap-5">
        <div className={cn(hasExplicitSelection ? "hidden lg:block" : "block")}>
          <ModerationQueue items={queue.items} selectedItem={selectedItem} locale={locale} />
        </div>
        <div className={cn(hasExplicitSelection ? "block" : "hidden lg:block")}>
          <ReviewPane item={selectedItem} locale={locale} />
        </div>
      </div>
    </section>
  );
}

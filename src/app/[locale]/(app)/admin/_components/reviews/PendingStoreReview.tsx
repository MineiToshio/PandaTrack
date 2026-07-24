import { getTranslations } from "next-intl/server";
import { ClipboardList, Store } from "lucide-react";
import type { ModerationPendingStoreSummary, ModerationStoreRef } from "@/lib/data/admin/moderationQueueQueries";
import { ReviewActions, ReviewCard, ReviewHeader, ReviewHint, ReviewSection } from "../ReviewShell";
import StoreMetaChips from "../StoreMetaChips";
import PendingStoreReviewActions from "./PendingStoreReviewActions";

type PendingStoreReviewProps = {
  store: ModerationStoreRef;
  summary: ModerationPendingStoreSummary;
  locale: string;
};

/** Review for a store awaiting approval: submitted summary plus approve / remove / view actions. */
export default async function PendingStoreReview({ store, summary, locale }: PendingStoreReviewProps) {
  const t = await getTranslations({ locale, namespace: "admin.review" });
  const tQueue = await getTranslations({ locale, namespace: "admin.queue" });
  const tCountries = await getTranslations({ locale, namespace: "countries" });

  const presence = summary.presenceTypes.map((value) => t(`presence.${value}`)).join(", ") || t("empty");
  const categories = summary.productTypeKeys.join(", ") || t("empty");
  const channels =
    summary.contactChannels
      .map((channel) => (channel.label ? `${channel.label}: ${channel.value}` : channel.value))
      .join(", ") || t("empty");
  const imports = summary.importCountryCodes.map((code) => tCountries(code)).join(", ") || t("empty");

  const rows: Array<{ label: string; value: string }> = [
    { label: t("store.fields.sellerType"), value: t(`sellerType.${store.sellerType}`) },
    { label: t("store.fields.country"), value: tCountries(store.countryCode) },
    { label: t("store.fields.presence"), value: presence },
    { label: t("store.fields.categories"), value: categories },
    { label: t("store.fields.channels"), value: channels },
    { label: t("store.fields.importCountries"), value: imports },
  ];

  return (
    <ReviewCard ariaLabel={`${tQueue("category.pending_store")}: ${store.name}`}>
      <ReviewHeader
        eyebrowIcon={Store}
        eyebrowTone="warm"
        eyebrowLabel={store.name}
        title={store.name}
        meta={<StoreMetaChips store={store} locale={locale} />}
      />
      <ReviewSection title={t("store.sectionSummary")} icon={ClipboardList}>
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[10rem_1fr]">
          {rows.map((row) => (
            <div key={row.label} className="grid gap-0.5 sm:col-span-2 sm:grid-cols-subgrid">
              <dt className="text-xs [color:var(--text-muted)]">{row.label}</dt>
              <dd className="text-text-primary text-sm">{row.value}</dd>
            </div>
          ))}
        </dl>
      </ReviewSection>
      <ReviewHint>{t("store.hint")}</ReviewHint>
      <ReviewActions>
        <PendingStoreReviewActions slug={store.slug} storeName={store.name} locale={locale} />
      </ReviewActions>
    </ReviewCard>
  );
}

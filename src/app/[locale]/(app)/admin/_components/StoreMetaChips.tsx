import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Globe, Store } from "lucide-react";
import Chip, { type ChipVariant } from "@/components/core/Chip";
import type { ModerationStoreRef } from "@/lib/data/admin/moderationQueueQueries";

const STATUS_CHIP_VARIANT: Record<string, ChipVariant> = {
  PENDING: "warning",
  APPROVED: "neutral",
  REJECTED: "neutral",
};

/**
 * The metadata chip row shown in a store-related review header: seller type, country, and moderation
 * status, plus any review-specific extra chips (accumulated reports, changed-field count, drift).
 */
export default async function StoreMetaChips({
  store,
  locale,
  extra,
}: {
  store: ModerationStoreRef;
  locale: string;
  extra?: ReactNode;
}) {
  const t = await getTranslations({ locale, namespace: "admin.review" });
  const tCountries = await getTranslations({ locale, namespace: "countries" });

  return (
    <>
      <Chip variant="neutral" icon={<Store className="size-3" aria-hidden />}>
        {t(`sellerType.${store.sellerType}`)}
      </Chip>
      <Chip variant="neutral" icon={<Globe className="size-3" aria-hidden />}>
        {tCountries(store.countryCode)}
      </Chip>
      <Chip variant={STATUS_CHIP_VARIANT[store.status] ?? "neutral"}>{t(`storeStatus.${store.status}`)}</Chip>
      {extra}
    </>
  );
}

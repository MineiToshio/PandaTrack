import { useTranslations } from "next-intl";
import Link from "next/link";
import { Globe, MapPin, Star } from "lucide-react";
import type { PublicStoreListingItem } from "@/queries/store";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";

const INFO_CHIP_CLASSNAME =
  "border-border/70 bg-muted/40 text-text-body inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs";

export type StoreListingContentProps = {
  locale: string;
  stores: PublicStoreListingItem[];
};

export default function StoreListingContent({ locale, stores }: StoreListingContentProps) {
  const t = useTranslations("storeListing");
  const tCategories = useTranslations("storeCategories");
  const tCountries = useTranslations("countries");

  const showEmptyState = stores.length === 0;

  return (
    <div className="mt-6 space-y-6">
      {showEmptyState && (
        <div className="border-border/70 bg-background/70 rounded-2xl border border-dashed p-8 text-center">
          <Typography size="md" className="text-text-muted">
            {t("empty")}
          </Typography>
        </div>
      )}

      {!showEmptyState && (
        <ul className="grid gap-4 md:grid-cols-2" role="list">
          {stores.map((store) => (
            <li key={store.slug}>
              <Link
                href={`/${locale}${ROUTES.stores}/${store.slug}`}
                className="border-border/70 bg-background/90 hover:border-primary/50 hover:shadow-primary/10 group block h-full rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex h-full flex-col gap-4">
                  <div className="space-y-2">
                    <Heading as="h3" size="xs" className="text-text-title line-clamp-2">
                      {store.name}
                    </Heading>

                    <div className="text-text-muted flex items-center gap-1.5 text-sm">
                      <MapPin className="size-4 shrink-0" aria-hidden />
                      <span>{tCountries(store.countryCode)}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {store.presenceTypes.map((presenceType) => (
                        <span key={`${store.slug}-${presenceType}`} className={cn(INFO_CHIP_CLASSNAME, "bg-accent/40")}>
                          <Globe className="size-3.5" aria-hidden />
                          <span>{t(`presence.${presenceType}`)}</span>
                        </span>
                      ))}
                    </div>

                    {store.categoryKeys.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {store.categoryKeys.map((categoryKey) => (
                          <span key={`${store.slug}-${categoryKey}`} className={INFO_CHIP_CLASSNAME}>
                            {tCategories(categoryKey)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {(store.averageRating != null || store.reviewCount > 0) && (
                    <div className="text-text-muted mt-auto flex items-center gap-2 text-sm">
                      <Star className="text-primary size-4 fill-current" aria-hidden />
                      {store.averageRating != null && (
                        <span className="font-semibold">{store.averageRating.toFixed(1)}</span>
                      )}
                      {store.reviewCount > 0 && <span>{t("ratingCount", { count: store.reviewCount })}</span>}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

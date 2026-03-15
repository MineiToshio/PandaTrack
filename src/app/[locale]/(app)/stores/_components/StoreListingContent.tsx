import { useTranslations } from "next-intl";
import Link from "next/link";
import { Box, CheckCircle2, Globe, MapPin, ShoppingBag, Star, XCircle } from "lucide-react";
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
  const getStoreTypeLabel = (storeType: PublicStoreListingItem["storeType"]) =>
    storeType === "BUSINESS" ? t("cards.storeTypeBusiness") : t("cards.storeTypePerson");

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
        <ul className="space-y-4" role="list">
          {stores.map((store) => (
            <li key={store.slug}>
              <Link
                href={`/${locale}${ROUTES.stores}/${store.slug}`}
                className="border-border/70 bg-background/90 hover:border-primary/60 hover:shadow-primary/15 group block rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="space-y-3.5">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Heading as="h3" size="xs" className="text-text-title line-clamp-2">
                          {store.name}
                        </Heading>
                        <div className="text-text-muted flex items-center gap-1.5 text-sm">
                          <MapPin className="size-4 shrink-0" aria-hidden />
                          <span>{tCountries(store.countryCode)}</span>
                        </div>
                      </div>
                      {(store.averageRating != null || store.reviewCount > 0) && (
                        <div className="text-text-muted flex items-center gap-1.5 text-sm">
                          <Star className="text-primary size-4 fill-current" aria-hidden />
                          {store.averageRating != null && (
                            <span className="font-semibold">{store.averageRating.toFixed(1)}</span>
                          )}
                          {store.reviewCount > 0 && <span>{t("ratingCount", { count: store.reviewCount })}</span>}
                        </div>
                      )}
                    </div>

                    <div className="border-border/55 bg-muted/32 rounded-xl border p-3">
                      <div className="space-y-1.5">
                        <Typography size="2xs" className="text-text-muted block font-medium">
                          {t("cards.categories")}
                        </Typography>
                        <div className="flex flex-wrap gap-1.5">
                          {store.categoryKeys.map((categoryKey) => (
                            <span
                              key={`${store.slug}-${categoryKey}`}
                              className={cn(INFO_CHIP_CLASSNAME, "bg-primary/8 text-primary border-primary/20")}
                            >
                              {tCategories(categoryKey)}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Typography size="2xs" className="text-text-muted block font-medium">
                            {t("filters.presence")}
                          </Typography>
                          <div className="flex flex-wrap gap-1.5">
                            {store.presenceTypes.map((presenceType) => (
                              <span
                                key={`${store.slug}-${presenceType}`}
                                className={cn(INFO_CHIP_CLASSNAME, "bg-primary/10 text-text-body/85 border-primary/22")}
                              >
                                <Globe className="size-3.5" aria-hidden />
                                <span>{t(`presence.${presenceType}`)}</span>
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Typography size="2xs" className="text-text-muted block font-medium">
                            {t("cards.importCountries")}
                          </Typography>
                          {store.importCountryCodes.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {store.importCountryCodes.map((countryCode) => (
                                <span
                                  key={`${store.slug}-import-${countryCode}`}
                                  className={cn(
                                    INFO_CHIP_CLASSNAME,
                                    "bg-success/12 text-text-body/85 border-success/25",
                                  )}
                                >
                                  <ShoppingBag className="size-3.5" aria-hidden />
                                  <span>{tCountries(countryCode)}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <Typography size="xs" className="text-text-muted">
                              {t("cards.noImportCountries")}
                            </Typography>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-border/50 flex flex-wrap items-center gap-2 border-t pt-2.5">
                    <span className={cn(INFO_CHIP_CLASSNAME, "bg-muted/45 text-text-body/85 border-border/60")}>
                      <Globe className="size-3.5" aria-hidden />
                      <span>{getStoreTypeLabel(store.storeType)}</span>
                    </span>
                    <span
                      className={cn(
                        INFO_CHIP_CLASSNAME,
                        store.receivesOrders ? "bg-primary/15 text-primary border-primary/30" : "bg-muted/30",
                      )}
                    >
                      {store.receivesOrders ? (
                        <CheckCircle2 className="size-3.5" aria-hidden />
                      ) : (
                        <XCircle className="size-3.5" aria-hidden />
                      )}
                      <span>{store.receivesOrders ? t("cards.receivesOrdersYes") : t("cards.receivesOrdersNo")}</span>
                    </span>
                    <span
                      className={cn(
                        INFO_CHIP_CLASSNAME,
                        store.hasStock ? "bg-success/15 text-success border-success/30" : "bg-muted/30",
                      )}
                    >
                      {store.hasStock ? (
                        <Box className="size-3.5" aria-hidden />
                      ) : (
                        <XCircle className="size-3.5" aria-hidden />
                      )}
                      <span>{store.hasStock ? t("cards.hasStockYes") : t("cards.hasStockNo")}</span>
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

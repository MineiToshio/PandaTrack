import { useTranslations } from "next-intl";
import Link from "next/link";
import { Box, CheckCircle2, Globe, Link2, Mail, MapPin, Phone, ShoppingBag, Star, XCircle } from "lucide-react";
import { siFacebook, siInstagram, siTiktok, siWhatsapp } from "simple-icons";
import type { PublicStoreListingItem } from "@/queries/store";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";

const INFO_CHIP_CLASSNAME =
  "border-border/70 bg-muted/40 text-text-body inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs";
const MAX_CONTACT_CHANNELS = 4;

function SimpleIconSvg({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={14} height={14} aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

function buildContactHref(
  type: PublicStoreListingItem["contactChannels"][number]["type"],
  value: string,
): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  if (type === "EMAIL") {
    return `mailto:${trimmedValue}`;
  }

  if (type === "PHONE") {
    return `tel:${trimmedValue}`;
  }

  return trimmedValue;
}

export type StoreListingContentProps = {
  locale: string;
  stores: PublicStoreListingItem[];
};

export default function StoreListingContent({ locale, stores }: StoreListingContentProps) {
  const t = useTranslations("storeListing");
  const tStores = useTranslations("stores");
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
              <article className="border-border/70 bg-background/90 hover:border-primary/60 hover:shadow-primary/15 group relative rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <Link
                  href={`/${locale}${ROUTES.stores}/${store.slug}`}
                  aria-label={store.name}
                  className="focus-visible:ring-ring absolute inset-0 z-10 rounded-2xl focus-visible:ring-2 focus-visible:outline-none"
                />
                <div className="pointer-events-none space-y-3.5">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Heading as="h3" size="xs" className="text-text-title line-clamp-2">
                          {store.name}
                        </Heading>
                        <div className="text-text-muted flex flex-wrap items-center gap-2 text-sm">
                          <MapPin className="size-4 shrink-0" aria-hidden />
                          <span>{tCountries(store.countryCode)}</span>
                          {store.contactChannels.length > 0 && (
                            <>
                              <span className="bg-border/70 h-3.5 w-px rounded-full" aria-hidden />
                              <div className="pointer-events-auto relative z-20 flex items-center gap-1.5">
                                {store.contactChannels.slice(0, MAX_CONTACT_CHANNELS).map((channel) => {
                                  const href = buildContactHref(channel.type, channel.value);
                                  if (!href) {
                                    return null;
                                  }

                                  const icon =
                                    channel.type === "INSTAGRAM" ? (
                                      <SimpleIconSvg path={siInstagram.path} />
                                    ) : channel.type === "WHATSAPP" ? (
                                      <SimpleIconSvg path={siWhatsapp.path} />
                                    ) : channel.type === "FACEBOOK" ? (
                                      <SimpleIconSvg path={siFacebook.path} />
                                    ) : channel.type === "TIKTOK" ? (
                                      <SimpleIconSvg path={siTiktok.path} />
                                    ) : channel.type === "EMAIL" ? (
                                      <Mail className="size-3.5" aria-hidden />
                                    ) : channel.type === "PHONE" ? (
                                      <Phone className="size-3.5" aria-hidden />
                                    ) : (
                                      <Link2 className="size-3.5" aria-hidden />
                                    );

                                  return (
                                    <a
                                      key={`${store.slug}-${channel.type}-${channel.value}`}
                                      href={href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      aria-label={tStores(`contactChannelTypes.${channel.type}`)}
                                      title={tStores(`contactChannelTypes.${channel.type}`)}
                                      className="text-text-muted hover:text-primary focus-visible:ring-ring inline-flex size-6 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
                                    >
                                      {icon}
                                    </a>
                                  );
                                })}
                              </div>
                            </>
                          )}
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

                  <div className="flex flex-wrap items-center gap-2 pt-2.5">
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
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

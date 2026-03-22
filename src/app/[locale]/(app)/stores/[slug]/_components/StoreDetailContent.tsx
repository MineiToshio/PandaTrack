import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  Box,
  Building2,
  CalendarClock,
  CircleAlert,
  ExternalLink,
  Globe,
  Link2,
  Mail,
  MapPinned,
  PackageSearch,
  Pencil,
  Phone,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { siFacebook, siInstagram, siTiktok, siWhatsapp } from "simple-icons";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import { ROUTES } from "@/lib/constants";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import { cn } from "@/lib/styles";
import type { PublicStoreReview, StoreDetail, StoreViewerNote, StoreViewerReview } from "@/queries/store";
import type { EditableStore, StoreGovernanceSummary, StoreGovernanceViewerContext } from "@/queries/storeGovernance";
import BackNavLink from "@/components/core/BackNavLink";
import StoreSectionLabel from "../../_components/share/StoreSectionLabel";
import StoreSurfaceCard from "../../_components/share/StoreSurfaceCard";
import StoreReviewAggregateBadge from "./StoreReviewAggregateBadge";
import StorePublicReviewsSection from "./StorePublicReviewsSection";
import StoreReviewsStateProvider from "./StoreReviewsStateProvider";
import StoreNoteForm from "./StoreNoteForm";
import StoreEmptyCatalogTag from "../../_components/StoreEmptyCatalogTag";
import StoreGovernanceSummaryModal from "./StoreGovernanceSummaryModal";
import StoreReportModal from "./StoreReportModal";

type StoreDetailContentProps = {
  locale: string;
  store: StoreDetail;
  editableStore: EditableStore;
  reviews: PublicStoreReview[];
  viewerReview: StoreViewerReview | null;
  viewerNote: StoreViewerNote | null;
  governanceSummary: StoreGovernanceSummary;
  governanceViewerContext: StoreGovernanceViewerContext;
  canAccessEditRoute: boolean;
  canDirectlyEdit: boolean;
};

const STAGGER_BASE_DELAY_MS = 90;
const CONTACT_LINK_CLASSNAME =
  "group border-border/55 hover:border-primary/25 inline-flex w-full items-center justify-between gap-3 rounded-2xl border bg-background/70 px-4 py-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-background focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none";
const TAG_CLASSNAME = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium";
const METRIC_CARD_CLASSNAME =
  "bg-background/80 rounded-2xl border border-border/50 border-t-2 border-t-primary/35 px-3 py-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5";

function SimpleIconSvg({ path, size = 16 }: { path: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} aria-hidden>
      <path d={path} />
    </svg>
  );
}

function buildContactHref(
  type: NonNullable<StoreDetail["contactChannels"]>[number]["type"],
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

function getContactIcon(type: NonNullable<StoreDetail["contactChannels"]>[number]["type"]): ReactNode {
  if (type === "INSTAGRAM") return <SimpleIconSvg path={siInstagram.path} />;
  if (type === "WHATSAPP") return <SimpleIconSvg path={siWhatsapp.path} />;
  if (type === "FACEBOOK") return <SimpleIconSvg path={siFacebook.path} />;
  if (type === "TIKTOK") return <SimpleIconSvg path={siTiktok.path} />;
  if (type === "EMAIL") return <Mail className="size-4" aria-hidden />;
  if (type === "PHONE") return <Phone className="size-4" aria-hidden />;
  return <Link2 className="size-4" aria-hidden />;
}

export default function StoreDetailContent({
  locale,
  store,
  editableStore,
  reviews,
  viewerReview,
  viewerNote,
  governanceSummary,
  governanceViewerContext,
  canAccessEditRoute,
  canDirectlyEdit,
}: StoreDetailContentProps) {
  const tStores = useTranslations("stores");
  const tCountries = useTranslations("countries");
  const tProductTypes = useTranslations("storeProductTypes");
  const tListing = useTranslations("storeListing");

  const isPendingReview = store.status === "PENDING";
  const isInactive = !store.isActive;
  const isBusiness = store.storeType === "BUSINESS";
  const storeTypeLabel = isBusiness ? tStores("create.storeTypeBusiness") : tStores("create.storeTypePerson");
  const storeTypeIcon = isBusiness ? (
    <Building2 className="text-primary size-3.5" aria-hidden />
  ) : (
    <UserRound className="text-info size-3.5" aria-hidden />
  );
  const profileCreatedAt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(store.createdAt);
  const receivesOrdersLabel =
    store.receivesOrders == null
      ? tStores("detail.receivesOrdersUnknown")
      : store.receivesOrders
        ? tListing("cards.receivesOrdersYes")
        : tListing("cards.receivesOrdersNo");
  const hasStockLabel =
    store.hasStock == null
      ? tStores("detail.hasStockUnknown")
      : store.hasStock
        ? tListing("cards.hasStockYes")
        : tListing("cards.hasStockNo");
  const contactChannelsCount = store.contactChannels?.length ?? 0;
  const addressesCount = store.addresses?.length ?? 0;
  const editModeLabel = canDirectlyEdit ? tStores("edit.direct.shortLabel") : tStores("edit.changeRequest.shortLabel");

  return (
    <StoreReviewsStateProvider
      averageRating={store.averageRating}
      reviewCount={store.reviewCount}
      reviews={reviews}
      viewerReview={viewerReview}
    >
      <div className="px-4 py-7 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <BackNavLink href={`/${locale}${ROUTES.stores}`}>{tListing("backToListing")}</BackNavLink>

          <section className="from-primary/20 via-highlight/12 to-info/20 relative animate-[hero-fade-in-up_460ms_ease-out_both] overflow-hidden rounded-3xl bg-linear-to-br px-5 py-6 shadow-sm sm:px-8 sm:py-8">
            <div className="bg-primary/30 absolute -top-20 right-0 size-44 animate-[hero-glow-pulse_6s_ease-in-out_infinite] rounded-full blur-3xl" />
            <div
              className="bg-accent/30 absolute -bottom-20 -left-10 size-44 animate-[hero-glow-pulse_7s_ease-in-out_infinite] rounded-full blur-3xl"
              style={{ animationDelay: "420ms" }}
            />

            <div className="relative z-10 space-y-5">
              <div className="flex items-start gap-4">
                {isBusiness && store.logoUrl ? (
                  <div className="bg-background/85 relative size-20 shrink-0 animate-[hero-float_5s_ease-in-out_infinite] overflow-hidden rounded-2xl shadow-sm">
                    <Image src={store.logoUrl} alt="" width={80} height={80} className="object-cover" unoptimized />
                  </div>
                ) : (
                  <div className="bg-background/85 text-primary flex size-20 shrink-0 animate-[hero-float_5s_ease-in-out_infinite] items-center justify-center rounded-2xl shadow-sm">
                    <Building2 className="size-9" aria-hidden />
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <Heading as="h1" size="sm" className="text-text-title min-w-0 flex-1 pr-1">
                      {store.name}
                    </Heading>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                      <StoreGovernanceSummaryModal locale={locale} storeSlug={store.slug} summary={governanceSummary} />
                      <StoreReportModal
                        locale={locale}
                        storeSlug={store.slug}
                        existingReport={governanceViewerContext.openReport}
                      />
                      {canAccessEditRoute && (
                        <Link
                          href={`/${locale}${ROUTES.stores}/${editableStore.slug}/edit`}
                          className={cn(
                            buttonVariants({ variant: "secondary", size: "sm" }),
                            "gap-1.5 max-lg:h-11 max-lg:min-w-11 max-lg:justify-center max-lg:px-0",
                          )}
                        >
                          <Pencil className="size-4 shrink-0" aria-hidden />
                          <span className="max-lg:sr-only">{editModeLabel}</span>
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn(TAG_CLASSNAME, "bg-background/80 text-text-body")}>
                      <Globe className="size-3.5" aria-hidden />
                      {storeTypeLabel}
                    </span>
                    <span className={cn(TAG_CLASSNAME, "bg-background/80 text-text-body")}>
                      <MapPinned className="size-3.5" aria-hidden />
                      {tCountries(store.countryCode)}
                    </span>
                    <StoreReviewAggregateBadge className={TAG_CLASSNAME} />
                  </div>
                </div>
              </div>

              {store.description ? (
                <Typography size="sm" className="text-text-body max-w-4xl">
                  {store.description}
                </Typography>
              ) : (
                <Typography size="sm" className="text-text-muted max-w-4xl">
                  {tStores("detail.noDescription")}
                </Typography>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
                <div className={METRIC_CARD_CLASSNAME}>
                  <div className="text-text-muted flex items-center gap-1.5">
                    <Box className="size-3.5" aria-hidden />
                    <Typography size="2xs">{tStores("detail.productTypesLabel")}</Typography>
                  </div>
                  <Typography size="sm" className="text-text-title mt-1.5 text-2xl leading-none font-semibold">
                    {store.productTypeKeys.length}
                  </Typography>
                </div>
                <div className={METRIC_CARD_CLASSNAME}>
                  <div className="text-text-muted flex items-center gap-1.5">
                    <Globe className="size-3.5" aria-hidden />
                    <Typography size="2xs">{tStores("detail.importCountriesLabel")}</Typography>
                  </div>
                  <Typography size="sm" className="text-text-title mt-1.5 text-2xl leading-none font-semibold">
                    {store.importCountryCodes.length}
                  </Typography>
                </div>
                <div className={METRIC_CARD_CLASSNAME}>
                  <div className="text-text-muted flex items-center gap-1.5">
                    <Link2 className="size-3.5" aria-hidden />
                    <Typography size="2xs">{tStores("detail.contactChannelsCountLabel")}</Typography>
                  </div>
                  <Typography size="sm" className="text-text-title mt-1.5 text-2xl leading-none font-semibold">
                    {contactChannelsCount}
                  </Typography>
                </div>
                <div className={METRIC_CARD_CLASSNAME}>
                  <div className="text-text-muted flex items-center gap-1.5">
                    <MapPinned className="size-3.5" aria-hidden />
                    <Typography size="2xs">{tStores("detail.addressesCountLabel")}</Typography>
                  </div>
                  <Typography size="sm" className="text-text-title mt-1.5 text-2xl leading-none font-semibold">
                    {addressesCount}
                  </Typography>
                </div>
              </div>
            </div>
          </section>

          {(isPendingReview || isInactive) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {isPendingReview && (
                <div
                  className="bg-warning/14 text-text-body animate-[hero-fade-in-up_420ms_ease-out_both] rounded-2xl p-4 shadow-sm sm:col-span-2"
                  role="note"
                  style={{ animationDelay: `${STAGGER_BASE_DELAY_MS}ms` }}
                >
                  <div className="flex items-start gap-2.5">
                    <CircleAlert className="text-warning mt-1 size-4 shrink-0" aria-hidden />
                    <div>
                      <Typography size="sm" className="text-text-title font-semibold">
                        {tStores("detail.pendingDisclaimerTitle")}
                      </Typography>
                      <Typography size="xs" className="text-text-body mt-1">
                        {tStores("detail.pendingDisclaimerMessage")}
                      </Typography>
                    </div>
                  </div>
                </div>
              )}
              {isInactive && (
                <div
                  className="bg-destructive/12 text-text-body animate-[hero-fade-in-up_420ms_ease-out_both] rounded-2xl p-4 shadow-sm"
                  role="alert"
                  style={{ animationDelay: `${STAGGER_BASE_DELAY_MS * 2}ms` }}
                >
                  <div className="flex items-start gap-2.5">
                    <CircleAlert className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
                    <div>
                      <Typography size="sm" className="text-text-title font-semibold">
                        {tStores("detail.inactiveWarningTitle")}
                      </Typography>
                      <Typography size="xs" className="text-text-body mt-1">
                        {tStores("detail.inactiveWarningMessage")}
                      </Typography>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[1.18fr_0.82fr]">
            <StoreSurfaceCard
              className="animate-[hero-fade-in-up_430ms_ease-out_both] space-y-4"
              style={{ animationDelay: `${STAGGER_BASE_DELAY_MS * 2}ms` }}
            >
              <div>
                <StoreSectionLabel>{tStores("detail.productTypesLabel")}</StoreSectionLabel>
                {store.productTypeKeys.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {store.productTypeKeys.map((productTypeKey) => (
                      <span key={productTypeKey} className={cn(TAG_CLASSNAME, "bg-primary/10 text-primary")}>
                        <Box className="size-3.5" aria-hidden />
                        {tProductTypes(productTypeKey)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2.5">
                    <StoreEmptyCatalogTag className="px-3 py-1.5">
                      {tStores("detail.noProductTypes")}
                    </StoreEmptyCatalogTag>
                  </div>
                )}
              </div>

              <div>
                <StoreSectionLabel>{tStores("detail.presenceLabel")}</StoreSectionLabel>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {store.presenceTypes.map((presenceType) => (
                    <span key={presenceType} className={cn(TAG_CLASSNAME, "bg-info/14 text-text-body")}>
                      <Globe className="size-3.5" aria-hidden />
                      {tListing(`presence.${presenceType}`)}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <StoreSectionLabel>{tStores("detail.importCountriesLabel")}</StoreSectionLabel>
                {store.importCountryCodes.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {store.importCountryCodes.map((countryCode) => (
                      <span key={countryCode} className={cn(TAG_CLASSNAME, "bg-success/14 text-text-body")}>
                        <ShoppingBag className="size-3.5" aria-hidden />
                        {tCountries(countryCode)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2.5">
                    <StoreEmptyCatalogTag className="px-3 py-1.5">
                      {tStores("detail.noImportCountries")}
                    </StoreEmptyCatalogTag>
                  </div>
                )}
              </div>
            </StoreSurfaceCard>

            <StoreSurfaceCard
              className="animate-[hero-fade-in-up_430ms_ease-out_both] space-y-4"
              style={{ animationDelay: `${STAGGER_BASE_DELAY_MS * 3}ms` }}
            >
              <div className="space-y-2">
                <StoreSectionLabel>{tStores("detail.businessSignalsTitle")}</StoreSectionLabel>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={cn(TAG_CLASSNAME, store.receivesOrders ? "bg-primary/15 text-primary" : "bg-muted/65")}
                  >
                    <PackageSearch className="size-3.5" aria-hidden />
                    {receivesOrdersLabel}
                  </span>
                  <span className={cn(TAG_CLASSNAME, store.hasStock ? "bg-success/15 text-success" : "bg-muted/65")}>
                    <Box className="size-3.5" aria-hidden />
                    {hasStockLabel}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <StoreSectionLabel>{tStores("detail.profileSummaryTitle")}</StoreSectionLabel>
                <div className="grid gap-2">
                  <div className="bg-muted/45 rounded-2xl px-3 py-2.5">
                    <Typography size="2xs" className="text-text-muted">
                      {tStores("detail.storeTypeLabel")}
                    </Typography>
                    <Typography size="sm" className="text-text-body mt-0.5 inline-flex items-center gap-1.5">
                      {storeTypeIcon}
                      {storeTypeLabel}
                    </Typography>
                  </div>
                  <div className="bg-muted/45 rounded-2xl px-3 py-2.5">
                    <Typography size="2xs" className="text-text-muted">
                      {tStores("detail.statusLabel")}
                    </Typography>
                    <Typography size="sm" className="text-text-body mt-0.5 inline-flex items-center gap-1.5">
                      <BadgeCheck className="text-success size-3.5" aria-hidden />
                      {store.status === "PENDING" ? tStores("detail.statusPending") : tStores("detail.statusApproved")}
                    </Typography>
                  </div>
                  <div className="bg-muted/45 rounded-2xl px-3 py-2.5">
                    <Typography size="2xs" className="text-text-muted">
                      {tStores("detail.createdAtLabel")}
                    </Typography>
                    <Typography size="sm" className="text-text-body mt-0.5 inline-flex items-center gap-1.5">
                      <CalendarClock className="text-info size-3.5" aria-hidden />
                      {profileCreatedAt}
                    </Typography>
                  </div>
                </div>
              </div>
            </StoreSurfaceCard>
          </div>

          <StoreSurfaceCard
            className="animate-[hero-fade-in-up_440ms_ease-out_both]"
            style={{ animationDelay: `${STAGGER_BASE_DELAY_MS * 4}ms` }}
          >
            <StoreSectionLabel>{tStores("create.contactChannelsLabel")}</StoreSectionLabel>
            {isBusiness && contactChannelsCount > 0 ? (
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2" role="list">
                {store.contactChannels?.map((ch) => {
                  const href = buildContactHref(ch.type, ch.value);
                  if (!href) return null;

                  return (
                    <li key={`${ch.type}-${ch.value}`}>
                      <a href={href} target="_blank" rel="noopener noreferrer" className={CONTACT_LINK_CLASSNAME}>
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span className="bg-primary/12 text-primary inline-flex size-8 shrink-0 items-center justify-center rounded-full">
                            {getContactIcon(ch.type)}
                          </span>
                          <span className="min-w-0">
                            <Typography size="2xs" className="text-text-muted block">
                              {ch.label ?? tStores(`contactChannelTypes.${ch.type}`)}
                            </Typography>
                            <Typography size="sm" className="text-text-body block truncate">
                              {ch.value}
                            </Typography>
                          </span>
                        </span>
                        <ExternalLink className="text-text-muted group-hover:text-primary size-4 shrink-0 transition-colors" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Typography size="sm" className="text-text-muted mt-2">
                {isBusiness ? tStores("detail.noContactChannels") : tStores("detail.notAvailableForStoreType")}
              </Typography>
            )}
          </StoreSurfaceCard>

          <StoreSurfaceCard
            className="animate-[hero-fade-in-up_460ms_ease-out_both]"
            style={{ animationDelay: `${STAGGER_BASE_DELAY_MS * 5}ms` }}
          >
            <StoreSectionLabel>{tStores("create.addressesLabel")}</StoreSectionLabel>
            {isBusiness && addressesCount > 0 ? (
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2" role="list">
                {store.addresses?.map((address, index) => (
                  <li key={`${address.countryCode}-${address.addressLine}-${index}`}>
                    <div className="bg-muted/45 border-border/60 border-l-info/40 hover:border-l-info/55 rounded-2xl border border-l-4 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5">
                      <Typography size="xs" className="text-text-muted">
                        {tCountries(address.countryCode)}
                      </Typography>
                      <Typography size="sm" className="text-text-body mt-1">
                        {address.city ? `${address.city} - ` : ""}
                        {address.addressLine}
                      </Typography>
                      {address.reference && (
                        <Typography size="xs" className="text-text-muted mt-1">
                          {address.reference}
                        </Typography>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Typography size="sm" className="text-text-muted mt-2">
                {isBusiness ? tStores("detail.noAddresses") : tStores("detail.notAvailableForStoreType")}
              </Typography>
            )}
          </StoreSurfaceCard>

          <StorePublicReviewsSection locale={locale} storeSlug={store.slug} />

          <StoreNoteForm key={store.slug} locale={locale} storeSlug={store.slug} existingNote={viewerNote} />
        </div>
      </div>
    </StoreReviewsStateProvider>
  );
}

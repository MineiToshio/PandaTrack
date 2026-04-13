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
  Store,
  UserRound,
} from "lucide-react";
import { siFacebook, siInstagram, siTiktok, siWhatsapp } from "simple-icons";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";
import StoreSectionLabel from "../../_components/share/StoreSectionLabel";
import { STORE_SURFACE_CARD_CLASSNAME } from "../../_components/share/StoreSurfaceCard";
import { ROUTES } from "@/lib/constants";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import { cn } from "@/lib/styles";
import type { PublicStoreReview, StoreDetail, StoreViewerNote, StoreViewerReview } from "@/queries/store";
import type { EditableStore, StoreGovernanceSummary, StoreGovernanceViewerContext } from "@/queries/storeGovernance";
import BackNavLink from "@/components/core/BackNavLink";
import StoreReviewAggregateBadge from "./StoreReviewAggregateBadge";
import StorePublicReviewsSection from "./StorePublicReviewsSection";
import StoreReviewsStateProvider from "./StoreReviewsStateProvider";
import StoreNoteForm from "./StoreNoteForm";
import StoreEmptyCatalogTag from "../../_components/StoreEmptyCatalogTag";
import StoreGovernanceSummaryModal from "./StoreGovernanceSummaryModal";
import StoreReportModal from "./StoreReportModal";
import CollectorCountryFlagEmoji from "../../_components/share/CollectorCountryFlagEmoji";
import { getCollectorCountryFlagEmoji } from "@/lib/catalog/collectorCountries";

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
  if (!trimmedValue) return null;
  if (type === "EMAIL") return `mailto:${trimmedValue}`;
  if (type === "PHONE") return `tel:${trimmedValue}`;
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

const METRIC_CARD_SHELL_CLASSNAME = cn(
  STORE_SURFACE_CARD_CLASSNAME,
  "overflow-hidden rounded-2xl border-t-2 border-t-primary/45 p-0 sm:p-0",
);

/** Hero meta chips (store detail pre-refactor style). */
const HERO_META_PILL_CLASSNAME =
  "inline-flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium text-text-body";

/** Hero secondary actions: soft neutral edge + shadow so they read on the tinted hero without loud color. */
const STORE_DETAIL_HERO_ACTION_CLASSNAME = "border border-border/35 shadow-md hover:border-border/50 hover:shadow-lg";

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className={METRIC_CARD_SHELL_CLASSNAME}>
      <div className="px-4 py-3.5">
        <div className="text-text-muted flex items-center gap-1.5">
          {icon}
          <Typography as="span" size="2xs">
            {label}
          </Typography>
        </div>
        <Typography
          as="span"
          size="sm"
          className="text-text-title mt-1.5 block text-2xl leading-none font-semibold tabular-nums sm:text-3xl"
        >
          {value}
        </Typography>
      </div>
    </div>
  );
}

function SidebarField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <Typography as="span" size="2xs" className="text-text-muted shrink-0">
        {label}
      </Typography>
      <Typography as="span" size="xs" className="text-text-body text-right font-medium">
        {children}
      </Typography>
    </div>
  );
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
  const hasGovernanceSummaryContent =
    governanceSummary.totalReports > 0 ||
    governanceSummary.totalChangeRequests > 0 ||
    governanceViewerContext.openChangeRequest != null ||
    governanceViewerContext.openReport != null;
  const showStoreStatusCard = isPendingReview || isInactive || hasGovernanceSummaryContent;
  const isBusiness = store.storeType === "BUSINESS";
  const storeTypeLabel = isBusiness ? tStores("create.storeTypeBusiness") : tStores("create.storeTypePerson");
  const storeTypeIcon = isBusiness ? (
    <Building2 className="text-primary size-3.5 shrink-0" aria-hidden />
  ) : (
    <UserRound className="text-info size-3.5 shrink-0" aria-hidden />
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
  const storeCountryFlagEmoji = getCollectorCountryFlagEmoji(store.countryCode);
  const editModeLabel = canDirectlyEdit ? tStores("edit.direct.shortLabel") : tStores("edit.changeRequest.shortLabel");

  return (
    <StoreReviewsStateProvider
      averageRating={store.averageRating}
      reviewCount={store.reviewCount}
      reviews={reviews}
      viewerReview={viewerReview}
    >
      <div className="px-4 py-7 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-6xl">
          <BackNavLink href={`/${locale}${ROUTES.stores}`}>{tListing("backToListing")}</BackNavLink>

          {/* ── Header (hero surface, matches pre-layout-refactor store detail) ── */}
          <section
            aria-labelledby="store-detail-heading"
            className={cn(
              "from-primary/20 via-highlight/12 to-info/20 relative mt-6 overflow-hidden rounded-3xl bg-linear-to-br px-5 py-6 shadow-sm sm:px-8 sm:py-8",
              "animate-[hero-fade-in-up_460ms_ease-out_both] motion-reduce:animate-none",
            )}
          >
            <div
              className="bg-primary/30 absolute -top-20 right-0 size-44 animate-[hero-glow-pulse_6s_ease-in-out_infinite] rounded-full blur-3xl motion-reduce:animate-none"
              aria-hidden
            />
            <div
              className="bg-accent/30 absolute -bottom-20 -left-10 size-44 animate-[hero-glow-pulse_7s_ease-in-out_infinite] rounded-full blur-3xl motion-reduce:animate-none"
              style={{ animationDelay: "420ms" }}
              aria-hidden
            />

            <header className="relative z-10">
              <div className="flex items-start gap-4 sm:gap-5">
                {isBusiness && store.logoUrl ? (
                  <div
                    className={cn(
                      "border-border/40 bg-background/85 relative size-16 shrink-0 overflow-hidden rounded-2xl border shadow-sm sm:size-20",
                      "animate-[hero-float_5s_ease-in-out_infinite] motion-reduce:animate-none",
                    )}
                  >
                    <Image
                      src={store.logoUrl}
                      alt={tStores("logo.detailAlt", { storeName: store.name })}
                      width={80}
                      height={80}
                      className="size-full object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div
                    className={cn(
                      "border-border/40 bg-background/85 text-primary flex size-16 shrink-0 items-center justify-center rounded-2xl border shadow-sm sm:size-20",
                      "animate-[hero-float_5s_ease-in-out_infinite] motion-reduce:animate-none",
                    )}
                  >
                    <Building2 className="size-7 sm:size-9" aria-hidden />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <Heading as="h1" size="sm" className="text-text-title" id="store-detail-heading">
                      {store.name}
                    </Heading>
                    <div className="flex shrink-0 items-center gap-1.5 pt-1 sm:gap-2">
                      <StoreReportModal
                        locale={locale}
                        storeSlug={store.slug}
                        existingReport={governanceViewerContext.openReport}
                        triggerClassName={STORE_DETAIL_HERO_ACTION_CLASSNAME}
                      />
                      {canAccessEditRoute && (
                        <Link
                          href={`/${locale}${ROUTES.stores}/${editableStore.slug}/edit`}
                          className={cn(
                            buttonVariants({ variant: "secondary", size: "sm" }),
                            STORE_DETAIL_HERO_ACTION_CLASSNAME,
                            "gap-1.5 max-lg:h-11 max-lg:min-w-11 max-lg:justify-center max-lg:px-0",
                          )}
                        >
                          <Pencil className="size-4 shrink-0" aria-hidden />
                          <span className="max-lg:sr-only">{editModeLabel}</span>
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={HERO_META_PILL_CLASSNAME}>
                      {storeTypeIcon}
                      {storeTypeLabel}
                    </span>
                    <span className={HERO_META_PILL_CLASSNAME}>
                      {storeCountryFlagEmoji ? (
                        <CollectorCountryFlagEmoji countryCode={store.countryCode} className="shrink-0" />
                      ) : (
                        <MapPinned className="size-3.5 shrink-0" aria-hidden />
                      )}
                      {tCountries(store.countryCode)}
                    </span>
                    <StoreReviewAggregateBadge />
                  </div>
                </div>
              </div>

              {store.description ? (
                <Typography size="sm" className="text-text-body mt-4 max-w-3xl leading-relaxed">
                  {store.description}
                </Typography>
              ) : (
                <Typography size="sm" className="text-text-muted mt-4">
                  {tStores("detail.noDescription")}
                </Typography>
              )}
            </header>
          </section>

          {/* ── Metric cards ── */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              icon={<Box className="size-3.5" aria-hidden />}
              label={tStores("detail.productTypesLabel")}
              value={store.productTypeKeys.length}
            />
            <MetricCard
              icon={<Globe className="size-3.5" aria-hidden />}
              label={tStores("detail.importCountriesLabel")}
              value={store.importCountryCodes.length}
            />
            <MetricCard
              icon={<Link2 className="size-3.5" aria-hidden />}
              label={tStores("detail.contactChannelsCountLabel")}
              value={contactChannelsCount}
            />
            <MetricCard
              icon={<MapPinned className="size-3.5" aria-hidden />}
              label={tStores("detail.addressesCountLabel")}
              value={addressesCount}
            />
          </div>

          {/* ── Status alerts ── */}
          {showStoreStatusCard && (
            <div className={cn(STORE_SURFACE_CARD_CLASSNAME, "mt-6 p-4 sm:p-4")}>
              {isPendingReview && (
                <div className="flex items-start gap-2.5" role="note">
                  <CircleAlert className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
                  <div className="min-w-0">
                    <Typography size="sm" className="text-text-title font-semibold">
                      {tStores("detail.pendingDisclaimerTitle")}
                    </Typography>
                    <Typography size="xs" className="text-text-body mt-1">
                      {tStores("detail.pendingDisclaimerMessage")}
                    </Typography>
                  </div>
                </div>
              )}
              {isInactive && (
                <div
                  className={cn("flex items-start gap-2.5", isPendingReview && "border-border/50 mt-4 border-t pt-4")}
                  role="alert"
                >
                  <CircleAlert className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
                  <div className="min-w-0">
                    <Typography size="sm" className="text-text-title font-semibold">
                      {tStores("detail.inactiveWarningTitle")}
                    </Typography>
                    <Typography size="xs" className="text-text-body mt-1">
                      {tStores("detail.inactiveWarningMessage")}
                    </Typography>
                  </div>
                </div>
              )}
              {hasGovernanceSummaryContent && (
                <StoreGovernanceSummaryModal
                  locale={locale}
                  storeSlug={store.slug}
                  summary={governanceSummary}
                  showTopSeparator={isPendingReview || isInactive}
                  viewerOpenReport={governanceViewerContext.openReport}
                  viewerOpenChangeRequest={governanceViewerContext.openChangeRequest}
                />
              )}
            </div>
          )}

          {/* ── Two-column body ── */}
          <div className="mt-6 grid items-start gap-5 lg:grid-cols-[1fr_300px] lg:gap-6 xl:grid-cols-[1fr_340px]">
            {/* ── Main content ── */}
            <div className="space-y-5">
              {/* Catalog card: Product Types + Import Countries */}
              <section className={cn(STORE_SURFACE_CARD_CLASSNAME, "space-y-5")}>
                <div aria-labelledby="section-product-types">
                  <StoreSectionLabel as="h2" id="section-product-types">
                    {tStores("detail.productTypesLabel")}
                  </StoreSectionLabel>
                  {store.productTypeKeys.length > 0 ? (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {store.productTypeKeys.map((productTypeKey) => (
                        <span
                          key={productTypeKey}
                          className="bg-primary/8 text-primary border-primary/15 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium"
                        >
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

                <hr className="border-border/30" />

                <div aria-labelledby="section-import-countries">
                  <StoreSectionLabel as="h2" id="section-import-countries">
                    {tStores("detail.importCountriesLabel")}
                  </StoreSectionLabel>
                  {store.importCountryCodes.length > 0 ? (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {store.importCountryCodes.map((countryCode) => (
                        <span
                          key={countryCode}
                          className="bg-success/8 text-text-body border-success/15 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium"
                        >
                          <CollectorCountryFlagEmoji countryCode={countryCode} className="shrink-0" />
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
              </section>

              {/* Contact Channels */}
              <section className={STORE_SURFACE_CARD_CLASSNAME} aria-labelledby="section-contact">
                <StoreSectionLabel as="h2" id="section-contact">
                  {tStores("create.contactChannelsLabel")}
                </StoreSectionLabel>
                {isBusiness && contactChannelsCount > 0 ? (
                  <ul className="mt-3 grid gap-2.5 sm:grid-cols-2" role="list">
                    {store.contactChannels?.map((ch) => {
                      const href = buildContactHref(ch.type, ch.value);
                      if (!href) return null;

                      return (
                        <li key={`${ch.type}-${ch.value}`}>
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group border-border/30 hover:border-primary/25 focus-visible:ring-ring flex items-center gap-3 rounded-xl border p-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                          >
                            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                              {getContactIcon(ch.type)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <Typography as="span" size="2xs" className="text-text-muted block">
                                {ch.label ?? tStores(`contactChannelTypes.${ch.type}`)}
                              </Typography>
                              <Typography as="span" size="sm" className="text-text-body block truncate font-medium">
                                {ch.value}
                              </Typography>
                            </span>
                            <ExternalLink className="text-text-muted group-hover:text-primary size-3.5 shrink-0 transition-colors" />
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
              </section>

              {/* Addresses */}
              <section className={STORE_SURFACE_CARD_CLASSNAME} aria-labelledby="section-addresses">
                <StoreSectionLabel as="h2" id="section-addresses">
                  {tStores("create.addressesLabel")}
                </StoreSectionLabel>
                {isBusiness && addressesCount > 0 ? (
                  <ul className="mt-3 grid gap-2.5 sm:grid-cols-2" role="list">
                    {store.addresses?.map((address, index) => (
                      <li key={`${address.countryCode}-${address.addressLine}-${index}`}>
                        <div className="border-border/30 border-l-primary/25 rounded-xl border border-l-[3px] px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Store className="text-text-muted size-4 shrink-0" aria-hidden />
                            <Typography size="sm" className="text-text-muted min-w-0 flex-1 font-semibold">
                              {address.city
                                ? `${address.city}, ${tCountries(address.countryCode)}`
                                : tCountries(address.countryCode)}
                            </Typography>
                          </div>
                          <Typography size="sm" className="text-text-muted mt-1">
                            {address.addressLine}
                          </Typography>
                          {address.reference ? (
                            <Typography size="xs" className="text-text-muted mt-1">
                              {address.reference}
                            </Typography>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Typography size="sm" className="text-text-muted mt-2">
                    {isBusiness ? tStores("detail.noAddresses") : tStores("detail.notAvailableForStoreType")}
                  </Typography>
                )}
              </section>
            </div>

            {/* ── Sidebar ── */}
            <aside className="max-lg:order-first lg:sticky lg:top-24">
              <div className={cn(STORE_SURFACE_CARD_CLASSNAME, "space-y-5")}>
                {/* Profile Summary */}
                <div>
                  <StoreSectionLabel as="h3">{tStores("detail.profileSummaryTitle")}</StoreSectionLabel>
                  <div className="divide-border/40 mt-2 divide-y">
                    <SidebarField label={tStores("detail.storeTypeLabel")}>
                      <span className="inline-flex items-center gap-1.5">
                        {storeTypeIcon}
                        {storeTypeLabel}
                      </span>
                    </SidebarField>
                    <SidebarField label={tStores("detail.statusLabel")}>
                      <span className="inline-flex items-center gap-1.5">
                        <BadgeCheck className="text-success size-3.5" aria-hidden />
                        {store.status === "PENDING"
                          ? tStores("detail.statusPending")
                          : tStores("detail.statusApproved")}
                      </span>
                    </SidebarField>
                    <SidebarField label={tStores("detail.createdAtLabel")}>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="text-info size-3.5" aria-hidden />
                        {profileCreatedAt}
                      </span>
                    </SidebarField>
                  </div>
                </div>

                <hr className="border-border/30" />

                {/* Sales channels (sidebar: visible with sticky column on large screens) */}
                <div aria-labelledby="section-presence">
                  <StoreSectionLabel as="h3" id="section-presence">
                    {tStores("detail.presenceLabel")}
                  </StoreSectionLabel>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {store.presenceTypes.map((presenceType) => (
                      <span
                        key={presenceType}
                        className="bg-info/8 text-text-body border-info/15 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium"
                      >
                        <Globe className="size-3.5" aria-hidden />
                        {tListing(`presence.${presenceType}`)}
                      </span>
                    ))}
                  </div>
                </div>

                <hr className="border-border/30" />

                {/* Business Signals */}
                <div>
                  <StoreSectionLabel as="h3">{tStores("detail.businessSignalsTitle")}</StoreSectionLabel>
                  <div className="mt-3 space-y-2">
                    <div
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium",
                        store.receivesOrders ? "bg-primary/10 text-primary" : "bg-muted/50 text-text-muted",
                      )}
                    >
                      <PackageSearch className="size-3.5" aria-hidden />
                      {receivesOrdersLabel}
                    </div>
                    <div
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium",
                        store.hasStock ? "bg-success/10 text-success" : "bg-muted/50 text-text-muted",
                      )}
                    >
                      <Box className="size-3.5" aria-hidden />
                      {hasStockLabel}
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          {/* ── Reviews & Notes (full width) ── */}
          <div className="mt-6 space-y-5">
            <StorePublicReviewsSection locale={locale} storeSlug={store.slug} />
            <StoreNoteForm key={store.slug} locale={locale} storeSlug={store.slug} existingNote={viewerNote} />
          </div>
        </div>
      </div>
    </StoreReviewsStateProvider>
  );
}

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  CircleAlert,
  Clock,
  Copy,
  ExternalLink,
  Flag,
  GitPullRequestArrow,
  Lock,
  Mail,
  Map as MapIcon,
  MapPin,
  Pencil,
  Phone,
  PlusCircle,
} from "lucide-react";
import { formatAmount } from "@/lib/currency";
import { siFacebook, siInstagram, siTiktok, siWhatsapp } from "simple-icons";
import BackNavLink from "@/components/core/BackNavLink";
import Button from "@/components/core/Button/Button";
import Chip from "@/components/core/Chip";
import Eyebrow from "@/components/core/Eyebrow";
import Typography from "@/components/core/Typography";
import AlertBanner from "@/components/modules/AlertBanner";
import ChannelRow from "@/components/modules/ChannelRow";
import DetailSidebar from "@/components/modules/DetailSidebar";
import SummaryStatRow from "@/components/modules/SummaryStatRow";
import { ROUTES } from "@/lib/constants";
import type {
  PublicStoreReview,
  StoreDetail,
  StoreViewerNote,
  StoreViewerReview,
  ViewerStoreActivity,
} from "@/queries/store";
import type { EditableStore, StoreGovernanceSummary, StoreGovernanceViewerContext } from "@/queries/storeGovernance";
import StoreHero from "../../_components/share/StoreHero";
import CollapsibleSection from "@/components/modules/CollapsibleSection";
import StorePublicReviewsSection from "./StorePublicReviewsSection";
import StoreReviewsStateProvider from "./StoreReviewsStateProvider";
import StoreNoteForm from "./StoreNoteForm";
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
  viewerActivity: ViewerStoreActivity;
  canAccessEditRoute: boolean;
  canDirectlyEdit: boolean;
  backHref?: string | null;
  backOrderLabel?: string | null;
};

function SimpleIconSvg({ path, size = 14 }: { path: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} aria-hidden="true">
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
  if (type === "EMAIL") return <Mail size={14} aria-hidden="true" />;
  if (type === "PHONE") return <Phone size={14} aria-hidden="true" />;
  return <ExternalLink size={14} aria-hidden="true" />;
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
  viewerActivity,
  canAccessEditRoute,
  canDirectlyEdit,
  backHref,
  backOrderLabel,
}: StoreDetailContentProps) {
  const tStores = useTranslations("stores");
  const tCountries = useTranslations("countries");
  const tProductTypes = useTranslations("storeProductTypes");
  const tListing = useTranslations("storeListing");
  const tChannelTypes = useTranslations("stores.contactChannelTypes");

  const isPendingReview = store.status === "PENDING";
  const isInactive = !store.isActive;
  const hasGovernanceSummaryContent =
    governanceSummary.totalReports > 0 ||
    governanceSummary.totalChangeRequests > 0 ||
    governanceViewerContext.openChangeRequest != null ||
    governanceViewerContext.openReport != null;
  const isBusiness = store.storeType === "BUSINESS";
  const contactChannelsCount = store.contactChannels?.length ?? 0;
  const addressesCount = store.addresses?.length ?? 0;
  const editModeLabel = canDirectlyEdit ? tStores("edit.direct.shortLabel") : tStores("edit.changeRequest.shortLabel");
  const backLabel =
    backHref && backOrderLabel ? tListing("backToOrder", { orderId: backOrderLabel }) : tListing("backToListing");

  return (
    <StoreReviewsStateProvider
      averageRating={store.averageRating}
      reviewCount={store.reviewCount}
      reviews={reviews}
      viewerReview={viewerReview}
    >
      <div className="text-foreground space-y-4">
        <BackNavLink href={backHref ?? `/${locale}${ROUTES.stores}`}>{backLabel}</BackNavLink>

        {store.isPrivate && (
          <AlertBanner tone="info" icon={<Lock size={14} aria-hidden="true" />}>
            {tStores("redesign.detail.privateBadge")}
          </AlertBanner>
        )}

        {/* Status alerts (PENDING / inactive / governance) — tonal banner per demo `s6-store-detail-pending` */}
        {isPendingReview && (
          <AlertBanner
            tone="warning"
            icon={<Clock size={16} aria-hidden="true" />}
            title={tStores("detail.pendingDisclaimerTitle")}
          >
            {tStores("detail.pendingDisclaimerMessage")}
          </AlertBanner>
        )}
        {isInactive && (
          <AlertBanner
            tone="destructive"
            icon={<CircleAlert size={16} aria-hidden="true" />}
            title={tStores("detail.inactiveWarningTitle")}
          >
            {tStores("detail.inactiveWarningMessage")}
          </AlertBanner>
        )}
        {hasGovernanceSummaryContent && (
          <StoreGovernanceSummaryModal
            locale={locale}
            storeSlug={store.slug}
            storeName={store.name}
            summary={governanceSummary}
            triggerVariant="banner"
            viewerOpenReport={governanceViewerContext.openReport}
            viewerOpenChangeRequest={governanceViewerContext.openChangeRequest}
          />
        )}

        {/* Two-column layout: main + sticky aside on lg */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21.25rem]">
          {/* ── Main column ── */}
          <div className="min-w-0 space-y-3">
            <StoreHero
              store={store}
              labels={{
                countryName: (code) => tCountries(code),
                ratingCount: (count) => tListing("ratingCount", { count }),
                ratingFallback: tStores("redesign.detail.ratingFallback"),
                presencePhysical: tStores("redesign.detail.presence.physical"),
                presenceOnline: tStores("redesign.detail.presence.online"),
                hasStock: tStores("redesign.detail.hasStock"),
                acceptsPreorders: tStores("redesign.detail.acceptsPreorders"),
                personChip: tStores("redesign.detail.personChip"),
                personNote: isBusiness ? undefined : tStores("redesign.detail.personNote"),
                pendingChip: tStores("redesign.detail.pendingChip"),
              }}
            />

            <CollapsibleSection eyebrow={tStores("redesign.detail.categoriesTitle")}>
              <div className="space-y-4">
                <div>
                  <Eyebrow as="p">{tStores("create.productTypesLabel")}</Eyebrow>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {store.productTypeKeys.length > 0 ? (
                      store.productTypeKeys.map((key) => (
                        <Chip key={key} variant="accent">
                          {tProductTypes(key)}
                        </Chip>
                      ))
                    ) : (
                      <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">
                        {tStores("detail.noProductTypes")}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <Eyebrow as="p">{tStores("redesign.detail.importsFrom")}</Eyebrow>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {store.importCountryCodes.length > 0 ? (
                      store.importCountryCodes.map((code) => (
                        <Chip key={code} variant="neutral">
                          {tCountries(code)}
                        </Chip>
                      ))
                    ) : (
                      <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">
                        {tStores("detail.noImportCountries")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {isBusiness && contactChannelsCount > 0 && (
              <CollapsibleSection eyebrow={tStores("redesign.detail.channelsTitle")} count={contactChannelsCount}>
                <div className="flex flex-col">
                  {store.contactChannels?.map((ch) => {
                    const href = buildContactHref(ch.type, ch.value);
                    if (!href) return null;
                    return (
                      <ChannelRow
                        key={`${ch.type}-${ch.value}`}
                        icon={getContactIcon(ch.type)}
                        label={ch.label ?? tChannelTypes(ch.type)}
                        value={ch.value}
                        trailing={
                          ch.type === "EMAIL" || ch.type === "PHONE" ? (
                            <a
                              href={href}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] [color:var(--text-secondary)] hover:[background:color-mix(in_oklch,var(--text-primary)_5%,transparent)]"
                              aria-label={tChannelTypes(ch.type)}
                            >
                              <Copy size={14} aria-hidden="true" />
                            </a>
                          ) : (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] [color:var(--text-secondary)] hover:[background:color-mix(in_oklch,var(--text-primary)_5%,transparent)]"
                              aria-label={tChannelTypes(ch.type)}
                            >
                              <ExternalLink size={14} aria-hidden="true" />
                            </a>
                          )
                        }
                      />
                    );
                  })}
                </div>
              </CollapsibleSection>
            )}

            {isBusiness && addressesCount > 0 && (
              <CollapsibleSection eyebrow={tStores("redesign.detail.addressesTitle")} count={addressesCount}>
                <div className="flex flex-col">
                  {store.addresses?.map((address, index) => {
                    // Postal-style multi-line: street → reference → city, country.
                    // Each part flows on its own line and wraps independently so long
                    // addresses (e.g. Japanese full addresses) stay fully visible.
                    const lines = [
                      address.addressLine,
                      address.reference ?? "",
                      [address.city, tCountries(store.countryCode)].filter(Boolean).join(", "),
                    ];
                    return (
                      <ChannelRow
                        key={`${address.addressLine}-${index}`}
                        icon={<MapPin size={14} aria-hidden="true" />}
                        label={tStores("redesign.detail.addressDefaultLabel")}
                        valueLines={lines}
                        trailing={
                          <span
                            aria-hidden="true"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] [color:var(--text-secondary)]"
                          >
                            <MapIcon size={13} aria-hidden="true" />
                          </span>
                        }
                      />
                    );
                  })}
                </div>
              </CollapsibleSection>
            )}

            <CollapsibleSection eyebrow={tStores("redesign.detail.reviewsTitle")}>
              <StorePublicReviewsSection locale={locale} storeSlug={store.slug} />
            </CollapsibleSection>
          </div>

          {/* ── Sticky aside ── */}
          <DetailSidebar
            ariaLabel={tStores("detail.quickSummaryLabel")}
            labels={{
              resumen: tStores("redesign.detail.aside.resumen"),
              acciones: tStores("redesign.detail.aside.acciones"),
              notaPrivada: tStores("redesign.detail.aside.notaPrivada"),
              notaPrivadaEyebrow: tStores("redesign.detail.aside.notaPrivada"),
            }}
            resumen={
              viewerActivity.ordersTotal > 0 ? (
                <>
                  {/* Rows wrap in a single container so the sidebar's flex gap doesn't
                      pull them apart from their border-top separators. */}
                  <div className="flex flex-col">
                    <SummaryStatRow
                      label={tStores("redesign.detail.aside.ordersTotalLabel")}
                      value={String(viewerActivity.ordersTotal)}
                    />
                    <SummaryStatRow
                      label={tStores("redesign.detail.aside.ordersActiveLabel")}
                      value={String(viewerActivity.ordersActive)}
                    />
                    {viewerActivity.totalSpentByCurrency.length > 0 && (
                      <SummaryStatRow
                        label={tStores("redesign.detail.aside.totalSpentLabel")}
                        value={viewerActivity.totalSpentByCurrency
                          .map(({ currencyCode, totalMinorUnits }) => formatAmount(totalMinorUnits, currencyCode))
                          .join(" · ")}
                      />
                    )}
                  </div>
                  <Button
                    as="a"
                    href={`/${locale}${ROUTES.orders}?store=${store.id}`}
                    variant="link"
                    leadingIcon={<ExternalLink size={14} aria-hidden="true" />}
                    className="self-start [font-size:var(--text-caption)]"
                  >
                    {tStores("redesign.detail.aside.viewLinkedOrders")}
                  </Button>
                </>
              ) : (
                <Typography size="xs" className="text-text-muted">
                  {tStores("redesign.detail.aside.noOrdersYet")}
                </Typography>
              )
            }
            acciones={
              <>
                <Button
                  as="a"
                  href={`/${locale}${ROUTES.ordersNew}?store=${store.id}`}
                  variant="primary"
                  leadingIcon={<PlusCircle size={16} aria-hidden="true" />}
                  fullWidth
                  className="justify-start"
                >
                  {tStores("redesign.detail.actions.anotarPedido")}
                </Button>
                {canAccessEditRoute && (
                  <Button
                    as="a"
                    href={`/${locale}${ROUTES.stores}/${editableStore.slug}/edit`}
                    variant="ghost"
                    leadingIcon={
                      canDirectlyEdit ? (
                        <Pencil size={16} aria-hidden="true" />
                      ) : (
                        <GitPullRequestArrow size={16} aria-hidden="true" />
                      )
                    }
                    fullWidth
                    className="justify-start"
                  >
                    {editModeLabel}
                  </Button>
                )}
                <StoreReportModal
                  locale={locale}
                  storeSlug={store.slug}
                  storeName={store.name}
                  existingReport={governanceViewerContext.openReport}
                  triggerClassName="w-full justify-start"
                  triggerVariant="destructive-ghost"
                  showTriggerLabel
                  triggerIcon={<Flag size={16} aria-hidden="true" />}
                />
              </>
            }
            notaPrivada={
              <StoreNoteForm key={store.slug} locale={locale} storeSlug={store.slug} existingNote={viewerNote} />
            }
          />
        </div>

        {/* Hidden h1 for SR (the visible title is in StoreHero) */}
        <h1 id="store-detail-heading" className="sr-only">
          {store.name}
        </h1>
      </div>
    </StoreReviewsStateProvider>
  );
}

// Re-exported for the Link href; helps the diff tracker. Used as side-effect import target.
export { Link };

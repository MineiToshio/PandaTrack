import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  AtSign,
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
  Package,
  Pencil,
  Phone,
  ShieldAlert,
  Star,
  Tags,
  Zap,
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
} from "@/lib/data/stores/storeQueries";
import type {
  EditableStore,
  StoreGovernanceSummary,
  StoreGovernanceViewerContext,
} from "@/lib/data/stores/storeGovernanceQueries";
import type { AdminOpenStoreReport } from "@/lib/data/admin/adminStoreReportQueries";
import type { AdminPendingStoreChangeRequest } from "@/lib/data/admin/adminStoreChangeRequestQueries";
import type { StoreDebtRow, StorePaymentListRow } from "@/lib/data/orders/storePaymentQueries";
import {
  resolveStoreProductTypeName,
  type AuthoredStoreProductTypeNameMap,
} from "@/lib/catalog/resolveStoreProductTypeName";
import StoreHero from "../../_components/share/StoreHero";
import CollapsibleSection from "@/components/modules/CollapsibleSection";
import StorePublicReviewsSection from "./StorePublicReviewsSection";
import StoreReviewsStateProvider from "./StoreReviewsStateProvider";
import StoreNoteForm from "./StoreNoteForm";
import StoreGovernanceSummaryModal from "./StoreGovernanceSummaryModal";
import StoreReportNoticeProvider from "./StoreReportNoticeProvider";
import StoreReportNoticeBanner, { StoreReportedChip } from "./StoreReportNotice";
import StoreReportModal from "./StoreReportModal";
import StoreAdminModerationPanel from "./StoreAdminModerationPanel";
import StoreCreateOrderButton from "./StoreCreateOrderButton";
import StorePaymentStateProvider from "./StorePaymentStateProvider";
import StorePaymentsSection from "./StorePaymentsSection";
import StorePaymentProgressRows from "./StorePaymentProgressRows";
import StoreRegisterPaymentButton from "./StoreRegisterPaymentButton";

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
  /** The viewer's debt with this store, one row per currency they have committed orders or
      payments in (§ store-level payments). Empty when the viewer has no orders here. */
  storeDebtByCurrency: StoreDebtRow[];
  /** Every payment the viewer has made to this store, newest first, for the "Pagos a esta tienda"
      card — capped server-side; see `getStorePaymentsForStore`. */
  storePayments: StorePaymentListRow[];
  /** True total behind `storePayments`, independent of the query's display cap. */
  storePaymentsTotalCount: number;
  /**
   * Open reports with reporter identity and raw free-text, populated only when the viewer is an
   * administrator. Absent for every non-admin viewer, so no admin read is exposed to the client.
   */
  adminOpenReports?: AdminOpenStoreReport[];
  /**
   * Pending change requests with the rebased diff and requester identity, populated only when the
   * viewer is an administrator. Absent for every non-admin viewer.
   */
  adminChangeRequests?: AdminPendingStoreChangeRequest[];
  canAccessEditRoute: boolean;
  canDirectlyEdit: boolean;
  /** When true, the viewer is an administrator and the admin moderation panel is rendered. */
  canModerate: boolean;
  /**
   * Who is looking. The private banner asserts "solo tú la ves", which is only true for the
   * store's creator; an admin may reach a private store they did not create, and telling them it
   * is theirs alone is simply false.
   */
  viewerId?: string | null;
  /** Authored (non-seed) catalog names so category chips resolve admin-authored types; seeds use i18n. */
  authoredProductTypeNames: AuthoredStoreProductTypeNameMap;
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
  storeDebtByCurrency,
  storePayments,
  storePaymentsTotalCount,
  adminOpenReports,
  adminChangeRequests,
  canAccessEditRoute,
  canDirectlyEdit,
  canModerate,
  viewerId,
  authoredProductTypeNames,
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
  // RETAILER and PROXY sellers expose logo, contact channels, and addresses; PERSON does not.
  const exposesContactInfo = store.sellerType !== "PERSON";
  const isPerson = store.sellerType === "PERSON";
  // A PROXY is an intermediary with no catalog of its own.
  const isProxy = store.sellerType === "PROXY";
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
      <StoreReportNoticeProvider
        openReportCount={governanceSummary.openReports}
        adminOpenReportIds={adminOpenReports?.map((report) => report.id)}
      >
        <div className="text-foreground space-y-4">
          <BackNavLink href={backHref ?? `/${locale}${ROUTES.stores}`}>{backLabel}</BackNavLink>

          {store.isPrivate && store.createdByUserId === viewerId && (
            <AlertBanner tone="info" icon={<Lock size={14} aria-hidden="true" />}>
              {tStores("redesign.detail.privateBadge")}
            </AlertBanner>
          )}

          {/* Status alerts (PENDING / inactive / governance) — tonal banner per demo
            `s6-store-detail-pending`. The pending banner is a calm `info` tone: it frames the
            store as under review, not as untrustworthy data (FR-04-50). The report notice follows
            it, never replaces it: the lifecycle statement first, then the report information. */}
          {isPendingReview && (
            <AlertBanner
              tone="info"
              icon={<Clock size={16} aria-hidden="true" />}
              title={tStores("detail.pendingDisclaimerTitle")}
            >
              {tStores("detail.pendingDisclaimerMessage")}
            </AlertBanner>
          )}
          <StoreReportNoticeBanner />
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
              adminReports={adminOpenReports}
              adminChangeRequests={adminChangeRequests}
            />
          )}

          {/* Two-column layout: main + sticky aside on lg. 320px rail matches orders/deliveries detail. */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* ── Main column ── */}
            {/* StorePaymentStateProvider wraps both columns: the aside's "Debes" rows/"Registrar
                pago" action and this column's "Pagos a esta tienda" card share one live debt figure
                and one payments list, so deleting a payment here updates the sidebar in lockstep. */}
            <StorePaymentStateProvider
              storeId={store.id}
              storeName={store.name}
              storeDebtByCurrency={storeDebtByCurrency}
              storePayments={storePayments}
              storePaymentsTotalCount={storePaymentsTotalCount}
              locale={locale}
            >
              <div className="min-w-0 space-y-3">
                <StoreHero
                  store={store}
                  derivedSignals={<StoreReportedChip />}
                  labels={{
                    countryName: (code) => tCountries(code),
                    ratingCount: (count) => tListing("ratingCount", { count }),
                    ratingFallback: tStores("redesign.detail.ratingFallback"),
                    presencePhysical: tStores("redesign.detail.presence.physical"),
                    presenceOnline: tStores("redesign.detail.presence.online"),
                    hasStock: tStores("redesign.detail.hasStock"),
                    acceptsPreorders: tStores("redesign.detail.acceptsPreorders"),
                    personChip: tStores("redesign.detail.personChip"),
                    personNote: isPerson ? tStores("redesign.detail.personNote") : undefined,
                    proxyChip: tStores("redesign.detail.proxyChip"),
                    pendingChip: tStores("redesign.detail.pendingChip"),
                    zoomLogo: (storeName) => tStores("redesign.detail.zoomLogo", { store: storeName }),
                  }}
                />

                <CollapsibleSection
                  eyebrow={
                    <Eyebrow variant="chip" tone="cool" icon={Tags}>
                      {tStores("redesign.detail.categoriesTitle")}
                    </Eyebrow>
                  }
                  topAccent="cool"
                >
                  <div className="space-y-4">
                    {/* A PROXY has no catalog of its own, so the product-types block is omitted. */}
                    {!isProxy && (
                      <div>
                        <Eyebrow as="p">{tStores("create.productTypesLabel")}</Eyebrow>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {store.productTypeKeys.length > 0 ? (
                            store.productTypeKeys.map((key) => (
                              <Chip key={key} variant="accent">
                                {resolveStoreProductTypeName(authoredProductTypeNames[key], tProductTypes(key), locale)}
                              </Chip>
                            ))
                          ) : (
                            <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">
                              {tStores("detail.noProductTypes")}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

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

                <StorePaymentsSection locale={locale} />

                {exposesContactInfo && contactChannelsCount > 0 && (
                  <CollapsibleSection
                    eyebrow={
                      <Eyebrow variant="chip" tone="cool" icon={AtSign}>
                        {tStores("redesign.detail.channelsTitle")}
                      </Eyebrow>
                    }
                    count={contactChannelsCount}
                    topAccent="cool"
                  >
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
                                  // Tap target ≥44×44 on mobile via the `::before` pseudo (same mechanism as
                                  // `IconButton`): 36 + 2×4. `ChannelRow` is ~60px tall with a single trailing
                                  // control, so the expansion stays inside the row and clears the neighbouring
                                  // rows' links. `md:before:inset-0` drops the extra area on desktop.
                                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] [color:var(--text-secondary)] before:absolute before:[inset:-4px] before:content-[''] hover:[background:color-mix(in_oklch,var(--text-primary)_5%,transparent)] md:before:inset-0"
                                  aria-label={tChannelTypes(ch.type)}
                                >
                                  <Copy size={14} aria-hidden="true" />
                                </a>
                              ) : (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  // Tap target ≥44×44 on mobile via the `::before` pseudo (same mechanism as
                                  // `IconButton`): 36 + 2×4. `ChannelRow` is ~60px tall with a single trailing
                                  // control, so the expansion stays inside the row and clears the neighbouring
                                  // rows' links. `md:before:inset-0` drops the extra area on desktop.
                                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] [color:var(--text-secondary)] before:absolute before:[inset:-4px] before:content-[''] hover:[background:color-mix(in_oklch,var(--text-primary)_5%,transparent)] md:before:inset-0"
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

                {exposesContactInfo && addressesCount > 0 && (
                  <CollapsibleSection
                    eyebrow={
                      <Eyebrow variant="chip" tone="cool" icon={MapPin}>
                        {tStores("redesign.detail.addressesTitle")}
                      </Eyebrow>
                    }
                    count={addressesCount}
                    topAccent="cool"
                  >
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

                <CollapsibleSection
                  eyebrow={
                    <Eyebrow variant="chip" tone="warm" icon={Star}>
                      {tStores("redesign.detail.reviewsTitle")}
                    </Eyebrow>
                  }
                  topAccent="warm"
                >
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
                  governance: tStores("moderation.panelTitle"),
                }}
                accents={{
                  resumen: { tone: "accent", icon: Package, topAccent: "accent" },
                  acciones: { tone: "accent", icon: Zap, topAccent: "accent" },
                  governance: { tone: "warning", icon: ShieldAlert, topAccent: "warning" },
                }}
                governance={
                  canModerate ? (
                    <StoreAdminModerationPanel
                      key={store.status}
                      locale={locale}
                      storeSlug={store.slug}
                      storeName={store.name}
                      initialStatus={store.status as "PENDING" | "APPROVED"}
                    />
                  ) : undefined
                }
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
                        {/* Payment progress per currency (§ store-level payments), replacing the
                        old "Deuda pendiente" row: a bar plus the absolute paid/committed pair, and
                        the "Cancelados" line that reconciles it with "Total facturado" above. Reads
                        the live (optimistically patched) figures from `StorePaymentStateProvider`. */}
                        <StorePaymentProgressRows totalSpentByCurrency={viewerActivity.totalSpentByCurrency} />
                      </div>
                      {/* Inline hyperlink recipe (playbook §1, `link` variant is legacy) — matches
                      the "Ver entregas" link in OrderItemsReadOnlyList. */}
                      <Link
                        href={`/${locale}${ROUTES.orders}?store=${store.id}`}
                        className="text-accent inline-flex items-center gap-1.5 self-start [font-size:var(--text-caption)] font-medium underline-offset-2 hover:underline"
                      >
                        <ExternalLink size={14} aria-hidden="true" />
                        {tStores("redesign.detail.aside.viewLinkedOrders")}
                      </Link>
                    </>
                  ) : (
                    <Typography size="xs" className="text-text-muted">
                      {tStores("redesign.detail.aside.noOrdersYet")}
                    </Typography>
                  )
                }
                acciones={
                  <>
                    <StoreCreateOrderButton
                      locale={locale}
                      storeId={store.id}
                      label={tStores("redesign.detail.actions.anotarPedido")}
                    />
                    <StoreRegisterPaymentButton />
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
            </StorePaymentStateProvider>
          </div>

          {/* Hidden h1 for SR (the visible title is in StoreHero) */}
          <h1 id="store-detail-heading" className="sr-only">
            {store.name}
          </h1>
        </div>
      </StoreReportNoticeProvider>
    </StoreReviewsStateProvider>
  );
}

// Re-exported for the Link href; helps the diff tracker. Used as side-effect import target.
export { Link };

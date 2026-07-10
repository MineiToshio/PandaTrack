import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Boxes, Sparkles, Store } from "lucide-react";
import Button from "@/components/core/Button/Button";
import StatusChip from "@/components/core/StatusChip";
import StoreAvatar from "@/components/core/StoreAvatar";
import EmptyState from "@/components/modules/EmptyState";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import type { DashboardData } from "@/lib/data/dashboard/dashboardTypes";
import type { OrderStatus } from "../../../../../../generated/prisma/client";
import { formatDashboardMoney } from "../_utils/dashboardMoney";
import DashboardDonut, { type DashboardDonutSlice } from "./DashboardDonut";
import DashboardFxPartialNotice from "./DashboardFxPartialNotice";
import DashboardZoneCard from "./DashboardZoneCard";
import DashboardZoneLink from "./DashboardZoneLink";
import DashboardZoneView from "./DashboardZoneView";

export type DashboardCollectionZoneProps = {
  data: DashboardData;
  locale: string;
  /** Preference-driven public store listing URL. */
  storesHref: string;
};

const COLLECTION_TITLE_ID = "dashboard-collection-title";

/** Categorical palette, applied in rank order. A long tail folds into the neutral "other" slice. */
const CATEGORY_COLORS = ["var(--accent)", "var(--accent-cool)", "var(--accent-warm)", "var(--success)"];
const OTHER_COLOR = "color-mix(in oklab, var(--text-primary) 26%, transparent)";
const MAX_CATEGORIES = CATEGORY_COLORS.length;

/** Segment colour per order status. Cancelled orders never reach the bar. */
const STATUS_COLORS: Record<OrderStatus, string> = {
  OPEN: "var(--accent)",
  PARTIALLY_IN_TRANSIT: "var(--info)",
  IN_TRANSIT: "var(--info)",
  PARTIALLY_DELIVERED: "var(--accent-cool)",
  COMPLETED: "var(--success)",
  CANCELLED: OTHER_COLOR,
};

type Category = { key: string | null; label: string; value: number; color: string; isOther: boolean };

/** Ranks entries, keeps the top slots, and folds everything else into one "other" bucket. */
function rankCategories(
  entries: Array<{ productTypeKey: string | null; value: number }>,
  labelOf: (key: string | null) => string,
  otherLabel: string,
): Category[] {
  const ranked = entries.filter((entry) => entry.value > 0).sort((a, b) => b.value - a.value);
  const head = ranked.slice(0, MAX_CATEGORIES).map((entry, index) => ({
    key: entry.productTypeKey,
    label: labelOf(entry.productTypeKey),
    value: entry.value,
    color: CATEGORY_COLORS[index],
    isOther: false,
  }));

  const tail = ranked.slice(MAX_CATEGORIES);
  if (tail.length === 0) {
    return head;
  }
  const otherValue = tail.reduce((sum, entry) => sum + entry.value, 0);
  return [...head, { key: null, label: otherLabel, value: otherValue, color: OTHER_COLOR, isOther: true }];
}

/** "Tu colección": status split, spend and product count by category, and top stores. */
export default async function DashboardCollectionZone({ data, locale, storesHref }: DashboardCollectionZoneProps) {
  const [t, tTypes, tStatus] = await Promise.all([
    getTranslations({ locale, namespace: "dashboard" }),
    getTranslations({ locale, namespace: "storeProductTypes" }),
    getTranslations({ locale, namespace: "components.statusChip.orderStatus" }),
  ]);
  const { collection, paidVsOutstanding, baseCurrencyCode } = data;
  const money = (minor: number): string => formatDashboardMoney(minor, baseCurrencyCode, locale);

  // Product type keys are a closed catalog; unknown or missing keys fall back to "uncategorized".
  const labelOf = (key: string | null): string => (key ? tTypes(key as "figures") : t("collection.uncategorized"));

  const cardProps = {
    titleId: COLLECTION_TITLE_ID,
    eyebrow: t("collection.eyebrow"),
    eyebrowIcon: Boxes,
    title: t("collection.title"),
    tone: "warm" as const,
  };

  if (collection.totalOrders === 0) {
    return (
      <>
        <DashboardZoneView event={POSTHOG_EVENTS.DASHBOARD.COLLECTION_ZONE_VIEWED} props={{ state: "empty" }} />
        <DashboardZoneCard {...cardProps}>
          <EmptyState
            appearance="card"
            iconTone="accent"
            icon={<Sparkles size={28} aria-hidden="true" />}
            title={t("collection.empty.title")}
            subtitle={t("collection.empty.body")}
            actions={
              <Button
                as="a"
                href={storesHref}
                variant="ghost"
                size="md"
                leadingIcon={<Store className="size-4" aria-hidden="true" />}
                data-ph-event={POSTHOG_EVENTS.DASHBOARD.TOP_STORE_CTA_CLICKED}
                data-ph-props={JSON.stringify({ source: "empty_state" })}
              >
                {t("collection.empty.cta")}
              </Button>
            }
          />
        </DashboardZoneCard>
      </>
    );
  }

  // Screen readers get the same status names the visible chips show, not the raw enum keys.
  const statusSummary = collection.statusDistribution
    .map((entry) => `${tStatus(entry.status)}: ${entry.count}`)
    .join(", ");

  const spendCategories = rankCategories(
    collection.spendByType.map((entry) => ({ productTypeKey: entry.productTypeKey, value: entry.committedMinor })),
    labelOf,
    t("collection.otherCategory"),
  );
  const spendTotal = spendCategories.reduce((sum, category) => sum + category.value, 0);
  const spendSlices: DashboardDonutSlice[] = spendCategories.map((category, index) => ({
    key: `${category.key ?? "other"}-${index}`,
    color: category.color,
    percent: spendTotal > 0 ? (category.value / spendTotal) * 100 : 0,
  }));
  const spendSummary = spendCategories.map((category) => `${category.label} ${money(category.value)}`).join(", ");

  const countCategories = rankCategories(
    collection.productCountByType.map((entry) => ({ productTypeKey: entry.productTypeKey, value: entry.quantity })),
    labelOf,
    t("collection.otherCategory"),
  );
  const maxCount = countCategories.reduce((max, category) => Math.max(max, category.value), 0);

  const topStoreMax = collection.topStores.reduce((max, store) => Math.max(max, store.committedMinor), 0);
  const isPartial = collection.spendByTypeIsPartial || collection.topStoresIsPartial;

  return (
    <>
      <DashboardZoneView event={POSTHOG_EVENTS.DASHBOARD.COLLECTION_ZONE_VIEWED} props={{ state: "populated" }} />
      <DashboardZoneCard
        {...cardProps}
        trailing={
          <DashboardZoneLink
            href={storesHref}
            label={t("collection.seeStores")}
            posthogEvent={POSTHOG_EVENTS.DASHBOARD.TOP_STORE_CTA_CLICKED}
            posthogProps={{ source: "zone_header" }}
          />
        }
      >
        <div className="flex flex-1 flex-col">
          <p className="mb-2.5 [font-size:12px] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase">
            {t("collection.statusLabel")}
          </p>
          <div
            role="img"
            aria-label={t("collection.statusAria", { summary: statusSummary })}
            className="flex h-[18px] gap-0.5 overflow-hidden rounded-full [background:color-mix(in_oklab,var(--text-primary)_8%,transparent)]"
          >
            {collection.statusDistribution.map((entry) => (
              <span
                key={entry.status}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{
                  width: `${(entry.count / collection.totalOrders) * 100}%`,
                  background: STATUS_COLORS[entry.status],
                }}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2">
            {collection.statusDistribution.map((entry) => (
              <span key={entry.status} className="inline-flex items-center gap-1.5">
                <StatusChip kind="orderStatus" value={entry.status} size="sm" />
                <span className="[font-size:12.5px] [font-weight:var(--font-weight-bold)] [color:var(--text-primary)] tabular-nums">
                  {entry.count}
                </span>
              </span>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 min-[700px]:grid-cols-2 xl:grid-cols-[1.15fr_0.95fr_0.9fr] xl:gap-8">
            {/* Spend by category — money. */}
            <section aria-label={t("collection.spendLabel")}>
              <p className="mb-3 [font-size:12px] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase">
                {t("collection.spendLabel")}
              </p>
              {spendTotal === 0 ? (
                <p className="[font-size:var(--text-body)] [color:var(--text-muted)]">{t("collection.spendEmpty")}</p>
              ) : (
                <div className="flex flex-wrap items-center gap-5">
                  <DashboardDonut
                    className="w-[140px] shrink-0"
                    slices={spendSlices}
                    centerValue={money(spendTotal)}
                    centerLabel={t("collection.donutTotalLabel")}
                    ariaLabel={t("collection.spendAria", { summary: spendSummary })}
                  />
                  <ul role="list" className="flex min-w-[9rem] flex-1 flex-col gap-1.5">
                    {spendCategories.map((category, index) => {
                      const row = (
                        <>
                          <span
                            aria-hidden
                            className="size-2.5 shrink-0 rounded-[3px]"
                            style={{ background: category.color }}
                          />
                          <span className="min-w-0 flex-1 truncate">{category.label}</span>
                          <span className="[font-weight:var(--font-weight-semibold)] [color:var(--text-primary)] tabular-nums">
                            {money(category.value)}
                          </span>
                        </>
                      );
                      return (
                        <li
                          key={`${category.key ?? "other"}-${index}`}
                          className="[font-size:12.5px] [color:var(--text-secondary)]"
                        >
                          {category.isOther || !category.key ? (
                            <span className="flex items-center gap-2">{row}</span>
                          ) : (
                            <Link
                              href={`/${locale}${ROUTES.orders}?productType=${encodeURIComponent(category.key)}`}
                              data-ph-event={POSTHOG_EVENTS.DASHBOARD.PRODUCT_TYPE_SEGMENT_CLICKED}
                              data-ph-props={JSON.stringify({ product_type: category.key })}
                              className="-mx-1 flex items-center gap-2 rounded-[var(--radius-md)] px-1 py-0.5 transition-colors hover:[background:color-mix(in_oklab,var(--text-primary)_4%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]"
                            >
                              {row}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>

            {/* Product count by category. */}
            <section aria-label={t("collection.countLabel")}>
              <p className="mb-3 [font-size:12px] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase">
                {t("collection.countLabel")}
              </p>
              <ul role="list" className="flex flex-col">
                {countCategories.map((category, index) => (
                  <li
                    key={`${category.key ?? "other"}-${index}`}
                    className="grid grid-cols-[minmax(0,6rem)_1fr_auto] items-center gap-2.5 py-[7px]"
                  >
                    <span className="truncate [font-size:12.5px] [color:var(--text-secondary)]">{category.label}</span>
                    <span className="h-2 overflow-hidden rounded-full [background:color-mix(in_oklab,var(--text-primary)_8%,transparent)]">
                      <span
                        className="block h-full rounded-full [background:var(--accent)]"
                        style={{ width: maxCount > 0 ? `${(category.value / maxCount) * 100}%` : "0%" }}
                      />
                    </span>
                    <span className="[font-size:12.5px] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)] tabular-nums">
                      {category.value.toLocaleString(locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Top stores. */}
            <section aria-label={t("collection.topStoresLabel")}>
              <p className="mb-3 [font-size:12px] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase">
                {t("collection.topStoresLabel")}
              </p>
              <ul role="list" className="flex flex-col">
                {collection.topStores.map((store) => (
                  <li key={store.storeId}>
                    <Link
                      href={`/${locale}${ROUTES.stores}/${store.storeSlug}`}
                      aria-label={t("collection.storeRowLabel", {
                        store: store.storeName,
                        amount: money(store.committedMinor),
                        count: store.orderCount,
                      })}
                      data-ph-event={POSTHOG_EVENTS.DASHBOARD.TOP_STORE_CTA_CLICKED}
                      data-ph-props={JSON.stringify({ source: "top_stores", store_id: store.storeId })}
                      className="-mx-1 grid grid-cols-[minmax(0,6rem)_1fr_auto] items-center gap-2.5 rounded-[var(--radius-md)] px-1 py-[7px] transition-colors hover:[background:color-mix(in_oklab,var(--text-primary)_4%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <StoreAvatar store={{ name: store.storeName }} size={24} />
                        <span className="truncate [font-size:12.5px] [color:var(--text-secondary)]">
                          {store.storeName}
                        </span>
                      </span>
                      <span className="h-2 overflow-hidden rounded-full [background:color-mix(in_oklab,var(--text-primary)_8%,transparent)]">
                        <span
                          className="block h-full rounded-full [background:var(--accent-cool)]"
                          style={{ width: topStoreMax > 0 ? `${(store.committedMinor / topStoreMax) * 100}%` : "0%" }}
                        />
                      </span>
                      <span className="[font-size:12.5px] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)] tabular-nums">
                        {money(store.committedMinor)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {isPartial && paidVsOutstanding.excludedOrderCount > 0 && (
            <DashboardFxPartialNotice
              message={t("cash.partialWarning", { count: paidVsOutstanding.excludedOrderCount })}
              reconcileLabel={t("cash.reconcileLink")}
              reconcileHref={`/${locale}${ROUTES.orders}?fxPending=true`}
            />
          )}
        </div>
      </DashboardZoneCard>
    </>
  );
}

import { Boxes } from "lucide-react";
import { getTranslations } from "next-intl/server";
import BackNavLink from "@/components/core/BackNavLink";
import Eyebrow from "@/components/core/Eyebrow";
import { ROUTES } from "@/lib/constants";
import { formatDomainDate } from "@/lib/domainDate";
import { getOverdueDays } from "@/lib/arrivalWindow";
import { isOrderOverdue, resolveOrderArrivalDueDate } from "@/lib/orders/orderDerivedState";
import { getTodayStart } from "@/lib/data/dashboard/dashboardPeriods";
import { isItemEligibleForDelivery } from "@/lib/orders/orderState";
import type { OrderDetailFull } from "@/lib/data/orders/orderQueries";
import OrderOverdueBanner from "./OrderOverdueBanner";
import CancellationReasonCallout from "./CancellationReasonCallout";
import CollapsibleSubcard from "@/components/modules/CollapsibleSubcard";
import OrderItemsReadOnlyList from "./OrderItemsReadOnlyList";
import OrderHistoryCard from "./OrderHistoryCard";
import OrderPrivateNoteCard from "./OrderPrivateNoteCard";
import OrderActionsCard from "./OrderActionsCard";
import OrderDetailClient from "./OrderDetailClient";

type OrderDetailContentProps = {
  order: OrderDetailFull;
  locale: string;
  baseCurrencyCode: string | null;
  backHref?: string | null;
  detailHref: string;
  /** The store's debt in this order's currency, read server-side (§ store-level payments). Only
      surfaced by the hero when this order itself has nothing allocated to it yet. */
  storeDebtMinor: number;
  /** The collector's IANA timezone, or `null` when none is stored (resolution falls back to UTC). */
  timeZone: string | null;
};

function formatDate(date: Date, locale: string) {
  return formatDomainDate(date, locale);
}

export default async function OrderDetailContent({
  order,
  locale,
  baseCurrencyCode,
  backHref,
  storeDebtMinor,
  timeZone,
}: OrderDetailContentProps) {
  const t = await getTranslations({ locale, namespace: "orders" });

  const isCancelled = order.status === "CANCELLED";
  // Products the quick-arrival flow can close: the same eligibility the delivery wizard uses
  // (nothing already in transit or delivered).
  const quickArrivalItems = order.items
    .filter((item) => isItemEligibleForDelivery(item.deliveryState))
    .map((item) => ({ id: item.id, name: item.name }));
  // See `QuickArrivalModal.settledItemCount`: the modal states what it left out.
  const settledItemCount = order.items.length - quickArrivalItems.length;
  // One condition behind every delivery affordance on this page (aside card, sticky bar, products
  // list): there has to be a product a delivery could still take.
  const canCreateDelivery = !isCancelled && quickArrivalItems.length > 0;
  // The collector's CIVIL day, never a wall-clock instant: `expectedDeliveryTo` is a calendar day
  // stored at UTC midnight, and comparing an instant against it read "atrasado" from 19:00 in Lima.
  // Same helper, same resolution as the orders list this page is opened from.
  const today = getTodayStart(new Date(), timeZone);
  // Now asks `isOrderOverdue` instead of re-deciding locally, which closes two gaps at once. It
  // used to read `order.expectedDeliveryTo` directly, so an order whose window is open at its start
  // ("a partir del 15", `to` null) was flagged by the list, the dashboard and the "Entrega
  // atrasada" filter and raised no banner here — the fourth place `resolveOrderArrivalDueDate` was
  // written to unify, still not asking. And it knew nothing about the products: an order whose only
  // product was already on the shelf opened with a `role="alert"` banner counting a delay directly
  // above that product's own "Listo en tienda" pill.
  const isOverdue = isOrderOverdue(order, today);
  // One definition of "how many whole days past its due date", shared with both list surfaces. The
  // local copy this replaces floored the count at 1, so an order due TODAY read "Atrasado 1 día".
  const overdueDays = isOverdue ? getOverdueDays(resolveOrderArrivalDueDate(order), today) : 0;

  const backTarget = backHref ?? `/${locale}${ROUTES.orders}`;
  // The date the banner states has to be the date the count was made against, or the two disagree
  // on a window that is open at its start: `getOverdueDays` measures from the resolved due date
  // while this label read `expectedDeliveryTo`, which is exactly the null the resolver falls back
  // from, leaving "Atrasado 40 días · Estimado el " with nothing after it.
  const dueDate = resolveOrderArrivalDueDate(order);
  const expectedToLabel = dueDate ? formatDate(dueDate, locale) : "";

  return (
    <>
      <BackNavLink
        href={backTarget}
        // Tight gap to the overdue banner below when present; otherwise full mb-4 to
        // separate from the hero.
        className={isOverdue ? "mb-3" : "mb-4"}
      >
        {t("detail.backToList")}
      </BackNavLink>

      {isOverdue && (
        <OrderOverdueBanner overdueDays={overdueDays} expectedDeliveryToLabel={expectedToLabel} locale={locale} />
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
        {/* Client coordinator renders BOTH the main column (hero + extras) and the aside
            column. Hero is owned by the client so amount + progress animate in lockstep with
            payment mutations; the rest of the main column (cancellation callout, productos,
            history) is passed as `mainColumnExtras` so server-rendered subcards stay outside
            the client boundary. */}
        <OrderDetailClient
          order={{
            id: order.id,
            humanReadableId: order.humanReadableId,
            store: order.store,
            storeName: order.store.name,
            totalCost: order.totalCost,
            status: order.status,
            currencyCode: order.currencyCode,
            exchangeRate: order.exchangeRate,
            needsExchangeRateUpdate: order.needsExchangeRateUpdate,
            orderDate: order.orderDate,
            expectedDeliveryFrom: order.expectedDeliveryFrom,
            expectedDeliveryTo: order.expectedDeliveryTo,
            note: order.note,
            updatedAt: order.updatedAt,
            initialPayments: order.payments,
            eligibility: order.eligibility,
            flags: order.flags,
            // The price and what each product already holds travel with the name: the payment
            // breakdown weighs the proportional split by the first and ceilings each line with the
            // second, and `getOrderDetail` already projects both, so narrowing them here would
            // cost a second query to read back what this map just dropped.
            items: order.items.map((item) => ({
              id: item.id,
              name: item.name,
              paidDeclared: item.paidDeclared,
              basePagableMinor: item.basePagableMinor,
              allocatedMinor: item.allocatedMinor,
            })),
            undetailedPaidMinor: order.undetailedPaidMinor,
          }}
          isOverdue={isOverdue}
          overdueDays={overdueDays}
          locale={locale}
          storeDebtMinor={storeDebtMinor}
          quickArrivalItems={quickArrivalItems}
          settledItemCount={settledItemCount}
          canCreateDelivery={canCreateDelivery}
          baseCurrencyCode={baseCurrencyCode}
          mainColumnExtras={
            <>
              {isCancelled && order.cancellationReason && (
                <CancellationReasonCallout reason={order.cancellationReason} locale={locale} />
              )}

              {/* Productos — collapsible like Historial. Header title is inverted vs demo:
                  `{count} productos` (count first) reads more naturally than `PRODUCTOS 7`.
                  When cancelled we dim ONLY the body (not the eyebrow / count / chevron)
                  per demo `s7-order-detail-cancelled` `.subcard-body-inner{opacity:0.6}`. */}
              <CollapsibleSubcard
                eyebrow={
                  <Eyebrow variant="chip" tone="cool" icon={Boxes}>
                    {t("detail.items.headerCount", { count: order.items.length })}
                  </Eyebrow>
                }
                topAccent="cool"
                defaultOpen
                bodyClassName={isCancelled ? "opacity-60" : undefined}
              >
                <OrderItemsReadOnlyList
                  orderId={order.id}
                  items={order.items}
                  currencyCode={order.currencyCode}
                  locale={locale}
                  isOrderCancelled={isCancelled}
                  showCreateDeliveryLink={canCreateDelivery}
                  totalCost={order.totalCost}
                  allocatedAmountMinor={order.paidAmount}
                  undetailedPaidMinor={order.undetailedPaidMinor}
                />
              </CollapsibleSubcard>

              {/* Desktop only: history collapsible at the bottom of main column */}
              <div className="hidden lg:block">
                <OrderHistoryCard history={order.history} locale={locale} isCancelled={isCancelled} />
              </div>
            </>
          }
          actionsCard={
            <OrderActionsCard
              orderId={order.id}
              humanReadableId={order.humanReadableId}
              storeName={order.store.name}
              storeSlug={order.store.slug}
              status={order.status}
              eligibility={order.eligibility}
              paidAmountMinor={order.paidAmount}
              currencyCode={order.currencyCode}
              hasPayments={order.flags.hasPayments}
              markedItemCount={order.items.filter((item) => item.paidDeclared).length}
              locale={locale}
              quickArrivalItems={quickArrivalItems}
              settledItemCount={settledItemCount}
              baseCurrencyCode={baseCurrencyCode}
            />
          }
          noteCard={
            <OrderPrivateNoteCard
              orderId={order.id}
              initialNote={order.note}
              initialUpdatedAt={order.note ? order.updatedAt : null}
              locale={locale}
            />
          }
        />
      </div>
    </>
  );
}

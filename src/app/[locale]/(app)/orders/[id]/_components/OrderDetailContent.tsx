import { Boxes } from "lucide-react";
import { getTranslations } from "next-intl/server";
import BackNavLink from "@/components/core/BackNavLink";
import Eyebrow from "@/components/core/Eyebrow";
import { ROUTES } from "@/lib/constants";
import { formatDomainDate } from "@/lib/domainDate";
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
};

function formatDate(date: Date, locale: string) {
  return formatDomainDate(date, locale);
}

export default async function OrderDetailContent({ order, locale, backHref }: OrderDetailContentProps) {
  const t = await getTranslations({ locale, namespace: "orders" });

  const isCancelled = order.status === "CANCELLED";
  const isCompleted = order.status === "COMPLETED";
  const today = new Date();
  const isOverdue =
    !isCancelled && !isCompleted && order.expectedDeliveryTo !== null && order.expectedDeliveryTo < today;
  const overdueDays =
    isOverdue && order.expectedDeliveryTo
      ? Math.max(1, Math.ceil((today.getTime() - order.expectedDeliveryTo.getTime()) / 86_400_000))
      : 0;

  const backTarget = backHref ?? `/${locale}${ROUTES.orders}`;
  const expectedToLabel = order.expectedDeliveryTo ? formatDate(order.expectedDeliveryTo, locale) : "";

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
            orderDate: order.orderDate,
            expectedDeliveryFrom: order.expectedDeliveryFrom,
            expectedDeliveryTo: order.expectedDeliveryTo,
            note: order.note,
            updatedAt: order.updatedAt,
            initialPayments: order.payments,
            eligibility: order.eligibility,
            flags: order.flags,
          }}
          isOverdue={isOverdue}
          overdueDays={overdueDays}
          locale={locale}
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
                  showCreateDeliveryLink={!isCancelled}
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
              status={order.status}
              eligibility={order.eligibility}
              locale={locale}
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

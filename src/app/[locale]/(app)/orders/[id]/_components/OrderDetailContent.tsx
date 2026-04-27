import { calculatePaymentSummary } from "@/lib/orders/paymentSummary";
import { deriveHasUnpaidBalance } from "@/lib/orders/orderState";
import type { OrderDetailFull } from "@/lib/data/orders/orderQueries";
import SetHeaderTitle from "@/app/[locale]/(app)/_components/AppLayout/SetHeaderTitle";
import OrderSummaryHeader from "./OrderSummaryHeader";
import OrderItemsList from "./OrderItemsList";
import OrderHistoryList from "./OrderHistoryList";
import OrderNoteForm from "./OrderNoteForm";
import OrderPaymentsPanel from "./OrderPaymentsPanel";

type OrderDetailContentProps = {
  order: OrderDetailFull;
  locale: string;
  baseCurrencyCode: string | null;
  backHref?: string | null;
  detailHref: string;
};

export default function OrderDetailContent({
  order,
  locale,
  baseCurrencyCode,
  backHref,
  detailHref,
}: OrderDetailContentProps) {
  const summary = calculatePaymentSummary(order.totalCost, order.payments);
  const hasUnpaidBalance = deriveHasUnpaidBalance(order.totalCost, summary.paidAmount);

  return (
    <div className="space-y-8">
      <SetHeaderTitle title={order.humanReadableId} />
      <OrderSummaryHeader
        order={{
          id: order.id,
          humanReadableId: order.humanReadableId,
          store: order.store,
          orderDate: order.orderDate,
          expectedDeliveryFrom: order.expectedDeliveryFrom,
          expectedDeliveryTo: order.expectedDeliveryTo,
          currencyCode: order.currencyCode,
          exchangeRate: order.exchangeRate,
          status: order.status,
          hasUnpaidBalance,
          eligibility: order.eligibility,
          flags: order.flags,
        }}
        locale={locale}
        baseCurrencyCode={baseCurrencyCode}
        backHref={backHref}
        detailHref={detailHref}
      />

      {/* Mobile: flex column with explicit order so the visual sequence is
          items → payments → note → history. Desktop: 2-column grid where the
          right wrapper groups payments + history into a single sticky block. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-8">
        {/* Right column on desktop. `contents` on mobile dissolves the wrapper
            so its children become direct flex items of the outer container. */}
        <div className="contents lg:sticky lg:top-[calc(var(--app-banner-offset,0px)+3.5rem+2rem)] lg:col-start-2 lg:row-start-1 lg:block lg:space-y-6">
          <div className="order-2 lg:order-none">
            <OrderPaymentsPanel
              orderId={order.id}
              totalCost={order.totalCost}
              initialPayments={order.payments}
              initialSummary={summary}
              hasUnpaidBalance={hasUnpaidBalance}
              status={order.status}
              currencyCode={order.currencyCode}
              orderDate={order.orderDate}
              locale={locale}
            />
          </div>
          <div className="order-4 lg:order-none">
            <OrderHistoryList initialHistory={order.history} locale={locale} />
          </div>
        </div>

        {/* Left column on desktop, also dissolved on mobile via `contents`. */}
        <div className="contents lg:col-start-1 lg:row-start-1 lg:block lg:max-w-3xl lg:space-y-6">
          <div className="order-1 lg:order-none">
            <OrderItemsList orderId={order.id} items={order.items} currencyCode={order.currencyCode} locale={locale} />
          </div>
          <div className="order-3 lg:order-none">
            <OrderNoteForm
              orderId={order.id}
              initialNote={order.note}
              initialUpdatedAt={order.note ? order.updatedAt : null}
              locale={locale}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

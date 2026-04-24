import { calculatePaymentSummary } from "@/lib/orders/paymentSummary";
import { deriveHasUnpaidBalance } from "@/lib/orders/orderState";
import type { OrderDetailFull } from "@/lib/data/orders/orderQueries";
import OrderSummaryHeader from "./OrderSummaryHeader";
import OrderItemsList from "./OrderItemsList";
import OrderHistoryList from "./OrderHistoryList";
import OrderNoteForm from "./OrderNoteForm";
import OrderPaymentsPanel from "./OrderPaymentsPanel";

type OrderDetailContentProps = {
  order: OrderDetailFull;
  locale: string;
  baseCurrencyCode: string | null;
};

export default function OrderDetailContent({ order, locale, baseCurrencyCode }: OrderDetailContentProps) {
  const summary = calculatePaymentSummary(order.totalCost, order.payments);
  const hasUnpaidBalance = deriveHasUnpaidBalance(order.totalCost, summary.paidAmount);

  return (
    <div className="space-y-8">
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
      />

      {/* Two-column layout: left = items + note + history; right = payments */}
      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-8">
        {/* Left column */}
        <div className="space-y-8">
          <OrderItemsList orderId={order.id} items={order.items} currencyCode={order.currencyCode} locale={locale} />
          <OrderNoteForm orderId={order.id} initialNote={order.note} locale={locale} />
          <OrderHistoryList orderId={order.id} initialHistory={order.history} locale={locale} />
        </div>

        {/* Right column (sticky on lg+) */}
        <div className="mt-8 lg:sticky lg:top-[calc(var(--app-banner-offset,0px)+3.5rem+2rem)] lg:mt-0">
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
      </div>
    </div>
  );
}

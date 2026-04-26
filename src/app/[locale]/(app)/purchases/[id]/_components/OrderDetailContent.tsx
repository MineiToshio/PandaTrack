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

      {/* Two-column layout: right column (payments) appears first on mobile for quick access;
          explicit col/row placement restores left=items, right=payments on lg+ */}
      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-8">
        {/* Right column — first on mobile, second column on desktop */}
        <div className="mb-6 space-y-6 lg:sticky lg:top-[calc(var(--app-banner-offset,0px)+3.5rem+2rem)] lg:col-start-2 lg:row-start-1 lg:mb-0">
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
          <OrderHistoryList initialHistory={order.history} locale={locale} />
        </div>

        {/* Left column — second on mobile, first column on desktop */}
        <div className="max-w-3xl space-y-6 lg:col-start-1 lg:row-start-1">
          <OrderItemsList orderId={order.id} items={order.items} currencyCode={order.currencyCode} locale={locale} />
          <OrderNoteForm orderId={order.id} initialNote={order.note} locale={locale} />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToast } from "@/contexts/ToastContext";
import { calculatePaymentSummary } from "@/lib/orders/paymentSummary";
import { resolveOrderMarkReconciliation } from "@/lib/orders/productPaymentState";
import { deriveHasUnpaidBalance } from "@/lib/orders/orderState";
import { formatAmountSymbolOnly } from "@/lib/currency";
import type { OrderEligibility, OrderFlags } from "@/lib/data/orders/orderQueries";
import type { OrderStatus, StoreRemovalReason, StoreStatus } from "../../../../../../../generated/prisma/client";
import { addPaymentAction, deletePaymentAction } from "../_actions/orderPaymentActions";
import OrderDetailHero from "./OrderDetailHero";
import OrderPaymentsAsideCard, { type OrderPaymentsAsideCardHandle } from "./OrderPaymentsAsideCard";
import OrderDetailStickyActionBar, { hasStickyBarActions } from "./OrderDetailStickyActionBar";
import OrderMobileActionsCard from "./OrderMobileActionsCard";
import OrderPaymentMobileSheet from "./OrderPaymentMobileSheet";
import type { OrderInlinePaymentOutcome, OrderInlinePaymentSubmission } from "./OrderInlinePaymentForm";
import type { BreakdownItem } from "@/lib/orders/orderPaymentBreakdown";
import OrderCancelModal from "./OrderCancelModal";
import OrderDeleteModal from "./OrderDeleteModal";
import { QuickArrivalModal, type QuickArrivalItem } from "@/components/modules/QuickArrival";
import { useQuickArrival } from "@/components/modules/QuickArrival/useQuickArrival";

/**
 * A payment as this order sees it: one TRANSFER, carrying this order's total claim on it plus the
 * payment's own id/total/shared flag, so the aside card and its delete-confirm modal can describe
 * the shared case without a second query. Mirrors `OrderPaymentRecord` (see
 * `orderPaymentAllocations.ts`), where `id` is the payment id because that is what an order-scoped
 * delete acts on.
 */
type PaymentRecord = {
  id: string;
  amount: number;
  paymentDate: Date;
  paymentId: string;
  paymentTotalMinor: number;
  isShared: boolean;
  isPartialClaim: boolean;
  /** Products of this order the transfer names. `0` = it sits on the order as a whole. */
  detailedLineCount: number;
};
type Store = {
  id: string;
  name: string;
  slug: string;
  status: StoreStatus;
  removalReason: StoreRemovalReason | null;
  logoUrl: string | null;
};

type OrderDetailClientProps = {
  order: {
    id: string;
    humanReadableId: string;
    store: Store;
    storeName: string;
    totalCost: number;
    status: OrderStatus;
    currencyCode: string;
    exchangeRate: number | null;
    needsExchangeRateUpdate: boolean;
    orderDate: Date;
    expectedDeliveryFrom: Date | null;
    expectedDeliveryTo: Date | null;
    note: string | null;
    updatedAt: Date;
    initialPayments: PaymentRecord[];
    eligibility: OrderEligibility;
    flags: OrderFlags;
    /**
     * Every product of this order, marks included. The coverage axis counts over ALL of them, and
     * the payment breakdown needs two more facts per product: its price (the weight of the
     * proportional split) and what earlier payments already declared against it (its ceiling).
     */
    items: Array<{
      id: string;
      name: string;
      paidDeclared: boolean;
      basePagableMinor: number | null;
      allocatedMinor: number;
    }>;
    /** Money declared against this order without naming a product. */
    undetailedPaidMinor: number;
  };
  isOverdue: boolean;
  overdueDays: number;
  locale: string;
  /** The store's debt in this order's currency, read server-side. Surfaced by the hero only when
      this order has nothing allocated to it yet. */
  storeDebtMinor: number;
  /** Products still eligible for a delivery; an empty list hides the quick-arrival action. */
  quickArrivalItems: QuickArrivalItem[];
  /** Forwarded to `QuickArrivalModal`; see its own prop. */
  settledItemCount?: number;
  /** False once no product can join a new delivery, which retires every delivery affordance. */
  canCreateDelivery: boolean;
  baseCurrencyCode: string | null;
  /** Main-column content rendered directly under the hero (cancellation callout, productos, history). */
  mainColumnExtras: ReactNode;
  actionsCard: ReactNode;
  noteCard: ReactNode;
};

/**
 * Coordinator for the order detail's interactive surface. Owns the live `payments` array so
 * the hero (amount + progress bar + meta line), the payments aside card, the sticky action
 * bar, and the mobile sheet all read from the same source of truth and animate in lockstep
 * after every add/delete.
 *
 * Optimistic update strategy: every mutation patches `payments` locally before awaiting the
 * server action, and rolls back if the action fails. `router.refresh()` is fired on success
 * to keep server-rendered siblings (status chips, history, badges) in sync.
 */
export default function OrderDetailClient({
  order,
  isOverdue,
  overdueDays,
  locale,
  storeDebtMinor,
  quickArrivalItems,
  settledItemCount,
  canCreateDelivery,
  baseCurrencyCode,
  mainColumnExtras,
  actionsCard,
  noteCard,
}: OrderDetailClientProps) {
  const router = useRouter();
  const t = useTranslations("orders");
  const { addToast } = useToast();
  const asideRef = useRef<OrderPaymentsAsideCardHandle>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>(order.initialPayments);
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [mobileModal, setMobileModal] = useState<"cancel" | "delete" | null>(null);
  const quickArrival = useQuickArrival({ orderId: order.id, locale, source: "mobile_actions" });
  const canQuickArrive = order.status !== "CANCELLED" && quickArrivalItems.length > 0;

  // Keep the live payments list in sync with the server whenever `router.refresh()` delivers a
  // genuinely new list — e.g. after cancelling with "remove payments", where the server drops the
  // ledger but the optimistic add/delete flow would otherwise leave this client state stale (the
  // panel would keep showing the removed amount as "lost" until a full reload). Keyed on a stable
  // signature of the server list so it fires only on real server changes, never clobbering an
  // in-flight optimistic mutation (which reconciles local state before it calls refresh()).
  const serverPaymentsSignature = order.initialPayments
    .map((p) => `${p.id}:${p.amount}:${p.paymentDate.getTime()}`)
    .join("|");
  const lastServerSignatureRef = useRef(serverPaymentsSignature);
  useEffect(() => {
    if (serverPaymentsSignature !== lastServerSignatureRef.current) {
      lastServerSignatureRef.current = serverPaymentsSignature;
      setPayments(order.initialPayments);
    }
  }, [serverPaymentsSignature, order.initialPayments]);

  // Derived state — recomputed every render so the hero animates whenever `payments` changes.
  const summary = useMemo(() => calculatePaymentSummary(order.totalCost, payments), [order.totalCost, payments]);
  const hasUnpaidBalance = useMemo(
    () => deriveHasUnpaidBalance(order.totalCost, summary.paidAmount),
    [order.totalCost, summary.paidAmount],
  );

  // Same predicate the bar itself applies, so the spacer never outlives the bar.
  const showStickyBar = hasStickyBarActions({
    status: order.status,
    hasUnpaidBalance,
    remainingAmount: summary.remainingAmount,
    canCreateDelivery,
  });

  const isMobileBreakpoint = () => typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;

  function handleAnnotatePayment() {
    if (isMobileBreakpoint()) {
      setPaySheetOpen(true);
    } else {
      asideRef.current?.openForm();
    }
  }

  /**
   * Optimistic-confirmation pattern: optimistically patch the local payments list (so the
   * hero amount + progress bar animate immediately), fire the server action in the
   * background, then either reconcile with the server response or roll back + surface a
   * toast on failure. The mobile sheet uses this fire-and-forget so the sheet closes
   * before the server responds — the user sees the bar fill in lockstep with the sheet
   * dismissal instead of staring at a spinner.
   */
  /** The order's products in the shape the payment breakdown speaks: name, price, what it holds. */
  const breakdownItems = useMemo<BreakdownItem[]>(
    () =>
      order.items.map((item) => ({
        itemId: item.id,
        name: item.name,
        basePagableMinor: item.basePagableMinor,
        allocatedMinor: item.allocatedMinor,
        paidDeclared: item.paidDeclared,
      })),
    [order.items],
  );

  const markReconciliation = resolveOrderMarkReconciliation({
    items: order.items,
    totalCost: order.totalCost,
    allocatedAmountMinor: summary.paidAmount,
  });

  /**
   * Turns a refusal into the sentence that names what actually happened.
   *
   * `STORE_DEBT_EXCEEDED` used to be flattened into `EXCEEDS_BALANCE` on the server, so the
   * collector was told the amount exceeded THIS ORDER's balance when the real ceiling was what they
   * still owe the store across every order. Two different facts and two different next steps.
   */
  /**
   * The one refusal the FORM cannot word for itself: it names the store and the debt across every
   * order with it, and the form is scoped to this order and holds neither figure. It reaches the
   * form through the outcome's `message` rather than through two surfaces' worth of props.
   */
  function describeStoreDebtExceeded(): string {
    return t("detail.payments.storeDebtExceeded", {
      store: order.storeName,
      debt: formatAmountSymbolOnly(Math.max(0, storeDebtMinor), order.currencyCode, locale),
    });
  }

  function describeAddPaymentError(error: string): string {
    switch (error) {
      case "EXCEEDS_BALANCE":
        return t("detail.payments.amountExceedsBalance", {
          remaining: formatAmountSymbolOnly(summary.remainingAmount, order.currencyCode, locale),
        });
      case "STORE_DEBT_EXCEEDED":
        return describeStoreDebtExceeded();
      case "DATE_BEFORE_ORDER":
        return t("detail.payments.dateBeforeOrder");
      default:
        return t("detail.payments.errorAdd");
    }
  }

  async function handleAddPayment({
    amount,
    paymentDate,
    allocations,
    splitMode,
    awaitsVerdict,
  }: OrderInlinePaymentSubmission): Promise<OrderInlinePaymentOutcome> {
    const tempId = `temp-${Date.now()}`;
    // Optimistic stand-in reads as its own 1:1 payment (not shared) until the server reconciles
    // it with the real allocation — a brand-new payment can never already be sharing with another
    // order at the instant it is created.
    const optimistic: PaymentRecord = {
      id: tempId,
      amount,
      paymentDate,
      paymentId: tempId,
      paymentTotalMinor: amount,
      isShared: false,
      isPartialClaim: false,
      // The stand-in is ONE row whatever the breakdown says, because the order's ledger groups by
      // transfer: a payment split across three products is still one thing the collector paid.
      detailedLineCount: allocations.length,
    };
    const previous = payments;
    setPayments([...payments, optimistic]);

    /**
     * The action is awaited inside a `try`, and that is not defensive tidying.
     *
     * A transport failure rejects this promise. Unguarded it propagates through the form's own
     * `await onSubmit(...)`, which leaves `isPending` stuck at `true` forever: on mobile that is an
     * undismissable sheet with the whole breakdown draft trapped inside it. Nothing was refused
     * here, so the outcome says exactly that (`unanswered`) and the form keeps the CTA live for an
     * identical resend rather than shutting it on a verdict that never came.
     */
    let result: Awaited<ReturnType<typeof addPaymentAction>>;
    try {
      result = await addPaymentAction(order.id, amount, paymentDate, allocations, splitMode);
    } catch {
      setPayments(previous);
      if (!awaitsVerdict) addToast(t("detail.payments.errorUnanswered"), { variant: "error" });
      return { ok: false as const, unanswered: true };
    }

    if (!result.ok) {
      setPayments(previous); // rollback to pre-optimistic state
      // ONE rule for where a refusal is painted: the form's inline error is authoritative, and this
      // toast fires only when the form is already gone. The mobile surface is a `<Modal>` and the
      // toast renders behind it, so a live sheet told through a toast is a sheet told nothing.
      if (!awaitsVerdict) addToast(describeAddPaymentError(result.error), { variant: "error" });
      return {
        ok: false as const,
        error: result.error,
        orderItemId: result.orderItemId,
        message: result.error === "STORE_DEBT_EXCEEDED" ? describeStoreDebtExceeded() : undefined,
      };
    }

    // Reconcile with the authoritative list returned by the server (ids, ordering, dates).
    setPayments(result.payments);
    // The milestone is the ORDER, not the instalment: one toast when the last centavo lands, and
    // silence on every partial payment, where the bar moving already is the answer. Read off the
    // server's own figure so a refused payment can never congratulate anyone.
    if (summary.paidAmount < order.totalCost && result.paidAmount >= order.totalCost) {
      addToast(t("detail.payments.paidInFullToast"), { variant: "success" });
    }
    router.refresh();
    return { ok: true as const };
  }

  async function handleDeletePayment(paymentId: string) {
    const previous = payments;
    setPayments(payments.filter((p) => p.id !== paymentId));

    const result = await deletePaymentAction(paymentId, order.id);
    if (!result.ok) {
      setPayments(previous); // rollback
      return { ok: false as const, error: result.error };
    }

    setPayments(result.payments);
    router.refresh();
    return { ok: true as const };
  }

  return (
    <>
      {/* Main column wrapper — hero is rendered here (not in the server parent) so it can
          subscribe to live payments state and animate amount + progress on every mutation.
          The 16px gap below the hero matches demo `<div style="margin-top:16px;">`. */}
      <div className="space-y-4 lg:col-start-1 lg:row-start-1">
        <OrderDetailHero
          order={{
            id: order.id,
            humanReadableId: order.humanReadableId,
            store: order.store,
            orderDate: order.orderDate,
            expectedDeliveryFrom: order.expectedDeliveryFrom,
            expectedDeliveryTo: order.expectedDeliveryTo,
            currencyCode: order.currencyCode,
            exchangeRate: order.exchangeRate,
            needsExchangeRateUpdate: order.needsExchangeRateUpdate,
            totalCost: order.totalCost,
            status: order.status,
          }}
          allocatedAmountMinor={summary.paidAmount}
          hasUnpaidBalance={hasUnpaidBalance}
          isOverdue={isOverdue}
          overdueDays={overdueDays}
          storeDebtMinor={storeDebtMinor}
          locale={locale}
        />
        {mainColumnExtras}
      </div>

      {/* Aside column desktop: payments aside (sticky) + actions + note */}
      {/* Aside cards gap: demo uses inline `margin-top:14px` between consecutive `.card.elevated`
          (CSS lines around `#s7-order-detail-active`). 14px = `space-y-3.5` in Tailwind. */}
      <div className="hidden lg:sticky lg:top-[calc(var(--app-banner-offset,0px)+3.5rem+2rem)] lg:col-start-2 lg:row-start-1 lg:block lg:space-y-3.5">
        <OrderPaymentsAsideCard
          ref={asideRef}
          payments={payments}
          summary={summary}
          hasUnpaidBalance={hasUnpaidBalance}
          status={order.status}
          isOverdue={isOverdue}
          currencyCode={order.currencyCode}
          orderDate={order.orderDate}
          locale={locale}
          storeName={order.storeName}
          storeSlug={order.store.slug}
          undetailedPaidMinor={order.undetailedPaidMinor}
          breakdownItems={breakdownItems}
          totalCost={order.totalCost}
          markReconciliation={markReconciliation}
          onAddPayment={handleAddPayment}
          onDeletePayment={handleDeletePayment}
        />
        {actionsCard}
        {noteCard}
      </div>

      {/* Mobile inline: payments aside (re-used non-sticky, no internal CTA — sticky bar is
          the single source of truth per spec §5.8), note, then actions card. */}
      <div className="mt-5 space-y-3.5 lg:hidden">
        <OrderPaymentsAsideCard
          payments={payments}
          summary={summary}
          hasUnpaidBalance={hasUnpaidBalance}
          status={order.status}
          isOverdue={isOverdue}
          currencyCode={order.currencyCode}
          orderDate={order.orderDate}
          locale={locale}
          storeName={order.storeName}
          storeSlug={order.store.slug}
          undetailedPaidMinor={order.undetailedPaidMinor}
          breakdownItems={breakdownItems}
          totalCost={order.totalCost}
          markReconciliation={markReconciliation}
          onAddPayment={handleAddPayment}
          onDeletePayment={handleDeletePayment}
          showAddCta={false}
        />
        {noteCard}
        <OrderMobileActionsCard
          orderId={order.id}
          locale={locale}
          status={order.status}
          eligibility={order.eligibility}
          canQuickArrive={canQuickArrive}
          onQuickArrival={quickArrival.open}
          onCancel={() => setMobileModal("cancel")}
          onDelete={() => setMobileModal("delete")}
        />
      </div>

      {/* Reserve scroll space so the sticky bar never covers the last content row — but only
          while there is a bar to clear. */}
      {showStickyBar && (
        <div className="lg:hidden" style={{ height: "calc(76px + env(safe-area-inset-bottom))" }} aria-hidden />
      )}

      <OrderDetailStickyActionBar
        orderId={order.id}
        status={order.status}
        isOverdue={isOverdue}
        remainingAmount={summary.remainingAmount}
        allocatedAmountMinor={summary.paidAmount}
        currencyCode={order.currencyCode}
        hasUnpaidBalance={hasUnpaidBalance}
        canCreateDelivery={canCreateDelivery}
        locale={locale}
        onAnnotatePayment={handleAnnotatePayment}
      />

      <OrderPaymentMobileSheet
        isOpen={paySheetOpen}
        onClose={() => setPaySheetOpen(false)}
        orderId={order.id}
        currencyCode={order.currencyCode}
        remainingAmount={summary.remainingAmount}
        orderDate={order.orderDate}
        locale={locale}
        breakdownItems={breakdownItems}
        totalCost={order.totalCost}
        undetailedPaidMinor={order.undetailedPaidMinor}
        onSubmit={handleAddPayment}
      />

      <OrderCancelModal
        isOpen={mobileModal === "cancel"}
        onClose={() => setMobileModal(null)}
        orderId={order.id}
        humanReadableId={order.humanReadableId}
        storeName={order.storeName}
        paidAmountMinor={summary.paidAmount}
        currencyCode={order.currencyCode}
        hasPayments={payments.length > 0}
        markedItemCount={markReconciliation.markedCount}
        onSuccess={() => {
          setMobileModal(null);
          router.refresh();
        }}
      />
      <OrderDeleteModal
        isOpen={mobileModal === "delete"}
        onClose={() => setMobileModal(null)}
        orderId={order.id}
        humanReadableId={order.humanReadableId}
        storeName={order.storeName}
        locale={locale}
      />

      {/* Mobile instance of the quick-arrival modal; the desktop aside card owns its own,
          mirroring how cancel + delete are already duplicated across the two action surfaces. */}
      {canQuickArrive && (
        <QuickArrivalModal
          isOpen={quickArrival.isOpen}
          onClose={quickArrival.close}
          subtitle={`${order.humanReadableId} · ${order.storeName}`}
          items={quickArrivalItems}
          settledItemCount={settledItemCount}
          baseCurrencyCode={baseCurrencyCode}
          locale={locale}
          onSubmit={quickArrival.submit}
        />
      )}
    </>
  );
}

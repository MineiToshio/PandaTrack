"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToast, NEUTRAL_UNDO_DURATION_MS } from "@/contexts/ToastContext";
import { ROUTES } from "@/lib/constants";
import type { DeliveryStatus } from "../../../../../../../generated/prisma/client";
import type { DeliveryDetail } from "@/lib/data/deliveries/deliveryQueries";
import type { RevertedStorePaymentSnapshot } from "@/lib/data/deliveries/deliveryMutations";
import { cancelDeliveryAction, markDeliveredAction, reopenDeliveryAction } from "../_actions/deliveryLifecycleActions";
import { retrySettlementAction, undoReopenAction } from "@/app/[locale]/(app)/_actions/settlementActions";
import { domainDateToIsoString } from "@/lib/domainDate";
import {
  clearPendingSettlement,
  formatSettledTotals,
  readPendingSettlement,
  writePendingSettlement,
  type PendingSettlementEntry,
} from "@/lib/deliveries/pendingSettlementStore";
import DeliveryDetailHero from "./DeliveryDetailHero";
import DeliveryProductsCard from "./DeliveryProductsCard";
import DeliverySummaryCard from "./DeliverySummaryCard";
import DeliveryActionsCard from "./DeliveryActionsCard";
import DeliveryStickyActionBar from "./DeliveryStickyActionBar";
import DeliveryActionsSheet from "./DeliveryActionsSheet";
import MarkDeliveredModal from "./MarkDeliveredModal";
import DeliveryCancelModal from "./DeliveryCancelModal";
import DeliveryDeleteModal from "./DeliveryDeleteModal";

type LifecycleSnapshot = {
  status: DeliveryStatus;
  receivedDate: Date | null;
  /** Settlement payments a reopen just reverted (`WO-08`), so "Deshacer" can restore them verbatim
      rather than recomputing a new settlement. Empty when this delivery never produced one. */
  revertedSettlementPayments: RevertedStorePaymentSnapshot[];
};

type DeliveryDetailClientProps = {
  delivery: DeliveryDetail;
  baseCurrencyCode: string | null;
  locale: string;
  /** The collector's civil day, resolved on the server so the hero's lateness matches the list's. */
  today: Date;
  /** Server-wrapped note card (autosave is independent from the lifecycle state). */
  noteCard: ReactNode;
};

/** Undo window for the reopen neutral-undo toast (ADR 0001 D4) — light reversible (5s). */
const UNDO_TOAST_DURATION_MS = NEUTRAL_UNDO_DURATION_MS;

/**
 * Coordinator for the delivery detail. Owns the live `status` + `receivedDate` pair so the
 * hero, status chips, per-item state pills, summary rows, actions matrix, and the mobile
 * sticky bar all read the same optimistic source of truth.
 *
 * Optimistic strategy (optimistic-client-updates.mdc):
 *  - markDelivered / cancel: Optimistic Confirmation — the modal dispatches + closes
 *    synchronously; this coordinator applies the patch, rolls back on failure, and
 *    surfaces the failure toast.
 *  - reopen (S9-D3): no modal — executes directly with a neutral-undo toast ("Deshacer"
 *    or the `Z` key restores the previous state via the inverse mutation).
 *  - delete: awaited inside the modal (permitted exception — irreversible destructive).
 */
export default function DeliveryDetailClient({
  delivery,
  baseCurrencyCode,
  locale,
  today,
  noteCard,
}: DeliveryDetailClientProps) {
  const router = useRouter();
  const t = useTranslations("deliveries");
  const { addToast } = useToast();

  const [status, setStatus] = useState<DeliveryStatus>(delivery.status);
  const [receivedDate, setReceivedDate] = useState<Date | null>(delivery.receivedDate);
  const [modal, setModal] = useState<"markDelivered" | "cancel" | "delete" | null>(null);
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  // A pending money-transaction retry (`WO-08`, `FR-08-42`): persisted in `pendingSettlementStore`
  // so the affordance survives navigation. `null` means nothing is pending for this delivery.
  const [pendingEntry, setPendingEntry] = useState<PendingSettlementEntry | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Last reopen's pre-state — consumed by the toast "Deshacer" action and the Z shortcut.
  const undoSnapshotRef = useRef<LifecycleSnapshot | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest-ref so the global key listener and the toast action never call a stale closure.
  // (Re-assigned after `handleUndoReopen` is defined, further down.)
  const undoHandlerRef = useRef<() => void>(() => {});

  useEffect(() => {
    // Hydrate after mount only: `localStorage` does not exist during SSR, and a mismatch here
    // would just flicker the Retry affordance in, never desync anything server-derived.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional client-only hydration from localStorage
    setPendingEntry(readPendingSettlement(delivery.id));
  }, [delivery.id]);

  useEffect(
    () => () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    },
    [],
  );

  // `Z` undoes the reopen while its toast window is open (ADR 0001 D4).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "z" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (!undoSnapshotRef.current) return;
      event.preventDefault();
      undoHandlerRef.current();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function snapshot(): LifecycleSnapshot {
    return { status, receivedDate, revertedSettlementPayments: [] };
  }

  function applySnapshot(prev: LifecycleSnapshot) {
    setStatus(prev.status);
    setReceivedDate(prev.receivedDate);
  }

  function clearUndoWindow() {
    undoSnapshotRef.current = null;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }

  function handleMarkDelivered(date: Date) {
    const prev = snapshot();
    setStatus("DELIVERED");
    setReceivedDate(date);
    clearUndoWindow();

    void markDeliveredAction(delivery.id, date).then((result) => {
      if (!result.ok) {
        applySnapshot(prev);
        addToast(t("detail.toast.markDeliveredError"), { variant: "error" });
        return;
      }
      // Order-close consumption (`FR-08-46`) can fail after the arrival already committed, the
      // same independent-transaction gap `WO-08` covers for the checkbox launchers. This flow
      // never enables a settlement of its own, so the retry entry carries `settleRemainder: false`
      // — only the consumption half is ever retried from here.
      if (result.moneyTransactionPending) {
        const entry: PendingSettlementEntry = {
          deliveryId: delivery.id,
          settleRemainder: false,
          // `date` is already a domain date (UTC midnight, `toDomainDate`-normalized by
          // `MarkDeliveredModal` before it ever reaches this handler): `domainDateToIsoString`
          // reads its UTC calendar day directly (MAJOR F5, 2026-08-20 review). The old
          // `toLocalIsoDateString` used local getters instead, which shifts the day backward for any
          // collector whose timezone sits west of UTC (e.g. `America/Lima`) — the exact off-box this
          // fix closes.
          settlementDate: domainDateToIsoString(date) ?? "",
          settlementIntents: [],
          createdAt: new Date().toISOString(),
        };
        writePendingSettlement(entry);
        setPendingEntry(entry);
      }
      router.refresh();
    });
  }

  function handleCancel() {
    const prev = snapshot();
    setStatus("CANCELLED");
    clearUndoWindow();

    void cancelDeliveryAction(delivery.id).then((result) => {
      if (!result.ok) {
        applySnapshot(prev);
        addToast(t("detail.toast.cancelError"), { variant: "error" });
        return;
      }
      router.refresh();
    });
  }

  async function handleReopen() {
    if (isReopening) return;
    const prev = snapshot();
    setStatus("IN_TRANSIT");
    setReceivedDate(null);
    setIsReopening(true);

    const result = await reopenDeliveryAction(delivery.id);
    setIsReopening(false);

    if (!result.ok) {
      applySnapshot(prev);
      const message =
        result.error === "PRODUCTS_IN_OTHER_DELIVERY"
          ? t("detail.toast.reopenConflict")
          : t("detail.toast.reopenError");
      addToast(message, { variant: "error" });
      return;
    }

    router.refresh();

    // MAJOR F8, 2026-08-20 review: a reopen invalidates any money-transaction retry that was still
    // pending for this delivery — the order this delivery closed is no longer closed, so there is
    // nothing left for that stale entry's `Retry` to re-attempt against (a subsequent
    // `retrySettlementAction` call would itself report `noLongerPending`, but leaving the banner up
    // until the collector clicks it to find that out is a needless dead click).
    clearPendingSettlement(delivery.id);
    setPendingEntry(null);

    // Carries the reverted settlement snapshot forward so "Deshacer" can restore it verbatim
    // (`FR-08-43`) instead of recomputing a new settlement.
    undoSnapshotRef.current = { ...prev, revertedSettlementPayments: result.revertedSettlements.payments };
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      undoSnapshotRef.current = null;
    }, UNDO_TOAST_DURATION_MS);

    // Two-amount reopen copy (`WO-08` UX Notes). The settlement half reopen just deleted is
    // nameable via `revertedSettlements.totalAmountMinor`; the amount of pre-existing unassigned
    // money this same close ALSO consumed, and that survives the reopen untouched, is nameable via
    // `revertedSettlements.survivingConsumedMinor` (its provenance is the `consumedByDeliveryId`
    // stamp `consumeUnassignedStoreMoneyOnOrderClose` writes, closing the gap this component used
    // to document here). The two figures are independent: either can be zero, positive, or both
    // positive at once, which is why each has its own currency-aware label below.
    const revertedTotal = result.revertedSettlements.totalAmountMinor;
    // Grouped by each reverted payment's OWN currency (not the delivery's shipping-cost
    // currency, which can differ): `formatSettledTotals` sums per currency and joins, exactly as
    // the arrival's own confirmation toast does for the settled side of this same feature.
    const revertedLabel = formatSettledTotals(
      result.revertedSettlements.payments.map((payment) => ({
        status: "settled",
        settledAmountMinor: payment.amount,
        currencyCode: payment.currencyCode,
      })),
      locale,
    );
    const survivingConsumedMinor = result.revertedSettlements.survivingConsumedMinor;
    const survivingConsumedLabel = formatSettledTotals(
      result.revertedSettlements.survivingConsumedAllocations.map((allocation) => ({
        status: "settled",
        settledAmountMinor: allocation.amountMinor,
        currencyCode: allocation.currencyCode,
      })),
      locale,
    );
    const hasRevertedSettlement = revertedTotal > 0 && revertedLabel !== null;
    const hasSurvivingConsumption = survivingConsumedMinor > 0 && survivingConsumedLabel !== null;

    let reopenToastMessage: string;
    if (hasRevertedSettlement && revertedLabel && hasSurvivingConsumption && survivingConsumedLabel) {
      reopenToastMessage = t("detail.toast.reopenedWithSettlementAndConsumption", {
        settlementAmount: revertedLabel,
        consumedAmount: survivingConsumedLabel,
      });
    } else if (hasRevertedSettlement && revertedLabel) {
      reopenToastMessage = t("detail.toast.reopenedWithSettlement", { amount: revertedLabel });
    } else if (hasSurvivingConsumption && survivingConsumedLabel) {
      reopenToastMessage = t("detail.toast.reopenedWithSurvivingConsumption", { amount: survivingConsumedLabel });
    } else {
      reopenToastMessage = t("detail.toast.reopened");
    }

    addToast(reopenToastMessage, {
      variant: "neutral",
      duration: UNDO_TOAST_DURATION_MS,
      action: { label: t("detail.toast.undo"), onClick: () => undoHandlerRef.current() },
    });
  }

  function handleUndoReopen() {
    const prev = undoSnapshotRef.current;
    if (!prev) return;
    clearUndoWindow();

    const current = snapshot();
    applySnapshot(prev);

    // BLOCKER F1, 2026-08-20 review: ONE sequential Server Action, never two independent dispatches
    // racing each other. The old code fired `undoReopenSettlementAction` (`void`, fire-and-forget)
    // and the inverse lifecycle mutation (`markDeliveredAction`/`cancelDeliveryAction`) from two
    // separate promise chains with no ordering between them — `undoReopenAction` restores the
    // settlement snapshot FIRST and only then re-applies the previous lifecycle state server-side,
    // so this handler now calls exactly one action.
    void undoReopenAction({
      deliveryId: delivery.id,
      previousStatus: prev.status === "CANCELLED" ? "CANCELLED" : "DELIVERED",
      receivedDate: prev.status === "CANCELLED" ? null : prev.receivedDate,
      // `RestoreSettlementPaymentSnapshot.exchangeRate` is `string | null` (BLOCKER F6): the raw
      // `Prisma.Decimal` this snapshot carries is stringified once here, at the client boundary,
      // rather than parsed down to a `number` and losing precision on the round trip.
      snapshot: prev.revertedSettlementPayments.map((payment) => ({
        storeId: payment.storeId,
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        currencyCode: payment.currencyCode,
        note: payment.note,
        exchangeRate: payment.exchangeRate ? payment.exchangeRate.toString() : null,
        exchangeRateBaseCode: payment.exchangeRateBaseCode,
        settledByDeliveryId: payment.settledByDeliveryId,
        allocations: payment.allocations.map((allocation) => ({
          orderId: allocation.orderId,
          orderItemId: allocation.orderItemId,
          amountMinor: allocation.amountMinor,
        })),
      })),
    }).then(
      (result) => {
        if (!result.ok) {
          applySnapshot(current);
          addToast(t("detail.toast.undoError"), { variant: "error" });
          return;
        }
        router.refresh();
      },
      () => {
        // A REJECTED promise is not a refusal the server described, it is no answer at all — same
        // treatment as `ok: false` above (the established pattern, `StoreGroupedView`'s own
        // `handleSubmitArrival`/`handleSubmitPayment`). Deliberately the SECOND argument of `then`,
        // never a chained `catch`, which would also swallow whatever the success handler throws.
        applySnapshot(current);
        addToast(t("detail.toast.undoError"), { variant: "error" });
      },
    );
  }

  // Keep the latest closure available to the global Z listener + toast action.
  useEffect(() => {
    undoHandlerRef.current = handleUndoReopen;
  });

  /**
   * Re-attempts a pending money transaction (`WO-08`, `FR-08-42`): re-reads the delivery's own
   * current status server-side and refuses (clearing the affordance) if it is no longer
   * `DELIVERED` — the collector already reopened it in the meantime, which is itself the signal
   * that the original settlement no longer applies.
   */
  function handleRetrySettlement() {
    if (!pendingEntry || isRetrying) return;
    setIsRetrying(true);
    void retrySettlementAction({
      deliveryId: pendingEntry.deliveryId,
      settleRemainder: pendingEntry.settleRemainder,
      settlementDate: new Date(`${pendingEntry.settlementDate}T00:00:00.000Z`),
      settlementIntents: pendingEntry.settlementIntents,
    }).then(
      (result) => {
        setIsRetrying(false);
        if (!result.ok) {
          addToast(t("detail.toast.retrySettlementError"), { variant: "error" });
          return;
        }
        if (result.noLongerPending) {
          clearPendingSettlement(pendingEntry.deliveryId);
          setPendingEntry(null);
          addToast(t("detail.toast.retryNoLongerPending"), { variant: "neutral" });
          return;
        }
        const stillFailing = result.outcomes.some((outcome) => outcome.status !== "settled");
        if (stillFailing) {
          addToast(t("detail.toast.retrySettlementError"), { variant: "error" });
          return;
        }
        clearPendingSettlement(pendingEntry.deliveryId);
        setPendingEntry(null);
        const settledLabel = formatSettledTotals(result.outcomes, locale);
        addToast(
          settledLabel ? t("detail.toast.retrySettled", { amount: settledLabel }) : t("detail.toast.retrySettledPlain"),
          { variant: "success" },
        );
        router.refresh();
      },
      () => {
        // A REJECTED promise is not a refusal the server described, it is no answer at all — same
        // treatment as `ok: false` above. Before this, a rejection here left `isRetrying` (and the
        // disabled Retry button) stuck forever, since nothing ever cleared it. Deliberately the
        // SECOND argument of `then`, never a chained `catch`, which would also swallow whatever the
        // success handler above throws. The pending entry is left in place for another retry.
        setIsRetrying(false);
        addToast(t("detail.toast.retrySettlementError"), { variant: "error" });
      },
    );
  }

  const editHref = `/${locale}${ROUTES.deliveries}/${delivery.id}/edit`;
  const sourceOrderCodes = delivery.sourceOrders.map((group) => group.orderHumanReadableId);

  const summaryCard = (
    <DeliverySummaryCard
      delivery={{
        deliveryDate: delivery.deliveryDate,
        expectedArrivalFrom: delivery.expectedArrivalFrom,
        expectedArrivalTo: delivery.expectedArrivalTo,
        cost: delivery.cost,
        currencyCode: delivery.currencyCode,
        exchangeRate: delivery.exchangeRate,
        needsExchangeRateUpdate: delivery.needsExchangeRateUpdate,
        store: { name: delivery.store.name, slug: delivery.store.slug },
        sourceOrderCodes,
      }}
      status={status}
      receivedDate={receivedDate}
      baseCurrencyCode={baseCurrencyCode}
      locale={locale}
    />
  );

  return (
    <>
      {/* Main column — hero + products read the live status so chips/pills flip optimistically. */}
      <div className="space-y-4 lg:col-start-1 lg:row-start-1">
        {/* Pending settlement Retry affordance (`WO-08`, spec §10 risk 4): visible whenever a money
            transaction failed after the arrival already committed, and must survive navigation —
            hidden the moment a reopen leaves nothing DELIVERED left to settle against. */}
        {pendingEntry && status === "DELIVERED" && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border [border-color:color-mix(in_oklch,var(--warning)_35%,var(--border))] p-4 [background:color-mix(in_oklch,var(--warning)_10%,var(--surface-elevated))]"
          >
            <p className="text-[13px] [color:var(--text-primary)]">{t("detail.settlement.pendingNotice")}</p>
            <button
              type="button"
              onClick={handleRetrySettlement}
              disabled={isRetrying}
              className="shrink-0 rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] font-medium [color:var(--accent-foreground)] [background:var(--accent)] disabled:opacity-60"
            >
              {isRetrying ? t("detail.settlement.retrying") : t("detail.settlement.retry")}
            </button>
          </div>
        )}
        <DeliveryDetailHero
          delivery={{
            id: delivery.id,
            humanReadableId: delivery.humanReadableId,
            storeName: delivery.store.name,
            storeLogoUrl: delivery.store.logoUrl,
            deliveryDate: delivery.deliveryDate,
            expectedArrivalFrom: delivery.expectedArrivalFrom,
            expectedArrivalTo: delivery.expectedArrivalTo,
            cost: delivery.cost,
            currencyCode: delivery.currencyCode,
            exchangeRate: delivery.exchangeRate,
            needsExchangeRateUpdate: delivery.needsExchangeRateUpdate,
            productCount: delivery.productCount,
          }}
          status={status}
          receivedDate={receivedDate}
          baseCurrencyCode={baseCurrencyCode}
          locale={locale}
          today={today}
        />
        <DeliveryProductsCard
          sourceOrders={delivery.sourceOrders}
          status={status}
          productCount={delivery.productCount}
          locale={locale}
        />
      </div>

      {/* Aside desktop — Resumen → Acciones → Nota (orden fijo §9.17). */}
      <div className="hidden lg:sticky lg:top-[calc(var(--app-banner-offset,0px)+3.5rem+2rem)] lg:col-start-2 lg:row-start-1 lg:block lg:space-y-3.5">
        {summaryCard}
        <DeliveryActionsCard
          status={status}
          editHref={editHref}
          isReopening={isReopening}
          onMarkDelivered={() => setModal("markDelivered")}
          onReopen={() => void handleReopen()}
          onCancel={() => setModal("cancel")}
          onDelete={() => setModal("delete")}
        />
        {noteCard}
      </div>

      {/* Mobile — hero/products arriba; Resumen → Nota apilados; acciones viven en el
          sticky bar + sheet (ADR 0011, sin card de acciones inline). */}
      <div className="mt-5 space-y-3.5 lg:hidden">
        {summaryCard}
        {noteCard}
      </div>

      {/* Reserve scroll space so the sticky bar never covers the last content row. */}
      <div className="lg:hidden" style={{ height: "calc(76px + env(safe-area-inset-bottom))" }} aria-hidden />

      <DeliveryStickyActionBar
        deliveryId={delivery.id}
        status={status}
        editHref={editHref}
        isReopening={isReopening}
        onMarkDelivered={() => setModal("markDelivered")}
        onReopen={() => void handleReopen()}
        onOpenActionsSheet={() => setActionsSheetOpen(true)}
      />

      <DeliveryActionsSheet
        open={actionsSheetOpen}
        onOpenChange={setActionsSheetOpen}
        humanReadableId={delivery.humanReadableId}
        storeName={delivery.store.name}
        status={status}
        editHref={editHref}
        onCancel={() => setModal("cancel")}
        onDelete={() => setModal("delete")}
      />

      <MarkDeliveredModal
        isOpen={modal === "markDelivered"}
        onClose={() => setModal(null)}
        humanReadableId={delivery.humanReadableId}
        storeName={delivery.store.name}
        productCount={delivery.productCount}
        onSubmit={handleMarkDelivered}
      />
      <DeliveryCancelModal
        isOpen={modal === "cancel"}
        onClose={() => setModal(null)}
        humanReadableId={delivery.humanReadableId}
        storeName={delivery.store.name}
        productCount={delivery.productCount}
        onConfirm={handleCancel}
      />
      <DeliveryDeleteModal
        isOpen={modal === "delete"}
        onClose={() => setModal(null)}
        deliveryId={delivery.id}
        humanReadableId={delivery.humanReadableId}
        storeName={delivery.store.name}
        locale={locale}
      />
    </>
  );
}

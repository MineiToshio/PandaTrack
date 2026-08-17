"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToast, NEUTRAL_UNDO_DURATION_MS } from "@/contexts/ToastContext";
import { ROUTES } from "@/lib/constants";
import type { DeliveryStatus } from "../../../../../../../generated/prisma/client";
import type { DeliveryDetail } from "@/lib/data/deliveries/deliveryQueries";
import { cancelDeliveryAction, markDeliveredAction, reopenDeliveryAction } from "../_actions/deliveryLifecycleActions";
import DeliveryDetailHero from "./DeliveryDetailHero";
import DeliveryProductsCard from "./DeliveryProductsCard";
import DeliverySummaryCard from "./DeliverySummaryCard";
import DeliveryActionsCard from "./DeliveryActionsCard";
import DeliveryStickyActionBar from "./DeliveryStickyActionBar";
import DeliveryActionsSheet from "./DeliveryActionsSheet";
import MarkDeliveredModal from "./MarkDeliveredModal";
import DeliveryCancelModal from "./DeliveryCancelModal";
import DeliveryDeleteModal from "./DeliveryDeleteModal";

type LifecycleSnapshot = { status: DeliveryStatus; receivedDate: Date | null };

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

  // Last reopen's pre-state — consumed by the toast "Deshacer" action and the Z shortcut.
  const undoSnapshotRef = useRef<LifecycleSnapshot | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest-ref so the global key listener and the toast action never call a stale closure.
  // (Re-assigned after `handleUndoReopen` is defined, further down.)
  const undoHandlerRef = useRef<() => void>(() => {});

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
    return { status, receivedDate };
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
    undoSnapshotRef.current = prev;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      undoSnapshotRef.current = null;
    }, UNDO_TOAST_DURATION_MS);
    addToast(t("detail.toast.reopened"), {
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

    // Inverse mutation: the reopen already persisted, so restoring DELIVERED re-runs
    // markDelivered with the previous received date; restoring CANCELLED re-runs cancel.
    const inverse =
      prev.status === "DELIVERED" && prev.receivedDate
        ? markDeliveredAction(delivery.id, prev.receivedDate)
        : cancelDeliveryAction(delivery.id);

    void inverse.then((result) => {
      if (!result.ok) {
        applySnapshot(current);
        addToast(t("detail.toast.undoError"), { variant: "error" });
        return;
      }
      router.refresh();
    });
  }

  // Keep the latest closure available to the global Z listener + toast action.
  useEffect(() => {
    undoHandlerRef.current = handleUndoReopen;
  });

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

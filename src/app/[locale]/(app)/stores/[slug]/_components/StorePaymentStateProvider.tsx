"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/contexts/ToastContext";
import { useProgressionFeedback } from "@/contexts/ProgressionFeedbackContext";
import {
  createStorePaymentAction,
  deleteStorePaymentAction,
  listAllStorePaymentsAction,
} from "@/app/[locale]/(app)/_actions/storePaymentActions";
import type {
  StoreDebtRow,
  StorePaymentAllocationLine,
  StorePaymentListRow,
} from "@/lib/data/orders/storePaymentQueries";
import {
  buildOptimisticPaymentId,
  sumActiveAllocationMinor,
  sumLostAllocationMinor,
} from "@/lib/orders/storePaymentPresentation";
import {
  StorePaymentSheet,
  useStorePaymentSheetOrders,
  type StorePaymentSheetSubmitInput,
  type StorePaymentSubmitOutcome,
} from "@/components/modules/StorePaymentSheet";
import type { AssignableOrder } from "@/lib/data/orders/storePaymentAssignableOrdersQueries";

type StorePaymentStateContextValue = {
  storeDebtByCurrency: StoreDebtRow[];
  openPaymentSheet: () => void;
  /** Every payment to this store, for the "Pagos a esta tienda" card. See `StorePaymentsSection`. */
  storePayments: StorePaymentListRow[];
  /** True total behind `storePayments`, independent of the query's display cap. */
  storePaymentsTotalCount: number;
  deleteStorePayment: (paymentId: string) => Promise<{ ok: boolean; error?: string }>;
  /** Fetches the payments the initial render capped away. No-op once the list is complete. */
  loadAllStorePayments: () => Promise<void>;
  isLoadingAllStorePayments: boolean;
  /** True when the last "load all" attempt failed, so the card can offer a retry in place. */
  hasLoadAllStorePaymentsError: boolean;
  /**
   * Moves one currency's debt figures by a "cuadrar cuenta" (reconciliation adjustment) write-off,
   * the sibling of {@link patchDebtByCurrency} for the OTHER mutation shape this page's debt block
   * reacts to (`FIX 1`, WO-11 review). Owned here, not by `StoreReconciliationProvider`, for the
   * same reason `patchDebtByCurrency` is: this provider holds the only `storeDebtByCurrency` state
   * this page renders (see this component's own doc).
   *
   * `openGroupWriteOffMinor` moves `openOrderDebtMinor` (`ADR 0033`, `FR-05-61`): the slice of the
   * declaration written against orders still in the OPEN group, the only lines that figure counts.
   * `totalWriteOffMinor` moves the lifetime `debtMinor` (`FR-05-63`): the write-off subtracts from
   * the ceiling regardless of which group a line targets, because a delivered order's balance is
   * still part of the store's lifetime debt even though it left `openOrderDebtMinor` already.
   *
   * Both deltas subtract. A negative delta therefore ADDS back, which is the whole rollback
   * mechanism: undoing an optimistic create, or applying a delete, passes the same magnitude
   * negated rather than a second, differently-signed code path.
   */
  applyAdjustmentDeltas: (input: {
    currencyCode: string;
    openGroupWriteOffMinor: number;
    totalWriteOffMinor: number;
  }) => void;
};

/**
 * Inserts a payment into the "Pagos a esta tienda" list at its sorted position (newest first),
 * mirroring `getStorePaymentsForStore`'s `[paymentDate desc, id desc]` order so an optimistic add
 * lands in the same spot a server refetch would put it.
 */
function insertPaymentSortedByDateDesc(
  list: StorePaymentListRow[],
  payment: StorePaymentListRow,
): StorePaymentListRow[] {
  const index = list.findIndex((existing) => existing.paymentDate.getTime() <= payment.paymentDate.getTime());
  if (index === -1) return [...list, payment];
  return [...list.slice(0, index), payment, ...list.slice(index)];
}

/**
 * Turns the sheet's submit input into the allocation lines the card renders, by looking the labels
 * up in the order list the sheet already loaded.
 *
 * Done here, on the receiving side, rather than by widening the sheet's draft: `SheetOrderDraft`
 * carries ids and amounts only, and threading two display strings through `buildAllocationInputs`
 * would push presentation concerns into the validation layer for no gain. Without these labels the
 * fresh row would read "Sin asignar" for the length of the round trip and then jump to its real
 * coverage — a flicker that contradicts the row's own content.
 *
 * `orderCancelled` is flatly false: the sheet only offers standing orders, and the mutation refuses
 * an allocation against a cancelled one. `orderActive` is NOT flatly true, though the two look
 * symmetrical: "standing" includes COMPLETED, and an order that was delivered without being fully
 * paid is precisely what the sheet exists to let the collector settle. Assuming it here would
 * advance the active-orders bar for money that went to an order the bar does not measure.
 */
function buildOptimisticAllocationLines(
  allocations: StorePaymentSheetSubmitInput["allocations"],
  orders: AssignableOrder[],
): StorePaymentAllocationLine[] {
  const orderById = new Map(orders.map((order) => [order.orderId, order]));
  return allocations.map((allocation) => {
    const order = orderById.get(allocation.orderId);
    const item = allocation.orderItemId
      ? order?.items.find((candidate) => candidate.itemId === allocation.orderItemId)
      : undefined;
    return {
      orderId: allocation.orderId,
      // Falls back to the id rather than to "": this string is the whole text of a link, and an
      // empty one is a link with no accessible name. Unreachable in practice (the submit comes
      // from the same cached order list this map is built from), but the failure mode is a11y, not
      // a blank pixel.
      orderHumanReadableId: order?.humanReadableId ?? allocation.orderId,
      orderCancelled: false,
      // Falls back to `false` when the order is somehow not in the cached list: unreachable (the
      // submit comes from that same list), and if it ever happens, leaving the bar still is the
      // failure that understates rather than the one that overstates progress. Either way this is
      // a stand-in for the length of the round trip only: the success handler re-derives the bar's
      // delta from the server's own `orderActive`, which is read inside the transaction.
      orderActive: order?.isActive ?? false,
      orderItemId: allocation.orderItemId ?? null,
      orderItemName: item?.name ?? null,
      amountMinor: allocation.amountMinor,
      // The sheet never emits a `settlesTarget` line (see `buildAllocationInputs`), so the
      // optimistic row cannot carry one either.
      settlesTarget: false,
    };
  });
}

const StorePaymentStateContext = createContext<StorePaymentStateContextValue | null>(null);

/** Reads the store detail's live debt figure and the sheet opener. Throws outside {@link StorePaymentStateProvider}. */
export function useStorePaymentState(): StorePaymentStateContextValue {
  const value = useContext(StorePaymentStateContext);
  if (!value) {
    throw new Error("useStorePaymentState must be used within a StorePaymentStateProvider");
  }
  return value;
}

type StorePaymentStateProviderProps = {
  storeId: string;
  storeName: string;
  storeDebtByCurrency: StoreDebtRow[];
  storePayments: StorePaymentListRow[];
  storePaymentsTotalCount: number;
  locale: string;
  children: ReactNode;
};

/**
 * Holds the store detail's live debt-by-currency state so the sidebar's payment progress block and
 * the "Registrar pago" action share one number, and renders the store payment sheet itself. Also
 * owns the "Pagos a esta tienda" list (`StorePaymentsSection`) so deleting a payment there updates
 * the same figures the sheet and sidebar read. Mirrors `StoreReportNoticeProvider`'s shape (§ store
 * detail cross-slot state).
 *
 * On success this patches only the debt figures and the payments list — nothing else server-rendered
 * on this page (order counts, spend totals, reviews, governance) is derived from payment state, so a
 * `router.refresh()` would cost a round trip to redraw content that has not changed. The orders list
 * and order detail pages, which DO show payment-derived figures, are covered separately by
 * `revalidateCollectionSurfaces` inside the store payment actions and pick up the change on their
 * own next visit.
 *
 * Six properties of the patching are load-bearing enough to name:
 *
 *  - **`paidMinor` moves with `debtMinor`, never alone.** The progress block reads both, and the
 *    sentence under the bar puts them side by side, so patching one is a visible contradiction.
 *  - **The delta is net of money sunk in cancelled orders.** The server's `paidMinor` already
 *    excludes it, so deleting a payment declared against a cancelled order moves neither the bar
 *    nor the debt. Subtracting its full amount locally would swing the whole bar on a no-op.
 *  - **`lostMinor` moves on its own, and it must move.** It is the counterpart of the point above:
 *    the sunk money does leave the store when the payment is deleted, and the block's "Perdido en
 *    cancelados" line is what reconciles it with the payments list. Patching the bar but not that
 *    line leaves the block naming money no row on screen accounts for.
 *  - **`activePaidMinor` is the bar's own number and moves by its own delta.** The bar's ratio is
 *    scoped to orders still in flight, so it must move by the part of the payment that landed
 *    there, not by the whole amount. Reusing `paidDelta` would advance the bar for money declared
 *    against an already delivered order, or for money handed over on account and declared against
 *    nothing at all. `activeCommittedMinor` never moves here: a payment does not change what the
 *    collector's orders cost.
 *  - **`openOrderDebtMinor` moves by the SAME delta as `activePaidMinor`, in the opposite
 *    direction.** It is the headline figure every "Debes / Falta" surface renders (`ADR 0033`), and
 *    it is `Σ openBalanceMinor` over the store's still-active orders — so money that lands on an
 *    active order lowers that order's own open balance by exactly the amount `activePaidMinor`
 *    rises by. Reusing the same delta (rather than inventing a second one) is what keeps the two
 *    figures from being able to drift apart.
 *  - **`unassignedMinor` moves by `amount − Σ allocations`, the parked remainder.** Computed from
 *    the payment's own numbers rather than trusted as `parkedAmountMinor`, so it is correct for any
 *    caller, not only one that went through the sheet's own equality gate (where the two happen to
 *    agree). NOT patched: allocations to a COMPLETED order would move `unrecordedPaymentsMinor` (a
 *    diagnostic for a delivered-but-unpaid order), but that figure is not rendered anywhere on this
 *    surface, so there is nothing on screen for a missed patch to contradict; a full page revisit
 *    picks it up like any other figure this component does not track.
 *  - **The optimistic guess at "which orders are active" is reconciled against the server's.** The
 *    client can only read the sheet's cached order list; the server reads the order's status inside
 *    the transaction. When they disagree the success handler patches the difference, because this
 *    is the one drift that would not self-correct: the row is replaced by the server's, so a later
 *    delete would subtract the correct, smaller figure and leave the surplus on the bar (and,
 *    together with it, on `openOrderDebtMinor`).
 *
 * A seventh property, added for a second mutation this provider does not itself dispatch (`FIX 1`,
 * WO-11 review): **`applyAdjustmentDeltas` is `StoreReconciliationProvider`'s own door into this
 * state**, exposed because that provider owns no `storeDebtByCurrency` of its own (by design, see
 * its own doc) but still needs to move `openOrderDebtMinor` and `debtMinor` the instant a "cuadrar
 * cuenta" write-off lands, rather than waiting on a `router.refresh()`. It is a SIBLING of
 * `patchDebtByCurrency`, not a reuse of it: a reconciliation adjustment carries no allocation,
 * `paidMinor`, `lostMinor` or `unassignedMinor` line of its own, so folding it into the payment
 * patch would either leave those fields silently untouched by an unrelated code path or invent
 * meaningless zero-deltas for them.
 */
export default function StorePaymentStateProvider({
  storeId,
  storeName,
  storeDebtByCurrency,
  storePayments,
  storePaymentsTotalCount,
  locale,
  children,
}: StorePaymentStateProviderProps) {
  const tPayment = useTranslations("orders.detail.storePayment");
  const { addToast } = useToast();
  const { announceProgression } = useProgressionFeedback();
  const [debts, setDebts] = useState<StoreDebtRow[]>(storeDebtByCurrency);
  const [payments, setPayments] = useState<StorePaymentListRow[]>(storePayments);
  const [paymentsTotalCount, setPaymentsTotalCount] = useState(storePaymentsTotalCount);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [hasLoadAllError, setHasLoadAllError] = useState(false);
  // Sticky once "load all" has answered: from that point the rows on screen are every payment to
  // this store, so the total is counted from them rather than tracked alongside them.
  const [hasLoadedAll, setHasLoadedAll] = useState(false);
  // Payments the collector has removed on screen. A "load all" answer computed before the delete
  // landed still contains them, and merging it back would resurrect a row the user watched
  // disappear. Ids are removed from this set only when the delete FAILS and the row comes back:
  // the two answers can arrive in either order, so "the delete has resolved" is not the same as
  // "no stale list answer is still on its way".
  const deletesInFlight = useRef<Set<string>>(new Set());

  // Destructured because the hook returns a fresh object literal on every render: depending on
  // `sheet` itself would defeat every `useCallback` below, while these members are stable.
  const {
    isOpen: isSheetOpen,
    open: openSheet,
    close: closeSheet,
    retry: retrySheetOrders,
    invalidate: invalidateSheetOrders,
    orders: sheetOrders,
    isLoading: sheetOrdersLoading,
    hasError: sheetOrdersError,
    isStale: sheetOrdersStale,
    isRefreshing: sheetOrdersRefreshing,
  } = useStorePaymentSheetOrders();

  const openPaymentSheet = useCallback(() => openSheet(storeId, "store_detail"), [openSheet, storeId]);

  /**
   * Moves one currency's figures.
   *
   * `paidDelta` is money that counts as paid: it raises `paidMinor` and lowers `debtMinor` by the
   * same amount, because those two are the pair the progress block prints side by side.
   *
   * `lostDelta` is money declared against a CANCELLED order. The server keeps it out of `paidMinor`
   * entirely and reports it separately, so it moves neither the bar nor the debt — but it is what
   * the "Perdido en cancelados" line renders, and that line is the only thing reconciling the block
   * with the list of payments underneath it. Leaving it unpatched on a delete makes the block claim
   * money that no row on screen accounts for any more.
   *
   * `activePaidDelta` is the slice of `paidDelta` that landed on orders still in flight. It moves
   * TWO figures, not one: `activePaidMinor`, the progress bar's own numerator, and
   * `openOrderDebtMinor`, the headline every "Debes / Falta" surface renders (`ADR 0033`), by the
   * same amount in the OPPOSITE direction — money that lands on an active order both advances the
   * bar and lowers that order's own open balance by construction, so one delta has to move both or
   * the two can drift apart. It is a distinct number from `paidDelta` because the two genuinely
   * differ: money declared against an already delivered order, and money handed over with nothing
   * declared at all, both move the debt and neither moves the bar or the headline.
   * `activeCommittedMinor` is not patched at all, and must not be: recording or deleting a payment
   * never changes what the collector's orders cost.
   *
   * `unassignedMinor` moves by its own delta, independent of the other three: it is the "sin
   * asignar" pool (`amount − Σ allocations`, `BR-05-27`), which can move even when nothing above it
   * does (money handed over on account moves `paidMinor` and `unassignedMinor` together but neither
   * `activePaidDelta` nor `openOrderDebtMinor`).
   */
  const patchDebtByCurrency = useCallback(
    (
      currencyCode: string,
      {
        paidDelta,
        lostDelta,
        activePaidDelta,
        unassignedDelta,
      }: { paidDelta: number; lostDelta: number; activePaidDelta: number; unassignedDelta: number },
    ) => {
      setDebts((prev) =>
        prev.map((debt) =>
          debt.currencyCode === currencyCode
            ? {
                ...debt,
                debtMinor: debt.debtMinor - paidDelta,
                paidMinor: debt.paidMinor + paidDelta,
                lostMinor: debt.lostMinor + lostDelta,
                activePaidMinor: debt.activePaidMinor + activePaidDelta,
                openOrderDebtMinor: debt.openOrderDebtMinor - activePaidDelta,
                unassignedMinor: debt.unassignedMinor + unassignedDelta,
              }
            : debt,
        ),
      );
    },
    [],
  );

  /**
   * Sibling of {@link patchDebtByCurrency} for the "cuadrar cuenta" mutation shape (`FIX 1`, WO-11
   * review): a reconciliation write-off has no allocation, no `paidMinor`, no `lostMinor` and no
   * `unassignedMinor` line of its own (`ADR 0034` §2), so it needs its own two-field patch rather
   * than being folded into the payment patch above. See {@link StorePaymentStateContextValue}'s own
   * doc for what each field moves and why both deltas subtract.
   */
  const applyAdjustmentDeltas = useCallback(
    ({
      currencyCode,
      openGroupWriteOffMinor,
      totalWriteOffMinor,
    }: {
      currencyCode: string;
      openGroupWriteOffMinor: number;
      totalWriteOffMinor: number;
    }) => {
      setDebts((prev) =>
        prev.map((debt) =>
          debt.currencyCode === currencyCode
            ? {
                ...debt,
                openOrderDebtMinor: debt.openOrderDebtMinor - openGroupWriteOffMinor,
                debtMinor: debt.debtMinor - totalWriteOffMinor,
              }
            : debt,
        ),
      );
    },
    [],
  );

  const handleSubmitPayment = useCallback(
    async (input: StorePaymentSheetSubmitInput): Promise<StorePaymentSubmitOutcome> => {
      // Optimistic stand-in for the "Pagos a esta tienda" card: the real id and any server-side
      // normalization arrive on success and reconcile this row in place (see below).
      const tempId = buildOptimisticPaymentId(Date.now());
      const optimisticAllocations = buildOptimisticAllocationLines(input.allocations, sheetOrders);
      // A payment being recorded can only name standing orders, so none of it is sunk: the whole
      // amount counts as paid and `lostMinor` cannot move. (The asymmetry with the delete path
      // below is the server's, not a slip.) The bar's share is narrower than the whole amount in
      // two reachable cases: a line declared against an order that is already delivered, and money
      // handed over on account with nothing declared at all. Both are real payments against a real
      // debt, and neither is progress on an order the collector is still waiting for.
      //
      // Derived from the very lines the optimistic row renders, so the bar and the row cannot
      // disagree about which orders this payment touched.
      const activePaidDelta = sumActiveAllocationMinor(optimisticAllocations);
      // `amount − Σ allocations`: the parked remainder this payment leaves unassigned. The sheet
      // only offers standing orders, so every named allocation reduces the pool by construction —
      // there is no "against a cancelled order" case to net out here, unlike the delete path below.
      const unassignedDelta =
        input.amount - input.allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0);
      patchDebtByCurrency(input.currencyCode, {
        paidDelta: input.amount,
        lostDelta: 0,
        activePaidDelta,
        unassignedDelta,
      });

      const optimisticPayment: StorePaymentListRow = {
        id: tempId,
        amount: input.amount,
        currencyCode: input.currencyCode,
        paymentDate: input.paymentDate,
        note: input.note,
        allocatedTotal: input.allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0),
        // Distinct ORDERS, matching the query's own field: the delete-confirm modal this feeds
        // counts pedidos, and one order can carry several lines of the same payment.
        claimingOrdersCount: new Set(input.allocations.map((allocation) => allocation.orderId)).size,
        allocations: optimisticAllocations,
      };
      setPayments((prev) => insertPaymentSortedByDateDesc(prev, optimisticPayment));
      setPaymentsTotalCount((prev) => prev + 1);

      // Rollbacks are functional (undo this row) rather than restorative (put back the array we
      // captured): "load all" is a second writer of `payments`, and a snapshot landing after it
      // would silently drop every row it fetched.
      const rollback = () => {
        patchDebtByCurrency(input.currencyCode, {
          paidDelta: -input.amount,
          lostDelta: 0,
          activePaidDelta: -activePaidDelta,
          unassignedDelta: -unassignedDelta,
        });
        setPayments((prev) => prev.filter((payment) => payment.id !== tempId));
        setPaymentsTotalCount((prev) => Math.max(0, prev - 1));
      };

      const pending = createStorePaymentAction({
        storeId,
        amount: input.amount,
        paymentDate: input.paymentDate,
        currencyCode: input.currencyCode,
        note: input.note,
        allocations: input.allocations,
        declarePaidItemIds: input.declarePaidItemIds,
        parkedAmountMinor: input.parkedAmountMinor,
      }).then(
        (result): StorePaymentSubmitOutcome => {
          // Every resolved mutation retires the sheet's cached order list, rollback included: the
          // server's balances are no longer something this client can assert.
          invalidateSheetOrders();
          if (!result.ok) {
            rollback();
            const key = `error.${result.error}` as const;
            addToast(tPayment.has(key as never) ? tPayment(key as never) : tPayment("error.server_error"), {
              variant: "error",
            });
            return { ok: false, error: result.error, orderId: result.orderId, orderItemId: result.orderItemId };
          }
          // Reconcile the bar with the server's own reading of which orders are still active.
          //
          // `activePaidDelta` above was derived from the sheet's CACHED order list; the server
          // re-derives `orderActive` inside the transaction, from the order's status at write time.
          // The two differ whenever an order finishes between opening the sheet and submitting
          // (another tab, or the "Ya me llegó" flow), and without this the bar stays overstated for
          // the rest of the session: the list row below is replaced by the server's, so a later
          // delete correctly subtracts the smaller figure and the surplus never comes off.
          const serverActivePaidDelta = sumActiveAllocationMinor(result.payment.allocations);
          if (serverActivePaidDelta !== activePaidDelta) {
            patchDebtByCurrency(input.currencyCode, {
              paidDelta: 0,
              lostDelta: 0,
              activePaidDelta: serverActivePaidDelta - activePaidDelta,
              // Which orders are active can change between opening the sheet and submitting; how
              // much of the payment was declared cannot. `unassignedMinor` already has its correct,
              // final value from the optimistic patch above.
              unassignedDelta: 0,
            });
          }
          // Reconcile the optimistic row with the authoritative one (real id, server-normalized data).
          setPayments((prev) =>
            insertPaymentSortedByDateDesc(
              prev.filter((payment) => payment.id !== tempId),
              result.payment,
            ),
          );
          addToast(tPayment("toastSuccess"), { variant: "success" });
          announceProgression(result.progression);
          return { ok: true };
        },
        (): StorePaymentSubmitOutcome => {
          // A REJECTED promise (network drop, a 502 from the server-actions endpoint) is not a
          // refusal the server described — it is no answer at all. It gets the same treatment as a
          // refusal: undo the optimistic patch, retire the cached order list, say so, and hand the
          // sheet a well-formed outcome so it can reopen its own controls.
          //
          // Deliberately the SECOND argument of `then` rather than a chained `catch`: a `catch`
          // after the handler above also catches whatever that handler throws, which would roll a
          // payment the server actually committed back off the screen and toast it as failed.
          //
          // `unanswered` is what keeps that absorption from reading as a verdict on the draft: the
          // sheet only ever sees a resolved outcome from here, and without the flag the one case
          // that should be resent unchanged is the one whose CTA it shuts.
          rollback();
          invalidateSheetOrders();
          addToast(tPayment("error.server_error"), { variant: "error" });
          return { ok: false, error: "server_error", unanswered: true };
        },
      );

      // Nothing declared: the sheet may close on the spot, because the toast fully describes what
      // would be lost. With declarations the sheet waits, so a refusal can point at its own line.
      if (input.allocations.length === 0) return { ok: true };
      return pending;
    },
    [addToast, announceProgression, invalidateSheetOrders, patchDebtByCurrency, sheetOrders, storeId, tPayment],
  );

  const handleDeleteStorePayment = useCallback(
    async (paymentId: string): Promise<{ ok: boolean; error?: string }> => {
      const target = payments.find((payment) => payment.id === paymentId);
      if (!target) return { ok: false, error: "NOT_FOUND" };

      // Only the part of this payment that is not already written off against a cancelled order
      // will move the bar. For a payment entirely sunk in one, this is zero and the bar correctly
      // does not budge — but the sunk part still leaves the store, so it comes off `lostMinor`.
      const lostMinor = sumLostAllocationMinor(target.allocations);
      const effectiveMinor = target.amount - lostMinor;
      // Only the lines pointing at orders still in flight come back off the bar. A payment that
      // settled a delivered order lowers the store's debt when it is removed and leaves the bar
      // exactly where it was, which is correct: that order is not in the bar's denominator either.
      const activeMinor = sumActiveAllocationMinor(target.allocations);
      // What this payment's own removal gives back to the unassigned pool: `allocatedTotal − amount`.
      // Equivalent to `-(effectiveMinor − nonCancelledAllocatedMinor)` (the payment's own live
      // remainder leaving with it), collapsed algebraically: `lostMinor` cancels out because it is
      // both subtracted from `effectiveMinor` and part of `allocatedTotal`. A payment that is fully
      // declared against non-cancelled orders (`allocatedTotal === amount`, the common case) leaves
      // the pool untouched, exactly as it should: it was never contributing anything unassigned.
      const unassignedDelta = target.allocatedTotal - target.amount;

      deletesInFlight.current.add(paymentId);
      setPayments((prev) => prev.filter((payment) => payment.id !== paymentId));
      setPaymentsTotalCount((prev) => Math.max(0, prev - 1));
      patchDebtByCurrency(target.currencyCode, {
        paidDelta: -effectiveMinor,
        lostDelta: -lostMinor,
        activePaidDelta: -activeMinor,
        unassignedDelta,
      });

      // Same reasoning as the create path: a rejected promise is not an answer, so it rolls back
      // exactly like a refusal instead of propagating and stranding the optimistic removal.
      let result: { ok: boolean; error?: string };
      try {
        result = await deleteStorePaymentAction(paymentId);
      } catch {
        result = { ok: false, error: "server_error" };
      }
      invalidateSheetOrders();
      if (!result.ok) {
        // Cleared ONLY here. On success the id must stay in the set: a "load all" answer computed
        // before the delete committed still lists this row, and if it lands after the delete has
        // answered, a cleared set lets the merge put the row the collector watched disappear back
        // on screen. A successfully deleted id never comes back from the server, so holding it
        // costs nothing.
        deletesInFlight.current.delete(paymentId);
        setPayments((prev) =>
          // Not merely defensive: the line above has just cleared the id, and a "load all" merge
          // QUEUED before that clear still runs its updater afterwards, reading `deletesInFlight`
          // at update time and letting the row through. So by the time this updater runs the row
          // may already be back, and inserting it again would render it twice under one React key.
          prev.some((payment) => payment.id === paymentId) ? prev : insertPaymentSortedByDateDesc(prev, target),
        );
        // Unconditional on purpose, and NOT a mismatch with the guard above: it mirrors this same
        // invocation's own unconditional decrement. In the interleaving where the guard declines,
        // the row is back because a merge restored it while the count was still short by this
        // delete, so the increment is exactly what squares them again.
        setPaymentsTotalCount((prev) => prev + 1);
        patchDebtByCurrency(target.currencyCode, {
          paidDelta: effectiveMinor,
          lostDelta: lostMinor,
          activePaidDelta: activeMinor,
          unassignedDelta: -unassignedDelta,
        });
        return result;
      }
      return { ok: true };
    },
    [invalidateSheetOrders, patchDebtByCurrency, payments],
  );

  const loadAllStorePayments = useCallback(async () => {
    setIsLoadingAll(true);
    setHasLoadAllError(false);
    const result = await listAllStorePaymentsAction(storeId).catch(() => ({
      ok: false as const,
      error: "server_error" as const,
    }));
    setIsLoadingAll(false);
    if (!result.ok) {
      setHasLoadAllError(true);
      return;
    }

    // From here on the list IS the total, so the `value` memo stops trusting `paymentsTotalCount`
    // and reads the rows instead (see below). The action returns rows and no count, and it does not
    // need to: a complete answer counts itself.
    //
    // This used to be left as a deliberate OVERCOUNT — the page rendered "25", another session
    // deleted six, the fetch brought 19, and the badge stayed at 25 — because lowering it takes
    // the "Ver los N pagos" control off screen (`hasHiddenPayments` goes false) in the very commit
    // the collector's focus is sitting on it. That is now safe: `StorePaymentsSection` catches the
    // focus the unmounting button drops and puts it on the last row.
    setHasLoadedAll(true);
    setPayments((prev) => {
      // Merge rather than replace, in both directions: rows the client added optimistically and is
      // still writing (`temp-*`) survive, and rows it removed optimistically and is still deleting
      // do not come back.
      const serverRows = result.payments.filter((payment) => !deletesInFlight.current.has(payment.id));
      const serverIds = new Set(serverRows.map((payment) => payment.id));
      const localOnly = prev.filter((payment) => !serverIds.has(payment.id));
      return localOnly.reduce(insertPaymentSortedByDateDesc, serverRows);
    });
  }, [storeId]);

  const value = useMemo<StorePaymentStateContextValue>(
    () => ({
      storeDebtByCurrency: debts,
      openPaymentSheet,
      storePayments: payments,
      // Two sources, and which one is authoritative depends on whether the list is complete.
      //
      // Before "load all" the list is a capped page, so it cannot count itself and the server's
      // total is the only figure there is; it is kept in step by the ±1 a create or a delete
      // applies to both. Once "load all" has answered, the rows ARE every payment to this store,
      // and any drift the page shipped with (another session added three, deleted six) is settled
      // by counting them. Deriving it is what stops the two writers disagreeing in either
      // direction: the badge reading 25 over 19 rows, or the sr-only status reading
      // "showing 28 of 25".
      storePaymentsTotalCount: hasLoadedAll ? payments.length : paymentsTotalCount,
      deleteStorePayment: handleDeleteStorePayment,
      loadAllStorePayments,
      isLoadingAllStorePayments: isLoadingAll,
      hasLoadAllStorePaymentsError: hasLoadAllError,
      applyAdjustmentDeltas,
    }),
    [
      debts,
      openPaymentSheet,
      payments,
      paymentsTotalCount,
      hasLoadedAll,
      handleDeleteStorePayment,
      loadAllStorePayments,
      isLoadingAll,
      hasLoadAllError,
      applyAdjustmentDeltas,
    ],
  );

  return (
    <StorePaymentStateContext.Provider value={value}>
      {children}
      <StorePaymentSheet
        isOpen={isSheetOpen}
        onClose={closeSheet}
        storeId={storeId}
        storeName={storeName}
        debts={debts}
        orders={sheetOrders}
        ordersLoading={sheetOrdersLoading}
        ordersError={sheetOrdersError}
        ordersStale={sheetOrdersStale}
        ordersRefreshing={sheetOrdersRefreshing}
        onRetryOrders={retrySheetOrders}
        locale={locale}
        onSubmit={handleSubmitPayment}
      />
    </StorePaymentStateContext.Provider>
  );
}

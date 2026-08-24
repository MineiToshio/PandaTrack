"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Store as StoreIcon } from "lucide-react";
import posthog from "posthog-js";
import Checkbox from "@/components/core/Checkbox";
import EmptyState from "@/components/modules/EmptyState";
import { useToast } from "@/contexts/ToastContext";
import { useProgressionFeedback } from "@/contexts/ProgressionFeedbackContext";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { formatAmountWithSymbol } from "@/lib/currency";
import { isItemEligibleForDelivery } from "@/lib/orders/orderState";
import { countOverdueProducts } from "@/lib/orders/storeGroupOverdue";
import { sortStoreGroups, type StoreViewSort } from "@/lib/orders/storeViewSort";
import { cn } from "@/lib/styles";
import { createStorePaymentAction } from "@/app/[locale]/(app)/_actions/storePaymentActions";
import { storeArrivalAction } from "@/app/[locale]/(app)/_actions/storeArrivalAction";
import { retrySettlementAction } from "@/app/[locale]/(app)/_actions/settlementActions";
import { domainDateToIsoString } from "@/lib/domainDate";
import {
  clearPendingSettlement,
  formatSettledTotals,
  writePendingSettlement,
  type PendingSettlementEntry,
} from "@/lib/deliveries/pendingSettlementStore";
import type { PendingProductsByStoreGroup } from "@/lib/data/orders/pendingProductsByStoreQueries";
import {
  QuickArrivalModal,
  type QuickArrivalItem,
  type QuickArrivalSubmitInput,
} from "@/components/modules/QuickArrival";
import {
  StorePaymentSheet,
  useStorePaymentSheetOrders,
  type StorePaymentSheetSubmitInput,
  type StorePaymentSubmitOutcome,
} from "@/components/modules/StorePaymentSheet";
import StoreGroupActions from "./StoreGroupActions";
import StoreGroupHeader, { resolveDebtFigures } from "./StoreGroupHeader";
import StoreGroupSelectionBar from "./StoreGroupSelectionBar";
import StorePendingProductCard from "./StorePendingProductCard";
import type { PaidDeclarationFailure } from "./share/useOrderItemPaidDeclaration";
import StorePendingProductRow, {
  STORE_PRODUCT_ROW_GRID,
  STORE_PRODUCT_TILE_BOX,
  STORE_PRODUCT_TILE_GAP,
} from "./StorePendingProductRow";
import { useStoreProductSelection } from "./useStoreProductSelection";

type StoreGroupedViewProps = {
  groups: PendingProductsByStoreGroup[];
  locale: string;
  returnTo: string;
  /**
   * The collector's base currency, forwarded from the page: the store-scoped arrival modal defaults
   * the optional shipping cost with it and decides from it whether a rate has to be asked for.
   */
  baseCurrencyCode: string | null;
  /**
   * The active `?sort=` of this view. Needed on the client, not only on the server, because the
   * optimistic patch removes products and every store ranking is an aggregate OVER those products:
   * the group whose soonest arrival just left has a new sort key and has to move with it, or the
   * whole list jumps the moment the server payload lands.
   */
  storeSort: StoreViewSort;
  /**
   * The collector's civil day at UTC midnight, resolved on the SERVER from `User.timezone`. Every
   * arrival state in this view is a comparison against it, and computing it here instead would both
   * mismatch the server render and compare a wall-clock instant against midnight-UTC domain dates.
   */
  today: Date;
};

/**
 * Orders list "Por tienda" view: one collapsible card per store with its pending products. Each
 * group's expand/collapse state is local to this component (a fresh `Set` per mount) — deliberately
 * NOT `useListExpansion`, which is the shared multi-open state the classic per-order list already
 * owns; sharing it here would let this view's toggles bleed into that one's "expand/collapse all".
 *
 * Groups default CLOSED (`FR-05-70`). They defaulted open on the argument that this view exists to
 * show every pending product at once, and on a desktop grid that held. On a phone it did not:
 * measured at 375px on the collector's own data, ten stores and sixty-six products rendered 7,916px
 * of scroll, nine and a half screens, most of it spent on six stores that owe nothing. Closing them
 * lands the same list in about one screen and turns the first question ("who do I owe, and is
 * anything late") into something answerable without scrolling.
 *
 * The cost of closing is that the urgency inside a group stops being visible, so the header pays it
 * back: each closed row states its own overdue count (`StoreGroupHeader`), which is what keeps this
 * from being strictly worse than the open default it replaces.
 *
 * It coordinates the view's two mutations, both optimistically, and owns the rollback and the toast
 * for each:
 *
 * - the **store payment** sheet, shared by every group's "Registrar pago" button (one sheet
 *   instance, `activeStoreId` tracks which group it is currently open for). A success patches this
 *   view's own copy of `groups`: the store's debt figure, and every pending product's
 *   `allocatedMinor` for allocations that named a specific product. The sheet no longer emits
 *   `settlesTarget`, so `settled` is never patched from here. A declaration line with no product
 *   (money against the order's leftover, or "on account") has no single pending-product row to
 *   attribute to in this view, so it only moves the debt figure — the row-level `allocatedMinor`
 *   catches up on the next full page load, same as the classic per-order list already does for
 *   order-level (non-declared) payments.
 * - the **store-scoped arrival** (`FR-05-48` / `FR-08-38`): the products selected inside one group
 *   leave the list, the group's `openOrdersCount` is recomputed from the survivors, an emptied
 *   group is dropped, and the remaining groups are re-sorted. `debts` is deliberately untouched:
 *   an arrival is not a payment, and `getStoreDebtByCurrency` counts `COMPLETED` orders as
 *   committed, so nothing the delivery re-derives moves the figure either.
 */
export default function StoreGroupedView({
  groups,
  locale,
  returnTo,
  baseCurrencyCode,
  storeSort,
  today,
}: StoreGroupedViewProps) {
  const t = useTranslations("orderListing");
  const tPayment = useTranslations("orders.detail.storePayment");
  const tArrival = useTranslations("orders.detail.quickArrival");
  const tActions = useTranslations("orders.detail.actions");
  const router = useRouter();
  const { addToast } = useToast();
  const { announceProgression } = useProgressionFeedback();
  // Expanded, not collapsed: the default is closed, so the set holds the exceptions either way and
  // naming it for what it contains keeps the `has()` reading the same as the state it describes.
  const [expandedStoreIds, setExpandedStoreIds] = useState<Set<string>>(() => new Set());
  const [groupsState, setGroupsState] = useState<PendingProductsByStoreGroup[]>(groups);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [isArrivalOpen, setIsArrivalOpen] = useState(false);
  /**
   * Products the server named in `ineligibleProductIds` when it refused the last batch. Flagged in
   * the list until the next server payload, instead of silently retrying with the eligible subset:
   * quietly changing what an irreversible write covers is exactly what must not happen.
   */
  const [flaggedIneligibleIds, setFlaggedIneligibleIds] = useState<Set<string>>(() => new Set());
  const sheet = useStorePaymentSheetOrders();
  const selection = useStoreProductSelection();

  // Reset local state whenever the server hands down a genuinely different `groups` list (a new
  // navigation, a filter change) — never mid-flight of this view's own optimistic patch, which
  // already applied its change locally before any server round-trip.
  //
  // `deliveryState` is part of the signature, and it has to be: the query calls anything
  // not-yet-delivered "pending", so a product that moved to `IN_TRANSIT` in another tab keeps its
  // id, its `allocatedMinor` and its `settled` — an identical signature — while becoming
  // unselectable. Without the field the effect never fires, the tile stays live, and the whole
  // batch is refused with nothing on screen explaining why.
  const groupsSignature = groups
    .map(
      (group) =>
        `${group.store.id}:${group.debts.map((debt) => `${debt.currencyCode}=${debt.debtMinor}`).join(",")}:${group.pendingProducts
          .map(
            (product) =>
              `${product.itemId}=${product.allocatedMinor}=${product.paidDeclared}=${product.orderAllocatedAmountMinor}=${product.deliveryState}`,
          )
          .join(",")}`,
    )
    .join("|");
  const lastServerSignatureRef = useRef(groupsSignature);
  const pruneSelection = selection.prune;
  useEffect(() => {
    if (groupsSignature !== lastServerSignatureRef.current) {
      lastServerSignatureRef.current = groupsSignature;
      setGroupsState(groups);
      setFlaggedIneligibleIds(new Set());
      // The live selection is intersected with what the server now shows AND still allows. A marked
      // product that vanished leaves no checkbox to clear, so keeping its id would make the batch
      // fail on every retry with no way out on screen.
      pruneSelection(groups);
    }
  }, [groupsSignature, groups, pruneSelection]);

  const activeGroup = groupsState.find((group) => group.store.id === activeStoreId) ?? null;
  const selectionStoreId = selection.selection?.storeId ?? null;
  const selectionGroup = groupsState.find((group) => group.store.id === selectionStoreId) ?? null;
  const selectedIds = selection.selection?.itemIds ?? null;
  const selectedProducts = useMemo(
    () =>
      selectionGroup && selectedIds
        ? selectionGroup.pendingProducts.filter((product) => selectedIds.has(product.itemId))
        : [],
    [selectionGroup, selectedIds],
  );
  const selectedOrderCount = new Set(selectedProducts.map((product) => product.orderId)).size;
  const selectionSummary =
    selectedOrderCount > 1
      ? t("storeView.selection.count", { count: selectedProducts.length, orders: selectedOrderCount })
      : t("storeView.selection.countSingleOrder", { count: selectedProducts.length });

  const handleToggle = (storeId: string) => {
    setExpandedStoreIds((prev) => {
      const next = new Set(prev);
      const willExpand = !next.has(storeId);
      if (willExpand) next.add(storeId);
      else next.delete(storeId);
      posthog.capture(
        willExpand ? POSTHOG_EVENTS.ORDER.LIST_STORE_GROUP_EXPANDED : POSTHOG_EVENTS.ORDER.LIST_STORE_GROUP_COLLAPSED,
        { store_id: storeId },
      );
      return next;
    });
    // A hidden selection is a selection nobody can correct before confirming it.
    selection.clearStore(storeId);
  };

  const handleOpenPayment = (storeId: string) => {
    setActiveStoreId(storeId);
    sheet.open(storeId, "orders_store_view");
  };

  /**
   * `Escape` clears the selection, and it is bound to the group's own subtree rather than to the
   * document on purpose: `Modal` already listens for `Escape` at document level, so a single press
   * meant to dismiss the arrival dialog would otherwise also wipe the selection behind it — the
   * 28 checkboxes the collector would then have to mark again. Dismissing the modal keeps the
   * selection intact, which is what makes a second look at the dialog free.
   */
  const handleGroupKeyDown = (event: React.KeyboardEvent<HTMLElement>, storeId: string) => {
    if (event.key !== "Escape") return;
    if (selectionStoreId !== storeId) return;
    selection.clear();
  };

  const eligibleIdsOf = useCallback(
    (group: PendingProductsByStoreGroup) =>
      group.pendingProducts
        .filter((product) => isItemEligibleForDelivery(product.deliveryState))
        .map((product) => product.itemId),
    [],
  );

  const handleOpenArrival = () => {
    if (!selectionGroup || selectedProducts.length === 0) return;
    posthog.capture(POSTHOG_EVENTS.DELIVERY.QUICK_ARRIVAL_OPENED, {
      store_id: selectionGroup.store.id,
      source: "orders_store_view",
      product_count: selectedProducts.length,
      order_count: selectedOrderCount,
    });
    setIsArrivalOpen(true);
  };

  const arrivalItems: QuickArrivalItem[] = useMemo(
    () =>
      selectedProducts.map((product) => ({
        id: product.itemId,
        name: product.name,
        orderLabel: product.orderHumanReadableId,
        orderId: product.orderId,
      })),
    [selectedProducts],
  );

  // The dialog only MOUNTS while there is still something to confirm, but the flag that opens it is
  // independent of that condition — and every path that can empty the selection runs while the
  // dialog is open (a resync whose prune finds nothing left, a refusal that names nothing). Left on
  // its own the flag survives the unmount, so the NEXT product marked would re-open a filled-in
  // dialog nobody asked for, with its primary one click from an irreversible write. The flag
  // follows the selection down.
  //
  // Adjusted during render rather than from an effect: React re-runs this component before
  // committing anything, so the dialog is never painted in the bad state, and the guard converges
  // on the first pass (once the flag is down the branch cannot be taken again). An effect would
  // both paint first and ask for the pattern the `set-state-in-effect` lint exists to prevent.
  if (isArrivalOpen && (!selectionGroup || arrivalItems.length === 0)) setIsArrivalOpen(false);

  // Latest-ref so a repeated "Retry" (offered again on a further transient failure) always calls
  // the current closure, never one captured when the first toast was created — the same pattern
  // `useQuickArrival`'s own `retryPendingRef` uses for its per-order equivalent.
  const retryBatchPendingRef = useRef<(deliveryId: string, entry: PendingSettlementEntry) => void>(() => {});

  /**
   * Re-attempts a batch's pending money transaction (`WO-08`, `FR-08-42`), with the SAME
   * success/failure toast contract `useQuickArrival`'s own `retryPending` uses (MAJOR F10,
   * 2026-08-20 review): success names the settled total, a genuine business refusal clears the
   * entry and shows a dismissable notice (never re-offered as Retry), and only a still-"pending"
   * (transient) outcome keeps the persisted entry and re-offers Retry.
   */
  const retryBatchPending = useCallback(
    (deliveryId: string, entry: PendingSettlementEntry) => {
      void retrySettlementAction({
        deliveryId,
        settleRemainder: entry.settleRemainder,
        settlementDate: new Date(`${entry.settlementDate}T00:00:00.000Z`),
        settlementIntents: entry.settlementIntents,
      }).then(
        (result) => {
          if (!result.ok) {
            addToast(tArrival("error.server_error"), { variant: "error" });
            return;
          }
          if (result.noLongerPending) {
            clearPendingSettlement(deliveryId);
            addToast(tArrival("settlement.noLongerPending"), { variant: "neutral" });
            router.refresh();
            return;
          }

          const refusedOutcome = result.outcomes.find((outcome) => outcome.status === "refused");
          if (refusedOutcome) {
            clearPendingSettlement(deliveryId);
            const key = `error.${refusedOutcome.error}` as const;
            addToast(tPayment.has(key as never) ? tPayment(key as never) : tPayment("error.server_error"), {
              variant: "error",
            });
            router.refresh();
            return;
          }

          const stillPending = result.outcomes.some((outcome) => outcome.status === "pending");
          if (stillPending) {
            addToast(tArrival("settlement.retryFailed"), {
              variant: "error",
              action: {
                label: tArrival("settlement.retry"),
                onClick: () => retryBatchPendingRef.current(deliveryId, entry),
              },
            });
            return;
          }

          clearPendingSettlement(deliveryId);
          const settledLabel = formatSettledTotals(result.outcomes, locale);
          addToast(
            settledLabel
              ? tArrival("settlement.confirmation", { amount: settledLabel })
              : tArrival("toast.success", { count: 1 }),
            { variant: "success" },
          );
          router.refresh();
        },
        () => {
          // Same treatment this file already gives a rejected `storeArrivalAction`/
          // `createStorePaymentAction` call (see `handleSubmitArrival`/`handleSubmitPayment` below):
          // a rejected promise is no answer at all, not a refusal the server described. Deliberately
          // the SECOND argument of `then`, never a chained `catch`, which would also swallow whatever
          // the success handler above throws. The pending entry is left in place for another retry.
          addToast(tArrival("error.server_error"), { variant: "error" });
        },
      );
    },
    [addToast, locale, router, tArrival, tPayment],
  );
  useEffect(() => {
    retryBatchPendingRef.current = retryBatchPending;
  });

  const handleSubmitArrival = (input: QuickArrivalSubmitInput) => {
    const group = selectionGroup;
    if (!group) return;
    const storeId = group.store.id;
    const storeName = group.store.name;
    const marked = new Set(input.productIds);
    const previousGroups = groupsState;
    const previousSelection = selection.selection;

    const patched = sortStoreGroups(
      previousGroups
        .map((candidate) => {
          if (candidate.store.id !== storeId) return candidate;
          const remaining = candidate.pendingProducts.filter((product) => !marked.has(product.itemId));
          return {
            ...candidate,
            pendingProducts: remaining,
            // The query's own definition: one count per order that still contributes a pending
            // product. Recomputed from the survivors rather than decremented, so an order losing
            // two of its three products does not lose a count it should keep.
            openOrdersCount: new Set(remaining.map((product) => product.orderId)).size,
          };
        })
        // A group only exists while it has a pending product, exactly as the query builds it.
        .filter((candidate) => candidate.pendingProducts.length > 0),
      storeSort,
    );

    setGroupsState(patched);
    setFlaggedIneligibleIds(new Set());
    selection.clear();

    // The store leaves the list with the arrival, taking its debt figure and its "Registrar pago"
    // button with it (this view is a pending-product view, and it now has nothing pending). Said
    // once, at the moment it happens, rather than left for the collector to notice was missing.
    //
    // Reads `openOrderDebtMinor`, not the lifetime `debtMinor` (FIX E): that is the figure the
    // store chip itself displays (`ADR 0033`), and `group.debts` is exactly the state FIX A's own
    // patch keeps live, so a payment recorded earlier in this session is already reflected here. A
    // registration gap (`debtMinor > 0` but `openOrderDebtMinor === 0`, an unregistered balance on a
    // COMPLETED order) must not read as a debt on an order the arrival ever touched.
    const groupIsGone = !patched.some((candidate) => candidate.store.id === storeId);
    const owedAfter = groupIsGone
      ? group.debts
          .filter((debt) => debt.openOrderDebtMinor > 0)
          .map((debt) => formatAmountWithSymbol(debt.openOrderDebtMinor, debt.currencyCode, locale))
          .join(" · ")
      : "";

    void storeArrivalAction({ storeId, ...input }).then(
      (result) => {
        if (!result.ok) {
          setGroupsState(previousGroups);
          const namedIneligible = result.ineligibleProductIds ?? [];
          // A stale selection handed back verbatim is a batch that fails on every retry, so it is
          // only restored when the client can tell which tiles to drop first. `PRODUCT_NOT_ELIGIBLE`
          // with no ids is the compare-and-swap race inside the mutation, which names nothing: the
          // selection is dropped there and the copy says to reload, because guessing which product
          // moved would be inventing the answer.
          const blindStaleness = result.error === "PRODUCT_NOT_ELIGIBLE" && namedIneligible.length === 0;
          if (previousSelection && !blindStaleness) {
            const restored = { storeId: previousSelection.storeId, itemIds: new Set(previousSelection.itemIds) };
            for (const id of namedIneligible) restored.itemIds.delete(id);
            if (restored.itemIds.size > 0) selection.replace(restored);
          }
          if (namedIneligible.length > 0) {
            setFlaggedIneligibleIds(new Set(namedIneligible));
            addToast(tArrival("error.SOME_NOT_ELIGIBLE", { count: namedIneligible.length }), { variant: "error" });
            return;
          }
          // `createDelivery` speaks per order, because an order row is what it read, and its copy
          // says "this order is cancelled". Here the batch can span several orders of the store, so
          // that sentence names nothing the collector can act on. The selection-scoped copy states
          // the same fact AND what to do about it; every other code resolves the same either way.
          const errorCode = result.error === "ORDER_CANCELLED" ? "SELECTION_ORDER_CANCELLED" : result.error;
          const key = `error.${errorCode}` as const;
          addToast(tArrival.has(key as never) ? tArrival(key as never) : tArrival("error.server_error"), {
            variant: "error",
          });
          return;
        }

        // Settlement on arrival (`WO-08`), applied per closed order across the batch: a batch
        // toast states the SUMMED settled amount in one confirmation. MAJOR F7 (2026-08-20 review):
        // "refused" is a genuine business refusal, never transient, so it gets a dismissable notice
        // instead of a persisted Retry entry — only "pending" (the money transaction threw) still
        // surfaces the `Retry` affordance, and the retry intent is persisted so it survives
        // navigation.
        const refusedOutcome = result.moneyOutcomes.find((outcome) => outcome.status === "refused");
        const needsRetry = result.moneyOutcomes.some((outcome) => outcome.status === "pending");

        // The arrival itself is committed on every branch below, refusals of the MONEY step
        // included, so each of them announces what it credited after raising its own toast. Only
        // one branch ever runs, so the collector sees the announcement exactly once.
        if (refusedOutcome) {
          const key = `error.${refusedOutcome.error}` as const;
          addToast(tPayment.has(key as never) ? tPayment(key as never) : tPayment("error.server_error"), {
            variant: "error",
          });
          announceProgression(result.progression);
          return;
        }

        if (needsRetry && input.settleRemainder) {
          const entry: PendingSettlementEntry = {
            deliveryId: result.deliveryId,
            settleRemainder: input.settleRemainder,
            // MAJOR F5, 2026-08-20 review: `input.settlementDate`/`input.receivedDate` are already
            // domain dates (UTC midnight, `toDomainDate`-normalized by `QuickArrivalModal` before
            // they reach this handler). `domainDateToIsoString` reads that UTC calendar day
            // directly; the old `toLocalIsoDateString` used local getters, which shifts the day
            // backward for a collector whose timezone sits west of UTC (e.g. `America/Lima`).
            settlementDate: domainDateToIsoString(input.settlementDate ?? input.receivedDate) ?? "",
            settlementIntents: input.settlementIntents ?? [],
            createdAt: new Date().toISOString(),
          };
          writePendingSettlement(entry);
          addToast(
            owedAfter
              ? tArrival("toast.successStoreLeft", { count: result.productCount, store: storeName, debt: owedAfter })
              : tArrival("toast.success", { count: result.productCount }),
            {
              variant: "success",
              action: {
                label: tArrival("settlement.retry"),
                onClick: () => retryBatchPending(result.deliveryId, entry),
              },
            },
          );
          announceProgression(result.progression);
          return;
        }

        const settledLabel = formatSettledTotals(result.moneyOutcomes, locale);
        addToast(
          settledLabel
            ? tArrival("settlement.confirmation", { amount: settledLabel })
            : owedAfter
              ? tArrival("toast.successStoreLeft", { count: result.productCount, store: storeName, debt: owedAfter })
              : tArrival("toast.success", { count: result.productCount }),
          {
            variant: "success",
            action: {
              label: tArrival("toast.viewDelivery"),
              onClick: () => router.push(`/${locale}${ROUTES.deliveries}/${result.deliveryId}`),
            },
          },
        );
        announceProgression(result.progression);
      },
      () => {
        // A REJECTED promise is not a refusal the server described, it is no answer at all. Same
        // treatment as a refusal, and deliberately the SECOND argument of `then` rather than a
        // chained `catch`, which would also swallow whatever the handler above throws and roll a
        // delivery the server actually committed back off the screen.
        setGroupsState(previousGroups);
        if (previousSelection) selection.replace(previousSelection);
        addToast(tArrival("error.server_error"), { variant: "error" });
      },
    );
  };

  const handleSubmitPayment = async (input: StorePaymentSheetSubmitInput): Promise<StorePaymentSubmitOutcome> => {
    const storeId = activeStoreId;
    if (!storeId) return { ok: true };

    const previous = groupsState;
    // The slice of this payment that lands on an order still in flight, the same delta
    // `StorePaymentStateProvider` derives for its own bar (FIX A): looked up against the sheet's own
    // cached order list, since `StorePaymentSheetSubmitInput.allocations` carries no `orderActive`
    // of its own. `openOrderDebtMinor` (the store chip's headline, `ADR 0033`) is `Σ openBalanceMinor`
    // over the store's active orders, so money declared against one lowers this same delta off it.
    const orderById = new Map(sheet.orders.map((order) => [order.orderId, order]));
    const activePaidDelta = input.allocations.reduce(
      (sum, allocation) => (orderById.get(allocation.orderId)?.isActive ? sum + allocation.amountMinor : sum),
      0,
    );
    setGroupsState((prev) =>
      prev.map((group) => {
        if (group.store.id !== storeId) return group;
        const amountByItemId = new Map<string, number>();
        // Orders this payment puts money on WITHOUT naming a product. Their rows must stop printing
        // a ratio in the same tick the money lands (`orderHasUndetailedMoney`, ADR 0028 §6): the
        // product's item-level share becomes a floor the instant the order also holds unattributed
        // money, and a patch that moved only `allocatedMinor` repainted exactly the percentage that
        // rule suppresses, for as long as the round trip took.
        const ordersGainingUndetailed = new Set<string>();
        for (const allocation of input.allocations) {
          if (!allocation.orderItemId) {
            ordersGainingUndetailed.add(allocation.orderId);
            continue;
          }
          amountByItemId.set(
            allocation.orderItemId,
            (amountByItemId.get(allocation.orderItemId) ?? 0) + allocation.amountMinor,
          );
        }
        return {
          ...group,
          // `debtMinor` moves by the whole payment (the lifetime figure the "Registrar pago" gate
          // and the credit chip both still read), and `openOrderDebtMinor` — the figure this group's
          // own chip actually DISPLAYS for a store that owes money (`StoreGroupHeader`, `ADR 0033`)
          // — moves by `activePaidDelta` alone: only the slice declared against an order still in
          // flight lowers that order's own open balance. `StoreDebtEntry` has no `unassignedMinor`
          // of its own (`pendingProductsByStoreQueries` narrows `StoreDebtRow` down to just these two
          // fields), so there is nothing else on this shape for a patch to fall out of step with.
          debts: group.debts.map((debt) =>
            debt.currencyCode === input.currencyCode
              ? {
                  ...debt,
                  debtMinor: debt.debtMinor - input.amount,
                  openOrderDebtMinor: debt.openOrderDebtMinor - activePaidDelta,
                }
              : debt,
          ),
          pendingProducts: group.pendingProducts.map((product) => {
            const delta = amountByItemId.get(product.itemId);
            const gainsUndetailed = ordersGainingUndetailed.has(product.orderId);
            if (delta === undefined && !gainsUndetailed) return product;
            return {
              ...product,
              allocatedMinor: product.allocatedMinor + (delta ?? 0),
              orderHasUndetailedMoney: product.orderHasUndetailedMoney || gainsUndetailed,
            };
          }),
        };
      }),
    );

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
        sheet.invalidate();
        if (!result.ok) {
          setGroupsState(previous);
          const key = `error.${result.error}` as const;
          addToast(tPayment.has(key as never) ? tPayment(key as never) : tPayment("error.server_error"), {
            variant: "error",
          });
          return { ok: false, error: result.error, orderId: result.orderId, orderItemId: result.orderItemId };
        }
        addToast(tPayment("toastSuccess"), { variant: "success" });
        announceProgression(result.progression);
        return { ok: true };
      },
      (): StorePaymentSubmitOutcome => {
        // A REJECTED promise (network drop, a 502 from the server-actions endpoint) is not a
        // refusal the server described — it is no answer at all. Same treatment as a refusal: undo
        // the optimistic patch, retire the cached order list, say so, and hand the sheet a
        // well-formed outcome so it can reopen its own controls instead of freezing.
        //
        // Deliberately the SECOND argument of `then` rather than a chained `catch`: a `catch` after
        // the handler above also catches whatever that handler throws, which would roll a payment
        // the server actually committed back off the screen and toast it as failed.
        //
        // `unanswered` is what keeps that absorption from reading as a verdict on the draft: the
        // sheet only ever sees a resolved outcome from here, and without the flag the one case that
        // should be resent unchanged is the one whose CTA it shuts.
        setGroupsState(previous);
        sheet.invalidate();
        addToast(tPayment("error.server_error"), { variant: "error" });
        return { ok: false, error: "server_error", unanswered: true };
      },
    );

    // Nothing declared: the sheet may close on the spot, because the toast fully describes what
    // would be lost. With declarations the sheet waits, so a refusal can point at its own line.
    if (input.allocations.length === 0) return { ok: true };
    return pending;
  };

  /**
   * The paid mark reverts itself optimistically; what the hook cannot do is tell the collector.
   *
   * A mark is a statement only they could produce, so one disappearing without a word would be a
   * lie by omission. The sibling arrived-toggle reverts silently and is right to: its state is
   * re-derivable from the delivery. This one is not.
   */
  const handlePaidMarkError = (failure: PaidDeclarationFailure) => {
    addToast(failure === "ITEM_NOT_FOUND" ? t("storeView.paidMark.reload") : t("storeView.paidMark.error"), {
      variant: "error",
    });
  };

  if (groupsState.length === 0) {
    // The server's own empty state lives in `orders/page.tsx` and the client can never reach it, so
    // the last arrival logged from here would otherwise leave a blank column.
    return (
      <EmptyState
        appearance="card"
        headingAs="h2"
        icon={<StoreIcon width={28} height={28} />}
        iconTone="accent"
        title={t("storeView.empty.title")}
        subtitle={t("storeView.empty.description")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/*
        A node of its own, never the toolbar container: `role="status"` implies `aria-atomic`, so a
        live region wrapping the buttons would re-read their labels on every count change.
      */}
      <p className="sr-only" role="status">
        {selectionGroup
          ? t("storeView.selection.liveStatus", {
              count: selectedProducts.length,
              store: selectionGroup.store.name,
            })
          : ""}
      </p>

      {groupsState.map((group) => {
        const isExpanded = expandedStoreIds.has(group.store.id);
        const bodyId = `store-group-body-${group.store.id}`;
        const isSelectingHere = selection.isSelecting(group.store.id);
        const selectedHere = selection.idsFor(group.store.id);
        const eligibleIds = eligibleIdsOf(group);
        const selectedEligibleCount = eligibleIds.filter((id) => selectedHere.has(id)).length;
        const masterChecked: boolean | "indeterminate" =
          selectedEligibleCount === 0 ? false : selectedEligibleCount === eligibleIds.length ? true : "indeterminate";
        const handleMaster = (checked: boolean) => selection.setAll(group.store.id, eligibleIds, checked);
        const handleToggleProduct = (itemId: string, shiftKey: boolean) =>
          selection.toggle(group.store.id, itemId, { shiftKey, eligibleIds });

        const overdueProductCount = countOverdueProducts(group.pendingProducts, today);
        // One decision per group, taken here so the header figure and every row underneath it can
        // never disagree about whether this store's amounts carry their currency code.
        const showCurrencyCode = resolveDebtFigures(group.debts).length > 1;
        const groupActions = (
          <StoreGroupActions
            store={group.store}
            debts={group.debts}
            undetailedByOrder={group.undetailedByOrder}
            locale={locale}
            returnTo={returnTo}
            onRegisterPayment={() => handleOpenPayment(group.store.id)}
            className="flex flex-wrap items-center gap-2"
          />
        );

        return (
          <section
            key={group.store.id}
            onKeyDown={(event) => handleGroupKeyDown(event, group.store.id)}
            // No `overflow-hidden`: an ancestor that clips turns the card into a scrollport and
            // kills the selection bar's `position: sticky`. Nothing here paints to the corners
            // (the header carries no background and the body only a top border), so the rounding
            // never depended on the clip.
            className="rounded-[var(--radius-2xl)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)]"
          >
            <StoreGroupHeader
              store={group.store}
              pendingProductCount={group.pendingProducts.length}
              overdueProductCount={overdueProductCount}
              debts={group.debts}
              locale={locale}
              isExpanded={isExpanded}
              onToggleExpand={() => handleToggle(group.store.id)}
              desktopActions={groupActions}
            />

            {isExpanded && (
              <div id={bodyId} className="px-4 pb-3 [border-top:1px_solid_var(--border)] md:px-5 md:pb-4">
                {/* Below `md` the actions live here instead of on the header row: they only mean
                    anything once the collector has decided to work on this store, which is what
                    expanding says, and the header has no width for them at 375px. */}
                <div className="pt-3 md:hidden">{groupActions}</div>

                {/* Desktop: column headers + grid rows */}
                <div className="hidden lg:block">
                  <div
                    className={cn(
                      "grid items-center gap-3 pt-3 pb-1 [font-family:var(--font-mono)] [font-size:11px] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase",
                      STORE_PRODUCT_ROW_GRID,
                    )}
                  >
                    {/* The master checkbox sits in a box the size of a row tile, with the row's own
                        gap after it, so "Producto" stays over the product names instead of sliding
                        left by the difference between a 16px checkbox and a 32px tile. */}
                    <span className={cn("flex min-w-0 items-center", STORE_PRODUCT_TILE_GAP)}>
                      <span className={cn("grid shrink-0 place-items-center", STORE_PRODUCT_TILE_BOX)}>
                        <Checkbox
                          checked={masterChecked}
                          onChange={handleMaster}
                          disabled={eligibleIds.length === 0}
                          ariaLabel={t("storeView.selection.selectAllAriaLabel", { store: group.store.name })}
                          size="sm"
                        />
                      </span>
                      <span>{t("storeView.columnProduct")}</span>
                    </span>
                    <span className="text-right">{t("storeView.columnPrice")}</span>
                    <span className="text-center">{t("storeView.columnState")}</span>
                    <span className="text-right">{t("storeView.columnPaid")}</span>
                  </div>
                  <ul role="list" className="flex flex-col">
                    {group.pendingProducts.map((product) => (
                      <StorePendingProductRow
                        key={product.itemId}
                        product={product}
                        locale={locale}
                        returnTo={returnTo}
                        isSelected={selectedHere.has(product.itemId)}
                        isArmed={selectedEligibleCount > 0}
                        isFlaggedIneligible={flaggedIneligibleIds.has(product.itemId)}
                        today={today}
                        onToggleSelect={handleToggleProduct}
                        onPaidMarkError={handlePaidMarkError}
                      />
                    ))}
                  </ul>
                </div>

                {/* Mobile: an explicit entry strip (there is no hover to reveal a tile with) plus
                    the two-line cards. */}
                <div className="lg:hidden">
                  {/* One strip, two jobs, so entering selection never pushes the list down: it
                      states the group's own counts, and it is where selection is entered and left.
                      The order count lives here rather than in the header, which has no width for
                      it once the money has a column of its own. */}
                  <div className="flex items-center justify-between gap-3 pt-3">
                    {isSelectingHere && eligibleIds.length > 0 ? (
                      <Checkbox
                        checked={masterChecked}
                        onChange={handleMaster}
                        label={t("storeView.selection.selectAll")}
                        size="sm"
                        // The label IS the target and a 16px box plus caption text renders about
                        // 20px tall. Resized rather than expanded (`interface-patterns.md` §12):
                        // this strip only exists on touch, so there is no compact end to drop to.
                        className="min-h-11"
                      />
                    ) : (
                      <span className="min-w-0 truncate [font-family:var(--font-mono)] [font-size:11px] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase">
                        {t("storeView.groupSummary", {
                          orders: group.openOrdersCount,
                          products: group.pendingProducts.length,
                        })}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => (isSelectingHere ? selection.clear() : selection.begin(group.store.id))}
                      className="relative inline-flex min-h-9 items-center px-2 [font-size:var(--text-caption)] [font-weight:var(--font-weight-medium)] [color:var(--accent)] before:absolute before:[inset:-4px_0] before:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]"
                    >
                      {isSelectingHere ? t("storeView.selection.exit") : t("storeView.selection.enter")}
                    </button>
                  </div>
                  <ul role="list" className="flex flex-col">
                    {group.pendingProducts.map((product) => (
                      <StorePendingProductCard
                        key={product.itemId}
                        product={product}
                        locale={locale}
                        returnTo={returnTo}
                        showCurrencyCode={showCurrencyCode}
                        isSelectable={Boolean(isSelectingHere)}
                        isSelected={selectedHere.has(product.itemId)}
                        isFlaggedIneligible={flaggedIneligibleIds.has(product.itemId)}
                        today={today}
                        onToggleSelect={handleToggleProduct}
                        onPaidMarkError={handlePaidMarkError}
                      />
                    ))}
                  </ul>
                </div>

                {selectionStoreId === group.store.id && selectedProducts.length > 0 && (
                  <StoreGroupSelectionBar
                    summary={selectionSummary}
                    ariaLabel={t("storeView.selection.barAriaLabel", { store: group.store.name })}
                    confirmLabel={tActions("quickArrival")}
                    confirmAriaLabel={t("storeView.selection.storeArrivalAriaLabel", { store: group.store.name })}
                    clearLabel={t("storeView.selection.clear")}
                    onConfirm={handleOpenArrival}
                    onClear={selection.clear}
                  />
                )}
              </div>
            )}
          </section>
        );
      })}

      {isArrivalOpen && selectionGroup && arrivalItems.length > 0 && (
        <QuickArrivalModal
          isOpen={isArrivalOpen}
          onClose={() => setIsArrivalOpen(false)}
          // The store, and only the store. The count belongs to the dialog's own live sources (the
          // "{n} de {total} seleccionados" line and the primary's label): a subtitle composed out
          // here freezes the count the dialog opened with, because unchecking a row inside the
          // dialog moves its internal state and never this view's selection — deliberately, since
          // that isolation is what keeps an id from leaking back into the batch.
          subtitle={selectionGroup.store.name}
          items={arrivalItems}
          // The collector hand-picked these rows, so the confirmation echoes the whole selection
          // back whatever its size. The per-order launchers preselect everything themselves and
          // keep their single-product sentence.
          alwaysListItems
          baseCurrencyCode={baseCurrencyCode}
          locale={locale}
          storeName={selectionGroup.store.name}
          onSubmit={handleSubmitArrival}
        />
      )}

      <StorePaymentSheet
        // Keyed by store: remounts the sheet's internal draft state (currency, amount, note,
        // allocations) whenever the active store changes, instead of relying on a `useState`
        // initializer that only ever runs once. Without this, the sheet's first-ever open mounts
        // with `debts=[]` (this view renders it unconditionally, before any store is active) and
        // every later open of a different store keeps replaying the previous store's currency and
        // draft — the sheet only reset on its own `handleClose`, never on switching targets.
        key={activeStoreId ?? "none"}
        isOpen={sheet.isOpen}
        onClose={sheet.close}
        storeId={activeStoreId ?? ""}
        storeName={activeGroup?.store.name ?? ""}
        debts={activeGroup?.debts ?? []}
        orders={sheet.orders}
        ordersLoading={sheet.isLoading}
        ordersError={sheet.hasError}
        ordersStale={sheet.isStale}
        ordersRefreshing={sheet.isRefreshing}
        onRetryOrders={sheet.retry}
        locale={locale}
        onSubmit={handleSubmitPayment}
      />
    </div>
  );
}

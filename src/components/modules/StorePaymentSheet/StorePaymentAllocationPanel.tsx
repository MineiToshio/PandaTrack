"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, PackageOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import SearchInput from "@/components/core/SearchInput";
import Skeleton from "@/components/core/Skeleton";
import { TOTALS_ANNOUNCE_DELAY_MS } from "@/lib/constants";
import { formatAmountWithSymbol } from "@/lib/currency";
import { formatDomainDate } from "@/lib/domainDate";
import { cn } from "@/lib/styles";
import type { AssignableOrder } from "@/lib/data/orders/storePaymentAssignableOrdersQueries";
import {
  computeFillableMinor,
  findOverAllocationCulprit,
  sumAllOrders,
  sumOrderDraft,
  type StorePaymentSheetDraft,
  type StorePaymentSheetValidation,
} from "@/lib/orders/storePaymentSheetValidation";
import StorePaymentAllocationRow, { lineMessageId, type FillDisabledReason } from "./StorePaymentAllocationRow";
import type { AllocationLine } from "./buildAllocationLines";
import { matchesQuery } from "./matchHighlight";

/** Above this many lines, scanning stops beating typing and the filter earns its tab stop. */
export const ALLOCATION_SEARCH_THRESHOLD = 12;

/** Six rows' worth of reserved height, so the panel never jumps between a warm and a cold load. */
const RESERVED_LIST_HEIGHT = "min-h-[312px]";

export type AllocationRevealRequest = { lineKey: string; token: number };

export type StorePaymentAllocationPanelProps = {
  lines: AllocationLine[];
  /** Orders of the selected currency, for each line's order-level ceilings. */
  orders: AssignableOrder[];
  draft: StorePaymentSheetDraft;
  validation: StorePaymentSheetValidation;
  values: Record<string, string>;
  /** Line keys this draft declares covered, with no amount attached. Enters no ceiling. */
  declaredLineKeys: ReadonlySet<string>;
  currencyCode: string;
  locale: string;
  paymentAmountMinor: number;
  paymentDate: Date | null;
  status: "loading" | "error" | "ready";
  onRetry: () => void;
  /** The line the server refused, if the last submission came back rejected. */
  serverRejectedLineKey: string | null;
  /** The last line the collector typed into, for naming a culprit when the total overruns. */
  lastEditedLineKey: string | null;
  onChange: (line: AllocationLine, raw: string) => void;
  onFill: (line: AllocationLine, fillableMinor: number) => void;
  onToggleDeclared: (line: AllocationLine) => void;
  onClear: () => void;
  /** The explicit "no sé todavía" action (WO-09): parks the draft's current remainder on purpose. */
  onParkRemainder: () => void;
  /** Undoes a park choice, so the collector can name the money after all. */
  onUnpark: () => void;
  /** Back to the payment panel (amount, date, note). The panel's own "back" control. */
  onEditPayment: () => void;
  onEditDate: () => void;
  /** A submission is in flight: navigating back would leave the request without its screen. */
  isSubmitting?: boolean;
  /** Bumped token asking the panel to clear its filter and scroll one line into view. */
  revealRequest: AllocationRevealRequest | null;
  /** Reported once the request has been attempted against a `ready` list, so the parent retires it. */
  onRevealHandled: (token: number) => void;
};

/**
 * Panel B of the store payment sheet: the flat list of payable lines, taking the whole modal body.
 *
 * The list has no per-order container. Its unit is the payable line (one per product with a
 * balance, plus a "Resto del pedido" line when an order's products cannot absorb its whole
 * balance), each carrying its own order reference, ordered newest order first and contiguous within
 * an order. The filter therefore selects ORDERS, not lines: a matched order renders in full, so the
 * arithmetic the collector is doing (an order's lines compete for one balance) is never shown half.
 *
 * Money inside the list obeys one rule (ADR 0027): a figure printed in the list PARTITIONS what it
 * describes, it never replicates it. The order's balance appears once per block, so the balances
 * this list prints add up to exactly what the orders it lists can still take; the amount fields sum
 * to at most the payment; and no row prints a ceiling of its own, because with an empty draft every
 * line of an order carries the same ceiling and N lines would advertise N times the room that
 * exists. The live ceiling still reaches the collector, through the fill button's accessible name,
 * which promises exactly the amount the button writes.
 *
 * The balances are NOT a partition of the store's debt, and nothing here may be written as if they
 * were: an order's balance is declared money (`totalCost - allocatedAmountMinor`) while the debt is
 * paid money (`totalCost - payments`), and this sheet is precisely what lets them diverge, by
 * accepting a payment with part of it left unassigned ("Sin asignar"). The two coincide only while
 * every payment on the store's books is fully assigned.
 */
export default function StorePaymentAllocationPanel({
  lines,
  orders,
  draft,
  validation,
  values,
  declaredLineKeys,
  currencyCode,
  locale,
  paymentAmountMinor,
  paymentDate,
  status,
  onRetry,
  serverRejectedLineKey,
  lastEditedLineKey,
  onChange,
  onFill,
  onToggleDeclared,
  onClear,
  onParkRemainder,
  onUnpark,
  onEditPayment,
  onEditDate,
  isSubmitting = false,
  revealRequest,
  onRevealHandled,
}: StorePaymentAllocationPanelProps) {
  const t = useTranslations("orders.detail.storePayment");
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  // Starts at 0, NEVER at the incoming token: entering this panel and asking for a reveal happen in
  // the same update, so seeding the ref from the request would make the panel mount already
  // believing it had honored it, and the very first "Revisar" / "Ver" would do nothing at all.
  const revealTokenRef = useRef(0);

  const showSearch = status === "ready" && lines.length > ALLOCATION_SEARCH_THRESHOLD;
  const restLabel = t("allocations.restLine");

  const labelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const line of lines) map.set(line.key, line.name ?? restLabel);
    return map;
  }, [lines, restLabel]);

  /**
   * Brings one line onto the screen. Clearing the filter FIRST is what makes this safe: a culprit
   * row can only be hidden by the filter, so pointing at it without clearing could aim at nothing.
   * The scroll waits a frame so React has committed the unfiltered list before the row is looked up.
   */
  const revealLine = useCallback((lineKey: string, onSettled?: () => void) => {
    setQuery("");
    requestAnimationFrame(() => {
      const row = listRef.current?.querySelector<HTMLElement>(`[data-line-key="${CSS.escape(lineKey)}"]`);
      if (!row) {
        onSettled?.();
        return;
      }
      row.scrollIntoView?.({ block: "center" });
      row.querySelector("input")?.focus();
      onSettled?.();
    });
  }, []);

  /**
   * A reveal waits for a `ready` list before it is attempted. The list can be a skeleton at the
   * moment the request arrives (a refusal invalidates the order payload, so a refetch is usually
   * in flight right behind it), and spending the request against one would lose it for good: the
   * collector would be told a line is wrong with nothing pointing at it.
   *
   * Once the list IS ready, the request is spent whether or not the row was there. A row missing
   * from a settled list is not late, it is gone (an allocation made elsewhere took its balance
   * away), and leaving the request standing for it is worse than dropping it: the effect's deps do
   * not change, so nothing retries it, and the panel unmounts on "Volver al pago" and remounts with
   * a fresh token counter — which replays the stale request, clears the filter and steals the focus
   * on every later entry into the panel.
   */
  useEffect(() => {
    if (!revealRequest || revealRequest.token === revealTokenRef.current) return;
    if (status !== "ready") return;
    const { lineKey, token } = revealRequest;
    queueMicrotask(() =>
      revealLine(lineKey, () => {
        revealTokenRef.current = token;
        onRevealHandled(token);
      }),
    );
  }, [revealRequest, revealLine, status, onRevealHandled]);

  const orderById = useMemo(() => new Map(orders.map((order) => [order.orderId, order])), [orders]);
  const orderDraftById = useMemo(
    () => new Map(draft.orders.map((orderDraft) => [orderDraft.orderId, orderDraft])),
    [draft.orders],
  );

  /**
   * Per-line live figures: what the fill button may write, and why not when it may not.
   *
   * There is deliberately no display figure here any more. The panel used to compute a second,
   * different number for the row to PRINT while the button wrote this one, which is the defect
   * ADR 0027 reverses; keeping a display figure in this map, even the right one, is what would let
   * the two drift apart again.
   */
  const lineFigures = useMemo(() => {
    const sumAll = sumAllOrders(draft.orders);
    const figures = new Map<string, { fillableMinor: number; fillDisabledReason: FillDisabledReason }>();

    for (const line of lines) {
      const order = orderById.get(line.orderId);
      const orderDraft = orderDraftById.get(line.orderId);
      // No order or no draft for it: the render between a refetch landing and the draft being
      // rebuilt from it. The line is not fillable, and it is not fillable for a reason of its own —
      // falling through to the map's default said "you have already assigned the whole payment"
      // over a payment the collector had not touched.
      if (!order || !orderDraft) {
        figures.set(line.key, { fillableMinor: 0, fillDisabledReason: "unavailable" });
        continue;
      }

      const itemDraft = line.itemId ? orderDraft.items.find((item) => item.itemId === line.itemId) : null;
      const ownMinor = line.isRest ? orderDraft.amountMinor : (itemDraft?.amountMinor ?? 0);
      const sumOfOrder = sumOrderDraft(orderDraft);
      const sumOtherLinesOfOrderMinor = sumOfOrder - ownMinor;

      const fillableMinor = computeFillableMinor({
        lineCeilingMinor: line.lineCeilingMinor,
        orderAssignableMinor: order.assignableMinor,
        sumOtherLinesOfOrderMinor,
        paymentAmountMinor,
        sumOtherLinesOfPaymentMinor: sumAll - ownMinor,
      });

      const fillDisabledReason: FillDisabledReason =
        paymentAmountMinor <= 0 ? "noAmount" : paymentAmountMinor - (sumAll - ownMinor) <= 0 ? "payment" : "order";

      figures.set(line.key, { fillableMinor, fillDisabledReason });
    }

    return figures;
  }, [draft.orders, lines, orderById, orderDraftById, paymentAmountMinor]);

  // The filter selects orders, not lines: a matched order keeps every one of its lines.
  const visibleLines = useMemo(() => {
    if (query.trim() === "") return lines;
    const matchedOrderIds = new Set<string>();
    for (const line of lines) {
      const label = labelByKey.get(line.key) ?? "";
      if (matchesQuery(label, query) || matchesQuery(line.humanReadableId, query)) matchedOrderIds.add(line.orderId);
    }
    return lines.filter((line) => matchedOrderIds.has(line.orderId));
  }, [lines, labelByKey, query]);

  /** The last line of each order block, which is where an order-level message is written. */
  const lastLineKeyByOrderId = useMemo(() => {
    const map = new Map<string, string>();
    for (const line of visibleLines) map.set(line.orderId, line.key);
    return map;
  }, [visibleLines]);

  /**
   * The first line of each order block, which is where that order's own balance is named. Once per
   * order and never per line: the balance is one budget its lines compete for, so printing it on
   * each of them would advertise it as many times as the order has products (ADR 0027). Blocks stay
   * whole under the filter, which selects orders, so the first visible line of a block is its first
   * line.
   */
  const firstLineKeyByOrderId = useMemo(() => {
    const map = new Map<string, string>();
    for (const line of visibleLines) if (!map.has(line.orderId)) map.set(line.orderId, line.key);
    return map;
  }, [visibleLines]);

  /**
   * Orders whose own balance is exactly spent by the current draft, with the payment still holding
   * room. Every fill button of such a block goes inert, and nothing on screen said why: the
   * over-balance message only fires once the draft goes PAST the balance, so landing exactly on it
   * (which is what "Máx." does) produced a block of dead controls and no words at all.
   *
   * Read from the order's own room rather than from a line's `fillDisabledReason`, which is a
   * fallback chain: a settled line reports "order" whatever the order's balance is doing.
   */
  const exhaustedOrderIds = useMemo(() => {
    const exhausted = new Set<string>();
    if (paymentAmountMinor <= 0) return exhausted;
    const sumAll = sumAllOrders(draft.orders);
    if (paymentAmountMinor - sumAll <= 0) return exhausted;
    for (const orderDraft of draft.orders) {
      if (orderDraft.assignableMinor - sumOrderDraft(orderDraft) <= 0) exhausted.add(orderDraft.orderId);
    }
    return exhausted;
  }, [draft.orders, paymentAmountMinor]);

  const culpritKey = validation.allocationExceedsAmount ? findOverAllocationCulprit(draft, lastEditedLineKey) : null;
  const dateBlockedOrder = orders.find((order) => validation.dateErrors.has(order.orderId)) ?? null;
  const overMinor = validation.sumAllocatedMinor - paymentAmountMinor;

  // WO-09 (`FR-05-58`/`FR-05-60`, `ADR 0033`): once the collector parks the remainder, "Sin
  // asignar" reads 0 (nothing left unaccounted, see `computeUnallocatedMinor`) and the parked
  // amount is what explains the gap instead — so the totals line names it explicitly rather than
  // silently disappearing into a suspiciously-complete "Asignado: X de X".
  const hasParkedMoney = validation.parkedAmountMinor > 0;
  // The affordance itself: offered only on the neutral, non-error incomplete state — never while the
  // draft already overshoots (that is a different mistake, fixed by lowering a line, not by parking)
  // or while nothing is left to park.
  const canParkRemainder =
    status === "ready" &&
    paymentAmountMinor > 0 &&
    !validation.allocationExceedsAmount &&
    !hasParkedMoney &&
    validation.unallocatedMinor > 0;

  const totalsText = validation.allocationExceedsAmount
    ? t("allocations.totalsOver", { amount: formatAmountWithSymbol(overMinor, currencyCode || "USD", locale) })
    : dateBlockedOrder
      ? t("allocations.dateBeforeOrderLine", { order: dateBlockedOrder.humanReadableId })
      : hasParkedMoney
        ? `${t("allocations.totalsAssigned", {
            assigned: formatAmountWithSymbol(validation.sumAllocatedMinor, currencyCode || "USD", locale),
            payment: formatAmountWithSymbol(paymentAmountMinor, currencyCode || "USD", locale),
          })} · ${t("allocations.totalsParked", {
            amount: formatAmountWithSymbol(validation.parkedAmountMinor, currencyCode || "USD", locale),
          })}`
        : `${t("allocations.totalsAssigned", {
            assigned: formatAmountWithSymbol(validation.sumAllocatedMinor, currencyCode || "USD", locale),
            payment: formatAmountWithSymbol(paymentAmountMinor, currencyCode || "USD", locale),
          })} · ${t("allocations.totalsUnassigned", {
            amount: formatAmountWithSymbol(validation.unallocatedMinor, currencyCode || "USD", locale),
          })}`;

  // Announced only once typing settles: the running total changes on every character in any of up
  // to dozens of fields, and a live region that fires on each one is unusable rather than helpful.
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setAnnouncement(totalsText), TOTALS_ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [totalsText]);

  function handleSearchSubmit() {
    const first = listRef.current?.querySelector<HTMLElement>("li[data-line-key]");
    first?.scrollIntoView?.({ block: "center" });
  }

  function renderList() {
    if (status === "loading") {
      return (
        <div aria-busy="true" className={cn("flex flex-col", RESERVED_LIST_HEIGHT)}>
          <span className="sr-only">{t("allocations.loading")}</span>
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="grid min-h-14 grid-cols-[minmax(0,1fr)_96px] items-center gap-x-2 px-3 py-1.5 md:min-h-[52px] md:grid-cols-[minmax(0,1fr)_auto_140px] md:gap-x-3"
            >
              <Skeleton variant="text" width="60%" height={12} />
              <Skeleton className="hidden md:block" variant="text" width={48} height={12} />
              <Skeleton variant="rect" height={36} />
            </div>
          ))}
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className={cn("flex flex-col items-center justify-center gap-3 px-6 text-center", RESERVED_LIST_HEIGHT)}>
          <p className="[font-size:12.5px] [color:var(--text-secondary)]">{t("allocations.errorLoading")}</p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {t("allocations.retry")}
          </Button>
        </div>
      );
    }

    if (lines.length === 0) {
      return (
        <div className={cn("flex flex-col items-center justify-center gap-2 px-6 text-center", RESERVED_LIST_HEIGHT)}>
          <PackageOpen size={24} aria-hidden className="[color:var(--text-muted)]" />
          <p className="[font-size:12.5px] [color:var(--text-secondary)]">{t("allocations.empty")}</p>
          <p className="[font-size:11.5px] [color:var(--text-muted)]">{t("allocations.emptyHint")}</p>
        </div>
      );
    }

    if (visibleLines.length === 0) {
      return (
        <div className={cn("flex flex-col items-center justify-center gap-3 px-6 text-center", RESERVED_LIST_HEIGHT)}>
          <p className="[font-size:12.5px] [color:var(--text-secondary)]">{t("allocations.searchEmpty", { query })}</p>
          <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
            {t("allocations.searchClear")}
          </Button>
        </div>
      );
    }

    return (
      <ul className="flex flex-col">
        {visibleLines.map((line) => {
          const figures = lineFigures.get(line.key);
          const blockingReason = validation.blockingLines.get(line.key) ?? null;
          const isServerRejection = serverRejectedLineKey === line.key;
          const label = labelByKey.get(line.key) ?? restLabel;

          const isOrderMessageAnchor = lastLineKeyByOrderId.get(line.orderId) === line.key;

          let message: string | null = null;
          let messageTone: "error" | "neutral" = "error";
          if (isServerRejection) message = t("allocations.serverRejectedLine");
          else if (blockingReason === "overItemBase") message = t("allocations.lineOverBase");
          else if (isOrderMessageAnchor && blockingReason === "overOrderBalance")
            message = t("allocations.lineOverOrder");
          else if (isOrderMessageAnchor && blockingReason === "dateBeforeOrder")
            message = t("allocations.lineDateBeforeOrder");
          else if (isOrderMessageAnchor && exhaustedOrderIds.has(line.orderId)) {
            // Not an error: the block's own budget is exactly spent, which is a legal draft and a
            // frequent one (it is what pressing "Máx." on the last line of a block produces). It
            // still has to be SAID, because every fill button of the block goes inert with it and
            // the reason otherwise lives only on the controls themselves. `lineOverOrder` covers
            // the neighbouring case, going OVER, and never fires on landing exactly.
            message = t("allocations.fillDisabledOrder");
            messageTone = "neutral";
          }

          // An order-level rule marks every line of the block but writes its reason once, on the
          // block's last line. The other lines point at that same text so a screen reader never
          // announces "invalid" with nothing to explain it.
          const groupMessageId =
            blockingReason === "overOrderBalance" || blockingReason === "dateBeforeOrder"
              ? lineMessageId(lastLineKeyByOrderId.get(line.orderId) ?? line.key)
              : undefined;

          return (
            <StorePaymentAllocationRow
              key={line.key}
              line={line}
              label={label}
              currencyCode={currencyCode}
              locale={locale}
              value={values[line.key] ?? ""}
              orderBalanceMinor={
                firstLineKeyByOrderId.get(line.orderId) === line.key
                  ? (orderById.get(line.orderId)?.assignableMinor ?? null)
                  : null
              }
              fillableMinor={figures?.fillableMinor ?? 0}
              fillDisabledReason={figures?.fillDisabledReason ?? "unavailable"}
              message={message}
              messageTone={messageTone}
              groupMessageId={groupMessageId}
              isServerRejection={isServerRejection}
              isInvalid={blockingReason !== null || isServerRejection}
              declaredInDraft={declaredLineKeys.has(line.key)}
              query={query}
              onChange={onChange}
              onFill={(target) => onFill(target, lineFigures.get(target.key)?.fillableMinor ?? 0)}
              onToggleDeclared={onToggleDeclared}
            />
          );
        })}
      </ul>
    );
  }

  return (
    <div className="flex flex-col">
      {/* The panel's own way back, at the top where a sub-view puts it, with the payment it is
          splitting beside it. It used to be a footer action next to "Cancelar" and the CTA, which
          on a phone squeezed three buttons into one row; and the recap carried a second button to
          the same place, labelled as if it edited the allocation itself. */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEditPayment}
          disabled={isSubmitting}
          leadingIcon={<ArrowLeft size={14} aria-hidden />}
        >
          {t("allocations.back")}
        </Button>
        <p className="[font-size:12.5px] [color:var(--text-secondary)] tabular-nums">
          {formatAmountWithSymbol(paymentAmountMinor, currencyCode || "USD", locale)}
          {paymentDate ? ` · ${formatDomainDate(paymentDate, locale)}` : ""}
        </p>
      </div>

      {status === "ready" && lines.length > 0 && paymentAmountMinor <= 0 && (
        <p className="mb-2 [font-size:12px] leading-relaxed [color:var(--text-secondary)]">
          {t("allocations.noAmountNotice")}
        </p>
      )}

      {validation.sumAllocatedMinor === 0 && status === "ready" && lines.length > 0 && paymentAmountMinor > 0 && (
        <p className="mb-2 [font-size:12px] leading-relaxed [color:var(--text-muted)]">{t("allocations.hint")}</p>
      )}

      {/*
        Everything the collector needs while typing deep into the list stays pinned: where the money
        stands, the actions on the remainder, the filter, and the column labels. The rest of the
        body (the recap and the hint above) scrolls away. The modal body is the scroll container, so
        this bleeds over its 24px side padding to paint a solid band the rows pass under, and pins
        16px above the body's content edge: sticky offsets are measured inside the scroller's
        padding, so `top-0` left the body's own `pt-4` as a strip the rows showed through.
      */}
      <div className="sticky -top-4 z-[var(--z-sticky)] -mx-6 flex flex-col gap-2 px-6 pt-3 pb-2 [background:var(--surface-elevated)] [border-bottom:1px_solid_var(--border)]">
        {/* The announcement is a separate, debounced, text-only live region (below): this bar
            changes on every keystroke and carries buttons, so making it live re-read the whole
            thing, labels included, on each character typed. */}
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          {validation.allocationExceedsAmount ? (
            <p className="flex min-w-[11rem] flex-1 flex-wrap items-center gap-x-2 [font-size:12.5px] [color:var(--destructive)]">
              <span className="font-medium tabular-nums">
                {t("allocations.totalsOver", {
                  amount: formatAmountWithSymbol(overMinor, currencyCode || "USD", locale),
                })}
              </span>
              {culpritKey && (
                <span>{t("allocations.overCulprit", { name: labelByKey.get(culpritKey) ?? restLabel })}</span>
              )}
            </p>
          ) : dateBlockedOrder ? (
            <p className="min-w-[11rem] flex-1 [font-size:12.5px] [color:var(--destructive)]">
              {t("allocations.dateBeforeOrderLine", { order: dateBlockedOrder.humanReadableId })}
            </p>
          ) : (
            // The remainder leads because it is the figure the collector is working down; what is
            // already assigned, out of how much, is its context.
            <p className="flex min-w-[11rem] flex-1 flex-col tabular-nums">
              <span className="[font-size:13px] font-medium [color:var(--text-primary)]">
                {hasParkedMoney
                  ? t("allocations.totalsParked", {
                      amount: formatAmountWithSymbol(validation.parkedAmountMinor, currencyCode || "USD", locale),
                    })
                  : t("allocations.totalsUnassigned", {
                      amount: formatAmountWithSymbol(validation.unallocatedMinor, currencyCode || "USD", locale),
                    })}
              </span>
              <span className="[font-size:11.5px] [color:var(--text-muted)]">
                {t("allocations.totalsAssigned", {
                  assigned: formatAmountWithSymbol(validation.sumAllocatedMinor, currencyCode || "USD", locale),
                  payment: formatAmountWithSymbol(paymentAmountMinor, currencyCode || "USD", locale),
                })}
              </span>
            </p>
          )}
          {/* `ml-auto` keeps the actions right-aligned once the bar wraps them onto their own line,
              which it does on a phone as soon as there are two of them: squeezing them beside the
              figures broke "S/ 619.00" across lines instead. */}
          <span className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1">
            {validation.allocationExceedsAmount && culpritKey && (
              <Button variant="ghost" size="sm" onClick={() => revealLine(culpritKey)}>
                {t("allocations.viewLine")}
              </Button>
            )}
            {dateBlockedOrder && !validation.allocationExceedsAmount && (
              <Button variant="ghost" size="sm" onClick={onEditDate}>
                {t("allocations.goToDate")}
              </Button>
            )}
            {/* The explicit "no sé todavía" affordance (WO-09, `FR-05-58`/`FR-05-60`): choosing it
                parks exactly the current remainder, on purpose, never a default. Lives next to the
                remaining-amount figure it resolves, and flips to an undo once chosen so the
                collector can still name the money after all. */}
            {canParkRemainder && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onParkRemainder}
                aria-label={t("allocations.parkRemainderAria", {
                  amount: formatAmountWithSymbol(validation.unallocatedMinor, currencyCode || "USD", locale),
                })}
              >
                {t("allocations.parkRemainder")}
              </Button>
            )}
            {hasParkedMoney && !validation.allocationExceedsAmount && !dateBlockedOrder && (
              <Button variant="ghost" size="sm" onClick={onUnpark} aria-label={t("allocations.unparkAria")}>
                {t("allocations.unpark")}
              </Button>
            )}
            {validation.sumAllocatedMinor > 0 && (
              <Button variant="ghost" size="sm" onClick={onClear} aria-label={t("allocations.clearAria")}>
                {t("allocations.clear")}
              </Button>
            )}
          </span>
        </div>

        {/* The payment-level twin of the no-amount notice, and the visible half of what every fill
            button of the list is saying at this moment. Without it, a fully assigned payment left
            the whole list inert with the reason reachable only through each control's accessible
            description. `unallocatedMinor` floors at 0, so this covers landing exactly on the
            payment; going over is the destructive line's business. */}
        {status === "ready" &&
          lines.length > 0 &&
          paymentAmountMinor > 0 &&
          !validation.allocationExceedsAmount &&
          validation.unallocatedMinor === 0 && (
            <p className="[font-size:11.5px] [color:var(--text-secondary)]">{t("allocations.fillDisabledPayment")}</p>
          )}

        {showSearch && (
          <SearchInput
            size="sm"
            value={query}
            onChange={setQuery}
            onSubmit={handleSearchSubmit}
            placeholder={t("allocations.searchPlaceholder")}
            searchLabel={t("allocations.searchLabel")}
          />
        )}

        {/* Same grid as the rows, inside the same 12px inset, so each label sits over its column. The
            shortcut column has no label: its buttons already say "Máx." on every row. */}
        {status === "ready" && lines.length > 0 && (
          <div className="-mx-3 hidden grid-cols-[minmax(0,1fr)_auto_140px] gap-x-3 px-3 [font-family:var(--font-mono)] [font-size:11px] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase md:grid">
            <span>
              {t("allocations.colProduct")}
              <span className="ml-2 [font-family:var(--font-sans)] [letter-spacing:normal] normal-case">
                {t("allocations.sortCaption")}
              </span>
            </span>
            <span aria-hidden />
            <span className="text-right">{t("allocations.colAmount")}</span>
          </div>
        )}
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>

      {/* The rows carry a 12px inset so their invalid marker can sit in the gutter; pulling the list
          out by the same 12px lands every name, button and field on the modal's own content edges,
          the ones the search, the recap and the footer already use. */}
      <div ref={listRef} className="-mx-3 pt-1">
        {renderList()}
      </div>
    </div>
  );
}

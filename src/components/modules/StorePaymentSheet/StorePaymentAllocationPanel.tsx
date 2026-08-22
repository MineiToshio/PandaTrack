"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PackageOpen } from "lucide-react";
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
  onEditPayment: () => void;
  onEditDate: () => void;
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
              className="grid min-h-[52px] grid-cols-[1fr_96px] items-center gap-3 px-3 py-1.5 md:grid-cols-[1fr_120px_140px]"
            >
              <span className="flex flex-col gap-1.5">
                <Skeleton variant="text" width="60%" height={12} />
                <Skeleton variant="text" width="30%" height={10} />
              </span>
              <Skeleton className="hidden md:block" variant="text" height={12} />
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Recap of what Panel A holds, so the collector never loses sight of the payment being split. */}
      {/* `shrink-0` is load-bearing, not decoration. An explicit `min-h` on a flex item replaces the
          automatic `min-height: auto` that would otherwise stop the item at its own content, so this
          strip stays clamped at 36px once it WRAPS, which it does at 375px (its content needs ~339px
          of the ~327px available). Measured in Chromium: `offsetHeight` 36 against a `scrollHeight`
          of 55. The wrapped line then paints outside the box and the "Editar monto o fecha" button
          covers the first line of the notice below it. `shrink-0` hands the strip its content height
          back. At ≥768px it never wraps, so the 36px floor governs with or without this. */}
      <div className="mb-3 flex min-h-[36px] shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="[font-size:12.5px] font-medium [color:var(--text-primary)] tabular-nums">
          {formatAmountWithSymbol(paymentAmountMinor, currencyCode || "USD", locale)}
          {paymentDate ? ` · ${formatDomainDate(paymentDate, locale)}` : ""}
        </p>
        <Button variant="ghost" size="sm" onClick={onEditPayment}>
          {t("allocations.recapEdit")}
        </Button>
      </div>

      {status === "ready" && lines.length > 0 && paymentAmountMinor <= 0 && (
        <p className="mb-2 [font-size:11.5px] leading-relaxed [color:var(--text-secondary)]">
          {t("allocations.noAmountNotice")}
        </p>
      )}

      {/* The payment-level twin of the notice above, and the visible half of what every fill button
          of the list is saying at this moment. Without it, a fully assigned payment left the whole
          list inert with the reason reachable only through each control's accessible description:
          the collector sees dimmed buttons and no words. `unallocatedMinor` floors at 0, so this
          covers landing exactly on the payment; going over is the destructive bar's business. */}
      {status === "ready" &&
        lines.length > 0 &&
        paymentAmountMinor > 0 &&
        !validation.allocationExceedsAmount &&
        validation.unallocatedMinor === 0 && (
          <p className="mb-2 [font-size:11.5px] leading-relaxed [color:var(--text-secondary)]">
            {t("allocations.fillDisabledPayment")}
          </p>
        )}

      {validation.sumAllocatedMinor === 0 && status === "ready" && lines.length > 0 && paymentAmountMinor > 0 && (
        <p className="mb-2 [font-size:11.5px] leading-relaxed [color:var(--text-muted)]">{t("allocations.hint")}</p>
      )}

      {/* The announcement is a separate, debounced, text-only live region (below): this bar changes
          on every keystroke and carries buttons, so making it live re-read the whole thing — labels
          included — on each character typed. */}
      {/* `shrink-0` for the same reason as the recap strip above, and this one clamps harder: at
          375px its text plus "Ver" / "Limpiar" wrap to ~70px inside a 28px box. The 28px floor is
          also below the 32px of a `size="sm"` button, so with a button present the bar sits at 32px
          at every width now instead of letting it hang 2px out of each end. */}
      <div className="mb-2 flex min-h-[28px] shrink-0 flex-wrap items-center justify-between gap-2 [font-size:12px]">
        {validation.allocationExceedsAmount ? (
          <span className="flex flex-wrap items-center gap-2 [color:var(--destructive)]">
            <span className="tabular-nums">
              {t("allocations.totalsOver", {
                amount: formatAmountWithSymbol(overMinor, currencyCode || "USD", locale),
              })}
            </span>
            {culpritKey && (
              <span>{t("allocations.overCulprit", { name: labelByKey.get(culpritKey) ?? restLabel })}</span>
            )}
          </span>
        ) : dateBlockedOrder ? (
          <span className="flex flex-wrap items-center gap-2 [color:var(--destructive)]">
            <span>{t("allocations.dateBeforeOrderLine", { order: dateBlockedOrder.humanReadableId })}</span>
            <Button variant="ghost" size="sm" onClick={onEditDate}>
              {t("allocations.goToDate")}
            </Button>
          </span>
        ) : (
          <span className="[color:var(--text-secondary)] tabular-nums">
            {t("allocations.totalsAssigned", {
              assigned: formatAmountWithSymbol(validation.sumAllocatedMinor, currencyCode || "USD", locale),
              payment: formatAmountWithSymbol(paymentAmountMinor, currencyCode || "USD", locale),
            })}
            {" · "}
            {hasParkedMoney
              ? t("allocations.totalsParked", {
                  amount: formatAmountWithSymbol(validation.parkedAmountMinor, currencyCode || "USD", locale),
                })
              : t("allocations.totalsUnassigned", {
                  amount: formatAmountWithSymbol(validation.unallocatedMinor, currencyCode || "USD", locale),
                })}
          </span>
        )}
        <span className="flex shrink-0 items-center gap-1">
          {validation.allocationExceedsAmount && culpritKey && (
            <Button variant="ghost" size="sm" onClick={() => revealLine(culpritKey)}>
              {t("allocations.viewLine")}
            </Button>
          )}
          {/* The explicit "no sé todavía" affordance (WO-09, `FR-05-58`/`FR-05-60`): choosing it
              parks exactly the current remainder, on purpose, never a default. Lives next to the
              remaining-amount figure it resolves, and flips to an undo once chosen so the collector
              can still name the money after all. */}
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

      {showSearch && (
        <div className="mb-2">
          <SearchInput
            size="sm"
            value={query}
            onChange={setQuery}
            onSubmit={handleSearchSubmit}
            placeholder={t("allocations.searchPlaceholder")}
            searchLabel={t("allocations.searchLabel")}
          />
        </div>
      )}

      {status === "ready" && lines.length > 0 && (
        <div className="hidden grid-cols-[1fr_120px_140px] gap-3 px-3 pb-1 [font-family:var(--font-mono)] [font-size:11px] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase md:grid">
          <span>
            {t("allocations.colProduct")}
            <span className="ml-2 [font-family:var(--font-sans)] [letter-spacing:normal] normal-case">
              {t("allocations.sortCaption")}
            </span>
          </span>
          <span className="text-right">{t("allocations.colFill")}</span>
          <span className="text-right">{t("allocations.colAmount")}</span>
        </div>
      )}

      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>

      {/* Full-bleed against the modal body's 24px padding: the name column is the scarce resource. */}
      <div ref={listRef} className="-mx-6 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {renderList()}
      </div>
    </div>
  );
}

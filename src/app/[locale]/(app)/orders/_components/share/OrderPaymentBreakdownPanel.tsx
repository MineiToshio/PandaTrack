"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight } from "lucide-react";
import ToggleChoiceGroup from "@/components/core/ToggleChoiceGroup";
import { TOTALS_ANNOUNCE_DELAY_MS } from "@/lib/constants";
import { formatAmountSymbolOnly } from "@/lib/currency";
import { sanitizeDecimalInput } from "@/lib/decimalInput";
import { parseDecimalToMinorUnits } from "@/lib/money/parseDecimalToMinorUnits";
import { cn } from "@/lib/styles";
import {
  buildBreakdownContext,
  minorToInputString,
  offersSplitModeChoice,
  recomputeBreakdown,
  type BreakdownContext,
  type BreakdownDerived,
  type BreakdownItem,
  type BreakdownPanelState,
} from "@/lib/orders/orderPaymentBreakdown";
import OrderPaymentBreakdownRow, { breakdownMessageId } from "./OrderPaymentBreakdownRow";

/**
 * Every DOM id in this panel is derived from the caller's `instanceId`, and none of them is a
 * module constant any more.
 *
 * Module constants were fine while the order detail was the only consumer, because one form holds
 * one panel. The review screen holds ONE PER PAYMENT ROW, and with two on screen the section id,
 * the trigger's `aria-controls`, the empty-amount reason and every row's fact/message/reason node
 * collide at once: `aria-controls`, `aria-expanded` and `aria-describedby` all resolve to the wrong
 * panel's nodes, or to whichever one the document happened to render first.
 *
 * The ids are NOT byte-for-byte what they used to be on the detail (the panel prefixed its own
 * `order-payment-breakdown-` and the rows a different `order-breakdown-`, which one instance id
 * cannot reproduce at once), and nothing asserted them. What has to hold, and what the tests
 * measure, is that every reference points at a node that exists and that no two panels share one.
 */
function panelSectionId(instanceId: string): string {
  return `${instanceId}-breakdown`;
}

function needsAmountId(instanceId: string): string {
  return `${instanceId}-breakdown-needs-amount`;
}

function overPaymentId(instanceId: string): string {
  return `${instanceId}-breakdown-over`;
}

/**
 * Which quantity the printed percentage is measured against. It chooses COPY and never arithmetic:
 * it enters no formula, never reaches `resolveSplitDenominator`, and moves no figure.
 *
 * The order detail always says `"order"`, because a payment there is always weighed against the
 * whole order. The review screen says `"order"` on the first payment row (where the remaining
 * balance IS the total) and `"remaining"` from the second on, where the denominator is what the
 * rows above left unpaid. Printing "% of the order" on both would put two percentages measured
 * against two different things ten centimetres apart under one label.
 *
 * The label names the BASE, not the exact value: the guard that keeps the applied and the printed
 * denominator identical can raise it above that base (a discounted order does the same thing to
 * "del pedido" on the detail today). Naming the base is the same trade the detail already made.
 */
export type BreakdownPercentBasis = "order" | "remaining";

export type OrderPaymentBreakdownPanelProps = {
  /**
   * Namespace for every DOM id this panel and its rows mint. Must be unique among the panels
   * mounted at the same time: `"order-payment"` on the detail, `"intake-payment-<row>"` on the
   * review screen, where several are on screen at once.
   */
  instanceId: string;
  /** Which quantity the printed percentage names. Copy only; see {@link BreakdownPercentBasis}. */
  percentBasis: BreakdownPercentBasis;
  state: BreakdownPanelState;
  onStateChange: (next: BreakdownPanelState) => void;
  ctx: BreakdownContext;
  derived: BreakdownDerived;
  /** Money already on this order naming no product. Named here, never split (ADR 0026 §6). */
  undetailedPaidMinor: number;
  currencyCode: string;
  locale: string;
  /** The submission is in flight: every control in the panel goes inert. */
  disabled: boolean;
  /** The product the server named in its refusal, so its row carries the destructive rail. */
  refusedItemId: string | null;
};

/**
 * "Split this payment across the products", as a folded block inside the inline payment form.
 *
 * The panel answers one question and refuses the other. It does NOT say what each product still
 * owes: every one of the orders that can reach this panel already carries money declared against no
 * product in particular, so that figure does not exist and any attempt at it (prorating the pool
 * backwards) was measured wrong by 47% to 72% on the collector's own history and rejected twice.
 * What it says is how much of THIS payment names each product, which is a decision rather than a
 * deduction, and the order's balance moves exactly the same whether it is split or not.
 *
 * The consequence for the layout is the rule that governs every figure in here: the budget is named
 * ONCE, above the list, and no row prints anything derived from the payment. Amounts inside the
 * list must PARTITION the payment (the N fields add up to at most the payment), never REPLICATE it
 * (N per-row ceilings add up to N times the payment). See the row for the other half.
 *
 * One layout serves both breakpoints on purpose. The desktop aside is ~300px wide and the mobile
 * sheet ~327px: two narrow columns, so a two-column desktop variant would be a design for a width
 * that does not exist here. What changes is row height and the list's own scroll ceiling.
 */
export default function OrderPaymentBreakdownPanel({
  instanceId,
  percentBasis,
  state,
  onStateChange,
  ctx,
  derived,
  undetailedPaidMinor,
  currencyCode,
  locale,
  disabled,
  refusedItemId,
}: OrderPaymentBreakdownPanelProps) {
  const t = useTranslations("orders.payments.breakdown");
  const money = (minor: number) => formatAmountSymbolOnly(minor, currencyCode, locale);

  const sectionId = panelSectionId(instanceId);
  const emptyAmountId = needsAmountId(instanceId);
  const overId = overPaymentId(instanceId);

  const { entries, foot, eligibleCount } = derived;
  const hasAmount = ctx.paymentAmountMinor > 0;
  const showModeChoice = offersSplitModeChoice(ctx.lines);

  /**
   * The fold, and nothing OR-ed onto it.
   *
   * A draft the form is refusing does still have to be reachable (the refusal and the fields that
   * resolve it both live inside this section, and the CTA is dead while `blocked`), but that is
   * settled upstream, once, by the latch in `recomputeBreakdown`. Repeating it here as
   * `state.isOpen || derived.blocked` was the bug: the term only ever mattered while `state.isOpen`
   * was false, and in exactly that case it withdrew the section the instant the collector fixed the
   * line, with the caret still in the field they were typing into.
   */
  const isOpen = state.isOpen;

  /**
   * Which node says why the panel will not fold: the foot's own error when the draft outruns the
   * payment, the offending row's message when a line outruns its own price. One of the two always
   * exists while `blocked` holds, because those are the two things `blocked` means.
   */
  const blockedReasonId = foot.isOverPayment
    ? overId
    : (() => {
        const offender = entries.find((entry) => entry.state === "overBase");
        return offender ? breakdownMessageId(instanceId, offender.line.itemId) : undefined;
      })();

  /**
   * One announcement, debounced, naming the RESULT and not just the running total.
   *
   * Ticking one box rewrites N fields at once and typing rewrites them per keystroke, so an
   * undebounced region reads a total per character. The second sentence is the order's own balance,
   * which is the one figure a screen reader cannot rebuild by tabbing through the fields — and it is
   * the SAME sentence the visible foot prints, settled case included: announcing "will still owe
   * S/ 0,00" under a foot that reads "this order is settled" is one screen saying two things.
   */
  const announcement = foot.isOrderSettledAfter
    ? t("announceSettled", { assigned: money(foot.assignedMinor), payment: money(ctx.paymentAmountMinor) })
    : t("announce", {
        assigned: money(foot.assignedMinor),
        payment: money(ctx.paymentAmountMinor),
        remaining: money(foot.orderRemainingAfterMinor),
      });
  const [settledAnnouncement, setSettledAnnouncement] = useState("");
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => setSettledAnnouncement(announcement), TOTALS_ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [announcement, isOpen]);

  function commit(next: BreakdownPanelState) {
    onStateChange(recomputeBreakdown(next, ctx));
  }

  function handleToggleOpen() {
    onStateChange({ ...state, isOpen: !state.isOpen });
  }

  function handleToggleLine(itemId: string, selected: boolean) {
    const rawByItemId = { ...state.rawByItemId };
    delete rawByItemId[itemId];
    commit({
      ...state,
      rawByItemId,
      lastEditedItemId: selected ? itemId : state.lastEditedItemId,
      draft: state.draft.map((entry) =>
        entry.itemId === itemId
          ? { ...entry, selected, pinned: false, amountMinor: selected ? entry.amountMinor : 0 }
          : entry,
      ),
    });
  }

  /**
   * Typing PINS the line: from the first keystroke no recalculation may write into it again. A
   * split that erases a number the collector typed is not a UX slip, it is the app overruling a
   * declaration, and it is the one thing this panel may never do.
   */
  function handleChangeLine(itemId: string, raw: string) {
    const sanitized = sanitizeDecimalInput(raw, currencyCode);
    const parsed = parseDecimalToMinorUnits(sanitized, currencyCode);
    commit({
      ...state,
      rawByItemId: { ...state.rawByItemId, [itemId]: sanitized },
      lastEditedItemId: itemId,
      draft: state.draft.map((entry) =>
        entry.itemId === itemId ? { ...entry, selected: true, pinned: true, amountMinor: parsed ?? 0 } : entry,
      ),
    });
  }

  /**
   * Emptying a line releases it back to the split, but only once the caret has LEFT it.
   *
   * Releasing on the keystroke that empties it would mean that clearing "30.00" to type something
   * else fires a split that writes a number into the field with the cursor inside it — the one
   * place this panel would otherwise overwrite what the collector is in the middle of saying.
   */
  function handleBlurLine(itemId: string) {
    const raw = state.rawByItemId[itemId];
    if (raw === undefined || raw.trim() !== "") return;
    const rawByItemId = { ...state.rawByItemId };
    delete rawByItemId[itemId];
    commit({
      ...state,
      rawByItemId,
      draft: state.draft.map((entry) => (entry.itemId === itemId ? { ...entry, pinned: false } : entry)),
    });
  }

  /** The full manual exit: write the largest legal amount into this line and pin it there. */
  function handleFillLine(itemId: string) {
    const entry = entries.find((candidate) => candidate.line.itemId === itemId);
    if (!entry) return;
    const amountMinor = entry.fillableMinor;
    commit({
      ...state,
      rawByItemId: { ...state.rawByItemId, [itemId]: minorToInputString(amountMinor, currencyCode) },
      lastEditedItemId: itemId,
      draft: state.draft.map((line) =>
        line.itemId === itemId ? { ...line, selected: true, pinned: true, amountMinor } : line,
      ),
    });
  }

  /**
   * Ticks every product this payment can still name, and lets the SPLIT fill them in.
   *
   * It writes `selected` and nothing else: the amounts come out of `recomputeBreakdown` like they
   * do for any other tick, so the rule the caption states stays true of what lands in the fields.
   * Marking without splitting would leave N ticked boxes over N empty fields and emit nothing.
   *
   * `pinned` is carried through untouched, so a line the collector typed into is still theirs (I-2).
   * The opposite of this control already exists in the foot ("Limpiar"), so there is no second one
   * here: what was missing is only the bulk tick, for the 23 orders of ten products or more.
   */
  function handleSelectAll() {
    const eligibleItemIds = new Set(ctx.lines.filter((line) => line.eligible).map((line) => line.itemId));
    commit({
      ...state,
      draft: state.draft.map((entry) => (eligibleItemIds.has(entry.itemId) ? { ...entry, selected: true } : entry)),
    });
  }

  function handleClear() {
    commit({
      ...state,
      rawByItemId: {},
      lastEditedItemId: null,
      draft: state.draft.map((entry) => ({ ...entry, selected: false, pinned: false, amountMinor: 0 })),
    });
  }

  function handleModeChange(value: string) {
    commit({ ...state, mode: value === "equal" ? "equal" : "byPrice" });
  }

  /** What the fold says while it is folded: nothing, or the whole answer without opening it. */
  const summary =
    foot.emittedLineCount > 0
      ? t("toggleSummary", {
          count: foot.emittedLineCount,
          total: eligibleCount,
          amount: money(foot.assignedMinor),
        })
      : t("toggle");

  const caption = resolveCaption();

  function resolveCaption(): string | null {
    const ticked = entries.filter((entry) => entry.draft.selected && entry.line.eligible);
    if (ticked.length === 0) return null;
    if (state.mode === "equal") {
      const amounts = ticked.map((entry) => entry.draft.amountMinor);
      const min = Math.min(...amounts);
      const max = Math.max(...amounts);
      return min === max
        ? t("captionEqual", { amount: money(min) })
        : t("captionEqualRange", { min: money(min), max: money(max) });
    }
    // By price, in the order the states are told apart: nothing to weigh, then a panel whose
    // sentence is only true of some of its rows, then a row cut short, then the plain rule.
    if (derived.pricedTickedCount === 0) return t("captionByPriceNoWeight");
    if (derived.weightlessCount > 0) return t("captionByPriceMixed");
    if (derived.clampedCount > 0) return t("captionByPriceClamped");
    return t("captionByPrice");
  }

  /**
   * The residual, told apart by WHY it exists. These two are the two terms of `BR-05-24` and both
   * can be true at once (an order with shipping whose products are also already covered), so both
   * may show; the third explanation below belongs to the other mode entirely.
   */
  const sumEligiblePrices = ctx.lines
    .filter((line) => line.eligible)
    .reduce((sum, line) => sum + Math.max(0, line.basePagableMinor ?? 0), 0);
  const showResidualUnpriced =
    state.mode === "byPrice" &&
    foot.residualMinor > 0 &&
    derived.pricedTickedCount > 0 &&
    sumEligiblePrices < ctx.orderTotalCostMinor;
  const showResidualClamped = state.mode === "byPrice" && foot.residualMinor > 0 && derived.clampedCount > 0;
  /**
   * `footCapped` is the EQUAL-parts explanation, and only that.
   *
   * All three of these lines print the whole residual, so more than one of them is one figure with
   * two reasons. Equal parts fills every ticked line to its ceiling, so "the ticked products cannot
   * take more" IS why money is left over there. By price it is not: the residual has the closed form
   * of `BR-05-24` (`pct × (denom − Σ precios) + Σ sobrantes de tope`), whose two terms are exactly
   * the two lines below, and the split never tried to hand a line more than its own quota — so
   * pointing at the ceilings would name a constraint that never bound.
   */
  const showCapped = state.mode === "equal" && foot.capped;

  return (
    <div className="mb-2.5">
      {/* `aria-disabled` for the reason, `disabled` only for the flight.
          Two states in which this control cannot act, and each owes a sentence: no amount yet, and
          a draft the panel is refusing (which holds the panel open, so folding is what it cannot
          do). Both keep it focusable and carry the sentence in `aria-describedby`, because
          `disabled` would drop it out of the tab order, never read its name, and park the
          explanation in a paragraph nothing points at (`docs/design/interface-patterns.md` §14,
          precedent `StorePaymentAllocationRow`). The click is a no-op in both, rather than a fold
          that silently arms itself for the moment the error clears. While the submission is in
          flight there is no sentence to lose and the whole panel is inert (E12), so that case keeps
          the real `disabled`. */}
      <button
        type="button"
        onClick={hasAmount && !derived.blocked ? handleToggleOpen : undefined}
        disabled={disabled}
        aria-disabled={!hasAmount || derived.blocked || undefined}
        aria-describedby={hasAmount ? blockedReasonId : emptyAmountId}
        aria-expanded={isOpen}
        aria-controls={sectionId}
        className={cn(
          "inline-flex min-h-10 w-full items-center gap-1.5 rounded-lg px-2 py-2 text-left text-[13px]",
          "[color:var(--text-secondary)] transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]",
          "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:[background:transparent]",
          hasAmount
            ? "hover:[background:color-mix(in_oklch,var(--text-primary)_5%,transparent)]"
            : "cursor-default opacity-60",
        )}
      >
        {isOpen ? (
          <ChevronDown className="size-3.5 shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="size-3.5 shrink-0" aria-hidden />
        )}
        <span className="min-w-0 flex-1">{summary}</span>
      </button>

      {/* The trigger stays put and greys out rather than disappearing while the amount is empty:
          a control that vanishes and comes back on the first keystroke moves the submit button
          under the collector's thumb. */}
      {!hasAmount && (
        <p id={emptyAmountId} className="mt-1 px-2 text-[12px] [color:var(--text-muted)]">
          {t("needsAmount")}
        </p>
      )}

      {isOpen && hasAmount && (
        <section
          id={sectionId}
          className="mt-2 rounded-[var(--radius-md)] p-2.5 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]"
        >
          <p className="text-[12px] leading-[17px] [color:var(--text-secondary)]">{t("intro")}</p>

          {/* The pool of money already on this order that names no product: stated where it is,
              never split backwards across the products. It is why no row can show a "still owed". */}
          {undetailedPaidMinor > 0 && (
            <div className="mt-2 rounded-[var(--radius-md)] p-2 text-[12px] leading-[17px] [color:var(--text-secondary)] [background:color-mix(in_oklch,var(--info)_8%,transparent)]">
              <p>{t("pozo", { amount: money(undetailedPaidMinor) })}</p>
              <p className="mt-1">{t("pozoExplain")}</p>
              <p className="mt-1 [color:var(--text-muted)]">{t("pozoRetro")}</p>
            </div>
          )}

          {/* THE one live figure, and it lives outside the list so it never enters the sum that
              I-1b caps. The percentage rides with it, once, because it is the input to the rule
              every row's amount comes out of. */}
          <p className="mt-2.5 text-[13px] font-semibold [color:var(--text-primary)] tabular-nums">
            {state.mode === "byPrice" && derived.percent > 0
              ? derived.percent < 1
                ? t(percentBasis === "remaining" ? "budgetPercentRemainingTiny" : "budgetPercentTiny", {
                    amount: money(foot.residualMinor),
                  })
                : t(percentBasis === "remaining" ? "budgetPercentRemaining" : "budgetPercent", {
                    amount: money(foot.residualMinor),
                    pct: Math.round(derived.percent),
                  })
              : t("budget", { amount: money(foot.residualMinor) })}
          </p>

          {/* "Marcar todos" rides on this row whichever of the two things it holds, and that is the
              point: anchored to the mode chips alone it would vanish in E4 (no product has a price),
              which is exactly the state where ticking N boxes by hand IS all the work there is. */}
          <div className="mt-1.5 flex items-start justify-between gap-2">
            {showModeChoice ? (
              <div role="group" aria-label={t("modeLabel")}>
                <ToggleChoiceGroup
                  mode="single"
                  appearance="chip"
                  value={state.mode}
                  onChange={handleModeChange}
                  disabled={disabled}
                  itemClassName="px-2.5 py-1 text-[12px]"
                  options={[
                    { value: "byPrice", label: t("modeByPrice") },
                    { value: "equal", label: t("modeEqual") },
                  ]}
                />
              </div>
            ) : (
              // A control that can do nothing in four orders out of five is noise; a sentence that
              // says why the choice is not there is information.
              <p className="text-[12px] [color:var(--text-muted)]">{t("equalOnlyReason")}</p>
            )}

            {/* A button with a visible word, never a tri-state checkbox: there is no indeterminate
                state to announce here, and a button says what it does. It carries no figure, so it
                stays outside I-1b's reach. */}
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={disabled}
              className={cn(
                "shrink-0 rounded-md px-1.5 py-1 text-[12px] [color:var(--accent)] underline-offset-2 hover:underline",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {t("selectAll")}
            </button>
          </div>

          {caption && <p className="mt-1 text-[12px] [color:var(--text-muted)]">{caption}</p>}

          <ul
            role="list"
            aria-label={t("listAria")}
            className="mt-1.5 max-h-[45vh] list-none overflow-y-auto md:max-h-[340px]"
          >
            {entries.map((entry) => (
              <OrderPaymentBreakdownRow
                key={entry.line.itemId}
                instanceId={instanceId}
                line={entry.line}
                state={entry.state}
                selected={entry.draft.selected}
                pinned={entry.draft.pinned}
                value={entry.value}
                fillableMinor={entry.fillableMinor}
                isRefused={refusedItemId === entry.line.itemId}
                currencyCode={currencyCode}
                locale={locale}
                disabled={disabled}
                onToggle={handleToggleLine}
                onChange={handleChangeLine}
                onBlurLine={handleBlurLine}
                onFill={handleFillLine}
              />
            ))}
          </ul>

          <div className="border-border mt-2 space-y-0.5 border-t pt-2 text-[12px] tabular-nums">
            {/* Line 1 — this PAYMENT. Replaced wholesale by the error when the draft outruns it. */}
            {foot.isOverPayment ? (
              <p id={overId} className="text-destructive">
                {t("overPayment", { amount: money(foot.overMinor) })}
                {derived.overCulprit ? ` ${t("overCulprit", { name: derived.overCulprit.name })}` : ""}
              </p>
            ) : (
              <p className="[color:var(--text-secondary)]">
                {t("footAssigned", { assigned: money(foot.assignedMinor), payment: money(ctx.paymentAmountMinor) })}
                {" · "}
                {t("footResidual", { amount: money(foot.residualMinor) })}
              </p>
            )}

            {showCapped && (
              <p className="[color:var(--text-muted)]">{t("footCapped", { amount: money(foot.residualMinor) })}</p>
            )}
            {showResidualUnpriced && (
              <p className="[color:var(--text-muted)]">
                {t("footResidualUnpriced", { amount: money(foot.residualMinor) })}
              </p>
            )}
            {showResidualClamped && (
              <p className="[color:var(--text-muted)]">
                {t("footResidualClamped", { amount: money(foot.residualMinor) })}
              </p>
            )}
            {foot.pinnedCount > 0 && (
              <p className="[color:var(--text-muted)]">{t("pinnedCount", { count: foot.pinnedCount })}</p>
            )}

            {/* Line 2 — this ORDER, and it is a different equation. The whole payment lands on this
                order whatever the split says, so ticking, typing and clearing must never move it. */}
            <div className="flex items-baseline justify-between gap-2 pt-0.5">
              <p className="[color:var(--text-secondary)]">
                {foot.isOrderSettledAfter
                  ? t("footOrderSettled")
                  : t("footOrderAfter", { amount: money(foot.orderRemainingAfterMinor) })}
              </p>
              <button
                type="button"
                onClick={handleClear}
                disabled={disabled}
                aria-label={t("clearAria")}
                className={cn(
                  "shrink-0 rounded-md px-1.5 py-1 [color:var(--accent)] underline-offset-2 hover:underline",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)]",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                {t("clear")}
              </button>
            </div>
          </div>

          <p role="status" aria-live="polite" className="sr-only">
            {settledAnnouncement}
          </p>
        </section>
      )}
    </div>
  );
}

/** Memo helper so the form and the panel build the same context object once per render. */
export function useBreakdownContext(input: {
  items: BreakdownItem[];
  paymentAmountMinor: number;
  orderRemainingBalanceMinor: number;
  orderTotalCostMinor: number;
  currencyCode: string;
}): BreakdownContext {
  const { items, paymentAmountMinor, orderRemainingBalanceMinor, orderTotalCostMinor, currencyCode } = input;
  return useMemo(
    () =>
      buildBreakdownContext({
        items,
        paymentAmountMinor,
        orderRemainingBalanceMinor,
        orderTotalCostMinor,
        currencyCode,
      }),
    [items, paymentAmountMinor, orderRemainingBalanceMinor, orderTotalCostMinor, currencyCode],
  );
}

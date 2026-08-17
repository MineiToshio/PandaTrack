import { getCurrencyDecimals, MINOR_UNITS_PER_MAJOR } from "@/lib/currency";
import {
  resolveSplitDenominator,
  resolveSplitStep,
  splitByPriceLines,
  splitPaymentAmount,
  type PriceSplitLine,
  type SplitLine,
} from "./splitPaymentAmount";
import { computeFillableMinor, isItemOverRemainingBase } from "./storePaymentSheetValidation";

/**
 * The state of the "split this payment across the products" panel, as pure arithmetic.
 *
 * What this panel says, and the only thing it says: how much of THIS payment names each product.
 * It never says what a product still owes, because on an order that already holds money declared
 * against no product in particular that figure does not exist. And it never moves the order's
 * balance either: the whole payment lands on this order whatever the split says, so the foot's
 * second line ("this order will still owe X") is computed from the payment alone.
 *
 * Whatever the split does not place is the residual, written as one order-level line of the same
 * payment. That is what makes the algorithms' slack harmless: nothing is lost, it is only left
 * unattributed, and the foot names it.
 */

/** Which formula fills the lines the collector has not typed into by hand. */
export type BreakdownSplitMode = "byPrice" | "equal";

/** One product of the order, as the order detail already projects it. */
export type BreakdownItem = {
  itemId: string;
  name: string;
  /** Unit price x quantity, `null` when no price was captured. The weight of the by-price split. */
  basePagableMinor: number | null;
  /** Money already declared against THIS product by earlier payments. */
  allocatedMinor: number;
  /**
   * Whether the product already carries the collector's "paid" mark (ADR 0026). Read-only here: the
   * coverage axis is not edited from the payment form, it is stated on the product's own row. The
   * panel prints it as one more static fact so a row that is already marked does not look untouched.
   */
  paidDeclared?: boolean;
};

export type BreakdownLine = BreakdownItem & {
  /** What this product may still take, `null` when it has no price and therefore no ceiling. */
  remainingBaseMinor: number | null;
  /**
   * Whether the product is offered at all. A product whose price is already covered is not: it gets
   * a "Saldado" chip, no checkbox and no field. Offering a ticked box that can only ever produce a
   * zero-amount line the server refuses is the anti-pattern this flag exists to prevent.
   */
  eligible: boolean;
};

/** One row of the collector's working copy. */
export type BreakdownDraftLine = {
  itemId: string;
  /** The checkbox: "this payment covers this product". */
  selected: boolean;
  /**
   * Typed by hand. No recalculation may ever overwrite it: a split that erases a number the
   * collector typed is not a UX slip, it is the app overruling a declaration.
   */
  pinned: boolean;
  /** What the field holds, in minor units. 0 when empty. */
  amountMinor: number;
};

/** One line of the payload the write path receives. The order is implicit: it is this order. */
export type BreakdownAllocationInput = { orderItemId: string; amountMinor: number };

export type BreakdownLineState =
  /** Its price is already covered: not offered, not counted, not written. */
  | "settled"
  /** Typed above what this product may still take. Mirrors the server's `EXCEEDS_ITEM_BASE`. */
  | "overBase"
  /** Ticked, but the by-price split has no price to weigh it by, so it can only be typed in. */
  | "needsPrice"
  /** Ticked, and the payment has nothing left for it. Stays ticked, but is not written. */
  | "noRoom"
  | "assignable";

export type BreakdownFoot = {
  /** A: everything this draft names a product for. */
  assignedMinor: number;
  /** `P - A`, never negative: an over-allocation is an error, not a negative counter. */
  residualMinor: number;
  /** `A - P` when the draft outruns the payment. */
  overMinor: number;
  isOverPayment: boolean;
  /**
   * How many lines are actually going to be written, which is NOT how many boxes are ticked: a
   * ticked line the payment has no room for produces nothing, and counting it would announce a
   * declaration that was never made.
   */
  emittedLineCount: number;
  pinnedCount: number;
  /** Every ticked product is at its ceiling and they still cannot absorb the payment. */
  capped: boolean;
  /**
   * What the order owes once this payment lands. Derived from the payment and the balance ONLY:
   * ticking, unticking, splitting, typing and clearing must never move this number, because the
   * split does not decide how much of the payment reaches the order (all of it does).
   */
  orderRemainingAfterMinor: number;
  isOrderSettledAfter: boolean;
};

export type ApplySplitInput = {
  mode: BreakdownSplitMode;
  lines: BreakdownLine[];
  draft: BreakdownDraftLine[];
  paymentAmountMinor: number;
  orderTotalCostMinor: number;
  step: number;
};

export type ApplySplitResult = {
  draft: BreakdownDraftLine[];
  /**
   * Products the by-price split had to cut short at their own ceiling.
   *
   * Threaded out of the split because it is the ONE fact about a line that only the split knows: it
   * is `quota > ceiling`, and the result alone cannot tell it from a line that lands exactly on its
   * ceiling by arithmetic. Reading it off the result instead ("amount >= remaining base") is how the
   * panel came to tell the collector "some products already had payments, so they get less" on the
   * final payment of an adelanto + final pair, where every line closes EXACTLY on its own price and
   * nobody received less.
   */
  clampedItemIds: string[];
};

/** Turns the order's products into lines, deciding which ones the panel may offer at all. */
export function buildBreakdownLines(items: BreakdownItem[]): BreakdownLine[] {
  return items.map((item) => {
    const remainingBaseMinor = item.basePagableMinor === null ? null : item.basePagableMinor - item.allocatedMinor;
    return {
      ...item,
      remainingBaseMinor,
      eligible: remainingBaseMinor === null || remainingBaseMinor > 0,
    };
  });
}

function hasPricedEligibleLine(lines: BreakdownLine[]): boolean {
  return lines.some((line) => line.eligible && line.basePagableMinor !== null && line.basePagableMinor > 0);
}

/**
 * The mode the panel opens in, decided by the ORDER and never remembered between orders or between
 * payments: proportional to price wherever there is a price to be proportional to, equal parts only
 * where there is none. A mode carried over from the previous session would split an order with
 * prices into equal parts without anyone asking, which is the exact complaint this panel answers.
 */
export function resolveDefaultSplitMode(lines: BreakdownLine[]): BreakdownSplitMode {
  return hasPricedEligibleLine(lines) ? "byPrice" : "equal";
}

/**
 * Whether the mode switch is rendered at all. With no price anywhere, "by price" can do nothing, so
 * the control is replaced by one line explaining why. A dead control in the majority of orders is
 * noise; a sentence is information.
 */
export function offersSplitModeChoice(lines: BreakdownLine[]): boolean {
  return hasPricedEligibleLine(lines);
}

/** Whether the panel is offered at all: with no eligible product there is nothing to split. */
export function hasEligibleLines(lines: BreakdownLine[]): boolean {
  return lines.some((line) => line.eligible);
}

/**
 * A ceiling the split may actually propose: a product's remaining base, rounded DOWN to the
 * currency's own smallest amount.
 *
 * Alignment lives here, in the caller, and not in the split functions, because it is currency
 * policy rather than arithmetic: a ceiling of 150 in a zero-decimal currency is not a legal
 * allocation amount, so proposing it would only earn a server refusal.
 */
function alignCeiling(remainingBaseMinor: number | null, step: number): number | null {
  if (remainingBaseMinor === null) return null;
  return Math.floor(Math.max(0, remainingBaseMinor) / step) * step;
}

/**
 * The single door into both formulas.
 *
 * It splits ONLY what the collector has not decided: lines they typed into are pinned, their
 * amounts are subtracted from the budget first, and no recalculation touches them again. Everything
 * else is rewritten from scratch on every tick, untick and mode change, so what is on screen is
 * always the whole answer for the current selection rather than a layer of edits over an older one.
 */
export function applySplit(input: ApplySplitInput): ApplySplitResult {
  const { mode, lines, draft, paymentAmountMinor, orderTotalCostMinor, step } = input;
  const draftByItemId = new Map(draft.map((line) => [line.itemId, line]));
  const lineByItemId = new Map(lines.map((line) => [line.itemId, line]));

  const isPinned = (entry: BreakdownDraftLine) => entry.selected && entry.pinned;
  const pinnedTotal = draft.filter(isPinned).reduce((sum, entry) => sum + entry.amountMinor, 0);
  const budgetMinor = Math.max(0, paymentAmountMinor - pinnedTotal);

  const targets = lines.filter((line) => {
    const entry = draftByItemId.get(line.itemId);
    return line.eligible && entry !== undefined && entry.selected && !entry.pinned;
  });

  const amountByItemId = new Map<string, number>();
  const clampedItemIds: string[] = [];

  if (mode === "equal") {
    const splitLines: SplitLine[] = targets.map((line) => ({
      key: line.itemId,
      capMinor: alignCeiling(line.remainingBaseMinor, step),
    }));
    splitPaymentAmount({ amountMinor: budgetMinor, lines: splitLines, step }).forEach((amountMinor, index) => {
      amountByItemId.set(targets[index].itemId, amountMinor);
    });
  } else {
    const splitLines: PriceSplitLine[] = targets.map((line) => ({
      key: line.itemId,
      baseMinor: line.basePagableMinor,
      capMinor: alignCeiling(line.remainingBaseMinor, step),
    }));
    splitByPriceLines({
      amountMinor: budgetMinor,
      totalCostMinor: orderTotalCostMinor,
      lines: splitLines,
      step,
    }).forEach((result, index) => {
      const target = targets[index];
      amountByItemId.set(target.itemId, result.amountMinor);
      if (result.clamped) clampedItemIds.push(target.itemId);
    });
  }

  return {
    draft: draft.map((entry) => {
      if (isPinned(entry)) return entry;
      const line = lineByItemId.get(entry.itemId);
      const eligible = line?.eligible ?? false;
      return { ...entry, selected: entry.selected && eligible, amountMinor: amountByItemId.get(entry.itemId) ?? 0 };
    }),
    clampedItemIds,
  };
}

/** What one row says about itself. Every reason is distinct: they send the collector elsewhere. */
export function resolveBreakdownLineState(input: {
  line: BreakdownLine;
  draft: BreakdownDraftLine;
  mode: BreakdownSplitMode;
}): BreakdownLineState {
  const { line, draft, mode } = input;
  if (!line.eligible) return "settled";
  if (isItemOverRemainingBase({ amountMinor: draft.amountMinor, remainingBaseMinor: line.remainingBaseMinor })) {
    return "overBase";
  }
  if (!draft.selected || draft.amountMinor > 0) return "assignable";
  // Ticked and still empty. Two different reasons with two different next steps: one asks for a
  // price (or for the other mode), the other says the payment simply ran out.
  if (mode === "byPrice" && (line.basePagableMinor === null || line.basePagableMinor <= 0)) return "needsPrice";
  return "noRoom";
}

/**
 * The payload, and the one place zero lines are dropped.
 *
 * A ticked line worth nothing is a real state (the collector ticked three products and typed the
 * whole payment into the first one), and the row says so on screen. What it must never do is travel
 * to the server, which refuses a zero-amount declaration outright: zero money covers nothing.
 */
export function buildBreakdownAllocations(draft: BreakdownDraftLine[]): BreakdownAllocationInput[] {
  return draft
    .filter((entry) => entry.selected && entry.amountMinor > 0)
    .map((entry) => ({ orderItemId: entry.itemId, amountMinor: entry.amountMinor }));
}

export function resolveBreakdownFoot(input: {
  paymentAmountMinor: number;
  /** `totalCost - allocatedAmountMinor` before this payment. */
  orderRemainingBalanceMinor: number;
  lines: BreakdownLine[];
  draft: BreakdownDraftLine[];
}): BreakdownFoot {
  const { paymentAmountMinor, orderRemainingBalanceMinor, lines, draft } = input;
  const lineByItemId = new Map(lines.map((line) => [line.itemId, line]));
  const emitted = buildBreakdownAllocations(draft);
  const assignedMinor = emitted.reduce((sum, allocation) => sum + allocation.amountMinor, 0);

  // What the ticked products could take between them, and whether that is less than the payment.
  // An unpriced product has no ceiling, so a selection holding one can always absorb everything.
  const ticked = draft.filter((entry) => entry.selected);
  const anyUnbounded = ticked.some((entry) => lineByItemId.get(entry.itemId)?.remainingBaseMinor == null);
  const ceilingTotal = ticked.reduce(
    (sum, entry) => sum + (lineByItemId.get(entry.itemId)?.remainingBaseMinor ?? 0),
    0,
  );

  return {
    assignedMinor,
    residualMinor: Math.max(0, paymentAmountMinor - assignedMinor),
    overMinor: Math.max(0, assignedMinor - paymentAmountMinor),
    isOverPayment: assignedMinor > paymentAmountMinor,
    emittedLineCount: emitted.length,
    pinnedCount: draft.filter((entry) => entry.selected && entry.pinned).length,
    capped: ticked.length > 0 && !anyUnbounded && ceilingTotal < paymentAmountMinor,
    orderRemainingAfterMinor: Math.max(0, orderRemainingBalanceMinor - paymentAmountMinor),
    isOrderSettledAfter: orderRemainingBalanceMinor - paymentAmountMinor <= 0,
  };
}

/**
 * Everything the collector has decided about the split, and nothing derived from it.
 *
 * Held by the FORM rather than by this panel, because the form needs three things out of it at
 * submit time (the lines to send, whether the draft is worth waiting for a verdict on, and which
 * formula produced it) and reading them back out of a child through an effect is how a panel and
 * the button that submits it end up disagreeing for one render.
 */
export type BreakdownPanelState = {
  isOpen: boolean;
  mode: BreakdownSplitMode;
  /** One entry per product of the order, ineligible ones included, so ids stay stable. */
  draft: BreakdownDraftLine[];
  /** Raw field text, kept only for a line the collector is typing into. */
  rawByItemId: Record<string, string>;
  /** Who to name when the draft outruns the payment: the line last touched, not the biggest. */
  lastEditedItemId: string | null;
  /**
   * What the LAST split had to cut short at a product's own ceiling, carried out of `applySplit`.
   *
   * The one thing here that is not a decision of the collector's, and it is here because it cannot
   * be recovered from anywhere else: "this line was clamped" is `quota > ceiling`, which the amounts
   * on screen cannot distinguish from a line that lands on its ceiling exactly. See
   * `ApplySplitResult.clampedItemIds` for the sentence that got told wrong without it.
   */
  clampedItemIds: string[];
};

/** Everything the split needs to run. Built identically by the panel and by the form. */
export type BreakdownContext = {
  lines: BreakdownLine[];
  paymentAmountMinor: number;
  /** `totalCost - allocated` BEFORE this payment. Only ever feeds the foot's second line. */
  orderRemainingBalanceMinor: number;
  orderTotalCostMinor: number;
  step: number;
};

export type BreakdownEntry = {
  line: BreakdownLine;
  draft: BreakdownDraftLine;
  state: BreakdownLineState;
  /** Exactly what the field shows. */
  value: string;
  /** What "Máx." writes, and what its accessible name promises. One figure, one source (I-1). */
  fillableMinor: number;
};

export type BreakdownDerived = {
  entries: BreakdownEntry[];
  foot: BreakdownFoot;
  allocations: BreakdownAllocationInput[];
  eligibleCount: number;
  /** The draft cannot be submitted: it outruns the payment, or a line outruns its own price. */
  blocked: boolean;
  /** Which line to point at when the draft outruns the payment. */
  overCulprit: BreakdownLine | null;
  /** The percentage of the order this payment is, printed once and only in by-price mode. */
  percent: number;
  /** Ticked products the by-price split could give nothing to, for want of a price. */
  weightlessCount: number;
  /** Ticked products the by-price split had to cut short at their own ceiling. */
  clampedCount: number;
  /** Ticked products that do carry a price. */
  pricedTickedCount: number;
};

export function buildBreakdownContext(input: {
  items: BreakdownItem[];
  paymentAmountMinor: number;
  orderRemainingBalanceMinor: number;
  orderTotalCostMinor: number;
  currencyCode: string;
}): BreakdownContext {
  return {
    lines: buildBreakdownLines(input.items),
    paymentAmountMinor: input.paymentAmountMinor,
    orderRemainingBalanceMinor: input.orderRemainingBalanceMinor,
    orderTotalCostMinor: input.orderTotalCostMinor,
    step: resolveSplitStep(input.currencyCode),
  };
}

/**
 * A fresh, folded, empty draft. The mode is decided by the ORDER (proportional wherever there is a
 * price, equal parts where there is none) and never carried over from a previous order or a
 * previous payment: a mode that survived the session would split an order with prices into equal
 * parts without anyone asking, which is the exact complaint this panel answers.
 */
export function createBreakdownState(items: BreakdownItem[]): BreakdownPanelState {
  return {
    isOpen: false,
    mode: resolveDefaultSplitMode(buildBreakdownLines(items)),
    draft: items.map((item) => ({ itemId: item.itemId, selected: false, pinned: false, amountMinor: 0 })),
    rawByItemId: {},
    lastEditedItemId: null,
    clampedItemIds: [],
  };
}

/**
 * Whether the draft cannot be submitted as it stands: it outruns the payment, or a line outruns its
 * own price. Those two things ARE what "blocked" means, and they are decided here once because two
 * readers ask at two different moments: `deriveBreakdown` for the render, `recomputeBreakdown` for
 * the latch below.
 */
function isDraftBlocked(input: {
  lines: BreakdownLine[];
  draft: BreakdownDraftLine[];
  mode: BreakdownSplitMode;
  foot: BreakdownFoot;
}): boolean {
  if (input.foot.isOverPayment) return true;
  const draftByItemId = new Map(input.draft.map((entry) => [entry.itemId, entry]));
  return input.lines.some((line) => {
    const draft = draftByItemId.get(line.itemId);
    return draft !== undefined && resolveBreakdownLineState({ line, draft, mode: input.mode }) === "overBase";
  });
}

/**
 * Re-runs the split over the lines the collector has not decided, leaving pinned ones untouched.
 *
 * And LATCHES the panel open when the result cannot be submitted. A blocked draft has to be
 * reachable (the refusal and the fields that resolve it both live inside the section, and the CTA is
 * dead while it stands), but that opening has to be a decision written into the state, not a term
 * OR-ed into the render: derived, it un-opens itself the moment the collector fixes the line, which
 * unmounts the section with the caret inside it and drops the focus on `<body>`. Latched, the fold
 * goes back to being the collector's alone — they can close the panel again once it is legal, and
 * nothing closes it for them. Same shape as `hasTouchedDate` in the form's date disclosure.
 *
 * This is the single door every state change that can reach `blocked` passes through: the panel's
 * own `commit`, and the form's `applyAmount` when the amount moves under a folded draft.
 */
export function recomputeBreakdown(state: BreakdownPanelState, ctx: BreakdownContext): BreakdownPanelState {
  const { draft, clampedItemIds } = applySplit({
    mode: state.mode,
    lines: ctx.lines,
    draft: state.draft,
    paymentAmountMinor: ctx.paymentAmountMinor,
    orderTotalCostMinor: ctx.orderTotalCostMinor,
    step: ctx.step,
  });
  const next = { ...state, draft, clampedItemIds };
  const foot = resolveBreakdownFoot({
    paymentAmountMinor: ctx.paymentAmountMinor,
    orderRemainingBalanceMinor: ctx.orderRemainingBalanceMinor,
    lines: ctx.lines,
    draft,
  });
  if (!isDraftBlocked({ lines: ctx.lines, draft, mode: next.mode, foot })) return next;
  return { ...next, isOpen: true };
}

/**
 * Whether there is work in the panel worth keeping a refusal on screen for.
 *
 * It asks about the DRAFT and never about the fold, and that is the whole point: folding the panel
 * hides the lines, it does not withdraw them. A draft that travels to the server has to be a draft
 * the form stays mounted for, or a refusal dismisses the surface and takes six hand-typed lines with
 * it — exactly the loss §11.2 of the spec keeps the form open to prevent.
 *
 * A line worth nothing is not part of that loss, and asking `selected` alone said it was: three
 * products ticked with a zero typed into each emit no allocation, print "Desglosar entre productos"
 * on the trigger (there is no breakdown) and would still have left the optimistic path to wait for a
 * verdict on a payment that by every visible sign is a plain one. The predicate has to be the same
 * one the payload uses, which is `buildBreakdownAllocations`'.
 */
export function hasBreakdownDraft(state: BreakdownPanelState): boolean {
  return state.draft.some((entry) => entry.selected && entry.amountMinor > 0);
}

/** Which formula produced what is being submitted. Analytics only; the panel never reads it. */
export function resolveBreakdownAnalyticsMode(state: BreakdownPanelState): "none" | "equal" | "byPrice" | "manual" {
  const selected = state.draft.filter((entry) => entry.selected && entry.amountMinor > 0);
  if (selected.length === 0) return "none";
  if (selected.every((entry) => entry.pinned)) return "manual";
  return state.mode;
}

/**
 * One amount as the panel's own field would show it: the currency's decimals, no separators.
 * Exported because the fill button writes the same string the split would have written.
 */
export function minorToInputString(minor: number, currencyCode: string): string {
  return (minor / MINOR_UNITS_PER_MAJOR).toFixed(getCurrencyDecimals(currencyCode));
}

/**
 * The whole panel as arithmetic, computed the same way by the panel that renders it and the form
 * that submits it. Two readers, one function, so the CTA can never disagree with the foot it sits
 * under.
 */
export function deriveBreakdown(
  state: BreakdownPanelState,
  ctx: BreakdownContext,
  currencyCode: string,
): BreakdownDerived {
  const draftByItemId = new Map(state.draft.map((entry) => [entry.itemId, entry]));
  const assignedMinor = state.draft.reduce((sum, entry) => (entry.selected ? sum + entry.amountMinor : sum), 0);

  const entries: BreakdownEntry[] = ctx.lines.map((line) => {
    const draft = draftByItemId.get(line.itemId) ?? {
      itemId: line.itemId,
      selected: false,
      pinned: false,
      amountMinor: 0,
    };
    const lineState = resolveBreakdownLineState({ line, draft, mode: state.mode });
    const raw = state.rawByItemId[line.itemId];
    // The ceiling of the fill button, through the SAME helper the store payment sheet uses. Both
    // axes take the same "other lines" sum here because the whole payment lands on this order by
    // construction, so the order's room and the payment's room are the same room. Aligned down to
    // the currency's own step: in a zero-decimal currency an unaligned amount is not a legal
    // allocation, so proposing it would only earn a server refusal.
    const others = assignedMinor - (draft.selected ? draft.amountMinor : 0);
    const fillableMinor =
      Math.floor(
        computeFillableMinor({
          lineCeilingMinor: line.remainingBaseMinor,
          orderAssignableMinor: ctx.orderRemainingBalanceMinor,
          sumOtherLinesOfOrderMinor: others,
          paymentAmountMinor: ctx.paymentAmountMinor,
          sumOtherLinesOfPaymentMinor: others,
        }) / ctx.step,
      ) * ctx.step;

    return {
      line,
      draft,
      state: lineState,
      value: raw ?? (draft.amountMinor > 0 ? minorToInputString(draft.amountMinor, currencyCode) : ""),
      fillableMinor,
    };
  });

  const foot = resolveBreakdownFoot({
    paymentAmountMinor: ctx.paymentAmountMinor,
    orderRemainingBalanceMinor: ctx.orderRemainingBalanceMinor,
    lines: ctx.lines,
    draft: state.draft,
  });

  const overCulpritEntry = foot.isOverPayment
    ? (entries.find((entry) => entry.line.itemId === state.lastEditedItemId && entry.draft.amountMinor > 0) ??
      entries.reduce<BreakdownEntry | null>(
        (biggest, entry) =>
          entry.draft.selected && entry.draft.amountMinor > (biggest?.draft.amountMinor ?? 0) ? entry : biggest,
        null,
      ))
    : null;

  /**
   * The percentage the by-price split applies, over the order's eligible lines.
   *
   * The denominator is `max(totalCost, sum of prices)`, and getting that wrong is the bug this is
   * written to avoid: with the order total alone, a discounted order printed "100% of the order"
   * while applying 81.8%. It is computed over every ELIGIBLE line rather than over the currently
   * ticked ones so the figure is a property of "this payment against this order" (which is what its
   * label says) instead of jumping about as boxes are ticked. The two only diverge on a subset of a
   * discounted order, where the sum of the prices exceeds the total; there is one such order in the
   * collection and it is settled.
   */
  const denom = resolveSplitDenominator({
    totalCostMinor: ctx.orderTotalCostMinor,
    lines: ctx.lines
      .filter((line) => line.eligible)
      .map((line) => ({ key: line.itemId, baseMinor: line.basePagableMinor, capMinor: line.remainingBaseMinor })),
  });
  const percent = denom > 0 ? (ctx.paymentAmountMinor * 100) / denom : 0;

  const ticked = entries.filter((entry) => entry.draft.selected && entry.line.eligible);
  const clampedIds = new Set(state.clampedItemIds);

  return {
    entries,
    foot,
    allocations: buildBreakdownAllocations(state.draft),
    eligibleCount: ctx.lines.filter((line) => line.eligible).length,
    blocked: isDraftBlocked({ lines: ctx.lines, draft: state.draft, mode: state.mode, foot }),
    overCulprit: overCulpritEntry?.line ?? null,
    percent,
    weightlessCount: ticked.filter((entry) => entry.line.basePagableMinor === null || entry.line.basePagableMinor <= 0)
      .length,
    /**
     * Threaded out of the SPLIT, never read off the result.
     *
     * Reading it off the result ("this line sits at its own ceiling") looked equivalent and was
     * wrong on the collector's most common payment: on the final payment of an adelanto + final
     * pair every line lands exactly on its own price, so the result-reading counted all of them and
     * the panel said "some products already had payments, so they get less" while each one closed
     * EXACTLY on its price and nobody got less. A clamped line is `quota > ceiling`, which only the
     * split can see.
     */
    clampedCount: ticked.filter((entry) => clampedIds.has(entry.line.itemId)).length,
    pricedTickedCount: ticked.filter((entry) => entry.line.basePagableMinor !== null && entry.line.basePagableMinor > 0)
      .length,
  };
}

/** Whether the panel is offered at all: more than one product, and at least one still payable. */
export function offersBreakdown(items: BreakdownItem[]): boolean {
  return items.length > 1 && hasEligibleLines(buildBreakdownLines(items));
}

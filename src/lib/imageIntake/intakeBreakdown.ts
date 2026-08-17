import {
  buildBreakdownAllocations,
  buildBreakdownContext,
  buildBreakdownLines,
  type BreakdownContext,
  type BreakdownItem,
  type BreakdownPanelState,
} from "@/lib/orders/orderPaymentBreakdown";
import { resolveBasePagableMinor } from "@/lib/orders/productPaymentState";
import { resolveSplitDenominator } from "@/lib/orders/splitPaymentAmount";
import type { ImageIntakeDraft } from "./draftSchema";
import type { IntakeBreakdownPayload } from "./intakeBreakdownContract";
import { mapDraftToOrderCreateInput } from "./mapDraftToOrderCreate";

/**
 * The split panel's arithmetic, fed from a draft nobody has saved yet.
 *
 * Everything here is the order detail's own engine (`@/lib/orders/orderPaymentBreakdown`) with two
 * substitutions and no third: the products come from the draft instead of the database, and what an
 * earlier payment already declared comes from the payment rows above on the same screen instead of
 * from `payment_allocation`. No formula is reimplemented, so the review screen and the order detail
 * can never split the same numbers differently.
 */

/** Quantity of every confirmed draft product: partial arrival tracking needs one row per unit. */
const DRAFT_ITEM_QUANTITY = 1;

/** One payment row of the review screen, as this module needs to see it. */
export type IntakePaymentRow = {
  /** What the amount field holds, in minor units. 0 when it is empty. */
  amountMinor: number;
  /** The row's own breakdown draft, or `null` while the row has never been opened. */
  breakdown: BreakdownPanelState | null;
};

/**
 * The draft's products, flattened in the ONE order that carries money.
 *
 * `itemId` is the product's position as a string, because that is the key the payload travels on
 * (`intakeBreakdownContract`) and the key the server resolves after the commit. One key for the
 * panel and for the wire: a second one would be a place for them to disagree.
 *
 * The flattening itself is `mapDraftToOrderCreateInput`'s, not a copy of it. That mapper is what the
 * save action feeds to `orderCreateSchema`, so the positions the panel shows are by construction the
 * positions the order items are written with.
 */
export function flattenDraftToBreakdownItems(draft: ImageIntakeDraft): BreakdownItem[] {
  const items = mapDraftToOrderCreateInput(draft).items;
  return items.map((item) => ({
    itemId: String(item.position),
    name: item.name,
    basePagableMinor: resolveBasePagableMinor(
      item.unitPrice,
      DRAFT_ITEM_QUANTITY,
      draft.totalCost.value ?? 0,
      items.length,
    ),
    allocatedMinor: 0,
  }));
}

/** What the rows above row `paymentIndex` have already declared against each product. */
function sumDeclaredBefore(rows: IntakePaymentRow[], paymentIndex: number): Map<string, number> {
  const declared = new Map<string, number>();
  for (const row of rows.slice(0, paymentIndex)) {
    if (row.breakdown === null) continue;
    for (const allocation of buildBreakdownAllocations(row.breakdown.draft)) {
      declared.set(allocation.orderItemId, (declared.get(allocation.orderItemId) ?? 0) + allocation.amountMinor);
    }
  }
  return declared;
}

/**
 * The context row `paymentIndex` splits against: what the rows above it left behind.
 *
 * Two sums that look alike and are deliberately different, and confusing them is the whole reason
 * this function exists:
 *
 * - `allocatedMinor` per product counts ONLY what earlier rows named that product for. It lowers
 *   that product's ceiling, so two rows can never declare the same money twice.
 * - `orderRemainingBalanceMinor` counts the FULL amount of every earlier row, split or not. All of
 *   a payment lands on this order whatever its breakdown says, so the balance moves by the whole
 *   figure while the ceilings move only by the declared part.
 *
 * `orderTotalCostMinor` is the DENOMINATOR of the by-price split, and it is the remaining balance
 * raised, if needed, to the sum of the prices of the rows' eligible lines. That guard is not
 * decoration: `orderTotalCostMinor` has THREE consumers with different line sets. `applySplit`
 * hands `splitByPriceLines` the eligible, ticked, unpinned lines; `deriveBreakdown` prints a
 * percentage computed over every eligible line, ticked or not; and `OrderPaymentBreakdownPanel`'s
 * `showResidualUnpriced` compares it against `sumEligiblePrices` (every eligible line's price) to
 * decide whether the residual gets blamed on unpriced products. The first two pass the figure
 * through `resolveSplitDenominator`, which raises it to its own sum of prices, so without the guard
 * they can settle on different denominators: a row paying 10000 with only B ticked would apply 100%
 * of B's price while printing 66.7%. With it, `sum(ticked) <= sum(eligible) <= orderTotalCostMinor`,
 * so both land on this same number by construction. That same inequality is why the third consumer's
 * comparison never lies: `sumEligiblePrices < orderTotalCostMinor` can only be true when the
 * remaining balance itself exceeds `sum(eligible)`, i.e. when the order's total genuinely outweighs
 * its priced products, so `footResidualUnpriced` never fires over a row whose eligible lines already
 * add up to the whole denominator.
 *
 * On row 0 the balance is the order's total and this is exactly the order detail's own context.
 */
export function resolveIntakeBreakdownContext(input: {
  /** Every product of the draft, as `flattenDraftToBreakdownItems` emits it. */
  items: BreakdownItem[];
  rows: IntakePaymentRow[];
  paymentIndex: number;
  totalCostMinor: number;
  currencyCode: string;
}): BreakdownContext {
  const { items, rows, paymentIndex, totalCostMinor, currencyCode } = input;
  const declaredBefore = sumDeclaredBefore(rows, paymentIndex);
  const paidBefore = rows.slice(0, paymentIndex).reduce((sum, row) => sum + Math.max(0, row.amountMinor), 0);

  const itemsForRow: BreakdownItem[] = items.map((item) => ({
    ...item,
    allocatedMinor: item.allocatedMinor + (declaredBefore.get(item.itemId) ?? 0),
  }));

  const orderRemainingBalanceMinor = totalCostMinor - paidBefore;
  const eligibleLines = buildBreakdownLines(itemsForRow).filter((line) => line.eligible);

  return buildBreakdownContext({
    items: itemsForRow,
    paymentAmountMinor: rows[paymentIndex]?.amountMinor ?? 0,
    orderRemainingBalanceMinor,
    orderTotalCostMinor: resolveSplitDenominator({
      totalCostMinor: orderRemainingBalanceMinor,
      lines: eligibleLines.map((line) => ({
        key: line.itemId,
        baseMinor: line.basePagableMinor,
        capMinor: line.remainingBaseMinor,
      })),
    }),
    currencyCode,
  });
}

/**
 * The payload the save action receives, or `undefined` when nothing was declared.
 *
 * `undefined` and not an array of empty entries: an entry with no lines is refused by the contract,
 * so emitting one per payment row would break the ordinary path (a payment with no breakdown at
 * all, which is most of them) for the sake of a uniform shape nothing needs.
 */
export function buildIntakeBreakdownPayload(rows: IntakePaymentRow[]): IntakeBreakdownPayload | undefined {
  const entries = rows.flatMap((row, paymentIndex) => {
    if (row.breakdown === null) return [];
    const lines = buildBreakdownAllocations(row.breakdown.draft).map((allocation) => ({
      position: Number(allocation.orderItemId),
      amountMinor: allocation.amountMinor,
    }));
    return lines.length === 0 ? [] : [{ paymentIndex, lines }];
  });
  return entries.length === 0 ? undefined : entries;
}

/** Why the review screen will not save a payment row that carries a breakdown. */
export type IntakeSaveBlockReason =
  /** No amount, so there is nothing to split and the server would drop the row. */
  | "needsAmount"
  /** `orderPaymentCreateSchema` requires a date; without one the row never reaches the write. */
  | "needsDate"
  /** `PAYMENT_DATE_IN_FUTURE`, the schema's own refine. */
  | "dateInFuture"
  /** `DATE_BEFORE_ORDER`. */
  | "dateTooEarly"
  /** `EXCEEDS_BALANCE`: with the rows above it written, this one no longer fits in the order. */
  | "exceedsBalance";

export type IntakeSaveBlock = { paymentIndex: number; reason: IntakeSaveBlockReason };

/** One payment row as the save gate reads it. Dates are calendar days, `YYYY-MM-DD`. */
export type IntakeSaveGateRow = {
  amountMinor: number;
  paidAtIso: string | null;
  hasBreakdown: boolean;
};

/** Today as a calendar day in UTC, which is the clock `domainDateSchema` and its refine speak. */
export function resolveTodayUtcIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Whether a row would survive `orderPaymentCreateSchema.safeParse` and reach the write at all. */
function wouldReachTheWrite(row: IntakeSaveGateRow, todayIso: string): boolean {
  return row.amountMinor > 0 && row.paidAtIso !== null && row.paidAtIso <= todayIso;
}

/**
 * The one gate this screen gains, and it is deliberately narrow: a payment row that carries a
 * breakdown has to be complete and legal before the order is written. A row WITHOUT a breakdown
 * keeps `FR-11-52b` exactly as it is, dropped server-side without blocking anything.
 *
 * The balance half is a SIMULATION IN ORDER, not `sum(amounts) <= totalCost`. The server writes the
 * rows one by one and a refused row consumes no balance, so the flat sum produces false positives:
 * with a total of 15000 and rows of 14000, 800 and 900, the sum says 15700 and blames the third row,
 * which does not even carry a breakdown, while the server happily writes the first two. Rows the
 * schema would drop are stepped over first (they never reach the balance check either), and a row
 * the simulation refuses only blocks the save when it is the one carrying typed lines.
 */
export function resolveIntakeBreakdownSaveBlock(input: {
  rows: IntakeSaveGateRow[];
  /** `null` while the collector has not given the order a total; the save is blocked elsewhere. */
  totalCostMinor: number | null;
  orderDateIso: string | null;
  todayIso: string;
}): IntakeSaveBlock | null {
  const { rows, totalCostMinor, orderDateIso, todayIso } = input;

  for (const [paymentIndex, row] of rows.entries()) {
    if (!row.hasBreakdown) continue;
    if (row.amountMinor <= 0) return { paymentIndex, reason: "needsAmount" };
    if (row.paidAtIso === null) return { paymentIndex, reason: "needsDate" };
    if (row.paidAtIso > todayIso) return { paymentIndex, reason: "dateInFuture" };
    if (orderDateIso !== null && row.paidAtIso < orderDateIso) return { paymentIndex, reason: "dateTooEarly" };
  }

  if (totalCostMinor === null) return null;

  let declaredSoFar = 0;
  for (const [paymentIndex, row] of rows.entries()) {
    if (!wouldReachTheWrite(row, todayIso)) continue;
    // Refused for its date, like the ones above: refusals write nothing, so they consume nothing.
    if (orderDateIso !== null && row.paidAtIso !== null && row.paidAtIso < orderDateIso) continue;
    if (declaredSoFar + row.amountMinor > totalCostMinor) {
      if (row.hasBreakdown) return { paymentIndex, reason: "exceedsBalance" };
      continue;
    }
    declaredSoFar += row.amountMinor;
  }

  return null;
}

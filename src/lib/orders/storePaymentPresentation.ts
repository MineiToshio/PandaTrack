import type {
  StoreDebtRow,
  StorePaymentAllocationLine,
  StorePaymentListRow,
} from "@/lib/data/orders/storePaymentQueries";

/**
 * Derivations shared by the store detail's payment progress block and its "Pagos a esta tienda"
 * list. Both read the same two server shapes (`StoreDebtRow`, `StorePaymentListRow`), and both used
 * to be one careless subtraction away from telling the collector two different stories about the
 * same money, so the arithmetic lives here once and is tested against those exact shapes.
 */

/**
 * How much of a payment is sunk in orders that have since been CANCELLED.
 *
 * This is the per-payment half of `StoreDebtRow.lostMinor`, which the block renders as "Perdido en
 * cancelados". Naming that money is not bookkeeping for its own sake: it is the only figure on the
 * store page for money that left the collector's hands and bought nothing. `paidMinor` nets it out,
 * the bar's pair never saw it (a cancelled order is not active), and the payments list below shows
 * the payment at its full face value, so without this line the sunk part is on screen only as an
 * amount inside a row that no summary accounts for.
 *
 * It matters beyond a label, too: because `paidMinor` already excludes it, deleting such a payment
 * moves the store's figures by `amount - lostPortion`, not by `amount`. An optimistic patch that
 * forgets it swings a whole progress bar on a delete the server treats as a no-op.
 */
export function sumLostAllocationMinor(allocations: readonly StorePaymentAllocationLine[]): number {
  return allocations.reduce((sum, allocation) => (allocation.orderCancelled ? sum + allocation.amountMinor : sum), 0);
}

/** What the store's figures actually move by when this payment is added or taken back. */
export function effectivePaymentMinor(payment: Pick<StorePaymentListRow, "amount" | "allocations">): number {
  return payment.amount - sumLostAllocationMinor(payment.allocations);
}

/**
 * How much of a payment lands on orders that are still active, which is the only part of it that
 * moves the progress bar.
 *
 * Three kinds of money are deliberately excluded, and each one would be a distinct visible bug:
 * a line against a CANCELLED order (already sunk), a line against a COMPLETED one (real money on a
 * real debt, but on an order that left the bar's denominator when it was delivered), and any
 * undeclared remainder handed over "on account" (attributable to no order at all, so it cannot
 * raise a numerator whose denominator is a set of orders).
 */
export function sumActiveAllocationMinor(allocations: readonly StorePaymentAllocationLine[]): number {
  return allocations.reduce((sum, allocation) => (allocation.orderActive ? sum + allocation.amountMinor : sum), 0);
}

/**
 * The percentage the payment progress bar draws and announces.
 *
 * `Math.round` is deliberately avoided at both ends. Rounding up puts "100%" next to a live debt
 * (Liliput sits at 98.77% today: one more payment of 49.37 would read `Falta 33.83 · 100%`, a
 * sentence that contradicts itself), and rounding down puts "0%" next to money already handed over.
 * So 100 is reserved for a debt of exactly zero, 0 for nothing paid at all, and everything in
 * between is floored into [1, 99]. Same reasoning, same `Math.floor`, as the order detail hero.
 */
export function computePaymentProgressPercent(
  debt: Pick<StoreDebtRow, "committedMinor" | "paidMinor" | "debtMinor">,
): number {
  if (debt.committedMinor <= 0) return 0;
  if (debt.debtMinor <= 0) return 100;
  if (debt.paidMinor <= 0) return 0;
  return Math.min(99, Math.max(1, Math.floor((debt.paidMinor / debt.committedMinor) * 100)));
}

/** The pair the bar compares, in the same shape {@link computePaymentProgressPercent} reads. */
type ActiveOrdersPair = Pick<StoreDebtRow, "activeCommittedMinor" | "activePaidMinor">;

/**
 * True when this currency has orders still in flight, and therefore something for a bar to measure.
 *
 * This is the bar's only gate. With no active orders the denominator is zero, and a track drawn
 * over a zero denominator says "100% of nothing" in a shape indistinguishable from real progress.
 * 112 of the collector's 122 store/currency pairs are in exactly that position today, so this is
 * the common case, not the edge one: the block still renders there, it just stops pretending to
 * measure. What it says instead is the caller's business (see `StorePaymentProgressRows`).
 */
export function hasActiveOrderCommitment(debt: ActiveOrdersPair): boolean {
  return debt.activeCommittedMinor > 0;
}

/**
 * The percentage the bar draws: money declared against still-active orders over what those orders
 * cost.
 *
 * Why this denominator and not the store's lifetime commitment, written down so it is not
 * "corrected" back later. The lifetime figure is monotonically accumulating and ends up settled, so
 * it converges to 100% in any store with history no matter what is currently owed: the collector's
 * heaviest debt (2,355.00 PEN) used to read 85% while a debt 25 times smaller read 99%, and the two
 * bars looked the same. Narrowing the ratio to the orders still in flight restores the range where
 * it matters (the same five rows now read 39 / 13 / 20 / 23 / 56).
 *
 * What this does NOT change is the debt itself. `debtMinor` stays lifetime-wide, so the headline
 * "Falta {amount}", the "Registrar pago" gate, the "Por tienda" order view and the dashboard all
 * keep reading the same number they always did. Only the ratio was narrowed.
 *
 * The clamping rules are inherited unchanged from {@link computePaymentProgressPercent}: 100 is
 * reserved for a fully covered set, 0 for nothing declared, everything else floored into [1, 99].
 */
export function computeActiveOrdersProgressPercent(debt: ActiveOrdersPair): number {
  return computePaymentProgressPercent({
    committedMinor: debt.activeCommittedMinor,
    paidMinor: debt.activePaidMinor,
    debtMinor: debt.activeCommittedMinor - debt.activePaidMinor,
  });
}

/**
 * The line the block prints for money already handed over that no order has claimed
 * (`StoreDebtRow.unassignedMinor`, `BR-05-27` / `FR-05-60`).
 *
 * This retires the old `outsideActiveOrders` reconciliation line and its `resolveDebtReconciliationLine`
 * shim (`ADR 0033`, `WO-09`): `openOrderDebtMinor` already reads the canonical per-order
 * `openBalanceMinor` (`BR-05-32`, `ADR 0034`), so the gap that line used to name between the
 * headline and the bar's pair no longer exists (`ADR 0033`, Technical Notes). This is the single
 * remaining helper for the block's "money already paid, not yet assigned" line, reading the exact
 * figure, `unassignedMinor`.
 */
export type UnassignedMoneyLine = { amountMinor: number } | null;

/**
 * Suppressed while the store is in credit (`debtMinor < 0`, `FR-05-63`), even when
 * `unassignedMinor` itself is positive. A credit is almost always MADE of unassigned money (that is
 * what makes it a credit), so the block would otherwise show two positive figures side by side that
 * both, in effect, answer "am I owed money": the credit headline ("A favor 160.00") and this line
 * ("100.00 sin asignar"). That is not two facts, it is one fact printed twice in two different
 * shapes, and a collector reading both has no way to tell whether they overlap. The credit chip
 * already is the answer for this state (`ADR 0033`'s consequence note), so this line stays quiet
 * for as long as the store is in credit, regardless of how large `unassignedMinor` reads.
 */
export function resolveUnassignedMoneyLine(
  debt: Pick<StoreDebtRow, "unassignedMinor" | "debtMinor">,
): UnassignedMoneyLine {
  if (debt.debtMinor < 0) return null;
  const amountMinor = debt.unassignedMinor;
  return amountMinor > 0 ? { amountMinor } : null;
}

/**
 * The id prefix an optimistically added payment carries until the server answers with the real one.
 *
 * Minted by `StorePaymentStateProvider` and read by the row, so the convention lives in one place
 * rather than as a string literal on both sides of the round trip.
 */
const OPTIMISTIC_PAYMENT_ID_PREFIX = "temp-";

export function buildOptimisticPaymentId(now: number): string {
  return `${OPTIMISTIC_PAYMENT_ID_PREFIX}${now}`;
}

/** True while a row is a local stand-in with no server row behind it yet. */
export function isOptimisticPaymentId(paymentId: string): boolean {
  return paymentId.startsWith(OPTIMISTIC_PAYMENT_ID_PREFIX);
}

export type StorePaymentProgressState = "settled" | "owing" | "credit";

/**
 * Which of the three shapes the block takes. A credit draws no bar: a track past 100% is a lie.
 *
 * `credit` is decided on the lifetime `debtMinor`, unchanged (`FR-05-63`): the collector can only be
 * "in credit" against the store's whole history, not against its open orders alone. `settled` /
 * `owing` are decided on `openOrderDebtMinor` (`ADR 0033`, `WO-09`), the figure the headline itself
 * now renders, so a store whose last open order just closed reads "Al día" even while an older
 * delivered order still carries an unregistered balance (`unrecordedPaymentsMinor`, a diagnostic,
 * never debt). `openOrderDebtMinor` is deliberately compared with `=== 0`, not `<= 0`: a negative
 * reading there is real (BR-05-32, never clamped) and must fall to `owing` so the headline still
 * renders it, rather than being mistaken for `settled`.
 */
export function resolveProgressState(
  debt: Pick<StoreDebtRow, "debtMinor" | "openOrderDebtMinor">,
): StorePaymentProgressState {
  if (debt.debtMinor < 0) return "credit";
  return debt.openOrderDebtMinor === 0 ? "settled" : "owing";
}

/**
 * Currencies ordered so the one the collector can act on comes first: live debt before anything
 * else, then by size of commitment. Without this the order is whatever the debt query's `Map`
 * happened to build, which today puts a fully settled USD above a PEN debt of 1,389.00.
 *
 * Ranks on `openOrderDebtMinor`, not the lifetime `debtMinor` (`ADR 0033`, `FIX D`): the block this
 * order feeds (`StorePaymentProgressRows`) prints `openOrderDebtMinor` on its "owing" headline, so a
 * registration-gap currency (a big unregistered balance on a COMPLETED order, nothing open today)
 * must not outrank one the collector genuinely owes money on right now.
 */
export function sortDebtsByActionability(debts: readonly StoreDebtRow[]): StoreDebtRow[] {
  return [...debts].sort((a, b) => {
    const aOwing = a.openOrderDebtMinor > 0 ? 0 : 1;
    const bOwing = b.openOrderDebtMinor > 0 ? 0 : 1;
    if (aOwing !== bOwing) return aOwing - bOwing;
    return b.committedMinor - a.committedMinor;
  });
}

/**
 * What a collapsed payment row says the payment covers.
 *
 * `orderItemName` is never null while `orderItemId` is set (deleting a product that carries an
 * allocation is refused), so there is no defensive "product with no name" shape here.
 */
export type StorePaymentCoverage =
  /** No declaration at all: money handed over "on account". */
  | { kind: "unassigned" }
  /** Exactly one PRODUCT line, possibly beside an order-level remainder of the same payment. */
  | {
      kind: "item";
      orderId: string;
      orderHumanReadableId: string;
      orderCancelled: boolean;
      itemName: string;
      settled: boolean;
      /** The same payment also put money on the order without naming a product. */
      hasUndetailedPart: boolean;
    }
  /** No product line: the whole declaration names the order. */
  | { kind: "order"; orderId: string; orderHumanReadableId: string; orderCancelled: boolean; settled: boolean }
  /** Several PRODUCT lines, all against the same order. */
  | {
      kind: "manyItems";
      orderId: string;
      orderHumanReadableId: string;
      orderCancelled: boolean;
      count: number;
      /** The same payment also put money on the order without naming a product. */
      hasUndetailedPart: boolean;
    }
  /** Several lines spanning several orders. */
  | { kind: "manyOrders"; count: number; anyCancelled: boolean };

/**
 * `count` counts PRODUCT lines, not allocations.
 *
 * A payment broken down across an order's products carries an extra order-level line for whatever
 * it did not itemize (the residual), so counting allocations would report a payment split across
 * two products as covering three. That line is a real part of the declaration, so it is not
 * dropped: it is surfaced as `hasUndetailedPart` instead of inflating a product count.
 */
export function resolvePaymentCoverage(payment: Pick<StorePaymentListRow, "allocations">): StorePaymentCoverage {
  const { allocations } = payment;
  if (allocations.length === 0) return { kind: "unassigned" };

  const orderIds = new Set(allocations.map((allocation) => allocation.orderId));
  if (orderIds.size > 1) {
    return {
      kind: "manyOrders",
      count: orderIds.size,
      anyCancelled: allocations.some((allocation) => allocation.orderCancelled),
    };
  }

  const itemLines = allocations.filter((allocation) => allocation.orderItemId !== null);
  const hasUndetailedPart = allocations.some((allocation) => allocation.orderItemId === null);
  const [first] = allocations;

  if (itemLines.length > 1) {
    return {
      kind: "manyItems",
      orderId: first.orderId,
      orderHumanReadableId: first.orderHumanReadableId,
      orderCancelled: first.orderCancelled,
      count: itemLines.length,
      hasUndetailedPart,
    };
  }

  // A line that declares its target covered without naming an amount (`settlesTarget` with no
  // money on it) has nothing to show but the fact that it settles.
  const [onlyItemLine] = itemLines;
  if (onlyItemLine && onlyItemLine.orderItemName !== null) {
    return {
      kind: "item",
      orderId: onlyItemLine.orderId,
      orderHumanReadableId: onlyItemLine.orderHumanReadableId,
      orderCancelled: onlyItemLine.orderCancelled,
      itemName: onlyItemLine.orderItemName,
      settled: onlyItemLine.settlesTarget && onlyItemLine.amountMinor === 0,
      hasUndetailedPart,
    };
  }

  const settled = first.settlesTarget && first.amountMinor === 0;
  return {
    kind: "order",
    orderId: first.orderId,
    orderHumanReadableId: first.orderHumanReadableId,
    orderCancelled: first.orderCancelled,
    settled,
  };
}

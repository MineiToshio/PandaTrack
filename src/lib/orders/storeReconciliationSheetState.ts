/**
 * Pure client-side state helpers for the "cuadrar cuenta" (reconcile account) sheet (WO-11,
 * `ADR 0034`). Nothing here talks to a Server Action or Prisma: every function takes plain data the
 * sheet already has on screen and returns plain data, so the arithmetic that decides what gets
 * written can be unit-tested without mounting a single component.
 *
 * The one rule every function below protects: **a line is declared, never derived** (`ADR 0025`,
 * `ADR 0028`). The collector marks orders one at a time; nothing here spreads a store-wide figure
 * across them.
 */

/** The one field every row's own ceiling needs: its id and its current, already-net balance. */
export type ReconciliationRowInput = {
  orderId: string;
  openBalanceMinor: number;
};

/**
 * What the collector has marked, keyed by `orderId`: the remaining balance they typed for that
 * order, in minor units. An order absent from this map is untouched, i.e. no line at all.
 *
 * `0` means "saldado" (the whole balance is written off); a value equal to the row's own
 * `openBalanceMinor` means "no line" (nothing changed) even though the key is present, because the
 * collector may have typed the balance back in after marking it and then changing their mind.
 */
export type ReconciliationMarks = Readonly<Record<string, number>>;

/**
 * One line of the declaration this sheet is about to submit, in the exact shape
 * `createStoreAccountAdjustment` accepts.
 */
export type ReconciliationLineInput = { orderId: string; amountMinor: number };

/**
 * The write-off amount for one row, or `null` when the row contributes no line at all.
 *
 * `remainingMinor` is what the collector typed as "what's left owed on this order", never the
 * amount being written off directly: the sheet always asks "how much is left", the same question
 * `handleParkRemainder`'s sibling flows ask elsewhere in this domain, and the line amount is the
 * difference the app computes from it. A remaining balance outside `[0, openBalanceMinor]` is not a
 * line this sheet can build (typing more than the order still owes, or a negative one), so it is
 * reported as `null` rather than silently clamped: `BR-05-32`'s "rendered, never clamped" discipline
 * for the underlying balance extends to this input.
 */
export function resolveLineAmountMinor(openBalanceMinor: number, remainingMinor: number): number | null {
  if (!Number.isInteger(remainingMinor) || remainingMinor < 0 || remainingMinor > openBalanceMinor) {
    return null;
  }
  const amountMinor = openBalanceMinor - remainingMinor;
  // Equal to the balance: the collector typed the balance back in, which is the same as never
  // having marked the row. Not a line, and not an error either.
  return amountMinor > 0 ? amountMinor : null;
}

/**
 * Every row's remaining balance set to 0, i.e. every listed order marked settled in one gesture
 * ("todo saldado", `ADR 0034` §7's UX note). Still one line per order once submitted: this is a UI
 * convenience over the same per-order declaration, never a store-wide shortcut computed differently.
 */
export function markAllSettled(rows: readonly ReconciliationRowInput[]): ReconciliationMarks {
  const marks: Record<string, number> = {};
  for (const row of rows) marks[row.orderId] = 0;
  return marks;
}

/**
 * The lines this declaration would submit: one entry per row the collector actually marked, in the
 * order the rows are listed. A row with no key in `marks`, or one whose typed remaining balance
 * resolves to no write-off ({@link resolveLineAmountMinor} returning `null`), contributes nothing —
 * the app never derives a line for an order the collector did not touch.
 */
export function buildReconciliationLines(
  rows: readonly ReconciliationRowInput[],
  marks: ReconciliationMarks,
): ReconciliationLineInput[] {
  const lines: ReconciliationLineInput[] = [];
  for (const row of rows) {
    if (!(row.orderId in marks)) continue;
    const amountMinor = resolveLineAmountMinor(row.openBalanceMinor, marks[row.orderId]);
    if (amountMinor != null) lines.push({ orderId: row.orderId, amountMinor });
  }
  return lines;
}

/**
 * The sum of the lines the OPEN-orders group alone would submit: the only slice of the declaration
 * that moves the store's displayed debt (`openOrderDebtMinor`, `FR-05-61`). A line on a delivered
 * order never enters this sum, because that order is already outside the figure it would move
 * (`BR-05-26`, `ADR 0034` §3).
 */
export function computeOpenGroupWriteOffMinor(
  openOrders: readonly ReconciliationRowInput[],
  marks: ReconciliationMarks,
): number {
  return buildReconciliationLines(openOrders, marks).reduce((sum, line) => sum + line.amountMinor, 0);
}

/**
 * The same OPEN-group sum as {@link computeOpenGroupWriteOffMinor}, but read off an already-built
 * `lines` array rather than the sheet's own `marks` (`FIX 1`, WO-11 review). Used by
 * `StoreReconciliationProvider`, which only ever sees `onSubmit`'s finished `{ reason, lines }`
 * input, never the per-row `marks` that built it — the sheet's own local state does not cross the
 * `onSubmit` boundary. `openOrderIds` is the caller's own open-orders group, reduced to a `Set` of
 * ids: everything this needs to know about a row for this purpose.
 */
export function sumOpenGroupLinesMinor(
  lines: readonly ReconciliationLineInput[],
  openOrderIds: ReadonlySet<string>,
): number {
  return lines.reduce((sum, line) => (openOrderIds.has(line.orderId) ? sum + line.amountMinor : sum), 0);
}

/**
 * The store-level "so you really owe {amount}" figure: a **read-out**, never a field of its own
 * (`ADR 0034` §1, "one input and a derived total cannot disagree"). Computed from the open-order
 * debt the collector is shown minus exactly the OPEN-group lines being written, so it can never
 * disagree with what the rows above it say.
 */
export function computeReconciliationReadOutMinor(
  openOrderDebtMinor: number,
  openOrders: readonly ReconciliationRowInput[],
  marks: ReconciliationMarks,
): number {
  return openOrderDebtMinor - computeOpenGroupWriteOffMinor(openOrders, marks);
}

/** Submit is reachable only with at least one line and a non-empty, trimmed reason. */
export function canSubmitReconciliation(lines: readonly ReconciliationLineInput[], reason: string): boolean {
  return lines.length > 0 && reason.trim().length > 0;
}

/**
 * True when a typed remaining balance is out of range for its own row: negative, non-integer, or
 * more than `openBalanceMinor` (`MINOR-7`, WO-11 review). Deliberately distinct from
 * `resolveLineAmountMinor` returning `null`, which is also true of the legitimate "typed the balance
 * back in" case (`remainingMinor === openBalanceMinor`, i.e. no line at all, not an error) — this
 * excludes that case so a genuinely untouched or reset row never renders as invalid.
 */
export function isInvalidRemainingMinor(openBalanceMinor: number, remainingMinor: number): boolean {
  return resolveLineAmountMinor(openBalanceMinor, remainingMinor) == null && remainingMinor !== openBalanceMinor;
}

/**
 * True when at least one row the collector has marked carries an out-of-range remaining balance.
 * `resolveLineAmountMinor` simply drops that row's line, so a store-level `canSubmitReconciliation`
 * computed only from the surviving lines would happily submit while one row on screen still shows a
 * red field, the invalid row silently vanishing from the declaration instead of blocking it
 * (`MINOR-7`). Reads `marks` rather than raw input strings: an entry only exists there once its text
 * parsed to a number at all, exactly the same gate the per-row invalid check applies.
 */
export function hasInvalidRemainingMark(rows: readonly ReconciliationRowInput[], marks: ReconciliationMarks): boolean {
  return rows.some((row) => row.orderId in marks && isInvalidRemainingMinor(row.openBalanceMinor, marks[row.orderId]));
}

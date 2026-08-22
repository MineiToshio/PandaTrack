"use client";

import { useTranslations } from "next-intl";
import { Scale } from "lucide-react";
import Button from "@/components/core/Button/Button";
import Chip from "@/components/core/Chip";
import ProgressBar from "@/components/core/ProgressBar";
import SummaryStatRow from "@/components/modules/SummaryStatRow";
import { formatAmount } from "@/lib/currency";
import {
  computeActiveOrdersProgressPercent,
  hasActiveOrderCommitment,
  resolveProgressState,
  resolveUnassignedMoneyLine,
  sortDebtsByActionability,
} from "@/lib/orders/storePaymentPresentation";
import type { StoreDebtRow } from "@/lib/data/orders/storePaymentQueries";
import { useStorePaymentState } from "./StorePaymentStateProvider";
import { useStoreReconciliationState } from "./StoreReconciliationProvider";

type StorePaymentProgressRowsProps = {
  /**
   * Every order's cost including the cancelled ones, per currency — the figure the "Total
   * facturado" row above already shows. Used only to name the gap against `committedMinor`.
   */
  totalSpentByCurrency: Array<{ currencyCode: string; totalMinorUnits: number }>;
  /** For the "cuadrar cuenta" nudge's copy (WO-11, `ADR 0034` §7), which names the store. */
  storeName: string;
};

/**
 * The store sidebar's payment progress block: one bar per currency, replacing the old "Deuda
 * pendiente" row, plus the "Cancelados" reconciliation line that keeps "Total facturado" honest.
 *
 * Why a bar and not a number. "Deuda pendiente" rendered `S/ 0.00` on 104 of the collector's 120
 * stores, which is a lot of pixels spent saying nothing; a bar reading "Al día" says the same
 * thing usefully, and on the store/currency pairs with a live debt it puts "Pendiente en pedidos
 * abiertos {amount}" against the pair it came from.
 *
 * **What the bar measures, and what it does not.** The bar's ratio is scoped to the orders still
 * in flight: `activePaidMinor / activeCommittedMinor`. The headline (`ADR 0033`, `WO-09`) reads
 * `openOrderDebtMinor` (every "Debes / Falta" surface was promoted off the lifetime `debtMinor` to
 * that same figure); the credit branch is the one deliberate exception and keeps reading the
 * lifetime `debtMinor` (`FR-05-63`), because "in credit" is a fact about the store's whole
 * history, not about its open orders alone. The "Registrar pago" validation ceiling stays lifetime
 * too, unchanged. Only the bar's own ratio was narrowed, and the reason is in
 * `computeActiveOrdersProgressPercent`; reconciling the bar's denominator itself against
 * `openOrderDebtMinor` is a declared, deliberate gap (`WO-09` Technical Notes), not a defect.
 *
 * Four deliberate refusals to simplify:
 *
 *  - **The percentage is never shown alone.** `Pendiente en pedidos abiertos {amount}` and
 *    `{paid} pagados de {committed} en pedidos activos` are always next to it, and that caption
 *    names its own scope so it cannot be read as the store's lifetime total.
 *  - **No denominator, no bar.** With nothing active there is nothing to measure, and a full track
 *    over a zero denominator is the same graphical lie as one drawn past 100%. The block stays
 *    (it still answers "am I square with this store?"); it just says "Sin pedidos activos"
 *    instead of drawing progress. That is 112 of 122 store/currency pairs today.
 *  - **Currencies are never summed.** Two currencies mean two independent blocks; converting them
 *    would need an FX rate at read time, which this domain models per order, not per store.
 *  - **Every gap gets a line rather than a silent difference.** "Cancelados" for orders that were
 *    called off, "Perdido en cancelados" for money sunk in them, and, its own line regardless of
 *    the bar, the money already paid that no order has claimed yet (`unassignedMinor`). All of
 *    them are conditional and all of them exist so no two figures in this card can disagree
 *    without saying why.
 */
export default function StorePaymentProgressRows({ totalSpentByCurrency, storeName }: StorePaymentProgressRowsProps) {
  const tStores = useTranslations("stores");
  const { storeDebtByCurrency } = useStorePaymentState();

  // Whether ANY currency this store has a row for still has an order in flight. The nudge below
  // makes a STORE-level claim ("no te queda nada abierto con {tienda}"), so it must be gated on this
  // store-wide flag rather than on any one row's own `hasActiveOrderCommitment` (`ADR 0034`
  // 2026-08-20 review). Without it, a settled currency sitting beside a currency that still owes
  // money renders the nudge next to a sibling block that visibly contradicts it (Vaulted Store: USD
  // settled + PEN owing 1,200.00 PEN).
  const storeHasOpenOrders = storeDebtByCurrency.some((debt) => hasActiveOrderCommitment(debt));

  const committedByCurrency = new Map(storeDebtByCurrency.map((debt) => [debt.currencyCode, debt.committedMinor]));
  const cancelledRows = totalSpentByCurrency
    .map(({ currencyCode, totalMinorUnits }) => ({
      currencyCode,
      // A currency with NO debt row is not "nothing cancelled": it is the opposite. It means every
      // order in that currency was cancelled and no payment was ever recorded there, so the
      // cancelled slice is the whole amount. Falling back to `totalMinorUnits` computed zero and
      // filtered the line out in the one case where it accounts for 100% of "Total facturado".
      cancelledMinor: totalMinorUnits - (committedByCurrency.get(currencyCode) ?? 0),
    }))
    .filter((row) => row.cancelledMinor > 0);

  return (
    <>
      {/* Only rendered when the two criteria actually disagree (2 stores today). "Total facturado"
          counts cancelled orders; the debt the block's headline comes from does not. Without this
          line the collector is left to guess why the two figures differ. */}
      {cancelledRows.map(({ currencyCode, cancelledMinor }) => (
        <SummaryStatRow
          key={`cancelled-${currencyCode}`}
          label={tStores("redesign.detail.aside.cancelledLabel")}
          value={formatAmount(cancelledMinor, currencyCode)}
        />
      ))}
      {sortDebtsByActionability(storeDebtByCurrency).map((debt) => (
        <StorePaymentProgressBlock
          key={debt.currencyCode}
          debt={debt}
          storeName={storeName}
          storeHasOpenOrders={storeHasOpenOrders}
        />
      ))}
    </>
  );
}

const BLOCK_CLASS = "py-2 [border-top:1px_solid_var(--border)] [&:first-of-type]:[border-top:0]";

/**
 * "Perdido en cancelados": the only figure on this page for money that left the collector's hands
 * and bought nothing.
 *
 * No other number carries it. `paidMinor` nets it out, the bar's pair never saw it (a cancelled
 * order is not active), and the payments list below shows the payment at face value with no hint
 * that part of it died with its order. Drop this line and the sunk money is on screen only as an
 * amount inside a row that nothing on the page accounts for.
 */
function LostOnCancelledLine({ debt }: { debt: StoreDebtRow }) {
  const tStores = useTranslations("stores");
  if (debt.lostMinor <= 0) return null;
  return (
    <p className="text-warning mt-1 [font-size:var(--text-caption)] [font-variant-numeric:tabular-nums]">
      {tStores("redesign.detail.aside.paymentProgress.lostOnCancelled", {
        amount: formatAmount(debt.lostMinor, debt.currencyCode),
      })}
    </p>
  );
}

/**
 * Money already handed over to this store, in this currency, that no order has claimed yet
 * (`StoreDebtRow.unassignedMinor`, `BR-05-27` / `FR-05-60`, `ADR 0033`).
 *
 * Retires the old "gap between the headline and the bar" line (`outsideActiveOrders`): now that the
 * headline itself reads `openOrderDebtMinor` (the canonical `openBalanceMinor` per order), that gap
 * no longer exists (`ADR 0033`, `WO-09` Technical Notes). This is the one figure the bar's own pair
 * still cannot show: money paid but not yet attributed to any order.
 */
function UnassignedMoneyLine({ debt }: { debt: StoreDebtRow }) {
  const tStores = useTranslations("stores");
  const line = resolveUnassignedMoneyLine(debt);
  if (!line) return null;
  return (
    <p className="mt-1 [font-size:var(--text-caption)] [color:var(--text-muted)] [font-variant-numeric:tabular-nums]">
      {tStores("redesign.detail.aside.paymentProgress.unassignedMoney", {
        amount: formatAmount(line.amountMinor, debt.currencyCode),
      })}
    </p>
  );
}

/**
 * True when this (store, currency) pair has ANYTHING reconcilable or historical to say: an
 * unregistered balance, a lifetime debt or credit, unassigned money, or at least one non-cancelled
 * order (`committedMinor` is the sum of non-cancelled orders' `totalCost`, so `> 0` is the same
 * fact as "at least one exists"). A row failing all four has nothing standing with this store in
 * this currency at all, so neither the settled empty-state chip nor its nudge has anything true to
 * say (`ADR 0034` 2026-08-20 review, Finding 1).
 */
function hasReconcilableActivity(debt: StoreDebtRow): boolean {
  return (
    debt.unrecordedPaymentsMinor > 0 || debt.debtMinor !== 0 || debt.unassignedMinor > 0 || debt.committedMinor > 0
  );
}

function StorePaymentProgressBlock({
  debt,
  storeName,
  storeHasOpenOrders,
}: {
  debt: StoreDebtRow;
  storeName: string;
  storeHasOpenOrders: boolean;
}) {
  const tStores = useTranslations("stores");
  const state = resolveProgressState(debt);
  // The bar and the headline read two different scopes on purpose: the headline is the store's
  // debt (unchanged, and the same number the "Registrar pago" gate and the dashboard use), the bar
  // is how far along the orders still in flight are. See `computeActiveOrdersProgressPercent`.
  const showBar = hasActiveOrderCommitment(debt);
  const pct = computeActiveOrdersProgressPercent(debt);

  const paidLabel = formatAmount(debt.activePaidMinor, debt.currencyCode);
  const committedLabel = formatAmount(debt.activeCommittedMinor, debt.currencyCode);

  // "Sin actividad": nothing committed and nothing paid in this currency, which happens when every
  // order in it was cancelled and the payments against them are all sunk. Distinct from "settled
  // with nothing active": there the collector really is square with the store and the "Al día" chip
  // is the answer, whereas here the currency has no standing left at all, and a chip saying so
  // would be claiming a relationship that no longer exists. The money is still named, by the
  // "Cancelados" line above and "Perdido en cancelados" here, just not as a state. One owner action
  // away: cancel a store's last standing order and keep its payment.
  if (!hasReconcilableActivity(debt)) {
    if (debt.lostMinor <= 0) return null;
    return (
      <div className={BLOCK_CLASS}>
        <LostOnCancelledLine debt={debt} />
      </div>
    );
  }

  return (
    <div className={BLOCK_CLASS}>
      <div className="flex items-baseline justify-between gap-3 [font-size:13.5px]">
        {state === "credit" ? (
          <span className="text-success [font-weight:500]">
            {tStores("redesign.detail.aside.debtCredit", {
              amount: formatAmount(Math.abs(debt.debtMinor), debt.currencyCode),
            })}
          </span>
        ) : state === "settled" ? (
          <Chip variant="success" size="sm">
            {tStores("redesign.detail.aside.paymentProgress.settled")}
          </Chip>
        ) : (
          <span className="[font-weight:500] [color:var(--text-primary)]">
            {/* "Pendiente en pedidos abiertos" (`openOrderDebtMinor`, `ADR 0033`, `FR-05-61`), not the
                lifetime `debtMinor`: the "Falta {amount}" headline promoted to this figure so a
                fully delivered order leaves it together with its own payments. Deliberately NOT
                clamped: a negative `openOrderDebtMinor` (unreachable by construction, `BR-05-32`)
                must still render as computed rather than be silenced. */}
            {tStores("redesign.detail.aside.paymentProgress.openOrderDebt", {
              amount: formatAmount(debt.openOrderDebtMinor, debt.currencyCode),
            })}
          </span>
        )}
        {showBar && (
          <span className="[color:var(--text-secondary)] [font-variant-numeric:tabular-nums]">
            {tStores("redesign.detail.aside.paymentProgress.percent", { pct })}
          </span>
        )}
      </div>

      {showBar && (
        <ProgressBar
          value={pct}
          label={tStores("redesign.detail.aside.paymentProgress.barLabel", { currency: debt.currencyCode })}
          valueText={tStores("redesign.detail.aside.paymentProgress.barValueText", {
            paid: paidLabel,
            committed: committedLabel,
            pct,
          })}
          className="mt-1.5 w-full"
        />
      )}

      <p className="mt-1 [font-size:var(--text-caption)] [color:var(--text-muted)] [font-variant-numeric:tabular-nums]">
        {showBar
          ? tStores("redesign.detail.aside.paymentProgress.paidOfCommitted", {
              paid: paidLabel,
              committed: committedLabel,
            })
          : tStores("redesign.detail.aside.paymentProgress.noActiveOrders")}
      </p>

      {/* Independent of `showBar`: unassigned money can sit against a store with no active orders
          left (every order COMPLETED or CANCELLED) just as easily as against one still in flight,
          and folding it behind the bar's own gate would hide it exactly there. */}
      <UnassignedMoneyLine debt={debt} />
      <LostOnCancelledLine debt={debt} />
      <ReconciliationTrigger debt={debt} storeName={storeName} storeHasOpenOrders={storeHasOpenOrders} />
    </div>
  );
}

/**
 * "Cuadrar cuenta": the reconciliation trigger, reachable per (store, currency) from anywhere in
 * this block (WO-11, `ADR 0034`). Always rendered LAST in the block, after the breakdown and the
 * unassigned/lost lines above: the action must never be the first control reached, so a collector
 * always sees what explains the gap before being offered the write (`ADR 0034` §6, "last resort, not
 * first offer"). The trigger button itself stays per-pair regardless of the nudge below: reaching
 * the sheet for one currency must never depend on another currency's state.
 *
 * The proactive nudge (`ADR 0034` §7) appears only when the whole STORE has no open orders left in
 * ANY of its currencies (`storeHasOpenOrders`, Finding 1, 2026-08-20 review), never a single pair's
 * own `!hasActiveOrderCommitment`. The nudge's copy ("no te queda nada abierto con {tienda}") is a
 * claim about the STORE, so gating it on one currency's own commitment let a settled currency
 * (nothing active in IT) show the nudge right beside a sibling currency that still owes money
 * (Vaulted Store: USD settled, PEN owing 1,200.00 PEN) - a block visibly contradicting its neighbor.
 * `MINOR-8` (WO-11 review) already covers the narrower case this subsumes: three OPEN, fully
 * prepaid orders in the SAME currency (`activeCommittedMinor > 0` there too, so `storeHasOpenOrders`
 * is still true and the nudge stays quiet).
 */
function ReconciliationTrigger({
  debt,
  storeName,
  storeHasOpenOrders,
}: {
  debt: StoreDebtRow;
  storeName: string;
  storeHasOpenOrders: boolean;
}) {
  const tStores = useTranslations("stores");
  const { openReconciliationSheet } = useStoreReconciliationState();
  const hasNothingLeftOpen = !storeHasOpenOrders;

  return (
    <div className="mt-2 flex flex-col items-start gap-1">
      {hasNothingLeftOpen && (
        <p className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">
          {tStores("redesign.detail.reconciliation.nudge", { store: storeName })}
        </p>
      )}
      <Button
        variant="ghost"
        size="sm"
        leadingIcon={<Scale size={14} aria-hidden="true" />}
        onClick={() => openReconciliationSheet(debt.currencyCode)}
      >
        {tStores("redesign.detail.reconciliation.trigger")}
      </Button>
    </div>
  );
}

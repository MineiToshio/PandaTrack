"use client";

import { useTranslations } from "next-intl";
import Chip from "@/components/core/Chip";
import ProgressBar from "@/components/core/ProgressBar";
import SummaryStatRow from "@/components/modules/SummaryStatRow";
import { formatAmount } from "@/lib/currency";
import {
  computeActiveOrdersProgressPercent,
  hasActiveOrderCommitment,
  resolveDebtReconciliationLine,
  resolveProgressState,
  sortDebtsByActionability,
} from "@/lib/orders/storePaymentPresentation";
import type { StoreDebtRow } from "@/lib/data/orders/storePaymentQueries";
import { useStorePaymentState } from "./StorePaymentStateProvider";

type StorePaymentProgressRowsProps = {
  /**
   * Every order's cost including the cancelled ones, per currency — the figure the "Total
   * facturado" row above already shows. Used only to name the gap against `committedMinor`.
   */
  totalSpentByCurrency: Array<{ currencyCode: string; totalMinorUnits: number }>;
};

/**
 * The store sidebar's payment progress block: one bar per currency, replacing the old "Deuda
 * pendiente" row, plus the "Cancelados" reconciliation line that keeps "Total facturado" honest.
 *
 * Why a bar and not a number. "Deuda pendiente" rendered `S/ 0.00` on 104 of the collector's 120
 * stores, which is a lot of pixels spent saying nothing; a bar reading "Al día" says the same
 * thing usefully, and on the store/currency pairs with a live debt it puts "Falta {amount}"
 * against the pair it came from.
 *
 * **What the bar measures, and what it does not.** The bar's ratio is scoped to the orders still
 * in flight: `activePaidMinor / activeCommittedMinor`. The headline, the "Registrar pago" gate,
 * the "Por tienda" order view and the dashboard all keep reading the lifetime `debtMinor`, which
 * is untouched. Only the ratio was narrowed, and the reason is in
 * `computeActiveOrdersProgressPercent`.
 *
 * Four deliberate refusals to simplify:
 *
 *  - **The percentage is never shown alone.** `Falta {amount}` and `{paid} pagados de {committed}
 *    en pedidos activos` are always next to it, and that caption names its own scope so it cannot
 *    be read as the store's lifetime total.
 *  - **No denominator, no bar.** With nothing active there is nothing to measure, and a full track
 *    over a zero denominator is the same graphical lie as one drawn past 100%. The block stays
 *    (it still answers "am I square with this store?"); it just says "Sin pedidos activos"
 *    instead of drawing progress. That is 112 of 122 store/currency pairs today.
 *  - **Currencies are never summed.** Two currencies mean two independent blocks; converting them
 *    would need an FX rate at read time, which this domain models per order, not per store.
 *  - **Every gap gets a line rather than a silent difference.** "Cancelados" for orders that were
 *    called off, "Perdido en cancelados" for money sunk in them, and the two directions of the
 *    headline-versus-bar gap: "Fuera de pedidos activos" for a debt on an order already delivered,
 *    "A cuenta" for money handed over that no active order claims. All of them are conditional and
 *    all of them exist so no two figures in this card can disagree without saying why.
 */
export default function StorePaymentProgressRows({ totalSpentByCurrency }: StorePaymentProgressRowsProps) {
  const tStores = useTranslations("stores");
  const { storeDebtByCurrency } = useStorePaymentState();

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
        <StorePaymentProgressBlock key={debt.currencyCode} debt={debt} />
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
 * The gap between the headline and the bar's pair, named in whichever direction it opens.
 *
 * The headline is the store's whole debt while the bar's pair covers only its active orders, so the
 * two can disagree both ways and both are reachable: "Fuera de pedidos activos" when an order was
 * delivered without being fully paid (headline bigger than the pair's gap), "A cuenta" when money
 * was handed over without being declared against an active order (headline smaller). Which one, and
 * when neither, is {@link resolveDebtReconciliationLine}. Rendered only alongside a bar: with no bar
 * the caption already says the whole debt sits outside the active set.
 */
function DebtReconciliationLine({ debt }: { debt: StoreDebtRow }) {
  const tStores = useTranslations("stores");
  const line = resolveDebtReconciliationLine(debt);
  if (!line) return null;
  return (
    <p className="mt-1 [font-size:var(--text-caption)] [color:var(--text-muted)] [font-variant-numeric:tabular-nums]">
      {tStores(`redesign.detail.aside.paymentProgress.${line.kind}`, {
        amount: formatAmount(line.amountMinor, debt.currencyCode),
      })}
    </p>
  );
}

function StorePaymentProgressBlock({ debt }: { debt: StoreDebtRow }) {
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
  if (debt.committedMinor === 0 && debt.paidMinor === 0) {
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
            {tStores("redesign.detail.aside.paymentProgress.remaining", {
              amount: formatAmount(debt.debtMinor, debt.currencyCode),
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

      {showBar && <DebtReconciliationLine debt={debt} />}
      <LostOnCancelledLine debt={debt} />
    </div>
  );
}

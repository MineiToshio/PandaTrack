"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Scale, Trash2, Wallet } from "lucide-react";
import Button from "@/components/core/Button/Button";
import Eyebrow from "@/components/core/Eyebrow";
import Typography from "@/components/core/Typography";
import CollapsibleSection from "@/components/modules/CollapsibleSection";
import { Modal } from "@/components/modules/Modal";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { formatAmountSymbolOnly } from "@/lib/currency";
import { formatDomainDate } from "@/lib/domainDate";
import StorePaymentRow from "./StorePaymentRow";
import { useStorePaymentState } from "./StorePaymentStateProvider";
import {
  isOptimisticAdjustmentId,
  useStoreReconciliationState,
  type StoreReconciliationAdjustmentRow,
} from "./StoreReconciliationProvider";

type StorePaymentsSectionProps = {
  locale: string;
};

/**
 * "Pagos a esta tienda": every `store_payment` the collector has made here, independent of which
 * order (if any) claims it. Both the order detail payments card and the store payment sheet work
 * through allocations, so a payment recorded "on account" (no allocation) or one whose remainder
 * was never declared has no other screen it can be seen or deleted from — this card is that door.
 * Renders nothing when the viewer has never paid this store.
 *
 * This list stays in the MAIN column, and that is a measurement, not a preference: the sidebar is
 * 320px, which leaves 278px of usable width, and a row carrying date + order reference + product
 * name + amount + two controls has about 7px left for the product name there. The reference alone
 * is a fixed 15 characters. Moving the list to the rail would truncate away the exact thing the row
 * exists to show. The summary half of this feature — the progress bar — is what went to the rail.
 *
 * The section is deliberately never collapsed by default, even at 102 rows. A collapsed
 * `CollapsibleSection` body keeps its children focusable inside an `aria-hidden` subtree (the
 * `grid-template-rows: 0fr` trick does not remove them from the tree), which axe flags as
 * `aria-hidden-focus`, and the "Ver los N pagos" control lives inside that body — so the one case
 * where collapsing would help is the one case where it would hide the control that resolves it.
 */
export default function StorePaymentsSection({ locale }: StorePaymentsSectionProps) {
  const tStores = useTranslations("stores");
  const {
    storePayments,
    storePaymentsTotalCount,
    deleteStorePayment,
    loadAllStorePayments,
    isLoadingAllStorePayments,
    hasLoadAllStorePaymentsError,
  } = useStorePaymentState();
  const { adjustments, deleteAdjustment } = useStoreReconciliationState();

  const listRef = useRef<HTMLUListElement>(null);
  // "See all" asks for focus to land on the first newly revealed row, i.e. on the index equal to
  // how many rows were on screen when the button was pressed. The request is state, and it is
  // honoured from an effect rather than from the click handler, because the DOM is not ready when
  // that handler resumes: `await loadAllStorePayments()` continues on a MICROTASK while React
  // commits the rows it just requested on a later task. Reading `listRef.current.children[i]`
  // there finds the old list, silently no-ops, and then the button that had focus unmounts and
  // focus falls to <body> — the exact outcome the focus call exists to prevent.
  //
  // A fresh object per press, so pressing "Reintentar" after a failure is a new request even
  // though it aims at the same index.
  //
  // `pressedFrom` is the element that held focus when the press happened, and it is what tells the
  // two "nothing was revealed" endings apart. If it is still in the document the button survived
  // and is still holding focus, which is where focus belongs. If it has been removed, the button
  // unmounted (the list turned out to be complete) and took the focus with it. Testing the element
  // rather than reading `document.activeElement` alone matters because a mouse press does not
  // focus a button in every browser: in Safari `activeElement` is already <body> at press time,
  // and moving focus there would scroll a collector who is only clicking down to the last row.
  const [focusRequest, setFocusRequest] = useState<{ index: number; pressedFrom: Element | null } | null>(null);
  // Which request has already been dealt with. A ref, not state: clearing the request from inside
  // the effect would be a synchronous setState in an effect body, and re-running the effect on a
  // later, unrelated row insert must not re-steal focus.
  const handledFocusRequest = useRef<typeof focusRequest>(null);

  useEffect(() => {
    if (focusRequest == null || handledFocusRequest.current === focusRequest) return;
    // A failed load reveals nothing, so there is no row to aim at and the button is still on
    // screen holding focus. Retire the request instead of leaving it armed.
    if (hasLoadAllStorePaymentsError) {
      handledFocusRequest.current = focusRequest;
      return;
    }
    if (storePayments.length <= focusRequest.index) {
      // Two different situations look identical here. Either the rows have not been committed yet,
      // in which case this effect runs again when they are — or the load is over and revealed
      // nothing, in which case there will never be a row at this index and the request must be
      // retired. Leaving it armed is not harmless: the effect re-runs on the next insert from any
      // source, so recording a payment minutes later would yank focus off whatever the collector
      // was doing and into the list.
      if (isLoadingAllStorePayments) return;
      handledFocusRequest.current = focusRequest;
      // Revealing nothing is reachable: the badge said 2, another session deleted one, and the
      // fetch returns the row already on screen. Now that the total is derived from the list, that
      // answer also completes the list, so "Ver los N pagos" unmounts in this same commit and the
      // focus it was holding falls to <body>. The end of the list is where the collector was
      // headed, and the rows are programmatic focus targets for exactly this.
      //
      // Only when the press came FROM a control that has since left the document. A button still
      // on screen is still the right place for the focus, and a mouse press that never focused
      // anything must not be answered by scrolling the page down to the last row.
      const pressedControlIsGone = focusRequest.pressedFrom != null && !focusRequest.pressedFrom.isConnected;
      if (!pressedControlIsGone || document.activeElement !== document.body) return;
      const lastRow = listRef.current?.lastElementChild;
      if (lastRow instanceof HTMLElement) lastRow.focus();
      return;
    }
    handledFocusRequest.current = focusRequest;
    const firstNewRow = listRef.current?.children[focusRequest.index];
    if (firstNewRow instanceof HTMLElement) firstNewRow.focus();
  }, [focusRequest, storePayments.length, hasLoadAllStorePaymentsError, isLoadingAllStorePayments]);

  if (storePayments.length === 0 && adjustments.length === 0) return null;

  const hasHiddenPayments = storePayments.length < storePaymentsTotalCount;

  async function handleLoadAll() {
    const index = storePayments.length;
    // Read BEFORE the await: by the time it resolves the button may already be unmounted and
    // `document.activeElement` already reset to <body>, which is the very state we need to tell
    // apart from "the collector clicked without ever focusing anything".
    const pressedFrom = document.activeElement;
    await loadAllStorePayments();
    setFocusRequest({ index, pressedFrom });
  }

  return (
    <>
      {storePayments.length > 0 && (
        <CollapsibleSection
          eyebrow={
            <Eyebrow variant="chip" tone="accent" icon={Wallet}>
              {tStores("redesign.detail.paymentsTitle")}
            </Eyebrow>
          }
          // The TRUE total, not the number of rows rendered: a store with 38 payments showing its
          // first 20 used to label the section "20".
          count={storePaymentsTotalCount}
          topAccent="accent"
        >
          <ul role="list" ref={listRef} className="flex flex-col">
            {storePayments.map((payment) => (
              <StorePaymentRow
                key={payment.id}
                payment={payment}
                locale={locale}
                onConfirmDelete={deleteStorePayment}
              />
            ))}
          </ul>

          {hasHiddenPayments && (
            <div className="mt-2 flex flex-col items-start gap-1">
              {hasLoadAllStorePaymentsError && (
                <p role="alert" className="text-destructive [font-size:var(--text-caption)]">
                  {tStores("redesign.detail.payments.seeAllError")}
                </p>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoadAll}
                loading={isLoadingAllStorePayments}
                data-ph-event={POSTHOG_EVENTS.STORE.PAYMENTS_ALL_LOADED}
              >
                {hasLoadAllStorePaymentsError
                  ? tStores("redesign.detail.payments.seeAllRetry")
                  : tStores("redesign.detail.payments.seeAll", { count: storePaymentsTotalCount })}
              </Button>
            </div>
          )}

          {/* Text only, and never wrapping the button: `role="status"` implies `aria-atomic`, so a
              button inside it would be re-announced on every update. */}
          <p role="status" aria-live="polite" className="sr-only">
            {tStores("redesign.detail.payments.loadedStatus", {
              shown: storePayments.length,
              total: storePaymentsTotalCount,
            })}
          </p>
        </CollapsibleSection>
      )}

      {/* "Ajustes de cuadre": its own labelled block, never interleaved into "Pagos a esta tienda"
          above (WO-11, `ADR 0034` §2 and §4). An adjustment reads as an audit trail, not a payment. */}
      {adjustments.length > 0 && (
        <CollapsibleSection
          eyebrow={
            <Eyebrow variant="chip" tone="cool" icon={Scale}>
              {tStores("redesign.detail.reconciliation.historyTitle")}
            </Eyebrow>
          }
          count={adjustments.length}
          topAccent="cool"
        >
          <ul role="list" className="flex flex-col">
            {adjustments.map((adjustment) => (
              <StoreAccountAdjustmentRow
                key={adjustment.id}
                adjustment={adjustment}
                locale={locale}
                onConfirmDelete={deleteAdjustment}
              />
            ))}
          </ul>
        </CollapsibleSection>
      )}
    </>
  );
}

type StoreAccountAdjustmentRowProps = {
  adjustment: StoreReconciliationAdjustmentRow;
  locale: string;
  onConfirmDelete: (adjustmentId: string) => Promise<{ ok: boolean; error?: string }>;
};

/**
 * One "Ajuste de cuadre" in the history block: its date, its derived magnitude, its reason and every
 * order it named, each still by its own DATE rather than its `ORD-` code (`FR-05-67`). Deletable
 * behind a destructive confirm (template: `StorePaymentRow`'s own delete modal), optimistic like
 * every other delete in this domain.
 */
function StoreAccountAdjustmentRow({ adjustment, locale, onConfirmDelete }: StoreAccountAdjustmentRowProps) {
  const tStores = useTranslations("stores");
  const tReconciliation = useTranslations("stores.redesign.detail.reconciliation");
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateLabel = formatDomainDate(adjustment.adjustmentDate, locale, { dateStyle: "medium" });
  const amountLabel = formatAmountSymbolOnly(adjustment.magnitudeMinor, adjustment.currencyCode, locale);
  // A row the client added and the server has not answered for yet has no real id to delete by
  // (`MINOR-6`, WO-11 review, mirroring `StorePaymentRow`'s own `isAwaitingServerId` guard). Left
  // clickable, a fast collector could remove it mid-flight and get a NOT_FOUND error toast for an
  // adjustment that was in fact recorded.
  const isAwaitingServerId = isOptimisticAdjustmentId(adjustment.id);

  async function handleConfirm() {
    setIsPending(true);
    setError(null);
    const result = await onConfirmDelete(adjustment.id);
    setIsPending(false);
    if (result.ok) {
      setModalOpen(false);
    } else {
      setError(tReconciliation("historyDeleteError"));
    }
  }

  return (
    <>
      <li className="flex flex-col gap-1 py-2.5 [border-bottom:1px_solid_var(--border)] last:border-b-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <p className="[font-size:var(--text-body)] font-medium [color:var(--text-primary)]">
              {tReconciliation("historyEntryHeading", { date: dateLabel, amount: amountLabel })}
            </p>
            <p className="mt-0.5 [font-size:var(--text-caption)] [color:var(--text-secondary)]">{adjustment.reason}</p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={isAwaitingServerId}
            aria-label={tReconciliation("historyDeleteAria", { date: dateLabel, amount: amountLabel })}
            className="text-text-muted hover:text-text-title relative grid size-7 shrink-0 cursor-pointer place-items-center rounded-md transition-colors before:absolute before:[inset:-8px] before:content-[''] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-default disabled:opacity-40 md:before:inset-0"
          >
            <Trash2 className="size-[13px]" aria-hidden />
          </button>
        </div>
        <ul role="list" className="mt-1 flex flex-col gap-0.5">
          {adjustment.lines.map((line) => (
            <li
              key={line.orderId}
              className="flex items-baseline justify-between gap-2 [font-size:var(--text-caption)] [color:var(--text-muted)]"
            >
              <span>
                {tReconciliation("historyLineOrder", {
                  date: formatDomainDate(line.orderDate, locale, { dateStyle: "medium" }),
                })}
              </span>
              <span className="tabular-nums">
                {formatAmountSymbolOnly(line.amountMinor, adjustment.currencyCode, locale)}
              </span>
            </li>
          ))}
        </ul>
      </li>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={tReconciliation("historyDeleteModalTitle")}
        subtitle={tReconciliation("historyDeleteModalDescription", { date: dateLabel, amount: amountLabel })}
        icon={<Trash2 size={20} aria-hidden="true" />}
        tone="destructive"
        role="alertdialog"
        dismissible={false}
        primaryAction={{
          label: isPending ? "…" : tReconciliation("historyDeleteConfirm"),
          onClick: handleConfirm,
          variant: "destructive",
          loading: isPending,
          disabled: isPending,
        }}
        secondaryAction={{
          label: tStores("redesign.detail.payments.deleteCancel"),
          onClick: () => setModalOpen(false),
          disabled: isPending,
        }}
      >
        {error && (
          <Typography size="sm" className="text-destructive" role="alert">
            {error}
          </Typography>
        )}
      </Modal>
    </>
  );
}

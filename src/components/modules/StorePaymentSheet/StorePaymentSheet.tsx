"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import Button from "@/components/core/Button/Button";
import Modal from "@/components/modules/Modal/Modal";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { formatAmountWithSymbol, getCurrencyDecimals, MINOR_UNITS_PER_MAJOR } from "@/lib/currency";
import { sanitizeDecimalInput } from "@/lib/decimalInput";
import { toDomainDate } from "@/lib/domainDate";
import { parseDecimalToMinorUnits } from "@/lib/money/parseDecimalToMinorUnits";
import type { AssignableOrder } from "@/lib/data/orders/storePaymentAssignableOrdersQueries";
import {
  buildAllocationInputs,
  buildDeclaredPaidItemIds,
  computeUnallocatedMinor,
  findOverAllocationCulprit,
  itemLineKey,
  restLineKey,
  validateStorePaymentSheetDraft,
  type SheetOrderDraft,
  type StorePaymentSheetDraft,
} from "@/lib/orders/storePaymentSheetValidation";
import StorePaymentAllocationPanel, { type AllocationRevealRequest } from "./StorePaymentAllocationPanel";
import StorePaymentPanel, { STORE_PAYMENT_DATE_FIELD_ID } from "./StorePaymentPanel";
import { buildAllocationLines } from "./buildAllocationLines";
import type { AllocationLine } from "./buildAllocationLines";
import type {
  StorePaymentSheetDebt,
  StorePaymentSheetSubmitInput,
  StorePaymentSubmitOutcome,
} from "./StorePaymentSheet.types";

export type { StorePaymentSheetDebt, StorePaymentSheetSubmitInput, StorePaymentSubmitOutcome };

/** Id of the summary row's entry button, so leaving the allocation panel returns focus to it. */
const ALLOCATIONS_OPEN_BUTTON_ID = "store-payment-allocations-open";

export type StorePaymentSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  storeName: string;
  /** One row per currency the collector has standing orders or payments with this store in. */
  debts: StorePaymentSheetDebt[];
  /** Every open order with an assignable balance, across every currency; filtered here by the
      selected payment currency. Loaded by the coordinator when the sheet opens. */
  orders: AssignableOrder[];
  ordersLoading: boolean;
  ordersError: boolean;
  /** The list on screen survived a refresh that failed, so it is the last payload that DID land. */
  ordersStale: boolean;
  /** A refresh is in flight over the list on screen, so asking for another one is pointless. */
  ordersRefreshing: boolean;
  onRetryOrders: () => void;
  locale: string;
  /**
   * Resolves `{ ok: true }` synchronously-enough for the "on account" path (the coordinator keeps
   * the mutation in flight behind it) and with the server's real answer once the payment carries
   * declarations. A refusal names the offending line so the draft survives it.
   */
  onSubmit: (input: StorePaymentSheetSubmitInput) => Promise<StorePaymentSubmitOutcome> | void;
};

/**
 * A refusal with no line of its own to point at.
 *
 * `blocksResend` separates the two kinds, which need opposite treatment. A refusal the server
 * DESCRIBED (`STORE_DEBT_EXCEEDED`, …) is a verdict on this exact draft, so the CTA stays shut
 * until the draft changes in a way that could change the verdict. A submission that got no answer
 * at all (network drop, a 502) is no verdict at all: resending the very same payment is the right
 * move, so the message is shown without ever disabling the button.
 *
 * Which one it is comes from the outcome's `unanswered` flag, NOT from whether the promise
 * rejected: both coordinators absorb a rejection into a resolved `{ ok: false }` on purpose, so
 * reading the rejection would put every real network drop in the blocking branch. A promise that
 * DOES reject is therefore a third thing, and blocks (see the `catch` in `handleConfirm`).
 */
type SheetSubmitError = { code: string; blocksResend: boolean };

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function minorUnitsToInputString(minor: number, currencyCode: string): string {
  return (minor / MINOR_UNITS_PER_MAJOR).toFixed(getCurrencyDecimals(currencyCode));
}

/**
 * "Registrar pago a {tienda}": records money handed to a store, with an optional declaration of
 * what it covers (§ store-level payments).
 *
 * Two panels inside one modal. **Pago** is the default and the common path — amount, date, note,
 * submit — because a payment with nothing declared is a legitimate result, recorded on the store's
 * account. **Asignación** is opt-in and takes the whole body when entered, so the list of payable
 * lines gets every pixel of height instead of sharing it with the form.
 *
 * Every client-side rule in `storePaymentSheetValidation.ts` runs live as the collector types, so
 * the primary CTA is only ever enabled on a draft the server is expected to accept. What happens
 * when the server refuses anyway depends on what is at stake: a payment with no declarations closes
 * optimistically and surfaces the refusal through the coordinator's toast, but a payment carrying
 * declarations keeps the sheet open until the server answers, because up to dozens of hand-typed
 * amounts are not reconstructible from a toast.
 */
export default function StorePaymentSheet({
  isOpen,
  onClose,
  storeId,
  storeName,
  debts,
  orders,
  ordersLoading,
  ordersError,
  ordersStale,
  ordersRefreshing,
  onRetryOrders,
  locale,
  onSubmit,
}: StorePaymentSheetProps) {
  const t = useTranslations("orders.detail.storePayment");

  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState<Date | null>(startOfToday);
  const [note, setNote] = useState("");
  const [currencyCode, setCurrencyCode] = useState(() => debts[0]?.currencyCode ?? "");
  const [activePanel, setActivePanel] = useState<"payment" | "allocation">("payment");
  const [lineAmounts, setLineAmounts] = useState<Record<string, string>>({});
  /**
   * Line keys this payment declares covered. Held beside the amounts rather than inside them
   * because it is a different axis: it enters no ceiling, moves no total, and never gates the CTA.
   * Reconciliation is shared: `renderableKeys` filters both, so a mark whose row vanished is
   * dropped exactly like an amount typed into that row.
   */
  const [declaredLineKeys, setDeclaredLineKeys] = useState<ReadonlySet<string>>(() => new Set());
  /**
   * The deliberate "no sé todavía" amount (WO-09, `FR-05-58`/`FR-05-60`, `ADR 0033`). Held beside
   * the draft's other money state rather than derived, because it is not arithmetic: it is a
   * one-shot CHOICE the collector makes ("park exactly what's left right now"), not a live
   * computation that should track the remainder as it moves. Reset to 0 by every handler that
   * changes the amount or a line's own money below — the choice has to be re-made on purpose
   * whenever the number it was about moves, never carried over onto a draft it was never chosen for.
   */
  const [parkedAmountMinor, setParkedAmountMinor] = useState(0);
  const [lastEditedLineKey, setLastEditedLineKey] = useState<string | null>(null);
  const [serverRejectedLineKey, setServerRejectedLineKey] = useState<string | null>(null);
  const [revealRequest, setRevealRequest] = useState<AllocationRevealRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  /** A refusal that names no line of its own, kept as a sheet-level message. See `handleConfirm`. */
  const [submitError, setSubmitError] = useState<SheetSubmitError | null>(null);

  const amountRef = useRef<HTMLInputElement>(null);
  const allocationContainerRef = useRef<HTMLDivElement>(null);
  const revealTokenRef = useRef(0);
  /** Which panel last took focus, so the initial open leaves it to the modal's `initialFocusRef`. */
  const focusedPanelRef = useRef<"payment" | "allocation" | null>(null);

  const ordersForCurrency = useMemo(
    () => orders.filter((order) => order.currencyCode === currencyCode),
    [orders, currencyCode],
  );
  const lines = useMemo(() => buildAllocationLines(ordersForCurrency), [ordersForCurrency]);
  const debtForCurrency = debts.find((debt) => debt.currencyCode === currencyCode)?.debtMinor ?? 0;

  /**
   * Wipes the declarations, and deliberately NOT `submitError`. "Limpiar" is a change to the
   * allocation draft, and a sheet-level refusal is a verdict on the amount, the date or the
   * currency: clearing the lines cannot lift it, so re-arming the CTA on it would only invite the
   * identical refusal (a line edit is already treated the same way, see
   * {@link clearResendableSubmitError}). Closing and switching currency clear it explicitly, since
   * those really do change what the verdict was about.
   */
  const resetDraftState = useCallback(() => {
    setLineAmounts({});
    setDeclaredLineKeys(new Set());
    setLastEditedLineKey(null);
    setServerRejectedLineKey(null);
    // A reveal outlives the draft it was about otherwise: the panel unmounts on "Volver al pago"
    // and remounts with a fresh token counter, so a request left standing would be replayed and
    // steal the focus on every later entry into the panel.
    setRevealRequest(null);
    // "Limpiar" (or a currency switch) wipes every allocation line, so a parked amount chosen
    // against the old draft no longer explains anything real; carrying it forward would let a
    // now-empty draft still read as "fully declared".
    setParkedAmountMinor(0);
  }, []);

  const handleClose = useCallback(() => {
    setAmount("");
    setPaymentDate(startOfToday());
    setNote("");
    setCurrencyCode(debts[0]?.currencyCode ?? "");
    setActivePanel("payment");
    setDateError(null);
    setIsSubmitting(false);
    setSubmitError(null);
    resetDraftState();
    onClose();
  }, [debts, onClose, resetDraftState]);

  const handleAmountChange = useCallback((next: string) => {
    setAmount(next);
    setSubmitError(null);
    // The parked slice was a choice about THIS amount's remainder; a different amount has a
    // different remainder, so the choice has to be re-made rather than silently reinterpreted.
    setParkedAmountMinor(0);
  }, []);

  /** Line edits clear a network failure's message, but never a verdict the amount alone can lift. */
  const clearResendableSubmitError = useCallback(() => {
    setSubmitError((current) => (current && !current.blocksResend ? null : current));
  }, []);

  const handleCurrencyChange = useCallback(
    (next: string) => {
      setCurrencyCode(next);
      // A different currency means a different set of eligible orders — a draft amount typed
      // against last currency's orders would silently misattribute if it survived the switch. The
      // currency is also one of the three inputs a sheet-level refusal is a verdict about, so this
      // is one of the changes that legitimately re-arms the CTA.
      setSubmitError(null);
      resetDraftState();
    },
    [resetDraftState],
  );

  const renderableKeys = useMemo(() => new Set(lines.map((line) => line.key)), [lines]);

  /**
   * The half of {@link parseLine} the collector has to be TOLD about: money typed into a row that
   * no longer renders.
   *
   * A row leaves under a live draft on the everyday path, with the list perfectly `ready`: an
   * in-place refetch lands and comes back shorter, because the order was settled from another tab
   * or from the order detail's inline form between the two loads. Zeroing those keys is right (no
   * money may be declared through a row nobody can see or correct), but doing it silently is what
   * turns the next submit into a payment recorded "on account" with every typed declaration
   * discarded and nothing said. So it is derived from the DRAFT, not from `ordersStatus`, which
   * stays `ready` throughout and therefore cannot see this at all.
   *
   * Keyed on a POSITIVE typed amount: a line left at "0" is not money and must not raise an alarm
   * or shut the CTA. `typedMinor` is the whole draft's typed total, which is what tells a submission
   * carrying nothing declared apart from one whose declarations were all dropped.
   */
  const droppedDraftLines = useMemo(() => {
    const keys: string[] = [];
    let droppedMinor = 0;
    let typedMinor = 0;
    for (const [key, raw] of Object.entries(lineAmounts)) {
      const typed = Math.max(0, parseDecimalToMinorUnits(raw, currencyCode) ?? 0);
      if (typed <= 0) continue;
      typedMinor += typed;
      if (renderableKeys.has(key)) continue;
      keys.push(key);
      droppedMinor += typed;
    }
    return { keys, droppedMinor, typedMinor };
  }, [lineAmounts, renderableKeys, currencyCode]);

  const hasDroppedDraftLines = droppedDraftLines.keys.length > 0;

  /**
   * Takes the vanished keys out of the draft, and nothing else. "Limpiar" would also do it, at the
   * price of every line still on screen — which is the wrong trade when the collector has just been
   * told that only some of them fell away.
   */
  const handleDismissDroppedLines = useCallback(() => {
    const dropped = new Set(droppedDraftLines.keys);
    setLineAmounts((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => !dropped.has(key))));
    setLastEditedLineKey((current) => (current && dropped.has(current) ? null : current));
    setServerRejectedLineKey((current) => (current && dropped.has(current) ? null : current));
  }, [droppedDraftLines.keys]);

  const draft: StorePaymentSheetDraft = useMemo(() => {
    const amountMinor = parseDecimalToMinorUnits(amount, currencyCode) ?? 0;
    // Only a line the collector can SEE counts. `lineAmounts` is keyed and outlives its row: an
    // order's "Resto del pedido" row only exists while `restCeilingMinor > 0`, and a concurrent
    // allocation elsewhere (another tab, the order detail's inline form) can take that row away
    // between two refetches. Reading the key regardless would keep the money in the totals, in the
    // CTA's arithmetic and in the submitted payload with no row on screen accounting for it.
    const parseLine = (key: string) =>
      renderableKeys.has(key) ? Math.max(0, parseDecimalToMinorUnits(lineAmounts[key] ?? "", currencyCode) ?? 0) : 0;

    const orderDrafts: SheetOrderDraft[] = ordersForCurrency.map((order) => ({
      orderId: order.orderId,
      orderDate: order.orderDate,
      assignableMinor: order.assignableMinor,
      restCeilingMinor: order.restCeilingMinor,
      amountMinor: parseLine(restLineKey(order.orderId)),
      items: order.items.map((item) => ({
        itemId: item.itemId,
        remainingBaseMinor: item.basePagableMinor != null ? item.basePagableMinor - item.allocatedMinor : null,
        amountMinor: parseLine(itemLineKey(order.orderId, item.itemId)),
        // Already-marked products are NOT re-declared: this is what THIS payment adds.
        declared:
          !item.paidDeclared &&
          renderableKeys.has(itemLineKey(order.orderId, item.itemId)) &&
          declaredLineKeys.has(itemLineKey(order.orderId, item.itemId)),
      })),
    }));

    return {
      paymentAmountMinor: amountMinor,
      debtMinor: debtForCurrency,
      paymentDate: paymentDate ? toDomainDate(paymentDate) : null,
      orders: orderDrafts,
      parkedAmountMinor,
    };
  }, [
    amount,
    currencyCode,
    ordersForCurrency,
    lineAmounts,
    declaredLineKeys,
    renderableKeys,
    debtForCurrency,
    paymentDate,
    parkedAmountMinor,
  ]);

  const validation = useMemo(() => validateStorePaymentSheetDraft(draft), [draft]);
  const allocations = useMemo(() => buildAllocationInputs(draft.orders), [draft.orders]);
  const declarePaidItemIds = useMemo(() => buildDeclaredPaidItemIds(draft.orders), [draft.orders]);
  const amountTouched = amount.trim() !== "";
  // `dateErrors` belongs here too: a payment dated before one of the orders it declares is an
  // ALLOCATION problem with a named culprit line, not only a date-field problem.
  const hasAllocationError =
    validation.allocationExceedsAmount ||
    validation.orderErrors.size > 0 ||
    validation.itemErrors.size > 0 ||
    validation.dateErrors.size > 0;

  const handleLineChange = useCallback(
    (line: AllocationLine, raw: string) => {
      const sanitized = sanitizeDecimalInput(raw, currencyCode);
      setLineAmounts((prev) => {
        if (sanitized.trim() === "") {
          const { [line.key]: _removed, ...rest } = prev;
          return rest;
        }
        return { ...prev, [line.key]: sanitized };
      });
      setLastEditedLineKey(line.key);
      setServerRejectedLineKey((current) => (current === line.key ? null : current));
      clearResendableSubmitError();
      // A hand-typed line changes the remainder a park was about, so the choice has to be re-made.
      setParkedAmountMinor(0);
    },
    [clearResendableSubmitError, currencyCode],
  );

  const handleLineFill = useCallback(
    (line: AllocationLine, fillableMinor: number) => {
      if (fillableMinor <= 0) return;
      setLineAmounts((prev) => ({ ...prev, [line.key]: minorUnitsToInputString(fillableMinor, currencyCode) }));
      setLastEditedLineKey(line.key);
      setServerRejectedLineKey((current) => (current === line.key ? null : current));
      clearResendableSubmitError();
      setParkedAmountMinor(0);
    },
    [clearResendableSubmitError, currencyCode],
  );

  /**
   * Flips this payment's coverage claim on one line. Deliberately touches nothing else: no
   * `lastEditedLineKey` (there is no amount to point a culprit at), no submit-error clearing (a
   * refusal about money cannot be answered by a mark), and no ceiling anywhere.
   */
  const handleToggleDeclared = useCallback((line: AllocationLine) => {
    setDeclaredLineKeys((previous) => {
      const next = new Set(previous);
      if (next.has(line.key)) next.delete(line.key);
      else next.add(line.key);
      return next;
    });
  }, []);

  /**
   * The explicit "no sé todavía" action (WO-09, `FR-05-58`/`FR-05-60`, `ADR 0033`): parks exactly
   * the draft's own current remainder, never a default and never a partial figure the collector
   * could under- or over-shoot by hand. Reading `computeUnallocatedMinor(draft)` rather than the
   * memoized `validation.unallocatedMinor` is deliberate belt-and-suspenders: both read the same
   * live draft, so they can never disagree, but the direct call keeps this handler correct even if
   * a future edit reorders the memos it depends on. A no-op below 0 amount or a payment already
   * fully declared, so the control this drives can simply always be wired to it.
   */
  const handleParkRemainder = useCallback(() => {
    const remainder = computeUnallocatedMinor(draft);
    if (remainder <= 0) return;
    setParkedAmountMinor(remainder);
    posthog.capture(POSTHOG_EVENTS.STORE.PAYMENT_ALLOCATION_PARKED, { store_id: storeId, amount_minor: remainder });
  }, [draft, storeId]);

  /** Undoes a park choice, without touching anything else: the collector wants to name it after all. */
  const handleUnpark = useCallback(() => setParkedAmountMinor(0), []);

  const handleOpenAllocations = useCallback(() => {
    posthog.capture(POSTHOG_EVENTS.STORE.PAYMENT_ALLOCATIONS_OPENED, {
      store_id: storeId,
      lines_count: lines.length,
    });
    setActivePanel("allocation");
  }, [lines.length, storeId]);

  /**
   * Points at a line that is actually ON SCREEN. `blockingLines` is keyed by every line a rule
   * implicates, including an order's "Resto del pedido" key — which the panel only renders when
   * `restCeilingMinor > 0`, so taking the map's first key blindly aims at a row that frequently
   * does not exist. Preference goes to the line the collector last touched when that one is itself
   * blocked, because it is the one they expect to be told about.
   */
  const resolveCulpritKey = useCallback((): string | null => {
    const blockingKeys = [...validation.blockingLines.keys()].filter((key) => renderableKeys.has(key));
    if (lastEditedLineKey && blockingKeys.includes(lastEditedLineKey)) return lastEditedLineKey;
    if (blockingKeys.length > 0) return blockingKeys[0];
    if (!validation.allocationExceedsAmount) return null;
    const overKey = findOverAllocationCulprit(draft, lastEditedLineKey);
    return overKey && renderableKeys.has(overKey) ? overKey : null;
  }, [draft, lastEditedLineKey, renderableKeys, validation.allocationExceedsAmount, validation.blockingLines]);

  const handleReview = useCallback(() => {
    handleOpenAllocations();
    const culprit = resolveCulpritKey();
    if (culprit) {
      revealTokenRef.current += 1;
      setRevealRequest({ lineKey: culprit, token: revealTokenRef.current });
    }
  }, [handleOpenAllocations, resolveCulpritKey]);

  /**
   * A reveal is a one-shot errand, so it is retired the moment the panel reports having run it.
   * Leaving it standing would replay it on every later entry into the panel: the panel unmounts on
   * "Volver al pago" and remounts with a fresh token counter, and the store detail page keeps one
   * sheet instance across opens, so a stale request survives even closing and reopening.
   */
  const handleRevealHandled = useCallback((token: number) => {
    setRevealRequest((current) => (current && current.token === token ? null : current));
  }, []);

  const handleBackToPayment = useCallback(() => setActivePanel("payment"), []);

  const handleEditDate = useCallback(() => {
    setActivePanel("payment");
    // Deferred so the field exists before it is asked for focus.
    queueMicrotask(() => document.getElementById(STORE_PAYMENT_DATE_FIELD_ID)?.focus());
  }, []);

  /**
   * Moving between panels moves the focus with it, so a keyboard user is never left on a control
   * that just disappeared. It deliberately does NOT fire on the initial open: the modal's own focus
   * effect runs after its children's, so focusing here would silently overwrite `initialFocusRef`
   * and land the collector on "Asignar" instead of the amount field they came to fill.
   */
  useEffect(() => {
    if (!isOpen) {
      focusedPanelRef.current = null;
      return;
    }
    const previousPanel = focusedPanelRef.current;
    focusedPanelRef.current = activePanel;
    if (previousPanel === null || previousPanel === activePanel) return;

    if (activePanel === "allocation") {
      const container = allocationContainerRef.current;
      // The filter when it exists, else the first line's amount field — never the recap's "Editar
      // monto o fecha", which is first in document order and would send the collector straight back.
      const target =
        container?.querySelector<HTMLElement>('input[type="search"]') ??
        container?.querySelector<HTMLElement>("li[data-line-key] input:not([disabled])") ??
        container?.querySelector<HTMLElement>("button:not([disabled])");
      target?.focus();
      return;
    }
    document.getElementById(ALLOCATIONS_OPEN_BUTTON_ID)?.focus();
  }, [activePanel, isOpen]);

  const handleConfirm = useCallback(async () => {
    if (!paymentDate) {
      setDateError(t("dateRequired"));
      return;
    }
    if (!validation.canSubmit || isSubmitting) return;
    // The CTA is already disabled on this, but the check is repeated here on purpose: this is the
    // branch that spends money, and the cost of the two states disagreeing for one render is a
    // payment registered "on account" with the collector's declarations dropped in silence.
    if (hasDroppedDraftLines) return;

    const input: StorePaymentSheetSubmitInput = {
      amount: draft.paymentAmountMinor,
      paymentDate: toDomainDate(paymentDate),
      currencyCode,
      note: note.trim() || null,
      allocations,
      declarePaidItemIds,
      parkedAmountMinor: draft.parkedAmountMinor ?? 0,
    };

    // Optimistic Confirmation, but only where a failure costs nothing to rebuild: a payment with no
    // declarations is amount + date + note, which the coordinator's error toast fully describes.
    //
    // "No declarations" has to mean the collector declared nothing, never that what they declared
    // failed to survive. Typed money with an empty payload is the signature of rows that went away
    // under the draft, and closing on it would record the payment on the store's account with every
    // hand-typed line gone and no way back into them.
    // Marks alone are still a payment on account, and one that costs nothing to rebuild if the
    // toast says it failed: the close-immediately path covers them too.
    if (allocations.length === 0) {
      if (droppedDraftLines.typedMinor > 0) return;
      void onSubmit(input);
      handleClose();
      return;
    }

    setIsSubmitting(true);
    setServerRejectedLineKey(null);
    setSubmitError(null);

    let outcome: StorePaymentSubmitOutcome | void;
    try {
      outcome = await onSubmit(input);
    } catch {
      // A rejected promise must never leave the sheet locked: without this the modal keeps
      // `dismissible={false}` and a spinning CTA forever, and reloading loses the whole draft.
      //
      // It DOES block the resend, unlike `unanswered`, and the two are not the same event however
      // similar they look. Neither coordinator ever rejects (their `onRejected` returns a resolved
      // outcome on purpose), so the only live way in here is one of their SUCCESS handlers
      // throwing — which means the server already ANSWERED and we merely failed to process the
      // answer. Either the payment is committed, and `createStorePayment` has no idempotency to
      // absorb a second identical one, or it was refused and the resend earns the identical
      // refusal. Both make a live CTA the wrong invitation, so the message says the outcome could
      // not be confirmed and the button waits for the amount, date or currency to move.
      setSubmitError({ code: "unconfirmed", blocksResend: true });
      return;
    } finally {
      setIsSubmitting(false);
    }

    if (!outcome || outcome.ok) {
      handleClose();
      return;
    }

    const rejectedKey = outcome.orderItemId
      ? itemLineKey(outcome.orderId ?? "", outcome.orderItemId)
      : outcome.orderId
        ? (lines.find((line) => line.orderId === outcome.orderId && line.isRest)?.key ??
          lines.find((line) => line.orderId === outcome.orderId)?.key ??
          null)
        : null;
    if (!rejectedKey) {
      // Refusals that name no line (STORE_DEBT_EXCEEDED, ALLOCATION_SUM_EXCEEDS_PAYMENT,
      // unauthorized, …) get a sheet-level message instead. The coordinator's toast is behind the
      // modal, so without this the collector is left staring at a draft with nothing to read and a
      // CTA they can resend forever against the same refusal. An `unanswered` outcome is the
      // opposite case and lands here too (it names no line either): nothing was refused, so it
      // keeps the CTA live for an identical resend.
      setSubmitError({ code: outcome.error ?? "server_error", blocksResend: outcome.unanswered !== true });
      return;
    }

    setServerRejectedLineKey(rejectedKey);
    setActivePanel("allocation");
    revealTokenRef.current += 1;
    setRevealRequest({ lineKey: rejectedKey, token: revealTokenRef.current });
  }, [
    allocations,
    currencyCode,
    declarePaidItemIds,
    draft.paymentAmountMinor,
    draft.parkedAmountMinor,
    droppedDraftLines.typedMinor,
    handleClose,
    hasDroppedDraftLines,
    isSubmitting,
    lines,
    note,
    onSubmit,
    paymentDate,
    t,
    validation.canSubmit,
  ]);

  const ordersStatus = ordersLoading ? "loading" : ordersError ? "error" : "ready";
  const submitErrorKey = `error.${submitError?.code}` as const;
  const submitErrorMessage = submitError
    ? t.has(submitErrorKey as never)
      ? t(submitErrorKey as never)
      : t("error.server_error")
    : null;
  /**
   * A guard on this component's own PROPS, not a state the app can reach today. Said plainly so
   * nobody reads protection into it: with the two coordinators in this repo,
   * `useStorePaymentSheetOrders` never reports anything but `ready` while a draft exists (a refetch
   * keeps the previous payload and falls back to it if it never lands; `loading` needs a cold cache
   * and `error` needs a first load with nothing kept, and neither can coexist with typed lines), so
   * this notice and its `draftWaitingOnOrders` copy are unreachable from the product. It stays for
   * any other caller that does empty the list, because the failure it prevents is a payment sent
   * with none of the declarations the collector typed.
   *
   * The shape that IS reachable is a `ready` list that came back SHORTER, which this cannot see.
   * That one is {@link droppedDraftLines}.
   */
  const isDraftWaitingOnOrders = ordersStatus !== "ready" && Object.keys(lineAmounts).length > 0;
  const droppedDraftLinesMessage = hasDroppedDraftLines
    ? t("droppedDraftLines", {
        amount: formatAmountWithSymbol(droppedDraftLines.droppedMinor, currencyCode || "USD", locale),
      })
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("title", { store: storeName })}
      subtitle={t("subtitle")}
      icon={<Wallet />}
      tone="default"
      size="lg"
      dismissible={!isSubmitting}
      initialFocusRef={amountRef}
      bodyClassName={activePanel === "allocation" ? "flex min-h-0 flex-col overflow-y-hidden" : undefined}
      primaryAction={{
        label: isSubmitting ? t("allocations.submitPending") : t("submit"),
        onClick: () => void handleConfirm(),
        loading: isSubmitting,
        // A sheet-level refusal also disables it until the draft changes: resending an unchanged
        // draft can only earn the same refusal, and the CTA must not invite that loop.
        disabled:
          !amountTouched ||
          !validation.canSubmit ||
          isSubmitting ||
          (submitError?.blocksResend ?? false) ||
          isDraftWaitingOnOrders ||
          hasDroppedDraftLines,
      }}
      secondaryAction={{ label: t("cancel"), onClick: handleClose, disabled: isSubmitting }}
      tertiaryAction={
        activePanel === "allocation"
          ? { label: t("allocations.back"), onClick: handleBackToPayment, disabled: isSubmitting }
          : undefined
      }
    >
      {submitErrorMessage && (
        <p
          role="alert"
          className="mb-3 rounded-[var(--radius-md)] px-3 py-2 [font-size:12.5px] [color:var(--destructive-chip-text)] [background:color-mix(in_oklch,var(--destructive)_8%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--destructive)_28%,transparent)]"
        >
          {submitErrorMessage}
        </p>
      )}
      {droppedDraftLinesMessage && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] px-3 py-2 [font-size:12.5px] [color:var(--destructive-chip-text)] [background:color-mix(in_oklch,var(--destructive)_8%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--destructive)_28%,transparent)]"
        >
          <span>{droppedDraftLinesMessage}</span>
          <Button variant="ghost" size="sm" onClick={handleDismissDroppedLines}>
            {t("droppedDraftLinesDismiss")}
          </Button>
        </div>
      )}
      {ordersStale && (
        <div
          role="status"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] px-3 py-2 [font-size:12.5px] [color:var(--text-secondary)] [background:var(--surface)] [border:1px_solid_var(--border)]"
        >
          <span>{t("staleOrders")}</span>
          <Button variant="ghost" size="sm" onClick={onRetryOrders} disabled={ordersRefreshing}>
            {t("allocations.retry")}
          </Button>
        </div>
      )}
      {isDraftWaitingOnOrders && (
        <p
          role="status"
          className="mb-3 rounded-[var(--radius-md)] px-3 py-2 [font-size:12.5px] [color:var(--text-secondary)] [background:var(--surface)] [border:1px_solid_var(--border)]"
        >
          {t("draftWaitingOnOrders")}
        </p>
      )}
      {activePanel === "payment" ? (
        <StorePaymentPanel
          debts={debts}
          currencyCode={currencyCode}
          onCurrencyChange={handleCurrencyChange}
          locale={locale}
          amount={amount}
          amountRef={amountRef}
          onAmountChange={handleAmountChange}
          amountTouched={amountTouched}
          exceedsDebt={validation.exceedsDebt}
          debtMinor={debtForCurrency}
          paymentDate={paymentDate}
          onDateChange={(date) => {
            setPaymentDate(date);
            setDateError(null);
            setSubmitError(null);
          }}
          dateError={dateError}
          hasDateBeforeOrderError={validation.dateErrors.size > 0}
          note={note}
          onNoteChange={setNote}
          allocationCount={allocations.length}
          declaredCount={declarePaidItemIds.length}
          allocatedMinor={validation.sumAllocatedMinor}
          hasAllocationError={hasAllocationError}
          openButtonId={ALLOCATIONS_OPEN_BUTTON_ID}
          onOpenAllocations={hasAllocationError ? handleReview : handleOpenAllocations}
          onClearAllocations={resetDraftState}
        />
      ) : (
        <div ref={allocationContainerRef} className="flex min-h-0 flex-1 flex-col">
          <StorePaymentAllocationPanel
            lines={lines}
            orders={ordersForCurrency}
            draft={draft}
            validation={validation}
            values={lineAmounts}
            declaredLineKeys={declaredLineKeys}
            currencyCode={currencyCode}
            locale={locale}
            paymentAmountMinor={draft.paymentAmountMinor}
            paymentDate={paymentDate}
            status={ordersStatus}
            onRetry={onRetryOrders}
            serverRejectedLineKey={serverRejectedLineKey}
            lastEditedLineKey={lastEditedLineKey}
            onChange={handleLineChange}
            onFill={handleLineFill}
            onToggleDeclared={handleToggleDeclared}
            onClear={resetDraftState}
            onParkRemainder={handleParkRemainder}
            onUnpark={handleUnpark}
            onEditPayment={handleBackToPayment}
            onEditDate={handleEditDate}
            revealRequest={revealRequest}
            onRevealHandled={handleRevealHandled}
          />
        </div>
      )}
    </Modal>
  );
}

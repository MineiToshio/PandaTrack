"use client";

import { ImagePlus, Info, Plus, Scale, ShoppingCart, Wallet, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import posthog from "posthog-js";
import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
import ProvenanceValue, { resolveProvenanceState, type ProvenanceState } from "@/components/core/ProvenanceValue";
import Select from "@/components/core/Select";
import AlertBanner from "@/components/modules/AlertBanner";
import type { StoreComboboxOption } from "@/components/modules/StoreCombobox";
import { ALLOWED_COLLECTOR_BASE_CURRENCY_CODES } from "@/lib/catalog/collectorCountries";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { formatAmount, formatCentsForInput } from "@/lib/currency";
import { formatDomainDate } from "@/lib/domainDate";
import { fetchTodayRate } from "@/lib/fx/exchangeRates";
import { MAX_PAYMENTS_PER_ORDER } from "@/lib/imageIntake/constants";
import type { ImageIntakeDraft } from "@/lib/imageIntake/draftSchema";
import {
  buildIntakeBreakdownPayload,
  flattenDraftToBreakdownItems,
  resolveIntakeBreakdownContext,
  resolveIntakeBreakdownSaveBlock,
  resolveTodayUtcIso,
  type IntakePaymentRow,
  type IntakeSaveBlockReason,
} from "@/lib/imageIntake/intakeBreakdown";
import type { IntakeBreakdownPayload } from "@/lib/imageIntake/intakeBreakdownContract";
import { findProductsNeedingReferenceSheet, formatReferenceHost } from "@/lib/imageIntake/referenceProductNaming";
import { parseDecimalToMinorUnits } from "@/lib/money/parseDecimalToMinorUnits";
import {
  createBreakdownState,
  deriveBreakdown,
  hasBreakdownDraft,
  offersBreakdown,
  recomputeBreakdown,
  type BreakdownContext,
  type BreakdownDerived,
  type BreakdownItem,
  type BreakdownPanelState,
} from "@/lib/orders/orderPaymentBreakdown";
import { exchangeRateSchema } from "@/lib/orders/orderValidation";
import { cn } from "@/lib/styles";
import DiscrepancyModal from "../../../_components/share/DiscrepancyModal";
import FxRateAttribution from "../../../_components/share/FxRateAttribution";
import OrderPaymentBreakdownPanel from "../../../_components/share/OrderPaymentBreakdownPanel";
import {
  ORDER_SECTION_CARD_CLASS,
  ORDER_SECTION_COMPACT_BODY_CLASS,
  ORDER_SECTION_COMPACT_HEADER_CLASS,
  ORDER_SECTION_COMPACT_ICON_CLASS,
  ORDER_SECTION_HEADING_CLASS,
} from "../../../_components/share/orderSectionChrome";
import IntakeGroupCard from "./IntakeGroupCard";
import StoreResolutionSection from "./StoreResolutionSection";
import OrderDeliveryRangeField from "@/app/[locale]/(app)/orders/_components/share/OrderDeliveryRangeField";

export type IntakeReviewScreenProps = {
  initialDraft: ImageIntakeDraft;
  /** The collector's own currency, the one every dashboard total is expressed in. */
  baseCurrencyCode: string;
  storeOptions: StoreComboboxOption[];
  /** Active catalog category keys, read live by the page: the collector may correct any suggestion. */
  productTypeKeys: string[];
  isSaving: boolean;
  /**
   * Receives the reviewed draft plus the rate that converts its currency into the base currency,
   * or `null` when the order is already in the base currency or the collector left the field empty.
   */
  onSave: (draft: ImageIntakeDraft, exchangeRate: number | null, breakdown: IntakeBreakdownPayload | undefined) => void;
  /**
   * Called with the draft as currently shown on screen, edits included: whatever the collector
   * confirmed or corrected here (store match, dates, amounts, group splits) is what the manual
   * form should open with, not the raw extraction it started from.
   */
  onManualClick: (draft: ImageIntakeDraft) => void;
  /**
   * How many photos the read that produced this draft actually cost. Counted in uploaded photos,
   * not in attached files, because one tall screenshot can be segmented into several uploads and it
   * is the uploads that spend the bag. It is the number this screen states back before offering to
   * read again.
   */
  spentPhotoCount: number;
  /**
   * The collector's balance as the page read it, before the read above spent from it. `null` for an
   * uncapped collector, which removes every photo figure from the re-read offer.
   */
  remainingPhotos: number | null;
  /**
   * Returns to the attach surface with the photos of this submission still attached, so the
   * collector adds the missing product-page screenshot instead of rebuilding the batch. The draft is
   * discarded: the next read replaces it.
   */
  onAddProductSheet: () => void;
};

type AttributeProvenance = {
  orderDate: ProvenanceState;
  currency: ProvenanceState;
  totalCost: ProvenanceState;
  deliveryFrom: ProvenanceState;
};

/**
 * Last-resort code for a draft that carries no currency at all. The extraction step fills in the
 * collector's base currency and marks it assumed whenever the source stated none, so this is
 * unreachable in practice; if it were ever reached, amounts render as bare numbers. A figure shown
 * under a currency the collector never chose reads as a fact and is wrong; a figure with no code is
 * merely incomplete, and the currency control is on screen right next to it.
 */
const NO_CURRENCY_CODE = "";

/** A calendar-day ISO string renders through the UTC-forcing formatter, never through local getters. */
/** `YYYY-MM-DD` to a local-midnight Date, the shape every date picker in the app works with. */
function isoToLocalDate(isoDate: string | null): Date | null {
  if (!isoDate) return null;
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

/** Back to the `YYYY-MM-DD` calendar day the draft contract stores, read with local getters. */
function localDateToIso(date: Date | null): string | null {
  if (!date) return null;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatIsoCalendarDay(isoDate: string, locale: string): string {
  return formatDomainDate(new Date(`${isoDate}T00:00:00.000Z`), locale);
}

function countProducts(draft: ImageIntakeDraft): number {
  return draft.groups.reduce((sum, group) => sum + group.products.length, 0);
}

/**
 * What the rows actually add up to, or `null` when at least one product carries no price.
 *
 * A partially priced draft has no sum worth stating: the gap between it and the total is exactly
 * the products with no figure, which the rows already show.
 */
function sumProductPrices(draft: ImageIntakeDraft): number | null {
  // No rows is not a sum of zero: a draft can legitimately arrive with a total and no products,
  // and telling that collector their products add up to 0.00 is a statement about rows that do
  // not exist.
  if (countProducts(draft) === 0) return null;
  let sum = 0;
  for (const group of draft.groups) {
    for (const product of group.products) {
      if (product.unitPrice === null) return null;
      sum += product.unitPrice;
    }
  }
  return sum;
}

/**
 * Fills the chat's silence about a total with the one number this screen can state as a fact: what
 * the priced rows already add up to (`BR-11-23`: the model reads, the server computes, and this
 * screen is the same authority). Only when the chat gave no total at all AND every product already
 * carries a price, matching `sumProductPrices`'s own refusal to guess at a partial sum. The result
 * carries `source: "assumed"` on the wire, the same convention-filled bucket the base-currency
 * fallback already uses, so the save path and the doubt count treat it exactly like any other value
 * the collector should double-check before it accepts it; which sentence the collector actually
 * reads is decided separately, by `resolveTotalCostProvenance`.
 */
function withDerivedTotal(draft: ImageIntakeDraft): ImageIntakeDraft {
  if (draft.totalCost.value !== null) return draft;
  const derivedSum = sumProductPrices(draft);
  if (derivedSum === null) return draft;
  return { ...draft, totalCost: { value: derivedSum, source: "assumed" } };
}

/**
 * The provenance the total's own row renders, computed from the draft as it arrived rather than
 * from `resolveProvenanceState` directly: a derived total is neither read from the chat nor a
 * server guess filled in by convention, it is a fact this screen computed from rows the collector
 * can already see, and it must say so instead of reusing the generic "asumido" copy.
 */
function resolveTotalCostProvenance(rawDraft: ImageIntakeDraft): ProvenanceState {
  if (rawDraft.totalCost.value !== null) {
    return resolveProvenanceState(rawDraft.totalCost);
  }
  return sumProductPrices(rawDraft) !== null ? "derived" : "missing";
}

/** One payment row of the screen, with everything the split panel needs to render and to be read. */
type IntakeBreakdownRow = {
  row: IntakePaymentRow;
  ctx: BreakdownContext;
  state: BreakdownPanelState;
  derived: BreakdownDerived;
};

/** Stable empty result, so a draft that offers no breakdown does not remount every panel-less row. */
const EMPTY_BREAKDOWN_ROWS: IntakeBreakdownRow[] = [];

/**
 * Resolves every payment row IN ORDER, because row k splits against what the rows above it left
 * behind: their ceilings for the products they named, and the order's balance minus their FULL
 * amounts, declared or not (`BR-11-24`).
 *
 * Each row's stored draft is re-run through `recomputeBreakdown` before it is handed on, so the
 * rows below it see what the collector's declaration actually amounts to under the CURRENT prices
 * rather than under the ones it was written against.
 */
function resolveIntakeBreakdownRows(input: {
  items: BreakdownItem[];
  payments: ImageIntakeDraft["payments"];
  states: Record<number, BreakdownPanelState>;
  totalCostMinor: number;
  currencyCode: string;
}): IntakeBreakdownRow[] {
  const { items, payments, states, totalCostMinor, currencyCode } = input;
  const resolved: IntakeBreakdownRow[] = [];

  for (const [paymentIndex, payment] of payments.entries()) {
    const amountMinor = payment.amount.value ?? 0;
    const stored = states[paymentIndex] ?? createBreakdownState(items);
    const ctx = resolveIntakeBreakdownContext({
      items,
      rows: [...resolved.map((entry) => entry.row), { amountMinor, breakdown: stored }],
      paymentIndex,
      totalCostMinor,
      currencyCode,
    });
    const state = recomputeBreakdown(stored, ctx);
    resolved.push({
      row: { amountMinor, breakdown: state },
      ctx,
      state,
      derived: deriveBreakdown(state, ctx, currencyCode),
    });
  }

  return resolved;
}

/**
 * Shifts an index-keyed map the same way the payment array just shifted when row `index` was
 * removed. Shared by the raw amount text and the breakdown drafts, which are keyed the same way and
 * would otherwise drift apart.
 */
function reindexAfterRemoval<T>(current: Record<number, T>, index: number): Record<number, T> {
  const next: Record<number, T> = {};
  for (const [key, value] of Object.entries(current)) {
    const keyIndex = Number(key);
    if (keyIndex < index) next[keyIndex] = value;
    else if (keyIndex > index) next[keyIndex - 1] = value;
  }
  return next;
}

/**
 * Every field this screen can refuse to save on, before ever calling the action.
 *
 * The three draft-level ones are what `saveOrderFromDraftAction` itself requires. The two payment
 * families are the narrow gate a breakdown buys (§`FR-11-104`): they are TEMPLATE keys, one per
 * payment row, which is why the container lookup below is a function and `fieldErrors` a `Map`
 * rather than the exhaustive `Record` this used to be.
 */
type RequiredIntakeFieldKey = "store" | "orderDate" | "total" | `payment-amount-${number}` | `payment-date-${number}`;

/**
 * The draft's own required fields still missing, in the screen's visual order (store, then order
 * date, then total), which is also the order the caller scrolls through on save: the first key
 * returned is the first field the collector sees.
 *
 * Deliberately excludes the delivery window: `orderCreateSchema` declares
 * `expectedDeliveryFrom`/`expectedDeliveryTo` nullable and optional, so an empty window is a legal
 * order, not something the save step refuses. Currency is excluded too, its `<Select>` control has
 * no empty option, so a collector cannot leave it blank through the screen itself.
 */
function findMissingRequiredIntakeFields(draft: ImageIntakeDraft): RequiredIntakeFieldKey[] {
  const missing: RequiredIntakeFieldKey[] = [];
  if (draft.store.matchedStoreId === null) missing.push("store");
  if (draft.orderDate.value === null) missing.push("orderDate");
  if (draft.totalCost.value === null) missing.push("total");
  return missing;
}

/**
 * Where the first nameless product is, or `null`.
 *
 * The position is the point: the order write refuses a blank name for the whole draft, and telling
 * the collector that without saying which row, or while that row sits inside a collapsed group they
 * cannot see, reproduces exactly the failure this check exists to remove.
 */
function findBlankProductName(draft: ImageIntakeDraft): { groupIndex: number; position: number } | null {
  for (const [groupIndex, group] of draft.groups.entries()) {
    for (const [productIndex, product] of group.products.entries()) {
      if (product.name.trim() === "") return { groupIndex, position: productIndex + 1 };
    }
  }
  return null;
}

/**
 * Cards that animate in on arrival. Past this many the delay is dropped rather than extended: a
 * fifty-group stagger would make the last card arrive four seconds after the first, which is not
 * emphasis, it is a wait.
 */
const STAGGERED_GROUP_CARDS = 6;
const GROUP_CARD_STAGGER_MS = 50;

/** Matches the six-decimal precision `exchangeRateSchema` accepts. */
const EXCHANGE_RATE_INPUT_DECIMALS = 6;

/**
 * Renders a fetched rate for the input without the padding `toFixed` leaves behind: the stored
 * precision is six decimals, but "3.5" is what belongs in a field a person is meant to read.
 */
function formatRateForInput(rate: number): string {
  return String(Number(rate.toFixed(EXCHANGE_RATE_INPUT_DECIMALS)));
}

/**
 * Reads the exchange-rate field against the same schema the order write validates with, so a value
 * the server would refuse is caught while the collector is still looking at it. An empty field is a
 * legitimate answer (`null`): the order is then saved without a rate and waits for reconciliation.
 */
function parseExchangeRateInput(raw: string): { ok: true; value: number | null } | { ok: false } {
  const normalized = raw.trim().replace(",", ".");
  if (normalized === "") return { ok: true, value: null };
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return { ok: false };
  const parsed = exchangeRateSchema.safeParse(numeric);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
}

/**
 * The element each required-field error scrolls and focuses. Store has no single control across
 * its three shapes (a combobox, a candidate list, an inline creation form), so its section carries
 * this id on its own root instead; order date and total already have it on their `Input` itself.
 */
function requiredFieldContainerId(fieldKey: RequiredIntakeFieldKey): string {
  if (fieldKey === "store") return "intake-store-field";
  if (fieldKey === "orderDate") return "intake-order-date";
  if (fieldKey === "total") return "intake-total";
  // The payment keys are already the id minus the screen prefix, one per row.
  return `intake-${fieldKey}`;
}

/** The row a payment-level field key belongs to, and which of its two controls it names. */
function paymentFieldKey(control: "amount" | "date", index: number): RequiredIntakeFieldKey {
  return control === "amount" ? `payment-amount-${index}` : `payment-date-${index}`;
}

/**
 * Brings the first invalid field into view and focuses it, on the same treatment `StoreForm`'s own
 * first-error scroll already uses for this app's sticky header: `block: "center"` rather than a
 * fixed scroll-margin offset, so the field lands clear of the header without this screen needing to
 * know its height.
 *
 * `scrollIntoView` does not exist in the jsdom environment the unit tests run under, so it is
 * called defensively; the tests assert the focus half of this behaviour instead, which jsdom can
 * observe.
 */
function scrollToFirstIntakeError(fieldKey: RequiredIntakeFieldKey) {
  const container = document.getElementById(requiredFieldContainerId(fieldKey));
  if (!container) return;
  if (typeof container.scrollIntoView === "function") {
    container.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  const focusable =
    container instanceof HTMLInputElement || container instanceof HTMLSelectElement
      ? container
      : container.querySelector<HTMLElement>("input, select, button, [tabindex]");
  focusable?.focus({ preventScroll: true });
}

/**
 * The single unskippable screen between an extraction and a saved order.
 *
 * It is built as a document rather than a form on purpose: values that were genuinely read render
 * as plain text through `ProvenanceValue`, and only guesses and gaps become controls. A screen full
 * of inputs invites scrolling and accepting, which would defeat the only safeguard this feature
 * has. Anything else the user wants to change is reachable through "Completar a mano".
 */
export default function IntakeReviewScreen({
  initialDraft,
  baseCurrencyCode,
  storeOptions,
  productTypeKeys,
  isSaving,
  onSave,
  onManualClick,
  spentPhotoCount,
  remainingPhotos,
  onAddProductSheet,
}: IntakeReviewScreenProps) {
  const t = useTranslations("imageIntake.review");
  const tOrders = useTranslations("orders");
  const tErrors = useTranslations("imageIntake.errors");
  const locale = useLocale();

  // Not memoized: cheap to recompute (one pass over the products), and only ever consulted by the
  // two lazy state initializers below, which React only calls once, on mount. `initialDraft` itself
  // is left untouched, so `provenance` below can still tell a genuinely derived total apart from one
  // the chat actually stated.
  const seededInitialDraft = withDerivedTotal(initialDraft);

  const [draft, setDraft] = useState<ImageIntakeDraft>(seededInitialDraft);
  /** The row a blocked save is about, so the screen can open its group and name it. */
  const [blankNameAt, setBlankNameAt] = useState<{ groupIndex: number; position: number } | null>(null);
  /** Groups reporting a price field whose text the money parser cannot read. */
  const [groupsWithInvalidPrice, setGroupsWithInvalidPrice] = useState<ReadonlySet<number>>(() => new Set());
  /**
   * Field-level save-blocking errors, keyed by `RequiredIntakeFieldKey`. Follows the repository's
   * three-part error pattern (destructive label, `error` on the control, message with `role="alert"`)
   * and clears per-field the moment the collector edits that field, never on a keystroke elsewhere.
   */
  const [fieldErrors, setFieldErrors] = useState<ReadonlyMap<RequiredIntakeFieldKey, string>>(() => new Map());
  /**
   * A save that passed every other gate and is waiting on the totals confirmation. It holds the two
   * arguments already resolved for the write (the exchange rate and the payment breakdown) so
   * confirming does not have to re-run the rate parsing, which could fail a second time on a screen
   * the collector can no longer reach.
   */
  const [pendingMismatchSave, setPendingMismatchSave] = useState<{
    exchangeRate: number | null;
    breakdown: IntakeBreakdownPayload | undefined;
  } | null>(null);
  const [totalInput, setTotalInput] = useState(() =>
    seededInitialDraft.totalCost.value !== null
      ? formatCentsForInput(seededInitialDraft.totalCost.value, seededInitialDraft.currency.value ?? NO_CURRENCY_CODE)
      : "",
  );

  const clearFieldError = (key: RequiredIntakeFieldKey) => {
    setFieldErrors((current) => {
      if (!current.has(key)) return current;
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  };

  // Computed once from the draft as it arrived. Editing an assumed value must not turn its control
  // into plain text mid-keystroke, so provenance is a property of what the extraction produced, not
  // of the current state.
  const provenance = useMemo<AttributeProvenance>(
    () => ({
      orderDate: resolveProvenanceState(initialDraft.orderDate),
      currency: resolveProvenanceState(initialDraft.currency),
      totalCost: resolveTotalCostProvenance(initialDraft),
      // A draft with no `delivery` block at all is the same situation as one whose window came back
      // empty: nothing was found, so the window is `missing` and therefore a control (FR-11-51).
      deliveryFrom: initialDraft.delivery
        ? resolveProvenanceState(initialDraft.delivery.expectedFrom)
        : ("missing" as const),
    }),
    [initialDraft],
  );

  /**
   * The same freeze, for the payments.
   *
   * Without it a payment amount could take exactly one keystroke: correcting an assumed amount
   * records it as read, `resolveProvenanceState` then answers `read`, and `ProvenanceValue` swaps
   * the input for plain text mid-entry, leaving the collector with `1.00` where they meant `150.00`
   * and focus on the document body. Provenance describes what the extraction produced, so it is
   * read once from the draft that arrived and never from the one being edited.
   */
  const paymentProvenance = useMemo(
    () =>
      initialDraft.payments.map((payment) => ({
        amount: resolveProvenanceState(payment.amount),
        paidAt: resolveProvenanceState(payment.paidAt),
      })),
    [initialDraft],
  );

  // Every amount on this screen is priced in the draft's own currency. The extraction step
  // guarantees one is always there, read from the source or assumed from the collector's base
  // currency, so the screen has nothing left to guess.
  const currencyCode = draft.currency.value ?? NO_CURRENCY_CODE;
  const productCount = countProducts(draft);
  // Read from the chat but not storable on an order: an order has no shipping-cost field, and a
  // shipping cost only becomes a real record once a delivery is registered. It is shown with that
  // said out loud rather than dropped between the review screen and the write.
  const shippingCost = draft.delivery?.cost.value ?? null;
  const doubtfulGroupCount = draft.groups.filter((group) => group.doubtful).length;
  // Deliberately not `Object.values(provenance)`: the delivery window is optional information a
  // chat rarely carries, so counting its absence would inflate "Revisa N datos" on nearly every
  // draft and break the promise that the number matches what actually needs a decision. It is an
  // input the collector may fill, not a doubt to resolve.
  const attributeDoubtCount = [provenance.orderDate, provenance.currency, provenance.totalCost].filter(
    (state) => state !== "read",
  ).length;
  const storeDoubtCount = draft.store.matchedStoreId === null ? 1 : 0;
  const doubtCount = attributeDoubtCount + doubtfulGroupCount + storeDoubtCount;

  const paidTotal = draft.payments.reduce((sum, payment) => sum + (payment.amount.value ?? 0), 0);
  const formattedTotal = draft.totalCost.value !== null ? formatAmount(draft.totalCost.value, currencyCode) : "";

  /**
   * Says out loud when the rows and the stated total disagree.
   *
   * Nothing reconciled the two before prices could be corrected, and nothing has to for the save to
   * go through: the total is what the chat said and it is what gets stored, so a draft whose rows
   * sum to something else is legal and is occasionally right (a discount nobody itemised). What is
   * not acceptable is saving it without having been told. A stated shipping cost counts toward the
   * total, because a chat that quotes one usually quotes a total with it in.
   */
  const productsTotal = sumProductPrices(draft);
  const statedTotal = draft.totalCost.value;
  const totalMismatch =
    productsTotal !== null &&
    statedTotal !== null &&
    productsTotal !== statedTotal &&
    productsTotal + (shippingCost ?? 0) !== statedTotal
      ? { productsTotal, statedTotal }
      : null;

  // An order priced in another currency needs a rate, or it lands saved but invisible: it is left
  // out of every base-currency dashboard total with nothing on screen that ever said so.
  const needsExchangeRate = currencyCode !== "" && currencyCode !== baseCurrencyCode;
  const fxPairKey = needsExchangeRate ? `${currencyCode}->${baseCurrencyCode}` : "";

  const [exchangeRateInput, setExchangeRateInput] = useState("");
  const [exchangeRateDate, setExchangeRateDate] = useState<string | null>(null);
  const [isRateLoading, setIsRateLoading] = useState(fxPairKey !== "");
  const [isRateUnavailable, setIsRateUnavailable] = useState(false);
  const [exchangeRateError, setExchangeRateError] = useState<string | null>(null);

  // Render-time state sync on the currency pair (the canonical React 18+ pattern, same as
  // FxReconciliationModal). Keyed on the pair alone, so a rate the collector typed survives every
  // other edit on this screen and is discarded exactly when the currency it belonged to changes.
  const [syncedFxPairKey, setSyncedFxPairKey] = useState(fxPairKey);
  if (fxPairKey !== syncedFxPairKey) {
    setSyncedFxPairKey(fxPairKey);
    setExchangeRateInput("");
    setExchangeRateDate(null);
    setIsRateUnavailable(false);
    setExchangeRateError(null);
    setIsRateLoading(fxPairKey !== "");
  }

  useEffect(() => {
    if (!needsExchangeRate) return;

    let isCurrent = true;
    void fetchTodayRate(currencyCode, baseCurrencyCode).then((result) => {
      if (!isCurrent) return;
      setIsRateLoading(false);
      if (result.ok) {
        setExchangeRateInput(formatRateForInput(result.rate));
        setExchangeRateDate(result.date);
        return;
      }
      // Nothing is filled in on a failed lookup. A rate the collector cannot verify would be a
      // number this screen invented, and inventing figures is the one thing it exists to prevent.
      setExchangeRateInput("");
      setExchangeRateDate(null);
      setIsRateUnavailable(true);
    });

    return () => {
      isCurrent = false;
    };
  }, [needsExchangeRate, currencyCode, baseCurrencyCode]);

  const currencyOptions = useMemo(
    () => ALLOWED_COLLECTOR_BASE_CURRENCY_CODES.map((code) => ({ value: code, label: code })),
    [],
  );

  const handleStoreChange = (storeId: string | null) => {
    setDraft((current) => ({ ...current, store: { ...current.store, matchedStoreId: storeId } }));
    clearFieldError("store");
  };

  const handleGroupApply = (groupIndex: number, updatedGroup: ImageIntakeDraft["groups"][number]) => {
    // The alert must not outlive the problem: it goes as soon as every row has a name again.
    setBlankNameAt((current) => (current === null ? null : null));
    const nextDraft = {
      ...draft,
      groups: draft.groups.map((group, index) => (index === groupIndex ? updatedGroup : group)),
    };
    setDraft(nextDraft);

    /*
      The ONE predicate that invalidates every breakdown draft on the screen: the COUNT of flattened
      products changed.

      Splitting, merging, adding and removing all move it (+N-1, -N+1, ±1); correcting a name or a
      price does not (0). And the count is the only thing this screen can actually see, because all
      five gestures arrive here as one replaced group, so "what changed" is not answerable from
      outside. Keying on the sequence of NAMES instead would delete the collector's typed lines for
      fixing a typo, which is exactly the distinction `FR-11-51a` already draws between an inline
      correction and a split/merge.
    */
    if (flattenDraftToBreakdownItems(nextDraft).length === flattenDraftToBreakdownItems(draft).length) return;
    // Only say so when there was something to lose: a panel nobody typed into needs no apology.
    setWasBreakdownCleared(Object.values(breakdownStates).some(hasBreakdownDraft));
    setBreakdownStates({});
  };

  const handleOrderDateChange = (value: string) => {
    // A value the user typed is no longer the system's assumption, so it is recorded as read. The
    // control itself stays a control, because `provenance` above is frozen at arrival.
    setDraft((current) => ({
      ...current,
      orderDate: value ? { value, source: "read" } : { value: null, source: null },
    }));
    clearFieldError("orderDate");
  };

  const handleCurrencyChange = (value: string) => {
    setDraft((current) => ({ ...current, currency: { value, source: "read" } }));
  };

  const handleTotalChange = (value: string) => {
    setTotalInput(value);
    const minorUnits = parseDecimalToMinorUnits(value, currencyCode);
    setDraft((current) => ({
      ...current,
      totalCost: minorUnits === null ? { value: null, source: null } : { value: minorUnits, source: "read" },
    }));
    clearFieldError("total");
  };

  const handleDeliveryRangeChange = (from: Date | null, to: Date | null) => {
    const fromIso = localDateToIso(from);
    const toIso = localDateToIso(to);
    setDraft((current) => ({
      ...current,
      // The draft's `delivery` block is nullable, so a window the collector supplies has to
      // materialise it. `cost` stays empty: it is read-only on this screen and is not saved anyway.
      delivery: {
        cost: current.delivery?.cost ?? { value: null, source: null },
        expectedFrom: fromIso === null ? { value: null, source: null } : { value: fromIso, source: "read" },
        expectedTo: toIso === null ? { value: null, source: null } : { value: toIso, source: "read" },
      },
    }));
  };

  /** Raw text typed into a payment amount, by row index. Same reason as the order total's own input. */
  const [paymentAmountInputs, setPaymentAmountInputs] = useState<Record<number, string>>({});

  /**
   * One breakdown draft per payment row, by row index. Absent means the collector has not touched
   * that row's panel, which is the same thing as an empty draft and is treated as one below.
   */
  const [breakdownStates, setBreakdownStates] = useState<Record<number, BreakdownPanelState>>({});
  /** Whether a structural product change just wiped the drafts, so the screen can say so. */
  const [wasBreakdownCleared, setWasBreakdownCleared] = useState(false);

  /**
   * The draft's products as the split panel sees them, rebuilt from the draft on every edit.
   *
   * That rebuild IS the recalculation rule of `FR-11-103`: correcting a price upstairs changes the
   * weights, so every unpinned line is split again through the same door a tick goes through. Lines
   * the collector typed into are pinned and no recalculation reaches them (I-2).
   */
  const breakdownItems = useMemo(() => flattenDraftToBreakdownItems(draft), [draft]);
  const offersAnyBreakdown = offersBreakdown(breakdownItems);

  /**
   * Every payment row's context, state and derived view, resolved IN ORDER because row k splits
   * against what rows 0..k-1 left behind: their ceilings for the products they named, and the
   * order's balance minus their FULL amounts, declared or not (`BR-11-24`).
   */
  // Not memoized, unlike `breakdownItems` above: no compiler in this build would absorb the cost
  // instead (`next.config.ts` carries no `experimental.reactCompiler`, and the lint plugin that
  // ships with `eslint-config-next` bails on a manual `useMemo` here with "Existing memoization
  // could not be preserved", so hand-memoizing would trade a real lint error for a re-render this
  // screen can afford). `MAX_PAYMENTS_PER_ORDER` bounds the loop at 60 rows, each a handful of
  // arithmetic passes over the draft's own products, so recomputing it on every unrelated keystroke
  // is cheap relative to the render it happens inside of.
  const breakdownRows = offersAnyBreakdown
    ? resolveIntakeBreakdownRows({
        items: breakdownItems,
        payments: draft.payments,
        states: breakdownStates,
        totalCostMinor: draft.totalCost.value ?? 0,
        currencyCode,
      })
    : EMPTY_BREAKDOWN_ROWS;

  const handleBreakdownChange = (index: number, next: BreakdownPanelState) => {
    setWasBreakdownCleared(false);
    setBreakdownStates((current) => ({ ...current, [index]: next }));
    clearFieldError(paymentFieldKey("amount", index));
    clearFieldError(paymentFieldKey("date", index));
  };

  /** The sentence a blocked payment row carries, one literal key per reason so the guard sees them. */
  function breakdownBlockMessage(reason: IntakeSaveBlockReason): string {
    switch (reason) {
      case "needsAmount":
        return t("payments.breakdownNeedsAmount");
      case "needsDate":
        return t("payments.breakdownNeedsDate");
      case "dateInFuture":
        return t("payments.breakdownDateInFuture");
      case "dateTooEarly":
        return t("payments.breakdownDateTooEarly");
      case "exceedsBalance":
        return t("payments.breakdownExceedsBalance");
    }
  }

  function paymentAmountInput(index: number, amount: number | null): string {
    const typed = paymentAmountInputs[index];
    if (typed !== undefined) return typed;
    return amount !== null ? formatCentsForInput(amount, currencyCode) : "";
  }

  function patchPayment(index: number, patch: Partial<ImageIntakeDraft["payments"][number]>) {
    setDraft((current) => ({
      ...current,
      payments: current.payments.map((payment, paymentIndex) =>
        paymentIndex === index ? { ...payment, ...patch } : payment,
      ),
    }));
  }

  const handlePaymentAmountChange = (index: number, value: string) => {
    setPaymentAmountInputs((current) => ({ ...current, [index]: value }));
    const minorUnits = parseDecimalToMinorUnits(value, currencyCode);
    patchPayment(index, {
      amount: minorUnits === null ? { value: null, source: null } : { value: minorUnits, source: "read" },
    });
    clearFieldError(paymentFieldKey("amount", index));
  };

  const handlePaymentDateChange = (index: number, value: string) => {
    patchPayment(index, { paidAt: value ? { value, source: "read" } : { value: null, source: null } });
    clearFieldError(paymentFieldKey("date", index));
  };

  /**
   * Appends a blank payment row for the collector to fill in, for the case the extraction misses a
   * payment entirely (a transfer confirmation on a separate screenshot, cash handed over in person).
   * Left null/null so it renders as "missing" like any other unread field, never as a fabricated
   * "read" value: `paymentProvenance` is frozen from `initialDraft`, so an index past its length
   * already falls back to "missing" with no extra bookkeeping needed here.
   */
  const handleAddPayment = () => {
    setDraft((current) => ({
      ...current,
      payments: [...current.payments, { amount: { value: null, source: null }, paidAt: { value: null, source: null } }],
    }));
  };

  /** Undoes an accidental "add", or drops a row the collector decided not to record after all. */
  const handleRemovePayment = (index: number) => {
    setDraft((current) => ({
      ...current,
      payments: current.payments.filter((_, paymentIndex) => paymentIndex !== index),
    }));
    // Reindex the raw-text overrides the same way the array itself just shifted, so a later row's
    // in-progress typed text (not yet a valid amount) stays attached to the row it belongs to.
    setPaymentAmountInputs((current) => reindexAfterRemoval(current, index));
    // The breakdown drafts are keyed by row index too, so they shift with the array exactly the
    // same way. Leaving them unshifted would hand row k+1's typed lines to row k.
    setBreakdownStates((current) => reindexAfterRemoval(current, index));
  };

  const handleExchangeRateChange = (value: string) => {
    setExchangeRateInput(value);
    setExchangeRateError(null);
  };

  const handleGroupPriceValidity = (groupIndex: number, hasInvalidPrice: boolean) => {
    setGroupsWithInvalidPrice((current) => {
      if (current.has(groupIndex) === hasInvalidPrice) return current;
      const next = new Set(current);
      if (hasInvalidPrice) next.add(groupIndex);
      else next.delete(groupIndex);
      return next;
    });
  };

  const handleSave = () => {
    // Store, order date, and total are the fields `saveOrderFromDraftAction` refuses to save
    // without; catching them here, before the round trip, is what turns a server error the
    // collector only ever saw as a top-level banner into a marked field they can fix in place. All
    // three are computed together and marked together, then the collector is taken to the first one
    // in the screen's own visual order (store, then order date, then total).
    const missingRequired = findMissingRequiredIntakeFields(draft);
    if (missingRequired.length > 0) {
      const nextFieldErrors = new Map<RequiredIntakeFieldKey, string>();
      for (const key of missingRequired) {
        nextFieldErrors.set(
          key,
          key === "store"
            ? tErrors("saveStoreRequired")
            : key === "orderDate"
              ? tErrors("saveOrderDateRequired")
              : tErrors("saveTotalRequired"),
        );
      }
      setFieldErrors(nextFieldErrors);
      scrollToFirstIntakeError(missingRequired[0]);
      return;
    }
    setFieldErrors(new Map());

    // The order write refuses a product with no name, and it refuses the whole draft over it. That
    // is a correct rule enforced in the wrong place for a person to act on, so it is caught here,
    // beside the field, rather than coming back as "we could not save this".
    const blankName = findBlankProductName(draft);
    if (blankName !== null) {
      setBlankNameAt(blankName);
      return;
    }
    setBlankNameAt(null);
    // A price the parser cannot read is held rather than written as "no price", so the save waits
    // for it. The field carries its own error; this only keeps the draft from leaving without it.
    if (groupsWithInvalidPrice.size > 0) {
      return;
    }

    /*
      The one gate a breakdown buys, and it is deliberately narrow (`FR-11-104`).

      A payment row the server refuses is normally dropped in silence and mentioned in a toast after
      the navigation, which is the right trade for two fields the collector can retype. It stops
      being the right trade once the row carries up to N hand-typed lines, so a row WITH a breakdown
      has to be complete and legal before anything is written; a row without one keeps `FR-11-52b`
      untouched and is still dropped server-side.
    */
    const saveBlock = resolveIntakeBreakdownSaveBlock({
      rows: draft.payments.map((payment, index) => ({
        amountMinor: payment.amount.value ?? 0,
        paidAtIso: payment.paidAt.value,
        hasBreakdown: breakdownRows[index] !== undefined && hasBreakdownDraft(breakdownRows[index].state),
      })),
      totalCostMinor: draft.totalCost.value,
      orderDateIso: draft.orderDate.value,
      todayIso: resolveTodayUtcIso(),
    });
    if (saveBlock !== null) {
      const control = saveBlock.reason === "needsAmount" || saveBlock.reason === "exceedsBalance" ? "amount" : "date";
      const key = paymentFieldKey(control, saveBlock.paymentIndex);
      setFieldErrors(new Map([[key, breakdownBlockMessage(saveBlock.reason)]]));
      scrollToFirstIntakeError(key);
      return;
    }

    const breakdown = buildIntakeBreakdownPayload(breakdownRows.map((entry) => entry.row));
    if (!needsExchangeRate) {
      commitSave(null, breakdown);
      return;
    }
    const parsed = parseExchangeRateInput(exchangeRateInput);
    if (!parsed.ok) {
      setExchangeRateError(t("fx.invalid"));
      return;
    }
    commitSave(parsed.value, breakdown);
  };

  /**
   * Last gate before the write: rows that are all priced and do not add up to the stated total stop
   * here for a confirmation, exactly as they do in the manual create and edit forms.
   *
   * It is the same component and the same copy on purpose. The inline banner above already says the
   * two figures disagree, but a banner is passive and a total is money: the collector who reaches
   * the button having scrolled past it would otherwise save a figure nobody confirmed. The manual
   * form settled that trade long ago (warn, then let them save anyway), and a draft read from a
   * photo is the path where the numbers are LEAST likely to be right, so it cannot be the laxer of
   * the two. `totalMismatch` is reused rather than re-derived so the banner and this gate can never
   * disagree about what "does not add up" means, shipping allowance included.
   */
  const commitSave = (exchangeRate: number | null, breakdown: IntakeBreakdownPayload | undefined) => {
    if (totalMismatch !== null) {
      posthog.capture(POSTHOG_EVENTS.ORDER.DISCREPANCY_MODAL_OPENED);
      setPendingMismatchSave({ exchangeRate, breakdown });
      return;
    }
    onSave(draft, exchangeRate, breakdown);
  };

  const handleMismatchSaveAnyway = () => {
    const pending = pendingMismatchSave;
    setPendingMismatchSave(null);
    if (pending === null) return;
    posthog.capture(POSTHOG_EVENTS.ORDER.DISCREPANCY_RESOLVED, { resolution: "kept_entered" });
    onSave(draft, pending.exchangeRate, pending.breakdown);
  };

  const handleMismatchGoBack = () => {
    posthog.capture(POSTHOG_EVENTS.ORDER.DISCREPANCY_RESOLVED, { resolution: "cancelled" });
    setPendingMismatchSave(null);
  };

  // Both action bars below call these, never their own copy of the logic: the two are one control
  // rendered at two widths, so a divergence between them would be a bug nobody sees on their own
  // screen size.
  const handleManualClick = () => onManualClick(draft);

  /**
   * The re-read offer, derived from the draft as it stands rather than from the one that arrived: a
   * collector who renames the row through split or merge has answered the question, and the offer
   * must disappear on its own instead of asking for a photo that is no longer needed.
   */
  const productsNeedingSheet = useMemo(() => findProductsNeedingReferenceSheet(draft.groups), [draft.groups]);

  /**
   * What reading again would really cost, stated instead of implied.
   *
   * The extraction is a single pass over every attached photo, so a second read spends the whole
   * batch once more plus the new screenshot. The balance is derived here rather than re-fetched: the
   * page's snapshot predates the read that produced this draft, and the flow never returns to the
   * server between the two.
   */
  const remainingAfterRead = remainingPhotos === null ? null : Math.max(0, remainingPhotos - spentPhotoCount);
  const rereadPhotoCost = spentPhotoCount + 1;
  const canAffordReread = remainingAfterRead === null || remainingAfterRead >= rereadPhotoCost;

  const productSheetHintReportedRef = useRef(false);
  useEffect(() => {
    if (productsNeedingSheet.length === 0 || productSheetHintReportedRef.current) return;
    productSheetHintReportedRef.current = true;
    posthog.capture(POSTHOG_EVENTS.IMAGE_INTAKE.PRODUCT_SHEET_HINT_SHOWN, {
      product_count: productsNeedingSheet.length,
      reasons: productsNeedingSheet.map((entry) => entry.reason),
      spent_photo_count: spentPhotoCount,
      can_afford_reread: canAffordReread,
    });
  }, [canAffordReread, productsNeedingSheet, spentPhotoCount]);

  const warningPhrases = useMemo(
    () =>
      new Set(
        draft.warnings.filter((warning) => warning.code === "price-split-uneven").map((warning) => warning.detail),
      ),
    [draft.warnings],
  );
  return (
    // The bottom padding only exists to clear the fixed mobile bar, so it stops where that bar
    // does: on `md` and up the actions are inline and the reserved strip would be dead space.
    <div className="intake-review-scroll-safe flex flex-col gap-[var(--space-4)] pb-[calc(148px+env(safe-area-inset-bottom))] md:pb-0">
      <header className="flex flex-col gap-[var(--space-2)]">
        <h2 className="[font-size:var(--text-subtitle)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
          {t("title")}
        </h2>
        <p className="[font-size:var(--text-body)] [color:var(--text-secondary)]">
          {doubtCount === 0
            ? t("headerClean")
            : t("headerWithDoubts", {
                productCount,
                doubtCount,
                total: formattedTotal,
              })}
        </p>
      </header>

      {/*
        SECTION 1 — Datos del pedido. Same chrome as the manual order form, because this is the
        same job: the fields of one order, all open, nothing behind a step.
      */}
      <section className={ORDER_SECTION_CARD_CLASS} aria-labelledby="intake-section-order">
        <header className={ORDER_SECTION_COMPACT_HEADER_CLASS}>
          <Info size={16} aria-hidden="true" className={ORDER_SECTION_COMPACT_ICON_CLASS} />
          <h3 id="intake-section-order" className={ORDER_SECTION_HEADING_CLASS}>
            {t("fieldsTitle")}
          </h3>
        </header>
        <div className={ORDER_SECTION_COMPACT_BODY_CLASS}>
          {/*
            The same two rows the manual order form uses, in the same order: store beside currency,
            then order date beside the expected window. Whatever the collector already knows from
            creating an order by hand should be where they last saw it.
          */}
          <div className="grid items-start gap-4 md:grid-cols-2">
            <StoreResolutionSection
              store={draft.store}
              options={storeOptions}
              onChange={handleStoreChange}
              error={Boolean(fieldErrors.get("store"))}
            />

            <ProvenanceValue
              id="intake-currency"
              label={t("fields.currency")}
              state={provenance.currency}
              markerLabel={t(provenance.currency === "assumed" ? "provenance.assumed" : "provenance.missing")}
              hint={
                provenance.currency === "read"
                  ? undefined
                  : t(provenance.currency === "assumed" ? "provenance.assumedHint" : "provenance.missingHint")
              }
              control={({ id }) => (
                <Select
                  id={id}
                  value={draft.currency.value}
                  onChange={handleCurrencyChange}
                  options={currencyOptions}
                />
              )}
            />
          </div>

          <div className="grid items-start gap-4 md:grid-cols-2">
            <ProvenanceValue
              id="intake-order-date"
              label={t("fields.orderDate")}
              state={provenance.orderDate}
              markerLabel={t(provenance.orderDate === "assumed" ? "provenance.assumed" : "provenance.missing")}
              error={Boolean(fieldErrors.get("orderDate"))}
              // The error message replaces the hint in the same slot: `Input` already renders it
              // (with `role="alert"` and `aria-invalid`) when `error` is a string, so this component
              // is not asked to render it a second time.
              hint={
                fieldErrors.get("orderDate")
                  ? undefined
                  : provenance.orderDate === "read"
                    ? undefined
                    : t(provenance.orderDate === "assumed" ? "provenance.assumedHint" : "provenance.missingHint")
              }
              control={({ id }) => (
                <Input
                  id={id}
                  type="date"
                  value={draft.orderDate.value ?? ""}
                  error={fieldErrors.get("orderDate")}
                  onChange={(event) => handleOrderDateChange(event.target.value)}
                />
              )}
            />

            <ProvenanceValue
              id="intake-delivery-range"
              label={t("fields.deliveryRange")}
              state={provenance.deliveryFrom}
              markerLabel={t(provenance.deliveryFrom === "assumed" ? "provenance.assumed" : "provenance.missing")}
              hint={
                provenance.deliveryFrom === "read"
                  ? undefined
                  : t(provenance.deliveryFrom === "assumed" ? "provenance.assumedHint" : "provenance.missingHint")
              }
              control={({ id }) => (
                <OrderDeliveryRangeField
                  id={id}
                  from={isoToLocalDate(draft.delivery?.expectedFrom.value ?? null)}
                  to={isoToLocalDate(draft.delivery?.expectedTo.value ?? null)}
                  onChange={handleDeliveryRangeChange}
                />
              )}
            />

            {needsExchangeRate && (
              <div className="space-y-1.5 md:col-span-2">
                {/* Same minimum height as a `ProvenanceValue` label, so this field's input lines
                    up with the one beside it whether or not that one carries a chip. */}
                <label
                  htmlFor="intake-exchange-rate"
                  className={cn(
                    "flex min-h-[1.625rem] items-center text-[13px] font-medium",
                    exchangeRateError ? "[color:var(--destructive)]" : "[color:var(--text-secondary)]",
                  )}
                >
                  {t("fx.label", { from: currencyCode, to: baseCurrencyCode })}
                </label>
                <Input
                  id="intake-exchange-rate"
                  type="text"
                  inputMode="decimal"
                  value={exchangeRateInput}
                  placeholder={isRateLoading ? t("fx.loading") : t("fx.placeholder")}
                  error={Boolean(exchangeRateError)}
                  aria-describedby="intake-exchange-rate-hint"
                  onChange={(event) => handleExchangeRateChange(event.target.value)}
                />
                <div id="intake-exchange-rate-hint" className="flex flex-col gap-[var(--space-1)]">
                  {exchangeRateError ? (
                    <p className="text-[11.5px] [color:var(--destructive)]" role="alert">
                      {exchangeRateError}
                    </p>
                  ) : isRateUnavailable ? (
                    <p className="text-[11.5px] [color:var(--text-muted)]">{t("fx.unavailable")}</p>
                  ) : exchangeRateDate ? (
                    <p className="text-[11.5px] [color:var(--text-muted)]">
                      {t("fx.rateDate", { date: formatIsoCalendarDay(exchangeRateDate, locale) })}
                    </p>
                  ) : (
                    <p className="text-[11.5px] [color:var(--text-muted)]">
                      {t("fx.help", { from: currencyCode, to: baseCurrencyCode })}
                    </p>
                  )}
                  <FxRateAttribution />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 2 — Productos, in the same table the manual form uses. */}
      <section className={ORDER_SECTION_CARD_CLASS} aria-labelledby="intake-section-products">
        <header className={ORDER_SECTION_COMPACT_HEADER_CLASS}>
          <ShoppingCart size={16} aria-hidden="true" className={ORDER_SECTION_COMPACT_ICON_CLASS} />
          <h3 id="intake-section-products" className={ORDER_SECTION_HEADING_CLASS}>
            {t("groupsTitle")}
          </h3>
        </header>
        <div className={ORDER_SECTION_COMPACT_BODY_CLASS}>
          {/*
            A pointed offer, never a generic warning: it names the rows whose name is still only a
            link, and it says out loud what accepting it costs. It blocks nothing, because the
            collector can save as is and rename the product later.
          */}
          {productsNeedingSheet.length > 0 && (
            <AlertBanner
              tone="info"
              icon={<ImagePlus size={16} />}
              title={t("productSheet.title", { count: productsNeedingSheet.length })}
              action={
                canAffordReread ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={onAddProductSheet}
                    data-ph-event={POSTHOG_EVENTS.IMAGE_INTAKE.PRODUCT_SHEET_REQUESTED}
                    data-ph-props={JSON.stringify({
                      product_count: productsNeedingSheet.length,
                      spent_photo_count: spentPhotoCount,
                    })}
                  >
                    {t("productSheet.cta")}
                  </Button>
                ) : undefined
              }
            >
              <ul className="flex flex-col gap-[var(--space-1)]">
                {productsNeedingSheet.map((entry) => (
                  <li key={`${entry.groupIndex}-${entry.productIndex}`}>
                    {entry.reason === "host-only-name"
                      ? t("productSheet.reasonHostOnly", { name: entry.name })
                      : t("productSheet.reasonDoubtful", {
                          name: entry.name,
                          host: formatReferenceHost(entry.referenceUrl),
                        })}
                  </li>
                ))}
              </ul>
              <p className="mt-[var(--space-2)]">{t("productSheet.body")}</p>
              <p className="mt-[var(--space-2)] [font-size:var(--text-caption)]">
                {!canAffordReread && remainingAfterRead !== null
                  ? t("productSheet.costUnaffordable", { needed: rereadPhotoCost, remaining: remainingAfterRead })
                  : remainingAfterRead !== null
                    ? t("productSheet.costWithBalance", { count: spentPhotoCount, remaining: remainingAfterRead })
                    : t("productSheet.cost", { count: spentPhotoCount })}
              </p>
              <p className="[font-size:var(--text-caption)] [color:var(--text-muted)]">{t("productSheet.optional")}</p>
            </AlertBanner>
          )}

          {blankNameAt !== null && (
            <p className="text-[12px] [color:var(--destructive)]" role="alert">
              {t("edit.blankName", { position: blankNameAt.position })}
            </p>
          )}

          {draft.groups.map((group, index) => (
            /*
              One block per group, separated by a hairline rather than nested in its own card: the
              section card already draws the boundary, and a card inside a card is what made this
              screen read as cramped.
            */
            <div
              key={`${group.sourcePhrase}-${index}`}
              className={cn("intake-rise-in", index > 0 && "pt-[var(--space-4)] [border-top:1px_solid_var(--border)]")}
              style={
                index < STAGGERED_GROUP_CARDS ? { animationDelay: `${index * GROUP_CARD_STAGGER_MS}ms` } : undefined
              }
            >
              <IntakeGroupCard
                group={group}
                groupKey={`g${index}`}
                currencyCode={currencyCode}
                productTypeKeys={productTypeKeys}
                hasWarning={warningPhrases.has(group.sourcePhrase)}
                forceExpanded={blankNameAt?.groupIndex === index}
                onPriceValidityChange={(hasInvalidPrice) => handleGroupPriceValidity(index, hasInvalidPrice)}
                onApply={(updatedGroup) => handleGroupApply(index, updatedGroup)}
              />
            </div>
          ))}

          {/*
            The order's cost lives with the products, exactly as it does in the manual form: it is
            the figure the rows are supposed to add up to, and putting it two sections away from
            them meant nothing could be compared without scrolling.
          */}
          <div className="flex flex-col gap-[var(--space-3)] pt-3.5 [border-top:1px_solid_var(--border)]">
            <ProvenanceValue
              id="intake-total"
              label={t("fields.total")}
              state={provenance.totalCost}
              markerLabel={
                provenance.totalCost === "assumed"
                  ? t("provenance.assumed")
                  : provenance.totalCost === "derived"
                    ? t("provenance.derived")
                    : t("provenance.missing")
              }
              error={Boolean(fieldErrors.get("total"))}
              // The error message replaces the hint in the same slot, same reasoning as the order
              // date field above.
              hint={
                fieldErrors.get("total")
                  ? undefined
                  : provenance.totalCost === "read"
                    ? undefined
                    : provenance.totalCost === "derived"
                      ? t("provenance.totalDerivedHint", { count: countProducts(initialDraft) })
                      : t("provenance.totalHint")
              }
              control={({ id }) => (
                <Input
                  id={id}
                  type="text"
                  inputMode="decimal"
                  value={totalInput}
                  suffix={currencyCode}
                  error={fieldErrors.get("total")}
                  onChange={(event) => handleTotalChange(event.target.value)}
                />
              )}
            />

            {shippingCost !== null && (
              <div className="flex flex-col gap-[var(--space-1)]">
                <div className="flex items-baseline justify-between gap-[var(--space-3)] text-[13px]">
                  <span className="[color:var(--text-muted)]">{t("delivery.cost")}</span>
                  <span className="numeric [color:var(--text-primary)]">
                    {formatAmount(shippingCost, currencyCode)}
                  </span>
                </div>
                <p className="text-[11.5px] [color:var(--text-muted)]">{t("delivery.costNotSaved")}</p>
              </div>
            )}

            {totalMismatch !== null && (
              <AlertBanner tone="warning" icon={<Scale size={16} />} title={t("totals.mismatchTitle")}>
                {t("totals.mismatchBody", {
                  products: formatAmount(totalMismatch.productsTotal, currencyCode),
                  total: formatAmount(totalMismatch.statedTotal, currencyCode),
                })}
              </AlertBanner>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 3 — Pagos. */}
      <section className={ORDER_SECTION_CARD_CLASS} aria-labelledby="intake-section-payments">
        <header className={ORDER_SECTION_COMPACT_HEADER_CLASS}>
          <Wallet size={16} aria-hidden="true" className={ORDER_SECTION_COMPACT_ICON_CLASS} />
          <h3 id="intake-section-payments" className={ORDER_SECTION_HEADING_CLASS}>
            {t("payments.title")}
          </h3>
        </header>
        <div className={ORDER_SECTION_COMPACT_BODY_CLASS}>
          {/* Said once for the whole section, because the change wipes every row at once. It is not
              an error: nothing is blocked, and the products the collector just restructured are the
              reason the old lines no longer point anywhere. */}
          {wasBreakdownCleared && (
            <p className="text-[12px] [color:var(--text-muted)]" role="status">
              {t("payments.breakdownCleared")}
            </p>
          )}

          {draft.payments.length === 0 ? (
            <p className="text-[13px] [color:var(--text-muted)]">{t("payments.empty")}</p>
          ) : (
            /*
              A payment goes through the same provenance rule as every other attribute: an amount
              the model filled in by convention carries its marker, so it can never look like one
              it read off the screenshot.
            */
            <ul className="flex flex-col gap-[var(--space-4)]">
              {draft.payments.map((payment, index) => {
                // Frozen at arrival, like every other attribute. See `paymentProvenance`.
                const amountState = paymentProvenance[index]?.amount ?? "missing";
                const dateState = paymentProvenance[index]?.paidAt ?? "missing";
                const amountError = fieldErrors.get(paymentFieldKey("amount", index));
                const dateError = fieldErrors.get(paymentFieldKey("date", index));
                const breakdownRow = breakdownRows[index];
                return (
                  // Keyed by position: the date is editable, so keying on it would remount the field.
                  <li key={index} className="relative grid gap-4 pr-8 md:grid-cols-2 md:pr-9">
                    <ProvenanceValue
                      id={`intake-payment-amount-${index}`}
                      label={t("payments.amountLabel", { position: index + 1 })}
                      state={amountState}
                      markerLabel={t(amountState === "assumed" ? "provenance.assumed" : "provenance.missing")}
                      error={Boolean(amountError)}
                      hint={
                        amountError || amountState === "read"
                          ? undefined
                          : t(amountState === "assumed" ? "provenance.assumedHint" : "provenance.missingHint")
                      }
                      control={({ id }) => (
                        <Input
                          id={id}
                          type="text"
                          inputMode="decimal"
                          suffix={currencyCode}
                          value={paymentAmountInput(index, payment.amount.value)}
                          error={amountError}
                          onChange={(event) => handlePaymentAmountChange(index, event.target.value)}
                        />
                      )}
                    />
                    <ProvenanceValue
                      id={`intake-payment-date-${index}`}
                      label={t("payments.dateLabel")}
                      state={dateState}
                      markerLabel={t(dateState === "assumed" ? "provenance.assumed" : "provenance.missing")}
                      error={Boolean(dateError)}
                      hint={
                        dateError || dateState === "read"
                          ? undefined
                          : t(dateState === "assumed" ? "provenance.assumedHint" : "provenance.missingHint")
                      }
                      control={({ id }) => (
                        <Input
                          id={id}
                          type="date"
                          value={payment.paidAt.value ?? ""}
                          error={dateError}
                          onChange={(event) => handlePaymentDateChange(index, event.target.value)}
                        />
                      )}
                    />

                    {/* The split, under both fields and spanning the row on desktop: the amount has
                        to exist before splitting it means anything, and it is above. On mobile the
                        row is one column already, so this simply follows the date. */}
                    {breakdownRow !== undefined && (
                      <div className="md:col-span-2">
                        <OrderPaymentBreakdownPanel
                          // Unique per payment row: several panels are mounted at once here, and a
                          // shared id namespace would cross every `aria-controls` and
                          // `aria-describedby` on the section.
                          instanceId={`intake-payment-${index}`}
                          // Row 0 splits against the whole order (nothing has been declared yet);
                          // from row 1 on, the denominator is what the rows above left unpaid, so
                          // the printed percentage has to name that instead.
                          percentBasis={index === 0 ? "order" : "remaining"}
                          state={breakdownRow.state}
                          onStateChange={(next) => handleBreakdownChange(index, next)}
                          ctx={breakdownRow.ctx}
                          derived={breakdownRow.derived}
                          // No pool exists here: the order has not been written, so nothing has been
                          // paid against it. The row above that left money undeclared says so in its
                          // own foot, three centimetres up the same screen.
                          undetailedPaidMinor={0}
                          currencyCode={currencyCode}
                          locale={locale}
                          disabled={isSaving}
                          // The server answers after the order exists and the screen is gone, so
                          // there is no inline refusal to paint here. The save gate stands in.
                          refusedItemId={null}
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemovePayment(index)}
                      aria-label={t("payments.removeLabel", { position: index + 1 })}
                      // Tap target ≥44×44 on mobile via the `::before` pseudo (same mechanism as
                      // `IconButton`): padding inside a fixed `size-7` box never grows the box, so
                      // `inset:-8px` on 28px expands the hit area outward to 44 instead. No other
                      // control is within 8px: the row reserves `pr-8` for this button, and the
                      // payment rows are `gap-[var(--space-4)]` apart vertically.
                      // `md:before:inset-0` drops the extra area on desktop.
                      className="absolute top-0 right-0 grid size-7 shrink-0 cursor-pointer place-items-center rounded-md [color:var(--text-muted)] transition-colors before:absolute before:[inset:-8px] before:content-[''] hover:[color:var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--focus-ring)] md:before:inset-0"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={handleAddPayment}
            disabled={draft.payments.length >= MAX_PAYMENTS_PER_ORDER}
          >
            <Plus size={14} aria-hidden="true" />
            {t("payments.add")}
          </Button>

          <div className="flex items-baseline justify-between gap-[var(--space-3)] pt-3.5 text-[13px] [border-top:1px_solid_var(--border)]">
            <span className="[color:var(--text-muted)]">{t("totals.paid")}</span>
            <span className="numeric [color:var(--text-primary)]">{formatAmount(paidTotal, currencyCode)}</span>
          </div>
        </div>
      </section>

      {/*
        Desktop footer (inline). Mobile uses the fixed bar below. A bar pinned to the viewport
        bottom on a wide monitor spans the whole window and reads as detached from the column it
        belongs to, so on `md` and up the actions end the document instead.
      */}
      <div className="hidden pt-[var(--space-2)] md:flex md:flex-row md:items-center md:justify-end md:gap-[var(--space-3)]">
        <button
          type="button"
          onClick={handleManualClick}
          className="rounded-md px-[var(--space-2)] py-[var(--space-1)] [font-size:var(--text-caption)] [color:var(--text-secondary)] underline-offset-4 hover:underline focus-visible:[box-shadow:0_0_0_2px_var(--focus-ring)] focus-visible:outline-none"
        >
          {t("manual")}
        </button>
        <Button type="button" variant="primary" loading={isSaving} onClick={handleSave}>
          {isSaving ? t("saving") : tOrders("create.submit")}
        </Button>
      </div>

      {/*
        Mobile action bar. `hidden` on `md` and up is `display: none`, so the desktop footer above
        and this bar are never both in the accessibility tree: a screen reader hears one primary.
      */}
      <div
        role="group"
        aria-label={t("title")}
        className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-[var(--space-2)] px-[var(--space-4)] pt-[var(--space-3)] pb-[calc(var(--space-3)+env(safe-area-inset-bottom))] md:hidden"
        style={{ background: "var(--surface-elevated)", borderTop: "1px solid var(--border)" }}
      >
        <Button type="button" variant="primary" size="lg" fullWidth loading={isSaving} onClick={handleSave}>
          {isSaving ? t("saving") : tOrders("create.submit")}
        </Button>
        <button
          type="button"
          onClick={handleManualClick}
          className="mx-auto inline-flex min-h-[44px] items-center justify-center rounded-md px-[var(--space-3)] py-[var(--space-1)] [font-size:var(--text-caption)] [color:var(--text-secondary)] underline-offset-4 hover:underline focus-visible:[box-shadow:0_0_0_2px_var(--focus-ring)] focus-visible:outline-none"
        >
          {t("manual")}
        </button>
      </div>

      {/*
        The same confirmation the manual create and edit forms raise, on the same condition and with
        the same words, so "the products do not add up to the total" means one thing in this product
        no matter which way the order was entered.
      */}
      <DiscrepancyModal
        isOpen={pendingMismatchSave !== null && totalMismatch !== null}
        enteredTotal={totalMismatch?.statedTotal ?? 0}
        calculatedTotal={totalMismatch?.productsTotal ?? 0}
        formatAmount={(cents) => formatAmount(cents, currencyCode)}
        onGoBack={handleMismatchGoBack}
        onSaveAnyway={handleMismatchSaveAnyway}
      />
    </div>
  );
}

"use client";

import { ImagePlus, Info, Scale, ShoppingCart, Wallet } from "lucide-react";
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
import type { ImageIntakeDraft } from "@/lib/imageIntake/draftSchema";
import { findProductsNeedingReferenceSheet, formatReferenceHost } from "@/lib/imageIntake/referenceProductNaming";
import { parseDecimalToMinorUnits } from "@/lib/money/parseDecimalToMinorUnits";
import { exchangeRateSchema } from "@/lib/orders/orderValidation";
import { cn } from "@/lib/styles";
import FxRateAttribution from "../../../_components/share/FxRateAttribution";
import {
  ORDER_SECTION_BODY_CLASS,
  ORDER_SECTION_BULLET_CLASS,
  ORDER_SECTION_CARD_CLASS,
  ORDER_SECTION_EYEBROW_CLASS,
  ORDER_SECTION_HEADER_CLASS,
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
  onSave: (draft: ImageIntakeDraft, exchangeRate: number | null) => void;
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
  const locale = useLocale();

  const [draft, setDraft] = useState<ImageIntakeDraft>(initialDraft);
  /** The row a blocked save is about, so the screen can open its group and name it. */
  const [blankNameAt, setBlankNameAt] = useState<{ groupIndex: number; position: number } | null>(null);
  /** Groups reporting a price field whose text the money parser cannot read. */
  const [groupsWithInvalidPrice, setGroupsWithInvalidPrice] = useState<ReadonlySet<number>>(() => new Set());
  const [totalInput, setTotalInput] = useState(() =>
    initialDraft.totalCost.value !== null
      ? formatCentsForInput(initialDraft.totalCost.value, initialDraft.currency.value ?? NO_CURRENCY_CODE)
      : "",
  );

  // Computed once from the draft as it arrived. Editing an assumed value must not turn its control
  // into plain text mid-keystroke, so provenance is a property of what the extraction produced, not
  // of the current state.
  const provenance = useMemo<AttributeProvenance>(
    () => ({
      orderDate: resolveProvenanceState(initialDraft.orderDate),
      currency: resolveProvenanceState(initialDraft.currency),
      totalCost: resolveProvenanceState(initialDraft.totalCost),
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
  };

  const handleGroupApply = (groupIndex: number, updatedGroup: ImageIntakeDraft["groups"][number]) => {
    // The alert must not outlive the problem: it goes as soon as every row has a name again.
    setBlankNameAt((current) => (current === null ? null : null));
    setDraft((current) => ({
      ...current,
      groups: current.groups.map((group, index) => (index === groupIndex ? updatedGroup : group)),
    }));
  };

  const handleOrderDateChange = (value: string) => {
    // A value the user typed is no longer the system's assumption, so it is recorded as read. The
    // control itself stays a control, because `provenance` above is frozen at arrival.
    setDraft((current) => ({
      ...current,
      orderDate: value ? { value, source: "read" } : { value: null, source: null },
    }));
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
  };

  const handlePaymentDateChange = (index: number, value: string) => {
    patchPayment(index, { paidAt: value ? { value, source: "read" } : { value: null, source: null } });
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
    if (!needsExchangeRate) {
      onSave(draft, null);
      return;
    }
    const parsed = parseExchangeRateInput(exchangeRateInput);
    if (!parsed.ok) {
      setExchangeRateError(t("fx.invalid"));
      return;
    }
    onSave(draft, parsed.value);
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
    <div className="intake-review-scroll-safe flex flex-col gap-[var(--space-4)] pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-0">
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
        <header className={ORDER_SECTION_HEADER_CLASS}>
          <span className={ORDER_SECTION_BULLET_CLASS} aria-hidden="true">
            <Info size={13} />
          </span>
          <div className="min-w-0 flex-1">
            <span className={ORDER_SECTION_EYEBROW_CLASS}>{t("sections.orderEyebrow")}</span>
            <h3 id="intake-section-order" className={ORDER_SECTION_HEADING_CLASS}>
              {t("fieldsTitle")}
            </h3>
          </div>
        </header>
        <div className={ORDER_SECTION_BODY_CLASS}>
          <StoreResolutionSection store={draft.store} options={storeOptions} onChange={handleStoreChange} />

          <div className="grid gap-4 md:grid-cols-2">
            <ProvenanceValue
              id="intake-order-date"
              label={t("fields.orderDate")}
              state={provenance.orderDate}
              markerLabel={t(provenance.orderDate === "assumed" ? "provenance.assumed" : "provenance.missing")}
              control={({ id }) => (
                <Input
                  id={id}
                  type="date"
                  value={draft.orderDate.value ?? ""}
                  onChange={(event) => handleOrderDateChange(event.target.value)}
                />
              )}
            />

            <ProvenanceValue
              id="intake-currency"
              label={t("fields.currency")}
              state={provenance.currency}
              markerLabel={t(provenance.currency === "assumed" ? "provenance.assumed" : "provenance.missing")}
              control={({ id }) => (
                <Select id={id} value={draft.currency.value} onChange={handleCurrencyChange} options={currencyOptions} />
              )}
            />

            <ProvenanceValue
              id="intake-total"
              label={t("fields.total")}
              state={provenance.totalCost}
              markerLabel={t(provenance.totalCost === "assumed" ? "provenance.assumed" : "provenance.missing")}
              control={({ id }) => (
                <Input
                  id={id}
                  type="text"
                  inputMode="decimal"
                  value={totalInput}
                  suffix={currencyCode}
                  onChange={(event) => handleTotalChange(event.target.value)}
                />
              )}
            />

            <ProvenanceValue
              id="intake-delivery-range"
              label={t("fields.deliveryRange")}
              state={provenance.deliveryFrom}
              markerLabel={t(provenance.deliveryFrom === "assumed" ? "provenance.assumed" : "provenance.missing")}
              control={({ id }) => (
                <OrderDeliveryRangeField
                  id={id}
                  from={isoToLocalDate(draft.delivery?.expectedFrom.value ?? null)}
                  to={isoToLocalDate(draft.delivery?.expectedTo.value ?? null)}
                  onChange={handleDeliveryRangeChange}
                />
              )}
            />
          </div>

          {needsExchangeRate && (
            <div className="space-y-1.5">
              <label
                htmlFor="intake-exchange-rate"
                className="text-[13px] font-medium [color:var(--text-secondary)]"
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
      </section>

      {/* SECTION 2 — Productos, in the same table the manual form uses. */}
      <section className={ORDER_SECTION_CARD_CLASS} aria-labelledby="intake-section-products">
        <header className={ORDER_SECTION_HEADER_CLASS}>
          <span className={ORDER_SECTION_BULLET_CLASS} aria-hidden="true">
            <ShoppingCart size={13} />
          </span>
          <div className="min-w-0 flex-1">
            <span className={ORDER_SECTION_EYEBROW_CLASS}>{t("sections.productsEyebrow")}</span>
            <h3 id="intake-section-products" className={ORDER_SECTION_HEADING_CLASS}>
              {t("groupsTitle")}
            </h3>
          </div>
        </header>
        <div className={ORDER_SECTION_BODY_CLASS}>
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
              className={cn(
                "intake-rise-in",
                index > 0 && "pt-[var(--space-4)] [border-top:1px_solid_var(--border)]",
              )}
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
        </div>
      </section>

      {/* SECTION 3 — Pagos y totales. */}
      <section className={ORDER_SECTION_CARD_CLASS} aria-labelledby="intake-section-payments">
        <header className={ORDER_SECTION_HEADER_CLASS}>
          <span className={ORDER_SECTION_BULLET_CLASS} aria-hidden="true">
            <Wallet size={13} />
          </span>
          <div className="min-w-0 flex-1">
            <span className={ORDER_SECTION_EYEBROW_CLASS}>{t("sections.paymentsEyebrow")}</span>
            <h3 id="intake-section-payments" className={ORDER_SECTION_HEADING_CLASS}>
              {t("payments.title")}
            </h3>
          </div>
        </header>
        <div className={ORDER_SECTION_BODY_CLASS}>
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
                return (
                  // Keyed by position: the date is editable, so keying on it would remount the field.
                  <li key={index} className="grid gap-4 md:grid-cols-2">
                    <ProvenanceValue
                      id={`intake-payment-amount-${index}`}
                      label={t("payments.amountLabel", { position: index + 1 })}
                      state={amountState}
                      markerLabel={t(amountState === "assumed" ? "provenance.assumed" : "provenance.missing")}
                      control={({ id }) => (
                        <Input
                          id={id}
                          type="text"
                          inputMode="decimal"
                          suffix={currencyCode}
                          value={paymentAmountInput(index, payment.amount.value)}
                          onChange={(event) => handlePaymentAmountChange(index, event.target.value)}
                        />
                      )}
                    />
                    <ProvenanceValue
                      id={`intake-payment-date-${index}`}
                      label={t("payments.dateLabel")}
                      state={dateState}
                      markerLabel={t(dateState === "assumed" ? "provenance.assumed" : "provenance.missing")}
                      control={({ id }) => (
                        <Input
                          id={id}
                          type="date"
                          value={payment.paidAt.value ?? ""}
                          onChange={(event) => handlePaymentDateChange(index, event.target.value)}
                        />
                      )}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-col gap-[var(--space-2)] pt-3.5 [border-top:1px_solid_var(--border)]">
            <div className="flex items-baseline justify-between gap-[var(--space-3)] text-[13px]">
              <span className="[color:var(--text-muted)]">{t("totals.paid")}</span>
              <span className="numeric [color:var(--text-primary)]">{formatAmount(paidTotal, currencyCode)}</span>
            </div>
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
            <div className="flex items-baseline justify-between gap-[var(--space-3)]">
              <span className="text-[13px] font-medium [color:var(--text-secondary)]">{t("totals.total")}</span>
              {/*
                Keyed on the figure itself. The total only ever changes through the field above, so
                keying on the value plays the fade once, on the outcome, rather than on every
                keystroke: animating the most frequent action on a screen is the anti-pattern.
              */}
              <span
                key={formattedTotal}
                className="intake-value-in numeric [font-size:var(--text-subtitle)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]"
              >
                {formattedTotal}
              </span>
            </div>
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
    </div>
  );
}

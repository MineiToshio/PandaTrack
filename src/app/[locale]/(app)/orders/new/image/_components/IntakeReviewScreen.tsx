"use client";

import { ImagePlus } from "lucide-react";
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
import FxRateAttribution from "../../../_components/share/FxRateAttribution";
import IntakeGroupCard from "./IntakeGroupCard";
import StoreResolutionSection from "./StoreResolutionSection";

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
function formatIsoCalendarDay(isoDate: string, locale: string): string {
  return formatDomainDate(new Date(`${isoDate}T00:00:00.000Z`), locale);
}

function countProducts(draft: ImageIntakeDraft): number {
  return draft.groups.reduce((sum, group) => sum + group.products.length, 0);
}

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
    }),
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
  const attributeDoubtCount = Object.values(provenance).filter((state) => state !== "read").length;
  const storeDoubtCount = draft.store.matchedStoreId === null ? 1 : 0;
  const doubtCount = attributeDoubtCount + doubtfulGroupCount + storeDoubtCount;

  const paidTotal = draft.payments.reduce((sum, payment) => sum + (payment.amount.value ?? 0), 0);

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

  const handleExchangeRateChange = (value: string) => {
    setExchangeRateInput(value);
    setExchangeRateError(null);
  };

  const handleSave = () => {
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
    <div className="flex flex-col gap-[var(--space-6)] pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-0">
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
                total: draft.totalCost.value !== null ? formatAmount(draft.totalCost.value, currencyCode) : "",
              })}
        </p>
      </header>

      <StoreResolutionSection store={draft.store} options={storeOptions} onChange={handleStoreChange} />

      <section className="flex flex-col gap-[var(--space-4)]">
        <h3 className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">{t("fieldsTitle")}</h3>

        <ProvenanceValue
          id="intake-order-date"
          label={t("fields.orderDate")}
          state={provenance.orderDate}
          markerLabel={t(provenance.orderDate === "assumed" ? "provenance.assumed" : "provenance.missing")}
          readText={draft.orderDate.value ? formatIsoCalendarDay(draft.orderDate.value, locale) : null}
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
          readText={draft.currency.value}
          control={({ id }) => (
            <Select id={id} value={draft.currency.value} onChange={handleCurrencyChange} options={currencyOptions} />
          )}
        />

        <ProvenanceValue
          id="intake-total"
          label={t("fields.total")}
          state={provenance.totalCost}
          markerLabel={t(provenance.totalCost === "assumed" ? "provenance.assumed" : "provenance.missing")}
          readText={draft.totalCost.value !== null ? formatAmount(draft.totalCost.value, currencyCode) : null}
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

        {needsExchangeRate && (
          <div className="flex flex-col gap-[var(--space-2)]">
            <label
              htmlFor="intake-exchange-rate"
              className="[font-size:var(--text-caption)] [font-weight:var(--font-weight-medium)] [color:var(--text-primary)]"
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
                <p className="[font-size:var(--text-caption)] [color:var(--destructive)]" role="alert">
                  {exchangeRateError}
                </p>
              ) : isRateUnavailable ? (
                <p className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">{t("fx.unavailable")}</p>
              ) : exchangeRateDate ? (
                <p className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">
                  {t("fx.rateDate", { date: formatIsoCalendarDay(exchangeRateDate, locale) })}
                </p>
              ) : (
                <p className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">{t("fx.help")}</p>
              )}
              <FxRateAttribution />
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-[var(--space-3)]">
        <h3 className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">{t("groupsTitle")}</h3>
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
        {draft.groups.map((group, index) => (
          <IntakeGroupCard
            key={`${group.sourcePhrase}-${index}`}
            group={group}
            currencyCode={currencyCode}
            productTypeKeys={productTypeKeys}
            hasWarning={warningPhrases.has(group.sourcePhrase)}
            onApply={(updatedGroup) => handleGroupApply(index, updatedGroup)}
          />
        ))}
      </section>

      <section className="flex flex-col gap-[var(--space-2)]">
        <h3 className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">{t("payments.title")}</h3>
        {draft.payments.length === 0 ? (
          <p className="[font-size:var(--text-body)] [color:var(--text-secondary)]">{t("payments.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-[var(--space-2)]">
            {draft.payments.map((payment, index) => (
              <li
                key={`${payment.paidAt.value ?? "unknown"}-${index}`}
                className="flex items-baseline justify-between gap-[var(--space-3)] [font-size:var(--text-body)]"
              >
                <span className="[color:var(--text-secondary)]">
                  {payment.paidAt.value ? t("payments.row", { date: payment.paidAt.value }) : t("payments.title")}
                </span>
                <span className="[color:var(--text-primary)] tabular-nums">
                  {payment.amount.value !== null ? formatAmount(payment.amount.value, currencyCode) : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="flex flex-col gap-[var(--space-2)] rounded-[var(--radius-lg)] p-[var(--space-4)]"
        style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-baseline justify-between gap-[var(--space-3)] [font-size:var(--text-body)]">
          <span className="[color:var(--text-secondary)]">{t("totals.paid")}</span>
          <span className="[color:var(--text-primary)] tabular-nums">{formatAmount(paidTotal, currencyCode)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-[var(--space-3)] [font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)]">
          <span className="[color:var(--text-primary)]">{t("totals.total")}</span>
          <span className="[color:var(--text-primary)] tabular-nums">
            {draft.totalCost.value !== null ? formatAmount(draft.totalCost.value, currencyCode) : ""}
          </span>
        </div>
        {shippingCost !== null && (
          <div className="flex flex-col gap-[var(--space-1)]">
            <div className="flex items-baseline justify-between gap-[var(--space-3)] [font-size:var(--text-body)]">
              <span className="[color:var(--text-secondary)]">{t("delivery.cost")}</span>
              <span className="[color:var(--text-primary)] tabular-nums">
                {formatAmount(shippingCost, currencyCode)}
              </span>
            </div>
            <p className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">
              {t("delivery.costNotSaved")}
            </p>
          </div>
        )}
      </section>

      {/*
        Desktop footer (inline). Mobile uses the fixed bar below. A bar pinned to the viewport
        bottom on a wide monitor spans the whole window and reads as detached from the column it
        belongs to, so on `md` and up the actions end the document instead, right-aligned with the
        secondary before the primary.
      */}
      <div className="hidden pt-[var(--space-4)] [border-top:1px_solid_var(--border)] md:flex md:flex-row md:items-center md:justify-end md:gap-[var(--space-3)]">
        <button
          type="button"
          onClick={handleManualClick}
          className="rounded-md px-[var(--space-2)] py-[var(--space-1)] [font-size:var(--text-caption)] [color:var(--text-secondary)] underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
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
          className="mx-auto rounded-md px-[var(--space-2)] py-[var(--space-1)] [font-size:var(--text-caption)] [color:var(--text-secondary)] underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          {t("manual")}
        </button>
      </div>
    </div>
  );
}

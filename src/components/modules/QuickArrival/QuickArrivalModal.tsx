"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, PackageCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import Checkbox from "@/components/core/Checkbox";
import DatePickerInput from "@/components/core/DatePickerInput";
import FieldErrorMsg from "@/components/core/FieldErrorMsg";
import Input from "@/components/core/Input";
import Select from "@/components/core/Select";
import Modal from "@/components/modules/Modal/Modal";
import { ALLOWED_COLLECTOR_BASE_CURRENCY_CODES } from "@/lib/catalog/collectorCountries";
import { formatAmountWithSymbol } from "@/lib/currency";
import { isValidNonNegativeDecimal, isValidRate, sanitizeDecimalInput, sanitizeRateInput } from "@/lib/decimalInput";
import { toDomainDate } from "@/lib/domainDate";
import { cn } from "@/lib/styles";
import {
  getSettlementContextAction,
  type SettlementOrderContext,
} from "@/app/[locale]/(app)/_actions/settlementActions";
import type { QuickArrivalSubmitInput } from "./useQuickArrival";

export type QuickArrivalItem = {
  id: string;
  name: string;
  /**
   * Source order code (`PED-*`), set only when the selection can span more than one order (the
   * store-scoped arrival). Absent on the per-order launchers, where every product shares the order
   * already named in the subtitle and repeating it would be noise.
   */
  orderLabel?: string;
  /**
   * The item's own source order id (`WO-08`). Required for the settlement preview: every launcher
   * either scopes the whole modal to one order (see `orderId` below) or must supply it per item
   * (the store-scoped batch, whose selection spans several orders).
   */
  orderId?: string;
};

export type QuickArrivalModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Dialog subtitle, composed by the caller because the scope differs: the per-order launchers say
   * "PED-001 · AmiAmi", the store-scoped one says "AmiAmi · 3 productos de 2 pedidos".
   */
  subtitle: string;
  /** Products still eligible for a delivery (NONE or ARRIVED_AT_STORE). Never empty when open. */
  items: QuickArrivalItem[];
  /**
   * How many of the order's products are NOT in `items` because they already shipped or arrived.
   * Stated in the modal: otherwise an order reading "6 productos" opens a list of 5 with nothing
   * explaining the sixth, which reads as the modal having lost it.
   */
  settledItemCount?: number;
  /**
   * Keeps the count and the full list on screen even for a single product.
   *
   * The per-order launchers preselect every eligible product themselves, so with one product the
   * list is a checkbox the collector has no reason to touch and the sentence naming the product
   * says strictly more. A store-scoped selection is the opposite: the collector picked exactly
   * these rows by hand, and the confirmation's job is to echo that selection back, whatever its
   * size. Without this, a one-product selection silently drops to a different contract.
   */
  alwaysListItems?: boolean;
  baseCurrencyCode: string | null;
  locale: string;
  /**
   * The single order every item belongs to (`WO-08`). Set by the four per-order launchers; the
   * store-scoped batch launcher leaves it unset and relies on each item's own `orderId` instead,
   * since its selection can span several orders.
   */
  orderId?: string;
  /** Store name, for the settlement double-counting guard's "En {tienda} tienes..." copy. */
  storeName?: string;
  /** Optimistic Confirmation: fire-and-forget, the coordinator owns the toast and the refresh. */
  onSubmit: (input: QuickArrivalSubmitInput) => void;
};

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Debounce window for re-fetching the settlement preview after the selection changes (MAJOR F4). */
const SETTLEMENT_CONTEXT_DEBOUNCE_MS = 300;

type QuickArrivalItemGroup = { orderLabel: string | null; items: QuickArrivalItem[] };

/**
 * Buckets the products by source order, preserving the caller's order in both dimensions. Returns a
 * single unlabelled bucket whenever the selection does not actually span more than one order, so
 * the per-order launchers keep the flat list they have always rendered.
 */
function groupItemsByOrder(items: QuickArrivalItem[]): QuickArrivalItemGroup[] {
  const distinctLabels = new Set(
    items.map((item) => item.orderLabel).filter((label): label is string => Boolean(label)),
  );
  if (distinctLabels.size < 2) return [{ orderLabel: null, items }];

  const groups: QuickArrivalItemGroup[] = [];
  const byLabel = new Map<string, QuickArrivalItemGroup>();
  for (const item of items) {
    const label = item.orderLabel ?? "";
    let group = byLabel.get(label);
    if (!group) {
      group = { orderLabel: label, items: [] };
      byLabel.set(label, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/**
 * "Ya me llegó": logs an already-received delivery for one order in a single step, instead of
 * the 4-step create wizard followed by a separate mark-delivered action.
 *
 * Two deliberate defaults, both stated on screen rather than applied silently:
 * - every eligible product starts selected, because the common case is that the whole box
 *   arrived; the list is always visible when there is more than one product so nothing is
 *   confirmed blind;
 * - shipping cost and dispatch date stay collapsed and unrecorded, because neither is knowable
 *   once the box is already here. The collapsed summary says exactly what will be written, and
 *   the section expands for the cases where the collector does know.
 */
export default function QuickArrivalModal({
  isOpen,
  onClose,
  subtitle,
  items,
  settledItemCount = 0,
  alwaysListItems = false,
  baseCurrencyCode,
  locale,
  orderId,
  storeName,
  onSubmit,
}: QuickArrivalModalProps) {
  const t = useTranslations("orders");
  const tCurrencies = useTranslations("orders.currencies");

  const isSingleItem = items.length === 1 && !alwaysListItems;

  // The state tracks what the collector UNCHECKED, not what is checked: "everything arrived" is
  // then the natural empty state, and the live selection is always derived from the products that
  // are still eligible. A stale id left over from a previous open cannot leak into a submission.
  const [deselectedIds, setDeselectedIds] = useState<string[]>([]);
  const [receivedDate, setReceivedDate] = useState<Date | null>(startOfToday);
  const [showShippingDetails, setShowShippingDetails] = useState(false);
  const [shippedDate, setShippedDate] = useState<Date | null>(null);
  const [cost, setCost] = useState("");
  const [currencyCode, setCurrencyCode] = useState(baseCurrencyCode ?? "");
  const [exchangeRate, setExchangeRate] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // Settlement on arrival (`WO-08`, `ADR 0032`). `settlementContexts` is `null` while loading (or
  // before the first fetch); an empty-after-load array is what tells the render below there is
  // nothing to settle at all, rather than that the fetch simply has not resolved yet.
  const [settlementContexts, setSettlementContexts] = useState<SettlementOrderContext[] | null>(null);
  const [isLoadingSettlement, setIsLoadingSettlement] = useState(false);
  const [settleRemainder, setSettleRemainder] = useState(true);
  const [settlementDate, setSettlementDate] = useState<Date | null>(startOfToday);
  const [settlementDateTouched, setSettlementDateTouched] = useState(false);
  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>({});

  const selectedIds = useMemo(
    () => items.filter((item) => !deselectedIds.includes(item.id)).map((item) => item.id),
    [items, deselectedIds],
  );

  const showExchangeRate = Boolean(baseCurrencyCode && currencyCode && currencyCode !== baseCurrencyCode);
  const allSelected = selectedIds.length === items.length;

  // Which orders this arrival touches, and which of their items it delivers — the settlement
  // preview's own request shape. Scoped to `orderId` when the caller set it (every per-order
  // launcher); grouped by each item's own `orderId` otherwise (the store-scoped batch).
  //
  // Built off `selectedIds` (MAJOR F4, 2026-08-20 review), never the full `items` list: the
  // preview used to keep quoting a figure for every eligible product regardless of which ones the
  // collector actually left checked, so deselecting a row never moved the displayed amount/branch.
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const settlementOrderGroups = useMemo(() => {
    if (orderId) return [{ orderId, itemIds: selectedIds }];
    const byOrderId = new Map<string, string[]>();
    for (const item of items) {
      if (!item.orderId || !selectedIdSet.has(item.id)) continue;
      const bucket = byOrderId.get(item.orderId);
      if (bucket) bucket.push(item.id);
      else byOrderId.set(item.orderId, [item.id]);
    }
    return [...byOrderId.entries()].map(([id, itemIds]) => ({ orderId: id, itemIds }));
  }, [orderId, items, selectedIds, selectedIdSet]);

  // MAJOR F4, 2026-08-20 review: re-fetches whenever the SELECTION changes, not only when the
  // dialog opens (`settlementOrderGroups` is itself keyed on `selectedIds`, so its identity changes
  // on every toggle). Debounced so a rapid run of checkbox clicks fires one request, not one per
  // click; the loading flag flips synchronously so the block reads "Calculando…" immediately rather
  // than quoting the PREVIOUS selection's figures while the debounced request is still pending.
  useEffect(() => {
    if (!isOpen || settlementOrderGroups.length === 0) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-open/selection-change, not a render-driven sync
    setIsLoadingSettlement(true);
    const timer = setTimeout(() => {
      void getSettlementContextAction({
        orders: settlementOrderGroups.map((group) => ({ orderId: group.orderId, deliveredItemIds: group.itemIds })),
      }).then(
        (result) => {
          if (cancelled) return;
          setIsLoadingSettlement(false);
          if (!result.ok) {
            setSettlementContexts([]);
            return;
          }
          setSettlementContexts(result.contexts);
          const relevant = result.contexts.filter((context) => context.plan.kind !== "nothingToSettle");
          setSettleRemainder(relevant.length === 0 || relevant.every((context) => context.defaultChecked));
        },
        () => {
          // A REJECTED promise (a thrown module-evaluation error, a dropped connection) is not an
          // `ok: false` the server described, it is no answer at all — same fallback as that branch,
          // so "Calculando…" clears instead of hanging forever with no settlement block ever shown.
          // Deliberately the SECOND argument of `then`, never a chained `catch`, which would also
          // swallow whatever the success handler above throws.
          if (cancelled) return;
          setIsLoadingSettlement(false);
          setSettlementContexts([]);
        },
      );
    }, SETTLEMENT_CONTEXT_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, settlementOrderGroups]);

  const relevantSettlementContexts = useMemo(
    () => (settlementContexts ?? []).filter((context) => context.plan.kind !== "nothingToSettle"),
    [settlementContexts],
  );
  const showSettlementBlock = relevantSettlementContexts.length > 0;

  const handleToggleItem = useCallback((itemId: string) => {
    setDeselectedIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
    setErrors((prev) => (prev.items ? { ...prev, items: null } : prev));
  }, []);

  const handleToggleAll = useCallback(() => {
    setDeselectedIds((current) => (current.length === 0 ? items.map((item) => item.id) : []));
    setErrors((prev) => (prev.items ? { ...prev, items: null } : prev));
  }, [items]);

  /** Every dismissal path funnels here so the next open always starts clean. */
  const handleClose = useCallback(() => {
    setDeselectedIds([]);
    setReceivedDate(startOfToday());
    setShowShippingDetails(false);
    setShippedDate(null);
    setCost("");
    setCurrencyCode(baseCurrencyCode ?? "");
    setExchangeRate("");
    setErrors({});
    setSettlementContexts(null);
    setSettleRemainder(true);
    setSettlementDate(startOfToday());
    setSettlementDateTouched(false);
    setManualAmounts({});
    onClose();
  }, [baseCurrencyCode, onClose]);

  const manualSettlementContexts = useMemo(
    () => relevantSettlementContexts.filter((context) => context.plan.kind === "manual"),
    [relevantSettlementContexts],
  );

  const validate = useCallback((): boolean => {
    const next: Record<string, string | null> = {};
    if (selectedIds.length === 0) next.items = t("detail.quickArrival.validation.itemsRequired");
    if (!receivedDate) next.receivedDate = t("detail.quickArrival.validation.receivedRequired");
    if (receivedDate && shippedDate && shippedDate > receivedDate) {
      next.shippedDate = t("detail.quickArrival.validation.shippedAfterReceived");
    }
    if (showShippingDetails) {
      if (cost.trim() !== "" && !isValidNonNegativeDecimal(cost, currencyCode)) {
        next.cost = t("detail.quickArrival.validation.costInvalid");
      }
      if (cost.trim() !== "" && !currencyCode) {
        next.currencyCode = t("detail.quickArrival.validation.currencyRequired");
      }
      if (showExchangeRate && cost.trim() !== "" && !isValidRate(exchangeRate)) {
        next.exchangeRate = t("detail.quickArrival.validation.fxRequired");
      }
    }
    if (settleRemainder) {
      // MINOR fix J, 2026-08-20 review: its own key, not the arrival date's `receivedRequired` —
      // "¿Cuándo llegó?" is the wrong question under a field asking when the collector paid.
      if (!settlementDate) next.settlementDate = t("detail.quickArrival.validation.settlementDateRequired");
      for (const context of manualSettlementContexts) {
        const raw = manualAmounts[context.orderId] ?? "";
        if (raw.trim() === "" || !isValidNonNegativeDecimal(raw, context.currencyCode)) {
          next[`manualAmount-${context.orderId}`] = t("detail.quickArrival.settlement.validation.amountRequired");
        }
      }
    }
    setErrors(next);
    return Object.values(next).every((value) => !value);
  }, [
    cost,
    currencyCode,
    exchangeRate,
    manualAmounts,
    manualSettlementContexts,
    receivedDate,
    selectedIds.length,
    settleRemainder,
    settlementDate,
    shippedDate,
    showExchangeRate,
    showShippingDetails,
    t,
  ]);

  const handleConfirm = useCallback(() => {
    if (!validate() || !receivedDate) return;

    const hasCost = showShippingDetails && cost.trim() !== "" && isValidNonNegativeDecimal(cost, currencyCode);
    const effectiveSettlementDate = settlementDate ?? receivedDate;
    onSubmit({
      productIds: selectedIds,
      receivedDate: toDomainDate(receivedDate),
      shippedDate: showShippingDetails && shippedDate ? toDomainDate(shippedDate) : null,
      cost: hasCost ? Math.round(parseFloat(cost) * 100) : 0,
      // A delivery row always needs a currency; with no cost recorded it is only a unit label.
      currencyCode: currencyCode || baseCurrencyCode || "USD",
      exchangeRate: hasCost && showExchangeRate && isValidRate(exchangeRate) ? parseFloat(exchangeRate) : null,
      settleRemainder: showSettlementBlock && settleRemainder,
      settlementDate: showSettlementBlock && settleRemainder ? toDomainDate(effectiveSettlementDate) : undefined,
      settlementIntents:
        showSettlementBlock && settleRemainder
          ? relevantSettlementContexts.map((context) => ({
              orderId: context.orderId,
              manualAmountMinor:
                context.plan.kind === "manual"
                  ? Math.round(parseFloat(manualAmounts[context.orderId] || "0") * 100)
                  : undefined,
              branchHint:
                context.plan.kind === "computedFull"
                  ? "full"
                  : context.plan.kind === "computedPartial"
                    ? "partial_computed"
                    : "manual",
            }))
          : undefined,
    });
    handleClose();
  }, [
    baseCurrencyCode,
    cost,
    currencyCode,
    exchangeRate,
    handleClose,
    manualAmounts,
    onSubmit,
    receivedDate,
    relevantSettlementContexts,
    selectedIds,
    settleRemainder,
    settlementDate,
    shippedDate,
    showExchangeRate,
    showShippingDetails,
    showSettlementBlock,
    validate,
  ]);

  const selectedCount = selectedIds.length;
  const itemGroups = useMemo(() => groupItemsByOrder(items), [items]);
  const spansSeveralOrders = itemGroups.length > 1;
  const summaryLabel = useMemo(
    () => (showShippingDetails ? t("detail.quickArrival.shipping.hide") : t("detail.quickArrival.shipping.show")),
    [showShippingDetails, t],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("detail.quickArrival.title")}
      subtitle={subtitle}
      icon={<PackageCheck />}
      tone="success"
      size="md"
      primaryAction={{
        // Whenever the picker is on screen the collector can change what gets logged, so the
        // button has to declare the quantity it is about to write. A single-product arrival has
        // no picker and already names the product, so the count would only repeat it.
        label: isSingleItem
          ? t("detail.quickArrival.confirm")
          : t("detail.quickArrival.confirmCount", { count: selectedCount }),
        onClick: handleConfirm,
        variant: "success",
      }}
      secondaryAction={{ label: t("detail.quickArrival.cancel"), onClick: handleClose }}
    >
      <div className="space-y-4">
        {isSingleItem ? (
          <p className="rounded-xl px-3 py-2.5 text-[13px] [color:var(--text-secondary)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
            {t.rich("detail.quickArrival.singleItem", {
              name: items[0]?.name ?? "",
              strong: (chunks) => <strong className="[color:var(--text-primary)]">{chunks}</strong>,
            })}
          </p>
        ) : (
          <fieldset className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <legend className="text-[13px] font-medium [color:var(--text-secondary)]">
                {t("detail.quickArrival.itemsLabel")}
              </legend>
              <button
                type="button"
                onClick={handleToggleAll}
                className="text-[12.5px] font-medium [color:var(--accent)] hover:underline"
              >
                {allSelected ? t("detail.quickArrival.selectNone") : t("detail.quickArrival.selectAll")}
              </button>
            </div>
            <p className="text-[11.5px] [color:var(--text-muted)]">{t("detail.quickArrival.itemsHelper")}</p>
            {settledItemCount > 0 && (
              <p className="text-[11.5px] [color:var(--text-muted)]">
                {t("detail.quickArrival.settledNotListed", { count: settledItemCount })}
              </p>
            )}
            {spansSeveralOrders && (
              <p className="text-[11.5px] [color:var(--text-muted)]">
                {t("detail.quickArrival.multiOrderNotice", { count: items.length })}
              </p>
            )}
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl p-1.5 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
              {itemGroups.map((group, groupIndex) => {
                const groupHeadingId = `quick-arrival-order-${groupIndex}`;
                const list = (
                  <ul className="space-y-1">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <div className="rounded-lg px-2 py-1.5 hover:[background:color-mix(in_oklch,var(--accent)_6%,transparent)]">
                          <Checkbox
                            id={`quick-arrival-item-${item.id}`}
                            checked={selectedIds.includes(item.id)}
                            onChange={() => handleToggleItem(item.id)}
                            label={item.name}
                            size="sm"
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                );

                if (!group.orderLabel) return <div key={groupHeadingId}>{list}</div>;

                // `role="group"` + `aria-labelledby` rather than a per-checkbox aria-label: the
                // product name has to stay the checkbox's visible label, so the order code can
                // only reach assistive tech as group context around it.
                return (
                  <div key={groupHeadingId} role="group" aria-labelledby={groupHeadingId}>
                    <p
                      id={groupHeadingId}
                      className="px-2 pt-1 pb-0.5 text-[11.5px] font-medium [color:var(--text-muted)]"
                    >
                      {t("detail.quickArrival.orderGroupLabel", { code: group.orderLabel })}
                    </p>
                    {list}
                  </div>
                );
              })}
            </div>
            {errors.items ? (
              <FieldErrorMsg>{errors.items}</FieldErrorMsg>
            ) : (
              <p className="text-[11.5px] [color:var(--text-muted)]">
                {t("detail.quickArrival.selectedCount", { count: selectedCount, total: items.length })}
              </p>
            )}
          </fieldset>
        )}

        <div className="space-y-1.5">
          <label htmlFor="quick-arrival-received" className="text-[13px] font-medium [color:var(--text-secondary)]">
            {t("detail.quickArrival.receivedLabel")} <span className="[color:var(--destructive)]">*</span>
          </label>
          <DatePickerInput
            id="quick-arrival-received"
            value={receivedDate}
            onChange={(date) => {
              setReceivedDate(date);
              // The settlement date is PROPOSED as the arrival date (ADR 0032 §7): it follows this
              // field until the collector edits it directly, at which point it becomes independent.
              if (!settlementDateTouched) setSettlementDate(date);
              setErrors((prev) => (prev.receivedDate ? { ...prev, receivedDate: null } : prev));
            }}
            placeholder={t("detail.quickArrival.receivedPlaceholder")}
            locale={locale}
            disableFuture
            popupAlign="end"
          />
          {errors.receivedDate ? (
            <FieldErrorMsg>{errors.receivedDate}</FieldErrorMsg>
          ) : (
            <p className="text-[11.5px] [color:var(--text-muted)]">{t("detail.quickArrival.receivedHelper")}</p>
          )}
        </div>

        {isLoadingSettlement && (
          <p className="text-[11.5px] [color:var(--text-muted)]" role="status">
            {t("detail.quickArrival.settlement.loading")}
          </p>
        )}

        {showSettlementBlock && (
          <div className="space-y-2.5 rounded-xl px-3 py-2.5 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
            <Checkbox
              id="quick-arrival-settle-remainder"
              checked={settleRemainder}
              onChange={() => setSettleRemainder((current) => !current)}
              label={t("detail.quickArrival.settlement.checkboxLabel")}
              size="sm"
            />
            <p className="pl-[26px] text-[11.5px] [color:var(--text-muted)]">
              {t("detail.quickArrival.settlement.help")}
            </p>

            {settleRemainder && (
              <div className="space-y-3 pl-[26px]">
                <div className="space-y-1.5">
                  <label
                    htmlFor="quick-arrival-settlement-date"
                    className="text-[13px] font-medium [color:var(--text-secondary)]"
                  >
                    {t("detail.quickArrival.settlement.dateLabel")}
                  </label>
                  <DatePickerInput
                    id="quick-arrival-settlement-date"
                    value={settlementDate}
                    onChange={(date) => {
                      setSettlementDateTouched(true);
                      setSettlementDate(date);
                      setErrors((prev) => (prev.settlementDate ? { ...prev, settlementDate: null } : prev));
                    }}
                    placeholder={t("detail.quickArrival.receivedPlaceholder")}
                    locale={locale}
                    disableFuture
                    popupAlign="end"
                  />
                  {errors.settlementDate && <FieldErrorMsg>{errors.settlementDate}</FieldErrorMsg>}
                </div>

                {relevantSettlementContexts.map((context) => {
                  const amountLabel =
                    context.plan.kind === "computedFull" || context.plan.kind === "computedPartial"
                      ? formatAmountWithSymbol(context.plan.amountMinor, context.currencyCode, locale)
                      : null;
                  const dateLabel = settlementDate
                    ? settlementDate.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })
                    : "";

                  return (
                    <div key={context.orderId} className="space-y-1.5">
                      {amountLabel && (
                        <p className="text-[12.5px] [color:var(--text-secondary)]">
                          {t("detail.quickArrival.settlement.detail", { amount: amountLabel, date: dateLabel })}
                        </p>
                      )}
                      {context.plan.kind === "computedPartial" && (
                        <p className="text-[11.5px] [color:var(--text-muted)]">
                          {t("detail.quickArrival.settlement.partialCoverage", {
                            count:
                              settlementOrderGroups.find((group) => group.orderId === context.orderId)?.itemIds
                                .length ?? 0,
                          })}
                        </p>
                      )}
                      {context.closesOrder &&
                        context.plan.kind === "computedFull" &&
                        context.plan.appliedUnassignedMinor > 0 && (
                          <p className="text-[11.5px] [color:var(--text-muted)]">
                            {t("detail.quickArrival.settlement.appliedUnassigned", {
                              amount: formatAmountWithSymbol(
                                context.plan.appliedUnassignedMinor,
                                context.currencyCode,
                                locale,
                              ),
                            })}
                          </p>
                        )}
                      {!context.closesOrder && context.unassignedMinor > 0 && (
                        <p className="text-[11.5px] [color:var(--text-muted)]">
                          {t("detail.quickArrival.settlement.unassignedNotice", {
                            store: storeName ?? "",
                            amount: formatAmountWithSymbol(context.unassignedMinor, context.currencyCode, locale),
                          })}
                        </p>
                      )}
                      {context.plan.kind === "manual" && (
                        <>
                          <p className="text-[11.5px] [color:var(--text-muted)]">
                            {t(
                              context.plan.reasonCode === "missingPrice"
                                ? "detail.quickArrival.settlement.reasonMissingPrice"
                                : "detail.quickArrival.settlement.reasonUndetailedMoney",
                            )}
                          </p>
                          <Input
                            id={`quick-arrival-settlement-amount-${context.orderId}`}
                            type="text"
                            inputMode="decimal"
                            value={manualAmounts[context.orderId] ?? ""}
                            placeholder={t("detail.quickArrival.costPlaceholder")}
                            error={Boolean(errors[`manualAmount-${context.orderId}`])}
                            onChange={(event) => {
                              const sanitized = sanitizeDecimalInput(event.target.value, context.currencyCode);
                              setManualAmounts((prev) => ({ ...prev, [context.orderId]: sanitized }));
                              setErrors((prev) =>
                                prev[`manualAmount-${context.orderId}`]
                                  ? { ...prev, [`manualAmount-${context.orderId}`]: null }
                                  : prev,
                              );
                            }}
                          />
                          {errors[`manualAmount-${context.orderId}`] && (
                            <FieldErrorMsg>{errors[`manualAmount-${context.orderId}`]}</FieldErrorMsg>
                          )}
                          <p className="text-[11.5px] [color:var(--text-muted)]">
                            {t("detail.quickArrival.settlement.reference", {
                              amount: formatAmountWithSymbol(
                                context.plan.referenceAmountMinor,
                                context.currencyCode,
                                locale,
                              ),
                            })}
                          </p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl [border:1px_solid_var(--border)]">
          <button
            type="button"
            onClick={() => setShowShippingDetails((current) => !current)}
            aria-expanded={showShippingDetails}
            className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left"
          >
            <span className="text-[12.5px] font-medium [color:var(--text-secondary)]">{summaryLabel}</span>
            <ChevronDown
              size={15}
              aria-hidden
              className={cn(
                "shrink-0 [color:var(--text-muted)] transition-transform",
                showShippingDetails && "rotate-180",
              )}
            />
          </button>

          {!showShippingDetails && (
            <p className="px-3 pb-2.5 text-[11.5px] leading-relaxed [color:var(--text-muted)]">
              {t("detail.quickArrival.shipping.defaultsNotice")}
            </p>
          )}

          {showShippingDetails && (
            <div className="space-y-4 px-3 pt-1 pb-3.5">
              <div className="space-y-1.5">
                <label
                  htmlFor="quick-arrival-shipped"
                  className="text-[13px] font-medium [color:var(--text-secondary)]"
                >
                  {t("detail.quickArrival.shippedLabel")}{" "}
                  <span className="text-[11px] font-normal [color:var(--text-muted)]">
                    {t("detail.quickArrival.optional")}
                  </span>
                </label>
                <DatePickerInput
                  id="quick-arrival-shipped"
                  value={shippedDate}
                  onChange={(date) => {
                    setShippedDate(date);
                    setErrors((prev) => (prev.shippedDate ? { ...prev, shippedDate: null } : prev));
                  }}
                  placeholder={t("detail.quickArrival.shippedPlaceholder")}
                  locale={locale}
                  disableFuture
                  popupAlign="end"
                />
                {errors.shippedDate && <FieldErrorMsg>{errors.shippedDate}</FieldErrorMsg>}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="quick-arrival-cost" className="text-[13px] font-medium [color:var(--text-secondary)]">
                    {t("detail.quickArrival.costLabel")}{" "}
                    <span className="text-[11px] font-normal [color:var(--text-muted)]">
                      {t("detail.quickArrival.optional")}
                    </span>
                  </label>
                  <Input
                    id="quick-arrival-cost"
                    type="text"
                    inputMode="decimal"
                    value={cost}
                    placeholder={t("detail.quickArrival.costPlaceholder")}
                    error={Boolean(errors.cost)}
                    onChange={(event) => {
                      setCost(sanitizeDecimalInput(event.target.value, currencyCode));
                      setErrors((prev) => (prev.cost ? { ...prev, cost: null } : prev));
                    }}
                  />
                  {errors.cost && <FieldErrorMsg>{errors.cost}</FieldErrorMsg>}
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="quick-arrival-currency"
                    className="text-[13px] font-medium [color:var(--text-secondary)]"
                  >
                    {t("detail.quickArrival.currencyLabel")}
                  </label>
                  <Select
                    id="quick-arrival-currency"
                    value={currencyCode}
                    onChange={(event) => {
                      setCurrencyCode(event.target.value);
                      setErrors((prev) => ({ ...prev, currencyCode: null, exchangeRate: null }));
                    }}
                    error={Boolean(errors.currencyCode)}
                    showChevron
                  >
                    <option value="">{t("detail.quickArrival.currencyPlaceholder")}</option>
                    {(ALLOWED_COLLECTOR_BASE_CURRENCY_CODES as readonly string[]).map((code) => (
                      <option key={code} value={code}>
                        {code} · {tCurrencies(code as never)}
                      </option>
                    ))}
                  </Select>
                  {errors.currencyCode && <FieldErrorMsg>{errors.currencyCode}</FieldErrorMsg>}
                </div>
              </div>

              {showExchangeRate && (
                <div className="space-y-1.5">
                  <label htmlFor="quick-arrival-fx" className="text-[13px] font-medium [color:var(--text-secondary)]">
                    {t("detail.quickArrival.fxLabel")}
                  </label>
                  <Input
                    id="quick-arrival-fx"
                    type="text"
                    inputMode="decimal"
                    value={exchangeRate}
                    placeholder={t("detail.quickArrival.fxPlaceholder")}
                    error={Boolean(errors.exchangeRate)}
                    onChange={(event) => {
                      setExchangeRate(sanitizeRateInput(event.target.value));
                      setErrors((prev) => (prev.exchangeRate ? { ...prev, exchangeRate: null } : prev));
                    }}
                  />
                  {errors.exchangeRate ? (
                    <FieldErrorMsg>{errors.exchangeRate}</FieldErrorMsg>
                  ) : (
                    <p className="text-[11.5px] [color:var(--text-muted)]">
                      {t("detail.quickArrival.fxHelper", { from: currencyCode, to: baseCurrencyCode ?? "" })}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

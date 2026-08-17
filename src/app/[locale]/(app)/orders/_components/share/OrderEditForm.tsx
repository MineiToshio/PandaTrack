"use client";

import { AlertTriangle, Calculator, Check, Info, Keyboard, Lock, Plus, RefreshCw, ShoppingCart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import {
  type FormEvent,
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import BackNavLink from "@/components/core/BackNavLink";
import Button from "@/components/core/Button/Button";
import FieldErrorMsg from "@/components/core/FieldErrorMsg";
import DatePickerInput from "@/components/core/DatePickerInput";
import Input from "@/components/core/Input";
import { Modal } from "@/components/modules/Modal";
import { AsideSummary, AsideSummaryRow } from "@/components/modules/AsideSummary";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useStoreProductTypeName } from "@/app/[locale]/(app)/_components/StoreProductTypeNamesProvider";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { formatAmount, formatCentsForInput } from "@/lib/currency";
import { toLocalIsoDateString, utcDomainDateToLocal } from "@/lib/domainDate";
import { isValidPositiveDecimal, sanitizeDecimalInput } from "@/lib/decimalInput";
import { fetchTodayRate } from "@/lib/fx/exchangeRates";
import { deriveItemizedTotal, shouldShowDiscrepancyModal } from "@/lib/orders/orderItemUtils";
import { cn } from "@/lib/styles";
import type { OrderActionResult } from "../../_actions/orderActions";
import DiscrepancyModal from "./DiscrepancyModal";
import FxRateAttribution from "./FxRateAttribution";
import OrderDeliveryRangeField from "./OrderDeliveryRangeField";
import OrderItemsGrid, { type ItemRow, createEmptyRow } from "./OrderItemsGrid";
import {
  ORDER_SECTION_BODY_CLASS,
  ORDER_SECTION_BULLET_CLASS,
  ORDER_SECTION_CARD_CLASS,
  ORDER_SECTION_EYEBROW_CLASS,
  ORDER_SECTION_HEADING_CLASS,
} from "./orderSectionChrome";
import OrderItemsMobileList from "./OrderItemsMobileList";

type StoreOption = { id: string; name: string; countryCode: string };

type InitialOrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number | null;
  productTypeKey: string | null;
  position: number;
};

export type InitialOrderData = {
  id: string;
  humanReadableId: string;
  storeId: string;
  orderDate: Date;
  expectedDeliveryFrom: Date | null;
  expectedDeliveryTo: Date | null;
  currencyCode: string;
  exchangeRate: number | null;
  /** True when the stored rate is stale after a base-currency change — shows an inline warning. */
  needsExchangeRateUpdate: boolean;
  totalCost: number;
  /** Sum of payments already recorded — minimum the user can lower `totalCost` to. */
  paidAmount: number;
  items: InitialOrderItem[];
};

type Props = {
  stores: StoreOption[];
  productTypeKeys: string[];
  baseCurrencyCode: string | null;
  action: (prev: OrderActionResult | null, formData: FormData) => Promise<OrderActionResult>;
  initialOrder: InitialOrderData;
};

function parseCentsFromDecimal(value: string): number | null {
  const n = parseFloat(value);
  if (isNaN(n)) return null;
  return Math.round(n * 100);
}

function toItemRow(item: InitialOrderItem, currencyCode: string): ItemRow {
  return {
    rowId: `row-${item.id}`,
    id: item.id,
    name: item.name,
    quantity: String(item.quantity),
    unitPrice: item.unitPrice != null ? formatCentsForInput(item.unitPrice, currencyCode) : "",
    productTypeKey: item.productTypeKey ?? "",
  };
}

function itemRowSignature(row: ItemRow): string {
  return [row.id ?? "", row.name.trim(), row.quantity.trim(), row.unitPrice.trim(), row.productTypeKey].join("|");
}

// Domain-date state is held in local-midnight Dates (the date picker emits local time and
// the prefill converts server UTC-midnight to the same local calendar day). Serialize with
// `toLocalIsoDateString` so the submitted yyyy-mm-dd matches the day shown in every timezone;
// a null field (no delivery window set yet) serializes to "".
function dateToIso(d: Date | null): string {
  return d ? toLocalIsoDateString(d) : "";
}

export default function OrderEditForm({ stores, productTypeKeys, baseCurrencyCode, action, initialOrder }: Props) {
  const t = useTranslations("orders");
  const tEdit = useTranslations("orders.edit");
  const tCreate = useTranslations("orders.create");
  const tForm = useTranslations("orders.form");
  const tCurrencies = useTranslations("orders.currencies");
  const productTypeName = useStoreProductTypeName();
  const locale = useLocale();
  const router = useRouter();
  const isMobile = useIsMobile();

  const rowIdPrefix = useId();
  const addedRowCounterRef = useRef(0);
  const nextRowId = useCallback(() => {
    addedRowCounterRef.current += 1;
    return `${rowIdPrefix}added-${addedRowCounterRef.current}`;
  }, [rowIdPrefix]);

  const initialStore = useMemo(
    () => stores.find((s) => s.id === initialOrder.storeId) ?? null,
    [stores, initialOrder.storeId],
  );
  const storeName = initialStore?.name ?? "";
  const storeInitial = storeName.charAt(0).toUpperCase() || "·";

  const initialItemsRows = useMemo<ItemRow[]>(
    () =>
      [...initialOrder.items]
        .sort((a, b) => a.position - b.position)
        .map((item) => toItemRow(item, initialOrder.currencyCode)),
    [initialOrder.items, initialOrder.currencyCode],
  );

  // Server domain dates are stored at midnight UTC; the picker works in local time and
  // re-serializes with local getters. Convert to local-midnight on the same calendar day
  // so the picker, the dirty snapshot, and the submitted value all agree (avoids the
  // off-by-one that would both show AND save the wrong day in non-UTC zones).
  const initialLocalDates = useMemo(
    () => ({
      orderDate: utcDomainDateToLocal(initialOrder.orderDate),
      deliveryFrom: initialOrder.expectedDeliveryFrom ? utcDomainDateToLocal(initialOrder.expectedDeliveryFrom) : null,
      deliveryTo: initialOrder.expectedDeliveryTo ? utcDomainDateToLocal(initialOrder.expectedDeliveryTo) : null,
    }),
    [initialOrder.orderDate, initialOrder.expectedDeliveryFrom, initialOrder.expectedDeliveryTo],
  );

  // Snapshot of the initial state — used to compute isDirty by comparing the
  // current editable fields against the canonical pre-edit values.
  const initialSnapshot = useMemo(
    () => ({
      orderDate: dateToIso(initialLocalDates.orderDate),
      deliveryFrom: dateToIso(initialLocalDates.deliveryFrom),
      deliveryTo: dateToIso(initialLocalDates.deliveryTo),
      totalCost: formatCentsForInput(initialOrder.totalCost, initialOrder.currencyCode),
      exchangeRate: initialOrder.exchangeRate != null ? String(initialOrder.exchangeRate) : "",
      items: initialItemsRows.map(itemRowSignature).join("§"),
    }),
    [initialOrder, initialItemsRows, initialLocalDates],
  );

  const [orderDate, setOrderDate] = useState<Date | null>(initialLocalDates.orderDate);
  const [deliveryFrom, setDeliveryFrom] = useState<Date | null>(initialLocalDates.deliveryFrom);
  const [deliveryTo, setDeliveryTo] = useState<Date | null>(initialLocalDates.deliveryTo);
  const [exchangeRate, setExchangeRate] = useState<string>(
    initialOrder.exchangeRate != null ? String(initialOrder.exchangeRate) : "",
  );
  const [totalCost, setTotalCost] = useState<string>(
    formatCentsForInput(initialOrder.totalCost, initialOrder.currencyCode),
  );
  const [items, setItems] = useState<ItemRow[]>(initialItemsRows);

  const [orderDateError, setOrderDateError] = useState<string | null>(null);
  const [clientTotalCostError, setClientTotalCostError] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<
    Record<string, { name?: string; quantity?: string; unitPrice?: string }>
  >({});

  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState<string | null>(null);

  const [discrepancyState, setDiscrepancyState] = useState<{
    show: boolean;
    enteredCents: number;
    calculatedCents: number;
    pendingFormData: FormData | null;
  }>({ show: false, enteredCents: 0, calculatedCents: 0, pendingFormData: null });

  const [discardState, setDiscardState] = useState<{ show: boolean; pendingHref: string | null }>({
    show: false,
    pendingHref: null,
  });

  const [state, formAction, isPending] = useActionState(action, null);

  const currencyCode = initialOrder.currencyCode;
  const currencyLabel = `${currencyCode} · ${tCurrencies(currencyCode as never)}`;
  const showExchangeRate = baseCurrencyCode !== null && currencyCode !== "" && currencyCode !== baseCurrencyCode;

  // Per-field dirty flags — drive both the `isDirty` aggregate (to enable Save) and the
  // per-row `changed` highlight in the Resumen aside (so only the fields the user actually
  // edited show in accent color, not every editable row by default).
  const dirty = useMemo(() => {
    const date =
      dateToIso(orderDate) !== initialSnapshot.orderDate ||
      dateToIso(deliveryFrom) !== initialSnapshot.deliveryFrom ||
      dateToIso(deliveryTo) !== initialSnapshot.deliveryTo;
    const total = totalCost.trim() !== initialSnapshot.totalCost;
    const exchange = exchangeRate.trim() !== initialSnapshot.exchangeRate;
    const productsList = items.map(itemRowSignature).join("§") !== initialSnapshot.items;
    return { date, total, exchange, items: productsList, any: date || total || exchange || productsList };
  }, [orderDate, deliveryFrom, deliveryTo, totalCost, exchangeRate, items, initialSnapshot]);
  const isDirty = dirty.any;

  // Browser unload guard — only attach when dirty.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Redirect on successful submit.
  useEffect(() => {
    if (state?.success) {
      router.push(`/${locale}${ROUTES.orders}/${state.orderId}`);
    }
  }, [state, locale, router]);

  const pricedRows = useMemo(
    () =>
      items
        .filter((r) => r.unitPrice !== "")
        .map((r) => ({
          quantity: parseInt(r.quantity, 10) || 0,
          unitPrice: parseCentsFromDecimal(r.unitPrice) ?? 0,
        })),
    [items],
  );
  const calculatedCents = useMemo(() => deriveItemizedTotal(pricedRows), [pricedRows]);
  const hasAnyPricedItem = pricedRows.length > 0;
  const validItemsCount = useMemo(() => items.filter((r) => r.name.trim().length > 0).length, [items]);

  // Total-vs-paid guard — the user can't lower `totalCost` below the sum of payments
  // already recorded. Server enforces the same gate (`TOTAL_BELOW_PAID`), but we surface
  // it inline as the user types so they fix it before hitting Save instead of after.
  const parsedTotalCents = useMemo(() => parseCentsFromDecimal(totalCost), [totalCost]);
  const totalBelowPaid =
    parsedTotalCents !== null && initialOrder.paidAmount > 0 && parsedTotalCents < initialOrder.paidAmount;
  const paidAmountLabel = formatAmount(initialOrder.paidAmount, currencyCode);

  const handleAddItemRow = useCallback(() => {
    setItems((prev) => [...prev, createEmptyRow(nextRowId())]);
  }, [nextRowId]);

  const handleCalculateTotal = useCallback(() => {
    if (calculatedCents === null) return;
    setTotalCost(formatCentsForInput(calculatedCents, currencyCode));
    setClientTotalCostError(null);
  }, [calculatedCents, currencyCode]);

  const handleFxToday = useCallback(async () => {
    if (!baseCurrencyCode || !currencyCode || currencyCode === baseCurrencyCode) return;
    setFxLoading(true);
    setFxError(null);
    const result = await fetchTodayRate(currencyCode, baseCurrencyCode);
    setFxLoading(false);
    if (result.ok) {
      setExchangeRate(result.rate.toFixed(4));
    } else {
      setFxError(tCreate("fxTodayError"));
    }
  }, [baseCurrencyCode, currencyCode, tCreate]);

  const validateItems = useCallback((): boolean => {
    const errors: Record<string, { name?: string; quantity?: string; unitPrice?: string }> = {};
    let valid = true;
    let hasAnyNamed = false;
    for (const row of items) {
      const rowErrors: { name?: string; quantity?: string; unitPrice?: string } = {};
      if (row.name.trim().length > 0) {
        hasAnyNamed = true;
      }
      const qty = parseInt(row.quantity, 10);
      if (row.name.trim().length > 0 && (isNaN(qty) || qty < 1)) {
        rowErrors.quantity = t("validation.itemQuantityTooLow");
        valid = false;
      }
      if (row.unitPrice !== "" && !isValidPositiveDecimal(row.unitPrice, currencyCode)) {
        rowErrors.unitPrice = t("validation.unitPriceInvalid");
        valid = false;
      }
      if (Object.keys(rowErrors).length > 0) errors[row.rowId] = rowErrors;
    }
    if (!hasAnyNamed) valid = false;
    setItemErrors(errors);
    return valid;
  }, [items, currencyCode, t]);

  const validateForm = useCallback((): boolean => {
    let valid = true;
    if (!orderDate) {
      setOrderDateError(t("validation.orderDateRequired"));
      valid = false;
    } else {
      setOrderDateError(null);
    }
    if (!validateItems()) valid = false;
    if (!totalCost.trim()) {
      setClientTotalCostError(t("validation.totalCostRequired"));
      valid = false;
    } else if (!isValidPositiveDecimal(totalCost, currencyCode)) {
      setClientTotalCostError(t("validation.totalCostInvalid"));
      valid = false;
    } else {
      setClientTotalCostError(null);
    }
    // `totalBelowPaid` already renders its own inline error reactively while typing;
    // here we just block submit so neither path slips past the gate.
    if (totalBelowPaid) valid = false;
    return valid;
  }, [orderDate, validateItems, totalCost, totalBelowPaid, currencyCode, t]);

  const formRef = useRef<HTMLFormElement>(null);

  const buildFormData = useCallback(
    (form: HTMLFormElement): FormData => {
      const fd = new FormData(form);
      const serializedItems = items.map((row, index) => ({
        id: row.id,
        name: row.name,
        quantity: row.quantity,
        unitPrice: row.unitPrice || null,
        productTypeKey: row.productTypeKey || null,
        position: index + 1,
      }));
      fd.set("items", JSON.stringify(serializedItems));
      fd.set("storeId", initialOrder.storeId);
      if (orderDate) fd.set("orderDate", dateToIso(orderDate));
      fd.set("expectedDeliveryFrom", dateToIso(deliveryFrom));
      fd.set("expectedDeliveryTo", dateToIso(deliveryTo));
      fd.set("currencyCode", currencyCode);
      if (showExchangeRate) fd.set("exchangeRate", exchangeRate);
      fd.set("totalCost", totalCost);
      return fd;
    },
    [
      items,
      initialOrder.storeId,
      orderDate,
      deliveryFrom,
      deliveryTo,
      currencyCode,
      showExchangeRate,
      exchangeRate,
      totalCost,
    ],
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!validateForm()) return;

      const fd = buildFormData(event.currentTarget);
      const enteredCents = parseCentsFromDecimal(totalCost) ?? 0;
      const allPriced = items.filter((r) => r.name.trim().length > 0).every((r) => r.unitPrice !== "");

      if (allPriced && pricedRows.length > 0) {
        const calc = deriveItemizedTotal(pricedRows);
        if (
          calc !== null &&
          shouldShowDiscrepancyModal(pricedRows as { quantity: number; unitPrice: number | null }[], enteredCents)
        ) {
          posthog.capture(POSTHOG_EVENTS.ORDER.DISCREPANCY_MODAL_OPENED);
          setDiscrepancyState({ show: true, enteredCents, calculatedCents: calc, pendingFormData: fd });
          return;
        }
      }
      startTransition(() => formAction(fd));
    },
    [validateForm, buildFormData, totalCost, items, pricedRows, formAction],
  );

  // ⌘/Ctrl+Enter saves (mirrors the deliveries edit form). Shift is excluded so it never
  // collides with the item grid's Ctrl+Shift+Enter "insert row"; the guard mirrors the Save
  // button's disabled state so the shortcut can't submit an unchanged or invalid form.
  const handleFormKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLFormElement>) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key === "Enter") {
        if (isPending || !isDirty || totalBelowPaid) return;
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    },
    [isPending, isDirty, totalBelowPaid],
  );

  const handleSaveAnyway = useCallback(() => {
    posthog.capture(POSTHOG_EVENTS.ORDER.DISCREPANCY_RESOLVED, { resolution: "kept_entered" });
    const fd = discrepancyState.pendingFormData;
    setDiscrepancyState({ show: false, enteredCents: 0, calculatedCents: 0, pendingFormData: null });
    if (fd) startTransition(() => formAction(fd));
  }, [discrepancyState, formAction]);

  const handleDiscrepancyGoBack = useCallback(() => {
    posthog.capture(POSTHOG_EVENTS.ORDER.DISCREPANCY_RESOLVED, { resolution: "cancelled" });
    setDiscrepancyState({ show: false, enteredCents: 0, calculatedCents: 0, pendingFormData: null });
  }, []);

  const detailHref = `/${locale}${ROUTES.orders}/${initialOrder.id}`;

  const handleNavigateWithGuard = useCallback(
    (href: string) => {
      if (isDirty) {
        setDiscardState({ show: true, pendingHref: href });
      } else {
        router.push(href);
      }
    },
    [isDirty, router],
  );

  const handleDiscardConfirm = useCallback(() => {
    const href = discardState.pendingHref;
    setDiscardState({ show: false, pendingHref: null });
    if (href) router.push(href);
  }, [discardState.pendingHref, router]);

  const handleDiscardCancel = useCallback(() => {
    setDiscardState({ show: false, pendingHref: null });
  }, []);

  const serverError = state?.success === false && "error" in state && state.error !== "validation" ? state.error : null;

  // Aside summary derived data.
  const enteredCentsForSummary = parseCentsFromDecimal(totalCost);
  const fmtDate = (d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  const dateLabel = orderDate ? fmtDate(orderDate) : "—";
  const totalLabelSummary = enteredCentsForSummary != null ? formatAmount(enteredCentsForSummary, currencyCode) : "—";
  const itemsLabelSummary = validItemsCount > 0 ? tCreate("summaryItems", { count: validItemsCount }) : "—";

  const calculatedLabel = calculatedCents !== null ? formatAmount(calculatedCents, currencyCode) : null;

  // STATIC SECTION CARD — header without chevron/button (L020 all-open).
  // Bullet shows a Lucide icon (Info / ShoppingCart) instead of a number to match
  // the demo HTML `step-num` pattern for edit. The strings live in `orderSectionChrome` because
  // the image-intake review screen is built out of the same sections.
  const sectionCardClass = ORDER_SECTION_CARD_CLASS;
  const sectionBulletClass = ORDER_SECTION_BULLET_CLASS;
  const sectionEyebrowClass = ORDER_SECTION_EYEBROW_CLASS;
  const sectionHeadingClass = ORDER_SECTION_HEADING_CLASS;
  const sectionBodyClass = ORDER_SECTION_BODY_CLASS;

  return (
    <div
      className={cn(
        // Width + horizontal padding come from the shell `<main>` (APP_SHELL_MAIN_CLASSNAME).
        "space-y-4",
        // Reserve space for the sticky mobile actionbar.
        "pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0",
      )}
    >
      <BackNavLink
        href={detailHref}
        onClick={(e) => {
          e.preventDefault();
          handleNavigateWithGuard(detailHref);
        }}
      >
        {initialOrder.humanReadableId}
      </BackNavLink>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-[28px] leading-tight font-semibold [color:var(--text-primary)]">{tEdit("heroEyebrow")}</h1>
        <span className="[font-family:var(--font-mono)] text-[13px] [color:var(--text-muted)]">
          {initialOrder.humanReadableId}
        </span>
      </div>

      {serverError && (
        <p
          className="rounded-lg px-3 py-2 text-[13px] [color:var(--destructive)] [background:color-mix(in_oklch,var(--destructive)_8%,transparent)]"
          role="alert"
        >
          {t.has(`error.${serverError}` as never) ? t(`error.${serverError}` as never) : t("error.server_error")}
        </p>
      )}

      <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} noValidate>
        <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
          <div className="flex flex-col gap-4">
            {/* SECTION 1 — Datos del pedido */}
            <section className={sectionCardClass} aria-labelledby="order-edit-section-datos">
              <header className="flex items-start gap-3 px-4 pt-4 md:px-5 md:pt-5">
                <span className={sectionBulletClass} aria-hidden="true">
                  <Info size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <span className={sectionEyebrowClass}>{tEdit("sectionDatosTitle")}</span>
                  <h2 id="order-edit-section-datos" className={sectionHeadingClass}>
                    {tEdit("sectionDatosSubtitle", { storeName, currencyCode })}
                  </h2>
                </div>
              </header>
              <div className={sectionBodyClass}>
                {/* Tienda (locked) + Moneda (locked) */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium [color:var(--text-secondary)]">
                      {tForm("storeLabel")}
                    </label>
                    <div
                      aria-disabled="true"
                      data-testid="order-edit-store-locked"
                      className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 opacity-70 [background:color-mix(in_oklch,var(--text-primary)_4%,transparent)] [border:1px_solid_var(--border)]"
                    >
                      <span
                        aria-hidden="true"
                        className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold [color:var(--text-on-accent)] [background:var(--accent)]"
                      >
                        {storeInitial}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium [color:var(--text-primary)]">
                        {storeName}
                      </span>
                      <Lock size={13} aria-hidden="true" className="flex-shrink-0 [color:var(--text-muted)]" />
                    </div>
                    <p className="text-[11.5px] [color:var(--text-muted)]">{tForm("storeLockedHelper")}</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium [color:var(--text-secondary)]">
                      {tForm("currencyLabel")}
                    </label>
                    <div
                      aria-disabled="true"
                      data-testid="order-edit-currency-locked"
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 text-[14px] opacity-70 [background:color-mix(in_oklch,var(--text-primary)_4%,transparent)] [border:1px_solid_var(--border)]"
                    >
                      <span className="[color:var(--text-primary)]">{currencyLabel}</span>
                      <Lock size={13} aria-hidden="true" className="flex-shrink-0 [color:var(--text-muted)]" />
                    </div>
                    <p className="text-[11.5px] [color:var(--text-muted)]">{tForm("currencyLockedHelper")}</p>
                  </div>
                </div>

                {/* Fechas */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="order-date" className="text-[13px] font-medium [color:var(--text-secondary)]">
                      {tForm("orderDateLabel")} <span className="[color:var(--destructive)]">*</span>
                    </label>
                    <DatePickerInput
                      id="order-date"
                      value={orderDate}
                      error={Boolean(orderDateError)}
                      onChange={(d) => {
                        setOrderDate(d);
                        setOrderDateError(null);
                      }}
                      placeholder={tForm("orderDatePlaceholder")}
                      locale={locale}
                      disableFuture
                    />
                    {orderDateError && <FieldErrorMsg>{orderDateError}</FieldErrorMsg>}
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="delivery-range" className="text-[13px] font-medium [color:var(--text-secondary)]">
                      {tForm("deliveryRangeLabel")}
                    </label>
                    <OrderDeliveryRangeField
                      id="delivery-range"
                      from={deliveryFrom}
                      to={deliveryTo}
                      onChange={(f, to) => {
                        setDeliveryFrom(f);
                        setDeliveryTo(to);
                      }}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 2 — Productos y costos */}
            <section className={sectionCardClass} aria-labelledby="order-edit-section-productos">
              <header className="flex items-start gap-3 px-4 pt-4 md:px-5 md:pt-5">
                <span className={sectionBulletClass} aria-hidden="true">
                  <ShoppingCart size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <span className={sectionEyebrowClass}>{tEdit("sectionProductosTitle")}</span>
                  <h2 id="order-edit-section-productos" className={sectionHeadingClass}>
                    {tEdit("sectionProductosSubtitle")}
                  </h2>
                </div>
              </header>
              <div className={sectionBodyClass}>
                {isMobile ? (
                  <OrderItemsMobileList
                    rows={items}
                    onChange={setItems}
                    currencyCode={currencyCode}
                    productTypeKeys={productTypeKeys}
                    tProductTypes={productTypeName}
                    nextRowId={nextRowId}
                  />
                ) : (
                  <>
                    <OrderItemsGrid
                      rows={items}
                      onChange={setItems}
                      productTypeKeys={productTypeKeys}
                      tProductTypes={productTypeName}
                      itemErrors={itemErrors}
                      createNewRow={() => createEmptyRow(nextRowId())}
                      currencyCode={currencyCode || undefined}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="tonal"
                        size="sm"
                        onClick={handleAddItemRow}
                        leadingIcon={<Plus size={14} aria-hidden />}
                      >
                        {tCreate("addProductButton")}
                      </Button>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] [color:var(--text-muted)]">
                        <Keyboard size={12} aria-hidden className="shrink-0" />
                        <ShortcutHint label={tCreate("shortcutNav")} keys="Ctrl⇧↑↓←→" />
                        <ShortcutHint label={tCreate("shortcutInsert")} keys="Ctrl⇧↵" />
                        <ShortcutHint label={tCreate("shortcutOrder")} keys="Alt⇧↑↓" />
                        <ShortcutHint label={tCreate("shortcutDelete")} keys="Ctrl⇧⌫" />
                      </span>
                    </div>
                  </>
                )}

                <div className="flex flex-col gap-2.5 pt-3.5 [border-top:1px_solid_var(--border)] md:flex-row md:items-center md:justify-between md:gap-3">
                  <p className="text-[12px] [color:var(--text-muted)]">
                    {tCreate("calculatedTotalLabel", { total: calculatedLabel ?? "—" })}
                  </p>
                  <Button
                    type="button"
                    variant="tonal"
                    size="sm"
                    onClick={handleCalculateTotal}
                    disabled={!hasAnyPricedItem}
                    leadingIcon={<Calculator size={14} aria-hidden />}
                    aria-label={tCreate("useCalculatedTotalAria")}
                    fullWidth={isMobile}
                  >
                    {tCreate("useCalculatedTotal")}
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="order-total" className="text-[13px] font-medium [color:var(--text-secondary)]">
                      {tForm("totalCostLabel")} ({currencyCode}) <span className="[color:var(--destructive)]">*</span>
                    </label>
                    <Input
                      id="order-total"
                      type="text"
                      inputMode="decimal"
                      value={totalCost}
                      placeholder={tForm("totalCostPlaceholder")}
                      error={Boolean(clientTotalCostError) || totalBelowPaid}
                      onChange={(e) => {
                        setTotalCost(sanitizeDecimalInput(e.target.value, currencyCode));
                        setClientTotalCostError(null);
                      }}
                    />
                    {clientTotalCostError ? (
                      <p className="text-[12px] [color:var(--destructive)]" role="alert">
                        {clientTotalCostError}
                      </p>
                    ) : totalBelowPaid ? (
                      <p className="text-[12px] [color:var(--destructive)]" role="alert">
                        {t("validation.totalBelowPaid", { paid: paidAmountLabel })}
                      </p>
                    ) : (
                      <p className="text-[11.5px] [color:var(--text-muted)]">{tCreate("totalCostHelper")}</p>
                    )}
                  </div>
                  {showExchangeRate && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="order-exchange-rate"
                        className="text-[13px] font-medium [color:var(--text-secondary)]"
                      >
                        {tForm("exchangeRateLabel")} {currencyCode}→{baseCurrencyCode}{" "}
                        <span className="text-[11px] font-normal [color:var(--text-muted)]">
                          {tCreate("fxOptional")}
                        </span>
                      </label>
                      <div className="flex items-stretch gap-2">
                        <Input
                          id="order-exchange-rate"
                          type="number"
                          min="0.01"
                          step="0.0001"
                          value={exchangeRate}
                          placeholder={tForm("exchangeRatePlaceholder")}
                          onChange={(e) => setExchangeRate(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="tonal"
                          size="md"
                          onClick={handleFxToday}
                          disabled={fxLoading || !baseCurrencyCode || !currencyCode}
                          leadingIcon={<RefreshCw size={14} aria-hidden className={fxLoading ? "animate-spin" : ""} />}
                          aria-label={tCreate("fxTodayAria")}
                        >
                          {fxLoading ? tCreate("fxTodayLoading") : tCreate("fxTodayButton")}
                        </Button>
                      </div>
                      {initialOrder.needsExchangeRateUpdate && (
                        <p className="text-warning flex items-center gap-1.5 text-[12px]" role="status">
                          <AlertTriangle size={13} aria-hidden />
                          {tForm("exchangeRateOutdatedWarning")}
                        </p>
                      )}
                      {fxError ? (
                        <p className="text-[12px] [color:var(--destructive)]" role="alert">
                          {fxError}
                        </p>
                      ) : (
                        <p className="text-[11.5px] [color:var(--text-muted)]">{tCreate("fxTodayHelper")}</p>
                      )}
                      <FxRateAttribution />
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Desktop footer (inline). Mobile uses the sticky bar below. */}
            <div className="hidden flex-wrap items-center justify-end gap-3 pt-2 md:flex">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleNavigateWithGuard(detailHref)}
                disabled={isPending}
              >
                {tEdit("cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isPending || !isDirty || totalBelowPaid}
                leadingIcon={<Check size={14} aria-hidden />}
              >
                {isPending ? tEdit("submitting") : tEdit("submit")}
              </Button>
              {/* Submit shortcut as plain text beside the CTA (deliveries S9-D5 parity), no kbd chip inside the button. */}
              <span className="text-[12px] [color:var(--text-muted)]">{tCreate("submitShortcutHint")}</span>
            </div>
          </div>

          {!isMobile && (
            // `changed` highlights the row in accent color and is meant to call attention to
            // edited values — so we only flip it on when the per-field dirty flag is true.
            // The store + currency rows are locked on the edit screen and can never be dirty,
            // so they stay neutral by design.
            <AsideSummary eyebrow={tCreate("summaryTitle")} ariaLabel={tCreate("summaryTitle")}>
              <AsideSummaryRow label={tCreate("summaryStore")} value={storeName} />
              <AsideSummaryRow label={tCreate("summaryCurrency")} value={currencyCode} />
              <AsideSummaryRow label={tCreate("summaryDate")} value={dateLabel} changed={dirty.date} />
              <AsideSummaryRow label={tCreate("summaryProducts")} value={itemsLabelSummary} changed={dirty.items} />
              <AsideSummaryRow label={tCreate("summaryTotal")} value={totalLabelSummary} changed={dirty.total} strong />
            </AsideSummary>
          )}
        </div>
      </form>

      {/* Sticky mobile actionbar (S7-A.7 single-primary). */}
      <div
        role="toolbar"
        aria-label={tEdit("heroEyebrow")}
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-2 px-4 pt-3 [box-shadow:0_-4px_18px_color-mix(in_oklch,var(--text-primary)_8%,transparent)] [background:var(--surface-elevated)] [border-top:1px_solid_var(--border)] md:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + var(--space-3))" }}
      >
        <Button
          type="button"
          variant="ghost"
          onClick={() => handleNavigateWithGuard(detailHref)}
          disabled={isPending}
          className="[min-width:96px] flex-shrink-0 [justify-content:center]"
        >
          {tEdit("cancel")}
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={isPending || !isDirty || totalBelowPaid}
          leadingIcon={<Check size={14} aria-hidden />}
          onClick={() => formRef.current?.requestSubmit()}
          className="flex-1 [justify-content:center]"
        >
          {isPending ? tEdit("submitting") : tEdit("submit")}
        </Button>
      </div>

      <DiscrepancyModal
        isOpen={discrepancyState.show}
        enteredTotal={discrepancyState.enteredCents}
        calculatedTotal={discrepancyState.calculatedCents}
        formatAmount={(cents) => formatAmount(cents, currencyCode)}
        onGoBack={handleDiscrepancyGoBack}
        onSaveAnyway={handleSaveAnyway}
      />

      <Modal
        isOpen={discardState.show}
        onClose={handleDiscardCancel}
        title={tEdit("discardTitle")}
        subtitle={tEdit("discardMessage")}
        icon={<AlertTriangle size={20} aria-hidden="true" />}
        tone="warning"
        role="alertdialog"
        primaryAction={{
          label: tEdit("discardConfirm"),
          variant: "destructive",
          onClick: handleDiscardConfirm,
        }}
        secondaryAction={{
          label: tEdit("discardCancel"),
          onClick: handleDiscardCancel,
        }}
      />
    </div>
  );
}

function ShortcutHint({ label, keys }: { label: string; keys: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span>{label}</span>
      <kbd
        style={{ fontFamily: "inherit" }}
        className="inline-flex items-center rounded-[3px] px-1.5 py-px text-[11px] leading-[1.4] tracking-wide [color:var(--text-secondary)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)]"
      >
        {keys}
      </kbd>
    </span>
  );
}

"use client";

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
import { Calculator, ClipboardList, Info, ShoppingBag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import AppPageHero from "@/components/modules/AppPageHero";
import BackNavLink from "@/components/core/BackNavLink";
import Label from "@/components/core/Label";
import Input from "@/components/core/Input";
import Typography from "@/components/core/Typography";
import Tooltip from "@/components/core/Tooltip";
import Button from "@/components/core/Button/Button";
import SectionTitleWithAccent from "@/components/modules/SectionTitleWithAccent";
import { COLLECTOR_FORM_SECTION_CLASSNAME, cn } from "@/lib/styles";
import {
  ALLOWED_COLLECTOR_BASE_CURRENCY_CODES,
  PRIMARY_CURRENCY_BY_COUNTRY,
  isCollectorCountryCode,
} from "@/lib/catalog/collectorCountries";
import { AUTH_RETURN_TO_PARAM } from "@/lib/auth/authRedirect";
import { APP_SHELL_FORM_RAIL_CLASSNAME, POSTHOG_EVENTS, RETURN_TO_ORDER_CREATE, ROUTES } from "@/lib/constants";
import { deriveItemizedTotal, shouldShowDiscrepancyModal } from "@/lib/orders/orderItemUtils";
import { sanitizeDecimalInput, isValidPositiveDecimal } from "@/lib/decimalInput";
import { formatAmount } from "@/lib/currency";
import type { OrderActionResult } from "../../_actions/orderActions";
import DatePickerInput from "@/components/core/DatePickerInput";
import DateRangePickerInput from "@/components/core/DateRangePickerInput";
import DiscrepancyModal from "./DiscrepancyModal";
import OrderItemsGrid, { createEmptyRow, type ItemRow } from "./OrderItemsGrid";
import OrderItemsShortcutsHelp from "./OrderItemsShortcutsHelp";
import OrderCurrencySelect from "./OrderCurrencySelect";
import OrderStoreSelect from "./OrderStoreSelect";

type StoreOption = { id: string; name: string; countryCode: string };

type InitialOrderData = {
  id: string;
  humanReadableId: string;
  storeId: string;
  orderDate: Date;
  expectedDeliveryFrom: Date | null;
  expectedDeliveryTo: Date | null;
  currencyCode: string;
  exchangeRate: number | null;
  totalCost: number;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number | null;
    productTypeKey: string | null;
    position: number;
  }>;
};

export type OrderFormProps = {
  mode: "create" | "edit";
  stores: StoreOption[];
  productTypeKeys: string[];
  baseCurrencyCode: string | null;
  action: (prev: OrderActionResult | null, formData: FormData) => Promise<OrderActionResult>;
  initialOrder?: InitialOrderData;
};

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

function parseCentsFromDecimal(value: string): number | null {
  const n = parseFloat(value);
  if (isNaN(n)) return null;
  return Math.round(n * 100);
}

function formatAmountDisplay(cents: number, currencyCode: string): string {
  return formatAmount(cents, currencyCode);
}

function getStoreDefaultCurrencyCode(store: StoreOption | null | undefined): string | null {
  if (!store) return null;
  const upper = store.countryCode.toUpperCase();
  if (!isCollectorCountryCode(upper)) return null;
  return PRIMARY_CURRENCY_BY_COUNTRY[upper] ?? null;
}

export default function OrderForm({
  mode,
  stores,
  productTypeKeys,
  baseCurrencyCode,
  action,
  initialOrder,
}: OrderFormProps) {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("orders");
  const tForm = useTranslations("orders.form");
  const tCurrencies = useTranslations("orders.currencies");
  const tProductTypes = useTranslations("storeProductTypes");

  const tCreate = useTranslations("orders.create");
  const tEdit = useTranslations("orders.edit");
  const tMode = mode === "create" ? tCreate : tEdit;

  const formRef = useRef<HTMLFormElement>(null);
  const rowIdPrefix = useId();
  const addedRowCounterRef = useRef(0);
  const nextRowId = useCallback(() => {
    addedRowCounterRef.current += 1;
    return `${rowIdPrefix}added-${addedRowCounterRef.current}`;
  }, [rowIdPrefix]);

  const initialStoreId = searchParams.get("store") ?? initialOrder?.storeId ?? null;

  const resolveStoreCurrency = useCallback(
    (id: string | null): string | null => {
      if (!id) return null;
      const store = stores.find((s) => s.id === id);
      return getStoreDefaultCurrencyCode(store);
    },
    [stores],
  );

  const [storeId, setStoreId] = useState<string | null>(initialStoreId);
  const [orderDate, setOrderDate] = useState<Date | null>(initialOrder?.orderDate ?? new Date());
  const [deliveryFrom, setDeliveryFrom] = useState<Date | null>(initialOrder?.expectedDeliveryFrom ?? null);
  const [deliveryTo, setDeliveryTo] = useState<Date | null>(initialOrder?.expectedDeliveryTo ?? null);
  const [currencyCode, setCurrencyCode] = useState<string>(() => {
    if (initialOrder?.currencyCode) return initialOrder.currencyCode;
    const fromStore = resolveStoreCurrency(initialStoreId);
    if (fromStore) return fromStore;
    return baseCurrencyCode ?? "";
  });
  const [exchangeRate, setExchangeRate] = useState<string>(
    initialOrder?.exchangeRate != null ? String(initialOrder.exchangeRate) : "",
  );
  const [totalCost, setTotalCost] = useState<string>(
    initialOrder?.totalCost != null ? formatCents(initialOrder.totalCost) : "",
  );

  const [items, setItems] = useState<ItemRow[]>(() => {
    if (initialOrder?.items && initialOrder.items.length > 0) {
      return [...initialOrder.items]
        .sort((a, b) => a.position - b.position)
        .map((item) => ({
          rowId: `row-${item.id}`,
          id: item.id,
          name: item.name,
          quantity: String(item.quantity),
          unitPrice: item.unitPrice != null ? formatCents(item.unitPrice) : "",
          productTypeKey: item.productTypeKey ?? "",
        }));
    }
    return [createEmptyRow(`${rowIdPrefix}initial`)];
  });

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

  const [itemErrors, setItemErrors] = useState<
    Record<string, { name?: string; quantity?: string; unitPrice?: string }>
  >({});
  const [clientTotalCostError, setClientTotalCostError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const [state, formAction, isPending] = useActionState(action, null);

  const showExchangeRate = baseCurrencyCode !== null && currencyCode !== "" && currencyCode !== baseCurrencyCode;

  const currencyOptions = useMemo(() => ALLOWED_COLLECTOR_BASE_CURRENCY_CODES as string[], []);

  const currencyListOptions = useMemo(
    () =>
      currencyOptions.map((code) => ({
        code,
        label: `${code} - ${tCurrencies(code as never)}`,
      })),
    [currencyOptions, tCurrencies],
  );

  const storeOptions = useMemo(() => stores, [stores]);

  const markDirty = useCallback(() => setIsDirty(true), []);

  useEffect(() => {
    if (mode === "edit" && isDirty) {
      const handler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
      };
      window.addEventListener("beforeunload", handler);
      return () => window.removeEventListener("beforeunload", handler);
    }
  }, [mode, isDirty]);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      router.push(`/${locale}${ROUTES.orders}/${state.orderId}`);
    }
  }, [state, locale, router]);

  const handleStoreCreate = useCallback(
    (prefillName?: string) => {
      const params = new URLSearchParams({ [AUTH_RETURN_TO_PARAM]: RETURN_TO_ORDER_CREATE });
      if (prefillName) params.set("name", prefillName);
      router.push(`/${locale}${ROUTES.storesNew}?${params.toString()}`);
    },
    [locale, router],
  );

  const handleCalculateTotal = useCallback(() => {
    const pricedItems = items
      .filter((r) => r.unitPrice !== "")
      .map((r) => ({
        quantity: parseInt(r.quantity, 10) || 0,
        unitPrice: parseCentsFromDecimal(r.unitPrice) ?? 0,
      }));
    const cents = deriveItemizedTotal(pricedItems);
    if (cents === null) return;
    setTotalCost(formatCents(cents));
    markDirty();
  }, [items, markDirty]);

  const hasAnyPricedItem = useMemo(() => items.some((r) => r.unitPrice !== ""), [items]);
  const hasAnyMultiQuantityItem = useMemo(() => items.some((r) => parseInt(r.quantity, 10) > 1), [items]);

  const validateItems = useCallback((): boolean => {
    const errors: Record<string, { name?: string; quantity?: string; unitPrice?: string }> = {};
    let valid = true;
    for (const row of items) {
      const rowErrors: { name?: string; quantity?: string; unitPrice?: string } = {};
      if (!row.name.trim()) {
        rowErrors.name = t("validation.itemNameRequired");
        valid = false;
      }
      const qty = parseInt(row.quantity, 10);
      if (isNaN(qty) || qty < 1) {
        rowErrors.quantity = t("validation.itemQuantityTooLow");
        valid = false;
      }
      if (row.unitPrice !== "" && !isValidPositiveDecimal(row.unitPrice)) {
        rowErrors.unitPrice = t("validation.unitPriceInvalid");
        valid = false;
      }
      if (Object.keys(rowErrors).length > 0) errors[row.rowId] = rowErrors;
    }
    setItemErrors(errors);
    return valid;
  }, [items, t]);

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
      if (storeId) fd.set("storeId", storeId);
      if (orderDate) fd.set("orderDate", orderDate.toISOString().split("T")[0]);
      if (deliveryFrom) fd.set("expectedDeliveryFrom", deliveryFrom.toISOString().split("T")[0]);
      if (deliveryTo) fd.set("expectedDeliveryTo", deliveryTo.toISOString().split("T")[0]);
      fd.set("currencyCode", currencyCode);
      if (showExchangeRate) fd.set("exchangeRate", exchangeRate);
      fd.set("totalCost", totalCost);
      return fd;
    },
    [items, storeId, orderDate, deliveryFrom, deliveryTo, currencyCode, exchangeRate, totalCost, showExchangeRate],
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!validateItems()) return;
      if (items.length === 0) return;

      if (!totalCost.trim()) {
        setClientTotalCostError(t("validation.totalCostRequired"));
        return;
      }
      if (!isValidPositiveDecimal(totalCost)) {
        setClientTotalCostError(t("validation.totalCostInvalid"));
        return;
      }
      setClientTotalCostError(null);

      const fd = buildFormData(event.currentTarget);

      const pricedItems = items
        .filter((r) => r.unitPrice !== "")
        .map((r) => ({
          quantity: parseInt(r.quantity, 10) || 0,
          unitPrice: parseCentsFromDecimal(r.unitPrice),
        }));

      const allPriced = items.every((r) => r.unitPrice !== "");
      const enteredCents = parseCentsFromDecimal(totalCost) ?? 0;

      if (allPriced && pricedItems.length > 0) {
        const calculatedCents = deriveItemizedTotal(pricedItems as { quantity: number; unitPrice: number }[]);
        if (
          calculatedCents !== null &&
          shouldShowDiscrepancyModal(pricedItems as { quantity: number; unitPrice: number | null }[], enteredCents)
        ) {
          posthog.capture(POSTHOG_EVENTS.ORDER.DISCREPANCY_MODAL_OPENED);
          setDiscrepancyState({
            show: true,
            enteredCents,
            calculatedCents,
            pendingFormData: fd,
          });
          return;
        }
      }

      startTransition(() => formAction(fd));
    },
    [validateItems, items, buildFormData, totalCost, formAction, t],
  );

  const handleDiscrepancyKeepEntered = useCallback(() => {
    posthog.capture(POSTHOG_EVENTS.ORDER.DISCREPANCY_RESOLVED, { resolution: "kept_entered" });
    const fd = discrepancyState.pendingFormData;
    setDiscrepancyState({ show: false, enteredCents: 0, calculatedCents: 0, pendingFormData: null });
    if (fd) startTransition(() => formAction(fd));
  }, [discrepancyState.pendingFormData, formAction]);

  const handleDiscrepancyUseCalculated = useCallback(() => {
    posthog.capture(POSTHOG_EVENTS.ORDER.DISCREPANCY_RESOLVED, { resolution: "used_calculated" });
    const fd = discrepancyState.pendingFormData;
    const calculatedDecimal = formatCents(discrepancyState.calculatedCents);
    setTotalCost(calculatedDecimal);
    setDiscrepancyState({ show: false, enteredCents: 0, calculatedCents: 0, pendingFormData: null });
    if (fd) {
      fd.set("totalCost", calculatedDecimal);
      startTransition(() => formAction(fd));
    }
  }, [discrepancyState, formAction]);

  const handleDiscrepancyGoBack = useCallback(() => {
    posthog.capture(POSTHOG_EVENTS.ORDER.DISCREPANCY_RESOLVED, { resolution: "cancelled" });
    setDiscrepancyState({ show: false, enteredCents: 0, calculatedCents: 0, pendingFormData: null });
  }, []);

  const handleBack = useCallback(
    (href: string) => {
      if (mode === "edit" && isDirty) {
        setDiscardState({ show: true, pendingHref: href });
      } else {
        router.push(href);
      }
    },
    [mode, isDirty, router],
  );

  const backHref = mode === "create" ? `/${locale}${ROUTES.orders}` : `/${locale}${ROUTES.orders}/${initialOrder?.id}`;

  const serverError = state?.success === false && "error" in state && state.error !== "validation" ? state.error : null;

  const fieldErrors = state?.success === false && "fieldErrors" in state ? (state.fieldErrors ?? {}) : {};

  return (
    <div className={cn(APP_SHELL_FORM_RAIL_CLASSNAME, "space-y-6")}>
      <div className="space-y-3">
        <BackNavLink
          href={backHref}
          onClick={(e) => {
            e.preventDefault();
            handleBack(backHref);
          }}
        >
          {mode === "create" ? tMode("backToList") : tMode("backToOrder")}
        </BackNavLink>
        <AppPageHero
          eyebrowIcon={ClipboardList}
          title={
            mode === "edit" && initialOrder
              ? tMode("title", { humanReadableId: initialOrder.humanReadableId })
              : tMode("title")
          }
          description={tMode("heroDescription")}
        />
        {baseCurrencyCode === null && (
          <div className="bg-info/12 border-info/35 flex items-start gap-3 rounded-xl border p-4">
            <Info size={16} className="text-info mt-0.5 shrink-0 sm:mt-1" aria-hidden />
            <Typography size="sm" className="text-text-body">
              {tForm("baseCurrencyBannerText")}{" "}
              <Link
                href={`/${locale}${ROUTES.settings}?${AUTH_RETURN_TO_PARAM}=${RETURN_TO_ORDER_CREATE}`}
                className="text-primary font-medium hover:underline"
              >
                {tForm("baseCurrencyBannerCta")}
              </Link>
            </Typography>
          </div>
        )}
      </div>

      {serverError && (
        <Typography size="sm" className="text-destructive" role="alert">
          {t.has(`error.${serverError}` as never) ? t(`error.${serverError}` as never) : t("error.server_error")}
        </Typography>
      )}

      <form ref={formRef} className="space-y-6" onSubmit={handleSubmit}>
        <section className={cn(COLLECTOR_FORM_SECTION_CLASSNAME, "space-y-4")} aria-labelledby="order-details-title">
          <SectionTitleWithAccent id="order-details-title" as="h2" icon={ClipboardList} iconClassName="text-primary">
            {tForm("detailsSectionTitle")}
          </SectionTitleWithAccent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="order-store">{tForm("storeLabel")}</Label>
              <OrderStoreSelect
                id="order-store"
                stores={storeOptions}
                value={storeId}
                onChange={(next) => {
                  setStoreId(next);
                  const derivedCurrency = resolveStoreCurrency(next);
                  if (derivedCurrency) {
                    setCurrencyCode(derivedCurrency);
                  }
                  markDirty();
                }}
                placeholder={tForm("storePlaceholder")}
                clearLabel={tForm("storeClearLabel")}
                noResultsLabel={tForm("storeNoResults")}
                createLabel={tForm("storeCreateOption")}
                createWithNameLabel={(name) => tForm("storeCreateWithName", { name })}
                onCreateStore={handleStoreCreate}
                error={!!fieldErrors.storeId?.length}
              />
              {fieldErrors.storeId?.[0] && (
                <Typography size="xs" className="text-destructive mt-1" role="alert">
                  {t("validation.storeRequired")}
                </Typography>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="order-currency" spacing="tight" className="mb-0">
                  {tForm("currencyLabel")}
                </Label>
                <Tooltip
                  content={tForm("currencyStoreHint")}
                  side="top"
                  alignSelfInFlexRow="center"
                  triggerClassName="text-text-muted hover:text-foreground -m-0.5 rounded p-0.5"
                >
                  <span className="inline-flex items-center">
                    <span className="sr-only">{tForm("currencyHintAriaLabel")}</span>
                    <Info className="size-4 shrink-0" aria-hidden />
                  </span>
                </Tooltip>
              </div>
              <OrderCurrencySelect
                id="order-currency"
                options={currencyListOptions}
                value={currencyCode}
                onChange={(next) => {
                  setCurrencyCode(next);
                  markDirty();
                }}
                placeholder={tForm("currencyPlaceholder")}
                clearLabel={tForm("currencyClearLabel")}
                noResultsLabel={tForm("storeNoResults")}
                error={!!fieldErrors.currencyCode?.length}
                aria-invalid={!!fieldErrors.currencyCode?.length}
                aria-required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="order-date">{tForm("orderDateLabel")}</Label>
              <DatePickerInput
                id="order-date"
                value={orderDate}
                onChange={(d) => {
                  setOrderDate(d);
                  markDirty();
                }}
                placeholder={tForm("orderDatePlaceholder")}
                locale={locale}
                error={!!fieldErrors.orderDate?.length}
                disableFuture
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="delivery-range">{tForm("deliveryRangeLabel")}</Label>
              <DateRangePickerInput
                id="delivery-range"
                from={deliveryFrom}
                to={deliveryTo}
                onChange={(from, to) => {
                  setDeliveryFrom(from);
                  setDeliveryTo(to);
                  markDirty();
                }}
                placeholder={tForm("deliveryRangePlaceholder")}
                clearLabel={tForm("deliveryRangeClearLabel")}
                locale={locale}
                error={!!fieldErrors.expectedDeliveryTo?.length}
              />
              {fieldErrors.expectedDeliveryTo?.[0] && (
                <Typography size="xs" className="text-destructive" role="alert">
                  {t("validation.deliveryToBeforeFrom")}
                </Typography>
              )}
            </div>
          </div>

          {showExchangeRate && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="order-exchange-rate" spacing="tight" className="mb-0">
                    {tForm("exchangeRateLabel")}
                  </Label>
                  <Tooltip
                    content={tForm("exchangeRateHint", {
                      from: currencyCode,
                      to: baseCurrencyCode!,
                    })}
                    side="top"
                    alignSelfInFlexRow="center"
                    triggerClassName="text-text-muted hover:text-foreground -m-0.5 rounded p-0.5"
                  >
                    <span className="inline-flex items-center">
                      <span className="sr-only">{tForm("exchangeRateHintAriaLabel")}</span>
                      <Info className="size-4 shrink-0" aria-hidden />
                    </span>
                  </Tooltip>
                </div>
                <Input
                  id="order-exchange-rate"
                  name="exchangeRate"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={exchangeRate}
                  placeholder={tForm("exchangeRatePlaceholder")}
                  error={!!fieldErrors.exchangeRate?.length}
                  aria-invalid={!!fieldErrors.exchangeRate?.length}
                  onChange={(e) => {
                    setExchangeRate(e.target.value);
                    markDirty();
                  }}
                />
                <Typography size="xs" className="text-text-muted">
                  {tForm("exchangeRateHelper", { from: currencyCode, to: baseCurrencyCode! })}
                </Typography>
              </div>
            </div>
          )}
        </section>

        <section className={cn(COLLECTOR_FORM_SECTION_CLASSNAME, "space-y-4")} aria-labelledby="order-items-title">
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <SectionTitleWithAccent id="order-items-title" as="h2" icon={ShoppingBag} iconClassName="text-highlight">
                {tForm("itemsSectionTitle")}
              </SectionTitleWithAccent>
              <OrderItemsShortcutsHelp />
              {hasAnyMultiQuantityItem && (
                <Tooltip
                  content={tForm("itemsSplitDeliveryHint")}
                  side="top"
                  alignSelfInFlexRow="center"
                  triggerClassName="text-text-muted hover:text-foreground -m-0.5 rounded p-0.5"
                >
                  <span className="inline-flex items-center">
                    <span className="sr-only">{tForm("itemsSplitDeliveryHintAriaLabel")}</span>
                    <Info className="size-4 shrink-0" aria-hidden />
                  </span>
                </Tooltip>
              )}
            </div>
            {items.length === 0 && fieldErrors.items?.length && (
              <Typography size="xs" className="text-destructive" role="alert">
                {t("validation.itemsRequired")}
              </Typography>
            )}
            <OrderItemsGrid
              rows={items}
              onChange={(next) => {
                setItems(next);
                markDirty();
              }}
              productTypeKeys={productTypeKeys}
              tProductTypes={(key) => tProductTypes(key as never)}
              itemErrors={itemErrors}
              createNewRow={() => createEmptyRow(nextRowId())}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="order-total">{tForm("totalCostLabel")}</Label>
              <div className="flex items-stretch gap-2">
                <Input
                  id="order-total"
                  name="totalCost"
                  type="text"
                  inputMode="decimal"
                  value={totalCost}
                  placeholder={tForm("totalCostPlaceholder")}
                  error={!!clientTotalCostError || !!fieldErrors.totalCost?.length}
                  aria-invalid={!!clientTotalCostError || !!fieldErrors.totalCost?.length}
                  onChange={(e) => {
                    setTotalCost(sanitizeDecimalInput(e.target.value));
                    setClientTotalCostError(null);
                    markDirty();
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCalculateTotal}
                  disabled={!hasAnyPricedItem}
                  aria-label={tForm("totalCostCalculateAriaLabel")}
                  className="shrink-0"
                >
                  <Calculator className="size-4" aria-hidden />
                  <span className="hidden sm:inline">{tForm("totalCostCalculateLabel")}</span>
                </Button>
              </div>
              {(clientTotalCostError ?? fieldErrors.totalCost?.[0]) && (
                <Typography size="xs" className="text-destructive" role="alert">
                  {clientTotalCostError ?? t("validation.totalCostRequired")}
                </Typography>
              )}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? tMode("submitting") : tMode("submit")}
          </Button>
          <BackNavLink
            appearance="button"
            href={backHref}
            onClick={(e) => {
              e.preventDefault();
              handleBack(backHref);
            }}
          >
            {mode === "create" ? tMode("backToList") : tMode("backToOrder")}
          </BackNavLink>
        </div>
      </form>

      {discrepancyState.show && (
        <DiscrepancyModal
          enteredTotal={discrepancyState.enteredCents}
          calculatedTotal={discrepancyState.calculatedCents}
          formatAmount={(cents) => formatAmountDisplay(cents, currencyCode)}
          onKeepEntered={handleDiscrepancyKeepEntered}
          onUseCalculated={handleDiscrepancyUseCalculated}
          onGoBack={handleDiscrepancyGoBack}
        />
      )}

      {discardState.show && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="discard-dialog-title"
          aria-describedby="discard-dialog-desc"
        >
          <div className="bg-background/70 absolute inset-0 backdrop-blur-sm" />
          <div className="border-border bg-background relative z-10 w-full max-w-sm rounded-xl border p-6 shadow-xl">
            <h2 id="discard-dialog-title" className="text-text-title mb-2 text-base font-semibold">
              {tEdit("discardTitle")}
            </h2>
            <Typography id="discard-dialog-desc" size="sm" className="text-text-body mb-6">
              {tEdit("discardMessage")}
            </Typography>
            <div className="flex gap-3">
              <Button
                variant="primary"
                type="button"
                onClick={() => {
                  posthog.capture(POSTHOG_EVENTS.ORDER.CREATE_DISCARDED);
                  router.push(discardState.pendingHref!);
                }}
              >
                {tEdit("discardConfirm")}
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={() => setDiscardState({ show: false, pendingHref: null })}
              >
                {tEdit("discardCancel")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

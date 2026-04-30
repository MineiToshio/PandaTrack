"use client";

import { type FormEvent, startTransition, useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { Info, MapPinned, RefreshCw, ShoppingBag, Truck, Wallet } from "lucide-react";
import AppPageHero from "@/components/modules/AppPageHero";
import BackNavLink from "@/components/core/BackNavLink";
import Button from "@/components/core/Button/Button";
import DatePickerInput from "@/components/core/DatePickerInput";
import DateRangePickerInput from "@/components/core/DateRangePickerInput";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import Select from "@/components/core/Select";
import Typography from "@/components/core/Typography";
import SectionTitleWithAccent from "@/components/modules/SectionTitleWithAccent";
import { ALLOWED_COLLECTOR_BASE_CURRENCY_CODES } from "@/lib/catalog/collectorCountries";
import { AUTH_RETURN_TO_PARAM } from "@/lib/auth/authRedirect";
import { APP_SHELL_FORM_RAIL_CLASSNAME, POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { sanitizeDecimalInput, isValidPositiveDecimal } from "@/lib/decimalInput";
import { COLLECTOR_FORM_SECTION_CLASSNAME, cn } from "@/lib/styles";
import type {
  EligibleProduct,
  EligibleProductsResult,
  EligibleStore,
  DeliverySourceOrder,
} from "@/lib/data/deliveries/deliveryQueries";
import type { DeliveryCreateActionResult } from "../_actions/createDeliveryAction";

type ProductsByStore = Record<string, EligibleProductsResult>;

type DeliveryCreateFormProps = {
  action: (prev: DeliveryCreateActionResult | null, formData: FormData) => Promise<DeliveryCreateActionResult>;
  stores: EligibleStore[];
  productsByStore: ProductsByStore;
  baseCurrencyCode: string | null;
  sourceOrder: DeliverySourceOrder | null;
};

function formatDateInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

function isValidNonNegativeDecimal(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value);
}

function getProductsForOrder(result: EligibleProductsResult | undefined, orderId: string): EligibleProduct[] {
  return result?.byOrder.find((group) => group.orderId === orderId)?.products ?? [];
}

export default function DeliveryCreateForm({
  action,
  stores,
  productsByStore,
  baseCurrencyCode,
  sourceOrder,
}: DeliveryCreateFormProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("deliveries");
  const tCurrencies = useTranslations("orders.currencies");

  const entryPoint = sourceOrder ? "from_order" : "standalone";
  const [storeId, setStoreId] = useState(sourceOrder?.storeId ?? stores[0]?.storeId ?? "");
  const [deliveryDate, setDeliveryDate] = useState<Date | null>(new Date());
  const [expectedArrivalFrom, setExpectedArrivalFrom] = useState<Date | null>(null);
  const [expectedArrivalTo, setExpectedArrivalTo] = useState<Date | null>(null);
  const [cost, setCost] = useState("0.00");
  const [currencyCode, setCurrencyCode] = useState(baseCurrencyCode ?? "");
  const [exchangeRate, setExchangeRate] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(() =>
    sourceOrder
      ? getProductsForOrder(productsByStore[sourceOrder.storeId], sourceOrder.orderId).map((p) => p.orderItemId)
      : [],
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const [state, formAction, isPending] = useActionState(action, null);

  const selectedStoreProducts = productsByStore[storeId];
  const selectedStore = stores.find((store) => store.storeId === storeId) ?? null;
  const showExchangeRate = Boolean(baseCurrencyCode && currencyCode && currencyCode !== baseCurrencyCode);
  const currencyOptions = useMemo(() => ALLOWED_COLLECTOR_BASE_CURRENCY_CODES as readonly string[], []);
  const fieldErrors = state?.success === false && state.fieldErrors ? state.fieldErrors : {};
  const serverError = state?.success === false && state.error !== "validation" ? state.error : null;

  useEffect(() => {
    posthog.capture(POSTHOG_EVENTS.DELIVERY.CREATE_FLOW_OPENED, {
      entry_point: entryPoint,
      source_order_id: sourceOrder?.orderId,
    });
  }, [entryPoint, sourceOrder?.orderId]);

  useEffect(() => {
    if (state?.success) {
      router.push(`/${locale}${ROUTES.deliveries}/${state.deliveryId}`);
    }
  }, [locale, router, state]);

  function handleStoreChange(nextStoreId: string) {
    setStoreId(nextStoreId);
    setSelectedProductIds([]);
    setClientError(null);
  }

  function handleProductToggle(productId: string) {
    setSelectedProductIds((current) =>
      current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId],
    );
    setClientError(null);
  }

  function handleOrderToggle(productIds: string[]) {
    setSelectedProductIds((current) => {
      const allSelected = productIds.every((id) => current.includes(id));
      if (allSelected) return current.filter((id) => !productIds.includes(id));
      return [...new Set([...current, ...productIds])];
    });
    setClientError(null);
  }

  function buildFormData(form: HTMLFormElement): FormData {
    const formData = new FormData(form);
    formData.set("storeId", storeId);
    if (deliveryDate) formData.set("deliveryDate", formatDateInput(deliveryDate));
    if (expectedArrivalFrom) formData.set("expectedArrivalFrom", formatDateInput(expectedArrivalFrom));
    if (expectedArrivalTo) formData.set("expectedArrivalTo", formatDateInput(expectedArrivalTo));
    formData.set("cost", cost);
    formData.set("currencyCode", currencyCode);
    if (showExchangeRate) formData.set("exchangeRate", exchangeRate);
    formData.set("carrier", carrier);
    formData.set("trackingNumber", trackingNumber);
    formData.set("productIds", JSON.stringify(selectedProductIds));
    formData.set("entryPoint", entryPoint);
    if (sourceOrder) formData.set("sourceOrderId", sourceOrder.orderId);
    return formData;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storeId) {
      setClientError(t("validation.storeRequired"));
      return;
    }
    if (selectedProductIds.length === 0) {
      setClientError(t("validation.productsRequired"));
      return;
    }
    if (!cost.trim() || !isValidNonNegativeDecimal(cost)) {
      setClientError(t("validation.costInvalid"));
      return;
    }
    if (!currencyCode) {
      setClientError(t("validation.currencyRequired"));
      return;
    }
    if (showExchangeRate && !isValidPositiveDecimal(exchangeRate)) {
      setClientError(t("validation.exchangeRateRequired"));
      return;
    }
    setClientError(null);
    const formData = buildFormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const backHref = sourceOrder ? `/${locale}${ROUTES.orders}/${sourceOrder.orderId}` : `/${locale}${ROUTES.deliveries}`;

  return (
    <div className={cn(APP_SHELL_FORM_RAIL_CLASSNAME, "space-y-6")}>
      <div className="space-y-3">
        <BackNavLink href={backHref}>
          {sourceOrder ? t("create.backToOrder") : t("create.backToDeliveries")}
        </BackNavLink>
        <AppPageHero
          eyebrow={t("create.heroEyebrow")}
          title={t("create.title")}
          description={
            sourceOrder
              ? t("create.heroDescriptionFromOrder", { orderId: sourceOrder.orderHumanReadableId })
              : t("create.heroDescriptionStandalone")
          }
        />
      </div>

      {baseCurrencyCode === null && (
        <div className="bg-info/12 border-info/35 flex items-start gap-3 rounded-xl border p-4">
          <Info size={16} className="text-info mt-0.5 shrink-0 sm:mt-1" aria-hidden />
          <Typography size="sm" className="text-text-body">
            {t("create.baseCurrencyBanner")}{" "}
            <Link
              href={`/${locale}${ROUTES.settings}?${AUTH_RETURN_TO_PARAM}=delivery-create`}
              className="text-primary font-medium hover:underline"
            >
              {t("create.baseCurrencyCta")}
            </Link>
          </Typography>
        </div>
      )}

      {serverError && (
        <Typography size="sm" className="text-destructive" role="alert">
          {t.has(`error.${serverError}` as never) ? t(`error.${serverError}` as never) : t("error.server_error")}
        </Typography>
      )}

      {clientError && (
        <Typography size="sm" className="text-destructive" role="alert">
          {clientError}
        </Typography>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <section className={cn(COLLECTOR_FORM_SECTION_CLASSNAME, "space-y-4")} aria-labelledby="delivery-basics-title">
          <SectionTitleWithAccent id="delivery-basics-title" as="h2" icon={Truck} iconClassName="text-primary">
            {t("create.basicsSectionTitle")}
          </SectionTitleWithAccent>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="delivery-store">{t("form.storeLabel")}</Label>
              {sourceOrder ? (
                <Input id="delivery-store" value={sourceOrder.storeName} readOnly aria-readonly />
              ) : (
                <Select
                  id="delivery-store"
                  value={storeId}
                  onChange={(event) => handleStoreChange(event.target.value)}
                  error={!!fieldErrors.storeId?.length}
                  aria-invalid={!!fieldErrors.storeId?.length}
                  required
                  showChevron
                >
                  <option value="">{t("form.storePlaceholder")}</option>
                  {stores.map((store) => (
                    <option key={store.storeId} value={store.storeId}>
                      {store.storeName}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="delivery-date">{t("form.deliveryDateLabel")}</Label>
              <DatePickerInput
                id="delivery-date"
                value={deliveryDate}
                onChange={setDeliveryDate}
                placeholder={t("form.deliveryDatePlaceholder")}
                locale={locale}
                error={!!fieldErrors.deliveryDate?.length}
                disableFuture
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expected-arrival-range">{t("form.expectedArrivalLabel")}</Label>
            <DateRangePickerInput
              id="expected-arrival-range"
              from={expectedArrivalFrom}
              to={expectedArrivalTo}
              onChange={(from, to) => {
                setExpectedArrivalFrom(from);
                setExpectedArrivalTo(to);
              }}
              placeholder={t("form.expectedArrivalPlaceholder")}
              clearLabel={t("form.expectedArrivalClearLabel")}
              locale={locale}
              error={!!fieldErrors.expectedArrivalTo?.length}
            />
            {fieldErrors.expectedArrivalTo?.[0] && (
              <Typography size="xs" className="text-destructive" role="alert">
                {t("validation.arrivalToBeforeFrom")}
              </Typography>
            )}
          </div>
        </section>

        <section
          className={cn(COLLECTOR_FORM_SECTION_CLASSNAME, "space-y-4")}
          aria-labelledby="delivery-products-title"
        >
          <SectionTitleWithAccent
            id="delivery-products-title"
            as="h2"
            icon={ShoppingBag}
            iconClassName="text-highlight"
          >
            {t("create.productsSectionTitle")}
          </SectionTitleWithAccent>

          {!storeId ? (
            <Typography size="sm" className="text-text-muted">
              {t("create.selectStoreFirst")}
            </Typography>
          ) : selectedStoreProducts?.byOrder.length ? (
            <div className="space-y-6">
              {selectedStoreProducts.byOrder.map((group) => {
                const productIds = group.products.map((product) => product.orderItemId);
                const allSelected = productIds.every((id) => selectedProductIds.includes(id));
                return (
                  <div key={group.orderId} className="space-y-2">
                    <div className="border-border/50 flex flex-wrap items-center justify-between gap-3 border-b pb-2">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <Typography size="sm" className="text-text-title font-semibold">
                          {group.orderHumanReadableId}
                        </Typography>
                        <Typography size="xs" className="text-text-muted">
                          {group.orderDate.toLocaleDateString(locale, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </Typography>
                      </div>
                      <button
                        type="button"
                        className="text-primary hover:text-link-hover text-sm font-medium"
                        onClick={() => handleOrderToggle(productIds)}
                      >
                        {allSelected ? t("form.unselectOrder") : t("form.selectOrder")}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                      {group.products.map((product) => (
                        <label
                          key={product.orderItemId}
                          className="hover:bg-muted/40 flex items-start gap-3 rounded-md px-2 py-2 transition-colors"
                        >
                          <input
                            type="checkbox"
                            className="accent-primary mt-1 size-4"
                            checked={selectedProductIds.includes(product.orderItemId)}
                            onChange={() => handleProductToggle(product.orderItemId)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="text-text-body block text-sm font-medium">{product.orderItemName}</span>
                            <span className="text-text-muted block text-xs">
                              {t("form.productQuantity", { quantity: product.quantity })}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-info/10 border-info/25 flex items-start gap-3 rounded-xl border p-4">
              <RefreshCw className="text-info mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="space-y-2">
                <Typography size="sm" className="text-text-body">
                  {t("create.noProductsForStore", { storeName: selectedStore?.storeName ?? t("create.thisStore") })}
                </Typography>
                <Link
                  href={`/${locale}${ROUTES.deliveriesNew}`}
                  className="text-primary text-sm font-medium hover:underline"
                >
                  {t("create.refreshLink")}
                </Link>
              </div>
            </div>
          )}
        </section>

        <section className={cn(COLLECTOR_FORM_SECTION_CLASSNAME, "space-y-4")} aria-labelledby="delivery-cost-title">
          <SectionTitleWithAccent id="delivery-cost-title" as="h2" icon={Wallet} iconClassName="text-success">
            {t("create.costSectionTitle")}
          </SectionTitleWithAccent>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="delivery-cost">{t("form.costLabel")}</Label>
              <Input
                id="delivery-cost"
                name="cost"
                type="text"
                inputMode="decimal"
                value={cost}
                placeholder={t("form.costPlaceholder")}
                error={!!fieldErrors.cost?.length}
                aria-invalid={!!fieldErrors.cost?.length}
                onChange={(event) => setCost(sanitizeDecimalInput(event.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="delivery-currency">{t("form.currencyLabel")}</Label>
              <Select
                id="delivery-currency"
                value={currencyCode}
                onChange={(event) => setCurrencyCode(event.target.value)}
                error={!!fieldErrors.currencyCode?.length}
                aria-invalid={!!fieldErrors.currencyCode?.length}
                required
                showChevron
              >
                <option value="">{t("form.currencyPlaceholder")}</option>
                {currencyOptions.map((code) => (
                  <option key={code} value={code}>
                    {code} - {tCurrencies(code as never)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {showExchangeRate && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="delivery-exchange-rate">{t("form.exchangeRateLabel")}</Label>
                <Input
                  id="delivery-exchange-rate"
                  name="exchangeRate"
                  type="text"
                  inputMode="decimal"
                  value={exchangeRate}
                  placeholder={t("form.exchangeRatePlaceholder")}
                  error={!!fieldErrors.exchangeRate?.length}
                  aria-invalid={!!fieldErrors.exchangeRate?.length}
                  onChange={(event) => setExchangeRate(sanitizeDecimalInput(event.target.value))}
                />
                <Typography size="xs" className="text-text-muted">
                  {t("form.exchangeRateHelper", { from: currencyCode, to: baseCurrencyCode ?? "" })}
                </Typography>
              </div>
            </div>
          )}
        </section>

        <section
          className={cn(COLLECTOR_FORM_SECTION_CLASSNAME, "space-y-4")}
          aria-labelledby="delivery-tracking-title"
        >
          <SectionTitleWithAccent id="delivery-tracking-title" as="h2" icon={MapPinned} iconClassName="text-info">
            {t("create.trackingSectionTitle")}
          </SectionTitleWithAccent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="delivery-carrier">{t("form.carrierLabel")}</Label>
              <Input
                id="delivery-carrier"
                name="carrier"
                value={carrier}
                placeholder={t("form.carrierPlaceholder")}
                onChange={(event) => setCarrier(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delivery-tracking">{t("form.trackingLabel")}</Label>
              <Input
                id="delivery-tracking"
                name="trackingNumber"
                value={trackingNumber}
                placeholder={t("form.trackingPlaceholder")}
                onChange={(event) => setTrackingNumber(event.target.value)}
              />
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Button variant="primary" size="md" type="submit" disabled={isPending}>
            {isPending ? t("create.submitting") : t("create.submit")}
          </Button>
          <BackNavLink appearance="button" href={backHref}>
            {sourceOrder ? t("create.backToOrder") : t("create.backToDeliveries")}
          </BackNavLink>
        </div>
      </form>
    </div>
  );
}

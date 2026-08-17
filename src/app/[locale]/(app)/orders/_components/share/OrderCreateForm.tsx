"use client";

import { Calculator, Check, ChevronDown, Image as ImageIcon, Info, Keyboard, Plus, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import WizardAccordion, { type WizardAccordionHandle } from "@/components/modules/WizardAccordion/WizardAccordion";
import WizardStep from "@/components/modules/WizardAccordion/WizardStep";
import Stepper, { type StepperStep } from "@/components/core/Stepper";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useStoreProductTypeName } from "@/app/[locale]/(app)/_components/StoreProductTypeNamesProvider";
import {
  ALLOWED_COLLECTOR_BASE_CURRENCY_CODES,
  PRIMARY_CURRENCY_BY_COUNTRY,
  isCollectorCountryCode,
} from "@/lib/catalog/collectorCountries";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { formatAmount, formatCentsForInput } from "@/lib/currency";
import { isValidPositiveDecimal, sanitizeDecimalInput } from "@/lib/decimalInput";
import { toLocalIsoDateString } from "@/lib/domainDate";
import { fetchTodayRate } from "@/lib/fx/exchangeRates";
import { deriveManualFormPrefill, readAndClearManualPrefillStash } from "@/lib/imageIntake/manualPrefillStash";
import { deriveItemizedTotal, shouldShowDiscrepancyModal } from "@/lib/orders/orderItemUtils";
import { cn, WIZARD_CONFIRM_PANEL_CLASSNAME } from "@/lib/styles";
import type { OrderActionResult } from "../../_actions/orderActions";
import DiscrepancyModal from "./DiscrepancyModal";
import FxRateAttribution from "./FxRateAttribution";
import OrderCurrencyField from "./OrderCurrencyField";
import OrderDeliveryRangeField from "./OrderDeliveryRangeField";
import OrderItemsGrid, { type ItemRow, createEmptyRow } from "./OrderItemsGrid";
import OrderItemsMobileList from "./OrderItemsMobileList";
import OrderStoreField, { type OrderStoreOption } from "./OrderStoreField";
import OrderCreateSummarySidebar from "./OrderCreateSummarySidebar";

type Props = {
  stores: OrderStoreOption[];
  productTypeKeys: string[];
  baseCurrencyCode: string | null;
  action: (prev: OrderActionResult | null, formData: FormData) => Promise<OrderActionResult>;
};

function parseCentsFromDecimal(value: string): number | null {
  const n = parseFloat(value);
  if (isNaN(n)) return null;
  return Math.round(n * 100);
}

function resolveStoreCurrency(stores: OrderStoreOption[], id: string | null): string | null {
  if (!id) return null;
  const store = stores.find((s) => s.id === id);
  if (!store) return null;
  const upper = store.countryCode.toUpperCase();
  if (!isCollectorCountryCode(upper)) return null;
  return PRIMARY_CURRENCY_BY_COUNTRY[upper] ?? null;
}

export default function OrderCreateForm({ stores, productTypeKeys, baseCurrencyCode, action }: Props) {
  const t = useTranslations("orders");
  const tCreate = useTranslations("orders.create");
  const tForm = useTranslations("orders.form");
  const tCurrencies = useTranslations("orders.currencies");
  const tImageIntake = useTranslations("imageIntake");
  const productTypeName = useStoreProductTypeName();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  const initialStoreId = searchParams.get("store") ?? null;

  const rowIdPrefix = useId();
  const addedRowCounterRef = useRef(0);
  const nextRowId = useCallback(() => {
    addedRowCounterRef.current += 1;
    return `${rowIdPrefix}added-${addedRowCounterRef.current}`;
  }, [rowIdPrefix]);

  const [storeId, setStoreId] = useState<string | null>(initialStoreId);
  const [orderDate, setOrderDate] = useState<Date | null>(new Date());
  const [deliveryFrom, setDeliveryFrom] = useState<Date | null>(null);
  const [deliveryTo, setDeliveryTo] = useState<Date | null>(null);
  const [currencyCode, setCurrencyCode] = useState<string>(() => {
    const derived = resolveStoreCurrency(stores, initialStoreId);
    return derived ?? baseCurrencyCode ?? "";
  });
  const [exchangeRate, setExchangeRate] = useState<string>("");
  const [totalCost, setTotalCost] = useState<string>("");
  const [items, setItems] = useState<ItemRow[]>(() => [createEmptyRow(`${rowIdPrefix}initial`)]);

  const [itemErrors, setItemErrors] = useState<
    Record<string, { name?: string; quantity?: string; unitPrice?: string }>
  >({});
  const [clientTotalCostError, setClientTotalCostError] = useState<string | null>(null);
  // Step 1 field-level errors — populated on a failed "Continuar", cleared on edit.
  const [storeError, setStoreError] = useState<string | null>(null);
  const [currencyError, setCurrencyError] = useState<string | null>(null);
  const [orderDateError, setOrderDateError] = useState<string | null>(null);

  // "¿Pagaste algo hoy?" — collapsed by default; becomes the order's `initialPayment`, a store
  // payment declared entirely against the new order in the same write that creates it.
  const [showInitialPayment, setShowInitialPayment] = useState(false);
  const [initialPaymentAmount, setInitialPaymentAmount] = useState("");
  const [initialPaymentDate, setInitialPaymentDate] = useState<Date | null>(null);
  const [initialPaymentError, setInitialPaymentError] = useState<string | null>(null);

  const wizardRef = useRef<WizardAccordionHandle>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [doneSteps, setDoneSteps] = useState<number[]>([]);
  const [erroredSteps, setErroredSteps] = useState<number[]>([]);

  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState<string | null>(null);

  const [discrepancyState, setDiscrepancyState] = useState<{
    show: boolean;
    enteredCents: number;
    calculatedCents: number;
    pendingFormData: FormData | null;
  }>({ show: false, enteredCents: 0, calculatedCents: 0, pendingFormData: null });

  const [state, formAction, isPending] = useActionState(action, null);

  // Redirect to detail on success with view-transition.
  useEffect(() => {
    if (state?.success) {
      router.push(`/${locale}${ROUTES.orders}/${state.orderId}`);
    }
  }, [state, locale, router]);

  // One-time hand-off from the intake review screen's "complete by hand" exit. A collector who
  // gets here that way already spent photos and a real extraction on this draft, so the form
  // opens seeded with it instead of blank. Reads and clears the stash on mount only — never on a
  // later re-render — so a second visit to this same form (back button, a bookmark) always opens
  // clean, exactly like every other arrival at this page. Absent or invalid stash content (nothing
  // there, an expired entry, a shape that fails the draft schema) leaves every field exactly as it
  // starts today, which is the overwhelming majority of visits to this form.
  /* eslint-disable react-hooks/set-state-in-effect -- intentional client-only hydration from a
     sessionStorage hand-off (mirrors useSidebarState's localStorage hydration): the read can only
     happen post-mount, and every setter below is guarded to run once, not on a later re-render. */
  useEffect(() => {
    const prefillDraft = readAndClearManualPrefillStash();
    if (!prefillDraft) return;

    const prefill = deriveManualFormPrefill(
      prefillDraft,
      stores.map((store) => store.id),
    );
    // The draft's own currency, not the form's current default, prices the amounts below: it is
    // what the chat actually stated (or the extraction assumed), and using anything else would
    // format a number under the wrong code.
    const prefillCurrencyCode = prefill.currencyCode ?? currencyCode;

    if (prefill.storeId) setStoreId(prefill.storeId);
    if (prefill.currencyCode) setCurrencyCode(prefill.currencyCode);
    if (prefill.orderDateIso) {
      const parsedOrderDate = new Date(`${prefill.orderDateIso}T00:00:00.000Z`);
      if (!Number.isNaN(parsedOrderDate.getTime())) setOrderDate(parsedOrderDate);
    }
    if (prefill.totalCostMinorUnits !== null) {
      setTotalCost(formatCentsForInput(prefill.totalCostMinorUnits, prefillCurrencyCode));
    }
    if (prefill.items.length > 0) {
      setItems(
        prefill.items.map((item) => ({
          rowId: nextRowId(),
          name: item.name,
          quantity: "1",
          unitPrice:
            item.unitPriceMinorUnits !== null ? formatCentsForInput(item.unitPriceMinorUnits, prefillCurrencyCode) : "",
          productTypeKey: item.productTypeKey ?? "",
        })),
      );
    }
    // Deliberately mount-only: this consumes a one-time hand-off, not a response to any of these
    // values (or `stores`) changing afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Step 2 entry — focus the first product name input so the user immediately
  // sees the spreadsheet cell is editable. WizardStep's generic autofocus picks
  // the first focusable, which on the spreadsheet is the drag handle button
  // (semantic but invisible). We override with the canonical "first editable
  // field" target. Skips on mobile (uses OrderItemsMobileList, no inline grid).
  useEffect(() => {
    if (activeStep !== 2 || isMobile) return;
    const firstRow = items[0];
    if (!firstRow) return;
    const id = `item-name-${firstRow.rowId}`;
    // Two RAFs — one for the WizardStep autofocus to land first, another for us
    // to take over without racing the browser layout.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(id) as HTMLInputElement | null;
        el?.focus({ preventScroll: false });
        try {
          el?.select();
        } catch {
          // number/date inputs throw on `.select()` in some browsers — safe to ignore.
        }
      });
    });
    // We only want this on step transition into 2, not on every items mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, isMobile]);

  const showExchangeRate = baseCurrencyCode !== null && currencyCode !== "" && currencyCode !== baseCurrencyCode;

  const currencyListOptions = useMemo(
    () =>
      (ALLOWED_COLLECTOR_BASE_CURRENCY_CODES as readonly string[]).map((code) => ({
        code,
        label: `${code} · ${tCurrencies(code as never)}`,
      })),
    [tCurrencies],
  );

  const selectedStore = useMemo(() => stores.find((s) => s.id === storeId) ?? null, [stores, storeId]);

  // Items-derived calculations
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

  // Validation per step. `validateStep1` is the gate validator: it sets inline
  // field errors AND returns the boolean. The "Continuar" button stays enabled
  // (PLAYBOOK §5.3) so a failed click surfaces the errors instead of a dead button.
  const validateStep1 = useCallback((): boolean => {
    const nextStoreError = storeId ? null : t("validation.storeRequired");
    const nextCurrencyError = currencyCode ? null : t("validation.currencyRequired");
    const nextDateError = orderDate ? null : t("validation.orderDateRequired");
    setStoreError(nextStoreError);
    setCurrencyError(nextCurrencyError);
    setOrderDateError(nextDateError);
    return !nextStoreError && !nextCurrencyError && !nextDateError;
  }, [storeId, currencyCode, orderDate, t]);

  const validateStep2Items = useCallback((): boolean => {
    const errors: Record<string, { name?: string; quantity?: string; unitPrice?: string }> = {};
    let valid = true;
    let hasAnyNamed = false;
    for (const row of items) {
      const rowErrors: { name?: string; quantity?: string; unitPrice?: string } = {};
      if (row.name.trim().length > 0) {
        hasAnyNamed = true;
      } else if (items.length === 1) {
        rowErrors.name = t("validation.itemNameRequired");
        valid = false;
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

  const validateStep2 = useCallback((): boolean => {
    let valid = validateStep2Items();
    if (!totalCost.trim()) {
      setClientTotalCostError(t("validation.totalCostRequired"));
      valid = false;
    } else if (!isValidPositiveDecimal(totalCost, currencyCode)) {
      setClientTotalCostError(t("validation.totalCostInvalid"));
      valid = false;
    } else {
      setClientTotalCostError(null);
    }
    return valid;
  }, [validateStep2Items, totalCost, currencyCode, t]);

  // Defaults to the order's own date until the collector picks a different one — mirrors the
  // "defaults from context, stays overridable" shape `receivedDate` uses in `QuickArrivalModal`.
  const initialPaymentDateValue = initialPaymentDate ?? orderDate;
  const enteredTotalCents = parseCentsFromDecimal(totalCost);
  const canMarkFullyPaid = enteredTotalCents !== null && enteredTotalCents > 0;

  const validateInitialPayment = useCallback((): boolean => {
    if (initialPaymentAmount.trim() === "") {
      setInitialPaymentError(null);
      return true;
    }
    if (!isValidPositiveDecimal(initialPaymentAmount, currencyCode)) {
      setInitialPaymentError(t("validation.initialPaymentInvalid"));
      return false;
    }
    const amountCents = parseCentsFromDecimal(initialPaymentAmount);
    const totalCents = parseCentsFromDecimal(totalCost);
    if (amountCents !== null && totalCents !== null && amountCents > totalCents) {
      setInitialPaymentError(t("validation.initialPaymentExceedsTotal"));
      return false;
    }
    setInitialPaymentError(null);
    return true;
  }, [currencyCode, initialPaymentAmount, t, totalCost]);

  const handleMarkFullyPaid = useCallback(() => {
    if (!canMarkFullyPaid) return;
    setShowInitialPayment(true);
    setInitialPaymentAmount(totalCost);
    setInitialPaymentError(null);
  }, [canMarkFullyPaid, totalCost]);

  const handleFocusAdvance = useCallback(() => {
    setShowInitialPayment(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById("order-initial-payment-amount") as HTMLInputElement | null;
        el?.focus();
      });
    });
  }, []);

  // Submit
  const formRef = useRef<HTMLFormElement>(null);
  const buildFormData = useCallback(
    (form: HTMLFormElement): FormData => {
      const fd = new FormData(form);
      const serializedItems = items
        .filter((row) => row.name.trim().length > 0)
        .map((row, index) => ({
          name: row.name,
          quantity: row.quantity,
          unitPrice: row.unitPrice || null,
          productTypeKey: row.productTypeKey || null,
          position: index + 1,
        }));
      fd.set("items", JSON.stringify(serializedItems));
      if (storeId) fd.set("storeId", storeId);
      // All four date fields below read the picker's LOCAL calendar day. `toISOString()` converts
      // to UTC first, which for any viewer EAST of UTC (Madrid, Tokyo) rolls local midnight back
      // into the previous day and silently saves it: "10 Aug" becomes "9 Aug". Lima is west of UTC,
      // so the wrong serializer happened to produce the right day here and the defect stayed latent.
      if (orderDate) fd.set("orderDate", toLocalIsoDateString(orderDate));
      if (deliveryFrom) fd.set("expectedDeliveryFrom", toLocalIsoDateString(deliveryFrom));
      if (deliveryTo) fd.set("expectedDeliveryTo", toLocalIsoDateString(deliveryTo));
      fd.set("currencyCode", currencyCode);
      if (showExchangeRate) fd.set("exchangeRate", exchangeRate);
      fd.set("totalCost", totalCost);
      if (initialPaymentAmount.trim() !== "" && initialPaymentDateValue) {
        fd.set("initialPaymentAmount", initialPaymentAmount);
        fd.set("initialPaymentDate", toLocalIsoDateString(initialPaymentDateValue));
      }
      return fd;
    },
    [
      items,
      storeId,
      orderDate,
      deliveryFrom,
      deliveryTo,
      currencyCode,
      exchangeRate,
      totalCost,
      initialPaymentAmount,
      initialPaymentDateValue,
      showExchangeRate,
    ],
  );

  const handleFinalSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!validateStep1() || !validateStep2() || !validateInitialPayment()) return;

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
          setDiscrepancyState({
            show: true,
            enteredCents,
            calculatedCents: calc,
            pendingFormData: fd,
          });
          return;
        }
      }
      startTransition(() => formAction(fd));
    },
    [validateStep1, validateStep2, validateInitialPayment, buildFormData, totalCost, items, pricedRows, formAction],
  );

  // ⌘/Ctrl+Enter submits from any step (mirrors the deliveries create wizard). Shift is
  // excluded so it never collides with the item grid's Ctrl+Shift+Enter "insert row".
  const handleFormKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLFormElement>) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key === "Enter") {
        if (isPending) return;
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    },
    [isPending],
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

  // Stepper steps
  const steps: StepperStep[] = useMemo(
    () => [
      { n: 1, label: tCreate("stepDatos") },
      { n: 2, label: tCreate("stepProductos") },
      { n: 3, label: tCreate("stepConfirmar") },
    ],
    [tCreate],
  );

  // Summary sidebar derived data
  const enteredCentsForSummary = parseCentsFromDecimal(totalCost);
  const summary = {
    storeName: selectedStore?.name ?? null,
    currencyCode: currencyCode || null,
    orderDate,
    deliveryFrom,
    deliveryTo,
    itemsCount: validItemsCount,
    totalLabel:
      enteredCentsForSummary != null && currencyCode ? formatAmount(enteredCentsForSummary, currencyCode) : null,
  };

  const step1Summary = useMemo(() => {
    if (!selectedStore || !currencyCode || !orderDate) return undefined;
    const dateLabel = orderDate.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
    return tCreate("summaryStep1", {
      store: selectedStore.name,
      currency: currencyCode,
      date: dateLabel,
    });
  }, [selectedStore, currencyCode, orderDate, locale, tCreate]);

  const step2Summary = useMemo(() => {
    if (validItemsCount === 0 || enteredCentsForSummary == null || !currencyCode) return undefined;
    return tCreate("summaryStep2", {
      count: validItemsCount,
      total: formatAmount(enteredCentsForSummary, currencyCode),
    });
  }, [validItemsCount, enteredCentsForSummary, currencyCode, tCreate]);

  const serverError = state?.success === false && "error" in state && state.error !== "validation" ? state.error : null;

  const ordersHref = `/${locale}${ROUTES.orders}`;
  const imageIntakeHref = `/${locale}${ROUTES.ordersNew}/image`;

  const orderDateForReview = orderDate
    ? orderDate.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })
    : "—";
  const deliveryReview =
    deliveryFrom || deliveryTo
      ? `${deliveryFrom ? deliveryFrom.toLocaleDateString(locale, { day: "numeric", month: "short" }) : "—"} – ${
          deliveryTo ? deliveryTo.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : "—"
        }`
      : "—";
  const totalLabelForReview =
    enteredCentsForSummary != null && currencyCode ? formatAmount(enteredCentsForSummary, currencyCode) : "—";

  const calculatedLabel = calculatedCents !== null && currencyCode ? formatAmount(calculatedCents, currencyCode) : null;

  return (
    // Width + horizontal padding come from the shell `<main>` (APP_SHELL_MAIN_CLASSNAME).
    <div className="space-y-4 pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0">
      <BackNavLink href={ordersHref}>{tCreate("backToList")}</BackNavLink>
      <h1 className="hidden text-[28px] leading-tight font-semibold [color:var(--text-primary)] md:block">
        {tCreate("title")}
      </h1>

      {serverError && (
        <p
          className="rounded-lg px-3 py-2 text-[13px] [color:var(--destructive)] [background:color-mix(in_oklch,var(--destructive)_8%,transparent)]"
          role="alert"
        >
          {t.has(`error.${serverError}` as never) ? t(`error.${serverError}` as never) : t("error.server_error")}
        </p>
      )}

      <Stepper
        steps={steps}
        activeStep={activeStep}
        doneSteps={doneSteps}
        erroredSteps={erroredSteps}
        onStepClick={(n) => wizardRef.current?.activate(n)}
        ariaLabel={tCreate("stepperAriaLabel")}
        variant={isMobile ? "compact" : "default"}
        compactEyebrow={tCreate("stepperCompactEyebrow", { current: activeStep, total: steps.length })}
      />

      <form ref={formRef} onSubmit={handleFinalSubmit} onKeyDown={handleFormKeyDown} noValidate>
        <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
          <div>
            <WizardAccordion
              ref={wizardRef}
              steps={steps}
              showStepper={false}
              gated
              stepperAriaLabel={tCreate("stepperAriaLabel")}
              layout="wizard"
              onStepChange={setActiveStep}
              onDoneStepsChange={setDoneSteps}
              onErroredStepsChange={setErroredSteps}
            >
              {/* STEP 1 — Datos */}
              <WizardStep
                n={1}
                eyebrow={tCreate("step1Eyebrow")}
                title={tCreate("step1Title")}
                summary={step1Summary}
                validate={validateStep1}
                primaryAction={{ label: tCreate("stepContinue") }}
                actionsLayout="sticky-on-mobile"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="order-store" className="text-[13px] font-medium [color:var(--text-secondary)]">
                      {tForm("storeLabel")} <span className="[color:var(--destructive)]">*</span>
                    </label>
                    <OrderStoreField
                      id="order-store"
                      stores={stores}
                      value={storeId}
                      error={Boolean(storeError)}
                      onChange={(next) => {
                        setStoreId(next);
                        setStoreError(null);
                        const derived = resolveStoreCurrency(stores, next);
                        if (derived && !currencyCode) {
                          setCurrencyCode(derived);
                          setCurrencyError(null);
                        }
                      }}
                    />
                    {storeError && <FieldErrorMsg>{storeError}</FieldErrorMsg>}
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="order-currency" className="text-[13px] font-medium [color:var(--text-secondary)]">
                      {tForm("currencyLabel")} <span className="[color:var(--destructive)]">*</span>
                    </label>
                    <OrderCurrencyField
                      id="order-currency"
                      options={currencyListOptions}
                      value={currencyCode}
                      error={Boolean(currencyError)}
                      onChange={(next) => {
                        setCurrencyCode(next);
                        setCurrencyError(null);
                      }}
                      baseCurrencyCode={baseCurrencyCode}
                    />
                    {currencyError ? (
                      <FieldErrorMsg>{currencyError}</FieldErrorMsg>
                    ) : (
                      <p className="text-[11.5px] [color:var(--text-muted)]">{tCreate("step3Helper")}</p>
                    )}
                  </div>
                </div>
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
                {/* Discreet bridge into the image intake method: a text link, never a button, so
                    it never competes with the step's own "Continuar" CTA. */}
                <Link
                  href={imageIntakeHref}
                  className="inline-flex w-fit items-center gap-1.5 text-[12.5px] [color:var(--text-muted)] hover:[color:var(--accent)]"
                >
                  <ImageIcon size={13} aria-hidden className="shrink-0" />
                  {tImageIntake("entry.wizardHint")}
                </Link>
              </WizardStep>

              {/* STEP 2 — Productos y costos */}
              <WizardStep
                n={2}
                eyebrow={tCreate("step2Eyebrow")}
                title={tCreate("step2Title")}
                summary={step2Summary}
                validate={validateStep2}
                primaryAction={{ label: tCreate("stepContinue") }}
                secondaryAction={{ label: tCreate("stepBack") }}
                actionsLayout="sticky-on-mobile"
              >
                <p className="text-[12px] [color:var(--text-muted)]">
                  {isMobile ? tCreate("itemsListIntro") : tCreate("minProductHint")}
                </p>

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
                      {tForm("totalCostLabel")}
                      {currencyCode ? ` (${currencyCode})` : ""} <span className="[color:var(--destructive)]">*</span>
                    </label>
                    <Input
                      id="order-total"
                      type="text"
                      inputMode="decimal"
                      value={totalCost}
                      placeholder={tForm("totalCostPlaceholder")}
                      error={Boolean(clientTotalCostError)}
                      onChange={(e) => {
                        setTotalCost(sanitizeDecimalInput(e.target.value, currencyCode));
                        setClientTotalCostError(null);
                      }}
                    />
                    {clientTotalCostError ? (
                      <p className="text-[12px] [color:var(--destructive)]" role="alert">
                        {clientTotalCostError}
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
              </WizardStep>

              {/* STEP 3 — Confirmar */}
              <WizardStep
                n={3}
                eyebrow={tCreate("step3Eyebrow")}
                title={tCreate("step3Title")}
                primaryAction={{
                  label: isPending ? tCreate("submitting") : tCreate("confirmCta"),
                  leadingIcon: <Check size={14} aria-hidden />,
                  loading: isPending,
                  onClick: () => formRef.current?.requestSubmit(),
                }}
                secondaryAction={{ label: tCreate("stepBack") }}
                autoAdvance={false}
                actionsLayout="sticky-on-mobile"
              >
                <p className="text-[12px] [color:var(--text-muted)]">{tCreate("step3Helper")}</p>
                <div
                  style={{ viewTransitionName: "order-create-confirm" } as React.CSSProperties}
                  className={WIZARD_CONFIRM_PANEL_CLASSNAME}
                >
                  <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                    <dt className="text-[11.5px] [color:var(--text-muted)]">{tCreate("summaryStore")}</dt>
                    <dd className="font-medium">{selectedStore?.name ?? "—"}</dd>
                    <dt className="text-[11.5px] [color:var(--text-muted)]">{tCreate("summaryCurrency")}</dt>
                    <dd className="font-medium">
                      {currencyCode ? `${currencyCode} · ${tCurrencies(currencyCode as never)}` : "—"}
                    </dd>
                    <dt className="text-[11.5px] [color:var(--text-muted)]">{tCreate("summaryDate")}</dt>
                    <dd className="font-medium">{orderDateForReview}</dd>
                    <dt className="text-[11.5px] [color:var(--text-muted)]">{tCreate("summaryDelivery")}</dt>
                    <dd className={cn("font-medium", deliveryReview === "—" && "[color:var(--text-muted)]")}>
                      {deliveryReview}
                    </dd>
                    <div className="col-span-2 my-1.5 h-px [background:var(--border)]" />
                    <dt className="text-[11.5px] [color:var(--text-muted)]">{tCreate("summaryProducts")}</dt>
                    <dd>
                      {validItemsCount > 0
                        ? `${validItemsCount} · ${items.find((r) => r.name.trim())?.name ?? ""}`
                        : "—"}
                    </dd>
                    <div className="col-span-2 my-1.5 h-px [background:var(--border)]" />
                    <dt className="text-[11.5px] [color:var(--text-muted)]">{tCreate("confirmTotalLabel")}</dt>
                    <dd className="text-[17px] font-bold [font-variant-numeric:tabular-nums]">{totalLabelForReview}</dd>
                  </dl>
                </div>

                {/* "¿Pagaste algo hoy?" — collapsed by default; the common case is nothing paid yet. */}
                <div className="rounded-xl [border:1px_solid_var(--border)]">
                  <button
                    type="button"
                    onClick={() => setShowInitialPayment((current) => !current)}
                    aria-expanded={showInitialPayment}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left"
                  >
                    <span className="text-[12.5px] font-medium [color:var(--text-secondary)]">
                      {tCreate("initialPayment.toggle")}
                    </span>
                    <ChevronDown
                      size={15}
                      aria-hidden
                      className={cn(
                        "shrink-0 [color:var(--text-muted)] transition-transform",
                        showInitialPayment && "rotate-180",
                      )}
                    />
                  </button>

                  {!showInitialPayment && (
                    <div className="flex flex-wrap items-center gap-2 px-3 pb-2.5">
                      <Button
                        type="button"
                        variant="tonal"
                        size="sm"
                        onClick={handleMarkFullyPaid}
                        disabled={!canMarkFullyPaid}
                      >
                        {tCreate("initialPayment.paidInFull")}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={handleFocusAdvance}>
                        {tCreate("initialPayment.advance")}
                      </Button>
                      {!canMarkFullyPaid && (
                        <span className="text-[11.5px] [color:var(--text-muted)]">
                          {tCreate("initialPayment.needsTotalHint")}
                        </span>
                      )}
                    </div>
                  )}

                  {showInitialPayment && (
                    <div className="space-y-3 px-3 pt-1 pb-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="tonal"
                          size="sm"
                          onClick={handleMarkFullyPaid}
                          disabled={!canMarkFullyPaid}
                        >
                          {tCreate("initialPayment.paidInFull")}
                        </Button>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label
                            htmlFor="order-initial-payment-amount"
                            className="text-[13px] font-medium [color:var(--text-secondary)]"
                          >
                            {tCreate("initialPayment.amountLabel")}
                            {currencyCode ? ` (${currencyCode})` : ""}
                          </label>
                          <Input
                            id="order-initial-payment-amount"
                            type="text"
                            inputMode="decimal"
                            value={initialPaymentAmount}
                            placeholder={tForm("totalCostPlaceholder")}
                            error={Boolean(initialPaymentError)}
                            onChange={(e) => {
                              setInitialPaymentAmount(sanitizeDecimalInput(e.target.value, currencyCode));
                              setInitialPaymentError(null);
                            }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label
                            htmlFor="order-initial-payment-date"
                            className="text-[13px] font-medium [color:var(--text-secondary)]"
                          >
                            {tCreate("initialPayment.dateLabel")}
                          </label>
                          <DatePickerInput
                            id="order-initial-payment-date"
                            value={initialPaymentDateValue}
                            onChange={setInitialPaymentDate}
                            placeholder={tForm("orderDatePlaceholder")}
                            locale={locale}
                            disableFuture
                            popupAlign="end"
                          />
                        </div>
                      </div>
                      {initialPaymentError ? (
                        <FieldErrorMsg>{initialPaymentError}</FieldErrorMsg>
                      ) : (
                        <p className="text-[11.5px] [color:var(--text-muted)]">{tCreate("initialPayment.helper")}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[12.5px] leading-[1.5] [color:var(--text-secondary)] [background:color-mix(in_oklch,var(--info)_6%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--info)_22%,transparent)]">
                  <Info size={14} className="mt-0.5 shrink-0 [color:var(--info)]" aria-hidden />
                  <span>
                    {tCreate.rich("step3InfoBanner", {
                      strong: (chunks) => <strong className="[color:var(--text-primary)]">{chunks}</strong>,
                    })}
                  </span>
                </div>
                {/* Submit shortcut as plain text near the CTA (deliveries S9-D5 parity), never a kbd chip inside the button. */}
                <p className="text-right text-[12px] [color:var(--text-muted)]">{tCreate("submitShortcutHint")}</p>
              </WizardStep>
            </WizardAccordion>
          </div>

          {!isMobile && <OrderCreateSummarySidebar summary={summary} />}
        </div>
      </form>

      <DiscrepancyModal
        isOpen={discrepancyState.show}
        enteredTotal={discrepancyState.enteredCents}
        calculatedTotal={discrepancyState.calculatedCents}
        formatAmount={(cents) => formatAmount(cents, currencyCode)}
        onGoBack={handleDiscrepancyGoBack}
        onSaveAnyway={handleSaveAnyway}
      />
    </div>
  );
}

/**
 * Compact label + kbd chip used in the step-2 shortcuts hint row.
 * `font-family: inherit` (NOT mono) so arrow/return/backspace glyphs render at
 * consistent widths — the system font (Inter) has uniform glyph coverage where
 * `font-mono` (JetBrains Mono) falls back per-glyph and produces variable
 * widths. Matches the demo HTML `.kbd` styling exactly.
 */
function ShortcutHint({ label, keys }: { label: string; keys: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span>{label}</span>
      <kbd
        // Override the browser-default `<kbd>` monospace rule with the page
        // font (Inter via inherit). Inter has uniform glyph coverage for
        // ⇧↑↓←→↵⌫ — mono fonts (ui-monospace / JetBrains Mono) fall back
        // per-glyph and produce visibly inconsistent widths.
        style={{ fontFamily: "inherit" }}
        className="inline-flex items-center rounded-[3px] px-1.5 py-px text-[11px] leading-[1.4] tracking-wide [color:var(--text-secondary)] [background:var(--surface-elevated)] [border:1px_solid_var(--border)]"
      >
        {keys}
      </kbd>
    </span>
  );
}

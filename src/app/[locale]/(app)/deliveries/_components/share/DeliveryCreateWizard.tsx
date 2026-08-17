"use client";

import { Check, Info, Pencil } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import {
  type FormEvent,
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import BackNavLink from "@/components/core/BackNavLink";
import StoreAvatar from "@/components/core/StoreAvatar";
import Stepper, { type StepperStep } from "@/components/core/Stepper";
import WizardAccordion, { type WizardAccordionHandle } from "@/components/modules/WizardAccordion/WizardAccordion";
import WizardStep from "@/components/modules/WizardAccordion/WizardStep";
import { AsideSummary, AsideSummaryRow } from "@/components/modules/AsideSummary";
import { useIsMobile } from "@/hooks/useIsMobile";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { WIZARD_CONFIRM_PANEL_CLASSNAME } from "@/lib/styles";
import { formatAmountSymbolOnly, formatAmountWithSymbol } from "@/lib/currency";
import { isValidNonNegativeDecimal, isValidRate } from "@/lib/decimalInput";
import { toLocalIsoDateString } from "@/lib/domainDate";
import type { DeliverySourceOrder, EligibleProductsResult } from "@/lib/data/deliveries/deliveryQueries";
import type { DeliveryCreateActionResult } from "../../new/_actions/createDeliveryAction";
import DeliveryDataFields, { type DeliveryDataErrors, type DeliveryDataValues } from "./DeliveryDataFields";
import DeliveryProductsPicker from "./DeliveryProductsPicker";
import DeliveryStoreField, { type DeliveryStoreOption } from "./DeliveryStoreField";
import FieldErrorMsg from "@/components/core/FieldErrorMsg";

export type DeliveryCreateWizardProps = {
  action: (prev: DeliveryCreateActionResult | null, formData: FormData) => Promise<DeliveryCreateActionResult>;
  stores: DeliveryStoreOption[];
  productsByStore: Record<string, EligibleProductsResult>;
  baseCurrencyCode: string | null;
  sourceOrder: DeliverySourceOrder | null;
};

/** Fresh paso-3 defaults. Cost stays empty so the field shows its placeholder
 * instead of a literal 0 the user would have to clear (shipping is rarely free). */
function buildInitialDeliveryData(baseCurrencyCode: string | null): DeliveryDataValues {
  return {
    deliveryDate: new Date(),
    arrivalFrom: null,
    arrivalTo: null,
    cost: "",
    currencyCode: baseCurrencyCode ?? "",
    exchangeRate: "",
  };
}

function preselectionForStore(
  productsByStore: Record<string, EligibleProductsResult>,
  sourceOrder: DeliverySourceOrder | null,
  storeId: string | null,
): string[] {
  if (!sourceOrder || storeId !== sourceOrder.storeId) return [];
  const groups = productsByStore[sourceOrder.storeId]?.byOrder ?? [];
  return groups.find((g) => g.orderId === sourceOrder.orderId)?.products.map((p) => p.orderItemId) ?? [];
}

/**
 * 4-step delivery create wizard (Tienda · Productos · Datos · Confirmar).
 * From-order entry starts at paso 2 with paso 1 done as a field-as-attribute
 * (ADR 0001 D2); standalone starts at paso 1 with the eligible-store combobox.
 * Source-order products come preselected; sibling eligible orders
 * render expanded and unchecked (S9-D6).
 */
export default function DeliveryCreateWizard({
  action,
  stores,
  productsByStore,
  baseCurrencyCode,
  sourceOrder,
}: DeliveryCreateWizardProps) {
  const t = useTranslations("deliveries");
  const locale = useLocale();
  const router = useRouter();
  const isMobile = useIsMobile();

  const entryPoint = sourceOrder ? "from_order" : "standalone";

  const [storeId, setStoreId] = useState<string | null>(sourceOrder?.storeId ?? null);
  // From-order: source products preselected; "Cambiar" swaps to the combobox.
  const [isChangingStore, setIsChangingStore] = useState(false);
  const initialSelection = useMemo(
    () => preselectionForStore(productsByStore, sourceOrder, sourceOrder?.storeId ?? null),
    [productsByStore, sourceOrder],
  );
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(initialSelection);
  const [productQuery, setProductQuery] = useState("");
  const [data, setData] = useState<DeliveryDataValues>(() => buildInitialDeliveryData(baseCurrencyCode));

  const [storeError, setStoreError] = useState<string | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [dataErrors, setDataErrors] = useState<DeliveryDataErrors>({});

  const wizardRef = useRef<WizardAccordionHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [activeStep, setActiveStep] = useState(sourceOrder ? 2 : 1);
  const [doneSteps, setDoneSteps] = useState<number[]>(sourceOrder ? [1] : []);
  const [erroredSteps, setErroredSteps] = useState<number[]>([]);

  const [state, formAction, isPending] = useActionState(action, null);

  const searchInputId = "delivery-products-search";

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

  const groups = useMemo(() => (storeId ? (productsByStore[storeId]?.byOrder ?? []) : []), [productsByStore, storeId]);
  const selectedStore = useMemo(() => stores.find((s) => s.storeId === storeId) ?? null, [stores, storeId]);
  const showExchangeRate = Boolean(baseCurrencyCode && data.currencyCode && data.currencyCode !== baseCurrencyCode);

  // PRODUCT_NOT_ELIGIBLE recovery: the eligible list is a point-in-time snapshot,
  // so a product can stop being eligible (e.g. it joined another delivery, or the
  // page was reopened from cache) between load and submit. Name the offending
  // products, drop them from the selection, reload fresh eligibility, and send the
  // user back to paso 2 to retry — instead of a dead-end "not eligible" banner.
  const handledIneligibleStateRef = useRef<DeliveryCreateActionResult | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect -- one-shot reconciliation of an
     async action result (guarded by handledIneligibleStateRef), not a render loop. */
  useEffect(() => {
    if (state?.success !== false || state.error !== "PRODUCT_NOT_ELIGIBLE") return;
    if (handledIneligibleStateRef.current === state) return;
    handledIneligibleStateRef.current = state;

    const ineligibleIds = state.ineligibleProductIds ?? [];
    const nameById = new Map(groups.flatMap((g) => g.products.map((p) => [p.orderItemId, p.orderItemName])));
    const names = ineligibleIds.map((id) => nameById.get(id)).filter((name): name is string => Boolean(name));

    if (ineligibleIds.length > 0) {
      setSelectedProductIds((current) => current.filter((id) => !ineligibleIds.includes(id)));
    }
    setProductsError(
      names.length > 0
        ? t("create.ineligible.removed", { names: names.join(", ") })
        : t("create.ineligible.removedGeneric"),
    );
    wizardRef.current?.invalidateFrom(2);
    // Non-optimistic by design: product eligibility is server-derived (another delivery
    // may have just claimed the item), so we refresh instead of guessing the new state.
    router.refresh();
  }, [state, groups, router, t]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleStoreChange = useCallback(
    (nextStoreId: string) => {
      const storeChanged = nextStoreId !== storeId;
      setStoreId(nextStoreId);
      setSelectedProductIds(preselectionForStore(productsByStore, sourceOrder, nextStoreId));
      setProductQuery("");
      setStoreError(null);
      setProductsError(null);
      setIsChangingStore(false);
      // Switching stores invalidates everything chosen downstream: a product
      // selection only makes sense for its store, so clear the picker, the paso-3
      // data, and the done/errored marks so pasos 2-4 restart from scratch.
      if (storeChanged) {
        setData(buildInitialDeliveryData(baseCurrencyCode));
        setDataErrors({});
        wizardRef.current?.invalidateFrom(2);
      }
    },
    [productsByStore, sourceOrder, storeId, baseCurrencyCode],
  );

  const handleProductToggle = useCallback((productId: string) => {
    setSelectedProductIds((current) =>
      current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId],
    );
    setProductsError(null);
  }, []);

  const handleGroupToggle = useCallback((productIds: string[]) => {
    setSelectedProductIds((current) => {
      const allSelected = productIds.every((id) => current.includes(id));
      if (allSelected) return current.filter((id) => !productIds.includes(id));
      return [...new Set([...current, ...productIds])];
    });
    setProductsError(null);
  }, []);

  const handleUndoSelection = useCallback(() => {
    setSelectedProductIds(storeId === (sourceOrder?.storeId ?? null) ? initialSelection : []);
    setProductsError(null);
  }, [initialSelection, sourceOrder?.storeId, storeId]);

  const handleDataChange = useCallback((patch: Partial<DeliveryDataValues>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleClearDataError = useCallback((field: keyof DeliveryDataErrors) => {
    setDataErrors((prev) => (prev[field] ? { ...prev, [field]: null } : prev));
  }, []);

  // Step validators — "Continuar" stays enabled; a failed click paints inline errors
  // (PLAYBOOK §3 wizard CTA rule).
  const validateStep1 = useCallback((): boolean => {
    const nextError = storeId ? null : t("create.validation.storeRequired");
    setStoreError(nextError);
    return !nextError;
  }, [storeId, t]);

  const validateStep2 = useCallback((): boolean => {
    const nextError = selectedProductIds.length > 0 ? null : t("create.validation.productsRequired");
    setProductsError(nextError);
    return !nextError;
  }, [selectedProductIds.length, t]);

  const validateStep3 = useCallback((): boolean => {
    const errors: DeliveryDataErrors = {};
    if (!data.deliveryDate) errors.deliveryDate = t("create.validation.shippedDateRequired");
    if (!data.cost.trim() || !isValidNonNegativeDecimal(data.cost, data.currencyCode)) {
      errors.cost = t("create.validation.costInvalid");
    }
    if (!data.currencyCode) errors.currencyCode = t("create.validation.currencyRequired");
    if (showExchangeRate && !isValidRate(data.exchangeRate)) {
      errors.exchangeRate = t("create.validation.fxRequired");
    }
    setDataErrors(errors);
    return Object.values(errors).every((value) => !value);
  }, [data, showExchangeRate, t]);

  const buildFormData = useCallback(
    (form: HTMLFormElement): FormData => {
      const fd = new FormData(form);
      if (storeId) fd.set("storeId", storeId);
      if (data.deliveryDate) fd.set("deliveryDate", toLocalIsoDateString(data.deliveryDate));
      if (data.arrivalFrom) fd.set("expectedArrivalFrom", toLocalIsoDateString(data.arrivalFrom));
      if (data.arrivalTo) fd.set("expectedArrivalTo", toLocalIsoDateString(data.arrivalTo));
      fd.set("cost", data.cost);
      fd.set("currencyCode", data.currencyCode);
      if (showExchangeRate) fd.set("exchangeRate", data.exchangeRate);
      fd.set("productIds", JSON.stringify(selectedProductIds));
      fd.set("entryPoint", entryPoint);
      if (sourceOrder) fd.set("sourceOrderId", sourceOrder.orderId);
      return fd;
    },
    [storeId, data, showExchangeRate, selectedProductIds, entryPoint, sourceOrder],
  );

  const handleFinalSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!validateStep1() || !validateStep2() || !validateStep3()) return;
      const fd = buildFormData(event.currentTarget);
      startTransition(() => formAction(fd));
    },
    [validateStep1, validateStep2, validateStep3, buildFormData, formAction],
  );

  // ⌘/Ctrl+Enter submits from any step (mirrors the order-create wizard).
  const handleFormKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLFormElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        if (isPending) return;
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    },
    [isPending],
  );

  const steps: StepperStep[] = useMemo(
    () => [
      { n: 1, label: t("create.steps.store") },
      { n: 2, label: t("create.steps.products") },
      { n: 3, label: t("create.steps.data") },
      { n: 4, label: t("create.steps.confirm") },
    ],
    [t],
  );

  // Derived labels (review step + aside summary).
  const fmtDate = useCallback(
    (d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }),
    [locale],
  );
  const selectedProducts = useMemo(
    () => groups.flatMap((group) => group.products.filter((p) => selectedProductIds.includes(p.orderItemId))),
    [groups, selectedProductIds],
  );
  const sourceOrderCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const group of groups) {
      if (group.products.some((p) => selectedProductIds.includes(p.orderItemId))) {
        codes.add(group.orderHumanReadableId);
      }
    }
    return [...codes];
  }, [groups, selectedProductIds]);

  const costMinor = isValidNonNegativeDecimal(data.cost, data.currencyCode)
    ? Math.round(parseFloat(data.cost) * 100)
    : null;
  const costLabel =
    costMinor != null && data.currencyCode ? formatAmountWithSymbol(costMinor, data.currencyCode, locale) : null;
  const convertedLabel =
    costMinor != null && showExchangeRate && isValidRate(data.exchangeRate)
      ? formatAmountSymbolOnly(Math.round(costMinor * parseFloat(data.exchangeRate)), baseCurrencyCode!, locale)
      : null;
  const arrivalLabel =
    data.arrivalFrom || data.arrivalTo
      ? `${data.arrivalFrom ? fmtDate(data.arrivalFrom) : "—"} – ${data.arrivalTo ? fmtDate(data.arrivalTo) : "—"}`
      : null;

  const step1Summary = selectedStore
    ? sourceOrder && storeId === sourceOrder.storeId
      ? t("create.summaries.step1FromOrder", {
          store: selectedStore.storeName,
          order: sourceOrder.orderHumanReadableId,
        })
      : selectedStore.storeName
    : undefined;
  const step2Summary =
    selectedProductIds.length > 0 ? t("create.summaries.step2", { count: selectedProductIds.length }) : undefined;
  const step3Summary = data.deliveryDate && costLabel ? `${fmtDate(data.deliveryDate)} · ${costLabel}` : undefined;

  // PRODUCT_NOT_ELIGIBLE is handled inline at paso 2 (names + auto-remove), so it
  // never surfaces as the generic top banner.
  const serverError =
    state?.success === false && state.error !== "validation" && state.error !== "PRODUCT_NOT_ELIGIBLE"
      ? state.error
      : null;
  const backHref = sourceOrder ? `/${locale}${ROUTES.orders}/${sourceOrder.orderId}` : `/${locale}${ROUTES.deliveries}`;

  const showFieldAsAttribute = Boolean(sourceOrder && storeId === sourceOrder.storeId && !isChangingStore);

  // Width + horizontal padding come from the shell `<main>` (APP_SHELL_MAIN_CLASSNAME).
  return (
    <div className="space-y-4 pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0">
      <BackNavLink href={backHref}>{sourceOrder ? t("create.backToOrder") : t("create.backToDeliveries")}</BackNavLink>
      <div className="hidden md:block">
        <h1 className="text-[28px] leading-tight font-semibold [color:var(--text-primary)]">{t("create.title")}</h1>
        <p className="mt-1 text-[13px] [color:var(--text-muted)]">
          {sourceOrder ? t("create.metaFromOrder") : t("create.metaStandalone")}
        </p>
      </div>

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
        ariaLabel={t("create.stepperAriaLabel")}
        variant={isMobile ? "compact" : "default"}
        compactEyebrow={t("create.stepperCompactEyebrow", { current: activeStep, total: steps.length })}
      />

      <form ref={formRef} onSubmit={handleFinalSubmit} onKeyDown={handleFormKeyDown} noValidate>
        <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
          <div>
            <WizardAccordion
              ref={wizardRef}
              steps={steps}
              showStepper={false}
              gated
              startStep={sourceOrder ? 2 : 1}
              initialDoneSteps={sourceOrder ? [1] : []}
              stepperAriaLabel={t("create.stepperAriaLabel")}
              layout="wizard"
              onStepChange={setActiveStep}
              onDoneStepsChange={setDoneSteps}
              onErroredStepsChange={setErroredSteps}
            >
              {/* PASO 1 · Tienda */}
              <WizardStep
                n={1}
                eyebrow={t("create.step1.eyebrow")}
                title={sourceOrder ? t("create.step1.titleFromOrder") : t("create.step1.title")}
                summary={step1Summary}
                validate={validateStep1}
                primaryAction={{ label: t("create.stepContinue") }}
                actionsLayout="sticky-on-mobile"
              >
                {showFieldAsAttribute ? (
                  <>
                    <p className="text-[12px] [color:var(--text-muted)]">{t("create.step1.fromOrderHelper")}</p>
                    {/* Field-as-attribute (ADR 0001 D2): prefilled store + source-order badge. */}
                    <div className="flex items-center gap-3 rounded-xl p-3 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
                      <StoreAvatar store={{ name: sourceOrder!.storeName }} size={40} className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[10.5px] tracking-[0.06em] [color:var(--text-muted)] uppercase">
                          ↳ {t("create.step1.fromOrderBadge", { order: sourceOrder!.orderHumanReadableId })}
                        </div>
                        <div className="truncate text-[14px] font-semibold [color:var(--text-primary)]">
                          {sourceOrder!.storeName}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsChangingStore(true)}
                        className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-medium [color:var(--accent)] hover:underline"
                      >
                        <Pencil size={13} aria-hidden />
                        {t("create.step1.changeStore")}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <label htmlFor="delivery-store" className="text-[13px] font-medium [color:var(--text-secondary)]">
                      {t("create.step1.storeLabel")} <span className="[color:var(--destructive)]">*</span>
                    </label>
                    <DeliveryStoreField
                      id="delivery-store"
                      stores={stores}
                      value={storeId}
                      onChange={handleStoreChange}
                      error={Boolean(storeError)}
                    />
                    {storeError ? (
                      <FieldErrorMsg>{storeError}</FieldErrorMsg>
                    ) : (
                      <p className="text-[11.5px] [color:var(--text-muted)]">{t("create.step1.storeHelper")}</p>
                    )}
                  </div>
                )}
              </WizardStep>

              {/* PASO 2 · Productos */}
              <WizardStep
                n={2}
                eyebrow={t("create.step2.eyebrow")}
                title={t("create.step2.title")}
                summary={step2Summary}
                validate={validateStep2}
                primaryAction={{ label: t("create.stepContinue") }}
                secondaryAction={{ label: t("create.stepBack") }}
                actionsLayout="sticky-on-mobile"
              >
                <p className="text-[12px] [color:var(--text-muted)]">
                  {sourceOrder && storeId === sourceOrder.storeId
                    ? t("create.step2.fromOrderHelper")
                    : t("create.step2.helper")}
                </p>
                {productsError && <FieldErrorMsg>{productsError}</FieldErrorMsg>}
                {!storeId ? (
                  <p className="text-[13px] [color:var(--text-muted)]">{t("create.step2.selectStoreFirst")}</p>
                ) : groups.length === 0 ? (
                  <p className="text-[13px] [color:var(--text-muted)]">
                    {t("create.step2.noProductsForStore", {
                      storeName: selectedStore?.storeName ?? t("create.step2.thisStore"),
                    })}
                  </p>
                ) : (
                  <DeliveryProductsPicker
                    groups={groups}
                    selectedIds={selectedProductIds}
                    onToggleProduct={handleProductToggle}
                    onToggleGroup={handleGroupToggle}
                    query={productQuery}
                    onQueryChange={setProductQuery}
                    primaryOrderId={sourceOrder?.orderId}
                    onUndo={handleUndoSelection}
                    searchInputId={searchInputId}
                  />
                )}
              </WizardStep>

              {/* PASO 3 · Datos de la entrega */}
              <WizardStep
                n={3}
                eyebrow={t("create.step3.eyebrow")}
                title={t("create.step3.title")}
                summary={step3Summary}
                validate={validateStep3}
                primaryAction={{ label: t("create.stepContinue") }}
                secondaryAction={{ label: t("create.stepBack") }}
                actionsLayout="sticky-on-mobile"
              >
                <DeliveryDataFields
                  values={data}
                  errors={dataErrors}
                  baseCurrencyCode={baseCurrencyCode}
                  idPrefix="delivery-create"
                  onChange={handleDataChange}
                  onClearError={handleClearDataError}
                />
              </WizardStep>

              {/* PASO 4 · Confirmar — review real (M04) */}
              <WizardStep
                n={4}
                eyebrow={t("create.step4.eyebrow")}
                title={t("create.step4.title")}
                primaryAction={{
                  label: isPending ? t("create.submitting") : t("create.submit"),
                  leadingIcon: <Check size={14} aria-hidden />,
                  loading: isPending,
                  onClick: () => formRef.current?.requestSubmit(),
                }}
                secondaryAction={{ label: t("create.stepBack") }}
                autoAdvance={false}
                actionsLayout="sticky-on-mobile"
              >
                <div className={WIZARD_CONFIRM_PANEL_CLASSNAME}>
                  <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                    <dt className="text-[11.5px] [color:var(--text-muted)]">{t("create.review.store")}</dt>
                    <dd className="font-medium">{selectedStore?.storeName ?? "—"}</dd>
                    <dt className="text-[11.5px] [color:var(--text-muted)]">{t("create.review.products")}</dt>
                    <dd className="font-medium">
                      {selectedProducts.length > 0 ? selectedProducts.map((p) => p.orderItemName).join(" · ") : "—"}
                    </dd>
                    <dt className="text-[11.5px] [color:var(--text-muted)]">{t("create.review.shippedDate")}</dt>
                    <dd className="font-medium">{data.deliveryDate ? fmtDate(data.deliveryDate) : "—"}</dd>
                    <dt className="text-[11.5px] [color:var(--text-muted)]">{t("create.review.arrival")}</dt>
                    <dd className={arrivalLabel ? "font-medium" : "[color:var(--text-muted)]"}>
                      {arrivalLabel ?? "—"}
                    </dd>
                    <dt className="text-[11.5px] [color:var(--text-muted)]">{t("create.review.cost")}</dt>
                    <dd className="font-medium tabular-nums">
                      {costLabel ?? "—"}
                      {convertedLabel ? ` (≈ ${convertedLabel} ${baseCurrencyCode})` : ""}
                    </dd>
                  </dl>
                </div>
                <div className="flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[12.5px] leading-relaxed [color:var(--text-secondary)] [background:color-mix(in_oklch,var(--info)_6%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--info)_22%,transparent)]">
                  <Info size={14} className="mt-0.5 shrink-0 [color:var(--info)]" aria-hidden />
                  <span>
                    {t.rich("create.review.infoBanner", {
                      count: selectedProductIds.length,
                      strong: (chunks) => <strong className="[color:var(--text-primary)]">{chunks}</strong>,
                    })}
                  </span>
                </div>
                {/* S9-D5: the shortcut lives as plain text near the CTA, never as a kbd chip inside it. */}
                <p className="text-right text-[12px] [color:var(--text-muted)]">
                  {t("create.review.submitShortcutHint")}
                </p>
              </WizardStep>
            </WizardAccordion>
          </div>

          {!isMobile && (
            <div className="space-y-3.5 lg:sticky lg:[top:calc(var(--app-banner-offset,0px)_+_var(--header-h-desktop,4rem)_+_var(--space-4,1rem))] lg:self-start">
              <AsideSummary eyebrow={t("create.summary.title")} className="lg:!static">
                <AsideSummaryRow
                  label={t("create.summary.store")}
                  value={selectedStore?.storeName ?? "—"}
                  muted={!selectedStore}
                />
                <AsideSummaryRow
                  label={t("create.summary.sourceOrders")}
                  value={sourceOrderCodes.length > 0 ? sourceOrderCodes : "—"}
                  muted={sourceOrderCodes.length === 0}
                />
                <AsideSummaryRow
                  label={t("create.summary.products")}
                  value={selectedProductIds.length > 0 ? String(selectedProductIds.length) : "—"}
                  muted={selectedProductIds.length === 0}
                />
                <AsideSummaryRow
                  label={t("create.summary.shippedDate")}
                  value={data.deliveryDate ? fmtDate(data.deliveryDate) : "—"}
                  muted={!data.deliveryDate}
                />
                <AsideSummaryRow
                  label={t("create.summary.arrival")}
                  value={arrivalLabel ?? "—"}
                  muted={!arrivalLabel}
                />
                <AsideSummaryRow label={t("create.summary.cost")} value={costLabel ?? "—"} muted={!costLabel} />
                {convertedLabel && baseCurrencyCode && (
                  <AsideSummaryRow
                    label={t("create.summary.inBase")}
                    value={`${convertedLabel} ${baseCurrencyCode}`}
                    strong
                  />
                )}
              </AsideSummary>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

"use client";

import { Check, Info, Lock, TriangleAlert } from "lucide-react";
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
import Button from "@/components/core/Button/Button";
import Eyebrow from "@/components/core/Eyebrow";
import Modal from "@/components/modules/Modal/Modal";
import StoreAvatar from "@/components/core/StoreAvatar";
import { AsideSummary, AsideSummaryRow } from "@/components/modules/AsideSummary";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { formatAmountWithSymbol } from "@/lib/currency";
import { utcDomainDateToLocal } from "@/lib/domainDate";
import { isValidPositiveDecimal } from "@/lib/decimalInput";
import type { EligibleProductsResult } from "@/lib/data/deliveries/deliveryQueries";
import type { DeliveryCreateActionResult } from "../../new/_actions/createDeliveryAction";
import DeliveryDataFields, { type DeliveryDataErrors, type DeliveryDataValues } from "./DeliveryDataFields";
import DeliveryProductsPicker from "./DeliveryProductsPicker";
import FieldErrorMsg from "@/components/core/FieldErrorMsg";

export type DeliveryEditInitialData = {
  id: string;
  humanReadableId: string;
  storeName: string;
  deliveryDate: Date;
  expectedArrivalFrom: Date | null;
  expectedArrivalTo: Date | null;
  cost: number;
  currencyCode: string;
  exchangeRate: number | null;
  /** Stale-rate flag from a base-currency change; drives the FX-outdated warning in the form. */
  needsExchangeRateUpdate: boolean;
  currentProductIds: string[];
};

export type DeliveryEditFormProps = {
  action: (prev: DeliveryCreateActionResult | null, formData: FormData) => Promise<DeliveryCreateActionResult>;
  initialDelivery: DeliveryEditInitialData;
  /** Eligible products for the delivery's store, queried with `excludeDeliveryId`. */
  products: EligibleProductsResult;
  baseCurrencyCode: string | null;
};

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isValidNonNegativeDecimal(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value);
}

function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

/**
 * Edit form (`#s9-delivery-edit`): NOT a wizard — always-visible
 * stacked section cards. The store is locked (S9-D4); removing a linked product tints
 * the row warning and returns it to "Listo en tienda" on save; the aside highlights
 * only what changed (order-edit parity).
 */
export default function DeliveryEditForm({
  action,
  initialDelivery,
  products,
  baseCurrencyCode,
}: DeliveryEditFormProps) {
  const t = useTranslations("deliveries");
  const locale = useLocale();
  const router = useRouter();

  // Server domain dates are stored at midnight UTC; the date picker works in local time
  // and re-serializes with local getters. Convert to local-midnight on the same calendar
  // day so the picker, the change summary, and the submitted value all agree (avoids the
  // off-by-one that would both show AND save the wrong day in non-UTC zones).
  const initialLocalDates = useMemo(
    () => ({
      deliveryDate: utcDomainDateToLocal(initialDelivery.deliveryDate),
      arrivalFrom: initialDelivery.expectedArrivalFrom
        ? utcDomainDateToLocal(initialDelivery.expectedArrivalFrom)
        : null,
      arrivalTo: initialDelivery.expectedArrivalTo ? utcDomainDateToLocal(initialDelivery.expectedArrivalTo) : null,
    }),
    [initialDelivery.deliveryDate, initialDelivery.expectedArrivalFrom, initialDelivery.expectedArrivalTo],
  );

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(initialDelivery.currentProductIds);
  const [productQuery, setProductQuery] = useState("");
  const [data, setData] = useState<DeliveryDataValues>({
    deliveryDate: initialLocalDates.deliveryDate,
    arrivalFrom: initialLocalDates.arrivalFrom,
    arrivalTo: initialLocalDates.arrivalTo,
    cost: (initialDelivery.cost / 100).toFixed(2),
    currencyCode: initialDelivery.currencyCode,
    exchangeRate: initialDelivery.exchangeRate != null ? String(initialDelivery.exchangeRate) : "",
  });
  const [productsError, setProductsError] = useState<string | null>(null);
  const [dataErrors, setDataErrors] = useState<DeliveryDataErrors>({});
  const [discardOpen, setDiscardOpen] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(action, null);

  useEffect(() => {
    posthog.capture(POSTHOG_EVENTS.DELIVERY.EDIT_FLOW_OPENED, { deliveryId: initialDelivery.id });
  }, [initialDelivery.id]);

  const detailHref = `/${locale}${ROUTES.deliveries}/${initialDelivery.id}`;

  useEffect(() => {
    if (state?.success) {
      router.push(detailHref);
    }
  }, [detailHref, router, state]);

  const showExchangeRate = Boolean(baseCurrencyCode && data.currencyCode && data.currencyCode !== baseCurrencyCode);

  // Per-field dirty flags drive the "Resumen de cambios" highlights.
  const dirty = useMemo(() => {
    const productsDirty = !sameIdSet(selectedProductIds, initialDelivery.currentProductIds);
    const dateDirty = data.deliveryDate?.getTime() !== initialLocalDates.deliveryDate.getTime();
    const arrivalDirty =
      (data.arrivalFrom?.getTime() ?? null) !== (initialLocalDates.arrivalFrom?.getTime() ?? null) ||
      (data.arrivalTo?.getTime() ?? null) !== (initialLocalDates.arrivalTo?.getTime() ?? null);
    const costDirty = data.cost !== (initialDelivery.cost / 100).toFixed(2);
    const currencyDirty = data.currencyCode !== initialDelivery.currencyCode;
    const fxDirty =
      data.exchangeRate !== (initialDelivery.exchangeRate != null ? String(initialDelivery.exchangeRate) : "");
    return {
      products: productsDirty,
      date: dateDirty,
      arrival: arrivalDirty,
      cost: costDirty || currencyDirty || fxDirty,
      any: productsDirty || dateDirty || arrivalDirty || costDirty || currencyDirty || fxDirty,
    };
  }, [selectedProductIds, data, initialDelivery, initialLocalDates]);

  // Browser unload guard while dirty (discard confirmation).
  useEffect(() => {
    if (!dirty.any) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty.any]);

  const removedCount = useMemo(
    () => initialDelivery.currentProductIds.filter((id) => !selectedProductIds.includes(id)).length,
    [initialDelivery.currentProductIds, selectedProductIds],
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

  const handleDataChange = useCallback((patch: Partial<DeliveryDataValues>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleClearDataError = useCallback((field: keyof DeliveryDataErrors) => {
    setDataErrors((prev) => (prev[field] ? { ...prev, [field]: null } : prev));
  }, []);

  const validate = useCallback((): boolean => {
    let valid = true;
    if (selectedProductIds.length === 0) {
      setProductsError(t("create.validation.productsRequired"));
      valid = false;
    }
    const errors: DeliveryDataErrors = {};
    if (!data.deliveryDate) errors.deliveryDate = t("create.validation.shippedDateRequired");
    if (!data.cost.trim() || !isValidNonNegativeDecimal(data.cost)) {
      errors.cost = t("create.validation.costInvalid");
    }
    if (!data.currencyCode) errors.currencyCode = t("create.validation.currencyRequired");
    if (showExchangeRate && !isValidPositiveDecimal(data.exchangeRate)) {
      errors.exchangeRate = t("create.validation.fxRequired");
    }
    setDataErrors(errors);
    if (!Object.values(errors).every((value) => !value)) valid = false;
    return valid;
  }, [selectedProductIds.length, data, showExchangeRate, t]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!validate()) return;
      const fd = new FormData(event.currentTarget);
      fd.set("deliveryId", initialDelivery.id);
      if (data.deliveryDate) fd.set("deliveryDate", toIsoDate(data.deliveryDate));
      if (data.arrivalFrom) fd.set("expectedArrivalFrom", toIsoDate(data.arrivalFrom));
      if (data.arrivalTo) fd.set("expectedArrivalTo", toIsoDate(data.arrivalTo));
      fd.set("cost", data.cost);
      fd.set("currencyCode", data.currencyCode);
      if (showExchangeRate) fd.set("exchangeRate", data.exchangeRate);
      fd.set("productIds", JSON.stringify(selectedProductIds));
      startTransition(() => formAction(fd));
    },
    [validate, initialDelivery.id, data, showExchangeRate, selectedProductIds, formAction],
  );

  const handleFormKeyDown = useCallback((event: React.KeyboardEvent<HTMLFormElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }, []);

  const handleDiscard = useCallback(() => {
    if (!dirty.any) {
      router.push(detailHref);
      return;
    }
    setDiscardOpen(true);
  }, [dirty.any, detailHref, router]);

  const handleDiscardConfirm = useCallback(() => {
    setDiscardOpen(false);
    router.push(detailHref);
  }, [detailHref, router]);

  const fmtDate = useCallback(
    (d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }),
    [locale],
  );
  const fmtShort = useCallback((d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "short" }), [locale]);

  const arrivalLabelOf = useCallback(
    (from: Date | null, to: Date | null) => {
      if (from && to) return `${fmtShort(from)} – ${fmtShort(to)}`;
      const single = from ?? to;
      return single ? fmtShort(single) : "—";
    },
    [fmtShort],
  );

  const costMinor = isValidNonNegativeDecimal(data.cost) ? Math.round(parseFloat(data.cost) * 100) : null;
  const costLabel =
    costMinor != null && data.currencyCode ? formatAmountWithSymbol(costMinor, data.currencyCode, locale) : "—";

  const productsSummaryValue = dirty.products
    ? `${initialDelivery.currentProductIds.length} → ${selectedProductIds.length}`
    : String(selectedProductIds.length);
  const arrivalSummaryValue = dirty.arrival
    ? `${arrivalLabelOf(initialDelivery.expectedArrivalFrom, initialDelivery.expectedArrivalTo)} → ${arrivalLabelOf(data.arrivalFrom, data.arrivalTo)}`
    : arrivalLabelOf(data.arrivalFrom, data.arrivalTo);

  const serverError = state?.success === false && state.error !== "validation" ? state.error : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 lg:px-0">
      <BackNavLink href={detailHref}>{t("edit.backToDetail")}</BackNavLink>
      <div>
        <h1 className="text-[28px] leading-tight font-semibold [color:var(--text-primary)]">{t("edit.title")}</h1>
        <p className="mt-1 font-mono text-[13px] [color:var(--text-muted)]">
          {initialDelivery.humanReadableId} · {initialDelivery.storeName}
        </p>
      </div>

      {serverError && (
        <p
          className="rounded-lg px-3 py-2 text-[13px] [color:var(--destructive)] [background:color-mix(in_oklch,var(--destructive)_8%,transparent)]"
          role="alert"
        >
          {serverError === "INVALID_STATUS"
            ? t("edit.errorInvalidStatus")
            : t.has(`error.${serverError}` as never)
              ? t(`error.${serverError}` as never)
              : t("error.server_error")}
        </p>
      )}

      <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} noValidate>
        <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
          <div className="flex flex-col gap-4 md:gap-6">
            {/* Tienda — locked (S9-D4): read-only block, never an <input disabled>. */}
            <section className="rounded-2xl p-5 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
              <Eyebrow as="h2">{t("edit.storeSection")}</Eyebrow>
              <div
                aria-disabled="true"
                className="mt-3 flex items-center gap-3 rounded-xl p-3 opacity-70 [background:color-mix(in_oklch,var(--text-primary)_4%,transparent)] [border:1px_solid_var(--border)]"
              >
                <StoreAvatar store={{ name: initialDelivery.storeName }} size={40} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold [color:var(--text-primary)]">
                  {initialDelivery.storeName}
                </span>
                <Lock size={13} aria-hidden className="shrink-0 [color:var(--text-muted)]" />
              </div>
              <p className="mt-2 text-[11.5px] [color:var(--text-muted)]">{t("edit.storeLockedHelper")}</p>
            </section>

            {/* Productos */}
            <section className="rounded-2xl p-5 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
              <Eyebrow as="h2">{t("edit.productsSection")}</Eyebrow>
              {productsError && <FieldErrorMsg className="mt-2">{productsError}</FieldErrorMsg>}
              <div className="mt-3">
                <DeliveryProductsPicker
                  groups={products.byOrder}
                  selectedIds={selectedProductIds}
                  onToggleProduct={handleProductToggle}
                  onToggleGroup={handleGroupToggle}
                  query={productQuery}
                  onQueryChange={setProductQuery}
                  currentIds={initialDelivery.currentProductIds}
                />
              </div>
            </section>

            {/* Datos de la entrega */}
            <section className="rounded-2xl p-5 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
              <Eyebrow as="h2" className="mb-3">
                {t("edit.dataSection")}
              </Eyebrow>
              <DeliveryDataFields
                values={data}
                errors={dataErrors}
                baseCurrencyCode={baseCurrencyCode}
                idPrefix="delivery-edit"
                onChange={handleDataChange}
                onClearError={handleClearDataError}
                showFxOutdatedWarning={initialDelivery.needsExchangeRateUpdate}
              />

              <div className="mt-5 flex flex-wrap items-center gap-3 pt-4 [border-top:1px_solid_var(--border)]">
                <Button type="button" variant="ghost" size="md" onClick={handleDiscard} disabled={isPending}>
                  {t("edit.discard")}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={isPending}
                  leadingIcon={<Check size={14} aria-hidden />}
                >
                  {isPending ? t("edit.saving") : t("edit.save")}
                </Button>
                {/* S9-D5: shortcut as plain text beside the CTA, no kbd chip inside it. */}
                <span className="text-[12px] [color:var(--text-muted)]">{t("create.review.submitShortcutHint")}</span>
              </div>
            </section>
          </div>

          {/* Aside — Resumen de cambios: highlights only what changed (order-edit parity). */}
          <AsideSummary eyebrow={t("edit.changesSummary.title")}>
            <AsideSummaryRow label={t("create.summary.store")} value={initialDelivery.storeName} />
            <AsideSummaryRow
              label={t("create.summary.products")}
              value={productsSummaryValue}
              changed={dirty.products}
            />
            <AsideSummaryRow
              label={t("create.summary.shippedDate")}
              value={data.deliveryDate ? fmtDate(data.deliveryDate) : "—"}
              changed={dirty.date}
            />
            <AsideSummaryRow label={t("create.summary.arrival")} value={arrivalSummaryValue} changed={dirty.arrival} />
            <AsideSummaryRow label={t("create.summary.cost")} value={costLabel} changed={dirty.cost} />
            {removedCount > 0 && (
              <div className="flex items-start gap-1.5 pt-2.5 text-[12px] [color:var(--text-muted)]">
                <Info size={12} aria-hidden className="mt-0.5 shrink-0" />
                <span>
                  {t.rich("edit.changesSummary.removalNote", {
                    count: removedCount,
                    strong: (chunks) => <strong className="[color:var(--text-secondary)]">{chunks}</strong>,
                  })}
                </span>
              </div>
            )}
          </AsideSummary>
        </div>
      </form>

      <Modal
        isOpen={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title={t("edit.discardModal.title")}
        subtitle={t("edit.discardModal.subtitle")}
        role="alertdialog"
        tone="warning"
        icon={<TriangleAlert />}
        primaryAction={{ label: t("edit.discardModal.confirm"), onClick: handleDiscardConfirm }}
        secondaryAction={{ label: t("edit.discardModal.stay"), onClick: () => setDiscardOpen(false) }}
      />
    </div>
  );
}

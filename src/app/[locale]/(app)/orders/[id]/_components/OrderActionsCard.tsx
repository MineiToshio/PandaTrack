"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Ban, PackageCheck, Pencil, RotateCcw, Store, Trash2, Truck, Zap } from "lucide-react";
import Button from "@/components/core/Button/Button";
import Eyebrow from "@/components/core/Eyebrow";
import Tooltip from "@/components/core/Tooltip";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import type { OrderEligibility } from "@/lib/data/orders/orderQueries";
import type { OrderStatus } from "../../../../../../../generated/prisma/client";
import { reactivateOrderAction } from "../_actions/orderLifecycleActions";
import OrderCancelModal from "./OrderCancelModal";
import OrderDeleteModal from "./OrderDeleteModal";
import { QuickArrivalModal, type QuickArrivalItem } from "@/components/modules/QuickArrival";
import { useQuickArrival } from "@/components/modules/QuickArrival/useQuickArrival";

type OrderActionsCardProps = {
  orderId: string;
  humanReadableId: string;
  storeName: string;
  storeSlug: string;
  status: OrderStatus;
  eligibility: OrderEligibility;
  /** Sum of the order's recorded payments, in minor units of `currencyCode`. Threaded into
      `OrderCancelModal`'s payments-choice control. */
  paidAmountMinor: number;
  currencyCode: string;
  hasPayments: boolean;
  /** Threaded into `OrderCancelModal`, which only announces that marks are cleared when any exist. */
  markedItemCount: number;
  locale: string;
  /** Products still eligible for a delivery; an empty list hides the quick-arrival action. */
  quickArrivalItems: QuickArrivalItem[];
  /** Forwarded to `QuickArrivalModal`; see its own prop. */
  settledItemCount?: number;
  baseCurrencyCode: string | null;
};

/**
 * Aside actions card on the order detail. Mirrors the actions block of the store detail
 * (`StoreDetailContent.tsx` aside) — same canonical `<Button>` component, same `variant`
 * vocabulary, same `fullWidth + justify-start` layout — so both pages share the visual
 * language.
 */
export default function OrderActionsCard({
  orderId,
  humanReadableId,
  storeName,
  storeSlug,
  status,
  eligibility,
  paidAmountMinor,
  currencyCode,
  hasPayments,
  markedItemCount,
  locale,
  quickArrivalItems,
  settledItemCount,
  baseCurrencyCode,
}: OrderActionsCardProps) {
  const t = useTranslations("orders");
  const router = useRouter();
  const [modal, setModal] = useState<"cancel" | "delete" | null>(null);
  const [isReactivating, setIsReactivating] = useState(false);
  const quickArrival = useQuickArrival({ orderId, locale, source: "actions_card" });

  // Reciprocal with the store page's "Volver al pedido {orderId}" back link (FRD-04), same
  // mechanism the store name in the hero already uses (`FR-05-23`).
  const orderDetailPath = `/${locale}${ROUTES.orders}/${orderId}`;
  const storeHref = `/${locale}${ROUTES.stores}/${storeSlug}?returnTo=${encodeURIComponent(orderDetailPath)}&returnLabel=${encodeURIComponent(humanReadableId)}`;

  const isCancelled = status === "CANCELLED";
  const isCompleted = status === "COMPLETED";
  const canQuickArrive = !isCancelled && quickArrivalItems.length > 0;

  async function handleReactivate() {
    setIsReactivating(true);
    const result = await reactivateOrderAction(orderId);
    // Non-optimistic by design: order status is server-derived (lifecycle transitions),
    // so we wait for the action and refresh rather than flip the status locally.
    if (result.ok) router.refresh();
    setIsReactivating(false);
  }

  const deleteTooltip = !eligibility.canDelete ? t("detail.actions.deleteDisabledTooltip") : null;
  const cancelTooltip = !eligibility.canCancel ? t("detail.actions.cancelDisabledTooltip") : null;

  return (
    <section
      aria-labelledby="order-actions-heading"
      className="bg-surface-elevated border-border rounded-2xl border p-[18px] [box-shadow:var(--elevation-2)] [border-top:2px_solid_color-mix(in_oklch,var(--accent)_55%,transparent)] sm:p-[22px]"
    >
      <Eyebrow as="h2" variant="chip" tone="accent" icon={Zap} id="order-actions-heading">
        {t("detail.mobileActions.sectionTitle")}
      </Eyebrow>

      <div className="mt-3 flex flex-col gap-2">
        {isCancelled ? (
          <>
            <Button
              type="button"
              variant="primary"
              size="md"
              fullWidth
              onClick={handleReactivate}
              disabled={isReactivating}
              leadingIcon={<RotateCcw size={16} aria-hidden />}
              className="justify-start"
            >
              {isReactivating ? "…" : t("detail.actions.reactivate")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="md"
              fullWidth
              disabled
              leadingIcon={<Pencil size={16} aria-hidden />}
              className="justify-start"
            >
              {t("detail.actions.edit")}
            </Button>
            <Button
              as="a"
              href={storeHref}
              variant="ghost"
              size="md"
              fullWidth
              leadingIcon={<Store size={16} aria-hidden />}
              className="justify-start"
              posthogEvent={POSTHOG_EVENTS.ORDER.VIEW_STORE_CLICKED}
              posthogProps={{ source: "actions_card" }}
            >
              {t("detail.actions.viewStore")}
            </Button>
            {/* Demo cancelled state still shows "Crear entrega" (disabled) so the lifecycle
                action set is consistent across cancelled / open. */}
            <Button
              type="button"
              variant="ghost"
              size="md"
              fullWidth
              disabled
              leadingIcon={<Truck size={16} aria-hidden />}
              className="justify-start"
            >
              {t("detail.actions.createDelivery")}
            </Button>
            <DeleteAction
              tooltip={deleteTooltip}
              onClick={() => setModal("delete")}
              label={t("detail.actions.delete")}
            />
          </>
        ) : (
          <>
            {/* Quick arrival outranks the wizard: the common miss is a box already in hand, not a
                shipment being tracked in flight. The wizard stays one tap away as the tonal action. */}
            {canQuickArrive && (
              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                onClick={quickArrival.open}
                leadingIcon={<PackageCheck size={16} aria-hidden />}
                className="justify-start"
              >
                {t("detail.actions.quickArrival")}
              </Button>
            )}

            {/* Both delivery actions need a product that is not yet in a delivery, so they appear
                and disappear together: with everything delivered (or already in transit) the wizard
                would only lead to its own empty state. */}
            {canQuickArrive && (
              <Button
                as="a"
                href={`/${locale}${ROUTES.deliveriesNew}?sourceOrderId=${orderId}`}
                variant="tonal"
                size="md"
                fullWidth
                leadingIcon={<Truck size={16} aria-hidden />}
                className="justify-start"
                posthogEvent={POSTHOG_EVENTS.ORDER.CREATE_DELIVERY_CLICKED}
                posthogProps={{ orderId, status }}
              >
                {t("detail.actions.createDelivery")}
              </Button>
            )}

            <Button
              as="a"
              href={`/${locale}${ROUTES.orders}/${orderId}/edit`}
              variant="ghost"
              size="md"
              fullWidth
              leadingIcon={<Pencil size={16} aria-hidden />}
              className="justify-start"
            >
              {t("detail.actions.edit")}
            </Button>

            <Button
              as="a"
              href={storeHref}
              variant="ghost"
              size="md"
              fullWidth
              leadingIcon={<Store size={16} aria-hidden />}
              className="justify-start"
              posthogEvent={POSTHOG_EVENTS.ORDER.VIEW_STORE_CLICKED}
              posthogProps={{ source: "actions_card" }}
            >
              {t("detail.actions.viewStore")}
            </Button>

            {!isCompleted && (
              <CancelAction
                tooltip={cancelTooltip}
                onClick={() => setModal("cancel")}
                label={t("detail.actions.cancel")}
              />
            )}

            <DeleteAction
              tooltip={deleteTooltip}
              onClick={() => setModal("delete")}
              label={t("detail.actions.delete")}
            />
          </>
        )}
      </div>

      <OrderCancelModal
        isOpen={modal === "cancel"}
        onClose={() => setModal(null)}
        orderId={orderId}
        humanReadableId={humanReadableId}
        storeName={storeName}
        paidAmountMinor={paidAmountMinor}
        currencyCode={currencyCode}
        hasPayments={hasPayments}
        markedItemCount={markedItemCount}
        onSuccess={() => {
          setModal(null);
          router.refresh();
        }}
      />
      <OrderDeleteModal
        isOpen={modal === "delete"}
        onClose={() => setModal(null)}
        orderId={orderId}
        humanReadableId={humanReadableId}
        storeName={storeName}
        locale={locale}
      />
      {canQuickArrive && (
        <QuickArrivalModal
          isOpen={quickArrival.isOpen}
          onClose={quickArrival.close}
          subtitle={`${humanReadableId} · ${storeName}`}
          items={quickArrivalItems}
          settledItemCount={settledItemCount}
          baseCurrencyCode={baseCurrencyCode}
          locale={locale}
          orderId={orderId}
          storeName={storeName}
          onSubmit={quickArrival.submit}
        />
      )}
    </section>
  );
}

function CancelAction({ tooltip, onClick, label }: { tooltip: string | null; onClick: () => void; label: string }) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="md"
      fullWidth
      disabled={tooltip != null}
      onClick={onClick}
      leadingIcon={<Ban size={16} aria-hidden />}
      className="justify-start"
    >
      {label}
    </Button>
  );
  if (tooltip) {
    return (
      <Tooltip content={tooltip} side="bottom" asDiv className="w-full" triggerClassName="w-full">
        {button}
      </Tooltip>
    );
  }
  return button;
}

function DeleteAction({ tooltip, onClick, label }: { tooltip: string | null; onClick: () => void; label: string }) {
  const button = (
    <Button
      type="button"
      variant="destructive-ghost"
      size="md"
      fullWidth
      disabled={tooltip != null}
      onClick={onClick}
      leadingIcon={<Trash2 size={16} aria-hidden />}
      className="justify-start"
    >
      {label}
    </Button>
  );
  if (tooltip) {
    return (
      <Tooltip content={tooltip} side="bottom" asDiv className="w-full" triggerClassName="w-full">
        {button}
      </Tooltip>
    );
  }
  return button;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Ban, Pencil, RotateCcw, Trash2, Truck, Zap } from "lucide-react";
import Button from "@/components/core/Button/Button";
import Eyebrow from "@/components/core/Eyebrow";
import Tooltip from "@/components/core/Tooltip";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import type { OrderEligibility } from "@/lib/data/orders/orderQueries";
import type { OrderStatus } from "../../../../../../../generated/prisma/client";
import { reactivateOrderAction } from "../_actions/orderLifecycleActions";
import OrderCancelModal from "./OrderCancelModal";
import OrderDeleteModal from "./OrderDeleteModal";

type OrderActionsCardProps = {
  orderId: string;
  humanReadableId: string;
  storeName: string;
  status: OrderStatus;
  eligibility: OrderEligibility;
  locale: string;
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
  status,
  eligibility,
  locale,
}: OrderActionsCardProps) {
  const t = useTranslations("orders");
  const router = useRouter();
  const [modal, setModal] = useState<"cancel" | "delete" | null>(null);
  const [isReactivating, setIsReactivating] = useState(false);

  const isCancelled = status === "CANCELLED";
  const isCompleted = status === "COMPLETED";

  async function handleReactivate() {
    setIsReactivating(true);
    const result = await reactivateOrderAction(orderId);
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
            <Button
              as="a"
              href={`/${locale}${ROUTES.deliveriesNew}?sourceOrderId=${orderId}`}
              variant="primary"
              size="md"
              fullWidth
              leadingIcon={<Truck size={16} aria-hidden />}
              className="justify-start"
              posthogEvent={POSTHOG_EVENTS.ORDER.CREATE_DELIVERY_CLICKED}
              posthogProps={{ orderId, status }}
            >
              {t("detail.actions.createDelivery")}
            </Button>

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
      <Tooltip content={tooltip} side="bottom" asDiv>
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
      <Tooltip content={tooltip} side="bottom" asDiv>
        {button}
      </Tooltip>
    );
  }
  return button;
}

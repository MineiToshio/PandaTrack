"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import Button from "@/components/core/Button/Button";
import Tooltip from "@/components/core/Tooltip";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import type { OrderEligibility, OrderFlags } from "@/lib/data/orders/orderQueries";
import type { OrderStatus } from "../../../../../../../generated/prisma/client";
import OrderDangerousActionModal, { type DangerousAction } from "./OrderDangerousActionModal";
import { cancelOrderAction, deleteOrderAction, reactivateOrderAction } from "../_actions/orderLifecycleActions";

type OrderActionBarProps = {
  orderId: string;
  status: OrderStatus;
  eligibility: OrderEligibility;
  flags: OrderFlags;
  locale: string;
  humanReadableId: string;
  storeName: string;
};

type ModalState = { action: DangerousAction } | null;

const ACTIVE_STATUSES: OrderStatus[] = ["OPEN", "PARTIALLY_IN_TRANSIT", "IN_TRANSIT", "PARTIALLY_DELIVERED"];

export default function OrderActionBar({
  orderId,
  status,
  eligibility,
  flags,
  locale,
  humanReadableId,
  storeName,
}: OrderActionBarProps) {
  const t = useTranslations("orders");
  const [moreOpen, setMoreOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [isReactivating, setIsReactivating] = useState(false);

  const isActive = ACTIVE_STATUSES.includes(status);
  const isCompleted = status === "COMPLETED";
  const isCancelled = status === "CANCELLED";

  function handleMoreToggle() {
    setMoreOpen((v) => !v);
    // analytics
    if (!moreOpen) {
      fetch("/api/noop").catch(() => {}); // fire-and-forget placeholder; PostHog fires via data-ph-event
    }
  }

  async function handleReactivate() {
    setIsReactivating(true);
    await reactivateOrderAction(orderId);
    setIsReactivating(false);
    // page revalidation happens via Server Action; a full reload ensures state is fresh
    window.location.reload();
  }

  async function handleConfirmAction() {
    if (!modal) return { ok: false as const, error: "no_action" };
    if (modal.action === "cancel") return cancelOrderAction(orderId);
    return deleteOrderAction(orderId, locale);
  }

  function handleDangerousSuccess() {
    if (modal?.action === "cancel") {
      window.location.reload();
    }
    // delete redirects server-side; no client action needed
  }

  const createDeliveryButton = (
    <Tooltip content={t("detail.actions.createDeliveryTooltip")} side="bottom" asDiv>
      <Button
        variant="primary"
        size="md"
        disabled
        aria-disabled="true"
        posthogEvent={POSTHOG_EVENTS.ORDER.CREATE_DELIVERY_CLICKED}
        posthogProps={{ orderId, status }}
        className="w-full md:w-auto"
      >
        {t("detail.actions.createDelivery")}
      </Button>
    </Tooltip>
  );

  return (
    <div className="relative">
      {/* Desktop / tablet layout */}
      <div className="hidden items-center gap-2 md:flex">
        {isCancelled ? (
          <>
            <Button variant="primary" size="md" onClick={handleReactivate} disabled={isReactivating}>
              {isReactivating ? "…" : t("detail.actions.reactivate")}
            </Button>

            {/* Chevron menu for cancelled: Delete only */}
            <div className="relative">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setMoreOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={moreOpen}
                aria-label={t("detail.actions.more")}
              >
                <ChevronDown className="size-4" aria-hidden />
              </Button>
              {moreOpen && (
                <MoreMenu
                  t={t}
                  showCancel={false}
                  deleteTooltip={!eligibility.canDelete ? t("detail.actions.deleteDisabledTooltip") : undefined}
                  onCancel={() => {}}
                  onDelete={() => {
                    setMoreOpen(false);
                    setModal({ action: "delete" });
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <>
            {createDeliveryButton}

            {/* Split button: Edit (navigate) + ChevronDown (dropdown for cancel/delete) */}
            <div className="relative flex">
              {isActive && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    window.location.href = `/${locale}${ROUTES.purchases}/${orderId}/edit`;
                  }}
                  className="rounded-r-none border-r-0 active:scale-100"
                >
                  {t("detail.actions.edit")}
                </Button>
              )}
              <Button
                variant="secondary"
                size="md"
                onClick={() => setMoreOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={moreOpen}
                aria-label={t("detail.actions.more")}
                posthogEvent={POSTHOG_EVENTS.ORDER.DETAIL_MORE_MENU_OPENED}
                posthogProps={{ orderId }}
                className={cn("px-2.5 active:scale-100", isActive ? "rounded-l-none" : "")}
              >
                <ChevronDown className="size-4" aria-hidden />
              </Button>
              {moreOpen && (
                <MoreMenu
                  t={t}
                  showCancel={isActive}
                  cancelTooltip={
                    !eligibility.canCancel || isCompleted ? t("detail.actions.cancelDisabledTooltip") : undefined
                  }
                  deleteTooltip={
                    !eligibility.canDelete || isCompleted ? t("detail.actions.deleteDisabledTooltip") : undefined
                  }
                  onCancel={() => {
                    setMoreOpen(false);
                    setModal({ action: "cancel" });
                  }}
                  onDelete={() => {
                    setMoreOpen(false);
                    setModal({ action: "delete" });
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Mobile layout */}
      <div className="flex flex-col gap-2 md:hidden">
        {isCancelled ? (
          <Button variant="primary" size="md" onClick={handleReactivate} disabled={isReactivating} className="w-full">
            {isReactivating ? "…" : t("detail.actions.reactivate")}
          </Button>
        ) : (
          <>
            <div className="w-full">{createDeliveryButton}</div>
            {/* Split button on mobile */}
            <div className="relative flex w-full">
              {isActive && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    window.location.href = `/${locale}${ROUTES.purchases}/${orderId}/edit`;
                  }}
                  className="flex-1 rounded-r-none border-r-0 active:scale-100"
                >
                  {t("detail.actions.edit")}
                </Button>
              )}
              <Button
                variant="secondary"
                size="md"
                onClick={handleMoreToggle}
                aria-haspopup="true"
                aria-expanded={moreOpen}
                aria-label={t("detail.actions.more")}
                posthogEvent={POSTHOG_EVENTS.ORDER.DETAIL_MORE_MENU_OPENED}
                posthogProps={{ orderId }}
                className={cn("px-3 active:scale-100", isActive ? "rounded-l-none" : "flex-1")}
              >
                <ChevronDown className="size-4" aria-hidden />
              </Button>
              {moreOpen && (
                <div className="border-border bg-card absolute top-full right-0 z-20 mt-1 w-44 rounded-xl border shadow-md">
                  <MoreMenu
                    t={t}
                    showCancel={isActive}
                    cancelTooltip={
                      !eligibility.canCancel || isCompleted ? t("detail.actions.cancelDisabledTooltip") : undefined
                    }
                    deleteTooltip={
                      !eligibility.canDelete || isCompleted ? t("detail.actions.deleteDisabledTooltip") : undefined
                    }
                    onCancel={() => {
                      setMoreOpen(false);
                      setModal({ action: "cancel" });
                    }}
                    onDelete={() => {
                      setMoreOpen(false);
                      setModal({ action: "delete" });
                    }}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Overlay to close more menu on outside click */}
      {moreOpen && <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} aria-hidden />}

      <OrderDangerousActionModal
        action={modal?.action ?? "cancel"}
        isOpen={modal !== null}
        onClose={() => setModal(null)}
        humanReadableId={humanReadableId}
        storeName={storeName}
        hasPayments={flags.hasPayments}
        onConfirm={handleConfirmAction}
        onSuccess={handleDangerousSuccess}
      />
    </div>
  );
}

type MoreMenuProps = {
  t: ReturnType<typeof useTranslations>;
  showCancel: boolean;
  cancelTooltip?: string;
  deleteTooltip?: string;
  onCancel: () => void;
  onDelete: () => void;
};

function MoreMenu({ t, showCancel, cancelTooltip, deleteTooltip, onCancel, onDelete }: MoreMenuProps) {
  return (
    <div className="border-border bg-card absolute top-full right-0 z-20 mt-1 w-44 rounded-xl border p-1 shadow-lg">
      {showCancel &&
        (cancelTooltip ? (
          <Tooltip content={cancelTooltip} side="bottom" asDiv>
            <button
              type="button"
              disabled
              className="text-text-muted w-full cursor-not-allowed rounded-lg px-3 py-2 text-left text-sm opacity-50"
            >
              {t("detail.actions.cancel")}
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={onCancel}
            className="text-text-body hover:bg-muted w-full rounded-lg px-3 py-2 text-left text-sm"
          >
            {t("detail.actions.cancel")}
          </button>
        ))}
      {deleteTooltip ? (
        <Tooltip content={deleteTooltip} side="bottom" asDiv>
          <button
            type="button"
            disabled
            className="text-text-muted w-full cursor-not-allowed rounded-lg px-3 py-2 text-left text-sm opacity-50"
          >
            {t("detail.actions.delete")}
          </button>
        </Tooltip>
      ) : (
        <button
          type="button"
          onClick={onDelete}
          className="text-destructive hover:bg-destructive/10 w-full rounded-lg px-3 py-2 text-left text-sm"
        >
          {t("detail.actions.delete")}
        </button>
      )}
    </div>
  );
}

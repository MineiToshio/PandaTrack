"use client";

import { useEffect, useRef, useState } from "react";
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

  // Tracks the trigger button that opened the menu so focus returns to it on close
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const isActive = ACTIVE_STATUSES.includes(status);
  const isCompleted = status === "COMPLETED";
  const isCancelled = status === "CANCELLED";

  function openMoreMenu(trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    setMoreOpen(true);
  }

  function closeMoreMenu() {
    setMoreOpen(false);
    triggerRef.current?.focus();
  }

  // Close on Escape and return focus to the trigger that opened the menu
  useEffect(() => {
    if (!moreOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeMoreMenu();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [moreOpen]);

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

  return (
    <div className="relative">
      {/* Single responsive layout: mobile stacks vertically, tablet (md+) side by side */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        {isCancelled ? (
          <>
            <Button
              variant="primary"
              size="md"
              onClick={handleReactivate}
              disabled={isReactivating}
              className="w-full md:w-auto"
            >
              {isReactivating ? "…" : t("detail.actions.reactivate")}
            </Button>

            {/* Chevron menu for cancelled: Delete only */}
            <div className="relative w-full md:w-auto">
              <Button
                variant="secondary"
                size="md"
                onClick={(e) => openMoreMenu(e.currentTarget)}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                aria-label={t("detail.actions.more")}
                className="w-full md:w-auto"
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
                    closeMoreMenu();
                    setModal({ action: "delete" });
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <>
            {/* Crear entrega — full width on mobile, auto on tablet */}
            <Tooltip
              content={t("detail.actions.createDeliveryTooltip")}
              side="bottom"
              asDiv
              className="w-full md:w-auto"
              triggerClassName="w-full md:w-auto"
            >
              <Button
                variant="primary"
                size="md"
                tabIndex={0}
                aria-disabled="true"
                onClick={(e) => e.preventDefault()}
                posthogEvent={POSTHOG_EVENTS.ORDER.CREATE_DELIVERY_CLICKED}
                posthogProps={{ orderId, status }}
                className="w-full md:w-auto"
              >
                {t("detail.actions.createDelivery")}
              </Button>
            </Tooltip>

            {/* Split button: Edit (navigate) + ChevronDown (more menu) */}
            <div className="relative flex w-full md:w-auto">
              {isActive && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    window.location.href = `/${locale}${ROUTES.purchases}/${orderId}/edit`;
                  }}
                  className="flex-1 rounded-r-none border-r-0 active:scale-100 md:flex-initial"
                >
                  {t("detail.actions.edit")}
                </Button>
              )}
              <Button
                variant="secondary"
                size="md"
                onClick={(e) => openMoreMenu(e.currentTarget)}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                aria-label={t("detail.actions.more")}
                posthogEvent={POSTHOG_EVENTS.ORDER.DETAIL_MORE_MENU_OPENED}
                posthogProps={{ orderId }}
                className={cn(
                  "active:scale-100",
                  isActive ? "rounded-l-none px-3 md:px-2.5" : "flex-1 px-2.5 md:flex-initial",
                )}
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
                    closeMoreMenu();
                    setModal({ action: "cancel" });
                  }}
                  onDelete={() => {
                    closeMoreMenu();
                    setModal({ action: "delete" });
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Overlay to close more menu on outside click */}
      {moreOpen && <div className="fixed inset-0 z-10" onClick={closeMoreMenu} aria-hidden />}

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
    <div
      role="menu"
      className="border-border bg-card absolute top-full right-0 z-20 mt-1 w-44 rounded-xl border p-1 shadow-lg"
    >
      {showCancel &&
        (cancelTooltip ? (
          <Tooltip content={cancelTooltip} side="bottom" asDiv>
            <button
              type="button"
              role="menuitem"
              disabled
              className="text-text-muted w-full cursor-not-allowed rounded-lg px-3 py-2 text-left text-sm opacity-50"
            >
              {t("detail.actions.cancel")}
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            role="menuitem"
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
            role="menuitem"
            disabled
            className="text-text-muted w-full cursor-not-allowed rounded-lg px-3 py-2 text-left text-sm opacity-50"
          >
            {t("detail.actions.delete")}
          </button>
        </Tooltip>
      ) : (
        <button
          type="button"
          role="menuitem"
          onClick={onDelete}
          className="text-destructive hover:bg-destructive/10 w-full rounded-lg px-3 py-2 text-left text-sm"
        >
          {t("detail.actions.delete")}
        </button>
      )}
    </div>
  );
}

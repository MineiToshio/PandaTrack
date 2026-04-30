"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Ban, ChevronDown, MoreHorizontal, Pencil, RotateCcw, Store, Trash2, Truck } from "lucide-react";
import Button from "@/components/core/Button/Button";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import Tooltip from "@/components/core/Tooltip";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import { DETAIL_HERO_ACTION_BUTTON_CLASSNAME, DETAIL_HERO_ACTIONS_CLASSNAME } from "@/lib/styles";
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
  storeHref: string;
  storeId: string;
  storeSlug: string;
};

type ModalState = { action: DangerousAction } | null;

export default function OrderActionBar({
  orderId,
  status,
  eligibility,
  flags,
  locale,
  humanReadableId,
  storeName,
  storeHref,
  storeId,
  storeSlug,
}: OrderActionBarProps) {
  const router = useRouter();
  const t = useTranslations("orders");
  const [moreOpen, setMoreOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [isReactivating, setIsReactivating] = useState(false);

  // Tracks the trigger button that opened the menu so focus returns to it on close
  const triggerRef = useRef<HTMLButtonElement | null>(null);

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

  function handleEditNavigation() {
    closeMoreMenu();
    router.push(`/${locale}${ROUTES.orders}/${orderId}/edit`);
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
      <div className={DETAIL_HERO_ACTIONS_CLASSNAME}>
        {isCancelled ? (
          <>
            <Button
              variant="primary"
              size="md"
              onClick={handleReactivate}
              disabled={isReactivating}
              className={DETAIL_HERO_ACTION_BUTTON_CLASSNAME}
            >
              <RotateCcw className="size-4 shrink-0" aria-hidden />
              {isReactivating ? "…" : t("detail.actions.reactivate")}
            </Button>

            <div className="relative w-full lg:w-auto">
              <Button
                variant="secondary"
                size="md"
                onClick={(e) => openMoreMenu(e.currentTarget)}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                aria-label={t("detail.actions.more")}
                posthogEvent={POSTHOG_EVENTS.ORDER.DETAIL_MORE_MENU_OPENED}
                posthogProps={{ orderId }}
                className={DETAIL_HERO_ACTION_BUTTON_CLASSNAME}
              >
                <MoreHorizontal className="size-4 shrink-0" aria-hidden />
                {t("detail.actions.more")}
              </Button>
              {moreOpen && (
                <MoreMenu
                  t={t}
                  showCancel={false}
                  showEdit={false}
                  orderId={orderId}
                  storeHref={storeHref}
                  storeId={storeId}
                  storeSlug={storeSlug}
                  deleteTooltip={!eligibility.canDelete ? t("detail.actions.deleteDisabledTooltip") : undefined}
                  onEdit={handleEditNavigation}
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
            <Link
              href={`/${locale}${ROUTES.deliveriesNew}?sourceOrderId=${orderId}`}
              data-ph-event={POSTHOG_EVENTS.ORDER.CREATE_DELIVERY_CLICKED}
              data-ph-props={JSON.stringify({ orderId, status })}
              className={cn(buttonVariants({ variant: "primary", size: "md" }), DETAIL_HERO_ACTION_BUTTON_CLASSNAME)}
            >
              <Truck className="size-4 shrink-0" aria-hidden />
              {t("detail.actions.createDelivery")}
            </Link>

            <div className="relative flex w-full lg:w-auto">
              <Button
                variant="secondary"
                size="md"
                onClick={handleEditNavigation}
                className="min-h-11 flex-1 justify-center gap-1.5 rounded-r-none border-r-0 shadow-md hover:shadow-lg lg:w-auto lg:flex-initial"
              >
                <Pencil className="size-4 shrink-0" aria-hidden />
                {t("detail.actions.edit")}
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={(e) => openMoreMenu(e.currentTarget)}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                aria-label={t("detail.actions.more")}
                posthogEvent={POSTHOG_EVENTS.ORDER.DETAIL_MORE_MENU_OPENED}
                posthogProps={{ orderId }}
                className="min-h-11 w-12 justify-center rounded-l-none px-0 shadow-md hover:shadow-lg lg:w-auto lg:px-3"
              >
                <ChevronDown className="size-4 shrink-0" aria-hidden />
              </Button>
              {moreOpen && (
                <MoreMenu
                  t={t}
                  showCancel={!isCancelled}
                  showEdit={false}
                  orderId={orderId}
                  storeHref={storeHref}
                  storeId={storeId}
                  storeSlug={storeSlug}
                  cancelTooltip={
                    !eligibility.canCancel || isCompleted ? t("detail.actions.cancelDisabledTooltip") : undefined
                  }
                  deleteTooltip={
                    !eligibility.canDelete || isCompleted ? t("detail.actions.deleteDisabledTooltip") : undefined
                  }
                  onEdit={handleEditNavigation}
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
  showEdit: boolean;
  orderId: string;
  storeHref: string;
  storeId: string;
  storeSlug: string;
  cancelTooltip?: string;
  deleteTooltip?: string;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
};

function MoreMenu({
  t,
  showCancel,
  showEdit,
  orderId,
  storeHref,
  storeId,
  storeSlug,
  cancelTooltip,
  deleteTooltip,
  onEdit,
  onCancel,
  onDelete,
}: MoreMenuProps) {
  return (
    <div
      role="menu"
      className="border-border bg-card absolute top-full right-0 z-20 mt-1 w-44 rounded-xl border p-1 shadow-lg"
    >
      {showEdit && (
        <button
          type="button"
          role="menuitem"
          onClick={onEdit}
          className="text-text-body hover:bg-muted flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm"
        >
          <Pencil className="size-4 shrink-0" aria-hidden />
          {t("detail.actions.edit")}
        </button>
      )}
      <Link
        href={storeHref}
        role="menuitem"
        className="text-text-body hover:bg-muted flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm"
        data-ph-event={POSTHOG_EVENTS.ORDER.VIEW_STORE_CLICKED}
        data-ph-props={JSON.stringify({ orderId, storeId, storeSlug })}
      >
        <Store className="size-4 shrink-0" aria-hidden />
        {t("detail.actions.viewStore")}
      </Link>
      {showCancel &&
        (cancelTooltip ? (
          <Tooltip content={cancelTooltip} side="bottom" asDiv>
            <button
              type="button"
              role="menuitem"
              disabled
              className="text-text-muted flex w-full cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-left text-sm opacity-50"
            >
              <Ban className="size-4 shrink-0" aria-hidden />
              {t("detail.actions.cancel")}
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            role="menuitem"
            onClick={onCancel}
            className="text-text-body hover:bg-muted flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm"
          >
            <Ban className="size-4 shrink-0" aria-hidden />
            {t("detail.actions.cancel")}
          </button>
        ))}
      {deleteTooltip ? (
        <Tooltip content={deleteTooltip} side="bottom" asDiv>
          <button
            type="button"
            role="menuitem"
            disabled
            className="text-text-muted flex w-full cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-left text-sm opacity-50"
          >
            <Trash2 className="size-4 shrink-0" aria-hidden />
            {t("detail.actions.delete")}
          </button>
        </Tooltip>
      ) : (
        <button
          type="button"
          role="menuitem"
          onClick={onDelete}
          className="text-destructive hover:bg-destructive/10 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm"
        >
          <Trash2 className="size-4 shrink-0" aria-hidden />
          {t("detail.actions.delete")}
        </button>
      )}
    </div>
  );
}

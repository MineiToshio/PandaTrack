"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Ban, CheckCircle } from "lucide-react";
import Button from "@/components/core/Button/Button";
import { ROUTES } from "@/lib/constants";
import { useToast } from "@/contexts/ToastContext";
import type { StoreRemovalReasonValue } from "@/lib/store/removalReason";
import { approveStoreAction, removeStoreAction, type ModerateStoreResult } from "../_actions/moderateStore";
import StoreRemovalModal from "@/components/modules/StoreRemovalModal";

/** Statuses this panel can act on; a `REJECTED` store 404s before the panel ever renders. */
type ModeratableStatus = "PENDING" | "APPROVED";

type StoreAdminModerationPanelProps = {
  locale: string;
  storeSlug: string;
  storeName: string;
  initialStatus: ModeratableStatus;
};

/**
 * Admin-only moderation controls for a store's own lifecycle: publish it (`Aprobar`) or take it down
 * (`Retirar`). There is deliberately no "mark it" control in between: the public report notice is
 * derived from open reports, so nothing writes it by hand, and reports are acted on through the
 * governance panel instead.
 *
 * The approval is optimistic: the panel reflects the new status immediately and reverts on failure
 * with a toast. Removal uses Optimistic Confirmation — the modal closes synchronously on submit and
 * the panel coordinates the navigation-away (the store 404s) or the rollback toast.
 */
export default function StoreAdminModerationPanel({
  locale,
  storeSlug,
  storeName,
  initialStatus,
}: StoreAdminModerationPanelProps) {
  const t = useTranslations("stores.moderation");
  const { addToast } = useToast();
  const router = useRouter();
  // Initialized from the server-provided status. The parent remounts this panel (keyed on the
  // store status) after each successful revalidation, so a fresh server status re-seeds local state
  // without a prop-sync effect.
  const [status, setStatus] = useState<ModeratableStatus>(initialStatus);
  const [isPending, setIsPending] = useState(false);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  // Bumped on each open so the modal remounts with a clean form, without resetting on close (which
  // would drop the exit animation).
  const [removeOpenCount, setRemoveOpenCount] = useState(0);

  const openRemoveModal = () => {
    setRemoveOpenCount((count) => count + 1);
    setIsRemoveOpen(true);
  };

  const translateError = (errorKey: string) =>
    t.has(`errors.${errorKey}`) ? t(`errors.${errorKey}`) : t("errors.moderationFailed");

  const showError = (result: Extract<ModerateStoreResult, { success: false }>) => {
    addToast(translateError(result.error), { variant: "error" });
  };

  /** Runs an optimistic inline transition: apply the new status, call the action, revert on failure. */
  const runInlineTransition = async (
    nextStatus: ModeratableStatus,
    action: () => Promise<ModerateStoreResult>,
    successToastKey: string,
  ) => {
    if (isPending) return;
    const previousStatus = status;
    setIsPending(true);
    setStatus(nextStatus);

    const result = await action();

    if (result.success) {
      addToast(t(successToastKey), { variant: "success" });
    } else {
      setStatus(previousStatus);
      showError(result);
    }
    setIsPending(false);
  };

  const handleApprove = () => {
    void runInlineTransition("APPROVED", () => approveStoreAction({ slug: storeSlug, locale }), "toasts.approved");
  };

  const handleRemoveConfirm = async (removalReason: StoreRemovalReasonValue, note: string | null) => {
    if (isPending) return;
    // Optimistic Confirmation: close the modal synchronously, then reconcile in the background.
    setIsRemoveOpen(false);
    setIsPending(true);

    const result = await removeStoreAction({ slug: storeSlug, locale, removalReason, note });

    if (result.success) {
      addToast(t("toasts.removed"), { variant: "success" });
      // The removed store now 404s on its own URL, so route the admin back to the listing.
      router.push(`/${locale}${ROUTES.stores}`);
      return;
    }

    setIsPending(false);
    showError(result);
  };

  return (
    <div className="flex flex-col gap-2">
      {status === "PENDING" && (
        <Button
          type="button"
          variant="primary"
          fullWidth
          className="justify-start"
          leadingIcon={<CheckCircle size={16} aria-hidden="true" />}
          onClick={handleApprove}
          disabled={isPending}
        >
          {t("approveCta")}
        </Button>
      )}

      <Button
        type="button"
        variant="destructive-ghost"
        fullWidth
        className="justify-start"
        leadingIcon={<Ban size={16} aria-hidden="true" />}
        onClick={openRemoveModal}
        disabled={isPending}
      >
        {t("removeCta")}
      </Button>

      <StoreRemovalModal
        key={removeOpenCount}
        isOpen={isRemoveOpen}
        onClose={() => setIsRemoveOpen(false)}
        storeName={storeName}
        isPending={isPending}
        onConfirm={handleRemoveConfirm}
      />
    </div>
  );
}

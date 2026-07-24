"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Ban } from "lucide-react";
import Button from "@/components/core/Button/Button";
import StoreRemovalModal from "@/components/modules/StoreRemovalModal";
import type { StoreRemovalReasonValue } from "@/lib/store/removalReason";
import { removeStoreAction } from "@/app/[locale]/(app)/stores/[slug]/_actions/moderateStore";
import { useModerationAction } from "../_hooks/useModerationAction";

type StoreRemovalControlProps = {
  slug: string;
  storeName: string;
  locale: string;
  /** Button label; the report review uses "Retirar tienda", the others "Retirar". */
  label: string;
};

/**
 * "Retirar" control shared by the pending-store, report, and suggested-removal reviews (`FR-02-21`). It
 * opens the promoted FRD-04 removal modal and coordinates `removeStoreAction` with Optimistic
 * Confirmation: the modal closes synchronously on confirm, then the action runs and the console
 * refreshes. The modal is remounted per open (keyed on an open counter) so each open starts clean.
 */
export default function StoreRemovalControl({ slug, storeName, locale, label }: StoreRemovalControlProps) {
  const t = useTranslations("admin.review");
  const { isPending, run } = useModerationAction();
  const [isOpen, setIsOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0);

  const handleOpen = () => {
    setOpenCount((count) => count + 1);
    setIsOpen(true);
  };

  const handleConfirm = (reason: StoreRemovalReasonValue, note: string | null) => {
    // Optimistic Confirmation: dismiss the modal synchronously, then run the transition.
    setIsOpen(false);
    void run(
      () => removeStoreAction({ slug, locale, removalReason: reason, note }),
      () => t("toast.removed"),
    );
  };

  return (
    <>
      <Button
        variant="destructive-ghost"
        size="sm"
        leadingIcon={<Ban className="h-4 w-4" aria-hidden />}
        onClick={handleOpen}
        disabled={isPending}
      >
        {label}
      </Button>
      <StoreRemovalModal
        key={openCount}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        storeName={storeName}
        isPending={isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
}

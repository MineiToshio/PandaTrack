"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToast } from "@/contexts/ToastContext";

type ActionResult = { success: true; [key: string]: unknown } | { success: false; error: string };

/**
 * Shared coordinator for a moderation review action. It runs the FRD-04 server action, then on success
 * shows a success toast and re-reads the console with `router.refresh()` so the resolved item leaves
 * the queue and the pane advances (`BR-02-02`: the refresh is a console-side concern, the action stays
 * unaware of the admin route). On failure it surfaces an error toast and leaves the queue untouched, so
 * the administrator can retry. Modal-based flows close their surface synchronously before calling `run`
 * (Optimistic Confirmation); this hook owns the toast and rollback signal.
 */
export function useModerationAction() {
  const router = useRouter();
  const { addToast } = useToast();
  const t = useTranslations("admin.review");
  const [isPending, setIsPending] = useState(false);

  const run = useCallback(
    async <R extends ActionResult>(
      action: () => Promise<R>,
      getSuccessMessage: (result: Extract<R, { success: true }>) => string,
    ): Promise<void> => {
      setIsPending(true);
      try {
        const result = await action();
        if (result.success) {
          addToast(getSuccessMessage(result as Extract<R, { success: true }>), { variant: "success" });
          router.refresh();
        } else {
          addToast(t("errors.generic"), { variant: "error" });
        }
      } catch {
        addToast(t("errors.generic"), { variant: "error" });
      } finally {
        setIsPending(false);
      }
    },
    [addToast, router, t],
  );

  return { isPending, run };
}

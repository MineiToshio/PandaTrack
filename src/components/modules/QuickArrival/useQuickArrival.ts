"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { useToast } from "@/contexts/ToastContext";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import {
  quickArrivalAction,
  type QuickArrivalActionInput,
} from "@/app/[locale]/(app)/_actions/quickArrivalAction";

export type QuickArrivalSubmitInput = Omit<QuickArrivalActionInput, "orderId">;

type UseQuickArrivalParams = {
  orderId: string;
  locale: string;
  /** Where the launcher lives, so the funnel can compare the entry points against each other. */
  source: "actions_card" | "mobile_actions" | "dashboard_activity" | "order_list";
  /** Extra granularity for launchers that appear in more than one list (upcoming vs overdue). */
  sourceList?: string;
};

/**
 * Coordinator for the quick-arrival flow, shared by every launcher (the order detail's desktop and
 * mobile action cards, and the dashboard activity rows) so a single handler owns dismissal,
 * analytics, error copy and the success toast.
 *
 * Deliberately NOT optimistic in its body: the order status, the product pills and the dashboard
 * arrival lists are all server-derived from the delivery association, so the caller refreshes
 * rather than guessing the new state. This is the same exception already taken by the reactivate
 * action in `OrderActionsCard`. The modal still dismisses synchronously on submit (Optimistic
 * Confirmation) so the collector never watches a spinner.
 *
 * There is no undo affordance on purpose: reversing a quick arrival would have to invent a prior
 * product state (an item that started at `NONE` cannot be distinguished from one that started at
 * `ARRIVED_AT_STORE` once the delivery exists), so the toast links to the created delivery, where
 * reopen, edit and delete already live.
 */
export function useQuickArrival({ orderId, locale, source, sourceList }: UseQuickArrivalParams) {
  const t = useTranslations("orders");
  const router = useRouter();
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    posthog.capture(POSTHOG_EVENTS.DELIVERY.QUICK_ARRIVAL_OPENED, { order_id: orderId, source, list: sourceList });
    setIsOpen(true);
  }, [orderId, source, sourceList]);

  const close = useCallback(() => setIsOpen(false), []);

  const submit = useCallback(
    (input: QuickArrivalSubmitInput) => {
      void quickArrivalAction({ orderId, ...input }).then((result) => {
        if (!result.ok) {
          const key = `detail.quickArrival.error.${result.error}` as const;
          addToast(t.has(key as never) ? t(key as never) : t("detail.quickArrival.error.server_error"), {
            variant: "error",
          });
          return;
        }

        addToast(t("detail.quickArrival.toast.success", { count: input.productIds.length }), {
          variant: "success",
          action: {
            label: t("detail.quickArrival.toast.viewDelivery"),
            onClick: () => router.push(`/${locale}${ROUTES.deliveries}/${result.deliveryId}`),
          },
        });
        router.refresh();
      });
    },
    [addToast, locale, orderId, router, t],
  );

  return { isOpen, open, close, submit };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { useToast } from "@/contexts/ToastContext";
import { useProgressionFeedback } from "@/contexts/ProgressionFeedbackContext";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { quickArrivalAction, type QuickArrivalActionInput } from "@/app/[locale]/(app)/_actions/quickArrivalAction";
import { retrySettlementAction } from "@/app/[locale]/(app)/_actions/settlementActions";
import { domainDateToIsoString } from "@/lib/domainDate";
import {
  clearPendingSettlement,
  formatSettledTotals,
  writePendingSettlement,
  type PendingSettlementEntry,
} from "@/lib/deliveries/pendingSettlementStore";

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
 *
 * Settlement on arrival (`WO-08`): the arrival itself is committed by the time this handler's
 * promise resolves, but the MONEY step (`moneyOutcomes`) can come back `refused` or `pending`
 * (the delivery transaction and the money transaction are independent, `ADR 0032`). When that
 * happens the arrival-only toast is shown with a `Retry` action, and the retry intent is persisted
 * to `pendingSettlementStore` so the affordance survives navigation to the delivery detail.
 */
export function useQuickArrival({ orderId, locale, source, sourceList }: UseQuickArrivalParams) {
  const t = useTranslations("orders");
  // Shared store-payment error copy (MAJOR F7, 2026-08-20 review): a "refused" money outcome carries
  // a `CreateStorePaymentError` code, and this namespace already has copy for every one of them
  // (`orders.detail.storePayment.error.*`), so a refusal reuses it instead of a second, drifting set.
  const tPayment = useTranslations("orders.detail.storePayment");
  const router = useRouter();
  const { addToast } = useToast();
  const { announceProgression } = useProgressionFeedback();
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    posthog.capture(POSTHOG_EVENTS.DELIVERY.QUICK_ARRIVAL_OPENED, { order_id: orderId, source, list: sourceList });
    setIsOpen(true);
  }, [orderId, source, sourceList]);

  const close = useCallback(() => setIsOpen(false), []);

  // Latest-ref so the retry-of-a-retry action (offered on a repeated failure) always calls the
  // current closure rather than one captured at the time the first toast was created — the same
  // pattern `DeliveryDetailClient`'s reopen-undo toast already uses for its own self-reference.
  const retryPendingRef = useRef<(deliveryId: string, entry: PendingSettlementEntry) => void>(() => {});

  const retryPending = useCallback(
    (deliveryId: string, entry: PendingSettlementEntry) => {
      void retrySettlementAction({
        deliveryId,
        settleRemainder: entry.settleRemainder,
        settlementDate: new Date(`${entry.settlementDate}T00:00:00.000Z`),
        settlementIntents: entry.settlementIntents,
      }).then(
        (result) => {
          if (!result.ok) {
            addToast(t("detail.quickArrival.error.server_error"), { variant: "error" });
            return;
          }
          if (result.noLongerPending) {
            clearPendingSettlement(deliveryId);
            addToast(t("detail.quickArrival.settlement.noLongerPending"), { variant: "neutral" });
            return;
          }

          // MAJOR F7, 2026-08-20 review: a "refused" outcome is a genuine business refusal (a stale
          // allocation, an amount that no longer fits the balance), never transient — retrying it
          // verbatim would only refuse again. Only "pending" (a thrown, transient failure) still gets
          // the persisted Retry banner below.
          const refusedOutcome = result.outcomes.find((outcome) => outcome.status === "refused");
          if (refusedOutcome) {
            clearPendingSettlement(deliveryId);
            const key = `error.${refusedOutcome.error}` as const;
            addToast(tPayment.has(key as never) ? tPayment(key as never) : tPayment("error.server_error"), {
              variant: "error",
            });
            return;
          }

          const stillPending = result.outcomes.some((outcome) => outcome.status === "pending");
          if (stillPending) {
            addToast(t("detail.quickArrival.settlement.retryFailed"), {
              variant: "error",
              action: {
                label: t("detail.quickArrival.settlement.retry"),
                onClick: () => retryPendingRef.current(deliveryId, entry),
              },
            });
            return;
          }
          clearPendingSettlement(deliveryId);
          const settledLabel = formatSettledTotals(result.outcomes, locale);
          addToast(
            settledLabel
              ? t("detail.quickArrival.settlement.confirmation", { amount: settledLabel })
              : t("detail.quickArrival.toast.success", { count: 1 }),
            { variant: "success" },
          );
          router.refresh();
        },
        () => {
          // A REJECTED promise is not a refusal the server described, it is no answer at all — same
          // treatment as `ok: false` above, and deliberately the SECOND argument of `then` (the
          // established pattern in `StoreGroupedView.handleSubmitArrival`), never a chained `catch`,
          // which would also swallow whatever the success handler throws. The pending entry is left
          // in place so the collector can retry again from the same toast action.
          addToast(t("detail.quickArrival.error.server_error"), { variant: "error" });
        },
      );
    },
    [addToast, locale, router, t, tPayment],
  );
  // Keep the latest closure available to the toast action created above (mirrors
  // `DeliveryDetailClient`'s own `undoHandlerRef` wiring for its reopen-undo toast).
  useEffect(() => {
    retryPendingRef.current = retryPending;
  });

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

        // MAJOR F7, 2026-08-20 review: "refused" is a genuine business refusal (never transient),
        // so it gets a dismissable notice instead of a persisted Retry entry. Only "pending" (the
        // money transaction threw, a genuinely transient failure) still gets the Retry banner.
        const refusedOutcome = result.moneyOutcomes.find((outcome) => outcome.status === "refused");
        const needsRetry = result.moneyOutcomes.some((outcome) => outcome.status === "pending");

        // The arrival itself is committed on every branch below, refusals of the MONEY step
        // included, so each of them announces what it credited after raising its own toast. Only
        // one branch ever runs, so the collector sees the announcement exactly once.
        if (refusedOutcome) {
          const key = `error.${refusedOutcome.error}` as const;
          addToast(tPayment.has(key as never) ? tPayment(key as never) : tPayment("error.server_error"), {
            variant: "error",
          });
          announceProgression(result.progression);
          router.refresh();
          return;
        }

        if (needsRetry && input.settleRemainder) {
          const entry: PendingSettlementEntry = {
            deliveryId: result.deliveryId,
            settleRemainder: input.settleRemainder,
            // MAJOR F5, 2026-08-20 review: `input.settlementDate`/`input.receivedDate` are already
            // domain dates (UTC midnight, `toDomainDate`-normalized by `QuickArrivalModal` before
            // they ever reach this handler). `domainDateToIsoString` reads that UTC calendar day
            // directly; the old `toLocalIsoDateString` used local getters, which shifts the day
            // backward for a collector whose timezone sits west of UTC (e.g. `America/Lima`).
            settlementDate: domainDateToIsoString(input.settlementDate ?? input.receivedDate) ?? "",
            settlementIntents: input.settlementIntents ?? [],
            createdAt: new Date().toISOString(),
          };
          writePendingSettlement(entry);
          addToast(t("detail.quickArrival.toast.success", { count: input.productIds.length }), {
            variant: "success",
            action: {
              label: t("detail.quickArrival.settlement.retry"),
              onClick: () => retryPending(result.deliveryId, entry),
            },
          });
          announceProgression(result.progression);
          router.refresh();
          return;
        }

        const settledLabel = formatSettledTotals(result.moneyOutcomes, locale);
        addToast(
          settledLabel
            ? t("detail.quickArrival.settlement.confirmation", { amount: settledLabel })
            : t("detail.quickArrival.toast.success", { count: input.productIds.length }),
          {
            variant: "success",
            action: {
              label: t("detail.quickArrival.toast.viewDelivery"),
              onClick: () => router.push(`/${locale}${ROUTES.deliveries}/${result.deliveryId}`),
            },
          },
        );
        announceProgression(result.progression);
        router.refresh();
      });
    },
    [addToast, announceProgression, locale, orderId, retryPending, router, t, tPayment],
  );

  return { isOpen, open, close, submit };
}

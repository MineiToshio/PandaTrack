"use server";

import * as Sentry from "@sentry/nextjs";
import { flattenError } from "zod";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { editDelivery } from "@/lib/data/deliveries/deliveryMutations";
import { deliveryEditSchema } from "@/lib/deliveries/deliveryValidation";
import { parseDecimalToMinorUnits } from "@/lib/money/parseDecimalToMinorUnits";
import { getUserCurrencyContext } from "@/lib/data/user-settings/userSettingsQueries";
import type { DeliveryCreateActionResult } from "../../../new/_actions/createDeliveryAction";
import { revalidateCollectionSurfaces } from "@/lib/cache/revalidateCollectionSurfaces";

function parseProductIds(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

/** Same result contract as create so the shared form consumes one shape. */
export async function editDeliveryAction(
  _prev: DeliveryCreateActionResult | null,
  formData: FormData,
): Promise<DeliveryCreateActionResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { success: false, error: "unauthorized" };
  }
  const userId = session.user.id;

  const exchangeRateRaw = formData.get("exchangeRate");
  const currencyCodeRaw = formData.get("currencyCode");
  const currencyCode = typeof currencyCodeRaw === "string" ? currencyCodeRaw : undefined;
  const user = await getUserCurrencyContext(userId);
  const exchangeRate =
    typeof exchangeRateRaw === "string" && exchangeRateRaw.trim() !== "" ? parseFloat(exchangeRateRaw) : null;

  const raw = {
    deliveryId: formData.get("deliveryId") ?? undefined,
    deliveryDate: formData.get("deliveryDate") ?? undefined,
    expectedArrivalFrom: formData.get("expectedArrivalFrom") || null,
    expectedArrivalTo: formData.get("expectedArrivalTo") || null,
    cost: parseDecimalToMinorUnits(
      typeof formData.get("cost") === "string" ? String(formData.get("cost")) : null,
      currencyCode,
    ),
    currencyCode,
    exchangeRate,
    productIds: parseProductIds(formData.get("productIds")),
  };

  const parsed = deliveryEditSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "validation",
      fieldErrors: flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  if (
    user?.baseCurrencyCode &&
    parsed.data.currencyCode &&
    parsed.data.currencyCode !== user.baseCurrencyCode &&
    parsed.data.exchangeRate == null
  ) {
    return {
      success: false,
      error: "validation",
      fieldErrors: { exchangeRate: ["EXCHANGE_RATE_REQUIRED"] },
    };
  }

  const { deliveryId, ...input } = parsed.data;

  try {
    const result = await editDelivery(deliveryId, userId, { ...input, productIds: input.productIds ?? [] });
    if (!result.ok) {
      return { success: false, error: result.error };
    }

    // Any cached copy of a list or the dashboard is now wrong; see the helper for why

    // `router.refresh()` on the client is not enough.

    revalidateCollectionSurfaces();

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.DELIVERY.EDITED,
      properties: {
        deliveryId,
        product_count: result.productCount,
        added_count: result.addedCount,
        removed_count: result.removedCount,
      },
    });
    await posthog.shutdown();

    return { success: true, deliveryId };
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag("feature", "delivery_edit");
      scope.setContext("deliveryEdit", {
        deliveryId,
        productCount: parsed.data.productIds?.length ?? 0,
        hasExchangeRate: parsed.data.exchangeRate != null,
      });
      Sentry.captureException(error);
    });
    return { success: false, error: "server_error" };
  }
}

"use server";

import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { createDelivery } from "@/lib/data/deliveries/deliveryMutations";
import { deliveryCreateSchema } from "@/lib/deliveries/deliveryValidation";
import { parseDecimalToMinorUnits } from "@/lib/money/parseDecimalToMinorUnits";
import { prisma } from "@/lib/prisma";

export type DeliveryCreateActionResult =
  | { success: true; deliveryId: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]>; ineligibleProductIds?: string[] };

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

function getOptionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function createDeliveryAction(
  _prev: DeliveryCreateActionResult | null,
  formData: FormData,
): Promise<DeliveryCreateActionResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { success: false, error: "unauthorized" };
  }
  const userId = session.user.id;

  const exchangeRateRaw = formData.get("exchangeRate");
  const currencyCode = formData.get("currencyCode");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { baseCurrencyCode: true } });
  const exchangeRate =
    typeof exchangeRateRaw === "string" && exchangeRateRaw.trim() !== "" ? parseFloat(exchangeRateRaw) : null;

  const raw = {
    storeId: formData.get("storeId") ?? undefined,
    deliveryDate: formData.get("deliveryDate") ?? undefined,
    expectedArrivalFrom: formData.get("expectedArrivalFrom") || null,
    expectedArrivalTo: formData.get("expectedArrivalTo") || null,
    cost: parseDecimalToMinorUnits(typeof formData.get("cost") === "string" ? String(formData.get("cost")) : null),
    currencyCode,
    exchangeRate,
    productIds: parseProductIds(formData.get("productIds")),
  };

  const parsed = deliveryCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "validation",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  if (
    user?.baseCurrencyCode &&
    parsed.data.currencyCode !== user.baseCurrencyCode &&
    parsed.data.exchangeRate == null
  ) {
    return {
      success: false,
      error: "validation",
      fieldErrors: { exchangeRate: ["EXCHANGE_RATE_REQUIRED"] },
    };
  }

  const entryPoint = formData.get("entryPoint") === "from_order" ? "from_order" : "standalone";
  const sourceOrderId = getOptionalString(formData.get("sourceOrderId"));

  try {
    const result = await createDelivery(userId, parsed.data);
    if (!result.ok) {
      return { success: false, error: result.error, ineligibleProductIds: result.ineligibleProductIds };
    }

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.DELIVERY.CREATED,
      properties: {
        deliveryId: result.deliveryId,
        product_count: result.productCount,
        order_count: result.orderCount,
        entry_point: entryPoint,
      },
    });
    await posthog.shutdown();

    return { success: true, deliveryId: result.deliveryId };
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag("feature", "delivery_create");
      scope.setTag("entry_point", entryPoint);
      scope.setContext("deliveryCreate", {
        storeId: parsed.data.storeId,
        productCount: parsed.data.productIds.length,
        hasExpectedArrivalFrom: Boolean(parsed.data.expectedArrivalFrom),
        hasExpectedArrivalTo: Boolean(parsed.data.expectedArrivalTo),
        currencyCode: parsed.data.currencyCode,
        hasExchangeRate: parsed.data.exchangeRate != null,
        sourceOrderId,
      });
      Sentry.captureException(error);
    });
    return { success: false, error: "server_error" };
  }
}

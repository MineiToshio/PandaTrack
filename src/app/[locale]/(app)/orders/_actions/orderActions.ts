"use server";

import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { createOrder, editOrder } from "@/lib/data/orders/orderMutations";
import { orderCreateSchema, orderEditSchema } from "@/lib/orders/orderValidation";
import { parseDecimalToMinorUnits } from "@/lib/money/parseDecimalToMinorUnits";

export type OrderActionResult =
  | { success: true; orderId: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

function parseItemsJson(raw: FormDataEntryValue | null): unknown[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function createOrderAction(
  _prev: OrderActionResult | null,
  formData: FormData,
): Promise<OrderActionResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { success: false, error: "unauthorized" };
  }
  const userId = session.user.id;

  const rawItems = parseItemsJson(formData.get("items"));
  const items = rawItems.map((item: unknown) => {
    const row = item as Record<string, unknown>;
    return {
      name: row.name,
      quantity: typeof row.quantity === "string" ? parseInt(row.quantity, 10) : row.quantity,
      unitPrice: row.unitPrice != null && row.unitPrice !== "" ? parseDecimalToMinorUnits(String(row.unitPrice)) : null,
      productTypeKey: row.productTypeKey || null,
      position: typeof row.position === "number" ? row.position : 1,
    };
  });

  const totalCostRaw = formData.get("totalCost");
  const exchangeRateRaw = formData.get("exchangeRate");

  const raw = {
    storeId: formData.get("storeId") ?? undefined,
    orderDate: formData.get("orderDate") ?? undefined,
    expectedDeliveryFrom: formData.get("expectedDeliveryFrom") || null,
    expectedDeliveryTo: formData.get("expectedDeliveryTo") || null,
    currencyCode: formData.get("currencyCode") ?? undefined,
    exchangeRate:
      exchangeRateRaw && typeof exchangeRateRaw === "string" && exchangeRateRaw !== ""
        ? parseFloat(exchangeRateRaw)
        : null,
    totalCost: totalCostRaw && typeof totalCostRaw === "string" ? parseDecimalToMinorUnits(totalCostRaw) : undefined,
    items,
  };

  const parsed = orderCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    return { success: false, error: "validation", fieldErrors };
  }

  try {
    const result = await createOrder(userId, parsed.data);
    if (!result.ok) {
      return { success: false, error: result.error };
    }

    const posthog = getPostHogClient();
    posthog.capture({ distinctId: userId, event: POSTHOG_EVENTS.ORDER.CREATED });
    await posthog.shutdown();

    return { success: true, orderId: result.orderId };
  } catch (error) {
    Sentry.captureException(error);
    return { success: false, error: "server_error" };
  }
}

export async function editOrderAction(
  orderId: string,
  _prev: OrderActionResult | null,
  formData: FormData,
): Promise<OrderActionResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { success: false, error: "unauthorized" };
  }
  const userId = session.user.id;

  const rawItems = parseItemsJson(formData.get("items"));
  const items = rawItems.map((item: unknown) => {
    const row = item as Record<string, unknown>;
    return {
      id: typeof row.id === "string" ? row.id : undefined,
      name: row.name,
      quantity: typeof row.quantity === "string" ? parseInt(row.quantity, 10) : row.quantity,
      unitPrice: row.unitPrice != null && row.unitPrice !== "" ? parseDecimalToMinorUnits(String(row.unitPrice)) : null,
      productTypeKey: row.productTypeKey || null,
      position: typeof row.position === "number" ? row.position : 1,
    };
  });

  const totalCostRaw = formData.get("totalCost");
  const exchangeRateRaw = formData.get("exchangeRate");
  const storeIdRaw = formData.get("storeId");

  const raw = {
    storeId: typeof storeIdRaw === "string" && storeIdRaw ? storeIdRaw : undefined,
    orderDate: formData.get("orderDate") ?? undefined,
    expectedDeliveryFrom: formData.get("expectedDeliveryFrom") || null,
    expectedDeliveryTo: formData.get("expectedDeliveryTo") || null,
    currencyCode: formData.get("currencyCode") ?? undefined,
    exchangeRate:
      exchangeRateRaw && typeof exchangeRateRaw === "string" && exchangeRateRaw !== ""
        ? parseFloat(exchangeRateRaw)
        : null,
    totalCost: totalCostRaw && typeof totalCostRaw === "string" ? parseDecimalToMinorUnits(totalCostRaw) : undefined,
    items,
  };

  const parsed = orderEditSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    return { success: false, error: "validation", fieldErrors };
  }

  try {
    const result = await editOrder(orderId, userId, parsed.data);
    if (!result.ok) {
      return { success: false, error: result.error };
    }

    const posthog = getPostHogClient();
    posthog.capture({ distinctId: userId, event: POSTHOG_EVENTS.ORDER.EDITED });
    await posthog.shutdown();

    return { success: true, orderId };
  } catch (error) {
    Sentry.captureException(error);
    return { success: false, error: "server_error" };
  }
}

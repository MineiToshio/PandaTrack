"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { getSession } from "@/lib/auth/auth-server";
import { applyOrderExchangeRates } from "@/lib/data/orders/orderMutations";
import { getCollectorPreferencesSnapshot } from "@/lib/data/user-settings/userSettingsQueries";
import { exchangeRateSchema } from "@/lib/orders/orderValidation";

const updateSchema = z.object({
  updates: z
    .array(
      z.object({
        orderId: z.string().min(1),
        exchangeRate: exchangeRateSchema,
      }),
    )
    .min(1)
    .max(500),
});

export type UpdateExchangeRatesResult =
  { success: true; updatedCount: number } | { success: false; error: "unauthorized" | "invalid" | "server_error" };

export async function updateExchangeRatesAction(input: {
  updates: Array<{ orderId: string; exchangeRate: number }>;
}): Promise<UpdateExchangeRatesResult> {
  const session = await getSession();
  if (!session?.user?.id) return { success: false, error: "unauthorized" };
  const userId = session.user.id;

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "invalid" };

  try {
    const preferences = await getCollectorPreferencesSnapshot(userId);
    const updatedCount = await applyOrderExchangeRates(
      userId,
      preferences?.baseCurrencyCode ?? null,
      parsed.data.updates,
    );
    revalidatePath("/[locale]/orders", "page");
    // The dashboard reads the same derivation for its partial-totals banner, so it has to be
    // revalidated here too; otherwise reconciling leaves the banner still claiming N pending.
    revalidatePath("/[locale]/dashboard", "page");
    return { success: true, updatedCount };
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: "orders.fx-reconciliation" } });
    return { success: false, error: "server_error" };
  }
}

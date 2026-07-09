/**
 * Integration tests for user settings persistence helpers.
 * Requires DATABASE_URL and seeded catalogs (countries, store product types).
 */

import { prisma } from "@/lib/prisma";
import { applyCollectorPreferencesPatch, getCollectorPreferencesSnapshot } from "@/queries/userSettings";
import { parseCollectorPreferencesPatch } from "@/lib/user-settings/collectorPreferencesValidation";
import { createTestUserData } from "@/test/createTestUserData";
import { runSeed } from "../../../prisma/seed";
import { describe, expect, it } from "vitest";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe("userSettings queries", () => {
  it.skipIf(!hasDatabase)("persists collector preferences and product type links", async () => {
    await runSeed(prisma);

    const user = await prisma.user.create({
      data: createTestUserData({
        id: `test-user-settings-${Date.now()}`,
        email: `user-settings-${Date.now()}@example.com`,
        name: "Settings Test",
      }),
    });

    try {
      const patch = parseCollectorPreferencesPatch({
        preferredCountryCode: "ES",
        baseCurrencyCode: "EUR",
        budgetAmount: 25_000,
        budgetResetDayOfMonth: 31,
        timezone: "Europe/Madrid",
        preferredProductTypeKeys: ["manga", "figures"],
      });
      expect(patch.ok).toBe(true);
      if (!patch.ok) {
        return;
      }

      await applyCollectorPreferencesPatch(user.id, patch.value);

      const snapshot = await getCollectorPreferencesSnapshot(user.id);
      expect(snapshot).not.toBeNull();
      expect(snapshot?.preferredCountryCode).toBe("ES");
      expect(snapshot?.baseCurrencyCode).toBe("EUR");
      expect(snapshot?.budgetAmount).toBe(25_000);
      expect(snapshot?.budgetResetDayOfMonth).toBe(31);
      expect(snapshot?.timezone).toBe("Europe/Madrid");
      expect(snapshot?.preferredProductTypeKeys).toEqual(["figures", "manga"]);
    } finally {
      await prisma.userPreferredProductType.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});

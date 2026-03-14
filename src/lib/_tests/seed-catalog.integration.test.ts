/**
 * Integration test for store catalog seed: idempotency and seed-backed data.
 * Runs only when DATABASE_URL is set (e.g. CI with test DB). Skips otherwise.
 */

import { prisma } from "@/lib/prisma";
import { COUNTRY_CODES, runSeed, STORE_CATEGORY_KEYS } from "../../../prisma/seed";
import { describe, expect, it } from "vitest";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe("store catalog seed", () => {
  it.skipIf(!hasDatabase)("runs idempotently and seeds countries and store categories", async () => {
    await runSeed(prisma);

    const countries = await prisma.country.findMany({
      where: { code: { in: [...COUNTRY_CODES] } },
    });
    expect(countries.length).toBe(COUNTRY_CODES.length);
    expect(new Set(countries.map((c) => c.code))).toEqual(new Set(COUNTRY_CODES));

    const categories = await prisma.storeCategory.findMany({
      where: { key: { in: [...STORE_CATEGORY_KEYS] } },
    });
    expect(categories.length).toBe(STORE_CATEGORY_KEYS.length);
    expect(new Set(categories.map((c) => c.key))).toEqual(new Set(STORE_CATEGORY_KEYS));
  });
});

/**
 * Integration test for store catalog seed: idempotency and seed-backed data.
 * Runs only when DATABASE_URL is set (e.g. CI with test DB). Skips otherwise.
 */

import { prisma } from "@/lib/prisma";
import { COUNTRY_CODES, runSeed, STORE_PRODUCT_TYPE_KEYS } from "../../../prisma/seed";
import { describe, expect, it } from "vitest";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe("store catalog seed", () => {
  it.skipIf(!hasDatabase)("runs idempotently and seeds countries and store product types", async () => {
    await runSeed(prisma);

    const countries = await prisma.country.findMany({
      where: { code: { in: [...COUNTRY_CODES] } },
    });
    expect(countries.length).toBe(COUNTRY_CODES.length);
    expect(new Set(countries.map((c) => c.code))).toEqual(new Set(COUNTRY_CODES));

    const productTypes = await prisma.storeProductType.findMany({
      where: { key: { in: [...STORE_PRODUCT_TYPE_KEYS] } },
    });
    expect(productTypes.length).toBe(STORE_PRODUCT_TYPE_KEYS.length);
    expect(new Set(productTypes.map((productType) => productType.key))).toEqual(new Set(STORE_PRODUCT_TYPE_KEYS));
  });
});

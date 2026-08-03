-- Replaces the `needsExchangeRateUpdate` boolean with `exchangeRateBaseCode`, the base currency
-- each stored `exchangeRate` converts INTO. "Needs FX reconciliation" becomes derivable from the
-- data itself instead of a flag that every write path had to remember to set or clear (ADR 0023).
--
-- Backfill runs BEFORE the drop, and only where the old flag asserted the rate was good: a row
-- with `needsExchangeRateUpdate = false` and a rate on record had that rate entered against the
-- user's current base currency, so we can attribute it. Rows still flagged carry a rate of unknown
-- provenance (that is exactly what the flag meant), so they keep a NULL base code and stay pending
-- until the collector reconciles them once — after which the round trip can never re-break them.

-- AlterTable
ALTER TABLE "order" ADD COLUMN "exchangeRateBaseCode" TEXT;

UPDATE "order" o
SET "exchangeRateBaseCode" = u."baseCurrencyCode"
FROM "user" u
WHERE o."userId" = u."id"
  AND o."needsExchangeRateUpdate" = false
  AND o."exchangeRate" IS NOT NULL
  AND u."baseCurrencyCode" IS NOT NULL;

ALTER TABLE "order" DROP COLUMN "needsExchangeRateUpdate";

-- AlterTable
ALTER TABLE "delivery" ADD COLUMN "exchangeRateBaseCode" TEXT;

UPDATE "delivery" d
SET "exchangeRateBaseCode" = u."baseCurrencyCode"
FROM "user" u
WHERE d."userId" = u."id"
  AND d."needsExchangeRateUpdate" = false
  AND d."exchangeRate" IS NOT NULL
  AND u."baseCurrencyCode" IS NOT NULL;

ALTER TABLE "delivery" DROP COLUMN "needsExchangeRateUpdate";

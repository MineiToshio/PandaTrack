-- Add per-delivery FX reconciliation flag. Set true on base-currency change for deliveries
-- whose currencyCode differs from the new base; cleared when the delivery is edited.
ALTER TABLE "delivery" ADD COLUMN "needsExchangeRateUpdate" BOOLEAN NOT NULL DEFAULT false;

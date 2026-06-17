-- Add per-order FX reconciliation flag. Set true on base-currency change for orders
-- whose currencyCode differs from the new base; cleared on create/edit/bulk-reconcile.
ALTER TABLE "order" ADD COLUMN "needsExchangeRateUpdate" BOOLEAN NOT NULL DEFAULT false;

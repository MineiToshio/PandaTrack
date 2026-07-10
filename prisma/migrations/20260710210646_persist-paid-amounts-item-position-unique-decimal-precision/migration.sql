-- Persist a denormalized payment cache on "order" so the orders list can filter by payment
-- state and sort by paid ratio in SQL (removing the in-memory full-fetch path), enforce unique
-- item positions per order, and pin exchangeRate precision. All three changes are safe and
-- reversible against the current data set (dev/staging only, no production).

-- 1) order: add payment cache columns (defaults backfilled below) and pin exchangeRate precision.
ALTER TABLE "order"
  ADD COLUMN "paidAmountMinor" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "paymentPercent" INTEGER NOT NULL DEFAULT 0,
  ALTER COLUMN "exchangeRate" TYPE DECIMAL(18, 8);

-- 2) delivery: pin exchangeRate precision (values well within 18,8 given the 99,999.99 cap).
ALTER TABLE "delivery"
  ALTER COLUMN "exchangeRate" TYPE DECIMAL(18, 8);

-- 3) Backfill the payment cache from the source-of-truth payments. paymentPercent mirrors the
-- app's floor(paid / total * 100) clamped to 0..100; totalCost is guaranteed > 0 in practice,
-- but the CASE guards against a zero total to avoid division by zero. Orders with no payments
-- keep the column default of 0.
UPDATE "order" AS o
SET
  "paidAmountMinor" = p.sum,
  "paymentPercent" = CASE
    WHEN o."totalCost" <= 0 THEN 0
    ELSE LEAST(100, GREATEST(0, FLOOR(p.sum::numeric * 100 / o."totalCost")))::int
  END
FROM (
  SELECT "orderId", SUM("amount")::int AS sum
  FROM "order_payment"
  GROUP BY "orderId"
) AS p
WHERE p."orderId" = o."id";

-- 4) Normalize any duplicate (orderId, position) pairs before the unique index. The app already
-- normalizes positions to 1..N, so this is a defensive renumber ordered by the existing position
-- then creation order.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "orderId" ORDER BY "position", "createdAt", "id") AS rn
  FROM "order_item"
)
UPDATE "order_item" AS oi
SET "position" = ranked.rn
FROM ranked
WHERE ranked."id" = oi."id"
  AND oi."position" <> ranked.rn;

-- 5) Enforce unique item position per order.
CREATE UNIQUE INDEX "order_item_orderId_position_key" ON "order_item"("orderId", "position");

-- 6) Index backing the payment-state filter and paid-ratio sort on the orders list.
CREATE INDEX "order_userId_paymentPercent_idx" ON "order"("userId", "paymentPercent");

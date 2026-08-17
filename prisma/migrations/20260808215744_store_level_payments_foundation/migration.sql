-- AlterTable
ALTER TABLE "order" ADD COLUMN     "allocatedAmountMinor" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "store_payment" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,8),
    "exchangeRateBaseCode" TEXT,
    "note" TEXT,
    "migratedFromOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "userId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL DEFAULT 0,
    "settlesTarget" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_payment_storeId_idx" ON "store_payment"("storeId");

-- CreateIndex
CREATE INDEX "store_payment_userId_idx" ON "store_payment"("userId");

-- CreateIndex
CREATE INDEX "store_payment_userId_paymentDate_idx" ON "store_payment"("userId", "paymentDate");

-- CreateIndex
CREATE INDEX "store_payment_userId_storeId_currencyCode_idx" ON "store_payment"("userId", "storeId", "currencyCode");

-- CreateIndex
CREATE INDEX "payment_allocation_paymentId_idx" ON "payment_allocation"("paymentId");

-- CreateIndex
CREATE INDEX "payment_allocation_orderId_idx" ON "payment_allocation"("orderId");

-- CreateIndex
CREATE INDEX "payment_allocation_orderItemId_idx" ON "payment_allocation"("orderItemId");

-- CreateIndex
CREATE INDEX "payment_allocation_userId_idx" ON "payment_allocation"("userId");

-- AddForeignKey
ALTER TABLE "store_payment" ADD CONSTRAINT "store_payment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_payment" ADD CONSTRAINT "store_payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "store_payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Backfill: move the existing per-order payment history to the store level.
--
-- Every existing "order_payment" row becomes exactly one "store_payment" (the money that left
-- the collector's hands) plus exactly one "payment_allocation" declaring which order it was for,
-- so the trial starts from the same ledger the collector already sees, not from an empty table.
-- The change is purely additive: "order_payment" is left untouched and frozen, and the legacy
-- "paidAmountMinor" / "paymentPercent" caches on "order" keep their current values, so the
-- pre-migration behaviour stays fully reconstructible.
--
-- Ids are derived from the source row ("mig_" / "mig_alloc_" prefix over the order_payment id)
-- rather than randomly generated: they are unique by construction, and they keep each migrated
-- row traceable back to the exact payment it came from. Application writes use cuid(), which
-- never produces these prefixes.
-- ---------------------------------------------------------------------------

-- 1) One store_payment per order_payment. The store and the FX shape come from the parent order,
-- because a per-order payment carried none of its own; the amount, date and timestamps are the
-- original's. "note" stays NULL: the legacy rows had no note field to carry over.
INSERT INTO "store_payment" (
  "id", "storeId", "userId", "amount", "paymentDate", "currencyCode",
  "exchangeRate", "exchangeRateBaseCode", "note", "migratedFromOrderId", "createdAt", "updatedAt"
)
SELECT
  'mig_' || op."id",
  o."storeId",
  op."userId",
  op."amount",
  op."paymentDate",
  o."currencyCode",
  o."exchangeRate",
  o."exchangeRateBaseCode",
  NULL,
  op."orderId",
  op."createdAt",
  op."updatedAt"
FROM "order_payment" AS op
JOIN "order" AS o ON o."id" = op."orderId";

-- 2) One allocation per migrated payment, declaring the full amount against the original order.
-- "settlesTarget" is false: the legacy data recorded an amount, never a "settled in full" claim,
-- and inventing one would assert something the collector never declared. The allocation is
-- narrowed to an item only when the order has exactly one, where "this payment is for that item"
-- is the same statement as "this payment is for that order"; with two or more items the split is
-- unknown and stays at order level.
INSERT INTO "payment_allocation" (
  "id", "paymentId", "orderId", "orderItemId", "userId", "amountMinor", "settlesTarget", "createdAt"
)
SELECT
  'mig_alloc_' || op."id",
  'mig_' || op."id",
  op."orderId",
  single_item."itemId",
  op."userId",
  op."amount",
  FALSE,
  op."createdAt"
FROM "order_payment" AS op
JOIN "order" AS o ON o."id" = op."orderId"
LEFT JOIN (
  SELECT "orderId", MIN("id") AS "itemId"
  FROM "order_item"
  GROUP BY "orderId"
  HAVING COUNT(*) = 1
) AS single_item ON single_item."orderId" = op."orderId";

-- 3) Seed the new "allocatedAmountMinor" cache from the allocations just written, recomputed from
-- the rows themselves rather than copied from the legacy "paidAmountMinor", so the cache is proven
-- consistent with its own source of truth. Orders with no allocations keep the column default of 0.
UPDATE "order" AS o
SET "allocatedAmountMinor" = a."sum"
FROM (
  SELECT "orderId", SUM("amountMinor")::int AS "sum"
  FROM "payment_allocation"
  GROUP BY "orderId"
) AS a
WHERE a."orderId" = o."id";

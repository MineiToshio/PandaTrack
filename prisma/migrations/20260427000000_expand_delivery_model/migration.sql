-- Expand delivery model: add fields, update DeliveryStatus enum, add OrderItemDeliveryState.

-- Step 1: Add OrderItemDeliveryState enum.
CREATE TYPE "OrderItemDeliveryState" AS ENUM ('NONE', 'ARRIVED_AT_STORE', 'IN_TRANSIT', 'DELIVERED');

-- Step 2: Remove PENDING from DeliveryStatus.
-- No existing PENDING delivery rows exist, so no data migration is needed.
ALTER TYPE "DeliveryStatus" RENAME TO "DeliveryStatus_old";

CREATE TYPE "DeliveryStatus" AS ENUM ('IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- Drop the column default before the type change (it references DeliveryStatus_old).
ALTER TABLE "delivery" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "delivery"
  ALTER COLUMN "status" TYPE "DeliveryStatus"
    USING "status"::text::"DeliveryStatus";

ALTER TABLE "delivery" ALTER COLUMN "status" SET DEFAULT 'IN_TRANSIT';

DROP TYPE "DeliveryStatus_old";

-- Step 3: Add deliveryState field to order_item.
ALTER TABLE "order_item" ADD COLUMN "deliveryState" "OrderItemDeliveryState" NOT NULL DEFAULT 'NONE';

-- Step 4: Expand the delivery table with required fields.
-- userId foreign key
ALTER TABLE "delivery" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "delivery" ALTER COLUMN "userId" DROP DEFAULT;

-- humanReadableId unique identifier
ALTER TABLE "delivery" ADD COLUMN "humanReadableId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "delivery" ALTER COLUMN "humanReadableId" DROP DEFAULT;
CREATE UNIQUE INDEX "delivery_humanReadableId_key" ON "delivery"("humanReadableId");

-- date fields
ALTER TABLE "delivery" ADD COLUMN "deliveryDate" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "delivery" ALTER COLUMN "deliveryDate" DROP DEFAULT;
ALTER TABLE "delivery" ADD COLUMN "expectedArrivalFrom" TIMESTAMP(3);
ALTER TABLE "delivery" ADD COLUMN "expectedArrivalTo" TIMESTAMP(3);

-- cost and currency
ALTER TABLE "delivery" ADD COLUMN "cost" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "delivery" ALTER COLUMN "cost" DROP DEFAULT;
ALTER TABLE "delivery" ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "delivery" ALTER COLUMN "currencyCode" DROP DEFAULT;
ALTER TABLE "delivery" ADD COLUMN "exchangeRate" DECIMAL(65, 30);

-- optional text fields
ALTER TABLE "delivery" ADD COLUMN "carrier" TEXT;
ALTER TABLE "delivery" ADD COLUMN "trackingNumber" TEXT;
ALTER TABLE "delivery" ADD COLUMN "note" TEXT;

-- Step 4b: Populate userId from associated order items for existing rows.
UPDATE "delivery" d
SET "userId" = (
  SELECT o."userId"
  FROM "delivery_order_item" doi
  JOIN "order_item" oi ON doi."orderItemId" = oi.id
  JOIN "order" o ON oi."orderId" = o.id
  WHERE doi."deliveryId" = d.id
  LIMIT 1
)
WHERE d."userId" = '';

-- Remove deliveries that have no order items to resolve userId from.
DELETE FROM "delivery" WHERE "userId" = '';

-- Step 5: Add foreign key and index for userId on delivery.
ALTER TABLE "delivery" ADD CONSTRAINT "delivery_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "delivery_userId_idx" ON "delivery"("userId");
CREATE INDEX "delivery_status_idx" ON "delivery"("status");

-- Simplify OrderHistoryEventType: keep only status-change events.
-- Remove ORDER_EDITED, PAYMENT_ADDED, PAYMENT_DELETED, NOTE_UPDATED.
-- Add STATUS_CHANGED for delivery-driven status transitions.

-- Step 1: Delete history rows that use the removed event types so the
-- column cast below does not fail.
DELETE FROM "order_history"
WHERE "eventType" IN (
  'ORDER_EDITED',
  'PAYMENT_ADDED',
  'PAYMENT_DELETED',
  'NOTE_UPDATED'
);

-- Step 2: Rename the current enum so we can replace it.
ALTER TYPE "OrderHistoryEventType" RENAME TO "OrderHistoryEventType_old";

-- Step 3: Create the new enum with only the desired values.
CREATE TYPE "OrderHistoryEventType" AS ENUM (
  'ORDER_CREATED',
  'ORDER_CANCELLED',
  'ORDER_REACTIVATED',
  'STATUS_CHANGED'
);

-- Step 4: Migrate the column to the new enum type.
ALTER TABLE "order_history"
  ALTER COLUMN "eventType" TYPE "OrderHistoryEventType"
    USING "eventType"::text::"OrderHistoryEventType";

-- Step 5: Drop the old enum.
DROP TYPE "OrderHistoryEventType_old";

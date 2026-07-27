-- Moderation status carries lifecycle only; the public "this store has reports" notice is derived at
-- read time from the open-report count (ADR 0019). `FLAGGED` therefore leaves `StoreStatus`.
--
-- Order matters: Postgres cannot drop a value from an enum in place, and the type rewrite below would
-- fail on any row still holding the value being dropped. The data step must come first.

-- Step 1 · Map any surviving `FLAGGED` row back onto its lifecycle value, using the same derivation
-- the removed unflag path used: a store that was approved returns to `APPROVED`, otherwise `PENDING`.
UPDATE "store"
SET "status" = CASE
    WHEN "approvedAt" IS NOT NULL OR "approvedByUserId" IS NOT NULL THEN 'APPROVED'::"StoreStatus"
    ELSE 'PENDING'::"StoreStatus"
  END
WHERE "status" = 'FLAGGED';

-- Step 2 · Rewrite the enum type without `FLAGGED`. The column default is dropped before the cast and
-- re-established afterwards, because a default referencing the old type blocks the `ALTER ... TYPE`.
ALTER TYPE "StoreStatus" RENAME TO "StoreStatus_old";

CREATE TYPE "StoreStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "store" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "store"
  ALTER COLUMN "status" TYPE "StoreStatus" USING ("status"::text::"StoreStatus");

ALTER TABLE "store" ALTER COLUMN "status" SET DEFAULT 'PENDING';

DROP TYPE "StoreStatus_old";

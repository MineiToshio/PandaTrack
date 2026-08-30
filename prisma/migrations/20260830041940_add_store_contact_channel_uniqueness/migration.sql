/*
  Warnings:

  - A unique constraint covering the columns `[storeId,type,value]` on the table `store_contact_channel` will be added. If there are existing duplicate values, this will fail.

*/

-- Dedupe guard: `recordConfirmedStoreMatch` was recently hardened with a Serializable
-- transaction, but this migration is the DB-level backstop (audit item D1-bis), and it must be
-- able to run on prod data that has never had this constraint. Before creating the unique index,
-- collapse any existing (storeId, type, value) duplicates, keeping the oldest row per group
-- (by createdAt, tiebreak by id). Dev's own census found zero duplicate groups, so this is a
-- no-op there; it exists purely so a future prod deploy of this same migration cannot fail on
-- data this repository has never inspected.
WITH ranked AS (
  SELECT
    id,
    "storeId",
    type,
    value,
    "isPrimary",
    ROW_NUMBER() OVER (
      PARTITION BY "storeId", type, value
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM store_contact_channel
),
kept_rows_needing_primary AS (
  -- If a row being deleted was `isPrimary` and the row being kept is not, the kept row must
  -- inherit `isPrimary` so the store does not silently lose its primary channel for that
  -- (type, value) pair.
  SELECT DISTINCT kept.id AS keep_id
  FROM ranked AS duplicate
  JOIN ranked AS kept
    ON kept."storeId" = duplicate."storeId"
   AND kept.type = duplicate.type
   AND kept.value = duplicate.value
   AND kept.rn = 1
  WHERE duplicate.rn > 1
    AND duplicate."isPrimary" = true
)
UPDATE store_contact_channel
SET "isPrimary" = true
WHERE id IN (SELECT keep_id FROM kept_rows_needing_primary)
  AND "isPrimary" = false;

DELETE FROM store_contact_channel
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY "storeId", type, value
        ORDER BY "createdAt" ASC, id ASC
      ) AS rn
    FROM store_contact_channel
  ) AS ranked
  WHERE rn > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "store_contact_channel_storeId_type_value_key" ON "store_contact_channel"("storeId", "type", "value");

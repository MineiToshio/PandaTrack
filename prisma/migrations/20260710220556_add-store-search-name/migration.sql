-- Add normalized search column for store duplicate detection.
-- `searchName` holds the diacritic-stripped, lowercased, punctuation-collapsed form of `name`
-- (produced by the JS `normalizeStoreName`). Existing rows are backfilled by
-- scripts/backfill-store-search-name.ts after this migration is applied.
ALTER TABLE "store" ADD COLUMN "searchName" TEXT NOT NULL DEFAULT '';

CREATE INDEX "store_searchName_idx" ON "store"("searchName");

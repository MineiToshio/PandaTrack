-- Sergio decided per-payment notes weren't carrying their weight: the order has its own
-- private note and most collectors don't track per-payment metadata. We drop the column
-- here rather than just hiding the form field so nothing keeps writing or migrating
-- dead data. Re-adding later means a new ADD COLUMN migration + putting the form
-- field back; no data is being preserved across the drop.
ALTER TABLE "order_payment" DROP COLUMN "note";

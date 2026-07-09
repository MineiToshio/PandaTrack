-- Align "user"."budgetAmount" with every other money column (Order.totalCost, OrderPayment.amount),
-- which are all stored in minor units. It was the sole exception, stored in whole currency units,
-- and the dashboard budget zone consumed it as minor units — rendering a 200 budget as 2.00.

-- Backfill existing whole-unit budgets into minor units. No-op on an empty table.
UPDATE "user"
SET "budgetAmount" = "budgetAmount" * 100
WHERE "budgetAmount" IS NOT NULL;

-- Replace the positivity check with the minor-unit invariant: at least one whole currency unit,
-- and no fractional subunits (the collector budgets in whole units; minor units are storage only).
ALTER TABLE "user"
DROP CONSTRAINT "user_budgetAmount_positive_check";

ALTER TABLE "user"
ADD CONSTRAINT "user_budgetAmount_minor_units_check" CHECK (
  "budgetAmount" IS NULL OR ("budgetAmount" >= 100 AND "budgetAmount" % 100 = 0)
);

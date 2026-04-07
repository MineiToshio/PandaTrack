-- CreateTable
CREATE TABLE "user_preferred_product_type" (
    "userId" TEXT NOT NULL,
    "productTypeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_preferred_product_type_pkey" PRIMARY KEY ("userId","productTypeKey")
);

-- CreateIndex
CREATE INDEX "user_preferred_product_type_productTypeKey_idx" ON "user_preferred_product_type"("productTypeKey");

-- AlterTable (nullable first for backfill)
ALTER TABLE "user" ADD COLUMN "username" TEXT,
ADD COLUMN "usernameChangedAt" TIMESTAMP(3),
ADD COLUMN "preferredCountryCode" TEXT,
ADD COLUMN "baseCurrencyCode" TEXT,
ADD COLUMN "budgetAmount" INTEGER,
ADD COLUMN "budgetResetDayOfMonth" INTEGER,
ADD COLUMN "timezone" TEXT;

-- Backfill usernames from stable ids (cuid-style identifiers already satisfy the username contract)
UPDATE "user" SET "username" = LOWER("id") WHERE "username" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "username" SET NOT NULL;

-- Enforce the canonical username + budget invariants at the database layer
ALTER TABLE "user"
ADD CONSTRAINT "user_username_lowercase_check" CHECK ("username" = LOWER("username")),
ADD CONSTRAINT "user_username_format_check" CHECK ("username" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
ADD CONSTRAINT "user_username_length_check" CHECK (char_length("username") BETWEEN 3 AND 30),
ADD CONSTRAINT "user_baseCurrencyCode_uppercase_check" CHECK ("baseCurrencyCode" IS NULL OR "baseCurrencyCode" = UPPER("baseCurrencyCode")),
ADD CONSTRAINT "user_budgetAmount_positive_check" CHECK ("budgetAmount" IS NULL OR "budgetAmount" >= 1),
ADD CONSTRAINT "user_budgetResetDayOfMonth_range_check" CHECK ("budgetResetDayOfMonth" IS NULL OR "budgetResetDayOfMonth" BETWEEN 1 AND 31),
ADD CONSTRAINT "user_budget_requires_base_currency_check" CHECK ("budgetAmount" IS NULL OR "baseCurrencyCode" IS NOT NULL);

-- CreateIndex
CREATE INDEX "user_preferredCountryCode_idx" ON "user"("preferredCountryCode");

-- AddForeignKey
ALTER TABLE "user_preferred_product_type" ADD CONSTRAINT "user_preferred_product_type_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferred_product_type" ADD CONSTRAINT "user_preferred_product_type_productTypeKey_fkey" FOREIGN KEY ("productTypeKey") REFERENCES "store_product_type"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_preferredCountryCode_fkey" FOREIGN KEY ("preferredCountryCode") REFERENCES "country"("code") ON DELETE SET NULL ON UPDATE CASCADE;

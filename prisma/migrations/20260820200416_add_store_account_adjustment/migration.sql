-- CreateTable
CREATE TABLE "store_account_adjustment" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "adjustmentDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_account_adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_account_adjustment_line" (
    "id" TEXT NOT NULL,
    "adjustmentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_account_adjustment_line_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_account_adjustment_userId_idx" ON "store_account_adjustment"("userId");

-- CreateIndex
CREATE INDEX "store_account_adjustment_storeId_idx" ON "store_account_adjustment"("storeId");

-- CreateIndex
CREATE INDEX "store_account_adjustment_userId_storeId_currencyCode_idx" ON "store_account_adjustment"("userId", "storeId", "currencyCode");

-- CreateIndex
CREATE INDEX "store_account_adjustment_userId_adjustmentDate_idx" ON "store_account_adjustment"("userId", "adjustmentDate");

-- CreateIndex
CREATE INDEX "store_account_adjustment_line_userId_orderId_idx" ON "store_account_adjustment_line"("userId", "orderId");

-- CreateIndex
CREATE INDEX "store_account_adjustment_line_adjustmentId_idx" ON "store_account_adjustment_line"("adjustmentId");

-- CreateIndex
CREATE UNIQUE INDEX "store_account_adjustment_line_adjustmentId_orderId_key" ON "store_account_adjustment_line"("adjustmentId", "orderId");

-- AddForeignKey
ALTER TABLE "store_account_adjustment" ADD CONSTRAINT "store_account_adjustment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_account_adjustment" ADD CONSTRAINT "store_account_adjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_account_adjustment_line" ADD CONSTRAINT "store_account_adjustment_line_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "store_account_adjustment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_account_adjustment_line" ADD CONSTRAINT "store_account_adjustment_line_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_account_adjustment_line" ADD CONSTRAINT "store_account_adjustment_line_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: the Prisma schema language cannot express a CHECK constraint. This reproduces,
-- for StoreAccountAdjustmentLine, the positivity guarantee `StorePayment.amount` gets implicitly
-- from application code (ADR 0034 §5). The column is "amountMinor" (camelCase): no @map was
-- declared on the field, so Prisma did not snake_case it the way @@map does for the table name.
ALTER TABLE "store_account_adjustment_line" ADD CONSTRAINT "store_account_adjustment_line_amount_minor_positive" CHECK ("amountMinor" > 0);

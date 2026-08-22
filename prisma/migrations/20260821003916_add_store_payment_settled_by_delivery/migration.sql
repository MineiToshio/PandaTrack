-- AlterTable
ALTER TABLE "store_payment" ADD COLUMN     "settledByDeliveryId" TEXT;

-- CreateIndex
CREATE INDEX "store_payment_settledByDeliveryId_idx" ON "store_payment"("settledByDeliveryId");

-- AddForeignKey
ALTER TABLE "store_payment" ADD CONSTRAINT "store_payment_settledByDeliveryId_fkey" FOREIGN KEY ("settledByDeliveryId") REFERENCES "delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

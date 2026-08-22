-- AlterTable
ALTER TABLE "payment_allocation" ADD COLUMN     "consumedByDeliveryId" TEXT;

-- CreateIndex
CREATE INDEX "payment_allocation_consumedByDeliveryId_idx" ON "payment_allocation"("consumedByDeliveryId");

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_consumedByDeliveryId_fkey" FOREIGN KEY ("consumedByDeliveryId") REFERENCES "delivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

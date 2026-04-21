/*
  Warnings:

  - Added the required column `name` to the `order_item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `position` to the `order_item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `order_item` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "order_item" ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "position" INTEGER NOT NULL,
ADD COLUMN     "productTypeKey" TEXT,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "unitPrice" INTEGER,
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "order_item_userId_idx" ON "order_item"("userId");

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_productTypeKey_fkey" FOREIGN KEY ("productTypeKey") REFERENCES "store_product_type"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

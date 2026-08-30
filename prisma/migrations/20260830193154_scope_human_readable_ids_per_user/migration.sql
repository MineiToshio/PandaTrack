/*
  Warnings:

  - A unique constraint covering the columns `[userId,humanReadableId]` on the table `delivery` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,humanReadableId]` on the table `order` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "delivery_humanReadableId_key";

-- DropIndex
DROP INDEX "order_humanReadableId_key";

-- CreateIndex
CREATE UNIQUE INDEX "delivery_userId_humanReadableId_key" ON "delivery"("userId", "humanReadableId");

-- CreateIndex
CREATE UNIQUE INDEX "order_userId_humanReadableId_key" ON "order"("userId", "humanReadableId");

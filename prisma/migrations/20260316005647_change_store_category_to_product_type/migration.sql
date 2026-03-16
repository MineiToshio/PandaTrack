/*
  Warnings:

  - You are about to drop the `store_category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `store_category_assignment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `store_category_request` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "StoreProductTypeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "store_category_assignment" DROP CONSTRAINT "store_category_assignment_categoryKey_fkey";

-- DropForeignKey
ALTER TABLE "store_category_assignment" DROP CONSTRAINT "store_category_assignment_storeId_fkey";

-- DropForeignKey
ALTER TABLE "store_category_request" DROP CONSTRAINT "store_category_request_requestedById_fkey";

-- DropTable
DROP TABLE "store_category";

-- DropTable
DROP TABLE "store_category_assignment";

-- DropTable
DROP TABLE "store_category_request";

-- DropEnum
DROP TYPE "StoreCategoryRequestStatus";

-- CreateTable
CREATE TABLE "store_product_type" (
    "key" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_product_type_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "store_product_type_assignment" (
    "storeId" TEXT NOT NULL,
    "productTypeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_product_type_assignment_pkey" PRIMARY KEY ("storeId","productTypeKey")
);

-- CreateTable
CREATE TABLE "store_product_type_request" (
    "id" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "suggestedKey" TEXT,
    "suggestedName" TEXT NOT NULL,
    "reason" TEXT,
    "status" "StoreProductTypeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_product_type_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_product_type_assignment_productTypeKey_idx" ON "store_product_type_assignment"("productTypeKey");

-- CreateIndex
CREATE INDEX "store_product_type_request_requestedById_idx" ON "store_product_type_request"("requestedById");

-- CreateIndex
CREATE INDEX "store_product_type_request_status_idx" ON "store_product_type_request"("status");

-- AddForeignKey
ALTER TABLE "store_product_type_assignment" ADD CONSTRAINT "store_product_type_assignment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_product_type_assignment" ADD CONSTRAINT "store_product_type_assignment_productTypeKey_fkey" FOREIGN KEY ("productTypeKey") REFERENCES "store_product_type"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_product_type_request" ADD CONSTRAINT "store_product_type_request_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
